// Supabase Edge Function "trascrivi"
// Legge le foto di una pagina di quaderno scritta a mano e la restituisce divisa nei campi del diario
// (titolo, data, obiettivo, campioni, appunti, risultati, problemi, prossimi passi, parole chiave).
// Con task "riconosci" (giro 41) guarda le foto di un isolato in piastra o al microscopio e propone i generi
// più probabili, con i caratteri visti per la chiave guidata della micoteca.
// Ognuno sceglie nell'app se usare Claude (Anthropic) o Gemini (Google), con le chiavi del laboratorio.
// La foto non viene salvata qui: passa al servizio scelto e torna indietro solo il testo.
//
// Secrets da impostare in Supabase > Edge Functions > Secrets, almeno una delle due:
//   ANTHROPIC_API_KEY  chiave creata su platform.claude.com (a pagamento, circa 1-2 centesimi a pagina)
//   GEMINI_API_KEY     chiave creata su aistudio.google.com (con la fatturazione attiva i dati non servono ad addestrare)
// Facoltativi:
//   ANTHROPIC_MODEL    modello di Claude (predefinito claude-sonnet-5-5)
//   GEMINI_MODEL       modello di Gemini (predefinito gemini-3.8-flash)
//   AI_DAILY_LIMIT     pagine al giorno per persona (predefinito 30)

import { createClient } from 'npm:@supabase/supabase-js@2';

type Provider = 'claude' | 'gemini';
const KEYS: Record<Provider, string> = { claude: Deno.env.get('ANTHROPIC_API_KEY') ?? '', gemini: Deno.env.get('GEMINI_API_KEY') ?? '' };
const MODELS: Record<Provider, string> = { claude: Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5', gemini: Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash' };
const BASE: Record<Provider, string> = {
  claude: (Deno.env.get('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/$/, ''),
  gemini: (Deno.env.get('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''),
};
const LIMIT = Math.max(1, Number(Deno.env.get('AI_DAILY_LIMIT') || 30));
const MAX_IMAGES = 4;
const MAX_B64 = 6_000_000;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function serverKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    const k = keys.default ?? Object.values(keys)[0];
    if (typeof k === 'string' && k) return k;
  } catch { /* chiavi legacy */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

const available = () => (['claude', 'gemini'] as Provider[]).filter((p) => KEYS[p]);
const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());

// ---- istruzioni e forma della risposta (le stesse dell'app, per chi usa la propria chiave)
const FIELDS = ['title', 'day', 'aim', 'samples', 'notes', 'results', 'problems', 'next_steps'] as const;
const SYSTEM = `Trascrivi pagine di quaderno di laboratorio scritte a mano. Il laboratorio è di patologia vegetale: funghi fitopatogeni, micotossine, estrazioni, PCR e sequenziamento, LC-MS, piante e semi.
Riporta fedelmente quello che c'è scritto, nella lingua originale, senza riassumere, tradurre o aggiungere niente e senza correggere i dati.
Numeri, unità, sigle e codici di campioni e ceppi vanno copiati esattamente (µL, °C, rpm, ×g, mM).
Le parole che non riesci a leggere scrivile [?], oppure [parola?] se hai un'ipotesi. Ignora le parti barrate.
Dividi il testo nei campi:
- title: titolo breve se è scritto o è chiaro dall'intestazione, altrimenti vuoto
- day: data della pagina come AAAA-MM-GG (le date sono scritte giorno/mese/anno), vuoto se non c'è
- aim: obiettivo o scopo
- samples: campioni, ceppi e materiali usati
- notes: procedura e appunti, cioè tutto il resto della pagina in ordine. Usa "## " per i titoletti, "- " per gli elenchi, "1. " per i passaggi numerati; le tabelle come righe con i valori separati da " | "
- results: risultati e osservazioni
- problems: problemi o imprevisti
- next_steps: cose da fare dopo
- tags: fino a 6 parole chiave utili per cercare (tecniche, organismi, molecole)
- doubts: le parole o i numeri incerti, da far controllare
Se un campo non c'è lascialo vuoto: non inventare obiettivi né risultati. Più foto sono pagine consecutive della stessa voce.`;

const CLAUDE_SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(FIELDS.map((f) => [f, { type: 'string' }])),
    tags: { type: 'array', items: { type: 'string' } },
    doubts: { type: 'array', items: { type: 'string' } },
  },
  required: [...FIELDS, 'tags', 'doubts'],
};
const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    ...Object.fromEntries(FIELDS.map((f) => [f, { type: 'STRING' }])),
    tags: { type: 'ARRAY', items: { type: 'STRING' } },
    doubts: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: [...FIELDS, 'tags', 'doubts'],
};

const MAXLEN: Record<string, number> = { title: 140, day: 10, aim: 2000, samples: 1000, notes: 20000, results: 8000, problems: 2000, next_steps: 2000 };
function clean(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS) out[f] = String(raw?.[f] ?? '').replace(/\r\n/g, '\n').trim().slice(0, MAXLEN[f]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out.day as string) || Number.isNaN(Date.parse(out.day as string))) out.day = '';
  const list = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v : []).map((x) => String(x ?? '').trim().slice(0, len)).filter(Boolean).slice(0, n);
  out.tags = list(raw?.tags, 8, 40);
  out.doubts = list(raw?.doubts, 30, 80);
  return out;
}

// ---- riconoscere un isolato (le stesse istruzioni dell'app, per chi usa la propria chiave)
const ID_VALUES: Record<string, string[]> = {"colore": ["bianco", "crema", "giallo", "arancio", "rosa", "verde", "grigio", "oliva", "nero"], "rovescio": ["chiaro", "giallo", "rosso", "marrone", "nero"], "aspetto": ["cotonoso", "vellutato", "feltroso", "mucoso", "zone"], "crescita": ["lenta", "media", "rapida"], "strutture": ["nessuna", "sclerozi", "puntini", "arancio", "sporangi", "pustole", "gocce"], "spore": ["falcate", "lunate", "catene", "rami", "muribecco", "muri", "elmintosporio", "cilindriche", "grappolo", "teste", "grandinere", "verrucose", "diplodia", "picnidiospore", "limoni", "sporangi", "oomiceti", "gemme", "nessuna"], "colorespore": ["ialine", "verdi", "brune", "nere", "arancio"], "ife": ["settate", "scure", "cenocitiche", "angolo", "fibbie"]};
const ID_SYSTEM = `Aiuti un laboratorio di patologia vegetale (funghi fitopatogeni e tossigeni di cereali, semi, frutti e piante) a riconoscere un isolato fungino in coltura. Ricevi foto della colonia in piastra (sopra e a volte il rovescio) e a volte delle spore o delle ife al microscopio, con le note del laboratorio (terreno, giorni, temperatura, origine).
Descrivi solo quello che si vede davvero. Proponi da 1 a 5 candidati, dal più probabile, al livello di genere. Scrivi la specie o il complesso di specie solo se i caratteri visibili bastano.
Da una foto la morfologia porta di solito al genere: per ogni candidato indica come confermarlo (terreno e condizioni, cosa guardare al microscopio, locus da sequenziare).
Se le foto non bastano (sfocate, piastra troppo giovane o troppo vecchia, contaminata, manca il rovescio o il microscopio) dillo e suggerisci cosa fotografare. Se non è un fungo (batteri, lieviti, oomiceti) dillo.
Scrivi in italiano, con frasi brevi.
Campi della risposta:
- description: quello che si vede, in 2 o 3 frasi
- traits: i caratteri che si vedono nelle foto, solo con i valori ammessi qui sotto; lascia vuoto quello che non si vede
- candidates: name (genere, o specie se davvero riconoscibile), confidence (alta, media o bassa), why (cosa torna), against (cosa non torna, vuoto se niente), confirm (come confermarlo)
- next_steps: cosa fare per arrivare alla specie
- quality: problemi delle foto, vuoto se vanno bene
Valori ammessi per traits:
- colore (colore della colonia, sopra): bianco = bianco; crema = crema o beige; giallo = giallo; arancio = arancio o salmone; rosa = rosa, rosso o viola; verde = verde o blu verde; grigio = grigio; oliva = oliva o marrone; nero = nero
- rovescio (colore del rovescio): chiaro = incolore o crema; giallo = giallo o arancio; rosso = rosso, viola o porpora; marrone = marrone; nero = nero o quasi
- aspetto (aspetto del micelio): cotonoso = cotonoso, alto; vellutato = vellutato o polveroso; feltroso = feltroso, basso e compatto; mucoso = lucido e umido, da lievito; zone = ad anelli o a petali
- crescita (crescita in 7 giorni a 25 °C): lenta = lenta, meno di 3 cm; media = media, da 3 a 7 cm; rapida = rapida, riempie la piastra
- strutture (cosa si vede a occhio o allo stereo): nessuna = niente di particolare; sclerozi = sclerozi, corpi duri scuri; puntini = puntini neri, picnidi o sporodochi; arancio = masse o cuscinetti arancio; sporangi = testine scure su fili lunghi; pustole = ciuffi o anelli di spore verdi; gocce = goccioline di essudato
- spore (spore al microscopio): falcate = falcate con setti, a canoa; lunate = a mezzaluna, senza piede; catene = tonde e piccole, in lunghe catene; rami = ellittiche in catene ramificate; muribecco = muriformi a clava, con becco; muri = muriformi senza becco; elmintosporio = cilindriche scure, con molti setti; cilindriche = cilindriche chiare, una cellula; grappolo = ovali, a grappolo su rami scuri; teste = piccole, in testine mucose; grandinere = tonde nere, grandi, una cellula; verrucose = tonde scure e verrucose; diplodia = grandi ellittiche, chiare poi brune; picnidiospore = piccolissime, escono dai picnidi; limoni = a limone, in catenelle; sporangi = dentro sacche (sporangi); oomiceti = sporangi a limone e oospore; gemme = cellule singole che gemmano; nessuna = nessuna spora
- colorespore (colore delle spore): ialine = trasparenti; verdi = verdi in massa; brune = brune o oliva; nere = nere; arancio = rosa o arancio in massa
- ife (ife): settate = chiare, con setti; scure = scure, con setti; cenocitiche = larghe, quasi senza setti; angolo = rami ad angolo retto, strozzati; fibbie = con giunti a fibbia`;
const idSchema = (G: boolean) => {
  const t = (x: string) => (G ? x.toUpperCase() : x);
  const str = { type: t('string') };
  return {
    type: t('object'),
    properties: {
      description: str,
      traits: { type: t('object'), properties: Object.fromEntries(Object.entries(ID_VALUES).map(([k, v]) => [k, { type: t('array'), items: { type: t('string'), enum: v } }])) },
      candidates: { type: t('array'), items: { type: t('object'), properties: { name: str, confidence: { type: t('string'), enum: ['alta', 'media', 'bassa'] }, why: str, against: str, confirm: str }, required: ['name', 'confidence', 'why', 'against', 'confirm'] } },
      next_steps: str,
      quality: str,
    },
    required: ['description', 'traits', 'candidates', 'next_steps', 'quality'],
  };
};
function cleanId(raw: Record<string, any>) {
  const s = (v: unknown, n: number) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, n);
  const traits: Record<string, string[]> = {};
  for (const [k, ok] of Object.entries(ID_VALUES)) {
    const v = (Array.isArray(raw?.traits?.[k]) ? raw.traits[k] : []).map((x: unknown) => String(x).trim().toLowerCase()).filter((x: string) => ok.includes(x));
    if (v.length) traits[k] = [...new Set(v)] as string[];
  }
  const candidates = (Array.isArray(raw?.candidates) ? raw.candidates : []).map((c: Record<string, unknown>) => ({
    name: s(c?.name, 80), confidence: ['alta', 'media', 'bassa'].includes(String(c?.confidence).toLowerCase()) ? String(c?.confidence).toLowerCase() : '',
    why: s(c?.why, 600), against: s(c?.against, 400), confirm: s(c?.confirm, 500),
  })).filter((c: { name: string }) => c.name).slice(0, 5);
  return { description: s(raw?.description, 800), traits, candidates, next_steps: s(raw?.next_steps, 800), quality: s(raw?.quality, 400) };
}

class Fail extends Error { constructor(msg: string, public status = 502) { super(msg); } }
function providerError(p: Provider, status: number, body: string) {
  const name = p === 'claude' ? 'Claude' : 'Gemini';
  if (status === 401 || status === 403) return new Fail(`La chiave di ${name} non è valida o non ha credito`, 502);
  if (status === 404) return new Fail(`Il modello ${MODELS[p]} di ${name} non è disponibile: cambia ${p === 'claude' ? 'ANTHROPIC_MODEL' : 'GEMINI_MODEL'} nei Secrets`, 502);
  if (status === 429) return new Fail(`${name} ha ricevuto troppe richieste: riprova fra un minuto`, 503);
  if (status === 400 && /credit|billing|balance/i.test(body)) return new Fail(`Il credito di ${name} è finito`, 502);
  if (status >= 500) return new Fail(`${name} è occupato in questo momento: riprova fra poco`, 503);
  return new Fail(`${name} non ha letto la pagina (${status})`, 502);
}

async function askClaude(images: string[], text: string, id = false) {
  const r = await fetch(`${BASE.claude}/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEYS.claude, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELS.claude,
      max_tokens: id ? 3000 : 8000,
      system: id ? ID_SYSTEM : SYSTEM,
      tools: [id ? { name: 'isolato', description: "Cosa si vede e i candidati per l'isolato", input_schema: idSchema(false) } : { name: 'pagina', description: 'La pagina trascritta, divisa nei campi del diario', input_schema: CLAUDE_SCHEMA }],
      tool_choice: { type: 'tool', name: id ? 'isolato' : 'pagina' },
      messages: [{ role: 'user', content: [...images.map((data) => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } })), { type: 'text', text }] }],
    }),
  });
  const body = await r.text();
  if (!r.ok) throw providerError('claude', r.status, body);
  const out = JSON.parse(body);
  const use = (out.content ?? []).find((c: { type: string }) => c.type === 'tool_use');
  if (!use?.input) throw new Fail(id ? 'Claude non ha risposto' : 'Claude non ha restituito la pagina');
  return use.input;
}

async function askGemini(images: string[], text: string, id = false) {
  const r = await fetch(`${BASE.gemini}/v1beta/models/${encodeURIComponent(MODELS.gemini)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': KEYS.gemini },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: id ? ID_SYSTEM : SYSTEM }] },
      contents: [{ role: 'user', parts: [...images.map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })), { text }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: id ? idSchema(true) : GEMINI_SCHEMA, temperature: id ? 0.2 : 0 },
    }),
  });
  const body = await r.text();
  if (!r.ok) throw providerError('gemini', r.status, body);
  const out = JSON.parse(body);
  const txt = (out.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  try { return JSON.parse(txt); } catch { throw new Fail(id ? 'Gemini non ha risposto' : 'Gemini non ha restituito la pagina'); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false, autoRefreshToken: false } });
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !auth?.user) return json({ error: 'Accesso non valido' }, 401);
    const uid = auth.user.id;
    const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (!me || me.role === 'pending') return json({ error: 'Account non approvato' }, 403);

    const input = await req.json().catch(() => null);
    if (!input || typeof input !== 'object') return json({ error: 'Richiesta non valida' }, 400);
    const today = romeToday();
    const { data: rows } = await admin.from('ai_usage').select('provider, pages').eq('user_id', uid).eq('day', today);
    const used = (rows ?? []).reduce((n: number, r: { pages: number }) => n + (r.pages ?? 0), 0);

    if (input.ping) return json({ providers: available(), models: MODELS, limit: LIMIT, used });

    const provider = (input.provider ?? available()[0]) as Provider;
    if (!['claude', 'gemini'].includes(provider)) return json({ error: 'Servizio non previsto' }, 400);
    if (!KEYS[provider]) {
      const name = (p: Provider) => (p === 'claude' ? 'Claude' : 'Gemini');
      const msg = available().length ? `${name(provider)} non è attivo per il laboratorio: scegli ${name(available()[0])}` : 'La trascrizione non è ancora attiva: manca la chiave nei Secrets di Supabase';
      return json({ error: msg, providers: available() }, 503);
    }
    const images = Array.isArray(input.images) ? input.images.filter((x: unknown) => typeof x === 'string' && x.length > 100) : [];
    const id = input.task === 'riconosci';
    if (!images.length) return json({ error: id ? "Manca la foto dell'isolato" : 'Manca la foto della pagina' }, 400);
    if (images.length > MAX_IMAGES) return json({ error: `Al massimo ${MAX_IMAGES} foto per volta` }, 400);
    if (images.some((x: string) => x.length > MAX_B64 || !/^[A-Za-z0-9+/=]+$/.test(x.slice(0, 2000)))) return json({ error: 'Foto troppo grande o non valida' }, 413);
    if (used + images.length > LIMIT) return json({ error: `Oggi hai già usato l'AI per ${used} foto su ${LIMIT}: riprova domani`, used, limit: LIMIT }, 429);
    const record = async () => {
      const cur = (rows ?? []).find((r: { provider: string }) => r.provider === provider);
      await admin.from('ai_usage').upsert({ user_id: uid, day: today, provider, pages: (cur?.pages ?? 0) + images.length }, { onConflict: 'user_id,day,provider' });
    };

    if (id) {
      const note = String(input.note ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
      const known = String(input.known ?? '').replace(/\s+/g, ' ').trim().slice(0, 600);
      const text = `Ecco ${images.length > 1 ? `${images.length} foto dello stesso isolato` : "la foto dell'isolato"}.${note ? ` Note del laboratorio: ${note}.` : ''}${known ? ` Già osservato: ${known}.` : ''} Riconosci l'isolato.`;
      const raw = provider === 'claude' ? await askClaude(images, text, true) : await askGemini(images, text, true);
      const result = cleanId(raw);
      await record();
      return json({ result, provider, model: MODELS[provider], used: used + images.length, limit: LIMIT });
    }

    const projects = (Array.isArray(input.projects) ? input.projects : []).map((x: unknown) => String(x).slice(0, 80)).slice(0, 40);
    const text = `Oggi è ${today}.${projects.length ? ` Progetti del laboratorio: ${projects.join(', ')}.` : ''} Trascrivi ${images.length > 1 ? `queste ${images.length} pagine` : 'la pagina'}.`;
    const raw = provider === 'claude' ? await askClaude(images, text) : await askGemini(images, text);
    const page = clean(raw);
    await record();
    return json({ page, provider, model: MODELS[provider], used: used + images.length, limit: LIMIT });
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
