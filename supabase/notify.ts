// Supabase Edge Function "notify"
// Manda le notifiche push ai telefoni del laboratorio:
//  - articolo diventato "da riordinare" (a tutti tranne chi l'ha segnalato)
//  - nuovo problema segnalato (a tutti tranne chi l'ha segnalato)
//  - promemoria 15 minuti prima di una prenotazione (solo a chi ha prenotato),
//    chiamata ogni 5 minuti dal database con l'intestazione x-cron-secret
//    e il lunedì mattina con { "riepilogo": true } per il riepilogo della settimana.
//    Ogni giro controlla anche la micoteca (conservazioni da rifare, avvisi tra le 9 e le 19).
//  - parte del diario mandata a un collega (solo a chi la riceve)
//  - articoli nuovi del laboratorio (giro 42): il lunedì con il riepilogo, o con { "articoli": true } da un amministratore,
//    guarda ORCID e Crossref delle persone seguite e aggiunge gli articoli nuovi con abstract e link al testo libero
// Con GET ?ical=<link personale> restituisce le prenotazioni di quella persona come calendario .ics,
// da aggiungere a Google Calendar o al calendario dell'iPhone (giro 27).
// Con { "test": true } manda una prova solo a chi chiama.
//
// Secrets da impostare in Supabase > Edge Functions > Secrets:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (es. mailto:nome@uniroma1.it), CRON_SECRET

import { createClient } from 'npm:@supabase/supabase-js@2';

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com';
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

// ---------------------------------------------------------------------------
//  Web Push (RFC 8030, 8291, 8292) con sola WebCrypto
// ---------------------------------------------------------------------------
const te = new TextEncoder();

function fromB64u(s: string): Uint8Array {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toB64u(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Uint8Array come BufferSource (evita gli avvisi dei tipi più recenti di TypeScript)
const buf = (u: Uint8Array) => u as unknown as BufferSource;

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8);
  return new Uint8Array(bits);
}

let signingKey: Promise<CryptoKey> | null = null;
function vapidKey(): Promise<CryptoKey> {
  if (!signingKey) {
    const pub = fromB64u(VAPID_PUBLIC);
    const jwk = {
      kty: 'EC', crv: 'P-256', d: VAPID_PRIVATE,
      x: toB64u(pub.slice(1, 33)), y: toB64u(pub.slice(33, 65)), ext: true,
    };
    signingKey = crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  }
  return signingKey;
}

async function vapidHeader(endpoint: string): Promise<string> {
  const header = toB64u(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = toB64u(te.encode(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  })));
  const unsigned = `${header}.${claims}`;
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(), te.encode(unsigned));
  return `vapid t=${unsigned}.${toB64u(new Uint8Array(sig))}, k=${VAPID_PUBLIC}`;
}

async function encrypt(p256dh: string, authSecret: string, plaintext: Uint8Array): Promise<Uint8Array> {
  const uaPublic = fromB64u(p256dh);
  const auth = fromB64u(authSecret);
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', buf(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, local.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(te.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt']);
  const body = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, key, buf(concat(plaintext, new Uint8Array([2])))));
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, body);
}

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string };

async function sendPush(sub: Sub, payload: unknown): Promise<number> {
  const body = await encrypt(sub.p256dh, sub.auth, te.encode(JSON.stringify(payload)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidHeader(sub.endpoint),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '86400',
      Urgency: 'high',
    },
    body: buf(body),
  });
  await res.body?.cancel();
  return res.status;
}

// deno-lint-ignore no-explicit-any
async function deliver(admin: any, subs: Sub[], payload: unknown) {
  let sent = 0, failed = 0;
  const dead: string[] = [];
  await Promise.all(subs.map(async (s) => {
    try {
      const status = await sendPush(s, payload);
      if (status >= 200 && status < 300) sent++;
      else { failed++; if (status === 404 || status === 410) dead.push(s.id); }
    } catch { failed++; }
  }));
  if (dead.length) await admin.from('push_subscriptions').delete().in('id', dead);
  return { sent, failed, removed: dead.length };
}

const fmt = (n: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(n);
const hhmm = (iso: string) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(iso));
const NOBODY = '00000000-0000-0000-0000-000000000000';

// deno-lint-ignore no-explicit-any
async function memberSubs(admin: any): Promise<Sub[]> {
  const { data: members } = await admin.from('profiles').select('id').in('role', ['member', 'admin']);
  const ids = (members ?? []).map((m: { id: string }) => m.id);
  if (!ids.length) return [];
  const { data } = await admin.from('push_subscriptions').select('*').in('user_id', ids);
  return data ?? [];
}

// deno-lint-ignore no-explicit-any
async function names(admin: any, ids: (string | null)[]): Promise<Record<string, string>> {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  const { data } = await admin.from('profiles').select('id, full_name').in('id', list.length ? list : [NOBODY]);
  return Object.fromEntries((data ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
}

// Promemoria: prenotazioni che iniziano entro 20 minuti, non ancora avvisate
// deno-lint-ignore no-explicit-any
async function reminders(admin: any) {
  const now = new Date();
  const { data: due, error } = await admin.from('bookings')
    .update({ reminded_at: now.toISOString() })
    .is('reminded_at', null)
    .gt('starts_at', now.toISOString())
    .lte('starts_at', new Date(now.getTime() + 20 * 60e3).toISOString())
    .select('id, instrument_id, user_id, starts_at, ends_at, note');
  if (error) throw error;
  if (!due?.length) return { sent: 0, bookings: 0 };
  const instIds = [...new Set(due.map((b: { instrument_id: string }) => b.instrument_id))];
  const userIds = [...new Set(due.map((b: { user_id: string }) => b.user_id))];
  const [{ data: insts }, { data: subs }] = await Promise.all([
    admin.from('instruments').select('id, name, location').in('id', instIds),
    admin.from('push_subscriptions').select('*').in('user_id', userIds),
  ]);
  let sent = 0;
  for (const b of due) {
    const inst = insts?.find((i: { id: string }) => i.id === b.instrument_id);
    const mins = Math.max(1, Math.round((new Date(b.starts_at).getTime() - now.getTime()) / 60e3));
    const r = await deliver(admin, (subs ?? []).filter((s: Sub) => s.user_id === b.user_id), {
      title: `Tra ${mins} minuti: ${inst?.name ?? 'prenotazione'}`,
      body: [`Dalle ${hhmm(b.starts_at)} alle ${hhmm(b.ends_at)}`, inst?.location, b.note].filter(Boolean).join(' · '),
      url: './#prenota',
      tag: `booking-${b.id}`,
    });
    sent += r.sent;
  }
  return { sent, bookings: due.length };
}

// Micoteca: conservazioni da rifare (spore in glicerolo, piastre...). Avvisa il referente
// una settimana prima della scadenza e poi una volta a settimana finché non vengono rifatte.
const STOCK_LABEL: Record<string, string> = {
  spore_glicerolo: 'spore in glicerolo', micelio_glicerolo: 'micelio in glicerolo', piastre: 'piastre', provette: 'provette a becco di clarino',
  acqua: 'conservazione in acqua', olio: 'conservazione sotto olio', liofilizzato: 'liofilizzato', altro: 'conservazione',
};
// giro 44: piastre e provette di un ceppo che ha anche spore o micelio conservati a lungo non mandano avvisi.
// Quando servono si ripiastra dalla conservazione lunga
const SHORT_STOCK = ['piastre', 'provette'];
const LONG_STOCK = ['spore_glicerolo', 'micelio_glicerolo', 'acqua', 'olio', 'liofilizzato'];
// deno-lint-ignore no-explicit-any
async function dropBacked<T extends { kind: string; strain_id: string }>(admin: any, rows: T[]): Promise<T[]> {
  const ids = [...new Set(rows.filter((x) => SHORT_STOCK.includes(x.kind)).map((x) => x.strain_id))];
  if (!ids.length) return rows;
  const { data, error } = await admin.from('strain_stocks').select('strain_id').eq('status', 'attiva').in('kind', LONG_STOCK).in('strain_id', ids);
  if (error) throw error;
  const backed = new Set((data ?? []).map((r: { strain_id: string }) => r.strain_id));
  return rows.filter((x) => !(SHORT_STOCK.includes(x.kind) && backed.has(x.strain_id)));
}
const romeDate = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
const dkey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const itDate = (k: string) => k.split('-').reverse().join('/');

// deno-lint-ignore no-explicit-any
async function stockAlarms(admin: any, force = false) {
  const now = romeDate();
  if (!force && (now.getHours() < 9 || now.getHours() >= 19)) return { stocks: 0 };
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const weekAgo = new Date(Date.now() - 6.5 * 86400e3).toISOString();
  // presa in carico atomica: mai avvisate, oppure avvisate più di una settimana fa
  const claim = (q: any) => q.eq('status', 'attiva').not('due_on', 'is', null).lte('due_on', dkey(in7))
    .or(`snooze_until.is.null,snooze_until.lte.${dkey(in7)}`)
    .select('id, strain_id, kind, made_on, due_on, qty, place, keeper_id, snooze_until');
  const stamp = new Date().toISOString();
  const [fresh, again] = await Promise.all([
    claim(admin.from('strain_stocks').update({ notified_at: stamp }).is('notified_at', null)),
    claim(admin.from('strain_stocks').update({ notified_at: stamp }).lt('notified_at', weekAgo)),
  ]);
  if (fresh.error) throw fresh.error;
  if (again.error) throw again.error;
  const due = await dropBacked(admin, [...(fresh.data ?? []), ...(again.data ?? [])]);
  if (!due?.length) return { stocks: 0 };
  const { data: strains } = await admin.from('strains').select('id, code, species, keeper_id, status').in('id', [...new Set(due.map((x: { strain_id: string }) => x.strain_id))]);
  const byId = Object.fromEntries((strains ?? []).map((s: { id: string }) => [s.id, s]));
  const { data: admins } = await admin.from('profiles').select('id').eq('role', 'admin');
  // a chi va l'avviso: chi si occupa della conservazione, se no il referente del ceppo, se no gli amministratori
  const groups = new Map<string, typeof due>();
  for (const x of due) {
    const st = byId[x.strain_id];
    if (!st || st.status !== 'attivo') continue;
    const to = x.keeper_id ?? st.keeper_id ?? null;
    const targets = to ? [to] : (admins ?? []).map((a: { id: string }) => a.id);
    for (const t of targets) { if (!groups.has(t)) groups.set(t, []); groups.get(t)!.push(x); }
  }
  if (!groups.size) return { stocks: due.length, sent: 0 };
  const { data: subs } = await admin.from('push_subscriptions').select('*').in('user_id', [...groups.keys()]);
  const today = dkey(now);
  let sent = 0;
  for (const [uid, list] of groups) {
    const name = (x: { strain_id: string }) => { const st = byId[x.strain_id]; return [st.code, st.species].filter(Boolean).join(' ') || 'un ceppo'; };
    const eff = (x: { due_on: string; snooze_until?: string | null }) => (x.snooze_until && x.snooze_until > x.due_on ? x.snooze_until : x.due_on);
    const late = (x: { due_on: string; snooze_until?: string | null }) => eff(x) <= today;
    const one = list[0];
    const payload = list.length === 1
      ? { title: `${late(one) ? 'Da rifare' : 'Da rifare presto'}: ${STOCK_LABEL[one.kind] ?? 'conservazione'} di ${name(one)}`,
          body: [one.made_on && `Fatte il ${itDate(one.made_on)}`, !late(one) && `entro il ${itDate(eff(one))}`, one.place].filter(Boolean).join(' · ') || 'Quando le rifai tocca "Rifatte oggi" nella micoteca',
          url: './#micoteca', tag: `stock-${one.id}` }
      : { title: `${list.length} conservazioni da rifare`,
          body: list.slice(0, 4).map((x: { kind: string; strain_id: string }) => `${STOCK_LABEL[x.kind] ?? 'conservazione'} di ${name(x)}`).join(', ') + (list.length > 4 ? ` e altre ${list.length - 4}` : ''),
          url: './#micoteca', tag: `stocks-${today}` };
    const r = await deliver(admin, (subs ?? []).filter((s: Sub) => s.user_id === uid), payload);
    sent += r.sent;
  }
  return { stocks: due.length, sent };
}

// Riepilogo del lunedì: cosa manca, cosa scade, cosa c'è da fare in settimana
// deno-lint-ignore no-explicit-any
async function weekly(admin: any) {
  const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Rome' }));
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return key(d); };
  const t0 = key(today), in7 = plus(6), in14 = plus(14);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString();
  const [items, reqs, tasks, strains, cyl, waste, stocks, issues, pract] = await Promise.all([
    admin.from('items').select('status, expiry, opened_on, open_days'),
    admin.from('order_requests').select('id').eq('status', 'richiesta'),
    admin.from('tasks').select('id').eq('done', false).lte('due_on', in7),
    admin.from('strains').select('subculture_days, last_subculture').eq('status', 'attivo').not('subculture_days', 'is', null),
    admin.from('cylinders').select('id').eq('status', 'vuota'),
    admin.from('waste_containers').select('id').eq('status', 'piena'),
    admin.from('strain_stocks').select('id, kind, strain_id, strains!inner(status)').eq('status', 'attiva').eq('strains.status', 'attivo').lte('due_on', in7).or(`snooze_until.is.null,snooze_until.lte.${in7}`),
    admin.from('issues').select('id, kind, created_at').neq('status', 'risolto'),
    admin.from('practicals').select('starts_at').gte('starts_at', new Date().toISOString()).lt('starts_at', new Date(Date.now() + 7 * 864e5).toISOString()).order('starts_at'),
  ]);
  if (stocks.data) stocks.data = await dropBacked(admin, stocks.data);
  const iss = issues.data ?? [];
  const oldProblems = iss.filter((i: { kind: string; created_at: string }) => i.kind !== 'incidente' && i.created_at < weekAgo).length;
  const openIncidents = iss.filter((i: { kind: string }) => i.kind === 'incidente').length;
  const its = items.data ?? [];
  const toOrder = its.filter((i: { status: string }) => i.status === 'da_ordinare').length;
  const expiring = its.filter((i: { expiry: string | null; opened_on: string | null; open_days: number | null }) => {
    let e = i.expiry;
    if (i.opened_on && i.open_days) {
      const d = new Date(`${i.opened_on}T12:00:00`); d.setDate(d.getDate() + i.open_days);
      const o = key(d); if (!e || o < e) e = o;
    }
    return e && e <= in14;
  }).length;
  const dueStrains = (strains.data ?? []).filter((s: { subculture_days: number; last_subculture: string | null }) => {
    if (!s.last_subculture) return true;
    const d = new Date(`${s.last_subculture}T12:00:00`); d.setDate(d.getDate() + s.subculture_days);
    return key(d) <= in7;
  }).length;
  const n = (x: { data: unknown[] | null }) => x.data?.length ?? 0;
  const pl = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  const parts = [
    toOrder && pl(toOrder, 'articolo da ordinare', 'articoli da ordinare'),
    n(reqs) && pl(n(reqs), 'richiesta d\'ordine', 'richieste d\'ordine'),
    expiring && pl(expiring, 'prodotto in scadenza', 'prodotti in scadenza'),
    n(tasks) && pl(n(tasks), 'compito in settimana', 'compiti in settimana'),
    dueStrains && pl(dueStrains, 'ceppo da ripiccare', 'ceppi da ripiccare'),
    n(stocks) && pl(n(stocks), 'conservazione della micoteca da rifare', 'conservazioni della micoteca da rifare'),
    n(cyl) && pl(n(cyl), 'bombola da ritirare', 'bombole da ritirare'),
    n(waste) && pl(n(waste), 'tanica piena', 'taniche piene'),
    oldProblems && pl(oldProblems, 'problema aperto da più di una settimana', 'problemi aperti da più di una settimana'),
    openIncidents && pl(openIncidents, 'incidente da verificare', 'incidenti da verificare'),
    n(pract) && `${pl(n(pract), 'esercitazione', 'esercitazioni')} con gli studenti (${[...new Set((pract.data ?? []).map((x: { starts_at: string }) => dayIt(x.starts_at)))].join(', ')})`,
  ].filter(Boolean) as string[];
  if (!parts.length) return { sent: 0, weekly: 'niente da segnalare', today: t0 };
  const r = await deliver(admin, await memberSubs(admin), { title: 'La settimana in laboratorio', body: parts.join(' · '), url: './', tag: `weekly-${t0}` });
  return { ...r, weekly: parts };
}

// Esercitazioni con gli studenti: avviso a tutti quando vengono segnate o spostate,
// e il pomeriggio del giorno prima
const romeKey = (iso: string) => dkey(new Date(new Date(iso).toLocaleString('en-US', { timeZone: 'Europe/Rome' })));
const dayIt = (iso: string) => new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso));
type Practical = { id: string; title: string; room: string | null; students: number | null; starts_at: string; ends_at: string; instrument_ids: string[]; created_by: string | null; moved: boolean; note: string | null };
// deno-lint-ignore no-explicit-any
async function practicalBody(admin: any, list: Practical[]) {
  const ids = [...new Set(list.flatMap((p) => p.instrument_ids ?? []))];
  const { data: insts } = await admin.from('instruments').select('id, name').in('id', ids.length ? ids : [NOBODY]);
  const nm = Object.fromEntries((insts ?? []).map((i: { id: string; name: string }) => [i.id, i.name]));
  return (p: Practical, extra: string[] = []) => [
    `${hhmm(p.starts_at)}–${hhmm(p.ends_at)}`, p.room, p.students ? `${p.students} studenti` : null,
    (p.instrument_ids ?? []).length ? `con ${(p.instrument_ids ?? []).map((i) => nm[i]).filter(Boolean).join(', ')}` : null, ...extra,
  ].filter(Boolean).join(' · ');
}

// deno-lint-ignore no-explicit-any
async function newPracticals(admin: any, subs: Sub[]) {
  const now = new Date();
  const { data, error } = await admin.from('practicals')
    .update({ notified_at: now.toISOString() })
    .is('notified_at', null)
    .gt('ends_at', now.toISOString())
    .select('id, title, room, students, starts_at, ends_at, instrument_ids, created_by, moved, note');
  if (error) throw error;
  if (!data?.length) return 0;
  const body = await practicalBody(admin, data);
  const who = await names(admin, data.map((p: Practical) => p.created_by));
  let sent = 0;
  for (const p of data as Practical[]) {
    const r = await deliver(admin, subs.filter((s) => s.user_id !== p.created_by), {
      title: `${p.moved ? 'Esercitazione spostata a' : 'Esercitazione'} ${dayIt(p.starts_at)}: ${p.title}`,
      body: body(p, [p.created_by && who[p.created_by] ? `segnata da ${who[p.created_by]}` : '']),
      url: './#prenota',
      tag: `practical-${p.id}`,
    });
    sent += r.sent;
  }
  // se comincia entro 30 ore questo avviso basta, niente promemoria la sera prima
  const soon = (data as Practical[]).filter((p) => new Date(p.starts_at).getTime() - now.getTime() < 30 * 3600e3).map((p) => p.id);
  if (soon.length) await admin.from('practicals').update({ reminded_at: now.toISOString() }).in('id', soon);
  return sent;
}

// deno-lint-ignore no-explicit-any
async function practicalReminders(admin: any, force = false) {
  const local = romeDate();
  if (!force && (local.getHours() < 17 || local.getHours() >= 22)) return { practicals: 0 };
  const tomorrow = new Date(local); tomorrow.setDate(local.getDate() + 1);
  const tk = dkey(tomorrow);
  const now = new Date();
  const { data, error } = await admin.from('practicals').select('id, starts_at').is('reminded_at', null)
    .gt('starts_at', now.toISOString()).lt('starts_at', new Date(now.getTime() + 50 * 3600e3).toISOString());
  if (error) throw error;
  const ids = (data ?? []).filter((p: { starts_at: string }) => romeKey(p.starts_at) === tk).map((p: { id: string }) => p.id);
  if (!ids.length) return { practicals: 0 };
  const { data: took } = await admin.from('practicals').update({ reminded_at: now.toISOString() }).in('id', ids).is('reminded_at', null)
    .select('id, title, room, students, starts_at, ends_at, instrument_ids, created_by, moved, note');
  if (!took?.length) return { practicals: 0 };
  const body = await practicalBody(admin, took);
  const subs = await memberSubs(admin);
  let sent = 0;
  for (const p of took as Practical[]) {
    const r = await deliver(admin, subs, { title: `Domani esercitazione: ${p.title}`, body: body(p, [p.note ?? '']), url: './#prenota', tag: `practical-${p.id}-domani` });
    sent += r.sent;
  }
  return { practicals: took.length, sent };
}

// Nuovi problemi segnalati
// deno-lint-ignore no-explicit-any
// Diario mandato a un collega: avvisa solo chi lo riceve. Giro 54: l'accesso d'emergenza dello sviluppatore
// avvisa invece chi scrive il diario
// deno-lint-ignore no-explicit-any
async function newShares(admin: any, subs: Sub[]) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: shares, error } = await admin.from('journal_shares')
    .update({ notified_at: new Date().toISOString() })
    .is('notified_at', null)
    .gte('created_at', since)
    .select('id, owner_id, viewer_id, project_id, from_day, to_day, entry_ids, note, forced');
  if (error) return 0;  // database non ancora aggiornato
  if (!shares?.length) return 0;
  const who = await names(admin, shares.flatMap((s: { owner_id: string; viewer_id: string }) => [s.owner_id, s.viewer_id]));
  const pids = [...new Set(shares.map((s: { project_id: string | null }) => s.project_id).filter(Boolean))];
  const { data: projects } = pids.length ? await admin.from('lab_projects').select('id, name').in('id', pids) : { data: [] };
  let sent = 0;
  for (const s of shares) {
    if (s.forced) {
      const r = await deliver(admin, subs.filter((x) => x.user_id === s.owner_id), {
        title: `${who[s.viewer_id] ?? 'Lo sviluppatore'} ha aperto il tuo diario`,
        body: ['Accesso d\'emergenza', s.note].filter(Boolean).join(' · '),
        url: './#diario',
        tag: `share-${s.id}`,
      });
      sent += r.sent;
      continue;
    }
    const what = s.entry_ids?.length ? (s.entry_ids.length === 1 ? 'una pagina' : `${s.entry_ids.length} pagine`)
      : s.project_id ? `il progetto ${projects?.find((p: { id: string }) => p.id === s.project_id)?.name ?? ''}`.trim()
      : s.from_day || s.to_day ? 'alcuni giorni' : 'tutto il diario';
    const r = await deliver(admin, subs.filter((x) => x.user_id === s.viewer_id), {
      title: `${who[s.owner_id] ?? 'Un collega'} ti ha mandato il diario`,
      body: [what, s.note].filter(Boolean).join(' · '),
      url: './#diario',
      tag: `share-${s.id}`,
    });
    sent += r.sent;
  }
  return sent;
}

async function newIssues(admin: any, subs: Sub[]) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: issues, error } = await admin.from('issues')
    .update({ notified_at: new Date().toISOString() })
    .is('notified_at', null)
    .gte('created_at', since)
    .select('id, title, urgency, location, created_by, kind');
  if (error) throw error;
  if (!issues?.length) return 0;
  const who = await names(admin, issues.map((i: { created_by: string }) => i.created_by));
  // gli incidenti arrivano solo agli amministratori, i problemi a tutti
  const { data: adminRows } = await admin.from('profiles').select('id').eq('role', 'admin');
  const adminIds = new Set((adminRows ?? []).map((a: { id: string }) => a.id));
  const SEV: Record<string, string> = { bassa: 'lieve', normale: 'medio', alta: 'grave' };
  let sent = 0;
  for (const i of issues) {
    const incident = i.kind === 'incidente';
    const targets = subs.filter((s) => s.user_id !== i.created_by && (!incident || adminIds.has(s.user_id)));
    const r = await deliver(admin, targets, incident ? {
      title: `Incidente ${SEV[i.urgency] ?? ''}: ${i.title}`.replace('  ', ' '),
      body: [i.location, who[i.created_by] && `registrato da ${who[i.created_by]}`].filter(Boolean).join(' · ') || 'Nuovo incidente nel registro',
      url: './#incidenti',
      tag: `issue-${i.id}`,
    } : {
      title: `${i.urgency === 'alta' ? 'Problema urgente' : 'Problema'}: ${i.title}`,
      body: [i.location, who[i.created_by] && `segnalato da ${who[i.created_by]}`].filter(Boolean).join(' · ') || 'Nuova segnalazione',
      url: './#problemi',
      tag: `issue-${i.id}`,
    });
    sent += r.sent;
  }
  return sent;
}

// ---------------------------------------------------------------------------
//  Calendario (giro 27): le prenotazioni di una persona in formato iCalendar (RFC 5545), con il link segreto
//  della tabella calendar_tokens. Orari in UTC, i ripiani dei fitotroni come giornate intere.
// ---------------------------------------------------------------------------
const icsEsc = (s: unknown) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
function icsFold(line: string): string {
  if (te.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '', n = 0;
  for (const ch of line) {
    const b = te.encode(ch).length;
    if (n + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; n = 0; }
    cur += ch; n += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
const icsTime = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '');
const icsDay = (d: string) => d.replace(/-/g, '');
const dayAfter = (d: string) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };

// deno-lint-ignore no-explicit-any
async function ical(admin: any, token: string): Promise<Response> {
  const plain = { ...cors, 'Content-Type': 'text/plain; charset=utf-8' };
  if (!/^[0-9a-f]{32,128}$/i.test(token)) return new Response('Link del calendario non valido', { status: 404, headers: plain });
  const { data: t } = await admin.from('calendar_tokens').select('user_id').eq('token', token).maybeSingle();
  if (!t) return new Response('Link del calendario non valido o cambiato dall\'app', { status: 404, headers: plain });
  const { data: me } = await admin.from('profiles').select('full_name, role').eq('id', t.user_id).maybeSingle();
  if (!me || me.role === 'pending') return new Response('Account non approvato', { status: 403, headers: plain });
  const from = new Date(Date.now() - 60 * 86400e3).toISOString(), to = new Date(Date.now() + 400 * 86400e3).toISOString();
  const [bk, ch, pr, inst] = await Promise.all([
    admin.from('bookings').select('id, instrument_id, starts_at, ends_at, note').eq('user_id', t.user_id).is('practical_id', null).gte('ends_at', from).lte('starts_at', to).order('starts_at'),
    admin.from('chamber_slots').select('id, instrument_id, shelf, label, starts_on, ends_on, note').eq('user_id', t.user_id).gte('ends_on', from.slice(0, 10)).order('starts_on'),
    admin.from('practicals').select('id, title, course, room, starts_at, ends_at, students, note').eq('created_by', t.user_id).gte('ends_at', from).order('starts_at'),
    admin.from('instruments').select('id, name, location'),
  ]);
  const im = new Map((inst.data ?? []).map((i: { id: string }) => [i.id, i]));
  const stamp = icsTime(new Date().toISOString());
  const ev: string[][] = [];
  for (const b of bk.data ?? []) {
    const i = im.get(b.instrument_id) as { name?: string; location?: string } | undefined;
    ev.push([`UID:prenotazione-${b.id}@labapp`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(b.starts_at)}`, `DTEND:${icsTime(b.ends_at)}`, `SUMMARY:${icsEsc(i?.name ?? 'Strumento')}`,
      ...(i?.location ? [`LOCATION:${icsEsc(i.location)}`] : []), ...(b.note ? [`DESCRIPTION:${icsEsc(b.note)}`] : [])]);
  }
  for (const c of ch.data ?? []) {
    const i = im.get(c.instrument_id) as { name?: string; location?: string } | undefined;
    ev.push([`UID:ripiano-${c.id}@labapp`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${icsDay(c.starts_on)}`, `DTEND;VALUE=DATE:${icsDay(dayAfter(c.ends_on))}`,
      `SUMMARY:${icsEsc(`${i?.name ?? 'Fitotrone'}, ripiano ${c.shelf}: ${c.label}`)}`, 'TRANSP:TRANSPARENT', ...(i?.location ? [`LOCATION:${icsEsc(i.location)}`] : []), ...(c.note ? [`DESCRIPTION:${icsEsc(c.note)}`] : [])]);
  }
  for (const p of pr.data ?? []) {
    const desc = [p.course, p.students ? `${p.students} studenti` : '', p.note].filter(Boolean).join('\n');
    ev.push([`UID:esercitazione-${p.id}@labapp`, `DTSTAMP:${stamp}`, `DTSTART:${icsTime(p.starts_at)}`, `DTEND:${icsTime(p.ends_at)}`, `SUMMARY:${icsEsc(`Esercitazione: ${p.title}`)}`,
      ...(p.room ? [`LOCATION:${icsEsc(p.room)}`] : []), ...(desc ? [`DESCRIPTION:${icsEsc(desc)}`] : [])]);
  }
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LabApp//Plant Pathology Lab//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEsc(me.full_name ? `LabApp · ${me.full_name}` : 'LabApp')}`, 'X-WR-TIMEZONE:Europe/Rome', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
    ...ev.flatMap((e) => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'];
  return new Response(lines.map(icsFold).join('\r\n') + '\r\n', {
    headers: { ...cors, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="labapp.ics"', 'Cache-Control': 'no-store' },
  });
}


// ---------------------------------------------------------------------
// Articoli del laboratorio (giro 42). Il lunedì, insieme al riepilogo, e quando un amministratore tocca
// "Controlla adesso": per ogni persona seguita guarda il profilo ORCID e Crossref (gli ORCID depositati
// dagli editori), prende gli articoli usciti dall'anno scorso in poi che non ci sono e che non sono stati
// tolti, li aggiunge con abstract e link al testo libero e avvisa tutti. Poi completa abstract e link
// mancanti di qualche articolo già presente. Tiene solo gli articoli in cui la persona compare davvero
// tra gli autori (cognome e iniziale), perché alcuni profili ORCID contengono lavori di omonimi.
// ---------------------------------------------------------------------
const ORCID_BASE = (Deno.env.get('ORCID_BASE_URL') || 'https://pub.orcid.org').replace(/\/$/, '');
const CROSSREF_BASE = (Deno.env.get('CROSSREF_BASE_URL') || 'https://api.crossref.org').replace(/\/$/, '');
const EPMC_BASE = (Deno.env.get('EPMC_BASE_URL') || 'https://www.ebi.ac.uk/europepmc/webservices/rest').replace(/\/$/, '');
const S2_BASE = (Deno.env.get('S2_BASE_URL') || 'https://api.semanticscholar.org').replace(/\/$/, '');
const UA = { 'User-Agent': 'LabApp/1.0 (Plant Pathology Lab, Sapienza Universita di Roma)' };

async function getJson(url: string, init: RequestInit = {}, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, headers: { ...UA, ...(init.headers ?? {}) }, signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}
const normDoi = (d: string) => String(d || '').trim().toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, '').replace(/^doi:\s*/, '');
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const titleKey = (s: string) => plain(String(s || '')).replace(/[^a-z0-9]/g, '');
const tidy = (t: string) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim().replace(/^(Abstract|ABSTRACT|Summary)(\s*[:.]\s*|\s*\n\s*|\s+(?=[A-Z]))/, '').trim();
const fromJats = (t: string) => tidy(String(t || '').replace(/<jats:title>\s*(Abstract|Summary|ABSTRACT)\s*<\/jats:title>/g, '')
  .replace(/<jats:title>\s*(.*?)\s*<\/jats:title>/g, '\n\n$1\n').replace(/<\/jats:p>\s*<jats:p>/g, '\n\n').replace(/<[^>]+>/g, ''));
const fromEpmc = (t: string) => tidy(String(t || '').replace(/<h4>\s*(.*?)\s*<\/h4>/g, '\n\n$1\n').replace(/<br\s*\/?>/g, '\n\n').replace(/<[^>]+>/g, ''));
const LIC: Record<string, string> = { CCBY: 'CC BY', CCBYNC: 'CC BY-NC', CCBYNCND: 'CC BY-NC-ND', CCBYNCSA: 'CC BY-NC-SA', CCBYSA: 'CC BY-SA', CCBYND: 'CC BY-ND', CC0: 'CC0' };
const crLicense = (m: Record<string, unknown>) => {
  for (const l of (m?.license as { URL?: string }[]) ?? []) {
    const x = /creativecommons\.org\/(?:licenses|publicdomain)\/([a-z-]+)/i.exec(l.URL ?? '')?.[1];
    if (x) return x.toLowerCase() === 'zero' ? 'CC0' : `CC ${x.toUpperCase()}`;
  }
  return null;
};
const keysOf = (full: string) => { const w = plain(full).trim().split(/\s+/); return [...new Set([w.slice(1).join(' '), w.at(-1) ?? ''])].filter(Boolean).map((sur) => ({ sur, ini: (w[0] ?? '')[0] ?? '' })); };
const hasAuthor = (authors: string, full: string) => {
  const ks = keysOf(full);
  return authors.split(';').some((t) => { const x = plain(t).trim(); return ks.some((k) => x.startsWith(`${k.sur} `) && x.slice(k.sur.length + 1).replace(/[^a-z]/g, '').startsWith(k.ini)); });
};
const authorsOf = (m: Record<string, unknown>) => ((m?.author as { family?: string; given?: string; name?: string }[]) ?? [])
  .map((a) => [a.family, String(a.given ?? '').split(/[\s.-]+/).filter(Boolean).map((x) => x[0].toUpperCase()).join('')].filter(Boolean).join(' ') || a.name || '').filter(Boolean).join('; ');
const yearOf = (m: Record<string, { 'date-parts'?: number[][] }>) => m?.issued?.['date-parts']?.[0]?.[0] || m?.published?.['date-parts']?.[0]?.[0] || m?.['published-online']?.['date-parts']?.[0]?.[0] || null;
const NOT_PAPER = /^(correction|corrigendum|erratum|retraction|retracted|expression of concern|editorial|reply|response to)/i;

// a gruppi di 4 per non martellare i servizi
async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => { while (i < xs.length) { const k = i++; out[k] = await fn(xs[k]); } }));
  return out;
}

async function orcidDois(orcid: string) {
  const d = await getJson(`${ORCID_BASE}/v3.0/${orcid}/works`, { headers: { Accept: 'application/json' } });
  if (!d) return null;
  const out: { doi: string; year: number | null }[] = [];
  for (const g of d.group ?? []) {
    const ws = g['work-summary'] ?? [];
    if (!ws.length || !['journal-article', 'review'].includes(ws[0].type)) continue;
    const ids = [g, ...ws].flatMap((x: { 'external-ids'?: { 'external-id'?: { 'external-id-type': string; 'external-id-value': string; 'external-id-normalized'?: { value: string } }[] } }) => x['external-ids']?.['external-id'] ?? []);
    const doi = ids.find((e) => e['external-id-type'] === 'doi');
    if (doi) out.push({ doi: normDoi(doi['external-id-normalized']?.value || doi['external-id-value']), year: Number(ws[0]['publication-date']?.year?.value) || null });
  }
  return out;
}
async function crossrefOrcid(orcid: string, fromYear: number) {
  const d = await getJson(`${CROSSREF_BASE}/works?filter=orcid:${orcid},from-pub-date:${fromYear}-01-01,type:journal-article&rows=100&select=DOI,issued`);
  if (!d) return null;
  return (d.message?.items ?? []).map((m: { DOI: string; issued?: { 'date-parts'?: number[][] } }) => ({ doi: normDoi(m.DOI), year: m.issued?.['date-parts']?.[0]?.[0] ?? null }));
}
async function crossrefWork(doi: string) {
  const d = await getJson(`${CROSSREF_BASE}/works/${encodeURIComponent(doi)}`);
  return d?.message ?? null;
}
async function epmcByDoi(dois: string[]) {
  const out: Record<string, { abstract: string | null; pmcid: string | null; license: string | null }> = {};
  for (let i = 0; i < dois.length; i += 25) {
    const q = dois.slice(i, i + 25).map((x) => `DOI:"${x}"`).join(' OR ');
    const d = await getJson(`${EPMC_BASE}/search?query=${encodeURIComponent(q)}&resultType=core&pageSize=100&format=json`);
    for (const r of d?.resultList?.result ?? []) {
      if (!r.doi) continue;
      out[normDoi(r.doi)] = { abstract: r.abstractText ? fromEpmc(r.abstractText) : null, pmcid: r.pmcid ?? null, license: String(r.license ?? '').startsWith('cc') ? String(r.license).toUpperCase().replace('CC BY', 'CC BY') : null };
    }
  }
  return out;
}
async function s2ByDoi(dois: string[]) {
  const out: Record<string, { abstract: string | null; pdf: string | null; license: string | null }> = {};
  if (!dois.length) return out;
  const d = await getJson(`${S2_BASE}/graph/v1/paper/batch?fields=abstract,openAccessPdf`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: dois.map((x) => `DOI:${x}`) }) });
  (Array.isArray(d) ? d : []).forEach((r: { abstract?: string; openAccessPdf?: { url?: string; license?: string } } | null, k: number) => {
    if (!r) return;
    const u = r.openAccessPdf?.url ?? '';
    out[dois[k]] = { abstract: r.abstract ? tidy(r.abstract) : null, pdf: /^https?:\/\//.test(u) ? u : null, license: LIC[String(r.openAccessPdf?.license ?? '').replace(/-/g, '').toUpperCase()] ?? null };
  });
  return out;
}
// abstract, link al testo libero e licenza: Europe PMC, poi Crossref, poi Semantic Scholar
async function enrich(dois: string[], cr: Record<string, Record<string, unknown> | null>) {
  const [ep, s2] = await Promise.all([epmcByDoi(dois), s2ByDoi(dois)]);
  const out: Record<string, { abstract: string | null; pdf_url: string | null; license: string | null; pmcid: string | null }> = {};
  for (const doi of dois) {
    const e = ep[doi], s = s2[doi], m = cr[doi];
    let abstract = e?.abstract || (m?.abstract ? fromJats(String(m.abstract)) : null) || s?.abstract || null;
    if (abstract && abstract.length < 80) abstract = null;
    if (abstract && abstract.length > 20000) abstract = abstract.slice(0, 20000);
    const pdf_url = s?.pdf || (e?.pmcid ? `https://europepmc.org/articles/${e.pmcid}?pdf=render` : null);
    out[doi] = { abstract, pdf_url, license: s?.license || e?.license || (m ? crLicense(m) : null), pmcid: e?.pmcid ?? null };
  }
  return out;
}

// deno-lint-ignore no-explicit-any
async function articoli(admin: any, { notify = true, enrichMax = 25 } = {}) {
  const now = new Date(), fromYear = now.getFullYear() - 1;
  const { data: people } = await admin.from('lab_authors').select('*').eq('active', true);
  const { data: have } = await admin.from('lab_docs').select('doi, title').eq('kind', 'paper');
  const { data: skip } = await admin.from('paper_skip').select('doi');
  const haveDoi = new Set((have ?? []).filter((d: { doi: string | null }) => d.doi).map((d: { doi: string }) => normDoi(d.doi)));
  const haveTitle = new Set((have ?? []).map((d: { title: string }) => titleKey(d.title)));
  const skipped = new Set((skip ?? []).map((x: { doi: string }) => normDoi(x.doi)));
  const errori: string[] = [];
  // DOI candidati per persona
  const cand = new Map<string, Set<string>>();
  const found: Record<string, number> = {};
  for (const p of people ?? []) {
    found[p.id] = 0;
    for (const o of p.orcids ?? []) {
      const [a, b] = await Promise.all([orcidDois(o), crossrefOrcid(o, fromYear)]);
      if (a === null) errori.push(`${p.full_name} (${o})`);
      if (a === null && b === null) continue;
      for (const w of [...(a ?? []), ...(b ?? [])]) {
        if (!w.doi || (w.year && w.year < fromYear) || haveDoi.has(w.doi) || skipped.has(w.doi)) continue;
        if (!cand.has(w.doi)) cand.set(w.doi, new Set());
        cand.get(w.doi)!.add(p.id);
      }
    }
  }
  // metadati da Crossref, solo articoli veri con la persona fra gli autori
  const dois = [...cand.keys()].slice(0, 40);
  const metas = await pool(dois, 4, crossrefWork);
  const cr: Record<string, Record<string, unknown> | null> = {};
  const fresh: { doi: string; title: string; authors: string; journal: string | null; year: number | null }[] = [];
  dois.forEach((doi, k) => {
    const m = metas[k]; cr[doi] = m;
    if (!m) return;
    const title = String((m.title as string[] | undefined)?.[0] ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const year = yearOf(m as Record<string, { 'date-parts'?: number[][] }>);
    const authors = authorsOf(m);
    if (!title || NOT_PAPER.test(title) || (year && year < fromYear) || haveTitle.has(titleKey(title))) return;
    const who = (people ?? []).filter((p: { id: string; full_name: string }) => cand.get(doi)!.has(p.id) && hasAuthor(authors, p.full_name));
    if (!who.length) return;
    who.forEach((p: { id: string }) => { found[p.id]++; });
    haveTitle.add(titleKey(title));
    fresh.push({ doi, title: title.slice(0, 300), authors: authors.slice(0, 2000), journal: String((m['container-title'] as string[] | undefined)?.[0] ?? '').slice(0, 300) || null, year: year ?? null });
  });
  const extra = await enrich(fresh.map((x) => x.doi), cr);
  const rows = fresh.map((x) => ({ kind: 'paper', ...x, url: extra[x.doi]?.pmcid ? `https://pmc.ncbi.nlm.nih.gov/articles/${extra[x.doi].pmcid}/` : null,
    abstract: extra[x.doi]?.abstract ?? null, pdf_url: extra[x.doi]?.pdf_url ?? null, license: extra[x.doi]?.license ?? null, auto_added: true, meta_checked_at: now.toISOString(), created_by: null, links: [] }));
  if (rows.length) { const { error } = await admin.from('lab_docs').insert(rows); if (error) throw error; }

  // completa abstract e link degli articoli che non li hanno, pochi per volta
  let completati = 0;
  const monthAgo = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data: missing } = await admin.from('lab_docs').select('id, doi, abstract, pdf_url, license, meta_checked_at').eq('kind', 'paper').not('doi', 'is', null)
    .or('abstract.is.null,pdf_url.is.null').limit(1000);
  const todo = (missing ?? []).filter((d: { meta_checked_at: string | null }) => !d.meta_checked_at || d.meta_checked_at < monthAgo).slice(0, enrichMax);
  if (todo.length) {
    const ds = todo.map((d: { doi: string }) => normDoi(d.doi));
    const need = ds.filter((_: string, k: number) => !todo[k].abstract);
    const crs: Record<string, Record<string, unknown> | null> = {};
    (await pool(need, 4, crossrefWork)).forEach((m, k) => { crs[need[k]] = m; });
    const more = await enrich(ds, crs);
    for (const [k, d] of todo.entries()) {
      const x: { abstract?: string | null; pdf_url?: string | null; license?: string | null } = more[ds[k]] ?? {};
      const f: Record<string, unknown> = { meta_checked_at: now.toISOString() };
      if (!d.abstract && x.abstract) f.abstract = x.abstract;
      if (!d.pdf_url && x.pdf_url) f.pdf_url = x.pdf_url;
      if (!d.license && x.license) f.license = x.license;
      if (Object.keys(f).length > 1) completati++;
      await admin.from('lab_docs').update(f).eq('id', d.id);
    }
  }
  for (const p of people ?? []) await admin.from('lab_authors').update({ last_checked_at: now.toISOString(), last_found: found[p.id] ?? 0 }).eq('id', p.id);

  let sent = 0;
  if (notify && rows.length) {
    const first = (a: string) => a.split(';')[0]?.trim().replace(/\s+[A-Z]{1,4}$/, '') ?? '';
    const payload = rows.length === 1
      ? { title: 'Nuovo articolo del laboratorio', body: `${rows[0].title} · ${first(rows[0].authors)}${rows[0].authors.includes(';') ? ' et al.' : ''}${rows[0].journal ? `, ${rows[0].journal}` : ''}${rows[0].year ? ` ${rows[0].year}` : ''}` }
      : { title: `${rows.length} articoli nuovi del laboratorio`, body: rows.slice(0, 3).map((r) => r.title).join(' · ') + (rows.length > 3 ? ' …' : '') };
    sent = (await deliver(admin, await memberSubs(admin), { ...payload, url: './#articoli', tag: `articoli-${now.toISOString().slice(0, 10)}` })).sent;
  }
  return { nuovi: rows.map((r) => r.title), completati, persone: (people ?? []).length, errori, sent };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // calendario: non servono le chiavi delle notifiche
    if (req.method === 'GET') {
      const tok = new URL(req.url).searchParams.get('ical');
      if (!tok) return new Response('LabApp', { headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8' } });
      const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), { auth: { persistSession: false, autoRefreshToken: false } });
      return await ical(db, tok);
    }
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'Mancano le chiavi VAPID nei Secrets' }, 500);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, serverKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Chiamata periodica dal database per i promemoria
    const cron = req.headers.get('x-cron-secret');
    if (cron !== null) {
      if (!CRON_SECRET || cron !== CRON_SECRET) return json({ error: 'Segreto non valido' }, 401);
      const body = await req.json().catch(() => ({}));
      if (body?.articoli) return json(await articoli(admin));
      if (body?.riepilogo) {
        // il lunedì prima gli articoli nuovi (con la loro notifica), poi il riepilogo
        const a = await articoli(admin).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
        return json({ ...(await weekly(admin)), articoli: a });
      }
      const [r, m, e] = await Promise.all([reminders(admin), stockAlarms(admin, !!body?.micoteca), practicalReminders(admin, !!body?.esercitazioni)]);
      return json({ ...r, stocks: m.stocks, stocksSent: m.sent ?? 0, practicals: e.practicals, practicalsSent: e.sent ?? 0 });
    }

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !auth?.user) return json({ error: 'Accesso non valido' }, 401);
    const uid = auth.user.id;

    const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle();
    if (!me || me.role === 'pending') return json({ error: 'Account non approvato' }, 403);

    const input = await req.json().catch(() => ({}));

    if (input?.articoli) {
      if (me.role !== 'admin') return json({ error: 'Il controllo degli articoli lo avvia un amministratore' }, 403);
      return json(await articoli(admin));
    }

    if (input?.test) {
      const { data: mine } = await admin.from('push_subscriptions').select('*').eq('user_id', uid);
      const r = await deliver(admin, mine ?? [], {
        title: 'Notifiche attive',
        body: 'Da ora ricevi qui gli avvisi del laboratorio.',
        url: './',
        tag: 'test',
      });
      return json({ ...r, devices: mine?.length ?? 0 });
    }

    // Prende in carico in modo atomico le segnalazioni non ancora notificate
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: alerts, error } = await admin.from('alerts')
      .update({ notified_at: new Date().toISOString() })
      .is('notified_at', null)
      .gte('created_at', since)
      .select('id, item_id, reason, note, created_by');
    if (error) throw error;

    const subs = await memberSubs(admin);
    let sent = await newIssues(admin, subs);
    sent += await newPracticals(admin, subs);
    sent += await newShares(admin, subs);
    if (!alerts?.length) return json({ sent, alerts: 0 });

    const itemIds = [...new Set(alerts.map((a) => a.item_id))];
    const [{ data: items }, people] = await Promise.all([
      admin.from('items').select('id, name, quantity, unit').in('id', itemIds),
      names(admin, alerts.map((a) => a.created_by)),
    ]);

    for (const a of alerts) {
      const item = items?.find((i) => i.id === a.item_id);
      if (!item) continue;
      const who = people[a.created_by];
      const parts: string[] = [];
      if (a.reason === 'sotto_scorta') {
        parts.push(item.quantity != null ? `Ne restano ${fmt(Number(item.quantity))} ${item.unit ?? ''}`.trim() : 'Sotto la scorta minima');
      }
      if (a.note) parts.push(a.note);
      if (who) parts.push(`segnalato da ${who}`);
      const targets = subs.filter((s: Sub) => s.user_id !== a.created_by);
      const r = await deliver(admin, targets, {
        title: `Da riordinare: ${item.name}`,
        body: parts.join(' · ') || 'Aggiunto alla lista da riordinare',
        url: './#riordino',
        tag: `item-${item.id}`,
      });
      sent += r.sent;
    }
    return json({ sent, alerts: alerts.length });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? String(e) }, 500);
  }
});
