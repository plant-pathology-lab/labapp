// Accesso ai dati. Due motori con la stessa interfaccia:
// SupabaseApi (dati condivisi) e DemoApi (modalità prova, dati solo sul telefono).
import { CONFIG } from './config.js';

export const DEMO = !CONFIG.SUPABASE_URL;
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

export async function createApi() {
  return DEMO ? new DemoApi() : SupabaseApi.create();
}

// ---------------------------------------------------------------------------
//  Messaggi d'errore in italiano
// ---------------------------------------------------------------------------
function dbErr(e) {
  const msg = e?.message || String(e);
  if (e?.code === '23P01') return new Error(/ripiano_libero/.test(msg) ? 'Quel ripiano è già occupato in quei giorni' : 'Lo strumento è già prenotato in quella fascia oraria');
  if (e?.code === '23505' && /box_slots_box_id_pos_key/.test(msg)) return new Error('Quella posizione è già occupata');
  if (e?.code === '23505' && /strains_code_key/.test(msg)) return new Error('Esiste già un ceppo con questo codice');
  if (e?.code === '23505' && /fund_managers_pkey/.test(msg)) return new Error('È già responsabile di questo fondo');
  if (e?.code === '23505') return new Error('Esiste già (codice doppio)');
  if (e?.code === '23514') return new Error(/durata_valida/.test(msg) ? 'Controlla gli orari (la fine deve venire dopo l\'inizio, massimo 7 giorni)' : /ripiano_date_valide/.test(msg) ? 'Controlla le date (la fine non può venire prima dell\'inizio)' : 'Controlla i valori inseriti');
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) return new Error('Non hai i permessi per questa operazione');
  if (/Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new Error('Connessione assente, riprova tra poco');
  if (e?.name === 'AuthRetryableFetchError') return new Error('Connessione assente, riprova tra poco');
  return new Error(msg);
}

function authErr(e) {
  const m = e?.message || '';
  if (/Invalid login credentials/i.test(m)) return new Error('Email o password non corretti');
  if (/already registered|already been registered|already exists/i.test(m)) return new Error('Esiste già un account con questa email');
  if (/Password should be|weak password|at least/i.test(m)) return new Error('La password deve avere almeno 6 caratteri');
  if (/Email not confirmed/i.test(m)) return new Error('Conferma prima l\'email che ti è stata inviata');
  if (/rate limit|too many/i.test(m)) return new Error('Troppi tentativi, riprova tra qualche minuto');
  if (/invalid.*email|validate email/i.test(m)) return new Error('Indirizzo email non valido');
  if (/Signups not allowed/i.test(m)) return new Error('Le registrazioni sono chiuse');
  return dbErr(e);
}

const unwrap = ({ data, error }) => { if (error) throw dbErr(error); return data; };
// giro 25: accanto a ogni foto una miniatura (stesso nome con .t.jpg) per gli elenchi; la foto intera si scarica solo ingrandendo
export const thumbOf = (p) => `${String(p).replace(/\.jpg$/i, '')}.t.jpg`;
async function makeThumb(blob, max = 480, quality = 0.72) {
  const src = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * k); c.height = Math.round(src.height * k);
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', quality));
}
export const NET_MSG = 'Connessione assente, riprova tra poco';
export const isNetErr = (e) => e?.message === NET_MSG || /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '');

// ---------------------------------------------------------------------------
//  Supabase
// ---------------------------------------------------------------------------
// campi della provenienza dei ceppi (giro 27)
const STRAIN_ORIGIN_KEYS = ['country', 'provenance', 'source_ref', 'received_on', 'abs_status', 'abs_ref', 'quarantine', 'qp_auth', 'project', 'lat', 'lon'];

class SupabaseApi {
  static async create() {
    const { createClient } = await import(SUPABASE_JS);
    const api = new SupabaseApi();
    api.sb = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'labapp-auth' },
    });
    return api;
  }

  get demo() { return false; }

  async session() {
    const { data } = await this.sb.auth.getSession();
    return data.session;
  }

  onAuth(cb) {
    this.sb.auth.onAuthStateChange((event, session) => setTimeout(() => cb(event, session), 0));
  }

  async signIn(email, password) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw authErr(error);
  }

  async signUp(name, email, password) {
    const { data, error } = await this.sb.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw authErr(error);
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Esiste già un account con questa email');
    }
    return { needsConfirm: !data.session };
  }

  async signOut() { await this.sb.auth.signOut(); }

  async resetPassword(email) {
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw authErr(error);
  }

  async updatePassword(password) {
    const { error } = await this.sb.auth.updateUser({ password });
    if (error) throw authErr(error);
  }

  async me(uid) {
    return unwrap(await this.sb.from('profiles').select('*').eq('id', uid).maybeSingle());
  }

  async allItems() {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const rows = unwrap(await this.sb.from('items').select('*').order('name').order('id').range(i, i + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  async importItems(rows) {
    unwrap(await this.sb.from('items').insert(rows, { defaultToNull: false }));
  }

  async loadAll(from, to) {
    const recent = new Date(Date.now() - 45 * 86400e3).toISOString();
    const today = new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10);
    const [items, profiles, instruments, bookings, tasks, issues, cylinders, flowcells, protocols, requests, waste, strains, freezers, boxes, columns, chamberSlots, coffee, stocks, fundRoles, itemSlots, practicals] = await Promise.all([
      this.allItems(),
      this.sb.from('profiles').select('*').order('full_name'),
      this.sb.from('instruments').select('*').order('name'),
      this.sb.from('bookings').select('*').lt('starts_at', to).gt('ends_at', from).order('starts_at'),
      this.sb.from('tasks').select('*').or(`done.eq.false,last_done_at.gte.${recent}`).order('due_on'),
      this.sb.from('issues').select('*, issue_comments(count)').or(`status.neq.risolto,resolved_at.gte.${recent}`).order('created_at', { ascending: false }),
      this.sb.from('cylinders').select('*').or(`status.neq.ritirata,collected_at.gte.${recent}`).order('location').order('gas').order('created_at'),
      this.sb.from('flowcells').select('*').order('code'),
      this.sb.from('protocols').select('*').order('title'),
      this.sb.from('order_requests').select('*').or(`status.in.(richiesta,ordinata),requested_at.gte.${recent}`).order('requested_at', { ascending: false }),
      this.sb.from('waste_containers').select('*').or(`status.neq.ritirata,collected_at.gte.${recent}`).order('location').order('created_at'),
      this.sb.from('strains').select('*').order('code'),
      this.sb.from('freezers').select('*').order('name'),
      this.sb.from('boxes').select('*, box_slots(count)').order('name'),
      this.sb.from('lc_columns').select('*').order('created_at', { ascending: false }),
      this.sb.from('chamber_slots').select('*').gte('ends_on', today).order('starts_on'),
      this.sb.from('coffee_orders').select('*').order('on_date', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
      this.sb.from('strain_stocks').select('*').order('made_on', { ascending: false }),
      this.sb.from('fund_managers').select('fund_id, user_id'),
      this.sb.from('box_slots').select('item_id, box_id, pos, label').not('item_id', 'is', null),
      this.sb.from('practicals').select('*').gt('ends_at', new Date(Date.now() - 86400e3).toISOString()).order('starts_at'),
    ]);
    return {
      items, profiles: unwrap(profiles), instruments: unwrap(instruments), bookings: unwrap(bookings), tasks: unwrap(tasks), cylinders: unwrap(cylinders),
      flowcells: unwrap(flowcells), protocols: unwrap(protocols), requests: unwrap(requests), waste: unwrap(waste), strains: unwrap(strains),
      freezers: unwrap(freezers), boxes: unwrap(boxes).map(({ box_slots: c, ...b }) => ({ ...b, filled: c?.[0]?.count ?? 0 })),
      columns: unwrap(columns), chamberSlots: unwrap(chamberSlots), coffee: unwrap(coffee), stocks: unwrap(stocks), fundRoles: unwrap(fundRoles), itemSlots: unwrap(itemSlots),
      practicals: unwrap(practicals),
      issues: unwrap(issues).map(({ issue_comments: c, ...i }) => ({ ...i, comments: c?.[0]?.count ?? 0 })),
    };
  }

  // ---- bombole
  async addCylinders(rows) {
    return unwrap(await this.sb.from('cylinders').insert(rows, { defaultToNull: false }).select());
  }

  async saveCylinder(c) {
    const { id, gas, brand, location, code, size, notes } = c;
    return unwrap(await this.sb.from('cylinders').update({ gas, brand, location, code, size, notes }).eq('id', id).select().single());
  }

  async setCylinderStatus(id, status) {
    return unwrap(await this.sb.from('cylinders').update({ status }).eq('id', id).select().single());
  }

  async collectCylinders(location) {
    return unwrap(await this.sb.from('cylinders').update({ status: 'ritirata' }).eq('location', location).eq('status', 'vuota').select());
  }

  async deleteCylinder(id) { unwrap(await this.sb.from('cylinders').delete().eq('id', id)); }

  // ---- caffè
  async saveCoffee(o) {
    const { id, user_id, points, on_date, note } = o;
    const f = { user_id: user_id || null, points, on_date, note };
    if (o.coffee) f.coffee = o.coffee; // solo se c'è, così va anche con un database non aggiornato
    if (o.person_name || id) f.person_name = o.person_name || null;
    if (id) return unwrap(await this.sb.from('coffee_orders').update(f).eq('id', id).select().single());
    return unwrap(await this.sb.from('coffee_orders').insert(f).select().single());
  }
  async deleteCoffee(id) {
    const rows = unwrap(await this.sb.from('coffee_orders').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può cancellare chi l\'ha segnato, la persona a cui è intestato o un amministratore');
  }
  async coffeeReviews() {
    return unwrap(await this.sb.from('coffee_reviews').select('*').order('updated_at', { ascending: false }));
  }
  // chi non è più in laboratorio (giro 41)
  async coffeeHidden() { return unwrap(await this.sb.from('coffee_hidden').select('*')); }
  async hideCoffee(o) { return unwrap(await this.sb.from('coffee_hidden').insert({ user_id: o.user_id || null, person_name: o.user_id ? null : o.person_name }).select().single()); }
  async unhideCoffee(id) { unwrap(await this.sb.from('coffee_hidden').delete().eq('id', id)); }
  async linkCoffee(name, uid) { return unwrap(await this.sb.rpc('coffee_link', { p_name: name, p_user: uid })); }

  // ---- tesisti (giro 41)
  async students() { return unwrap(await this.sb.from('students').select('*').order('full_name')); }
  async saveStudent(o) {
    const f = Object.fromEntries(STUDENT_FIELDS.map((k) => [k, o[k] ?? (k === 'tutor_ids' ? [] : null)]));
    if (o.id) {
      const rows = unwrap(await this.sb.from('students').update(f).eq('id', o.id).select());
      if (!rows.length) throw new Error('Lo possono modificare i referenti, chi l\'ha aggiunto o un amministratore');
      return rows[0];
    }
    return unwrap(await this.sb.from('students').insert(f).select().single());
  }
  async deleteStudent(id) {
    const rows = unwrap(await this.sb.from('students').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può togliere chi l\'ha aggiunto o un amministratore');
  }
  async saveCoffeeReview(r) {
    const f = { coffee: r.coffee, rating: r.rating, comment: r.comment ?? null };
    if (r.id) {
      const rows = unwrap(await this.sb.from('coffee_reviews').update(f).eq('id', r.id).select());
      if (!rows.length) throw new Error('Puoi cambiare solo il tuo voto');
      return rows[0];
    }
    const { data, error } = await this.sb.from('coffee_reviews').insert(f).select().single();
    if (error?.code === '23505') throw new Error('Hai già votato questo caffè, aggiorna la pagina e cambia il voto');
    return unwrap({ data, error });
  }
  async deleteCoffeeReview(id) {
    const rows = unwrap(await this.sb.from('coffee_reviews').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Puoi togliere solo il tuo voto');
  }

  // ---- richieste d'ordine
  async saveRequest(r) {
    const { id, product, catalog_no, brand, supplier, quantity, price, item_id, notes } = r;
    const fields = { product, catalog_no, brand, supplier, quantity, price, item_id: item_id ?? null, notes };
    if (id) return unwrap(await this.sb.from('order_requests').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('order_requests').insert(fields).select().single());
  }
  async setRequestStatus(id, status) { return unwrap(await this.sb.from('order_requests').update({ status }).eq('id', id).select().single()); }
  async deleteRequest(id) {
    const rows = unwrap(await this.sb.from('order_requests').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può cancellare solo chi l\'ha fatta o un amministratore');
  }

  // ---- taniche dei rifiuti
  async addWaste(rows) { return unwrap(await this.sb.from('waste_containers').insert(rows, { defaultToNull: false }).select()); }
  async saveWaste(w) {
    const { id, kind, location, code, size, notes } = w;
    return unwrap(await this.sb.from('waste_containers').update({ kind, location, code, size, notes }).eq('id', id).select().single());
  }
  async setWasteStatus(id, status) { return unwrap(await this.sb.from('waste_containers').update({ status }).eq('id', id).select().single()); }
  async collectWaste(location) { return unwrap(await this.sb.from('waste_containers').update({ status: 'ritirata' }).eq('location', location).eq('status', 'piena').select()); }
  async deleteWaste(id) { unwrap(await this.sb.from('waste_containers').delete().eq('id', id)); }

  // ---- ceppi
  async saveStrain(st) {
    const { id, code, species, host, origin, isolated_on, isolated_by, substrate, medium, storage, sequence_ref, notes, status, subculture_days, last_subculture, photos, keeper_id, keeper_name, sporulates, snooze_until } = st;
    const fields = { code: code || null, species, host, origin, isolated_on, isolated_by, substrate, medium, storage, sequence_ref, notes, status, subculture_days, last_subculture, ...(photos ? { photos } : {}),
      keeper_id: keeper_id || null, keeper_name: keeper_name || null, sporulates: sporulates ?? null, snooze_until: snooze_until || null };
    // da completare (giro 19): si manda solo se c'è, così va anche con un database non ancora aggiornato
    if (st.todo_by !== undefined) fields.todo_by = st.todo_by || null;
    // provenienza, Nagoya e quarantena (giro 27): stesso discorso
    for (const k of STRAIN_ORIGIN_KEYS) if (st[k] !== undefined) fields[k] = st[k] === '' ? null : st[k];
    if (id) return unwrap(await this.sb.from('strains').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('strains').insert(fields).select().single());
  }
  async importStrains(rows) { return unwrap(await this.sb.from('strains').insert(rows, { defaultToNull: false }).select()); }
  async deleteStrain(id) {
    const rows = unwrap(await this.sb.from('strains').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può eliminare solo chi l\'ha inserito o un amministratore');
  }
  // ---- fondi: il database li mostra solo ai responsabili di ciascun fondo
  async fundsData() {
    const [funds, managers, expenses] = await Promise.all([
      this.sb.from('funds').select('*').order('name'),
      this.sb.from('fund_managers').select('*'),
      this.sb.from('fund_expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
    ]);
    return { funds: unwrap(funds), managers: unwrap(managers), expenses: unwrap(expenses) };
  }
  async createFund(f) {
    return unwrap(await this.sb.rpc('create_fund', { p_name: f.name, p_code: f.code || null, p_budget: f.budget ?? 0, p_ends_on: f.ends_on || null, p_notes: f.notes || null }));
  }
  async saveFund(f) {
    const { id, name, code, budget, ends_on, notes, active } = f;
    return unwrap(await this.sb.from('funds').update({ name, code: code || null, budget: budget ?? 0, ends_on: ends_on || null, notes: notes || null, active: active ?? true }).eq('id', id).select().single());
  }
  async deleteFund(id) {
    const rows = unwrap(await this.sb.from('funds').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può eliminare solo un responsabile del fondo');
  }
  async addFundManager(fundId, userId) { return unwrap(await this.sb.from('fund_managers').insert({ fund_id: fundId, user_id: userId }).select().single()); }
  async removeFundManager(fundId, userId) { unwrap(await this.sb.from('fund_managers').delete().eq('fund_id', fundId).eq('user_id', userId)); }
  async saveExpense(x) {
    const { id, fund_id, amount, spent_on, description, supplier, request_id, items } = x;
    const fields = { fund_id, amount, spent_on, description, supplier: supplier || null, request_id: request_id || null, items: items || [] };
    if (id) return unwrap(await this.sb.from('fund_expenses').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('fund_expenses').insert(fields).select().single());
  }
  async deleteExpense(id) { unwrap(await this.sb.from('fund_expenses').delete().eq('id', id)); }
  // conferma che chi ha il telefono in mano è il titolare dell'account
  async reauth(password) {
    const { data } = await this.sb.auth.getUser();
    const email = data?.user?.email;
    if (!email) throw new Error('Rientra nell\'app e riprova');
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw new Error(/invalid/i.test(error.message) ? 'Password sbagliata' : authErr(error).message);
  }

  // ---- micoteca: conservazioni da rinnovare
  async saveStock(x) {
    const { id, strain_id, kind, made_on, renew_months, qty, place, keeper_id, note, status, snooze_until } = x;
    const fields = { kind, made_on: made_on || null, renew_months: renew_months ?? null, qty: qty ?? null, place: place || null, keeper_id: keeper_id || null, note: note || null, status: status || 'attiva', snooze_until: snooze_until || null };
    if (id) return unwrap(await this.sb.from('strain_stocks').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('strain_stocks').insert({ strain_id, ...fields }).select().single());
  }
  async renewStock(id, qty = null, label = null) {
    const row = unwrap(await this.sb.from('strain_stocks').update({ made_on: localDay(), status: 'attiva', snooze_until: null, ...(qty != null ? { qty } : {}) }).eq('id', id).select().single());
    await this.sb.from('strain_events').insert({ strain_id: row.strain_id, kind: 'conservato', note: label, on_date: localDay() });
    return row;
  }
  async deleteStock(id) {
    const rows = unwrap(await this.sb.from('strain_stocks').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può cancellare chi l\'ha aggiunta, il referente o un amministratore');
  }
  async strainEvents(id) { return unwrap(await this.sb.from('strain_events').select('*').eq('strain_id', id).order('on_date', { ascending: false }).order('id', { ascending: false }).limit(50)); }
  async strainEventsFor(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) out.push(...unwrap(await this.sb.from('strain_events').select('*').in('strain_id', ids.slice(i, i + 100)).order('on_date')));
    return out;
  }
  // ---- foto in coltura dei ceppi
  async strainPhotos(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) out.push(...unwrap(await this.sb.from('strain_photos').select('*').in('strain_id', ids.slice(i, i + 100)).order('taken_on').order('created_at')));
    return out;
  }
  async addStrainPhoto(x) {
    const { strain_id, path, kind, side, medium, temp_c, age_days, passage, light, taken_on, note } = x;
    return unwrap(await this.sb.from('strain_photos').insert({ strain_id, path, kind: kind || 'piastra', side: side || null, medium: medium || null, temp_c: temp_c ?? null, age_days: age_days ?? null,
      passage: passage ?? null, light: light || null, ...(taken_on ? { taken_on } : {}), note: note || null }).select().single());
  }
  async deleteStrainPhoto(id) {
    const rows = unwrap(await this.sb.from('strain_photos').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può eliminare solo chi l\'ha messa o un amministratore');
    return rows[0];
  }
  async addStrainEvent(strainId, kind, note = null, onDate = null) {
    unwrap(await this.sb.from('strain_events').insert({ strain_id: strainId, kind, note, on_date: onDate || localDay() }));
    return unwrap(await this.sb.from('strains').select('*').eq('id', strainId).single());
  }
  async deleteStrainEvent(id, strainId) {
    const rows = unwrap(await this.sb.from('strain_events').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Puoi cancellare solo quello che hai scritto tu');
    return unwrap(await this.sb.from('strains').select('*').eq('id', strainId).single());
  }

  // ---- congelatori
  async saveFreezer(f) {
    const { id, name, temp, location, notes } = f;
    if (id) return unwrap(await this.sb.from('freezers').update({ name, temp, location, notes }).eq('id', id).select().single());
    return unwrap(await this.sb.from('freezers').insert({ name, temp, location, notes }).select().single());
  }
  async deleteFreezer(id) {
    const rows = unwrap(await this.sb.from('freezers').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Solo un amministratore può eliminare un congelatore');
  }
  async saveBox(b) {
    const { id, freezer_id, name, rows, cols, place, notes } = b;
    const fields = { freezer_id, name, rows, cols, place, notes };
    const row = id ? unwrap(await this.sb.from('boxes').update(fields).eq('id', id).select('*, box_slots(count)').single())
      : unwrap(await this.sb.from('boxes').insert(fields).select('*, box_slots(count)').single());
    const { box_slots: c, ...rest } = row;
    return { ...rest, filled: c?.[0]?.count ?? 0 };
  }
  async deleteBox(id) { unwrap(await this.sb.from('boxes').delete().eq('id', id)); }
  async boxSlots(boxId) { return unwrap(await this.sb.from('box_slots').select('*').eq('box_id', boxId)); }
  async saveSlot(sl) {
    const { id, box_id, pos, label, strain_id, item_id, note, photos } = sl;
    const extra = { ...(photos ? { photos } : {}), ...(item_id !== undefined ? { item_id: item_id || null } : {}) };
    if (id) return unwrap(await this.sb.from('box_slots').update({ pos, label, strain_id: strain_id ?? null, note, ...extra }).eq('id', id).select().single());
    return unwrap(await this.sb.from('box_slots').insert({ box_id, pos, label, strain_id: strain_id ?? null, note, ...extra }).select().single());
  }
  async consumi(days = 365) { return unwrap(await this.sb.rpc('consumi', { p_days: days })); }
  async fillSlots(rows) { return unwrap(await this.sb.from('box_slots').insert(rows, { defaultToNull: false }).select()); }
  async deleteSlot(id) { unwrap(await this.sb.from('box_slots').delete().eq('id', id)); }
  async searchSlots(q) {
    const t = q.replace(/[%_,()]/g, ' ').trim();
    return unwrap(await this.sb.from('box_slots').select('*, boxes(name, freezer_id)').or(`label.ilike.%${t}%,note.ilike.%${t}%`).order('label').limit(60));
  }
  async slotsForStrain(strainId) { return unwrap(await this.sb.from('box_slots').select('*, boxes(name, freezer_id)').eq('strain_id', strainId)); }

  // ---- strumenti: registro, colonne, camere di crescita
  async setInstrumentSettings(id, text) { return unwrap(await this.sb.rpc('set_instrument_settings', { p_id: id, p_settings: text })); }
  async instrumentLog(id) { return unwrap(await this.sb.from('instrument_log').select('*').eq('instrument_id', id).order('at', { ascending: false }).limit(60)); }
  async addInstrumentLog(id, kind, body) { return unwrap(await this.sb.from('instrument_log').insert({ instrument_id: id, kind, body }).select().single()); }
  async deleteInstrumentLog(id) {
    const rows = unwrap(await this.sb.from('instrument_log').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Puoi cancellare solo quello che hai scritto tu');
  }
  async saveColumn(c) {
    const { id, name, phase, dimensions, serial, instrument_id, status, installed_on, injections, notes } = c;
    const fields = { name, phase, dimensions, serial, instrument_id: instrument_id ?? null, status, installed_on, injections, notes };
    if (id) return unwrap(await this.sb.from('lc_columns').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('lc_columns').insert(fields, { defaultToNull: false }).select().single());
  }
  async deleteColumn(id) { unwrap(await this.sb.from('lc_columns').delete().eq('id', id)); }
  async saveChamberSlot(c) {
    const { id, instrument_id, shelf, label, starts_on, ends_on, note } = c;
    const fields = { instrument_id, shelf, label, starts_on, ends_on, note };
    if (id) return unwrap(await this.sb.from('chamber_slots').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('chamber_slots').insert(fields).select().single());
  }
  async deleteChamberSlot(id) {
    const rows = unwrap(await this.sb.from('chamber_slots').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può liberare solo chi l\'ha occupato o un amministratore');
  }

  // ---- protocolli
  async saveProtocol(p) {
    const { id, title, category, summary, base_amount, base_unit, ingredients, steps, notes, link, pcr = null } = p;
    const fields = { title, category, summary, base_amount, base_unit, ingredients, steps, notes, link, pcr };
    // gli standard interni si mandano solo se ci sono (così va anche con un database non ancora aggiornato)
    if (p.istd !== undefined && (p.istd !== null || id)) fields.istd = p.istd;
    if (p.todo_by !== undefined) fields.todo_by = p.todo_by || null;
    // la scheda uguale per tutti (giro 22): le sezioni nuove partono se ci sono, o se la scheda le aveva già dal database
    const full = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== '');
    for (const k of ['equipment', 'prep', 'phases', 'safety', 'source']) if (p[k] !== undefined && (full(p[k]) || p._std)) fields[k] = p[k];
    if (id) return unwrap(await this.sb.from('protocols').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('protocols').insert(fields).select().single());
  }

  async deleteProtocol(id) {
    const rows = unwrap(await this.sb.from('protocols').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Può eliminarlo solo chi l\'ha scritto o un amministratore');
  }

  // ---- esecuzioni dei protocolli
  async protocolRuns(protocolIds = null, limit = 300) {
    let q = this.sb.from('protocol_runs').select('*').order('run_on', { ascending: false }).order('created_at', { ascending: false }).limit(limit);
    if (protocolIds) q = q.in('protocol_id', protocolIds.length ? protocolIds : ['00000000-0000-0000-0000-000000000000']);
    return unwrap(await q);
  }

  async userRuns(userId, limit = 300) {
    return unwrap(await this.sb.from('protocol_runs').select('*').eq('created_by', userId).order('run_on', { ascending: false }).order('created_at', { ascending: false }).limit(limit));
  }

  async saveRun(r) {
    const { id, protocol_id, protocol_title, label, run_on, amount, unit, reagents, steps_done, steps_total, params, notes, problems, status } = r;
    const fields = { label, run_on, amount, unit, reagents, steps_done, steps_total, params, notes, status };
    if (problems !== undefined && (problems !== null || id)) fields.problems = problems;
    if (r.project_id !== undefined && (r.project_id !== null || id)) fields.project_id = r.project_id;
    if (id) {
      const rows = unwrap(await this.sb.from('protocol_runs').update(fields).eq('id', id).select());
      if (!rows.length) throw new Error('La può modificare solo chi l\'ha fatta o un amministratore');
      return rows[0];
    }
    return unwrap(await this.sb.from('protocol_runs').insert({ ...fields, protocol_id, protocol_title }).select().single());
  }

  async deleteRun(id) {
    const rows = unwrap(await this.sb.from('protocol_runs').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può eliminare solo chi l\'ha fatta o un amministratore');
  }

  // ---- diario di laboratorio: personale, lo legge anche l'amministratore
  async journal(userId, limit = 500) {
    return unwrap(await this.sb.from('lab_journal').select('*').eq('user_id', userId).order('day', { ascending: false }).order('created_at', { ascending: false }).limit(limit));
  }

  async saveJournal(e) {
    const fields = { day: e.day, title: e.title ?? null, samples: e.samples ?? null, notes: e.notes ?? null, problems: e.problems ?? null };
    // quaderno (ottobre 2026): progetto, obiettivo, risultati, prossimi passi, parole chiave, foto e collegamenti
    for (const k of ['project_id', 'aim', 'results', 'next_steps', 'tags', 'photos', 'photo_caps', 'links', 'materials', 'proto_changes']) if (e[k] !== undefined) fields[k] = e[k];
    if (e.id) {
      const rows = unwrap(await this.sb.from('lab_journal').update(fields).eq('id', e.id).select());
      if (!rows.length) throw new Error('Il diario lo modifica solo chi lo scrive');
      return rows[0];
    }
    return unwrap(await this.sb.from('lab_journal').insert(fields).select().single());
  }

  // quello che una persona ha fatto nell'app da un giorno in poi: ripicche e note dei ceppi, foto in coltura,
  // materiali tolti dall'inventario, problemi segnalati. Entra nel diario giorno per giorno.
  async diaryActivity(uid, fromDay) {
    const fromIso = new Date(`${fromDay}T00:00:00`).toISOString();
    const safe = (q) => q.then((r) => (r.error ? [] : r.data || []), () => []);
    const [events, photos, used, issues, proc] = await Promise.all([
      safe(this.sb.from('strain_events').select('id, strain_id, kind, note, on_date, created_at').eq('user_id', uid).gte('on_date', fromDay).order('on_date', { ascending: false }).limit(1500)),
      safe(this.sb.from('strain_photos').select('id, strain_id, kind, taken_on, created_at').eq('created_by', uid).gte('taken_on', fromDay).order('taken_on', { ascending: false }).limit(800)),
      safe(this.sb.from('item_log').select('id, item_id, delta, note, at').eq('user_id', uid).eq('action', 'quantita').lt('delta', 0).gte('at', fromIso).order('at', { ascending: false }).limit(2000)),
      safe(this.sb.from('issues').select('id, title, instrument_id, created_at').eq('created_by', uid).eq('kind', 'problema').gte('created_at', fromIso).order('created_at', { ascending: false }).limit(400)),
      safe(this.sb.from('item_log').select('id, item_id, note, at').eq('user_id', uid).eq('action', 'lavorazione').gte('at', fromIso).order('at', { ascending: false }).limit(800)),
    ]);
    return { events, photos, used, issues, proc };
  }

  async deleteJournal(id) {
    const rows = unwrap(await this.sb.from('lab_journal').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Una pagina la cancella solo chi la scrive, e solo prima di firmarla');
  }
  async signJournal(id) {
    const rows = unwrap(await this.sb.from('lab_journal').update({ signed_at: new Date().toISOString() }).eq('id', id).select());
    if (!rows.length) throw new Error('La firma solo chi l\'ha scritta');
    return rows[0];
  }
  async addJournalAddendum(id, text) {
    const cur = unwrap(await this.sb.from('lab_journal').select('addenda').eq('id', id).single());
    const rows = unwrap(await this.sb.from('lab_journal').update({ addenda: [...(cur.addenda || []), { at: new Date().toISOString(), text }] }).eq('id', id).select());
    if (!rows.length) throw new Error('L\'aggiunta la scrive solo chi ha scritto la pagina');
    return rows[0];
  }
  async journalVersions(id) {
    return unwrap(await this.sb.from('lab_journal_versions').select('*').eq('entry_id', id).order('saved_at', { ascending: false }));
  }
  // ---- progetti del laboratorio
  async projects() {
    return unwrap(await this.sb.from('lab_projects').select('*').order('name'));
  }
  async saveProject(p) {
    const f = { name: p.name, description: p.description ?? null, active: p.active ?? true };
    if (Array.isArray(p.members)) f.members = p.members;   // le persone le sceglie il responsabile (il database controlla)
    if (p.id) {
      const rows = unwrap(await this.sb.from('lab_projects').update(f).eq('id', p.id).select());
      if (!rows.length) throw new Error('Lo cambia chi l\'ha creato o un amministratore');
      return rows[0];
    }
    const { data, error } = await this.sb.from('lab_projects').insert(f).select().single();
    if (error?.code === '23505') throw new Error('C\'è già un progetto con questo nome');
    return unwrap({ data, error });
  }
  async deleteProject(id) {
    const rows = unwrap(await this.sb.from('lab_projects').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo elimina chi l\'ha creato o un amministratore');
  }
  // ---- diario mandato ai colleghi (un progetto, un periodo o alcune pagine)
  async shares() {
    return unwrap(await this.sb.from('journal_shares').select('*').order('created_at', { ascending: false }));
  }
  async saveShare(x) {
    const f = { project_id: x.project_id ?? null, from_day: x.from_day || null, to_day: x.to_day || null, entry_ids: x.entry_ids?.length ? x.entry_ids : null, include_runs: x.include_runs !== false, note: x.note || null };
    if (x.id) {
      const rows = unwrap(await this.sb.from('journal_shares').update(f).eq('id', x.id).select());
      if (!rows.length) throw new Error('La cambia solo chi l\'ha mandata');
      return rows[0];
    }
    const row = unwrap(await this.sb.from('journal_shares').insert({ viewer_id: x.viewer_id, ...f }).select().single());
    this.notify().catch(() => {});
    return row;
  }
  async deleteShare(id) {
    const rows = unwrap(await this.sb.from('journal_shares').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La toglie chi l\'ha mandata o chi l\'ha ricevuta');
  }

  // ---- copie di sicurezza (solo amministratori)
  async backups() {
    return unwrap(await this.sb.from('backups').select('id, made_at, kind, made_by, counts, bytes').order('made_at', { ascending: false }));
  }
  async backupData(id) { return unwrap(await this.sb.from('backups').select('data').eq('id', id).single()).data; }
  async makeBackup() { return unwrap(await this.sb.rpc('make_backup', { p_kind: 'manuale' })); }
  async deleteBackup(id) { unwrap(await this.sb.from('backups').delete().eq('id', id)); }
  async backupMissing(id) { return unwrap(await this.sb.rpc('backup_missing', { p_backup: id })); }
  async restoreRows(id, table, ids) { return unwrap(await this.sb.rpc('restore_rows', { p_backup: id, p_table: table, p_ids: ids })); }
  // tutte le foto del laboratorio, per la copia completa
  async listPhotos() {
    const out = [];
    const walk = async (prefix, depth = 0) => {
      for (let off = 0; ; off += 1000) {
        const { data, error } = await this.sb.storage.from('foto').list(prefix, { limit: 1000, offset: off });
        if (error) throw dbErr(error);
        for (const f of data || []) {
          const path = prefix ? `${prefix}/${f.name}` : f.name;
          if (f.id) { if (!/\.t\.jpg$/i.test(f.name)) out.push(path); } else if (depth < 3) await walk(path, depth + 1);
        }
        if (!data || data.length < 1000) break;
      }
    };
    await walk('');
    return out;
  }
  async photoBlob(path) {
    const { data, error } = await this.sb.storage.from('foto').download(path);
    if (error) throw dbErr(error);
    return data;
  }

  // ---- trascrizione dal quaderno con l'AI del laboratorio (funzione "trascrivi")
  async invokeFn(name, body) {
    const { data, error } = await this.sb.functions.invoke(name, { body });
    if (error) {
      let detail = '', status = error.context?.status;
      try { detail = (await error.context?.json?.())?.error || ''; } catch { /* nessun dettaglio */ }
      if (!detail && (status === 404 || /Failed to send|fetch/i.test(error.message || ''))) detail = 'La funzione "trascrivi" non è ancora pubblicata su Supabase';
      const e = new Error(detail || 'Il servizio non risponde'); e.status = status; throw e;
    }
    return data;
  }
  async aiInfo() { return this.invokeFn('trascrivi', { ping: true }); }
  async transcribe(images, provider, projects = []) { return this.invokeFn('trascrivi', { images, provider, projects }); }
  // riconoscere un isolato dalle foto (giro 41), stessa funzione e stesso limite giornaliero
  async recognize(images, provider, note = '', known = '') { return this.invokeFn('trascrivi', { task: 'riconosci', images, provider, note, known }); }

  // ---- sequenziamento: flow cell
  async addFlowcells(rows, checkAt = null) {
    const codes = rows.map((r) => r.code);
    const dup = unwrap(await this.sb.from('flowcells').select('code').in('code', codes)).map((r) => r.code);
    if (dup.length) throw new Error(dup.length === 1 ? `${dup[0]} è già registrata` : `Sono già registrate ${dup.join(', ')}`);
    const made = unwrap(await this.sb.from('flowcells').insert(rows.map(({ pores, ...r }) => r), { defaultToNull: false }).select());
    const idOf = new Map(made.map((f) => [f.code, f.id]));
    const checks = rows.filter((r) => r.pores != null).map((r) => ({ flowcell_id: idOf.get(r.code), pores: r.pores, ...(checkAt ? { checked_at: checkAt } : {}) }));
    if (!checks.length) return made;
    unwrap(await this.sb.from('flowcell_checks').insert(checks, { defaultToNull: false }));
    return unwrap(await this.sb.from('flowcells').select('*').in('id', made.map((f) => f.id)));
  }

  async saveFlowcell(f) {
    const { id, code, kind, batch, received_on, expiry, notes, run_note } = f;
    return unwrap(await this.sb.from('flowcells').update({ code, kind, batch, received_on, expiry, notes, run_note }).eq('id', id).select().single());
  }

  async setFlowcellStatus(id, status, extra = {}) {
    return unwrap(await this.sb.from('flowcells').update({ status, ...extra }).eq('id', id).select().single());
  }

  async addFlowcellCheck(id, pores, note = null, at = null) {
    unwrap(await this.sb.from('flowcell_checks').insert({ flowcell_id: id, pores, note, ...(at ? { checked_at: at } : {}) }));
    return unwrap(await this.sb.from('flowcells').select('*').eq('id', id).single());
  }

  async flowcellChecks(id) {
    return unwrap(await this.sb.from('flowcell_checks').select('*').eq('flowcell_id', id).order('checked_at', { ascending: false }).limit(50));
  }

  async deleteFlowcellCheck(checkId, flowcellId) {
    const rows = unwrap(await this.sb.from('flowcell_checks').delete().eq('id', checkId).select());
    if (!rows.length) throw new Error('Puoi cancellare solo i tuoi check');
    return unwrap(await this.sb.from('flowcells').select('*').eq('id', flowcellId).single());
  }

  async deleteFlowcell(id) { unwrap(await this.sb.from('flowcells').delete().eq('id', id)); }

  // ---- sequenziamento: kit a dosi e numeri delle etichette
  async useItem(id, n, note = null) {
    return unwrap(await this.sb.rpc('use_item', { p_item: id, p_n: n, p_note: note }));
  }

  // barcode usati per un run (n aliquote a testa; negativo per annullare)
  async useBarcodes(id, codes, n = 1, note = null) {
    return unwrap(await this.sb.rpc('use_barcodes', { p_item: id, p_codes: codes, p_n: n, p_note: note }));
  }

  async itemCodes(itemId) {
    const out = [];
    for (let i = 0; ; i += 1000) {
      const rows = unwrap(await this.sb.from('item_codes').select('*').eq('item_id', itemId).order('added_at').order('code').range(i, i + 999));
      out.push(...rows);
      if (rows.length < 1000) return out;
    }
  }

  async addCodes(itemId, codes) { return unwrap(await this.sb.rpc('add_codes', { p_item: itemId, p_codes: codes })); }
  async removeCodes(itemId, codes) { return unwrap(await this.sb.rpc('remove_codes', { p_item: itemId, p_codes: codes })); }
  async takeCode(itemId, code = null, note = null) { return unwrap(await this.sb.rpc('take_code', { p_item: itemId, p_code: code, p_note: note })); }
  async releaseCode(codeId) { return unwrap(await this.sb.rpc('release_code', { p_id: codeId })); }

  async itemLog(id) {
    return unwrap(await this.sb.from('item_log').select('*').eq('item_id', id).order('at', { ascending: false }).limit(15));
  }

  // ---- compiti
  async saveTask(t) {
    const { id, ...f } = t;
    const fields = { title: f.title, notes: f.notes, location: f.location, repeat_days: f.repeat_days, due_on: f.due_on, assigned_to: f.assigned_to, instrument_id: f.instrument_id ?? null };
    if (id) return unwrap(await this.sb.from('tasks').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('tasks').insert(fields).select().single());
  }

  async deleteTask(id) { unwrap(await this.sb.from('tasks').delete().eq('id', id)); }
  async completeTask(id, note = null) { return unwrap(await this.sb.rpc('complete_task', { p_task: id, p_note: note })); }
  async undoTask(id) { return unwrap(await this.sb.rpc('undo_complete_task', { p_task: id })); }

  async taskLog(id) {
    return unwrap(await this.sb.from('task_log').select('*').eq('task_id', id).order('done_at', { ascending: false }).limit(10));
  }

  // ---- problemi
  async saveIssue(i) {
    const fields = { title: i.title, description: i.description, location: i.location, urgency: i.urgency, photos: i.photos || [],
      kind: i.kind || 'problema', incident_type: i.incident_type || null, happened_at: i.happened_at || null, involved: i.involved || null,
      item_id: i.item_id || null, instrument_id: i.instrument_id || null, actions: i.actions || null };
    if (i.id) return unwrap(await this.sb.from('issues').update(fields).eq('id', i.id).select().single());
    return { ...unwrap(await this.sb.from('issues').insert(fields).select().single()), comments: 0 };
  }

  // il registro completo degli incidenti, anche quelli chiusi da tempo
  async incidents() {
    return unwrap(await this.sb.from('issues').select('*').eq('kind', 'incidente').order('happened_at', { ascending: false }));
  }

  async setIssueStatus(id, status) {
    return unwrap(await this.sb.from('issues').update({ status }).eq('id', id).select().single());
  }

  async deleteIssue(issue) {
    const rows = unwrap(await this.sb.from('issues').delete().eq('id', issue.id).select());
    if (!rows.length) throw new Error('Puoi eliminare solo i problemi che hai segnalato tu');
    if (issue.photos?.length) await this.sb.storage.from('foto').remove([...issue.photos, ...issue.photos.map(thumbOf)]);
  }

  async issueComments(id) {
    return unwrap(await this.sb.from('issue_comments').select('*').eq('issue_id', id).order('created_at'));
  }

  async addComment(issueId, body) {
    return unwrap(await this.sb.from('issue_comments').insert({ issue_id: issueId, body }).select().single());
  }

  async deleteComment(id) { unwrap(await this.sb.from('issue_comments').delete().eq('id', id)); }

  async uploadPhoto(blob, folder = 'problemi') {
    const path = `${folder}/${crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2)}.jpg`;
    const { error } = await this.sb.storage.from('foto').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw dbErr(error);
    // la miniatura: se non riesce, negli elenchi si usa la foto intera
    try { const t = await makeThumb(blob); if (t) await this.sb.storage.from('foto').upload(thumbOf(path), t, { contentType: 'image/jpeg', upsert: false }); } catch { /* niente miniatura */ }
    return path;
  }

  async removePhotos(paths) {
    // giro 46: le foto degli isolati (isolati/...) stanno nell'app, non nello storage
    paths = (paths || []).filter((p) => !/^isolati\//.test(p));
    if (paths.length) await this.sb.storage.from('foto').remove([...paths, ...paths.map(thumbOf)]).catch(() => {});
  }

  // ---- sequenze dei ceppi (giro 21)
  async seqs() { return unwrap(await this.sb.from('strain_seqs').select('*').order('locus').order('created_at')); }
  async saveSeq(x) {
    const f = { locus: x.locus, header: x.header ?? null, seq: x.seq, accession: x.accession ?? null, note: x.note ?? null };
    if (x.id) return unwrap(await this.sb.from('strain_seqs').update(f).eq('id', x.id).select().single());
    return unwrap(await this.sb.from('strain_seqs').insert({ ...f, strain_id: x.strain_id }).select().single());
  }
  async deleteSeq(id) {
    const rows = unwrap(await this.sb.from('strain_seqs').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La toglie chi l\'ha messa o un amministratore');
  }

  // ---- documenti del laboratorio (giro 21): paper, risultati, report, con il file nel bucket documenti
  async docs() { return unwrap(await this.sb.from('lab_docs').select('*').order('created_at', { ascending: false }).limit(2000)); }
  async saveDoc(d) {
    const f = {};
    for (const k of ['kind', 'title', 'authors', 'journal', 'year', 'doi', 'url', 'path', 'file_name', 'mime', 'size', 'note', 'links', 'abstract', 'pdf_url', 'license']) if (d[k] !== undefined) f[k] = d[k];
    if (d.id) return unwrap(await this.sb.from('lab_docs').update(f).eq('id', d.id).select().single());
    return unwrap(await this.sb.from('lab_docs').insert(f).select().single());
  }
  async deleteDoc(d) {
    const rows = unwrap(await this.sb.from('lab_docs').delete().eq('id', d.id).select());
    if (!rows.length) throw new Error('Lo cancella chi l\'ha messo o un amministratore');
    if (d.path) await this.sb.storage.from('documenti').remove([d.path]).catch(() => {});
  }
  async uploadDoc(file, contentType) {
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const safe = String(file.name || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_').slice(-120) || 'file';
    const path = `${id}/${safe}`;
    const { error } = await this.sb.storage.from('documenti').upload(path, file, { contentType, upsert: false });
    if (error) throw dbErr(error);
    return path;
  }
  async removeDocFile(path) { if (path) await this.sb.storage.from('documenti').remove([path]).catch(() => {}); }
  // persone di cui si seguono gli articoli (giro 42) e controllo subito, con la funzione notify
  async labAuthors() { return unwrap(await this.sb.from('lab_authors').select('*').order('full_name')); }
  async saveLabAuthor(a) {
    const f = { full_name: a.full_name, orcids: a.orcids || [], active: a.active !== false };
    if (a.id) { const rows = unwrap(await this.sb.from('lab_authors').update(f).eq('id', a.id).select()); if (!rows.length) throw new Error('Lo cambia un amministratore'); return rows[0]; }
    return unwrap(await this.sb.from('lab_authors').insert(f).select().single());
  }
  async deleteLabAuthor(id) { const rows = unwrap(await this.sb.from('lab_authors').delete().eq('id', id).select()); if (!rows.length) throw new Error('Lo toglie un amministratore'); }
  async checkPapers() {
    const { data, error } = await this.sb.functions.invoke('notify', { body: { articoli: true } });
    if (error) { let m = ''; try { m = (await error.context?.json?.())?.error || ''; } catch { /* niente */ } throw new Error(m || 'La funzione notify non risponde: va ripubblicata con il codice nuovo'); }
    return data;
  }
  async docUrl(path, download = null) {
    const { data, error } = await this.sb.storage.from('documenti').createSignedUrl(path, 3600, download ? { download } : undefined);
    if (error) throw dbErr(error);
    return data.signedUrl;
  }

  async savePrefs(uid, prefs) {
    return unwrap(await this.sb.from('profiles').update({ prefs }).eq('id', uid).select().single());
  }

  // spazio usato (giro 25), solo per gli amministratori
  async storageUsage() { return unwrap(await this.sb.rpc('storage_usage')); }

  // ---- giro 27: doppioni dell'inventario, calendario, impostazioni del laboratorio, ingresso dei nuovi
  async dupOk() { return unwrap(await this.sb.from('item_dup_ok').select('a, b')); }
  async addDupOk(pairs) { if (pairs.length) unwrap(await this.sb.from('item_dup_ok').upsert(pairs, { onConflict: 'a,b', ignoreDuplicates: true })); }
  async mergeItems(keep, drop) { return unwrap(await this.sb.rpc('merge_items', { p_keep: keep, p_drop: drop })); }
  async calendarToken(reset = false) { return unwrap(await this.sb.rpc('calendar_token', { p_new: reset })); }
  calendarUrl(token) { return `${String(CONFIG.SUPABASE_URL).replace(/\/+$/, '')}/functions/v1/notify?ical=${encodeURIComponent(token)}`; }
  async labSetting(key) { return unwrap(await this.sb.from('lab_settings').select('value').eq('key', key).maybeSingle())?.value ?? null; }
  async saveLabSetting(key, value) { unwrap(await this.sb.from('lab_settings').upsert({ key, value, updated_at: new Date().toISOString() })); }
  async onboardings() { return unwrap(await this.sb.from('onboarding').select('*').order('started_on', { ascending: false })); }
  async addOnboarding(row) { return unwrap(await this.sb.from('onboarding').insert(row).select().single()); }
  async saveOnboarding(uid, patch) {
    const rows = unwrap(await this.sb.from('onboarding').update(patch).eq('user_id', uid).select());
    if (!rows.length) throw new Error('Questa lista la cambiano la persona, il suo tutor o un amministratore');
    return rows[0];
  }
  async deleteOnboarding(uid) { unwrap(await this.sb.from('onboarding').delete().eq('user_id', uid)); }

  // ---- giro 28: primer e coppie
  async primers() { return unwrap(await this.sb.from('primers').select('*').order('name')); }
  async primerPairs() { return unwrap(await this.sb.from('primer_pairs').select('*').order('created_at')); }
  async savePrimer(x) {
    const f = { name: x.name, seq: x.seq, direction: x.direction || null, locus: x.locus || null, target: x.target || null, ref: x.ref || null, doi: x.doi || null, notes: x.notes || null };
    try {
      if (x.id) return unwrap(await this.sb.from('primers').update(f).eq('id', x.id).select().single());
      return unwrap(await this.sb.from('primers').insert(f).select().single());
    } catch (e) { if (/primers_name_key|duplicate/i.test(e.message || '')) throw new Error(`C'è già un primer che si chiama ${x.name}`); throw e; }
  }
  async deletePrimer(id) {
    const rows = unwrap(await this.sb.from('primers').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Lo può eliminare chi l\'ha inserito o un amministratore');
  }
  async savePair(x) {
    const f = { fwd_id: x.fwd_id, rev_id: x.rev_id, name: x.name || null, locus: x.locus || null, size_bp: x.size_bp || null, polymerase: x.polymerase || null, notes: x.notes || null };
    try {
      if (x.id) return unwrap(await this.sb.from('primer_pairs').update(f).eq('id', x.id).select().single());
      return unwrap(await this.sb.from('primer_pairs').insert(f).select().single());
    } catch (e) { if (/duplicate|unique/i.test(e.message || '')) throw new Error('Questa coppia c\'è già'); throw e; }
  }
  async deletePair(id) {
    const rows = unwrap(await this.sb.from('primer_pairs').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può eliminare chi l\'ha inserita o un amministratore');
  }

  async photoUrls(paths) {
    if (!paths.length) return {};
    const { data, error } = await this.sb.storage.from('foto').createSignedUrls(paths, 6 * 3600);
    if (error) throw dbErr(error);
    return Object.fromEntries((data || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  }

  async bookingsBetween(from, to) {
    return unwrap(await this.sb.from('bookings').select('*').lt('starts_at', to).gt('ends_at', from).order('starts_at'));
  }
  // ---- esercitazioni con gli studenti: la funzione del database prenota anche gli strumenti
  async savePractical(p) {
    const { data, error } = await this.sb.rpc('save_practical', { p });
    if (error) throw new Error(error.message);
    return data;
  }

  async deletePractical(id) {
    const rows = unwrap(await this.sb.from('practicals').delete().eq('id', id).select());
    if (!rows.length) throw new Error('La può eliminare solo chi l\'ha segnata o un amministratore');
  }


  async saveItem(item) {
    const { id, ...fields } = item;
    for (const k of ['flagged_by', 'flagged_at', 'ordered_by', 'ordered_at', 'created_by', 'created_at', 'updated_by', 'updated_at']) delete fields[k];
    if (id) return unwrap(await this.sb.from('items').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('items').insert(fields).select().single());
  }

  async patchItem(id, patch) {
    return unwrap(await this.sb.from('items').update(patch).eq('id', id).select().single());
  }

  async adjust(id, delta) {
    return unwrap(await this.sb.rpc('adjust_quantity', { p_item: id, p_delta: delta }));
  }

  async deleteItem(id) { unwrap(await this.sb.from('items').delete().eq('id', id)); }

  async saveInstrument(inst) {
    const { id, created_at, ...fields } = inst;
    if (id) return unwrap(await this.sb.from('instruments').update(fields).eq('id', id).select().single());
    return unwrap(await this.sb.from('instruments').insert(fields).select().single());
  }

  async deleteInstrument(id) { unwrap(await this.sb.from('instruments').delete().eq('id', id)); }

  async createBooking(b) {
    return unwrap(await this.sb.from('bookings').insert(b).select().single());
  }

  async deleteBooking(id) {
    const rows = unwrap(await this.sb.from('bookings').delete().eq('id', id).select());
    if (!rows.length) throw new Error('Non puoi annullare questa prenotazione');
  }

  async setRole(id, role) { unwrap(await this.sb.rpc('set_member_role', { target: id, new_role: role })); }
  async removeMember(id) { unwrap(await this.sb.rpc('remove_member', { target: id })); }

  async updateMyName(uid, name) {
    return unwrap(await this.sb.from('profiles').update({ full_name: name }).eq('id', uid).select().single());
  }

  async savePushSubscription(endpoint, p256dh, auth, ua) {
    unwrap(await this.sb.rpc('save_push_subscription', { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth, p_user_agent: ua }));
  }

  async deletePushSubscription(endpoint) {
    await this.sb.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }

  async notify(test = false) {
    const { data, error } = await this.sb.functions.invoke('notify', { body: test ? { test: true } : {} });
    if (error) {
      let detail = '';
      try { detail = (await error.context?.json?.())?.error || ''; } catch { /* nessun dettaglio */ }
      throw new Error(detail || 'Il servizio notifiche non risponde');
    }
    return data;
  }
}

// ---------------------------------------------------------------------------
//  Regole di stato degli articoli (uguali a quelle del database)
// ---------------------------------------------------------------------------
export function applyItemRules(prev, next, uid) {
  const now = new Date().toISOString();
  next.updated_at = now;
  next.updated_by = uid;
  if (next.category === 'comune') next.category = 'consumabili';
  if (next.status === 'ok' && prev && (prev.status === 'ordinato' || prev.status === 'da_ordinare')) {
    next.arrived_at = now;
    next.arrived_by = uid;
  }
  if (next.status === 'ok') {
    Object.assign(next, { flag_reason: null, flag_note: null, flagged_by: null, flagged_at: null, ordered_by: null, ordered_at: null });
  }
  if (next.status === 'ok' && next.quantity != null && next.min_quantity != null
      && Number(next.quantity) <= Number(next.min_quantity)
      && (!prev || Number(next.quantity) !== Number(prev.quantity) || Number(next.min_quantity) !== Number(prev.min_quantity))) {
    next.status = 'da_ordinare';
    next.flag_reason = 'sotto_scorta';
  }
  if (next.status === 'da_ordinare' && (!prev || prev.status !== 'da_ordinare')) {
    next.flagged_at = now;
    next.flagged_by = uid;
    next.flag_reason = next.flag_reason || 'segnalato';
  }
  if (next.status === 'ordinato' && (!prev || prev.status !== 'ordinato')) {
    next.ordered_at = now;
    next.ordered_by = uid;
  }
  return next;
}

// ---------------------------------------------------------------------------
//  Modalità prova
// ---------------------------------------------------------------------------
// la prova riparte da capo quando cambiano i dati veri di partenza (prova-dati.js ha la sua versione), senza toccare l'app
const DEMO_KEY = (globalThis.LABAPP_PREVIEW ? 'labapp-anteprima-v19' : 'labapp-demo-v19') + (globalThis.LABAPP_SEED_VERSION ? `-${globalThis.LABAPP_SEED_VERSION}` : '');
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
const clone = (x) => JSON.parse(JSON.stringify(x));

// La prova parte senza dati inventati: c'è solo chi la usa, come amministratore. Nell'anteprima e nella prova del
// laboratorio (prova-dati.js) arrivano i dati veri: inventario, protocolli, strumenti con le foto, ceppi, flow cell e articoli.
function demoSeed() {
  const now = Date.now();
  const h = 3600e3;
  const iso = (ms) => new Date(ms).toISOString();
  const ago = (d) => iso(now - d * 24 * h);
  const G = globalThis;
  const profiles = [{ id: 'u-tu', full_name: 'Tu', email: 'tu@prova.it', role: 'admin', created_at: ago(30) }];
  const base = { unit: 'pz', min_quantity: null, location: null, supplier: null, catalog_no: null, lot: null, expiry: null, notes: null, status: 'ok', flag_reason: null, flag_note: null, flagged_by: null, flagged_at: null,
    ordered_by: null, ordered_at: null, created_by: 'u-tu', created_at: ago(20), updated_by: 'u-tu', updated_at: ago(9) };
  // la riga generica delle Flongle è superata dalla sezione Sequenziamento, una scheda per ogni flow cell
  const items = (G.LABAPP_SEED_ITEMS || []).filter((x) => x.name !== 'Nanopore Flongle flow cell')
    .map((it) => ({ ...base, id: uuid(), ...it, category: it.category === 'comune' ? 'consumabili' : it.category }));
  const instruments = (G.LABAPP_SEED_INSTRUMENTS || []).map((i) => ({ id: uuid(), kind: null, location: null, notes: null, active: true, shelves: null, settings: null, photo: null, created_at: ago(30), ...i }));
  const protocols = (G.LABAPP_SEED_PROTOCOLS || []).map((p) => ({ id: uuid(), summary: null, base_amount: null, base_unit: null, notes: null, link: null, equipment: [], prep: [], phases: [], safety: null, source: null,
    ...p, created_at: ago(15), created_by: null, updated_by: null, updated_at: ago(15) }));
  const flowcells = (G.LABAPP_SEED_FLOWCELLS || []).map((f) => ({ id: uuid(), kind: 'Flongle', expiry: null, status: 'disponibile', run_note: null, notes: null, checked_by: null, started_by: null, started_at: null,
    ended_by: null, ended_at: null, created_by: 'u-tu', created_at: ago(90), ...f }));
  const fc_checks = flowcells.filter((f) => f.pores != null).map((f, k) => ({ id: k + 1, flowcell_id: f.id, pores: f.pores, checked_at: f.checked_at, user_id: null, note: f.check_note || null }));
  const strains = [], stocks = [], strain_seqs = [], strain_photos = [];
  for (const x of G.LABAPP_SEED_STRAINS || []) {
    const st = { id: uuid(), code: x.code || null, species: x.species, host: x.host || null, origin: x.origin || null, isolated_on: null, isolated_by: x.isolated_by || null, substrate: x.substrate || null, medium: null, storage: null,
      sequence_ref: x.sequence_ref || null, notes: x.notes || null, status: x.status || 'attivo', subculture_days: 'subculture_days' in x ? x.subculture_days : 90, last_subculture: null, keeper_id: null, keeper_name: x.keeper_name || null,
      sporulates: x.sporulates ?? null, photos: [], created_by: 'u-tu', created_at: ago(150), updated_by: 'u-tu', updated_at: ago(150) };
    // giro 47: provenienza, progetto e coordinate (gli endofiti del grano)
    for (const k of ['country', 'provenance', 'project', 'lat', 'lon']) st[k] = x[k] ?? null;
    strains.push(st);
    for (const k of x.stocks || []) stocks.push({ id: uuid(), strain_id: st.id, made_on: null, renew_months: 12, qty: null, place: null, keeper_id: null, note: null, status: 'attiva', notified_at: null,
      created_by: 'u-tu', created_at: ago(150), updated_by: 'u-tu', updated_at: ago(150), ...k });
    // giro 46: gli endofiti del grano portano sequenze e la foto della piastra (che sta nell'app, cartella isolati)
    for (const q of x.seqs || []) strain_seqs.push({ id: uuid(), strain_id: st.id, accession: null, created_by: 'u-tu', created_at: ago(150), ...q });
    for (const f of x.sphotos || []) strain_photos.push({ id: uuid(), strain_id: st.id, medium: null, temp_c: null, age_days: null, passage: null, light: null, created_by: 'u-tu', created_at: ago(150), ...f });
  }
  const docs = (G.LABAPP_SEED_DOCS || []).map((d) => ({ id: uuid(), kind: 'paper', authors: null, journal: null, year: null, doi: null, url: null, path: null, file_name: null, mime: null, size: null, note: null, links: [],
    abstract: null, pdf_url: null, license: null, auto_added: false, created_by: 'u-tu', created_at: ago(1), updated_at: ago(1), ...d }));
  const lab_authors = (G.LABAPP_SEED_AUTHORS || []).map((a) => ({ id: uuid(), active: true, last_checked_at: null, last_found: null, created_by: 'u-tu', created_at: ago(1), ...a }));
  return { strain_seqs, docs, lab_authors, profiles, items, instruments, bookings: [], practicals: [], protocol_runs: [], journal: [], journal_versions: [], projects: [], shares: [], tasks: [], task_log: [], issues: [],
    comments: [], item_log: [], photos: {}, cylinders: [], flowcells, fc_checks, item_codes: [], protocols, requests: [], waste: [], strains, strain_events: [], strain_photos, stocks, freezers: (G.LABAPP_SEED_FREEZERS || []).map((f) => ({ id: uuid(), notes: null, created_at: ago(30), ...f })), boxes: [],
    slots: [], inst_log: [], columns: [], chamber_slots: [], coffee: [], coffee_reviews: [], coffee_hidden: [], students: [], funds: [], fund_managers: [], fund_expenses: [] };
}

// Motore locale: applica una modifica ai dati già scaricati quando manca la rete
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// "RB01–RB04, RB07" dai numeri dei barcode
export function barcodeRanges(prefix, codes) {
  const pre = String(prefix || '').trim() || 'BC';
  const lbl = (n) => pre + String(n).padStart(2, '0');
  const out = [];
  for (const c of [...new Set(codes)].sort((a, b) => a - b)) {
    const last = out.at(-1);
    if (last && c === last[1] + 1) last[1] = c; else out.push([c, c]);
  }
  return out.map(([a, b]) => (a === b ? lbl(a) : `${lbl(a)}–${lbl(b)}`)).join(', ');
}

const STUDENT_FIELDS = ['full_name', 'level', 'course', 'topic', 'tutors', 'tutor_ids', 'period', 'graduation', 'status', 'notes'];
const demoNameKey = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export function createLocalEngine(db, uid) { return new DemoApi({ db, uid }); }

class DemoApi {
  constructor(opts = null) {
    if (opts?.db) {
      this.uid = opts.uid; this.noPersist = true;
      this.db = { item_log: [], task_log: [], strain_events: [], stocks: [], profiles: [], ...opts.db };
      return;
    }
    this.uid = 'u-tu';
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { saved = null; }
    this.db = saved || demoSeed();
    const KEYS = ['practicals', 'protocol_runs', 'journal', 'journal_versions', 'projects', 'shares', 'tasks', 'task_log', 'issues', 'comments', 'item_log', 'photos', 'cylinders', 'flowcells', 'fc_checks', 'item_codes', 'protocols', 'requests', 'waste', 'strains', 'strain_events', 'strain_photos', 'stocks', 'freezers', 'boxes', 'slots', 'inst_log', 'columns', 'chamber_slots', 'coffee', 'coffee_reviews', 'coffee_hidden', 'students', 'lab_authors', 'funds', 'fund_managers', 'fund_expenses'];
    if (KEYS.some((k) => !this.db[k])) { const fresh = demoSeed(); for (const k of KEYS) if (!this.db[k]) this.db[k] = fresh[k]; }
    this.persist();
  }

  log(item, action, extra = {}) {
    this.db.item_log.push({ id: (this.db.item_log.at(-1)?.id || 0) + 1, item_id: item.id, user_id: this.uid, action, delta: null, quantity: item.quantity ?? null, note: null, at: new Date().toISOString(), ...extra });
    if (this.db.item_log.length > 2000) this.db.item_log.splice(0, this.db.item_log.length - 2000);
  }

  get demo() { return true; }

  persist() { if (this.noPersist) return; try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch { /* memoria del browser non disponibile */ } }

  reset() { this.db = demoSeed(); this.persist(); }

  async session() { return { user: { id: this.uid } }; }
  onAuth() {}
  async signIn() {}
  async signUp() { return { needsConfirm: false }; }
  async signOut() {}
  async resetPassword() {}
  async updatePassword() {}

  async me() { return clone(this.db.profiles.find((p) => p.id === this.uid)); }

  async loadAll(from, to) {
    return {
      items: clone(this.db.items).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      profiles: clone(this.db.profiles),
      instruments: clone(this.db.instruments).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      bookings: await this.bookingsBetween(from, to),
      practicals: clone(this.db.practicals.filter((x) => new Date(x.ends_at) > Date.now() - 86400e3)).sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      tasks: clone(this.db.tasks).sort((a, b) => a.due_on.localeCompare(b.due_on)),
      cylinders: clone(this.db.cylinders.filter((c) => c.status !== 'ritirata' || Date.now() - new Date(c.collected_at) < 45 * 86400e3)),
      flowcells: clone(this.db.flowcells).sort((a, b) => a.code.localeCompare(b.code)),
      protocols: clone(this.db.protocols).sort((a, b) => a.title.localeCompare(b.title, 'it')),
      requests: clone(this.db.requests.filter((r) => ['richiesta', 'ordinata'].includes(r.status) || Date.now() - new Date(r.requested_at) < 45 * 86400e3)).sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
      waste: clone(this.db.waste.filter((w) => w.status !== 'ritirata' || Date.now() - new Date(w.collected_at) < 45 * 86400e3)),
      strains: clone(this.db.strains).sort((a, b) => (a.code || '\uffff').localeCompare(b.code || '\uffff')),
      stocks: clone(this.db.stocks).sort((a, b) => (b.made_on || '').localeCompare(a.made_on || '')),
      fundRoles: this.db.fund_managers ? this.db.fund_managers.filter((m) => this.fundIds().includes(m.fund_id)).map(({ fund_id, user_id }) => ({ fund_id, user_id })) : [],
      itemSlots: this.db.slots.filter((x) => x.item_id).map(({ item_id, box_id, pos, label }) => ({ item_id, box_id, pos, label })),
      freezers: clone(this.db.freezers).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      boxes: clone(this.db.boxes).map((b) => ({ ...b, filled: this.db.slots.filter((x) => x.box_id === b.id).length })).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      columns: clone(this.db.columns),
      chamberSlots: clone(this.db.chamber_slots.filter((c) => c.ends_on >= new Date(Date.now() - 7 * 86400e3).toISOString().slice(0, 10))).sort((a, b) => a.starts_on.localeCompare(b.starts_on)),
      coffee: clone(this.db.coffee).sort((a, b) => b.on_date.localeCompare(a.on_date) || b.created_at.localeCompare(a.created_at)),
      issues: clone(this.db.issues).sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((i) => ({ ...i, comments: this.db.comments.filter((c) => c.issue_id === i.id).length })),
    };
  }

  async addCylinders(rows) {
    const now = new Date().toISOString();
    const made = rows.map((r) => ({ brand: null, code: null, size: null, notes: null, status: 'piena', ...r, id: uuid(), created_by: this.uid, created_at: now, started_by: r.status === 'in_uso' ? this.uid : null, started_at: r.status === 'in_uso' ? now : null, emptied_by: null, emptied_at: null, collected_by: null, collected_at: null }));
    this.db.cylinders.push(...made);
    this.persist();
    return clone(made);
  }

  async saveCylinder(c) {
    const k = this.db.cylinders.findIndex((x) => x.id === c.id);
    const { gas, brand, location, code, size, notes } = c;
    Object.assign(this.db.cylinders[k], { gas, brand, location, code, size, notes });
    this.persist();
    return clone(this.db.cylinders[k]);
  }

  async setCylinderStatus(id, status) {
    const c = this.db.cylinders.find((x) => x.id === id);
    const now = new Date().toISOString();
    if (status !== c.status) {
      if (status === 'in_uso') Object.assign(c, { started_by: this.uid, started_at: now });
      if (status === 'vuota') Object.assign(c, { emptied_by: this.uid, emptied_at: now });
      if (status === 'ritirata') Object.assign(c, { collected_by: this.uid, collected_at: now });
    }
    c.status = status;
    if (status === 'piena' || status === 'in_uso') Object.assign(c, { emptied_by: null, emptied_at: null });
    if (status === 'piena') Object.assign(c, { started_by: null, started_at: null });
    if (status !== 'ritirata') Object.assign(c, { collected_by: null, collected_at: null });
    this.persist();
    return clone(c);
  }

  async collectCylinders(location) {
    const out = [];
    for (const c of this.db.cylinders.filter((x) => x.location === location && x.status === 'vuota')) out.push(await this.setCylinderStatus(c.id, 'ritirata'));
    return out;
  }

  async deleteCylinder(id) { this.db.cylinders = this.db.cylinders.filter((x) => x.id !== id); this.persist(); }

  // ---- caffè
  async saveCoffee(o) {
    const { id, points, on_date, note } = o;
    const coffee = o.coffee || null, user_id = o.user_id || null, person_name = user_id ? null : String(o.person_name || '').trim() || null;
    if (!(points >= 1 && points <= 100) || (!user_id && !person_name) || (person_name && person_name.length > 60)) throw new Error('Controlla i valori inseriti');
    if (id) { const x = this.db.coffee.find((y) => y.id === id); Object.assign(x, { user_id, person_name, points, on_date, note, coffee }); this.persist(); return clone(x); }
    const x = { id: uuid(), user_id, person_name, points, on_date: on_date || new Date().toISOString().slice(0, 10), note, coffee, created_by: this.uid, created_at: new Date().toISOString() };
    this.db.coffee.push(x); this.persist(); return clone(x);
  }
  async deleteCoffee(id) { this.db.coffee = this.db.coffee.filter((x) => x.id !== id); this.persist(); }
  async coffeeHidden() { return clone(this.db.coffee_hidden || []); }
  async hideCoffee(o) {
    const k = demoNameKey(o.person_name);
    if ((this.db.coffee_hidden ||= []).some((h) => (o.user_id ? h.user_id === o.user_id : !h.user_id && demoNameKey(h.person_name) === k))) throw new Error('È già tra chi non è più in laboratorio');
    const x = { id: uuid(), user_id: o.user_id || null, person_name: o.user_id ? null : o.person_name, created_by: this.uid, created_at: new Date().toISOString() };
    this.db.coffee_hidden.push(x); this.persist(); return clone(x);
  }
  async unhideCoffee(id) { this.db.coffee_hidden = (this.db.coffee_hidden || []).filter((x) => x.id !== id); this.persist(); }
  async linkCoffee(name, uid) {
    const me = this.db.profiles.find((p) => p.id === this.uid);
    if (uid !== this.uid && me?.role !== 'admin') throw new Error('Puoi collegare un nome solo a te stesso, per gli altri serve un amministratore');
    const k = demoNameKey(name); let n = 0;
    for (const o of this.db.coffee) if (!o.user_id && demoNameKey(o.person_name) === k) { o.user_id = uid; o.person_name = null; n++; }
    for (const h of this.db.coffee_hidden || []) if (!h.user_id && demoNameKey(h.person_name) === k) { h.user_id = uid; h.person_name = null; }
    this.persist(); return n;
  }

  // ---- tesisti
  async students() { return clone(this.db.students || []).sort((a, b) => a.full_name.localeCompare(b.full_name, 'it')); }
  async saveStudent(o) {
    const f = Object.fromEntries(STUDENT_FIELDS.map((k) => [k, o[k] ?? (k === 'tutor_ids' ? [] : null)]));
    if (!String(f.full_name || '').trim() || !['triennale', 'magistrale', 'altro'].includes(f.level) || !['in_corso', 'finito', 'ritirato'].includes(f.status)) throw new Error('Controlla i valori inseriti');
    const now = new Date().toISOString();
    if (o.id) { const x = this.db.students.find((y) => y.id === o.id); Object.assign(x, f, { updated_at: now }); this.persist(); return clone(x); }
    const x = { id: uuid(), ...f, created_by: this.uid, created_at: now, updated_at: now };
    (this.db.students ||= []).push(x); this.persist(); return clone(x);
  }
  async deleteStudent(id) { this.db.students = (this.db.students || []).filter((x) => x.id !== id); this.persist(); }
  async coffeeReviews() { return clone(this.db.coffee_reviews).sort((a, b) => b.updated_at.localeCompare(a.updated_at)); }
  async saveCoffeeReview(r) {
    const now = new Date().toISOString();
    const coffee = String(r.coffee || '').trim();
    if (!coffee || coffee.length > 80 || !(Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 10)) throw new Error('Scegli il caffè e da 1 a 10 piastre');
    const key = coffee.toLowerCase();
    if (r.id) {
      const x = this.db.coffee_reviews.find((y) => y.id === r.id);
      if (!x || x.user_id !== this.uid) throw new Error('Puoi cambiare solo il tuo voto');
      Object.assign(x, { coffee, rating: r.rating, comment: r.comment ?? null, updated_at: now }); this.persist(); return clone(x);
    }
    if (this.db.coffee_reviews.some((y) => y.user_id === this.uid && y.coffee.trim().toLowerCase() === key)) throw new Error('Hai già votato questo caffè, aggiorna la pagina e cambia il voto');
    const x = { id: uuid(), coffee, user_id: this.uid, rating: r.rating, comment: r.comment ?? null, created_at: now, updated_at: now };
    this.db.coffee_reviews.push(x); this.persist(); return clone(x);
  }
  async deleteCoffeeReview(id) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const x = this.db.coffee_reviews.find((y) => y.id === id);
    if (!x || (x.user_id !== this.uid && me?.role !== 'admin')) throw new Error('Puoi togliere solo il tuo voto');
    this.db.coffee_reviews = this.db.coffee_reviews.filter((y) => y.id !== id); this.persist();
  }

  // ---- richieste d'ordine
  async saveRequest(r) {
    const { id, product, catalog_no, brand, supplier, quantity, price, item_id, notes } = r;
    const fields = { product, catalog_no, brand, supplier, quantity, price, item_id: item_id ?? null, notes };
    if (id) { const x = this.db.requests.find((y) => y.id === id); Object.assign(x, fields); this.persist(); return clone(x); }
    const x = { ...fields, id: uuid(), status: 'richiesta', requested_by: this.uid, requested_at: new Date().toISOString(), ordered_by: null, ordered_at: null, arrived_by: null, arrived_at: null };
    this.db.requests.push(x); this.persist(); return clone(x);
  }
  async setRequestStatus(id, status) {
    const x = this.db.requests.find((y) => y.id === id); const now = new Date().toISOString();
    if (status !== x.status) {
      if (status === 'ordinata') Object.assign(x, { ordered_by: this.uid, ordered_at: now });
      if (status === 'arrivata') Object.assign(x, { arrived_by: this.uid, arrived_at: now, ordered_at: x.ordered_at || now, ordered_by: x.ordered_by || this.uid });
    }
    x.status = status;
    if (status === 'richiesta') Object.assign(x, { ordered_by: null, ordered_at: null });
    if (status === 'richiesta' || status === 'ordinata') Object.assign(x, { arrived_by: null, arrived_at: null });
    this.persist(); return clone(x);
  }
  async deleteRequest(id) { this.db.requests = this.db.requests.filter((x) => x.id !== id); this.persist(); }

  // ---- taniche dei rifiuti
  async addWaste(rows) {
    const now = new Date().toISOString();
    const made = rows.map((r) => ({ code: null, size: null, notes: null, status: 'in_uso', ...r, id: uuid(), created_by: this.uid, created_at: now, full_by: r.status === 'piena' ? this.uid : null, full_at: r.status === 'piena' ? now : null, collected_by: null, collected_at: null }));
    this.db.waste.push(...made); this.persist(); return clone(made);
  }
  async saveWaste(w) { const x = this.db.waste.find((y) => y.id === w.id); const { kind, location, code, size, notes } = w; Object.assign(x, { kind, location, code, size, notes }); this.persist(); return clone(x); }
  async setWasteStatus(id, status) {
    const x = this.db.waste.find((y) => y.id === id); const now = new Date().toISOString();
    if (status !== x.status) {
      if (status === 'piena') Object.assign(x, { full_by: this.uid, full_at: now });
      if (status === 'ritirata') Object.assign(x, { collected_by: this.uid, collected_at: now });
    }
    x.status = status;
    if (status === 'in_uso') Object.assign(x, { full_by: null, full_at: null });
    if (status !== 'ritirata') Object.assign(x, { collected_by: null, collected_at: null });
    this.persist(); return clone(x);
  }
  async collectWaste(location) {
    const out = [];
    for (const w of this.db.waste.filter((x) => x.location === location && x.status === 'piena')) out.push(await this.setWasteStatus(w.id, 'ritirata'));
    return out;
  }
  async deleteWaste(id) { this.db.waste = this.db.waste.filter((x) => x.id !== id); this.persist(); }

  // ---- ceppi
  async saveStrain(st) {
    const { id, code, species, host, origin, isolated_on, isolated_by, substrate, medium, storage, sequence_ref, notes, status, subculture_days, last_subculture, photos, keeper_id, keeper_name, sporulates, snooze_until } = st;
    const fields = { snooze_until: snooze_until || null, code: String(code ?? '').trim() || null, species, host, origin, isolated_on, isolated_by, substrate, medium, storage, sequence_ref, notes, status: status || 'attivo', subculture_days, last_subculture, ...(photos ? { photos } : {}),
      keeper_id: keeper_id || null, keeper_name: keeper_name || null, sporulates: sporulates ?? null };
    if (st.todo_by !== undefined) fields.todo_by = st.todo_by || null;
    for (const k of STRAIN_ORIGIN_KEYS) if (st[k] !== undefined) fields[k] = st[k] === '' ? null : st[k];
    if (fields.code && this.db.strains.some((x) => x.id !== id && x.code && x.code.toUpperCase() === fields.code.toUpperCase())) throw new Error('Esiste già un ceppo con questo codice');
    const now = new Date().toISOString();
    if (id) { const x = this.db.strains.find((y) => y.id === id); Object.assign(x, fields, { updated_by: this.uid, updated_at: now }); this.persist(); return clone(x); }
    const x = { ...fields, id: uuid(), created_by: this.uid, created_at: now, updated_by: this.uid, updated_at: now };
    this.db.strains.push(x); this.persist(); return clone(x);
  }
  async importStrains(rows) { const out = []; for (const r of rows) out.push(await this.saveStrain(r)); return out; }
  async deleteStrain(id) {
    this.db.strains = this.db.strains.filter((x) => x.id !== id);
    this.db.stocks = (this.db.stocks || []).filter((x) => x.strain_id !== id);
    this.db.strain_events = this.db.strain_events.filter((e) => e.strain_id !== id);
    this.db.strain_photos = (this.db.strain_photos || []).filter((x) => x.strain_id !== id);
    for (const sl of this.db.slots) if (sl.strain_id === id) sl.strain_id = null;
    this.persist();
  }
  fundIds() { return (this.db.fund_managers || []).filter((m) => m.user_id === this.uid).map((m) => m.fund_id); }
  async fundsData() {
    const ids = this.fundIds();
    return { funds: clone(this.db.funds.filter((f) => ids.includes(f.id))).sort((a, b) => a.name.localeCompare(b.name, 'it')),
      managers: clone(this.db.fund_managers.filter((m) => ids.includes(m.fund_id))),
      expenses: clone(this.db.fund_expenses.filter((x) => ids.includes(x.fund_id))).sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at)) };
  }
  mustManage(fundId) { if (!this.fundIds().includes(fundId)) throw new Error('Non hai i permessi per questa operazione'); }
  async createFund(f) {
    const x = { id: uuid(), name: String(f.name).trim(), code: f.code || null, budget: Number(f.budget) || 0, ends_on: f.ends_on || null, notes: f.notes || null, active: true, created_by: this.uid, created_at: new Date().toISOString() };
    this.db.funds.push(x); this.db.fund_managers.push({ fund_id: x.id, user_id: this.uid, added_by: this.uid, added_at: x.created_at }); this.persist(); return clone(x);
  }
  async saveFund(f) {
    this.mustManage(f.id);
    const x = this.db.funds.find((y) => y.id === f.id);
    Object.assign(x, { name: f.name, code: f.code || null, budget: Number(f.budget) || 0, ends_on: f.ends_on || null, notes: f.notes || null, active: f.active ?? true }); this.persist(); return clone(x);
  }
  async deleteFund(id) {
    this.mustManage(id);
    this.db.funds = this.db.funds.filter((f) => f.id !== id); this.db.fund_managers = this.db.fund_managers.filter((m) => m.fund_id !== id);
    this.db.fund_expenses = this.db.fund_expenses.filter((x) => x.fund_id !== id); this.persist();
  }
  async addFundManager(fundId, userId) {
    this.mustManage(fundId);
    if (this.db.fund_managers.some((m) => m.fund_id === fundId && m.user_id === userId)) throw new Error('È già responsabile di questo fondo');
    const m = { fund_id: fundId, user_id: userId, added_by: this.uid, added_at: new Date().toISOString() }; this.db.fund_managers.push(m); this.persist(); return clone(m);
  }
  async removeFundManager(fundId, userId) {
    this.mustManage(fundId);
    if (this.db.fund_managers.filter((m) => m.fund_id === fundId).length <= 1) throw new Error('Il fondo deve avere almeno un responsabile');
    this.db.fund_managers = this.db.fund_managers.filter((m) => !(m.fund_id === fundId && m.user_id === userId)); this.persist();
  }
  async consumi(days = 365) {
    const since = Date.now() - days * 86400e3, out = new Map();
    for (const l of this.db.item_log) {
      if (!(l.delta < 0) || l.action !== 'quantita' || new Date(l.at).getTime() < since) continue;
      const k = `${l.item_id}|${l.at.slice(0, 7)}-01`;
      const cur = out.get(k) || { item_id: l.item_id, mese: l.at.slice(0, 7) + '-01', prelievi: 0, quantita: 0 };
      cur.prelievi++; cur.quantita += -l.delta; out.set(k, cur);
    }
    return [...out.values()];
  }
  async saveExpense(e) {
    this.mustManage(e.fund_id);
    const fields = { fund_id: e.fund_id, amount: Number(e.amount), spent_on: e.spent_on, description: String(e.description).trim(), supplier: String(e.supplier ?? '').trim() || null, request_id: e.request_id || null, items: e.items || [] };
    if (!(fields.amount > 0)) throw new Error('Controlla i valori inseriti');
    if (e.id) { const x = this.db.fund_expenses.find((y) => y.id === e.id); this.mustManage(x.fund_id); Object.assign(x, fields); this.persist(); return clone(x); }
    const x = { id: uuid(), ...fields, created_by: this.uid, created_at: new Date().toISOString() }; this.db.fund_expenses.push(x); this.persist(); return clone(x);
  }
  async deleteExpense(id) { const x = this.db.fund_expenses.find((y) => y.id === id); if (x) this.mustManage(x.fund_id); this.db.fund_expenses = this.db.fund_expenses.filter((y) => y.id !== id); this.persist(); }
  async reauth(password) { if (!String(password || '').length) throw new Error('Scrivi la password'); }

  async saveStock(s) {
    const { id, strain_id, kind, made_on, renew_months, qty, place, keeper_id, note, status, snooze_until } = s;
    const fields = { kind: kind || 'spore_glicerolo', made_on: made_on || null, renew_months: renew_months ?? null, qty: qty ?? null, place: String(place ?? '').trim() || null, keeper_id: keeper_id || null, note: String(note ?? '').trim() || null, status: status || 'attiva', snooze_until: snooze_until || null };
    const now = new Date().toISOString();
    if (id) {
      const x = this.db.stocks.find((y) => y.id === id);
      if (!x) throw new Error('Conservazione non trovata');
      Object.assign(x, fields, { updated_by: this.uid, updated_at: now, notified_at: null }); this.persist(); return clone(x);
    }
    const x = { id: uuid(), strain_id, ...fields, notified_at: null, created_by: this.uid, created_at: now, updated_by: this.uid, updated_at: now };
    this.db.stocks.push(x); this.persist(); return clone(x);
  }
  async renewStock(id, qty = null, label = null) {
    const x = this.db.stocks.find((y) => y.id === id);
    if (!x) throw new Error('Conservazione non trovata');
    const row = await this.saveStock({ ...x, made_on: localDay(), status: 'attiva', snooze_until: null, qty: qty ?? x.qty });
    this.db.strain_events.push({ id: Date.now(), strain_id: x.strain_id, kind: 'conservato', note: label, on_date: localDay(), user_id: this.uid, created_at: new Date().toISOString() });
    this.persist(); return row;
  }
  async deleteStock(id) {
    const x = this.db.stocks.find((y) => y.id === id);
    const me = this.db.profiles.find((p) => p.id === this.uid);
    if (x && x.created_by !== this.uid && x.keeper_id !== this.uid && me?.role !== 'admin') throw new Error('La può cancellare chi l\'ha aggiunta, il referente o un amministratore');
    this.db.stocks = this.db.stocks.filter((y) => y.id !== id); this.persist();
  }
  async strainEvents(id) { return clone(this.db.strain_events.filter((e) => e.strain_id === id).sort((a, b) => b.on_date.localeCompare(a.on_date) || b.id - a.id)); }
  async strainEventsFor(ids) { return clone(this.db.strain_events.filter((e) => ids.includes(e.strain_id)).sort((a, b) => a.on_date.localeCompare(b.on_date))); }
  async strainPhotos(ids) {
    return clone((this.db.strain_photos || []).filter((x) => ids.includes(x.strain_id)).sort((a, b) => a.taken_on.localeCompare(b.taken_on) || a.created_at.localeCompare(b.created_at)));
  }
  async addStrainPhoto(x) {
    if (!this.db.strains.some((s) => s.id === x.strain_id)) throw new Error('Ceppo non trovato');
    if (!['piastra', 'liquido', 'spore', 'microscopio', 'altro'].includes(x.kind || 'piastra')) throw new Error('Tipo di foto non valido');
    const row = { id: uuid(), strain_id: x.strain_id, path: x.path, kind: x.kind || 'piastra', side: x.side || null, medium: x.medium || null, temp_c: x.temp_c ?? null, age_days: x.age_days ?? null,
      passage: x.passage ?? null, light: x.light || null, taken_on: x.taken_on || localDay(), note: x.note || null, created_by: this.uid, created_at: new Date().toISOString() };
    (this.db.strain_photos ||= []).push(row); this.persist(); return clone(row);
  }
  async deleteStrainPhoto(id) {
    const x = (this.db.strain_photos || []).find((y) => y.id === id);
    const me = this.db.profiles.find((pr) => pr.id === this.uid);
    if (!x || (x.created_by !== this.uid && me?.role !== 'admin')) throw new Error('La può eliminare solo chi l\'ha messa o un amministratore');
    this.db.strain_photos = this.db.strain_photos.filter((y) => y.id !== id); this.persist(); return clone(x);
  }
  async addStrainEvent(strainId, kind, note = null, onDate = null) {
    const d = onDate || localDay();
    this.db.strain_events.push({ id: Date.now(), strain_id: strainId, kind, note, on_date: d, user_id: this.uid, created_at: new Date().toISOString() });
    const x = this.db.strains.find((y) => y.id === strainId);
    if (kind === 'ripicca' && (!x.last_subculture || d > x.last_subculture)) x.last_subculture = d;
    this.persist(); return clone(x);
  }
  async deleteStrainEvent(id, strainId) {
    const ev = this.db.strain_events.find((e) => e.id === id);
    this.db.strain_events = this.db.strain_events.filter((e) => e.id !== id);
    const x = this.db.strains.find((y) => y.id === strainId);
    if (ev?.kind === 'ripicca') { const last = this.db.strain_events.filter((e) => e.strain_id === strainId && e.kind === 'ripicca').map((e) => e.on_date).sort().at(-1); if (last) x.last_subculture = last; }
    this.persist(); return clone(x);
  }

  // ---- congelatori
  async saveFreezer(f) {
    const { id, name, temp, location, notes } = f;
    if (id) { const x = this.db.freezers.find((y) => y.id === id); Object.assign(x, { name, temp, location, notes }); this.persist(); return clone(x); }
    const x = { id: uuid(), name, temp, location, notes, created_at: new Date().toISOString() }; this.db.freezers.push(x); this.persist(); return clone(x);
  }
  async deleteFreezer(id) {
    const ids = this.db.boxes.filter((b) => b.freezer_id === id).map((b) => b.id);
    this.db.slots = this.db.slots.filter((s) => !ids.includes(s.box_id));
    this.db.boxes = this.db.boxes.filter((b) => b.freezer_id !== id);
    this.db.freezers = this.db.freezers.filter((x) => x.id !== id); this.persist();
  }
  async saveBox(b) {
    const { id, freezer_id, name, rows, cols, place, notes } = b;
    let x;
    if (id) { x = this.db.boxes.find((y) => y.id === id); Object.assign(x, { freezer_id, name, rows, cols, place, notes }); }
    else { x = { id: uuid(), freezer_id, name, rows, cols, place, notes, created_at: new Date().toISOString() }; this.db.boxes.push(x); }
    this.persist(); return { ...clone(x), filled: this.db.slots.filter((s) => s.box_id === x.id).length };
  }
  async deleteBox(id) { this.db.slots = this.db.slots.filter((s) => s.box_id !== id); this.db.boxes = this.db.boxes.filter((b) => b.id !== id); this.persist(); }
  async boxSlots(boxId) { return clone(this.db.slots.filter((s) => s.box_id === boxId)); }
  checkSlot(box_id, pos, id = null) {
    const b = this.db.boxes.find((x) => x.id === box_id);
    const p = String(pos).trim().toUpperCase();
    if (!/^[A-Z][0-9]{1,2}$/.test(p)) throw new Error('Posizione non valida (es. A1, C12)');
    const r = p.charCodeAt(0) - 64, c = Number(p.slice(1));
    if (r > b.rows || c < 1 || c > b.cols) throw new Error(`La posizione ${p} non esiste in questa scatola`);
    if (this.db.slots.some((s) => s.box_id === box_id && s.pos === p && s.id !== id)) throw new Error('Quella posizione è già occupata');
    return p;
  }
  async saveSlot(sl) {
    const { id, box_id, label, strain_id, item_id, note, photos } = sl;
    const pos = this.checkSlot(box_id, sl.pos, id);
    const now = new Date().toISOString();
    if (id) { const x = this.db.slots.find((y) => y.id === id); Object.assign(x, { pos, label: label.trim(), strain_id: strain_id ?? null, ...(item_id !== undefined ? { item_id: item_id || null } : {}), note, ...(photos ? { photos } : {}), updated_by: this.uid, updated_at: now }); this.persist(); return clone(x); }
    const x = { id: uuid(), box_id, pos, label: label.trim(), strain_id: strain_id ?? null, item_id: item_id || null, note, photos: photos || [], updated_by: this.uid, updated_at: now };
    this.db.slots.push(x); this.persist(); return clone(x);
  }
  async fillSlots(rows) {
    rows.forEach((r) => this.checkSlot(r.box_id, r.pos));
    const out = []; for (const r of rows) out.push(await this.saveSlot(r)); return out;
  }
  async deleteSlot(id) { this.db.slots = this.db.slots.filter((s) => s.id !== id); this.persist(); }
  withBox(s) { const b = this.db.boxes.find((x) => x.id === s.box_id); return { ...clone(s), boxes: b ? { name: b.name, freezer_id: b.freezer_id } : null }; }
  async searchSlots(q) {
    const n = String(q).toLowerCase();
    return this.db.slots.filter((s) => `${s.label} ${s.note || ''}`.toLowerCase().includes(n)).slice(0, 60).map((s) => this.withBox(s));
  }
  async slotsForStrain(strainId) { return this.db.slots.filter((s) => s.strain_id === strainId).map((s) => this.withBox(s)); }

  // ---- strumenti: registro, colonne, camere di crescita
  async setInstrumentSettings(id, text) { const x = this.db.instruments.find((y) => y.id === id); x.settings = String(text || '').trim() || null; this.persist(); return clone(x); }
  async instrumentLog(id) { return clone(this.db.inst_log.filter((l) => l.instrument_id === id).sort((a, b) => b.at.localeCompare(a.at))); }
  async addInstrumentLog(id, kind, body) { const x = { id: Date.now(), instrument_id: id, kind, body, at: new Date().toISOString(), user_id: this.uid }; this.db.inst_log.push(x); this.persist(); return clone(x); }
  async deleteInstrumentLog(id) { this.db.inst_log = this.db.inst_log.filter((l) => l.id !== id); this.persist(); }
  async saveColumn(c) {
    const { id, name, phase, dimensions, serial, instrument_id, status, installed_on, injections, notes } = c;
    const fields = { name, phase, dimensions, serial, instrument_id: instrument_id ?? null, status: status || 'in_uso', installed_on, injections: injections ?? 0, notes };
    if (id) { const x = this.db.columns.find((y) => y.id === id); Object.assign(x, fields); this.persist(); return clone(x); }
    const x = { ...fields, id: uuid(), created_by: this.uid, created_at: new Date().toISOString() }; this.db.columns.push(x); this.persist(); return clone(x);
  }
  async deleteColumn(id) { this.db.columns = this.db.columns.filter((x) => x.id !== id); this.persist(); }
  async saveChamberSlot(c) {
    const { id, instrument_id, shelf, label, starts_on, ends_on, note } = c;
    if (ends_on < starts_on) throw new Error('Controlla le date (la fine non può venire prima dell\'inizio)');
    if (this.db.chamber_slots.some((x) => x.id !== id && x.instrument_id === instrument_id && x.shelf === shelf && x.starts_on <= ends_on && x.ends_on >= starts_on)) throw new Error('Quel ripiano è già occupato in quei giorni');
    if (id) { const x = this.db.chamber_slots.find((y) => y.id === id); Object.assign(x, { shelf, label, starts_on, ends_on, note }); this.persist(); return clone(x); }
    const x = { id: uuid(), instrument_id, shelf, label, starts_on, ends_on, note, user_id: this.uid, created_at: new Date().toISOString() };
    this.db.chamber_slots.push(x); this.persist(); return clone(x);
  }
  async deleteChamberSlot(id) { this.db.chamber_slots = this.db.chamber_slots.filter((x) => x.id !== id); this.persist(); }

  // ---- protocolli
  async saveProtocol(p) {
    const now = new Date().toISOString();
    const { id, title, category, summary, base_amount, base_unit, ingredients, steps, notes, link, pcr = null } = p;
    const fields = { title, category, summary, base_amount, base_unit, ingredients, steps, notes, link, pcr, updated_by: this.uid, updated_at: now };
    if (p.istd !== undefined) fields.istd = p.istd;
    if (p.todo_by !== undefined) fields.todo_by = p.todo_by || null;
    for (const k of ['equipment', 'prep', 'phases']) if (p[k] !== undefined) fields[k] = p[k] || [];
    for (const k of ['safety', 'source']) if (p[k] !== undefined) fields[k] = p[k] || null;
    if (id) {
      const k = this.db.protocols.findIndex((x) => x.id === id);
      this.db.protocols[k] = { ...this.db.protocols[k], ...fields };
      this.persist();
      return clone(this.db.protocols[k]);
    }
    const next = { ...fields, id: uuid(), created_by: this.uid, created_at: now };
    this.db.protocols.push(next);
    this.persist();
    return clone(next);
  }

  async deleteProtocol(id) { this.db.protocols = this.db.protocols.filter((x) => x.id !== id); this.persist(); }

  async protocolRuns(protocolIds = null, limit = 300) {
    return clone(this.db.protocol_runs.filter((r) => !protocolIds || protocolIds.includes(r.protocol_id))
      .sort((a, b) => b.run_on.localeCompare(a.run_on) || b.created_at.localeCompare(a.created_at)).slice(0, limit));
  }

  async userRuns(userId, limit = 300) {
    return clone(this.db.protocol_runs.filter((r) => r.created_by === userId)
      .sort((a, b) => b.run_on.localeCompare(a.run_on) || b.created_at.localeCompare(a.created_at)).slice(0, limit));
  }

  async saveRun(r) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    if (!['in_corso', 'fatta'].includes(r.status)) throw new Error('Stato non valido');
    const now = new Date().toISOString();
    const fields = { label: r.label ?? null, run_on: r.run_on, amount: r.amount ?? null, unit: r.unit ?? null, reagents: r.reagents || [], steps_done: r.steps_done || [], steps_total: r.steps_total || 0,
      params: r.params ?? null, notes: r.notes ?? null, problems: r.problems ?? null, status: r.status, updated_at: now };
    if (r.project_id !== undefined) fields.project_id = r.project_id;
    if (r.id) {
      const old = this.db.protocol_runs.find((x) => x.id === r.id);
      if (!old || (old.created_by !== this.uid && me?.role !== 'admin')) throw new Error('La può modificare solo chi l\'ha fatta o un amministratore');
      Object.assign(old, fields); this.persist(); return clone(old);
    }
    const next = { id: uuid(), protocol_id: r.protocol_id, protocol_title: r.protocol_title, ...fields, created_by: this.uid, created_at: now };
    this.db.protocol_runs.push(next); this.persist(); return clone(next);
  }

  async deleteRun(id) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const old = this.db.protocol_runs.find((x) => x.id === id);
    if (!old || (old.created_by !== this.uid && me?.role !== 'admin')) throw new Error('La può eliminare solo chi l\'ha fatta o un amministratore');
    this.db.protocol_runs = this.db.protocol_runs.filter((x) => x.id !== id); this.persist();
  }

  async journal(userId, limit = 500) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const sh = (this.db.shares || []).filter((x) => x.viewer_id === this.uid && x.owner_id === userId);
    const seen = (e) => sh.some((x) => (!x.project_id || x.project_id === e.project_id) && (!x.from_day || e.day >= x.from_day) && (!x.to_day || e.day <= x.to_day) && (!x.entry_ids || x.entry_ids.includes(e.id)));
    if (userId !== this.uid && me?.role !== 'admin' && !sh.length) return [];
    return clone(this.db.journal.filter((e) => e.user_id === userId && (userId === this.uid || me?.role === 'admin' || seen(e)))
      .sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at)).slice(0, limit));
  }

  async diaryActivity(uid, fromDay) {
    const fromIso = new Date(`${fromDay}T00:00:00`).toISOString();
    return clone({
      events: this.db.strain_events.filter((e) => e.user_id === uid && e.on_date >= fromDay),
      photos: (this.db.strain_photos || []).filter((x) => x.created_by === uid && x.taken_on >= fromDay),
      used: this.db.item_log.filter((l) => l.user_id === uid && l.action === 'quantita' && Number(l.delta) < 0 && l.at >= fromIso),
      issues: this.db.issues.filter((i) => i.created_by === uid && (i.kind || 'problema') === 'problema' && i.created_at >= fromIso),
      proc: this.db.item_log.filter((l) => l.user_id === uid && l.action === 'lavorazione' && l.at >= fromIso),
    });
  }

  async saveJournal(e) {
    const now = new Date().toISOString();
    const fields = { day: e.day || localDay(), title: e.title ?? null, samples: e.samples ?? null, notes: e.notes ?? null, problems: e.problems ?? null, updated_at: now };
    for (const k of ['project_id', 'aim', 'results', 'next_steps', 'tags', 'photos', 'photo_caps', 'links', 'materials', 'proto_changes']) if (e[k] !== undefined) fields[k] = e[k];
    if (![fields.title, fields.samples, fields.notes, fields.problems, fields.aim, fields.results, fields.next_steps].some((x) => String(x ?? '').trim()) && !(fields.photos || []).length) throw new Error('Scrivi almeno qualcosa');
    if (e.id) {
      const old = this.db.journal.find((x) => x.id === e.id);
      if (!old || old.user_id !== this.uid) throw new Error('Il diario lo modifica solo chi lo scrive');
      if (old.signed_at) throw new Error('La pagina è firmata: puoi solo aggiungere una nota in fondo');
      (this.db.journal_versions ||= []).push({ id: this.db.journal_versions.length + 1, entry_id: old.id, saved_at: now, data: clone(old) });
      Object.assign(old, fields); this.persist(); return clone(old);
    }
    const next = { id: uuid(), user_id: this.uid, project_id: null, aim: null, results: null, next_steps: null, tags: [], photos: [], photo_caps: {}, links: [], materials: [], proto_changes: [], signed_at: null, addenda: [], ...fields, created_at: now };
    this.db.journal.push(next); this.persist(); return clone(next);
  }

  async deleteJournal(id) {
    const old = this.db.journal.find((x) => x.id === id);
    if (!old || old.user_id !== this.uid || old.signed_at) throw new Error('Una pagina la cancella solo chi la scrive, e solo prima di firmarla');
    this.db.journal = this.db.journal.filter((x) => x.id !== id); this.persist();
  }
  async signJournal(id) {
    const old = this.db.journal.find((x) => x.id === id);
    if (!old || old.user_id !== this.uid) throw new Error('La firma solo chi l\'ha scritta');
    old.signed_at = new Date().toISOString(); this.persist(); return clone(old);
  }
  async addJournalAddendum(id, text) {
    const old = this.db.journal.find((x) => x.id === id);
    if (!old || old.user_id !== this.uid) throw new Error('L\'aggiunta la scrive solo chi ha scritto la pagina');
    old.addenda = [...(old.addenda || []), { at: new Date().toISOString(), text }]; this.persist(); return clone(old);
  }
  async journalVersions(id) { return clone((this.db.journal_versions || []).filter((v) => v.entry_id === id)).sort((a, b) => b.saved_at.localeCompare(a.saved_at)); }
  async projects() { return clone(this.db.projects || []).sort((a, b) => a.name.localeCompare(b.name, 'it')); }
  async saveProject(p) {
    const name = String(p.name || '').trim();
    if (!name || name.length > 80) throw new Error('Scrivi il nome del progetto');
    const me = this.db.profiles.find((x) => x.id === this.uid);
    if ((this.db.projects ||= []).some((x) => x.id !== p.id && x.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('C\'è già un progetto con questo nome');
    const admin = me?.role === 'admin', members = Array.isArray(p.members) ? [...new Set(p.members.filter(Boolean))] : null;
    if (p.id) {
      const x = this.db.projects.find((y) => y.id === p.id);
      if (!x || (x.created_by !== this.uid && !admin)) throw new Error('Lo cambia chi l\'ha creato o un amministratore');
      if (members && !admin && JSON.stringify(members) !== JSON.stringify(x.members || [])) throw new Error('Solo il responsabile sceglie chi lavora a un progetto');
      Object.assign(x, { name, description: p.description ?? null, active: p.active ?? true }, members && admin ? { members } : {}); this.persist(); return clone(x);
    }
    const x = { id: uuid(), name, description: p.description ?? null, active: true, members: admin ? members || [] : [this.uid], created_by: this.uid, created_at: new Date().toISOString() };
    this.db.projects.push(x); this.persist(); return clone(x);
  }
  async shares() { return clone((this.db.shares || []).filter((x) => x.owner_id === this.uid || x.viewer_id === this.uid)).sort((a, b) => b.created_at.localeCompare(a.created_at)); }
  async saveShare(x) {
    const f = { project_id: x.project_id ?? null, from_day: x.from_day || null, to_day: x.to_day || null, entry_ids: x.entry_ids?.length ? x.entry_ids : null, include_runs: x.include_runs !== false, note: x.note || null };
    if (f.from_day && f.to_day && f.from_day > f.to_day) throw new Error('Il periodo va dal giorno prima al giorno dopo');
    if (x.id) {
      const old = (this.db.shares || []).find((y) => y.id === x.id);
      if (!old || old.owner_id !== this.uid) throw new Error('La cambia solo chi l\'ha mandata');
      Object.assign(old, f); this.persist(); return clone(old);
    }
    if (x.viewer_id === this.uid) throw new Error('Non serve mandarlo a te');
    const row = { id: uuid(), owner_id: this.uid, viewer_id: x.viewer_id, ...f, created_at: new Date().toISOString(), notified_at: null };
    (this.db.shares ||= []).push(row); this.persist(); return clone(row);
  }
  async deleteShare(id) {
    const old = (this.db.shares || []).find((y) => y.id === id);
    if (!old || (old.owner_id !== this.uid && old.viewer_id !== this.uid)) throw new Error('La toglie chi l\'ha mandata o chi l\'ha ricevuta');
    this.db.shares = this.db.shares.filter((y) => y.id !== id); this.persist();
  }
  // copie di sicurezza: nell'anteprima restano in memoria
  demoSnapshot() {
    const map = { items: 'items', strains: 'strains', protocols: 'protocols', protocol_runs: 'protocol_runs', journal: 'lab_journal', projects: 'lab_projects', instruments: 'instruments', tasks: 'tasks', issues: 'issues', cylinders: 'cylinders', bookings: 'bookings', profiles: 'profiles' };
    const data = Object.fromEntries(Object.entries(map).map(([k, t]) => [t, clone(this.db[k] || [])]));
    const counts = Object.fromEntries(Object.entries(data).map(([t, v]) => [t, v.length]));
    return { data, counts, bytes: JSON.stringify(data).length };
  }
  demoBackups() {
    if (!this.mem) {
      const snap = this.demoSnapshot();
      const night = (d) => { const x = new Date(); x.setDate(x.getDate() - d); x.setHours(3, 10, 0, 0); return x.toISOString(); };
      // nella copia di due notti fa c'era anche un reagente poi cancellato
      const gone = { ...clone(this.db.items[0] || {}), id: uuid(), name: 'Agar batteriologico (cancellato per sbaglio)', quantity: 2, unit: 'barattoli' };
      const old = clone(snap.data); old.items.push(gone);
      this.mem = [0, 1, 2].map((d, k) => ({ id: 3 - k, made_at: night(d), kind: 'auto', made_by: null, counts: { ...snap.counts, items: snap.counts.items + (d >= 1 ? 1 : 0) }, bytes: snap.bytes, data: d >= 1 ? old : snap.data }));
    }
    return this.mem;
  }
  async backups() { return clone(this.demoBackups().map(({ data, ...b }) => b)); }
  async backupData(id) { return clone(this.demoBackups().find((b) => b.id === id)?.data || {}); }
  async makeBackup() { const b = this.demoBackups(); const snap = this.demoSnapshot(); const id = Math.max(0, ...b.map((x) => x.id)) + 1; b.unshift({ id, made_at: new Date().toISOString(), kind: 'manuale', made_by: this.uid, ...snap }); return id; }
  async deleteBackup(id) { this.mem = this.demoBackups().filter((b) => b.id !== id); }
  async backupMissing(id) {
    const b = this.demoBackups().find((x) => x.id === id); if (!b) return [];
    const now = this.demoSnapshot().data, out = [];
    for (const t of ['items', 'strains', 'protocols', 'protocol_runs', 'lab_journal', 'lab_projects', 'instruments', 'tasks', 'issues', 'cylinders']) {
      const ids = new Set((now[t] || []).map((x) => x.id));
      for (const x of b.data[t] || []) if (!ids.has(x.id)) out.push({ tbl: t, id: x.id, label: x.name || x.title || x.code || x.protocol_title || x.label || 'senza nome', day: x.day || x.run_on || String(x.created_at || '').slice(0, 10), owner: x.user_id || x.created_by || '' });
    }
    return out;
  }
  async restoreRows(id, table, ids) {
    const b = this.demoBackups().find((x) => x.id === id); if (!b) return 0;
    const key = { lab_journal: 'journal', lab_projects: 'projects' }[table] || table;
    let n = 0;
    for (const x of b.data[table] || []) if (ids.includes(x.id) && !this.db[key].some((y) => y.id === x.id)) { this.db[key].push(clone(x)); n++; }
    this.persist(); return n;
  }
  async listPhotos() { return Object.keys(this.db.photos || {}); }
  async photoBlob(path) { const u = this.db.photos?.[path]; if (!u) throw new Error('Foto non trovata'); return (await fetch(u)).blob(); }
  // trascrizione finta: nell'anteprima non si chiama nessun servizio
  async aiInfo() { return { providers: ['claude', 'gemini'], limit: 30, used: this.aiUsed || 0, demo: true }; }
  async transcribe(images, provider) {
    await new Promise((r) => setTimeout(r, 1200));
    this.aiUsed = (this.aiUsed || 0) + images.length;
    return { provider, model: provider === 'gemini' ? 'gemini-3.8-flash' : 'claude-sonnet-5-5', used: this.aiUsed, limit: 30, demo: true, page: {
      title: 'Estrazione DNA dai monosporici', day: localDay(), aim: 'DNA genomico dei 5 isolati di Fusarium dal lotto B per PCR TEF',
      samples: 'isolati B1, B2, B4, B6, B7 da PDA (7 giorni)',
      notes: '## Estrazione CTAB\n1. raschiato il micelio, circa 100 mg per isolato\n2. 600 µL di CTAB 2% a 65 °C per 30 min\n3. cloroformio:isoamilico 24:1, centrifuga 10 min a 13000 rpm\n4. isopropanolo freddo, pellet lavato con etanolo 70%\n## Nanodrop\nB1 | 64 ng/µL | 1,88\nB2 | 81 ng/µL | 1,91\nB4 | 47 ng/µL | 1,79',
      results: 'DNA buono su 4 isolati su 5, B6 molto basso (12 ng/µL)', problems: 'B7 pellet perso al lavaggio [?]', next_steps: 'Rifare B6 e B7, poi PCR TEF-1α',
      tags: ['CTAB', 'Fusarium', 'DNA'], doubts: ['B7 pellet perso [?]', '1,79'] } };
  }
  async recognize(images, provider) {
    await new Promise((r) => setTimeout(r, 1200));
    this.aiUsed = (this.aiUsed || 0) + images.length;
    return { provider, used: this.aiUsed, limit: 30, demo: true, result: {
      description: 'Colonia di 7 giorni su PDA, micelio aereo cotonoso da bianco a rosa, rovescio rosso carminio. Nessuna foto al microscopio.',
      traits: { colore: ['bianco', 'rosa'], rovescio: ['rosso'], aspetto: ['cotonoso'], crescita: ['rapida'] },
      candidates: [
        { name: 'Fusarium (complesso di F. graminearum)', confidence: 'media', why: 'Crescita rapida, micelio cotonoso rosa e rovescio rosso carminio sono tipici.', against: '', confirm: 'su CLA guarda i macroconidi dagli sporodochi e sequenzia TEF1-α' },
        { name: 'Fusarium culmorum', confidence: 'bassa', why: 'Anche lui fa il rovescio rosso.', against: 'di solito il micelio è più rosso bruno o ocra', confirm: 'macroconidi corti e tozzi su CLA' },
        { name: 'Epicoccum nigrum', confidence: 'bassa', why: 'Può dare pigmenti rossi diffusi.', against: 'mancano gli sporodochi neri', confirm: 'conidi tondi verrucosi al microscopio' },
      ],
      next_steps: 'Trapianta su CLA e SNA a luce alternata per 10 giorni, poi guarda i macroconidi. Per la specie sequenzia TEF1-α.',
      quality: 'Manca la foto al microscopio.' } };
  }
  async deleteProject(id) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const x = (this.db.projects || []).find((y) => y.id === id);
    if (!x || (x.created_by !== this.uid && me?.role !== 'admin')) throw new Error('Lo elimina chi l\'ha creato o un amministratore');
    this.db.projects = this.db.projects.filter((y) => y.id !== id);
    for (const j of this.db.journal) if (j.project_id === id) j.project_id = null;
    for (const r of this.db.protocol_runs) if (r.project_id === id) r.project_id = null;
    this.persist();
  }

  // ---- sequenziamento: flow cell
  fcSync(fid) {
    const f = this.db.flowcells.find((x) => x.id === fid);
    if (!f) return null;
    const last = this.db.fc_checks.filter((c) => c.flowcell_id === fid).sort((a, b) => b.checked_at.localeCompare(a.checked_at) || b.id - a.id)[0];
    Object.assign(f, { pores: last?.pores ?? null, checked_at: last?.checked_at ?? null, checked_by: last?.user_id ?? null });
    return f;
  }

  async addFlowcells(rows, checkAt = null) {
    const have = new Set(this.db.flowcells.map((f) => f.code));
    const dup = rows.filter((r) => have.has(r.code)).map((r) => r.code);
    if (dup.length) throw new Error(dup.length === 1 ? `${dup[0]} è già registrata` : `Sono già registrate ${dup.join(', ')}`);
    const now = new Date().toISOString();
    const made = rows.map(({ pores, ...r }) => ({ kind: 'Flongle', batch: null, received_on: null, expiry: null, run_note: null, notes: null, status: 'disponibile', ...r, id: uuid(), pores: null, checked_at: null, checked_by: null, started_by: null, started_at: null, ended_by: null, ended_at: null, created_by: this.uid, created_at: now }));
    this.db.flowcells.push(...made);
    rows.forEach((r, k) => {
      if (r.pores == null) return;
      this.db.fc_checks.push({ id: Date.now() + k, flowcell_id: made[k].id, pores: r.pores, checked_at: checkAt || now, user_id: this.uid, note: null });
      this.fcSync(made[k].id);
    });
    this.persist();
    return clone(made);
  }

  async saveFlowcell(f) {
    const x = this.db.flowcells.find((y) => y.id === f.id);
    const { code, kind, batch, received_on, expiry, notes, run_note } = f;
    if (code && this.db.flowcells.some((y) => y.id !== f.id && y.code === code)) throw new Error('Esiste già (codice doppio)');
    Object.assign(x, { code, kind, batch, received_on, expiry, notes, run_note });
    this.persist();
    return clone(x);
  }

  async setFlowcellStatus(id, status, extra = {}) {
    const f = this.db.flowcells.find((x) => x.id === id);
    const now = new Date().toISOString();
    if (status !== f.status) {
      if (status === 'in_uso') Object.assign(f, { started_by: this.uid, started_at: now });
      if (status === 'usata' || status === 'scartata') Object.assign(f, { ended_by: this.uid, ended_at: now });
    }
    Object.assign(f, extra, { status });
    if (status === 'disponibile') Object.assign(f, { started_by: null, started_at: null });
    if (status === 'disponibile' || status === 'in_uso') Object.assign(f, { ended_by: null, ended_at: null });
    this.persist();
    return clone(f);
  }

  async addFlowcellCheck(id, pores, note = null, at = null) {
    this.db.fc_checks.push({ id: Date.now(), flowcell_id: id, pores, checked_at: at || new Date().toISOString(), user_id: this.uid, note });
    const f = this.fcSync(id);
    this.persist();
    return clone(f);
  }

  async flowcellChecks(id) {
    return clone(this.db.fc_checks.filter((c) => c.flowcell_id === id).sort((a, b) => b.checked_at.localeCompare(a.checked_at)));
  }

  async deleteFlowcellCheck(checkId, flowcellId) {
    const c = this.db.fc_checks.find((x) => x.id === checkId);
    if (!c || (c.user_id !== this.uid && this.db.profiles.find((p) => p.id === this.uid)?.role !== 'admin')) throw new Error('Puoi cancellare solo i tuoi check');
    this.db.fc_checks = this.db.fc_checks.filter((x) => x.id !== checkId);
    const f = this.fcSync(flowcellId);
    this.persist();
    return clone(f);
  }

  async deleteFlowcell(id) {
    this.db.flowcells = this.db.flowcells.filter((x) => x.id !== id);
    this.db.fc_checks = this.db.fc_checks.filter((c) => c.flowcell_id !== id);
    this.persist();
  }

  // ---- sequenziamento: kit a dosi e numeri delle etichette
  async useItem(id, n, note = null) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it || it.quantity == null) throw new Error('Articolo non trovato o senza quantità contata');
    if (!n) throw new Error('Quantità non valida');
    this.note = note ? String(note).trim().slice(0, 200) : null;
    try { return await this.saveItem({ id, quantity: Math.max(Number(it.quantity) - n, 0) }); } finally { this.note = null; }
  }

  async useBarcodes(id, codes, n = 1, note = null) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it) throw new Error('Articolo non trovato');
    if (!n) throw new Error('Quantità non valida');
    const b = it.barcodes;
    if (!b || !Array.isArray(b.left)) throw new Error('Per questo kit il conteggio dei barcode non è impostato');
    const list = [...new Set((codes || []).map(Number).filter((c) => Number.isInteger(c)))];
    if (!list.length) throw new Error('Scegli almeno un barcode');
    const left = b.left.slice();
    for (const c of list) {
      if (c < 1 || c > left.length) throw new Error(`Il barcode ${c} non c'è in questo kit`);
      const v = Number(left[c - 1] || 0) - n;
      if (v < 0) throw new Error(`Il barcode ${barcodeRanges(b.prefix, [c])} è finito`);
      left[c - 1] = v;
    }
    this.note = [barcodeRanges(b.prefix, list), note ? String(note).trim() : null].filter(Boolean).join(' · ').slice(0, 300);
    try { return await this.saveItem({ id, barcodes: { ...b, left } }); } finally { this.note = null; }
  }

  async recount(itemId, note, arrived = false) {
    const it = this.db.items.find((x) => x.id === itemId);
    const n = this.db.item_codes.filter((c) => c.item_id === itemId && !c.used_at).length;
    const patch = { id: itemId, quantity: n, numbered: true };
    if (arrived && it.status !== 'ok' && (it.min_quantity == null || n > Number(it.min_quantity))) patch.status = 'ok';
    this.note = note;
    try { return await this.saveItem(patch); } finally { this.note = null; }
  }

  async itemCodes(itemId) { return clone(this.db.item_codes.filter((c) => c.item_id === itemId)); }

  async addCodes(itemId, codes) {
    const clean = [...new Set(codes.map((c) => String(c).trim()).filter(Boolean))];
    if (!clean.length) throw new Error('Nessun numero da aggiungere');
    if (clean.length > 5000) throw new Error('Al massimo 5000 numeri alla volta');
    const have = new Set(this.db.item_codes.filter((c) => c.item_id === itemId).map((c) => c.code));
    const add = clean.filter((c) => !have.has(c));
    if (!add.length) throw new Error('Questi numeri sono già tutti registrati');
    const now = new Date().toISOString();
    this.db.item_codes.push(...add.map((code) => ({ id: uuid(), item_id: itemId, code, added_by: this.uid, added_at: now, used_by: null, used_at: null, note: null })));
    return this.recount(itemId, add.length === 1 ? `aggiunto n. ${codes[0].trim()}` : `aggiunti ${add.length} numeri, da ${codes[0].trim()} a ${codes.at(-1).trim()}`, true);
  }

  async removeCodes(itemId, codes) {
    const set = new Set(codes.map((c) => String(c).trim()));
    const before = this.db.item_codes.length;
    this.db.item_codes = this.db.item_codes.filter((c) => !(c.item_id === itemId && !c.used_at && set.has(c.code)));
    const removed = before - this.db.item_codes.length;
    if (!removed) throw new Error('Nessuno di questi numeri è tra quelli liberi');
    return this.recount(itemId, `tolti ${removed} numeri`);
  }

  async takeCode(itemId, code = null, note = null) {
    const free = this.db.item_codes.filter((c) => c.item_id === itemId && !c.used_at).sort((a, b) => a.code.length - b.code.length || (a.code < b.code ? -1 : 1));
    let c;
    if (code && String(code).trim()) {
      c = this.db.item_codes.find((x) => x.item_id === itemId && x.code === String(code).trim());
      if (!c) throw new Error(`Il numero ${String(code).trim()} non è tra quelli registrati`);
      if (c.used_at) throw new Error(`Il numero ${c.code} risulta già usato`);
    } else {
      c = free[0];
      if (!c) throw new Error('Non ci sono più numeri liberi');
    }
    const n = note && String(note).trim() ? String(note).trim().slice(0, 200) : null;
    Object.assign(c, { used_by: this.uid, used_at: new Date().toISOString(), note: n });
    const item = await this.recount(itemId, [`n. ${c.code}`, n].filter(Boolean).join(' · '));
    return { item, code: clone(c) };
  }

  async releaseCode(codeId) {
    const c = this.db.item_codes.find((x) => x.id === codeId);
    if (!c || !c.used_at) throw new Error('Non c\'è niente da annullare');
    const admin = this.db.profiles.find((p) => p.id === this.uid)?.role === 'admin';
    if (!admin && !(c.used_by === this.uid && Date.now() - new Date(c.used_at) < 15 * 60e3)) throw new Error('Puoi annullare solo un tuo uso degli ultimi 15 minuti');
    Object.assign(c, { used_by: null, used_at: null, note: null });
    return this.recount(c.item_id, `annullato n. ${c.code}`);
  }

  async itemLog(id) { return clone(this.db.item_log.filter((l) => l.item_id === id).reverse().slice(0, 15)); }

  async saveTask(t) {
    if (t.id) {
      const i = this.db.tasks.findIndex((x) => x.id === t.id);
      this.db.tasks[i] = { ...this.db.tasks[i], ...t };
      this.persist();
      return clone(this.db.tasks[i]);
    }
    const next = { notes: null, location: null, assigned_to: null, done: false, last_done_at: null, last_done_by: null, ...t, id: uuid(), created_by: this.uid, created_at: new Date().toISOString() };
    this.db.tasks.push(next);
    this.persist();
    return clone(next);
  }

  async deleteTask(id) { this.db.tasks = this.db.tasks.filter((x) => x.id !== id); this.persist(); }

  async completeTask(id, note = null) {
    const t = this.db.tasks.find((x) => x.id === id);
    const d = new Date(); const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.db.task_log.push({ id: Date.now(), task_id: id, user_id: this.uid, done_at: new Date().toISOString(), note, prev_due_on: t.due_on, prev_done: t.done, prev_last_at: t.last_done_at, prev_last_by: t.last_done_by });
    if (t.repeat_days) {
      const due = new Date(t.due_on + 'T12:00'), now = new Date(today + 'T12:00');
      const days = Math.round((now - due) / 86400e3);
      const add = days < 0 ? t.repeat_days : t.repeat_days * (Math.floor(days / t.repeat_days) + 1);
      due.setDate(due.getDate() + add);
      t.due_on = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
    } else t.done = true;
    t.last_done_at = new Date().toISOString(); t.last_done_by = this.uid;
    this.persist();
    return clone(t);
  }

  async undoTask(id) {
    const k = this.db.task_log.map((l) => l.task_id === id && l.user_id === this.uid).lastIndexOf(true);
    if (k < 0) throw new Error('Non c\'è niente da annullare');
    const l = this.db.task_log.splice(k, 1)[0];
    const t = this.db.tasks.find((x) => x.id === id);
    Object.assign(t, { due_on: l.prev_due_on, done: l.prev_done, last_done_at: l.prev_last_at, last_done_by: l.prev_last_by });
    this.persist();
    return clone(t);
  }

  async taskLog(id) { return clone(this.db.task_log.filter((l) => l.task_id === id).reverse().slice(0, 10)); }

  async saveIssue(i) {
    if (i.id) {
      const k = this.db.issues.findIndex((x) => x.id === i.id);
      this.db.issues[k] = { ...this.db.issues[k], ...i };
      this.persist();
      return clone(this.db.issues[k]);
    }
    const next = { description: null, location: null, urgency: 'normale', photos: [], kind: 'problema', incident_type: null, happened_at: null, involved: null, item_id: null, instrument_id: null, actions: null,
      ...i, id: uuid(), status: 'aperto', created_by: this.uid, created_at: new Date().toISOString(), taken_by: null, resolved_by: null, resolved_at: null };
    this.db.issues.push(next);
    this.persist();
    return { ...clone(next), comments: 0 };
  }

  async incidents() { return clone(this.db.issues.filter((x) => x.kind === 'incidente')).sort((a, b) => (b.happened_at || b.created_at).localeCompare(a.happened_at || a.created_at)); }

  async setIssueStatus(id, status) {
    const i = this.db.issues.find((x) => x.id === id);
    i.status = status;
    i.taken_by = status === 'in_corso' ? this.uid : status === 'aperto' ? null : i.taken_by;
    i.resolved_by = status === 'risolto' ? this.uid : null;
    i.resolved_at = status === 'risolto' ? new Date().toISOString() : null;
    this.persist();
    return clone(i);
  }

  async deleteIssue(issue) {
    this.db.issues = this.db.issues.filter((x) => x.id !== issue.id);
    this.db.comments = this.db.comments.filter((c) => c.issue_id !== issue.id);
    for (const p of issue.photos || []) delete this.db.photos[p];
    this.persist();
  }

  async issueComments(id) { return clone(this.db.comments.filter((c) => c.issue_id === id)); }

  async addComment(issueId, body) {
    const c = { id: Date.now(), issue_id: issueId, user_id: this.uid, body, created_at: new Date().toISOString() };
    this.db.comments.push(c);
    this.persist();
    return clone(c);
  }

  async deleteComment(id) { this.db.comments = this.db.comments.filter((c) => c.id !== id); this.persist(); }

  async removePhotos(paths) { for (const p of paths || []) delete this.db.photos[p]; this.persist(); }

  async seqs() { return clone(this.db.strain_seqs || []); }
  async saveSeq(x) {
    if (!/^[ACGTURYKMSWBDHVN*-]+$/.test(x.seq || '')) throw new Error('La sequenza ha caratteri che non sono basi');
    const list = (this.db.strain_seqs ||= []);
    if (x.id) { const o = list.find((y) => y.id === x.id); Object.assign(o, { locus: x.locus, header: x.header ?? null, seq: x.seq, accession: x.accession ?? null, note: x.note ?? null }); this.persist(); return clone(o); }
    const row = { id: uuid(), strain_id: x.strain_id, locus: x.locus, header: x.header ?? null, seq: x.seq, accession: x.accession ?? null, note: x.note ?? null, created_by: this.uid, created_at: new Date().toISOString() };
    list.push(row); this.persist(); return clone(row);
  }
  async deleteSeq(id) { this.db.strain_seqs = (this.db.strain_seqs || []).filter((y) => y.id !== id); this.persist(); }

  async docs() { return clone((this.db.docs || []).slice().sort((a, b) => b.created_at.localeCompare(a.created_at))); }
  async saveDoc(d) {
    const list = (this.db.docs ||= []), now = new Date().toISOString();
    const f = {};
    for (const k of ['kind', 'title', 'authors', 'journal', 'year', 'doi', 'url', 'path', 'file_name', 'mime', 'size', 'note', 'links', 'abstract', 'pdf_url', 'license']) if (d[k] !== undefined) f[k] = d[k];
    if (!String(f.title ?? (list.find((y) => y.id === d.id) || {}).title ?? '').trim()) throw new Error('Serve un titolo');
    if (d.id) { const o = list.find((y) => y.id === d.id); Object.assign(o, f, { updated_at: now }); this.persist(); return clone(o); }
    const row = { id: uuid(), kind: 'risultati', authors: null, journal: null, year: null, doi: null, url: null, path: null, file_name: null, mime: null, size: null, note: null, links: [], ...f, created_by: this.uid, created_at: now, updated_at: now };
    list.push(row); this.persist(); return clone(row);
  }
  async deleteDoc(d) { this.db.docs = (this.db.docs || []).filter((y) => y.id !== d.id); if (d.path) delete (this.db.files || {})[d.path]; this.persist(); }
  async uploadDoc(file) {
    if (file.size > 3e6) throw new Error('Nella prova i file stanno sul telefono: al massimo 3 MB');
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const path = `${uuid()}/${String(file.name || 'file').replace(/[^\w.-]+/g, '_')}`;
    (this.db.files ||= {})[path] = data; this.persist(); return path;
  }
  async removeDocFile(path) { if (this.db.files) { delete this.db.files[path]; this.persist(); } }
  async labAuthors() { return clone(this.db.lab_authors || []); }
  async saveLabAuthor(a) {
    const list = (this.db.lab_authors ||= []);
    if (a.id) { const o = list.find((y) => y.id === a.id); Object.assign(o, { full_name: a.full_name, orcids: a.orcids, active: a.active !== false }); this.persist(); return clone(o); }
    if (list.some((y) => y.full_name.trim().toLowerCase() === a.full_name.trim().toLowerCase())) throw new Error('C\'è già');
    const row = { id: uuid(), full_name: a.full_name, orcids: a.orcids || [], active: a.active !== false, last_checked_at: null, last_found: null, created_by: this.uid, created_at: new Date().toISOString() };
    list.push(row); this.persist(); return clone(row);
  }
  async deleteLabAuthor(id) { this.db.lab_authors = (this.db.lab_authors || []).filter((y) => y.id !== id); this.persist(); }
  async checkPapers() { await new Promise((r) => setTimeout(r, 600)); return { demo: true, nuovi: [], completati: 0 }; }
  async docUrl(path) { const u = (this.db.files || {})[path]; if (!u) throw new Error('File non trovato'); return u; }

  async savePrefs(uid, prefs) { const p = this.db.profiles.find((x) => x.id === uid); p.prefs = prefs; this.persist(); return clone(p); }

  async uploadPhoto(blob, folder = 'problemi') {
    const data = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
    const path = `${folder}/${uuid()}.jpg`;
    this.db.photos[path] = data;
    this.persist();
    return path;
  }

  async photoUrls(paths) { return Object.fromEntries(paths.filter((p) => this.db.photos[p]).map((p) => [p, this.db.photos[p]])); }
  // ---- giro 27
  async dupOk() { return clone(this.db.dup_ok || []); }
  async addDupOk(pairs) { this.db.dup_ok = this.db.dup_ok || []; for (const p of pairs) if (!this.db.dup_ok.some((x) => x.a === p.a && x.b === p.b)) this.db.dup_ok.push({ a: p.a, b: p.b }); this.persist(); }
  async mergeItems(keep, drop) {
    const k = this.db.items.find((x) => x.id === keep);
    if (!k) throw new Error('L\'articolo da tenere non c\'è più');
    for (const d of drop) {
      const o = this.db.items.find((x) => x.id === d);
      if (!o || d === keep) continue;
      for (const l of this.db.item_log) if (l.item_id === d) l.item_id = keep;
      for (const sl of this.db.slots || []) if (sl.item_id === d) sl.item_id = keep;
      for (const r of this.db.protocol_runs || []) for (const g of r.reagents || []) if (g.item_id === d) g.item_id = keep;
      for (const j of this.db.journal || []) { for (const m of j.materials || []) if (m.item_id === d) m.item_id = keep; for (const l of j.links || []) if (l.t === 'item' && l.id === d) l.id = keep; }
      for (const pr of this.db.profiles) { const f = pr.prefs?.favorites; if (Array.isArray(f)) pr.prefs.favorites = f.map((x) => (x.t === 'item' && x.id === d ? { ...x, id: keep } : x)).filter((x, i, a) => a.findIndex((y) => y.t === x.t && y.id === x.id) === i); }
      for (const it of this.db.items) if (it.parent_id === d) it.parent_id = keep;
      this.db.item_log.push({ id: (this.db.item_log.at(-1)?.id || 0) + 1, item_id: keep, user_id: this.uid, action: 'unito', delta: null, quantity: k.quantity ?? null, note: `con ${o.name}${o.location ? ` (${o.location})` : ''}`, at: new Date().toISOString() });
      this.db.items = this.db.items.filter((x) => x.id !== d);
      this.db.dup_ok = (this.db.dup_ok || []).filter((x) => x.a !== d && x.b !== d);
    }
    this.persist();
    return clone(k);
  }
  async calendarToken(reset = false) {
    if (reset || !this.db.cal_token) { this.db.cal_token = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join(''); this.persist(); }
    return this.db.cal_token;
  }
  calendarUrl(token) { return `https://il-tuo-progetto.supabase.co/functions/v1/notify?ical=${token}`; }
  async labSetting(key) { return clone((this.db.lab_settings || {})[key] ?? null); }
  async saveLabSetting(key, value) { this.db.lab_settings = { ...(this.db.lab_settings || {}), [key]: clone(value) }; this.persist(); }
  async onboardings() { return clone(this.db.onboarding || []); }
  async addOnboarding(row) {
    this.db.onboarding = this.db.onboarding || [];
    if (this.db.onboarding.some((x) => x.user_id === row.user_id)) throw new Error('Per questa persona la lista c\'è già');
    const x = { tutor_id: null, started_on: new Date().toISOString().slice(0, 10), items: [], note: null, done_at: null, created_by: this.uid, ...clone(row), updated_at: new Date().toISOString() };
    this.db.onboarding.push(x); this.persist(); return clone(x);
  }
  async saveOnboarding(uid, patch) {
    const x = (this.db.onboarding || []).find((y) => y.user_id === uid);
    if (!x) throw new Error('Lista non trovata');
    Object.assign(x, clone(patch), { updated_at: new Date().toISOString() }); this.persist(); return clone(x);
  }
  async deleteOnboarding(uid) { this.db.onboarding = (this.db.onboarding || []).filter((x) => x.user_id !== uid); this.persist(); }
  // ---- giro 28
  async primers() { return clone((this.db.primers || []).slice().sort((a, b) => a.name.localeCompare(b.name))); }
  async primerPairs() { return clone(this.db.primer_pairs || []); }
  async savePrimer(x) {
    this.db.primers = this.db.primers || [];
    const seq = String(x.seq || '').toUpperCase().replace(/[^A-Z]/g, '').replace(/U/g, 'T');
    if (!/^[ACGTRYKMSWBDHVNI]{6,200}$/.test(seq)) throw new Error('La sequenza deve avere da 6 a 200 basi');
    const name = String(x.name || '').trim();
    if (this.db.primers.some((p) => p.id !== x.id && p.name.toUpperCase() === name.toUpperCase())) throw new Error(`C'è già un primer che si chiama ${name}`);
    const f = { name, seq, direction: x.direction || null, locus: x.locus || null, target: x.target || null, ref: x.ref || null, doi: x.doi || null, notes: x.notes || null };
    const now = new Date().toISOString();
    if (x.id) { const p = this.db.primers.find((y) => y.id === x.id); Object.assign(p, f, { updated_at: now, updated_by: this.uid }); this.persist(); return clone(p); }
    const p = { ...f, id: uuid(), created_by: this.uid, created_at: now, updated_by: this.uid, updated_at: now };
    this.db.primers.push(p); this.persist(); return clone(p);
  }
  async deletePrimer(id) { this.db.primers = (this.db.primers || []).filter((p) => p.id !== id); this.db.primer_pairs = (this.db.primer_pairs || []).filter((p) => p.fwd_id !== id && p.rev_id !== id); this.persist(); }
  async savePair(x) {
    this.db.primer_pairs = this.db.primer_pairs || [];
    if (x.fwd_id === x.rev_id) throw new Error('Scegli due primer diversi');
    if (this.db.primer_pairs.some((p) => p.id !== x.id && p.fwd_id === x.fwd_id && p.rev_id === x.rev_id)) throw new Error('Questa coppia c\'è già');
    const f = { fwd_id: x.fwd_id, rev_id: x.rev_id, name: x.name || null, locus: x.locus || null, size_bp: x.size_bp || null, polymerase: x.polymerase || null, notes: x.notes || null };
    if (x.id) { const p = this.db.primer_pairs.find((y) => y.id === x.id); Object.assign(p, f); this.persist(); return clone(p); }
    const p = { ...f, id: uuid(), created_by: this.uid, created_at: new Date().toISOString() };
    this.db.primer_pairs.push(p); this.persist(); return clone(p);
  }
  async deletePair(id) { this.db.primer_pairs = (this.db.primer_pairs || []).filter((p) => p.id !== id); this.persist(); }

  async storageUsage() {
    const ph = Object.values(this.db.photos || {}), fb = ph.reduce((t, d) => t + Math.round(String(d).length * 0.75), 0);
    const docs = (this.db.docs || []).filter((d) => d.size), db = JSON.stringify({ ...this.db, photos: undefined }).length;
    const dbytes = docs.reduce((t, d) => t + Number(d.size || 0), 0);
    return { foto: { n: ph.length, bytes: fb }, documenti: { n: docs.length, bytes: dbytes }, files: fb + dbytes, db, backups: 0 };
  }

  async bookingsBetween(from, to) {
    return clone(this.db.bookings.filter((b) => b.starts_at < to && b.ends_at > from)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }

  async saveItem(item) {
    if (item.id) {
      const i = this.db.items.findIndex((x) => x.id === item.id);
      const prev = this.db.items[i];
      const next = applyItemRules(prev, { ...prev, ...item }, this.uid);
      this.db.items[i] = next;
      const dq = next.quantity !== prev.quantity ? Number(next.quantity || 0) - Number(prev.quantity || 0) : null;
      if (next.status !== prev.status) {
        const why = next.status === 'da_ordinare' ? next.flag_note || (next.flag_reason === 'sotto_scorta' ? 'sotto scorta' : null) : null;
        this.log(next, next.status === 'da_ordinare' ? 'segnalato' : next.status === 'ordinato' ? 'ordinato' : 'arrivato', { delta: dq, note: [this.note, why].filter(Boolean).join(' · ') || null });
      } else if (dq !== null) this.log(next, 'quantita', { delta: dq, note: this.note || null });
      else if (JSON.stringify(next.barcodes ?? null) !== JSON.stringify(prev.barcodes ?? null)) {
        const sum = (b) => (b?.left || []).reduce((s, x) => s + Number(x || 0), 0);
        this.log(next, 'barcode', { quantity: null, delta: prev.barcodes && next.barcodes ? sum(next.barcodes) - sum(prev.barcodes) : null, note: this.note || (next.barcodes ? null : 'conteggio tolto') });
      } else if (['name', 'location', 'min_quantity', 'expiry', 'lot', 'category', 'pack_size'].some((k) => next[k] !== prev[k])) this.log(next, 'modificato', { quantity: null });
      if (next.sample_state && next.sample_state !== prev.sample_state) {
        const st = next.state_on && next.state_on !== localDay() ? ` · il ${next.state_on.split('-').reverse().join('/')}` : '';
        this.log(next, 'lavorazione', { quantity: null, note: `${next.sample_state}${st}` });
      }
      this.persist();
      return clone(next);
    }
    const next = applyItemRules(null, {
      status: 'ok', unit: 'pz', flag_reason: null, flag_note: null, hazards: [], ...item,
      id: uuid(), created_by: this.uid, created_at: new Date().toISOString(),
    }, this.uid);
    this.db.items.push(next);
    this.log(next, 'creato');
    this.persist();
    return clone(next);
  }

  async patchItem(id, patch) { return this.saveItem({ ...patch, id }); }

  async importItems(rows) {
    const now = new Date().toISOString();
    for (const r of rows) {
      this.db.items.push(applyItemRules(null, { status: 'ok', unit: 'pz', flag_reason: null, flag_note: null, ...r, id: uuid(), created_by: this.uid, created_at: now }, this.uid));
    }
    this.persist();
  }

  async adjust(id, delta) {
    const it = this.db.items.find((x) => x.id === id);
    if (!it) throw new Error('Articolo non trovato');
    return this.saveItem({ id, quantity: Math.max(Number(it.quantity || 0) + delta, 0) });
  }

  async deleteItem(id) { this.db.items = this.db.items.filter((x) => x.id !== id); this.persist(); }

  async saveInstrument(inst) {
    if (inst.id) {
      const i = this.db.instruments.findIndex((x) => x.id === inst.id);
      this.db.instruments[i] = { ...this.db.instruments[i], ...inst };
      this.persist();
      return clone(this.db.instruments[i]);
    }
    const next = { active: true, ...inst, id: uuid(), created_at: new Date().toISOString() };
    this.db.instruments.push(next);
    this.persist();
    return clone(next);
  }

  async deleteInstrument(id) {
    this.db.instruments = this.db.instruments.filter((x) => x.id !== id);
    this.db.bookings = this.db.bookings.filter((b) => b.instrument_id !== id);
    this.persist();
  }

  async createBooking(b) {
    if (!(b.ends_at > b.starts_at) || new Date(b.ends_at) - new Date(b.starts_at) > 7 * 24 * 3600e3) {
      throw new Error('Controlla i valori inseriti (la fine deve venire dopo l\'inizio, massimo 7 giorni)');
    }
    const clash = this.db.bookings.some((x) => x.instrument_id === b.instrument_id && x.starts_at < b.ends_at && x.ends_at > b.starts_at);
    if (clash) throw new Error('Lo strumento è già prenotato in quella fascia oraria');
    const next = { ...b, id: uuid(), user_id: this.uid, created_at: new Date().toISOString() };
    this.db.bookings.push(next);
    this.persist();
    return clone(next);
  }

  async deleteBooking(id) { this.db.bookings = this.db.bookings.filter((x) => x.id !== id); this.persist(); }

  async savePractical(p) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const old = p.id ? this.db.practicals.find((x) => x.id === p.id) : null;
    if (p.id && !old) throw new Error('Esercitazione non trovata');
    if (old && old.created_by !== this.uid && me?.role !== 'admin') throw new Error('La può modificare solo chi l\'ha segnata o un amministratore');
    if (!String(p.title || '').trim()) throw new Error('Scrivi il titolo');
    if (!(p.ends_at > p.starts_at) || new Date(p.ends_at) - new Date(p.starts_at) > 14 * 3600e3) throw new Error('Controlla l\'orario (al massimo 14 ore)');
    const ids = [...new Set(p.instrument_ids || [])];
    for (const i of ids) {
      const c = this.db.bookings.find((b) => b.instrument_id === i && (!old || b.practical_id !== old.id) && b.starts_at < p.ends_at && b.ends_at > p.starts_at);
      if (c) {
        const nm = this.db.instruments.find((x) => x.id === i)?.name || 'Uno strumento';
        const who = this.db.profiles.find((x) => x.id === c.user_id)?.full_name;
        throw new Error(`${nm}: c'è già una prenotazione${who ? ` di ${who}` : ''} in quell'orario`);
      }
    }
    const trim = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());
    const fields = { title: String(p.title).trim(), course: trim(p.course), teacher: trim(p.teacher), room: trim(p.room), starts_at: p.starts_at, ends_at: p.ends_at,
      students: p.students === '' || p.students == null ? null : Number(p.students), instrument_ids: ids, note: trim(p.note) };
    let row;
    if (old) {
      const moved = old.starts_at !== fields.starts_at || old.ends_at !== fields.ends_at || old.room !== fields.room;
      Object.assign(old, fields, moved ? { moved: true, notified_at: null, reminded_at: null } : {});
      row = old;
      this.db.bookings = this.db.bookings.filter((b) => b.practical_id !== old.id);
    } else {
      row = { id: uuid(), ...fields, created_by: this.uid, created_at: new Date().toISOString(), notified_at: null, reminded_at: null, moved: false };
      this.db.practicals.push(row);
    }
    for (const i of ids) this.db.bookings.push({ id: uuid(), instrument_id: i, user_id: this.uid, starts_at: row.starts_at, ends_at: row.ends_at, note: `Esercitazione: ${row.title}`, practical_id: row.id, created_at: new Date().toISOString() });
    this.persist();
    return clone(row);
  }

  async deletePractical(id) {
    const me = this.db.profiles.find((x) => x.id === this.uid);
    const old = this.db.practicals.find((x) => x.id === id);
    if (!old || (old.created_by !== this.uid && me?.role !== 'admin')) throw new Error('La può eliminare solo chi l\'ha segnata o un amministratore');
    this.db.practicals = this.db.practicals.filter((x) => x.id !== id);
    this.db.bookings = this.db.bookings.filter((b) => b.practical_id !== id);
    this.persist();
  }

  async setRole(id, role) {
    const p = this.db.profiles.find((x) => x.id === id);
    if (role !== 'admin' && p.role === 'admin' && this.db.profiles.filter((x) => x.role === 'admin').length === 1) {
      throw new Error('Serve almeno un amministratore');
    }
    p.role = role;
    this.persist();
  }

  async removeMember(id) {
    if (id === this.uid) throw new Error('Non puoi rimuovere te stesso');
    this.db.profiles = this.db.profiles.filter((x) => x.id !== id);
    this.persist();
  }

  async updateMyName(uid, name) {
    const p = this.db.profiles.find((x) => x.id === uid);
    p.full_name = name;
    this.persist();
    return clone(p);
  }

  async savePushSubscription() { throw new Error('In modalità prova le notifiche non sono attive'); }
  async deletePushSubscription() {}
  async notify() { return { sent: 0 }; }
}
