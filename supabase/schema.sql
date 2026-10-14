-- =====================================================================
--  LabApp: inventario del laboratorio e prenotazione strumenti
--  Incollare tutto in Supabase > SQL Editor > New query e premere Run.
--  Si può rieseguire quando esce una versione nuova: aggiunge tabelle e
--  colonne mancanti e aggiorna le regole senza toccare i dati già inseriti.
-- =====================================================================

create extension if not exists btree_gist with schema extensions;

-- ---------------------------------------------------------------------
--  Profili. Il primo che si registra diventa amministratore,
--  tutti gli altri restano "in attesa" finché un amministratore li approva.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  role        text not null default 'pending' check (role in ('pending', 'member', 'admin')),
  created_at  timestamptz not null default now()
);
-- giro 54: lo sviluppatore (il primo che si è registrato) gestisce gli accessi; chi lascia il laboratorio
-- torna "in attesa" con la data di uscita, così i suoi dati (diario compreso) restano
alter table public.profiles add column if not exists developer boolean not null default false;
alter table public.profiles add column if not exists left_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role, developer)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    new.email,
    case when exists (select 1 from public.profiles where role = 'admin') then 'pending' else 'admin' end,
    not exists (select 1 from public.profiles where role = 'admin' or developer)
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('member', 'admin')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- giro 54: lo sviluppatore dell'app, l'unico che gestisce gli accessi
create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and developer and role = 'admin'
  );
$$;

-- Approva, promuove o declassa un utente (giro 54: solo lo sviluppatore). Rimettere "in attesa" chi era membro
-- vuol dire togliergli l'accesso: i suoi dati restano e si segna quando è uscito
create or replace function public.set_member_role(target uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer() then
    raise exception 'Gli accessi li gestisce solo lo sviluppatore dell''app';
  end if;
  if new_role not in ('pending', 'member', 'admin') then
    raise exception 'Ruolo non valido';
  end if;
  if target = auth.uid() and new_role <> 'admin' then
    raise exception 'Lo sviluppatore resta amministratore';
  end if;
  if new_role <> 'admin'
     and exists (select 1 from public.profiles where id = target and role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') = 1 then
    raise exception 'Serve almeno un amministratore';
  end if;
  update public.profiles
     set left_at = case when new_role <> 'pending' then null when role <> 'pending' then now() else left_at end,
         role = new_role
   where id = target;
end;
$$;

-- Toglie l'accesso a un utente e cancella il suo account (solo amministratori).
create or replace function public.remove_member(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_developer() then
    raise exception 'Gli accessi li gestisce solo lo sviluppatore dell''app';
  end if;
  if target = auth.uid() then
    raise exception 'Non puoi rimuovere te stesso';
  end if;
  delete from auth.users where id = target;
end;
$$;

-- ---------------------------------------------------------------------
--  Inventario
--  status: ok | da_ordinare | ordinato
--  Se quantità <= soglia minima l'articolo passa da solo a "da_ordinare".
-- ---------------------------------------------------------------------
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (length(trim(name)) > 0),
  category      text not null default 'consumabili',
  quantity      numeric check (quantity is null or quantity >= 0),
  unit          text not null default 'pz',
  min_quantity  numeric check (min_quantity is null or min_quantity >= 0),
  location      text,
  supplier      text,
  catalog_no    text,
  lot           text,
  expiry        date,
  notes         text,
  sds_url       text,
  hazards       text[] not null default '{}',
  pack_size     numeric check (pack_size is null or pack_size > 0),
  numbered      boolean not null default false,
  status        text not null default 'ok' check (status in ('ok', 'da_ordinare', 'ordinato')),
  flag_reason   text check (flag_reason in ('sotto_scorta', 'segnalato')),
  flag_note     text,
  flagged_by    uuid references public.profiles (id) on delete set null,
  flagged_at    timestamptz,
  ordered_by    uuid references public.profiles (id) on delete set null,
  ordered_at    timestamptz,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);

-- Colonne arrivate con le versioni successive (servono a chi aggiorna)
alter table public.items
  add column if not exists location     text,
  add column if not exists supplier     text,
  add column if not exists catalog_no   text,
  add column if not exists lot          text,
  add column if not exists expiry       date,
  add column if not exists notes        text,
  add column if not exists sds_url      text,
  add column if not exists hazards      text[] not null default '{}',
  add column if not exists sds          jsonb,
  add column if not exists arrived_at   timestamptz,
  add column if not exists arrived_by   uuid references public.profiles (id) on delete set null,
  add column if not exists flag_note    text,
  add column if not exists pack_size    numeric check (pack_size is null or pack_size > 0),
  add column if not exists numbered     boolean not null default false,
  add column if not exists opened_on    date,
  add column if not exists open_days    int check (open_days is null or open_days between 1 and 3650),
  add column if not exists photos       text[] not null default '{}',
  -- kit con barcode (Nanopore): {"prefix": "RB", "per": 15, "left": [15, 15, ...]}, aliquote rimaste per barcode
  add column if not exists barcodes     jsonb check (barcodes is null or (jsonb_typeof(barcodes) = 'object' and jsonb_typeof(barcodes -> 'left') = 'array'));

-- Standard analitici (ottobre 2026): concentrazione della confezione, peso molecolare e ionizzazione,
-- per calcolare quanto standard interno mettere in ppb o in µM
alter table public.items
  add column if not exists conc       numeric check (conc is null or conc > 0),
  add column if not exists conc_unit  text check (conc_unit is null or conc_unit in ('mg/mL', 'µg/mL', 'ng/mL', 'mM', 'µM', 'nM')),
  add column if not exists mw         numeric check (mw is null or (mw > 0 and mw < 100000)),
  add column if not exists ion_mode   text check (ion_mode is null or ion_mode in ('pos', 'neg', 'entrambe'));

-- Campioni di piante e altro (ottobre 2026): una scheda da collezione, non da magazzino
alter table public.items
  add column if not exists sample_type   text check (sample_type is null or sample_type in ('pianta', 'semi', 'estratto', 'acidi_nucleici', 'suolo', 'beni_culturali', 'altro')),
  add column if not exists species       text check (species is null or length(species) <= 120),
  add column if not exists origin        text check (origin is null or length(origin) <= 160),
  add column if not exists collected_on  date,
  add column if not exists project       text check (project is null or length(project) <= 120);
-- Campioni (ottobre 2026, giro 21): lo stato (fresco, congelato, liofilizzato, essiccato, macinato, interi per i semi, buttato) con la data,
-- da dove vengono (commerciali, campo, serra, cella di crescita) e da quale campione derivano (un macinato, un estratto)
alter table public.items
  add column if not exists sample_state  text check (sample_state is null or sample_state in ('fresco', 'congelato', 'liofilizzato', 'essiccato', 'macinato', 'intero', 'buttato')),
  add column if not exists state_on      date,
  add column if not exists source_kind   text check (source_kind is null or source_kind in ('commerciale', 'campo', 'serra', 'cella')),
  add column if not exists parent_id     uuid references public.items (id) on delete set null;
create index if not exists items_parent_idx on public.items (parent_id) where parent_id is not null;

create index if not exists items_category_idx on public.items (category);
create index if not exists items_status_idx on public.items (status);

-- Registro delle segnalazioni: ogni volta che un articolo diventa "da ordinare".
create table if not exists public.alerts (
  id           bigint generated always as identity primary key,
  item_id      uuid not null references public.items (id) on delete cascade,
  reason       text,
  note         text,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  notified_at  timestamptz
);

create index if not exists alerts_pending_idx on public.alerts (created_at) where notified_at is null;

-- Storico movimenti di ogni articolo (scritto solo dai trigger).
create table if not exists public.item_log (
  id        bigint generated always as identity primary key,
  item_id   uuid not null references public.items (id) on delete cascade,
  user_id   uuid references public.profiles (id) on delete set null,
  action    text not null check (action in ('creato', 'quantita', 'segnalato', 'ordinato', 'arrivato', 'modificato', 'barcode')),
  delta     numeric,
  quantity  numeric,
  note      text,
  at        timestamptz not null default now()
);

create index if not exists item_log_item_idx on public.item_log (item_id, at desc);

-- "barcode": aliquote dei barcode dei kit (ottobre 2026), serve a chi aggiorna
alter table public.item_log drop constraint if exists item_log_action_check;
alter table public.item_log add constraint item_log_action_check
  check (action in ('creato', 'quantita', 'segnalato', 'ordinato', 'arrivato', 'modificato', 'barcode', 'lavorazione', 'unito'));

create or replace function public.items_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);

  -- "uso comune" è confluito nei consumabili (anche se arriva da un telefono non aggiornato)
  if new.category = 'comune' then
    new.category := 'consumabili';
  end if;

  -- torna disponibile dopo un ordine o una segnalazione: è arrivato
  if new.status = 'ok' and tg_op = 'UPDATE' and old.status in ('da_ordinare', 'ordinato') then
    new.arrived_at := now();
    new.arrived_by := auth.uid();
  end if;

  if new.status = 'ok' then
    new.flag_reason := null;
    new.flag_note   := null;
    new.flagged_by  := null;
    new.flagged_at  := null;
    new.ordered_by  := null;
    new.ordered_at  := null;
  end if;

  if new.status = 'ok'
     and new.quantity is not null
     and new.min_quantity is not null
     and new.quantity <= new.min_quantity
     and (tg_op = 'INSERT'
          or new.quantity is distinct from old.quantity
          or new.min_quantity is distinct from old.min_quantity) then
    new.status      := 'da_ordinare';
    new.flag_reason := 'sotto_scorta';
  end if;

  if new.status = 'da_ordinare' and (tg_op = 'INSERT' or old.status <> 'da_ordinare') then
    new.flagged_at  := now();
    new.flagged_by  := auth.uid();
    new.flag_reason := coalesce(new.flag_reason, 'segnalato');
  end if;

  if new.status = 'ordinato' and (tg_op = 'INSERT' or old.status <> 'ordinato') then
    new.ordered_at := now();
    new.ordered_by := auth.uid();
  end if;

  return new;
end;
$$;

create or replace trigger items_before_write
  before insert or update on public.items
  for each row execute function public.items_before_write();

-- "uso comune" confluito nei consumabili (4 ottobre 2026)
alter table public.items alter column category set default 'consumabili';
update public.items set category = 'consumabili' where category = 'comune';

create or replace function public.items_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- nota facoltativa lasciata da use_item e dalle etichette numerate (per cosa è stato usato)
  v_note text := nullif(current_setting('labapp.note', true), '');
begin
  if new.status = 'da_ordinare' and (tg_op = 'INSERT' or old.status = 'ok') then
    insert into public.alerts (item_id, reason, note, created_by)
    values (new.id, new.flag_reason, new.flag_note, auth.uid());
  end if;

  if tg_op = 'INSERT' then
    insert into public.item_log (item_id, user_id, action, quantity)
    values (new.id, auth.uid(), 'creato', new.quantity);
  elsif new.status is distinct from old.status then
    insert into public.item_log (item_id, user_id, action, delta, quantity, note)
    values (new.id, auth.uid(),
            case new.status when 'da_ordinare' then 'segnalato' when 'ordinato' then 'ordinato' else 'arrivato' end,
            case when new.quantity is distinct from old.quantity then coalesce(new.quantity, 0) - coalesce(old.quantity, 0) end,
            new.quantity,
            case when new.status = 'da_ordinare'
                 then nullif(concat_ws(' · ', v_note, coalesce(new.flag_note, case new.flag_reason when 'sotto_scorta' then 'sotto scorta' end)), '')
                 else v_note end);
  elsif new.quantity is distinct from old.quantity then
    insert into public.item_log (item_id, user_id, action, delta, quantity, note)
    values (new.id, auth.uid(), 'quantita', coalesce(new.quantity, 0) - coalesce(old.quantity, 0), new.quantity, v_note);
  elsif new.opened_on is not null and new.opened_on is distinct from old.opened_on then
    insert into public.item_log (item_id, user_id, action, note)
    values (new.id, auth.uid(), 'modificato', 'aperta una confezione nuova');
  elsif new.barcodes is distinct from old.barcodes then
    insert into public.item_log (item_id, user_id, action, delta, note)
    values (new.id, auth.uid(), 'barcode',
            case when old.barcodes is not null and new.barcodes is not null then
              (select coalesce(sum(x::numeric), 0) from jsonb_array_elements_text(new.barcodes -> 'left') x)
              - (select coalesce(sum(x::numeric), 0) from jsonb_array_elements_text(old.barcodes -> 'left') x) end,
            coalesce(v_note, case when new.barcodes is null then 'conteggio tolto' end));
  elsif (new.name, new.location, new.min_quantity, new.expiry, new.lot, new.category, new.pack_size, new.open_days)
        is distinct from (old.name, old.location, old.min_quantity, old.expiry, old.lot, old.category, old.pack_size, old.open_days) then
    insert into public.item_log (item_id, user_id, action)
    values (new.id, auth.uid(), 'modificato');
  end if;
  -- lavorazioni dei campioni: liofilizzato, congelato, macinato, buttato... restano nello storico con la data
  if tg_op = 'UPDATE' and new.sample_state is distinct from old.sample_state and new.sample_state is not null then
    insert into public.item_log (item_id, user_id, action, note)
    values (new.id, auth.uid(), 'lavorazione', concat_ws(' · ', new.sample_state, case when new.state_on is not null and new.state_on <> (now() at time zone 'Europe/Rome')::date then 'il ' || to_char(new.state_on, 'DD/MM/YYYY') end));
  end if;
  return null;
end;
$$;

create or replace trigger items_after_write
  after insert or update on public.items
  for each row execute function public.items_after_write();

-- Consumi: quanto è stato prelevato di ogni articolo, mese per mese (solo i cali di quantità)
create or replace function public.consumi(p_days int default 365)
returns table (item_id uuid, mese date, prelievi bigint, quantita numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select l.item_id, date_trunc('month', l.at)::date as mese, count(*) as prelievi, sum(-l.delta) as quantita
    from public.item_log l
   where public.is_member()
     and l.delta < 0
     and l.action = 'quantita'
     and l.at >= now() - make_interval(days => greatest(1, least(p_days, 3650)))
   group by l.item_id, date_trunc('month', l.at);
$$;

-- Variazione atomica della quantità (due persone che prendono insieme non si sovrascrivono).
create or replace function public.adjust_quantity(p_item uuid, p_delta numeric)
returns public.items
language plpgsql
set search_path = ''
as $$
declare
  result public.items;
begin
  update public.items
     set quantity = greatest(coalesce(quantity, 0) + p_delta, 0)
   where id = p_item
  returning * into result;
  if not found then
    raise exception 'Articolo non trovato';
  end if;
  return result;
end;
$$;

-- Uso di un articolo con nota (es. 1 reazione del kit per il run del 3 ottobre).
-- p_n negativo rimette a posto (Annulla).
create or replace function public.use_item(p_item uuid, p_n numeric, p_note text default null)
returns public.items
language plpgsql
set search_path = ''
as $$
declare
  result public.items;
begin
  if p_n is null or p_n = 0 then
    raise exception 'Quantità non valida';
  end if;
  perform set_config('labapp.note', coalesce(left(trim(p_note), 200), ''), true);
  update public.items
     set quantity = greatest(quantity - p_n, 0)
   where id = p_item and quantity is not null
  returning * into result;
  if not found then
    raise exception 'Articolo non trovato o senza quantità contata';
  end if;
  perform set_config('labapp.note', '', true);
  return result;
end;
$$;

-- Barcode usati per un run: toglie p_n aliquote a ciascun barcode (1 = RB01, 2 = RB02...).
-- Tutto o niente: se un barcode è finito non scala nulla. p_n negativo rimette a posto (Annulla).
create or replace function public.use_barcodes(p_item uuid, p_codes int[], p_n numeric default 1, p_note text default null)
returns public.items
language plpgsql
set search_path = ''
as $$
declare
  it    public.items;
  lft   jsonb;
  pre   text;
  codes int[];
  c     int;
  v     numeric;
  r0    int;
  r1    int;
  txt   text := '';
begin
  if p_n is null or p_n = 0 then
    raise exception 'Quantità non valida';
  end if;
  select array_agg(distinct x order by x) into codes from unnest(p_codes) as x where x is not null;
  if codes is null then
    raise exception 'Scegli almeno un barcode';
  end if;
  select * into it from public.items where id = p_item for update;
  if not found then
    raise exception 'Articolo non trovato';
  end if;
  lft := it.barcodes -> 'left';
  if lft is null or jsonb_typeof(lft) <> 'array' then
    raise exception 'Per questo kit il conteggio dei barcode non è impostato';
  end if;
  pre := coalesce(nullif(trim(it.barcodes ->> 'prefix'), ''), 'BC');
  foreach c in array codes loop
    if c < 1 or c > jsonb_array_length(lft) then
      raise exception 'Il barcode % non c''è in questo kit', c;
    end if;
    v := coalesce((lft ->> (c - 1))::numeric, 0) - p_n;
    if v < 0 then
      raise exception 'Il barcode % è finito', pre || lpad(c::text, 2, '0');
    end if;
    lft := jsonb_set(lft, array[(c - 1)::text], to_jsonb(v));
    -- RB01–RB04, RB07
    if r0 is null then r0 := c; r1 := c;
    elsif c = r1 + 1 then r1 := c;
    else
      txt := txt || case when txt = '' then '' else ', ' end || pre || lpad(r0::text, 2, '0')
             || case when r1 > r0 then '–' || pre || lpad(r1::text, 2, '0') else '' end;
      r0 := c; r1 := c;
    end if;
  end loop;
  txt := txt || case when txt = '' then '' else ', ' end || pre || lpad(r0::text, 2, '0')
         || case when r1 > r0 then '–' || pre || lpad(r1::text, 2, '0') else '' end;
  perform set_config('labapp.note', left(concat_ws(' · ', txt, nullif(trim(p_note), '')), 300), true);
  update public.items
     set barcodes = jsonb_set(barcodes, '{left}', lft)
   where id = p_item
  returning * into it;
  perform set_config('labapp.note', '', true);
  return it;
end;
$$;

-- ---------------------------------------------------------------------
--  Strumenti e prenotazioni
-- ---------------------------------------------------------------------
create table if not exists public.instruments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  kind        text,
  location    text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  instrument_id  uuid not null references public.instruments (id) on delete cascade,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  note           text,
  reminded_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint durata_valida check (ends_at > starts_at and ends_at - starts_at <= interval '7 days'),
  constraint niente_sovrapposizioni exclude using gist (
    instrument_id with =,
    tstzrange(starts_at, ends_at) with &&
  )
);

alter table public.instruments
  add column if not exists kind      text,
  add column if not exists location  text,
  add column if not exists notes     text,
  add column if not exists active    boolean not null default true,
  add column if not exists shelves   int check (shelves is null or shelves between 1 and 40),
  add column if not exists settings  text,
  -- la foto dello strumento per i riquadri di Prenota (giro 38): una miniatura 400×300 salvata come testo
  add column if not exists photo     text check (photo is null or (photo like 'data:image/%' and length(photo) <= 400000));
alter table public.bookings
  add column if not exists note         text,
  add column if not exists reminded_at  timestamptz;
alter table public.profiles add column if not exists email text;
-- Impostazioni personali (preferiti, sezioni visibili, tema, scheda iniziale)
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create index if not exists bookings_time_idx on public.bookings (instrument_id, starts_at);

-- ---------------------------------------------------------------------
--  Compiti (pulizie, puntali, autoclave...). repeat_days nullo = compito singolo.
-- ---------------------------------------------------------------------
create table if not exists public.tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (length(trim(title)) > 0),
  notes         text,
  location      text,
  repeat_days   int check (repeat_days is null or repeat_days between 1 and 365),
  due_on        date not null default current_date,
  assigned_to   uuid references public.profiles (id) on delete set null,
  done          boolean not null default false,
  last_done_at  timestamptz,
  last_done_by  uuid references public.profiles (id) on delete set null,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now()
);

create table if not exists public.task_log (
  id           bigint generated always as identity primary key,
  task_id      uuid not null references public.tasks (id) on delete cascade,
  user_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  done_at      timestamptz not null default now(),
  note         text,
  prev_due_on  date,
  prev_done    boolean
);

create index if not exists task_log_task_idx on public.task_log (task_id, done_at desc);

-- Manutenzioni programmate: un compito può riferirsi a uno strumento
alter table public.tasks add column if not exists instrument_id uuid references public.instruments (id) on delete set null;

-- Segna fatto: i ricorrenti passano alla prossima scadenza del loro calendario.
create or replace function public.complete_task(p_task uuid, p_note text default null)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  t public.tasks;
  today date := (now() at time zone 'Europe/Rome')::date;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found then
    raise exception 'Compito non trovato';
  end if;
  insert into public.task_log (task_id, user_id, note, prev_due_on, prev_done)
  values (p_task, auth.uid(), p_note, t.due_on, t.done);
  if t.repeat_days is null then
    update public.tasks set done = true, last_done_at = now(), last_done_by = auth.uid()
     where id = p_task returning * into t;
  else
    update public.tasks
       set due_on = case when today < t.due_on then t.due_on + t.repeat_days
                         else t.due_on + t.repeat_days * (((today - t.due_on) / t.repeat_days) + 1) end,
           last_done_at = now(), last_done_by = auth.uid()
     where id = p_task returning * into t;
  end if;
  return t;
end;
$$;

-- Annulla l'ultimo "fatto" registrato da chi chiama (entro 15 minuti).
create or replace function public.undo_complete_task(p_task uuid)
returns public.tasks
language plpgsql
set search_path = ''
as $$
declare
  l public.task_log;
  prev public.task_log;
  t public.tasks;
begin
  select * into l from public.task_log
   where task_id = p_task and user_id = auth.uid() and done_at > now() - interval '15 minutes'
   order by done_at desc limit 1;
  if not found then
    raise exception 'Non c''è niente da annullare';
  end if;
  delete from public.task_log where id = l.id;
  select * into prev from public.task_log where task_id = p_task order by done_at desc limit 1;
  update public.tasks
     set due_on = l.prev_due_on, done = coalesce(l.prev_done, false),
         last_done_at = prev.done_at, last_done_by = prev.user_id
   where id = p_task returning * into t;
  return t;
end;
$$;

-- ---------------------------------------------------------------------
--  Problemi e incidenti, con foto e commenti
-- ---------------------------------------------------------------------
create table if not exists public.issues (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  description  text,
  location     text,
  urgency      text not null default 'normale' check (urgency in ('bassa', 'normale', 'alta')),
  status       text not null default 'aperto' check (status in ('aperto', 'in_corso', 'risolto')),
  photos       text[] not null default '{}',
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  taken_by     uuid references public.profiles (id) on delete set null,
  resolved_by  uuid references public.profiles (id) on delete set null,
  resolved_at  timestamptz,
  notified_at  timestamptz
);

create index if not exists issues_open_idx on public.issues (status, created_at desc);

-- Problemi (guasti, cose che non vanno) e registro degli incidenti di sicurezza
-- condividono la tabella: kind distingue, gli incidenti hanno tipo, data, coinvolti,
-- prodotto in inventario e cosa è stato fatto. Un problema può riguardare uno strumento.
alter table public.issues
  add column if not exists kind           text not null default 'problema',
  add column if not exists incident_type  text,
  add column if not exists happened_at    timestamptz,
  add column if not exists involved       text,
  add column if not exists item_id        uuid references public.items (id) on delete set null,
  add column if not exists instrument_id  uuid references public.instruments (id) on delete set null,
  add column if not exists actions        text;

alter table public.issues drop constraint if exists issues_kind_check;
alter table public.issues add constraint issues_kind_check check (kind in ('problema', 'incidente'));
alter table public.issues drop constraint if exists issues_incident_type_check;
alter table public.issues add constraint issues_incident_type_check
  check (incident_type is null or incident_type in ('sversamento', 'ferita', 'esposizione', 'ustione', 'contaminazione', 'guasto', 'quasi', 'altro'));

create index if not exists issues_kind_idx on public.issues (kind, happened_at desc);
create index if not exists issues_instrument_idx on public.issues (instrument_id) where instrument_id is not null;

create table if not exists public.issue_comments (
  id          bigint generated always as identity primary key,
  issue_id    uuid not null references public.issues (id) on delete cascade,
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  body        text not null check (length(trim(body)) > 0),
  created_at  timestamptz not null default now()
);

create index if not exists issue_comments_issue_idx on public.issue_comments (issue_id, created_at);

create or replace function public.issues_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.notified_at := null;
  end if;
  if new.status = 'in_corso' and (tg_op = 'INSERT' or old.status <> 'in_corso') then
    new.taken_by := auth.uid();
  end if;
  if new.status = 'risolto' and (tg_op = 'INSERT' or old.status <> 'risolto') then
    new.resolved_by := auth.uid();
    new.resolved_at := now();
  elsif new.status <> 'risolto' then
    new.resolved_by := null;
    new.resolved_at := null;
  end if;
  if new.status = 'aperto' then
    new.taken_by := null;
  end if;
  return new;
end;
$$;

create or replace trigger issues_before_write
  before insert or update on public.issues
  for each row execute function public.issues_before_write();

-- ---------------------------------------------------------------------
--  Bombole di gas (azoto, azoto BIP, elio...): una riga per bombola
--  piena -> in_uso -> vuota (da ritirare) -> ritirata
-- ---------------------------------------------------------------------
create table if not exists public.cylinders (
  id            uuid primary key default gen_random_uuid(),
  gas           text not null check (length(trim(gas)) > 0),
  brand         text,
  location      text not null check (length(trim(location)) > 0),
  code          text,
  size          text,
  notes         text,
  status        text not null default 'piena' check (status in ('piena', 'in_uso', 'vuota', 'ritirata')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  started_by    uuid references public.profiles (id) on delete set null,
  started_at    timestamptz,
  emptied_by    uuid references public.profiles (id) on delete set null,
  emptied_at    timestamptz,
  collected_by  uuid references public.profiles (id) on delete set null,
  collected_at  timestamptz
);

create index if not exists cylinders_status_idx on public.cylinders (status, location);

create or replace function public.cylinders_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'in_uso' then
      new.started_by := auth.uid(); new.started_at := now();
    elsif new.status = 'vuota' then
      new.emptied_by := auth.uid(); new.emptied_at := now();
    elsif new.status = 'ritirata' then
      new.collected_by := auth.uid(); new.collected_at := now();
    end if;
  end if;
  if new.status in ('piena', 'in_uso') then
    new.emptied_by := null; new.emptied_at := null;
  end if;
  if new.status = 'piena' then
    new.started_by := null; new.started_at := null;
  end if;
  if new.status <> 'ritirata' then
    new.collected_by := null; new.collected_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger cylinders_before_write
  before insert or update on public.cylinders
  for each row execute function public.cylinders_before_write();

-- ---------------------------------------------------------------------
--  Etichette numerate (es. Sanger): un numero per riga.
--  La quantità dell'articolo è il conteggio dei numeri ancora liberi.
--  Si scrive solo attraverso le funzioni qui sotto.
-- ---------------------------------------------------------------------
create table if not exists public.item_codes (
  id        uuid primary key default gen_random_uuid(),
  item_id   uuid not null references public.items (id) on delete cascade,
  code      text not null check (length(trim(code)) > 0),
  added_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  used_by   uuid references public.profiles (id) on delete set null,
  used_at   timestamptz,
  note      text,
  unique (item_id, code)
);

create index if not exists item_codes_free_idx on public.item_codes (item_id, length(code), code) where used_at is null;
create index if not exists item_codes_used_idx on public.item_codes (item_id, used_at desc) where used_at is not null;

create or replace function public.recount_codes(p_item uuid, p_note text, p_arrived boolean default false)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  result public.items;
begin
  select count(*) into n from public.item_codes where item_id = p_item and used_at is null;
  perform set_config('labapp.note', coalesce(p_note, ''), true);
  update public.items
     set quantity = n,
         numbered = true,
         status = case when p_arrived and status <> 'ok' and (min_quantity is null or n > min_quantity) then 'ok' else status end
   where id = p_item
  returning * into result;
  perform set_config('labapp.note', '', true);
  return result;
end;
$$;

-- Aggiunge numeri nuovi (quelli già presenti vengono saltati).
create or replace function public.add_codes(p_item uuid, p_codes text[])
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  codes text[];
  added int;
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  select array_agg(distinct trim(c)) into codes from unnest(p_codes) as c where trim(c) <> '';
  if codes is null then
    raise exception 'Nessun numero da aggiungere';
  end if;
  if array_length(codes, 1) > 5000 then
    raise exception 'Al massimo 5000 numeri alla volta';
  end if;
  if not exists (select 1 from public.items where id = p_item) then
    raise exception 'Articolo non trovato';
  end if;
  insert into public.item_codes (item_id, code, added_by)
  select p_item, c, auth.uid() from unnest(codes) as c
  on conflict (item_id, code) do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    raise exception 'Questi numeri sono già tutti registrati';
  end if;
  return public.recount_codes(p_item,
    case when added = 1 then format('aggiunto n. %s', trim(p_codes[1]))
         else format('aggiunti %s numeri, da %s a %s', added, trim(p_codes[1]), trim(p_codes[array_length(p_codes, 1)])) end,
    true);
end;
$$;

-- Toglie numeri ancora liberi (persi, rovinati o inseriti per sbaglio).
create or replace function public.remove_codes(p_item uuid, p_codes text[])
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed int;
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  delete from public.item_codes
   where item_id = p_item and used_at is null
     and code in (select trim(c) from unnest(p_codes) as c);
  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'Nessuno di questi numeri è tra quelli liberi';
  end if;
  return public.recount_codes(p_item, format('tolti %s numeri', removed));
end;
$$;

-- Usa un numero: quello indicato oppure il più basso libero.
create or replace function public.take_code(p_item uuid, p_code text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.item_codes;
  it public.items;
  v_note text := nullif(left(trim(coalesce(p_note, '')), 200), '');
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  if nullif(trim(coalesce(p_code, '')), '') is null then
    select * into c from public.item_codes
     where item_id = p_item and used_at is null
     order by length(code), code
     limit 1
     for update skip locked;
    if not found then
      raise exception 'Non ci sono più numeri liberi';
    end if;
  else
    select * into c from public.item_codes where item_id = p_item and code = trim(p_code) for update;
    if not found then
      raise exception 'Il numero % non è tra quelli registrati', trim(p_code);
    end if;
    if c.used_at is not null then
      raise exception 'Il numero % risulta già usato', c.code;
    end if;
  end if;
  update public.item_codes set used_by = auth.uid(), used_at = now(), note = v_note
   where id = c.id
  returning * into c;
  it := public.recount_codes(p_item, concat_ws(' · ', 'n. ' || c.code, v_note));
  return jsonb_build_object('item', to_jsonb(it), 'code', to_jsonb(c));
end;
$$;

-- Annulla un uso: il proprio entro 15 minuti, oppure un amministratore.
create or replace function public.release_code(p_id uuid)
returns public.items
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.item_codes;
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  select * into c from public.item_codes where id = p_id for update;
  if not found or c.used_at is null then
    raise exception 'Non c''è niente da annullare';
  end if;
  if not (public.is_admin() or (c.used_by = auth.uid() and c.used_at > now() - interval '15 minutes')) then
    raise exception 'Puoi annullare solo un tuo uso degli ultimi 15 minuti';
  end if;
  update public.item_codes set used_by = null, used_at = null, note = null where id = p_id;
  return public.recount_codes(c.item_id, 'annullato n. ' || c.code);
end;
$$;

-- ---------------------------------------------------------------------
--  Flow cell Nanopore (Flongle, MinION) con lo storico dei check dei pori
--  disponibile -> in_uso -> usata, oppure scartata
-- ---------------------------------------------------------------------
create table if not exists public.flowcells (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (length(trim(code)) > 0),
  kind         text not null default 'Flongle' check (length(trim(kind)) > 0),
  batch        text,
  received_on  date,
  expiry       date,
  status       text not null default 'disponibile' check (status in ('disponibile', 'in_uso', 'usata', 'scartata')),
  run_note     text,
  notes        text,
  pores        int,
  checked_at   timestamptz,
  checked_by   uuid references public.profiles (id) on delete set null,
  started_by   uuid references public.profiles (id) on delete set null,
  started_at   timestamptz,
  ended_by     uuid references public.profiles (id) on delete set null,
  ended_at     timestamptz,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index if not exists flowcells_code_key on public.flowcells (upper(trim(code)));
create index if not exists flowcells_status_idx on public.flowcells (status, kind);

create table if not exists public.flowcell_checks (
  id           bigint generated always as identity primary key,
  flowcell_id  uuid not null references public.flowcells (id) on delete cascade,
  pores        int not null check (pores between 0 and 20000),
  checked_at   timestamptz not null default now(),
  user_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  note         text
);

create index if not exists flowcell_checks_idx on public.flowcell_checks (flowcell_id, checked_at desc);

create or replace function public.flowcells_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := upper(trim(new.code));
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'in_uso' then
      new.started_by := auth.uid(); new.started_at := now();
    elsif new.status in ('usata', 'scartata') then
      new.ended_by := auth.uid(); new.ended_at := now();
    end if;
  end if;
  if new.status = 'disponibile' then
    new.started_by := null; new.started_at := null;
  end if;
  if new.status in ('disponibile', 'in_uso') then
    new.ended_by := null; new.ended_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger flowcells_before_write
  before insert or update on public.flowcells
  for each row execute function public.flowcells_before_write();

-- L'ultimo check (per data) viene copiato sulla flow cell.
create or replace function public.flowcell_checks_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  fid uuid := coalesce(new.flowcell_id, old.flowcell_id);
  last public.flowcell_checks;
begin
  select * into last from public.flowcell_checks
   where flowcell_id = fid
   order by checked_at desc, id desc
   limit 1;
  update public.flowcells
     set pores = last.pores, checked_at = last.checked_at, checked_by = last.user_id
   where id = fid;
  return null;
end;
$$;

create or replace trigger flowcell_checks_sync
  after insert or delete on public.flowcell_checks
  for each row execute function public.flowcell_checks_sync();

-- ---------------------------------------------------------------------
--  Protocolli e ricette (soluzioni, terreni, estrazioni, colture...)
--  ingredients: [{"a": quantità o null, "u": unità, "n": nome}]
--  base_amount/base_unit: per quanto è scritta la ricetta (es. 100 mL)
-- ---------------------------------------------------------------------
create table if not exists public.protocols (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (length(trim(title)) > 0),
  category     text not null default 'altro',
  summary      text,
  base_amount  numeric check (base_amount is null or base_amount > 0),
  base_unit    text,
  ingredients  jsonb not null default '[]' check (jsonb_typeof(ingredients) = 'array'),
  steps        text[] not null default '{}',
  notes        text,
  link         text,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now()
);

create index if not exists protocols_category_idx on public.protocols (category, title);

-- PCR (ottobre 2026): volume di reazione, DNA di solito, BSA e programma del termociclatore
-- {"vol": 25, "dna": 1, "program": [{"n": 1, "s": [[94, 300]]}, {"n": 35, "s": [[94, 15], [58, 15], [72, 60]]}]}
alter table public.protocols add column if not exists pcr jsonb check (pcr is null or jsonb_typeof(pcr) = 'object');
-- La scheda uguale per tutti (giro 22): scopo (summary), cosa serve (ingredienti e strumenti), prima di cominciare,
-- passaggi divisi in fasi o giorni [{"title": "Secondo giorno", "start": 6}] senza cambiare i numeri dei passaggi,
-- sicurezza (oltre ai pericoli degli ingredienti in inventario), note e fonte
alter table public.protocols add column if not exists equipment text[] not null default '{}' check (cardinality(equipment) <= 60);
alter table public.protocols add column if not exists prep text[] not null default '{}' check (cardinality(prep) <= 60);
alter table public.protocols add column if not exists phases jsonb not null default '[]' check (jsonb_typeof(phases) = 'array' and jsonb_array_length(phases) <= 60);
alter table public.protocols add column if not exists safety text check (safety is null or length(safety) <= 4000);
alter table public.protocols add column if not exists source text check (source is null or length(source) <= 1000);
-- Standard interni per LC-MS (ottobre 2026): volume finale, mix per campione, scorta e standard con le concentrazioni finali
-- {"final_ul": 100, "mix_ul": 10, "extra": 25, "solvent": "metanolo", "stds": [{"n": "9-HODE-d4", "c": 100, "cu": "µg/mL", "mw": 300.5, "t": 10, "tu": "µM", "mode": "neg"}]}
alter table public.protocols add column if not exists istd jsonb check (istd is null or jsonb_typeof(istd) = 'object');

-- Esecuzioni dei protocolli: chi ha fatto cosa e quando, con i passaggi spuntati e i reagenti
-- usati davvero (marca, grado, lotto). Servono al registro e ai Materials and methods.
create table if not exists public.protocol_runs (
  id              uuid primary key default gen_random_uuid(),
  protocol_id     uuid references public.protocols (id) on delete set null,
  protocol_title  text not null check (length(trim(protocol_title)) > 0),
  label           text,
  run_on          date not null default current_date,
  amount          numeric check (amount is null or amount > 0),
  unit            text,
  reagents        jsonb not null default '[]' check (jsonb_typeof(reagents) = 'array'),
  steps_done      int[] not null default '{}',
  steps_total     int not null default 0 check (steps_total between 0 and 500),
  params          jsonb check (params is null or jsonb_typeof(params) = 'object'),
  notes           text,
  status          text not null default 'in_corso' check (status in ('in_corso', 'fatta')),
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists protocol_runs_idx on public.protocol_runs (protocol_id, run_on desc);
create or replace function public.protocol_runs_touch()
returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists protocol_runs_touch on public.protocol_runs;
create trigger protocol_runs_touch before update on public.protocol_runs
  for each row execute function public.protocol_runs_touch();
-- problemi o imprevisti dell'esecuzione (finiscono anche nel diario di chi l'ha fatta)
alter table public.protocol_runs add column if not exists problems text check (problems is null or length(problems) <= 2000);
create index if not exists protocol_runs_by_idx on public.protocol_runs (created_by, run_on desc);

-- Diario di laboratorio: le note di ogni giornata. Sono personali: le legge chi le scrive e,
-- se serve, un amministratore. I protocolli eseguiti entrano nel diario da soli (protocol_runs).
create table if not exists public.lab_journal (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  day         date not null default current_date,
  title       text check (title is null or length(title) <= 140),
  samples     text check (samples is null or length(samples) <= 1000),
  notes       text,
  problems    text check (problems is null or length(problems) <= 2000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lab_journal_idx on public.lab_journal (user_id, day desc);
drop trigger if exists lab_journal_touch on public.lab_journal;
create trigger lab_journal_touch before update on public.lab_journal
  for each row execute function public.protocol_runs_touch();

-- Progetti del laboratorio (ottobre 2026): raccolgono le pagine del diario e le esecuzioni di un lavoro
create table if not exists public.lab_projects (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (length(btrim(name)) between 1 and 80),
  description  text check (description is null or length(description) <= 500),
  active       boolean not null default true,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);
create unique index if not exists lab_projects_name on public.lab_projects (lower(btrim(name)));
-- chi ci lavora (giro 22): i progetti del laboratorio li crea il responsabile e sceglie le persone; ognuno vede i suoi.
-- Chi non è responsabile può fare un progetto suo, solo per sé. I nomi restano leggibili da tutti (pagine condivise, esecuzioni).
alter table public.lab_projects add column if not exists members uuid[] not null default '{}';
create or replace function public.lab_projects_members()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.is_admin() then
    new.members := coalesce((select array_agg(distinct m) from unnest(new.members) as m where m is not null), '{}');
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.members := array[auth.uid()];
  elsif new.members is distinct from old.members then
    raise exception 'Solo il responsabile sceglie chi lavora a un progetto' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists lab_projects_members on public.lab_projects;
create trigger lab_projects_members before insert or update on public.lab_projects
  for each row execute function public.lab_projects_members();
alter table public.protocol_runs add column if not exists project_id uuid references public.lab_projects (id) on delete set null;

-- Documenti del laboratorio (ottobre 2026, giro 21): paper usciti, risultati, report, con il file (bucket documenti) o un link,
-- collegati a campioni, ceppi e progetti (links [{t: item | strain | proj, id}]). Li vedono tutti i membri
create table if not exists public.lab_docs (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'risultati' check (kind in ('paper', 'risultati', 'report', 'altro')),
  title       text not null check (length(btrim(title)) between 1 and 300),
  authors     text check (authors is null or length(authors) <= 2000),
  journal     text check (journal is null or length(journal) <= 300),
  year        int check (year is null or year between 1800 and 2200),
  doi         text check (doi is null or length(doi) <= 200),
  url         text check (url is null or length(url) <= 1000),
  path        text check (path is null or length(path) <= 400),
  file_name   text check (file_name is null or length(file_name) <= 300),
  mime        text check (mime is null or length(mime) <= 200),
  size        bigint check (size is null or size >= 0),
  note        text check (note is null or length(note) <= 4000),
  links       jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists lab_docs_created_idx on public.lab_docs (created_at desc);
drop trigger if exists lab_docs_touch on public.lab_docs;
create trigger lab_docs_touch before update on public.lab_docs
  for each row execute function public.protocol_runs_touch();

-- Articoli (giro 42): abstract, link al testo completo libero e licenza. Il lunedì la funzione notify
-- guarda gli ORCID delle persone seguite e aggiunge da sola gli articoli nuovi (auto_added)
alter table public.lab_docs add column if not exists abstract text check (abstract is null or length(abstract) <= 20000);
alter table public.lab_docs add column if not exists pdf_url text check (pdf_url is null or (pdf_url ~ '^https?://' and length(pdf_url) <= 1000));
alter table public.lab_docs add column if not exists license text check (license is null or length(license) <= 60);
alter table public.lab_docs add column if not exists auto_added boolean not null default false;
alter table public.lab_docs add column if not exists meta_checked_at timestamptz;
create index if not exists lab_docs_doi_idx on public.lab_docs (lower(doi)) where doi is not null;

-- Le persone del laboratorio di cui si seguono gli articoli, con uno o più ORCID
create table if not exists public.lab_authors (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (length(btrim(full_name)) between 3 and 80),
  orcids          text[] not null default '{}' check (array_to_string(orcids, ',') ~ '^(\d{4}-\d{4}-\d{4}-\d{3}[\dX](,\d{4}-\d{4}-\d{4}-\d{3}[\dX])*)?$'),
  active          boolean not null default true,
  last_checked_at timestamptz,
  last_found      int,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);
create unique index if not exists lab_authors_name on public.lab_authors (lower(btrim(full_name)));

-- Gli articoli tolti a mano non vengono rimessi dal controllo automatico; se qualcuno li riaggiunge si possono di nuovo seguire
create table if not exists public.paper_skip (
  doi        text primary key,
  created_at timestamptz not null default now()
);
create or replace function public.lab_docs_skip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.kind = 'paper' and old.doi is not null then
      insert into public.paper_skip (doi) values (lower(btrim(old.doi))) on conflict do nothing;
    end if;
    return old;
  end if;
  if new.doi is not null then delete from public.paper_skip where doi = lower(btrim(new.doi)); end if;
  return new;
end;
$$;
drop trigger if exists lab_docs_skip on public.lab_docs;
create trigger lab_docs_skip after insert or delete on public.lab_docs
  for each row execute function public.lab_docs_skip();

-- Il diario diventa un quaderno di laboratorio: progetto, obiettivo, appunti lunghi, risultati, prossimi passi,
-- parole chiave, foto, collegamenti (esecuzioni, ceppi, campioni), firma e aggiunte dopo la firma
alter table public.lab_journal
  add column if not exists project_id  uuid references public.lab_projects (id) on delete set null,
  add column if not exists aim         text check (aim is null or length(aim) <= 2000),
  add column if not exists results     text check (results is null or length(results) <= 8000),
  add column if not exists next_steps  text check (next_steps is null or length(next_steps) <= 2000),
  add column if not exists tags        text[] not null default '{}',
  add column if not exists photos      text[] not null default '{}',
  add column if not exists links       jsonb not null default '[]' check (jsonb_typeof(links) = 'array'),
  add column if not exists signed_at   timestamptz,
  add column if not exists addenda     jsonb not null default '[]' check (jsonb_typeof(addenda) = 'array');
alter table public.lab_journal drop constraint if exists lab_journal_notes_check;
alter table public.lab_journal drop constraint if exists diario_appunti_lunghezza;
alter table public.lab_journal add constraint diario_appunti_lunghezza check (notes is null or length(notes) <= 20000);
alter table public.lab_journal drop constraint if exists diario_non_vuoto;
alter table public.lab_journal add constraint diario_non_vuoto check (coalesce(btrim(title), '') <> '' or coalesce(btrim(samples), '') <> '' or coalesce(btrim(notes), '') <> ''
  or coalesce(btrim(problems), '') <> '' or coalesce(btrim(aim), '') <> '' or coalesce(btrim(results), '') <> '' or coalesce(btrim(next_steps), '') <> '' or cardinality(photos) > 0);
create index if not exists lab_journal_project_idx on public.lab_journal (project_id, day desc);
-- Materiali usati in una pagina (ottobre 2026): articoli dell'inventario con quantità e lotto.
-- applied = già tolti dall'inventario con use_item, così non si tolgono due volte
alter table public.lab_journal
  add column if not exists materials jsonb not null default '[]' check (jsonb_typeof(materials) = 'array');
-- Modifiche al protocollo seguito (ottobre 2026): [{p: protocollo, k: passaggio (da 0, -1 se in generale), step: testo del passaggio, text}]
alter table public.lab_journal
  add column if not exists proto_changes jsonb not null default '[]' check (jsonb_typeof(proto_changes) = 'array');
-- Descrizioni delle foto (ottobre 2026): {percorso della foto: testo}, una per foto, facoltative
alter table public.lab_journal
  add column if not exists photo_caps jsonb not null default '{}' check (jsonb_typeof(photo_caps) = 'object');

-- Versioni: ogni modifica a una pagina conserva la versione precedente; una pagina firmata non si cambia più,
-- si possono solo aggiungere note in fondo
create table if not exists public.lab_journal_versions (
  id        bigint generated always as identity primary key,
  entry_id  uuid not null references public.lab_journal (id) on delete cascade,
  saved_at  timestamptz not null default now(),
  data      jsonb not null
);
create index if not exists lab_journal_versions_idx on public.lab_journal_versions (entry_id, saved_at desc);
create or replace function public.lab_journal_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o jsonb := to_jsonb(old) - 'updated_at' - 'addenda' - 'signed_at';
  n jsonb := to_jsonb(new) - 'updated_at' - 'addenda' - 'signed_at';
begin
  -- quando un amministratore unisce due articoli dell'inventario cambia solo il collegamento ai materiali, anche nelle pagine firmate
  if current_setting('labapp.unione', true) = 'on' then
    return new;
  end if;
  if old.signed_at is not null then
    if n <> o or new.signed_at is distinct from old.signed_at then
      raise exception 'La pagina è firmata: puoi solo aggiungere una nota in fondo';
    end if;
    if not (new.addenda @> old.addenda and jsonb_array_length(new.addenda) >= jsonb_array_length(old.addenda)) then
      raise exception 'Le aggiunte a una pagina firmata non si cambiano';
    end if;
  elsif n <> o then
    insert into public.lab_journal_versions (entry_id, data) values (old.id, to_jsonb(old));
  end if;
  return new;
end;
$$;
drop trigger if exists lab_journal_before_update on public.lab_journal;
create trigger lab_journal_before_update before update on public.lab_journal
  for each row execute function public.lab_journal_before_update();

-- Condivisione del diario: chi scrive può mandarne una parte (un progetto, un periodo o alcune pagine) a un collega,
-- per esempio uno studente al suo responsabile. Chi riceve la legge soltanto. Senza data di fine resta aggiornata:
-- le pagine nuove di quel progetto si vedono da sole.
create table if not exists public.journal_shares (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  viewer_id    uuid not null references public.profiles (id) on delete cascade,
  project_id   uuid references public.lab_projects (id) on delete cascade,
  from_day     date,
  to_day       date,
  entry_ids    uuid[],
  include_runs boolean not null default true,
  note         text check (note is null or char_length(note) <= 500),
  created_at   timestamptz not null default now(),
  notified_at  timestamptz,
  constraint condivisione_non_a_se check (owner_id <> viewer_id),
  constraint condivisione_date check (from_day is null or to_day is null or from_day <= to_day),
  constraint condivisione_pagine check (entry_ids is null or cardinality(entry_ids) between 1 and 1000)
);
create index if not exists journal_shares_viewer on public.journal_shares (viewer_id, owner_id);
-- giro 54: accesso d'emergenza dello sviluppatore a un diario; chi lo scrive lo vede e non lo può togliere
alter table public.journal_shares add column if not exists forced boolean not null default false;
create index if not exists journal_shares_owner on public.journal_shares (owner_id);

create or replace function public.journal_shared(p_owner uuid, p_project uuid, p_day date, p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.journal_shares s
     where s.viewer_id = auth.uid() and s.owner_id = p_owner
       and (s.project_id is null or s.project_id = p_project)
       and (s.from_day is null or p_day >= s.from_day)
       and (s.to_day is null or p_day <= s.to_day)
       and (s.entry_ids is null or p_id = any (s.entry_ids))
  );
$$;

-- giro 54: lo sviluppatore apre il diario di qualcuno quando va recuperato. Resta scritto, con il motivo,
-- fra le condivisioni di chi lo scrive, che lo vede
create or replace function public.force_diary_access(target uuid, reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  why text := left(btrim(coalesce(reason, '')), 500);
begin
  if not public.is_developer() then
    raise exception 'L''accesso d''emergenza ai diari ce l''ha solo lo sviluppatore dell''app';
  end if;
  if target = auth.uid() then
    raise exception 'È il tuo diario';
  end if;
  if char_length(why) < 5 then
    raise exception 'Scrivi il motivo';
  end if;
  if not exists (select 1 from public.profiles where id = target) then
    raise exception 'Persona non trovata';
  end if;
  select id into sid from public.journal_shares where owner_id = target and viewer_id = auth.uid() and forced limit 1;
  if sid is not null then
    update public.journal_shares set note = why, created_at = now(), notified_at = null where id = sid;
    return sid;
  end if;
  insert into public.journal_shares (owner_id, viewer_id, include_runs, note, forced)
  values (target, auth.uid(), true, why, true)
  returning id into sid;
  return sid;
end;
$$;

-- Copie di sicurezza: ogni notte il database copia tutte le tabelle qui dentro (il piano gratuito di Supabase
-- non fa backup). Restano le ultime 8 notti, una a settimana per cinque settimane e una al mese per sei mesi.
-- Le foto non sono dentro: si salvano dall'app con "Copia completa con le foto".
create table if not exists public.backups (
  id       bigint generated always as identity primary key,
  made_at  timestamptz not null default now(),
  kind     text not null default 'auto' check (kind in ('auto', 'manuale')),
  made_by  uuid references public.profiles (id) on delete set null,
  counts   jsonb not null default '{}'::jsonb,
  bytes    bigint,
  data     jsonb not null
);
create index if not exists backups_made_at on public.backups (made_at desc);

create or replace function public.make_backup(p_kind text default 'manuale')
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
  d jsonb := '{}'::jsonb;
  c jsonb := '{}'::jsonb;
  r jsonb;
  new_id bigint;
begin
  if auth.uid() is not null and not public.is_developer() then
    raise exception 'Le copie le fa solo lo sviluppatore dell''app';
  end if;
  for t in
    select table_name::text from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'
       and table_name not in ('backups', 'push_subscriptions', 'ai_usage', 'calendar_tokens')
     order by table_name
  loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x', t) into r;
    d := d || jsonb_build_object(t, r);
    c := c || jsonb_build_object(t, jsonb_array_length(r));
  end loop;
  insert into public.backups (kind, made_by, counts, bytes, data)
  values (case when p_kind = 'auto' then 'auto' else 'manuale' end, auth.uid(), c, octet_length(d::text), d)
  returning id into new_id;
  delete from public.backups
   where id in (
     select x.id from (
       select b.id, b.made_at,
              row_number() over (partition by date_trunc('week', b.made_at) order by b.made_at desc) as wk,
              row_number() over (partition by date_trunc('month', b.made_at) order by b.made_at desc) as mo
         from public.backups b
     ) x
     where x.made_at < now() - interval '8 days'
       and not (x.made_at >= now() - interval '36 days' and x.wk = 1)
       and not (x.made_at >= now() - interval '186 days' and x.mo = 1)
   );
  return new_id;
end;
$$;

-- Cosa c'era in una copia e adesso non c'è più (cancellato per sbaglio): elenco per l'amministratore
create or replace function public.backup_missing(p_backup bigint)
returns table (tbl text, id text, label text, day text, owner text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  t text;
begin
  if not public.is_developer() then
    raise exception 'Le copie le guarda solo lo sviluppatore dell''app';
  end if;
  foreach t in array array['items', 'strains', 'protocols', 'protocol_runs', 'lab_journal', 'lab_projects', 'instruments', 'tasks', 'issues',
                           'cylinders', 'flowcells', 'freezers', 'boxes', 'practicals', 'funds', 'lc_columns', 'waste_containers', 'order_requests', 'lab_docs'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    return query execute format(
      'select %L::text, x->>''id'', coalesce(nullif(x->>''name'', ''''), nullif(x->>''title'', ''''), nullif(x->>''code'', ''''), nullif(x->>''protocol_title'', ''''), nullif(x->>''label'', ''''), ''senza nome''),
              coalesce(x->>''day'', x->>''run_on'', left(x->>''created_at'', 10), ''''), coalesce(x->>''user_id'', x->>''created_by'', '''')
         from public.backups b, jsonb_array_elements(coalesce(b.data -> %L, ''[]''::jsonb)) x
        where b.id = $1 and x ? ''id'' and not exists (select 1 from public.%I c where c.id::text = x->>''id'')', t, t, t) using p_backup;
  end loop;
end;
$$;

-- Rimette righe cancellate prendendole da una copia, con quello che dipendeva da loro (passaggi, foto, codici, versioni...)
create or replace function public.restore_rows(p_backup bigint, p_table text, p_ids text[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  k int;
  r jsonb;
  fk record;
  kids text[];
begin
  if not public.is_developer() then
    raise exception 'Dalle copie recupera solo lo sviluppatore dell''app';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then return 0; end if;
  if p_table in ('backups', 'push_subscriptions', 'ai_usage', 'profiles') or to_regclass('public.' || p_table) is null then
    raise exception 'Questa tabella non si recupera';
  end if;
  for r in
    select x from public.backups b, jsonb_array_elements(coalesce(b.data -> p_table, '[]'::jsonb)) x
     where b.id = p_backup and x->>'id' = any (p_ids)
  loop
    begin
      execute format('insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing', p_table, p_table) using r;
      get diagnostics k = row_count;
      n := n + k;
    exception when foreign_key_violation then
      null;  -- manca qualcosa da cui dipende (un'altra riga cancellata): si salta
    end;
  end loop;
  -- le righe figlie cancellate a cascata
  for fk in
    select cl.relname::text as child, a.attname::text as col
      from pg_constraint co
      join pg_class cl on cl.oid = co.conrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_attribute a on a.attrelid = co.conrelid and a.attnum = co.conkey[1]
     where co.contype = 'f' and co.confdeltype = 'c' and ns.nspname = 'public'
       and co.confrelid = ('public.' || p_table)::regclass and cardinality(co.conkey) = 1
  loop
    select array_agg(x->>'id') into kids
      from public.backups b, jsonb_array_elements(coalesce(b.data -> fk.child, '[]'::jsonb)) x
     where b.id = p_backup and x->>fk.col = any (p_ids) and x ? 'id';
    if kids is not null then
      perform public.restore_rows(p_backup, fk.child, kids);
    else
      -- tabelle senza id proprio (per esempio le posizioni nelle scatole)
      for r in
        select x from public.backups b, jsonb_array_elements(coalesce(b.data -> fk.child, '[]'::jsonb)) x
         where b.id = p_backup and x->>fk.col = any (p_ids)
      loop
        begin
          execute format('insert into public.%I overriding system value select * from jsonb_populate_record(null::public.%I, $1) on conflict do nothing', fk.child, fk.child) using r;
        exception when foreign_key_violation then null;
        end;
      end loop;
    end if;
  end loop;
  return n;
end;
$$;

-- Trascrizione dal quaderno con l'AI: quante pagine ha letto ognuno, per il limite giornaliero
create table if not exists public.ai_usage (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  day      date not null default current_date,
  provider text not null,
  pages    int not null default 0,
  primary key (user_id, day, provider)
);

create or replace function public.protocols_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;

create or replace trigger protocols_before_write
  before insert or update on public.protocols
  for each row execute function public.protocols_before_write();

-- ---------------------------------------------------------------------
--  Richieste d'ordine (anche per prodotti che non sono in inventario)
-- ---------------------------------------------------------------------
create table if not exists public.order_requests (
  id            uuid primary key default gen_random_uuid(),
  product       text not null check (length(trim(product)) > 0),
  catalog_no    text,
  brand         text,
  supplier      text,
  quantity      text,
  price         numeric check (price is null or price >= 0),
  item_id       uuid references public.items (id) on delete set null,
  notes         text,
  status        text not null default 'richiesta' check (status in ('richiesta', 'ordinata', 'arrivata', 'annullata')),
  requested_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  requested_at  timestamptz not null default now(),
  ordered_by    uuid references public.profiles (id) on delete set null,
  ordered_at    timestamptz,
  arrived_by    uuid references public.profiles (id) on delete set null,
  arrived_at    timestamptz
);

create index if not exists order_requests_status_idx on public.order_requests (status, requested_at desc);

create or replace function public.order_requests_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.requested_by := coalesce(auth.uid(), new.requested_by);
    new.requested_at := now();
  else
    new.requested_by := old.requested_by;
    new.requested_at := old.requested_at;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    if new.status = 'ordinata' then new.ordered_by := auth.uid(); new.ordered_at := now(); end if;
    if new.status = 'arrivata' then
      new.arrived_by := auth.uid(); new.arrived_at := now();
      new.ordered_at := coalesce(new.ordered_at, now()); new.ordered_by := coalesce(new.ordered_by, auth.uid());
    end if;
  end if;
  if new.status = 'richiesta' then new.ordered_by := null; new.ordered_at := null; end if;
  if new.status in ('richiesta', 'ordinata') then new.arrived_by := null; new.arrived_at := null; end if;
  return new;
end;
$$;

create or replace trigger order_requests_before_write
  before insert or update on public.order_requests
  for each row execute function public.order_requests_before_write();

-- ---------------------------------------------------------------------
--  Taniche dei rifiuti: in uso -> piena (da ritirare) -> ritirata
-- ---------------------------------------------------------------------
create table if not exists public.waste_containers (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (length(trim(kind)) > 0),
  location      text not null check (length(trim(location)) > 0),
  code          text,
  size          text,
  notes         text,
  status        text not null default 'in_uso' check (status in ('in_uso', 'piena', 'ritirata')),
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  full_by       uuid references public.profiles (id) on delete set null,
  full_at       timestamptz,
  collected_by  uuid references public.profiles (id) on delete set null,
  collected_at  timestamptz
);

create index if not exists waste_status_idx on public.waste_containers (status, location);

create or replace function public.waste_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'piena' then new.full_by := auth.uid(); new.full_at := now(); end if;
    if new.status = 'ritirata' then new.collected_by := auth.uid(); new.collected_at := now(); end if;
  end if;
  if tg_op = 'INSERT' and new.status = 'piena' then new.full_by := auth.uid(); new.full_at := now(); end if;
  if new.status = 'in_uso' then new.full_by := null; new.full_at := null; end if;
  if new.status <> 'ritirata' then new.collected_by := null; new.collected_at := null; end if;
  return new;
end;
$$;

create or replace trigger waste_before_write
  before insert or update on public.waste_containers
  for each row execute function public.waste_before_write();

-- ---------------------------------------------------------------------
--  Collezione di ceppi e isolati, con ripicche e altri eventi
-- ---------------------------------------------------------------------
create table if not exists public.strains (
  id               uuid primary key default gen_random_uuid(),
  code             text not null check (length(trim(code)) > 0),
  species          text,
  host             text,
  origin           text,
  isolated_on      date,
  isolated_by      text,
  substrate        text,
  medium           text,
  storage          text,
  sequence_ref     text,
  notes            text,
  status           text not null default 'attivo' check (status in ('attivo', 'perso', 'eliminato')),
  subculture_days  int check (subculture_days is null or subculture_days between 1 and 3650),
  last_subculture  date,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at       timestamptz not null default now()
);

create unique index if not exists strains_code_key on public.strains (upper(trim(code)));
alter table public.strains add column if not exists photos text[] not null default '{}';

create table if not exists public.strain_events (
  id          bigint generated always as identity primary key,
  strain_id   uuid not null references public.strains (id) on delete cascade,
  kind        text not null default 'ripicca' check (kind in ('ripicca', 'sequenza', 'conservato', 'spedito', 'nota')),
  note        text,
  on_date     date not null default current_date,
  user_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists strain_events_idx on public.strain_events (strain_id, on_date desc, id desc);

-- Foto in coltura dei ceppi (ottobre 2026): piastre fronte e retro su terreni diversi, spore,
-- microscopio, con giorni di crescita, temperatura, luce e numero di ripicche, per seguirle nel tempo.
create table if not exists public.strain_photos (
  id          uuid primary key default gen_random_uuid(),
  strain_id   uuid not null references public.strains (id) on delete cascade,
  path        text not null check (length(path) > 0),
  kind        text not null default 'piastra' check (kind in ('piastra', 'spore', 'microscopio', 'altro')),
  side        text check (side is null or side in ('fronte', 'retro')),
  medium      text,
  temp_c      numeric check (temp_c is null or temp_c between -200 and 120),
  age_days    int check (age_days is null or age_days between 0 and 3650),
  passage     int check (passage is null or passage between 0 and 9999),
  light       text,
  taken_on    date not null default current_date,
  note        text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists strain_photos_idx on public.strain_photos (strain_id, taken_on, created_at);

-- Sequenze dei ceppi (ottobre 2026, giro 21): i FASTA letti, una riga per locus (ITS, TEF1, RPB2...), con il numero GenBank se c'è
create table if not exists public.strain_seqs (
  id          uuid primary key default gen_random_uuid(),
  strain_id   uuid not null references public.strains (id) on delete cascade,
  locus       text not null check (length(btrim(locus)) between 1 and 40),
  header      text check (header is null or length(header) <= 400),
  seq         text not null check (length(seq) between 1 and 200000 and seq ~ '^[ACGTURYKMSWBDHVN*-]+$'),
  accession   text check (accession is null or length(accession) <= 40),
  note        text check (note is null or length(note) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists strain_seqs_idx on public.strain_seqs (strain_id, locus);
-- per ritrovare in fretta quello che una persona ha fatto nell'app (attività nel diario)
create index if not exists item_log_user_idx on public.item_log (user_id, at desc);
create index if not exists strain_events_user_idx on public.strain_events (user_id, on_date desc);
create index if not exists strain_photos_user_idx on public.strain_photos (created_by, taken_on desc);
-- Da completare (ottobre 2026): un articolo, un ceppo o un protocollo aggiunto al volo dal diario resta da completare
-- per chi l'ha aggiunto (todo_by) finché qualcuno non salva il modulo intero
alter table public.items add column if not exists todo_by uuid references public.profiles (id) on delete set null;
alter table public.strains add column if not exists todo_by uuid references public.profiles (id) on delete set null;
alter table public.protocols add column if not exists todo_by uuid references public.profiles (id) on delete set null;

create or replace function public.strains_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.code := nullif(trim(new.code), '');
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.created_at := old.created_at; end if;
  return new;
end;
$$;

create or replace trigger strains_before_write
  before insert or update on public.strains
  for each row execute function public.strains_before_write();

-- Una ripicca aggiorna la data dell'ultima ripicca del ceppo.
create or replace function public.strain_events_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid := coalesce(new.strain_id, old.strain_id);
  last date;
begin
  select max(on_date) into last from public.strain_events where strain_id = sid and kind = 'ripicca';
  if tg_op = 'INSERT' and new.kind = 'ripicca' then
    update public.strains set last_subculture = greatest(coalesce(last_subculture, new.on_date), new.on_date) where id = sid;
  elsif tg_op = 'DELETE' and old.kind = 'ripicca' and last is not null then
    update public.strains set last_subculture = last where id = sid;
  end if;
  return null;
end;
$$;

create or replace trigger strain_events_sync
  after insert or delete on public.strain_events
  for each row execute function public.strain_events_sync();

-- ---------------------------------------------------------------------
--  Micoteca: referente del ceppo e conservazioni da rinnovare
--  (spore o micelio in glicerolo, piastre, provette, acqua, olio, liofilizzati)
-- ---------------------------------------------------------------------
alter table public.strains alter column code drop not null;
alter table public.strains add column if not exists keeper_id uuid references public.profiles (id) on delete set null;
alter table public.strains add column if not exists keeper_name text;
alter table public.strains add column if not exists sporulates boolean;
alter table public.strains add column if not exists snooze_until date;

create table if not exists public.strain_stocks (
  id            uuid primary key default gen_random_uuid(),
  strain_id     uuid not null references public.strains (id) on delete cascade,
  kind          text not null default 'spore_glicerolo'
                check (kind in ('spore_glicerolo', 'micelio_glicerolo', 'piastre', 'provette', 'acqua', 'olio', 'liofilizzato', 'altro')),
  made_on       date,
  renew_months  int check (renew_months is null or renew_months between 1 and 240),
  due_on        date generated always as ((made_on + make_interval(months => renew_months))::date) stored,
  qty           int check (qty is null or qty between 0 and 999),
  place         text,
  keeper_id     uuid references public.profiles (id) on delete set null,
  note          text,
  status        text not null default 'attiva' check (status in ('attiva', 'finita')),
  notified_at   timestamptz,
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at    timestamptz not null default now()
);

alter table public.strain_stocks add column if not exists snooze_until date;

create index if not exists strain_stocks_strain_idx on public.strain_stocks (strain_id);
create index if not exists strain_stocks_due_idx on public.strain_stocks (due_on) where status = 'attiva';

create or replace function public.strain_stocks_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- l'avviso automatico (senza utente) segna solo notified_at
  if tg_op = 'UPDATE' and auth.uid() is null then return new; end if;
  new.place := nullif(trim(new.place), '');
  new.note := nullif(trim(new.note), '');
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  if tg_op = 'UPDATE' then
    new.created_by := old.created_by; new.created_at := old.created_at; new.strain_id := old.strain_id;
    -- rifatte o cambiata la scadenza: si ricomincia a contare per gli avvisi
    if (new.made_on, new.renew_months, new.status, new.snooze_until) is distinct from (old.made_on, old.renew_months, old.status, old.snooze_until) then
      new.notified_at := null;
    end if;
  else
    new.notified_at := null;
  end if;
  return new;
end;
$$;

create or replace trigger strain_stocks_before_write
  before insert or update on public.strain_stocks
  for each row execute function public.strain_stocks_before_write();

-- ---------------------------------------------------------------------
--  Congelatori, scatole a griglia e posizioni (A1, B7...)
-- ---------------------------------------------------------------------
create table if not exists public.freezers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  temp        text,
  location    text,
  notes       text,
  created_at  timestamptz not null default now()
);

create table if not exists public.boxes (
  id          uuid primary key default gen_random_uuid(),
  freezer_id  uuid not null references public.freezers (id) on delete cascade,
  name        text not null check (length(trim(name)) > 0),
  rows        int not null default 9 check (rows between 1 and 26),
  cols        int not null default 9 check (cols between 1 and 26),
  place       text,
  notes       text,
  created_at  timestamptz not null default now()
);

create index if not exists boxes_freezer_idx on public.boxes (freezer_id, name);

create table if not exists public.box_slots (
  id          uuid primary key default gen_random_uuid(),
  box_id      uuid not null references public.boxes (id) on delete cascade,
  pos         text not null check (pos ~ '^[A-Z][0-9]{1,2}$'),
  label       text not null check (length(trim(label)) > 0),
  strain_id   uuid references public.strains (id) on delete set null,
  note        text,
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now(),
  unique (box_id, pos)
);

create index if not exists box_slots_strain_idx on public.box_slots (strain_id) where strain_id is not null;
alter table public.box_slots add column if not exists photos text[] not null default '{}';
alter table public.box_slots add column if not exists item_id uuid references public.items (id) on delete set null;
create index if not exists box_slots_item_idx on public.box_slots (item_id) where item_id is not null;

create or replace function public.box_slots_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  b public.boxes;
  r int; c int;
begin
  new.pos := upper(trim(new.pos));
  if new.pos !~ '^[A-Z][0-9]{1,2}$' then
    raise exception 'Posizione non valida (es. A1, C12)';
  end if;
  select * into b from public.boxes where id = new.box_id;
  r := ascii(substr(new.pos, 1, 1)) - 64;
  c := substr(new.pos, 2)::int;
  if r > b.rows or c < 1 or c > b.cols then
    raise exception 'La posizione % non esiste in questa scatola', new.pos;
  end if;
  new.label := trim(new.label);
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

create or replace trigger box_slots_before_write
  before insert or update on public.box_slots
  for each row execute function public.box_slots_before_write();

-- ---------------------------------------------------------------------
--  Registro degli strumenti e colonne cromatografiche
-- ---------------------------------------------------------------------
create table if not exists public.instrument_log (
  id             bigint generated always as identity primary key,
  instrument_id  uuid not null references public.instruments (id) on delete cascade,
  kind           text not null default 'nota' check (kind in ('manutenzione', 'guasto', 'intervento', 'colonna', 'nota')),
  body           text not null check (length(trim(body)) > 0),
  at             timestamptz not null default now(),
  user_id        uuid default auth.uid() references public.profiles (id) on delete set null
);

create index if not exists instrument_log_idx on public.instrument_log (instrument_id, at desc);

create table if not exists public.lc_columns (
  id             uuid primary key default gen_random_uuid(),
  name           text not null check (length(trim(name)) > 0),
  phase          text,
  dimensions     text,
  serial         text,
  instrument_id  uuid references public.instruments (id) on delete set null,
  status         text not null default 'in_uso' check (status in ('in_uso', 'scorta', 'esaurita')),
  installed_on   date,
  injections     int not null default 0 check (injections >= 0),
  notes          text,
  created_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- Condizioni di una camera di crescita: le può aggiornare ogni membro.
create or replace function public.set_instrument_settings(p_id uuid, p_settings text)
returns public.instruments
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.instruments;
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  update public.instruments set settings = nullif(trim(p_settings), '') where id = p_id returning * into result;
  if not found then raise exception 'Strumento non trovato'; end if;
  return result;
end;
$$;

-- ---------------------------------------------------------------------
--  Ripiani di fitotroni e camere di crescita, occupati per giorni
-- ---------------------------------------------------------------------
create table if not exists public.chamber_slots (
  id             uuid primary key default gen_random_uuid(),
  instrument_id  uuid not null references public.instruments (id) on delete cascade,
  shelf          int not null check (shelf between 1 and 40),
  label          text not null check (length(trim(label)) > 0),
  starts_on      date not null,
  ends_on        date not null,
  note           text,
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  constraint ripiano_date_valide check (ends_on >= starts_on and ends_on - starts_on <= 400),
  constraint ripiano_libero exclude using gist (
    instrument_id with =, shelf with =, daterange(starts_on, ends_on, '[]') with &&
  )
);

create index if not exists chamber_slots_idx on public.chamber_slots (instrument_id, starts_on);

-- ---------------------------------------------------------------------
--  Esercitazioni con gli studenti: stanza, strumenti usati (prenotati
--  per tutto il tempo), numero di studenti. Avviso a tutti quando viene
--  segnata o spostata e il pomeriggio del giorno prima.
-- ---------------------------------------------------------------------
create table if not exists public.practicals (
  id              uuid primary key default gen_random_uuid(),
  title           text not null check (length(trim(title)) > 0),
  course          text,
  teacher         text,
  room            text,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  students        int check (students is null or students between 1 and 999),
  instrument_ids  uuid[] not null default '{}',
  note            text,
  created_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  notified_at     timestamptz,
  reminded_at     timestamptz,
  moved           boolean not null default false,
  created_at      timestamptz not null default now(),
  constraint esercitazione_durata check (ends_at > starts_at and ends_at - starts_at <= interval '14 hours')
);
create index if not exists practicals_time_idx on public.practicals (starts_at);

alter table public.bookings add column if not exists practical_id uuid references public.practicals (id) on delete cascade;
create index if not exists bookings_practical_idx on public.bookings (practical_id) where practical_id is not null;

-- se cambiano giorno, orario o stanza l'avviso riparte
create or replace function public.practicals_before_update()
returns trigger language plpgsql as $$
begin
  if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at or new.room is distinct from old.room then
    new.notified_at := null; new.reminded_at := null; new.moved := true;
  end if;
  return new;
end $$;
drop trigger if exists practicals_before_update on public.practicals;
create trigger practicals_before_update before update on public.practicals
  for each row execute function public.practicals_before_update();

-- le prenotazioni di un'esercitazione si creano solo da save_practical
create or replace function public.bookings_practical_guard()
returns trigger language plpgsql as $$
begin
  if new.practical_id is not null and coalesce(current_setting('labapp.sync', true), '') <> 'esercitazione'
     and (tg_op = 'INSERT' or new.practical_id is distinct from old.practical_id) then
    raise exception 'Le prenotazioni delle esercitazioni si cambiano dall''esercitazione';
  end if;
  return new;
end $$;
drop trigger if exists bookings_practical_guard on public.bookings;
create trigger bookings_practical_guard before insert or update on public.bookings
  for each row execute function public.bookings_practical_guard();

-- crea o modifica un'esercitazione e prenota gli strumenti, tutto o niente
create or replace function public.save_practical(p jsonb)
returns public.practicals
language plpgsql security definer set search_path = public as $$
declare
  r public.practicals;
  ids uuid[];
  i uuid;
  nm text;
  who text;
  pid uuid := nullif(p->>'id', '')::uuid;
begin
  if not public.is_member() then raise exception 'Account non ancora approvato'; end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into ids from jsonb_array_elements_text(coalesce(p->'instrument_ids', '[]'::jsonb)) x;
  if pid is not null then
    update public.practicals set
      title = trim(p->>'title'), course = nullif(trim(p->>'course'), ''), teacher = nullif(trim(p->>'teacher'), ''),
      room = nullif(trim(p->>'room'), ''), starts_at = (p->>'starts_at')::timestamptz, ends_at = (p->>'ends_at')::timestamptz,
      students = nullif(p->>'students', '')::int, instrument_ids = ids, note = nullif(trim(p->>'note'), '')
    where id = pid and (created_by = auth.uid() or public.is_admin())
    returning * into r;
    if r.id is null then raise exception 'La può modificare solo chi l''ha segnata o un amministratore'; end if;
    delete from public.bookings where practical_id = r.id;
  else
    insert into public.practicals (title, course, teacher, room, starts_at, ends_at, students, instrument_ids, note, created_by)
    values (trim(p->>'title'), nullif(trim(p->>'course'), ''), nullif(trim(p->>'teacher'), ''), nullif(trim(p->>'room'), ''),
            (p->>'starts_at')::timestamptz, (p->>'ends_at')::timestamptz, nullif(p->>'students', '')::int, ids, nullif(trim(p->>'note'), ''), auth.uid())
    returning * into r;
  end if;
  perform set_config('labapp.sync', 'esercitazione', true);
  foreach i in array ids loop
    begin
      insert into public.bookings (instrument_id, user_id, starts_at, ends_at, note, practical_id)
      values (i, auth.uid(), r.starts_at, r.ends_at, 'Esercitazione: ' || r.title, r.id);
    exception when exclusion_violation then
      select name into nm from public.instruments where id = i;
      select pr.full_name into who from public.bookings b join public.profiles pr on pr.id = b.user_id
        where b.instrument_id = i and tstzrange(b.starts_at, b.ends_at) && tstzrange(r.starts_at, r.ends_at) limit 1;
      raise exception '%: c''è già una prenotazione% in quell''orario', coalesce(nm, 'Uno strumento'), coalesce(' di ' || who, '');
    end;
  end loop;
  perform set_config('labapp.sync', '', true);
  return r;
end $$;
revoke all on function public.save_practical(jsonb) from public, anon;
grant execute on function public.save_practical(jsonb) to authenticated;

-- ---------------------------------------------------------------------
--  Caffè: chi ha comprato le cialde, a punti (1 punto = una spunta della lavagna = 150 cialde)
-- ---------------------------------------------------------------------
create table if not exists public.coffee_orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  points      int not null default 1 check (points between 1 and 100),
  on_date     date not null default current_date,
  note        text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists coffee_orders_idx on public.coffee_orders (on_date desc, created_at desc);
-- quale caffè è stato comprato (ottobre 2026), per collegare gli acquisti alle recensioni
alter table public.coffee_orders add column if not exists coffee text check (coffee is null or length(btrim(coffee)) between 1 and 80);

-- Recensioni dei caffè: ognuno dà da 1 a 10 piastre a ogni caffè e può cambiare idea
create table if not exists public.coffee_reviews (
  id          uuid primary key default gen_random_uuid(),
  coffee      text not null check (length(btrim(coffee)) between 1 and 80),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating      int not null check (rating between 1 and 10),
  comment     text check (comment is null or length(comment) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists coffee_reviews_one on public.coffee_reviews (lower(btrim(coffee)), user_id);
drop trigger if exists coffee_reviews_touch on public.coffee_reviews;
create trigger coffee_reviews_touch before update on public.coffee_reviews
  for each row execute function public.protocol_runs_touch();

-- Caffè (giro 41): chi non ha ancora l'app resta col nome scritto, come sulla lavagna,
-- e passa da solo al suo profilo quando si registra e viene approvato
alter table public.coffee_orders alter column user_id drop not null;
alter table public.coffee_orders add column if not exists person_name text check (person_name is null or length(btrim(person_name)) between 1 and 60);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'coffee_orders_who') then
    alter table public.coffee_orders add constraint coffee_orders_who check (user_id is not null or person_name is not null);
  end if;
  -- se un utente viene rimosso dall'app i suoi acquisti restano col suo nome
  if exists (select 1 from pg_constraint where conname = 'coffee_orders_user_id_fkey' and confdeltype = 'c') then
    alter table public.coffee_orders drop constraint coffee_orders_user_id_fkey;
    alter table public.coffee_orders add constraint coffee_orders_user_id_fkey foreign key (user_id) references public.profiles (id) on delete set null;
  end if;
end $$;

-- Chi non è più in laboratorio: esce dalla classifica e dai turni, gli acquisti restano nello storico
create table if not exists public.coffee_hidden (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,
  person_name text check (person_name is null or length(btrim(person_name)) between 1 and 60),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check ((user_id is null) <> (person_name is null))
);

-- Il nome ridotto alle sole lettere minuscole, per riconoscere "Mariachiara" in "Maria Chiara Ferrara"
create or replace function public.name_key(t text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(lower(translate(coalesce(t, ''), 'ÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑàáâäèéêëìíîïòóôöùúûüçñ', 'AAAAEEEEIIIIOOOOUUUUCNaaaaeeeeiiiioooouuuucn')), '[^a-z]', '', 'g');
$$;

create unique index if not exists coffee_hidden_user on public.coffee_hidden (user_id) where user_id is not null;
create unique index if not exists coffee_hidden_name on public.coffee_hidden (public.name_key(person_name)) where person_name is not null;

-- Collega i nomi scritti a mano al profilo, se c'è un solo membro approvato con quel nome
-- (il nome, i primi due nomi attaccati o il nome completo)
create or replace function public.coffee_link_names()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  hit uuid;
  cnt int;
  n int := 0;
begin
  for r in select distinct public.name_key(person_name) as k from public.coffee_orders where user_id is null and person_name is not null loop
    continue when r.k = '';
    select count(*), min(p.id::text)::uuid into cnt, hit
      from public.profiles p, lateral (select regexp_split_to_array(btrim(p.full_name), '\s+') as w) x
     where p.role in ('member', 'admin')
       and r.k in (public.name_key(x.w[1]), public.name_key(x.w[1] || coalesce(x.w[2], '')), public.name_key(p.full_name));
    if cnt = 1 then
      update public.coffee_orders set user_id = hit, person_name = null where user_id is null and public.name_key(person_name) = r.k;
      if exists (select 1 from public.coffee_hidden where user_id is null and public.name_key(person_name) = r.k) then
        delete from public.coffee_hidden where user_id is null and public.name_key(person_name) = r.k;
        insert into public.coffee_hidden (user_id, created_by) values (hit, null) on conflict do nothing;
      end if;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Collega a mano un nome a un profilo: a se stessi lo fa chiunque, a un altro solo un amministratore
create or replace function public.coffee_link(p_name text, p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  k text := public.name_key(p_name);
  n int;
begin
  if not public.is_member() then raise exception 'Solo i membri del laboratorio'; end if;
  if p_user is distinct from auth.uid() and not public.is_admin() then
    raise exception 'Puoi collegare un nome solo a te stesso, per gli altri serve un amministratore';
  end if;
  if not exists (select 1 from public.profiles where id = p_user and role in ('member', 'admin')) then
    raise exception 'Questa persona non è un membro approvato';
  end if;
  if k = '' then raise exception 'Nome vuoto'; end if;
  update public.coffee_orders set user_id = p_user, person_name = null where user_id is null and public.name_key(person_name) = k;
  get diagnostics n = row_count;
  if exists (select 1 from public.coffee_hidden where user_id is null and public.name_key(person_name) = k) then
    delete from public.coffee_hidden where user_id is null and public.name_key(person_name) = k;
    insert into public.coffee_hidden (user_id) values (p_user) on conflict do nothing;
  end if;
  return n;
end;
$$;

-- Prima di togliere un utente, i suoi acquisti prendono il suo nome
create or replace function public.coffee_keep_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nm text := left(coalesce(nullif(btrim(old.full_name), ''), 'Senza nome'), 60);
begin
  update public.coffee_orders set person_name = nm where user_id = old.id and person_name is null;
  if exists (select 1 from public.coffee_hidden where user_id = old.id)
     and not exists (select 1 from public.coffee_hidden where public.name_key(person_name) = public.name_key(nm)) then
    insert into public.coffee_hidden (person_name) values (nm);
  end if;
  return old;
end;
$$;
drop trigger if exists coffee_keep_name on public.profiles;
create trigger coffee_keep_name before delete on public.profiles
  for each row execute function public.coffee_keep_name();

-- ---------------------------------------------------------------------
--  Tesisti (giro 41): triennali e magistrali con i referenti, e chi ha finito.
--  Li vedono solo i membri approvati del laboratorio. I nomi dei referenti
--  si scrivono a mano, tutor_ids li collega ai profili per i permessi.
-- ---------------------------------------------------------------------
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null check (length(btrim(full_name)) between 1 and 80),
  level       text not null default 'triennale' check (level in ('triennale', 'magistrale', 'altro')),
  course      text check (course is null or length(course) <= 60),
  topic       text check (topic is null or length(topic) <= 200),
  tutors      text check (tutors is null or length(tutors) <= 120),
  tutor_ids   uuid[] not null default '{}',
  period      text check (period is null or length(period) <= 80),
  graduation  text check (graduation is null or length(graduation) <= 60),
  status      text not null default 'in_corso' check (status in ('in_corso', 'finito', 'ritirato')),
  notes       text check (notes is null or length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists students_status on public.students (status, level);
drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.protocol_runs_touch();

-- Aggiunge ai referenti i membri il cui nome compare tra i referenti scritti a mano,
-- solo se nel laboratorio c'è una sola persona con quel nome
create or replace function public.students_link_tutors()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int := 0;
  c int;
  r record;
begin
  for r in
    select p.id, public.name_key(split_part(btrim(p.full_name), ' ', 1)) as k
      from public.profiles p
     where p.role in ('member', 'admin') and btrim(p.full_name) <> ''
  loop
    continue when r.k = '' or (select count(*) from public.profiles q
      where q.role in ('member', 'admin') and public.name_key(split_part(btrim(q.full_name), ' ', 1)) = r.k) > 1;
    update public.students s set tutor_ids = s.tutor_ids || r.id
     where not (r.id = any (s.tutor_ids))
       and r.k in (select public.name_key(w) from regexp_split_to_table(coalesce(s.tutors, ''), '[^[:alpha:]]+') w);
    get diagnostics c = row_count;
    n := n + c;
  end loop;
  return n;
end;
$$;

-- Quando un utente viene approvato (o cambia nome) si collegano caffè e tesisti
create or replace function public.coffee_profiles_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in ('member', 'admin') then
    perform public.coffee_link_names();
    perform public.students_link_tutors();
  end if;
  return new;
end;
$$;
drop trigger if exists coffee_profiles_link on public.profiles;
create trigger coffee_profiles_link after insert or update of role, full_name on public.profiles
  for each row execute function public.coffee_profiles_link();

-- ---------------------------------------------------------------------
--  Fondi: budget e spese, visibili SOLO ai responsabili di ciascun fondo
--  (nemmeno gli amministratori dell'app li vedono se non sono responsabili)
-- ---------------------------------------------------------------------
create table if not exists public.funds (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  code        text,
  budget      numeric(12, 2) not null default 0 check (budget >= 0),
  ends_on     date,
  notes       text,
  active      boolean not null default true,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table if not exists public.fund_managers (
  fund_id   uuid not null references public.funds (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  added_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  added_at  timestamptz not null default now(),
  primary key (fund_id, user_id)
);

create table if not exists public.fund_expenses (
  id           uuid primary key default gen_random_uuid(),
  fund_id      uuid not null references public.funds (id) on delete cascade,
  amount       numeric(12, 2) not null check (amount > 0),
  spent_on     date not null default current_date,
  description  text not null check (length(trim(description)) > 0),
  supplier     text,
  request_id   uuid references public.order_requests (id) on delete set null,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table public.fund_expenses add column if not exists items jsonb not null default '[]'::jsonb;

create index if not exists fund_expenses_idx on public.fund_expenses (fund_id, spent_on desc);
create index if not exists fund_expenses_request_idx on public.fund_expenses (request_id) where request_id is not null;

create or replace function public.is_fund_manager(p_fund uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_member() and exists (
    select 1 from public.fund_managers where fund_id = p_fund and user_id = auth.uid()
  );
$$;

-- Nuovo fondo: chi lo crea ne diventa il primo responsabile
create or replace function public.create_fund(p_name text, p_code text, p_budget numeric, p_ends_on date, p_notes text)
returns public.funds
language plpgsql
security definer
set search_path = ''
as $$
declare
  f public.funds;
begin
  if not public.is_member() then raise exception 'Account non ancora approvato'; end if;
  insert into public.funds (name, code, budget, ends_on, notes, created_by)
  values (trim(p_name), nullif(trim(p_code), ''), coalesce(p_budget, 0), p_ends_on, nullif(trim(p_notes), ''), auth.uid())
  returning * into f;
  insert into public.fund_managers (fund_id, user_id, added_by) values (f.id, auth.uid(), auth.uid());
  return f;
end;
$$;

-- Un fondo resta sempre con almeno un responsabile
create or replace function public.fund_managers_keep_one()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.funds where id = old.fund_id)
     and not exists (select 1 from public.fund_managers where fund_id = old.fund_id and user_id <> old.user_id) then
    raise exception 'Il fondo deve avere almeno un responsabile';
  end if;
  return old;
end;
$$;

create or replace trigger fund_managers_keep_one
  before delete on public.fund_managers
  for each row execute function public.fund_managers_keep_one();

create or replace function public.fund_expenses_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.description := trim(new.description);
  new.supplier := nullif(trim(new.supplier), '');
  if tg_op = 'UPDATE' then new.created_by := old.created_by; new.created_at := old.created_at; end if;
  return new;
end;
$$;

create or replace trigger fund_expenses_before_write
  before insert or update on public.fund_expenses
  for each row execute function public.fund_expenses_before_write();

-- Foto in uno spazio privato visibile solo ai membri
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "foto: viste dai membri" on storage.objects;
create policy "foto: viste dai membri" on storage.objects
  for select to authenticated using (bucket_id = 'foto' and public.is_member() and (
    objects.name not like 'diario/%' or objects.owner = auth.uid()
    or exists (select 1 from public.lab_journal j where objects.name = any (j.photos))));
drop policy if exists "foto: caricate dai membri" on storage.objects;
create policy "foto: caricate dai membri" on storage.objects
  for insert to authenticated with check (bucket_id = 'foto' and public.is_member());
-- File dei documenti (giro 21): fino a 20 MB, PDF, fogli, testi, immagini, sequenze, archivi; li vedono i membri
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documenti', 'documenti', false, 20971520, array['application/pdf', 'text/plain', 'text/csv', 'image/jpeg', 'image/png', 'image/webp', 'image/tiff',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-excel', 'application/msword', 'application/zip', 'application/octet-stream'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "documenti: visti dai membri" on storage.objects;
create policy "documenti: visti dai membri" on storage.objects
  for select to authenticated using (bucket_id = 'documenti' and public.is_member());
drop policy if exists "documenti: caricati dai membri" on storage.objects;
create policy "documenti: caricati dai membri" on storage.objects
  for insert to authenticated with check (bucket_id = 'documenti' and public.is_member());
drop policy if exists "documenti: cancellati da chi li ha caricati o da un admin" on storage.objects;
create policy "documenti: cancellati da chi li ha caricati o da un admin" on storage.objects
  for delete to authenticated using (bucket_id = 'documenti' and (owner = auth.uid() or public.is_admin()));
drop policy if exists "foto: cancellate da chi le ha caricate o da un admin" on storage.objects;
create policy "foto: cancellate da chi le ha caricate o da un admin" on storage.objects
  for delete to authenticated using (bucket_id = 'foto' and (owner = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------
--  Notifiche push: un'iscrizione per ogni telefono
-- ---------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'Account non ancora approvato';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_user_agent)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        created_at = now();
end;
$$;

-- ---------------------------------------------------------------------
--  Sicurezza (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.items              enable row level security;
alter table public.alerts             enable row level security;
alter table public.instruments        enable row level security;
alter table public.bookings           enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.item_log           enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_log           enable row level security;
alter table public.issues             enable row level security;
alter table public.issue_comments     enable row level security;
alter table public.cylinders          enable row level security;
alter table public.item_codes         enable row level security;
alter table public.flowcells          enable row level security;
alter table public.flowcell_checks    enable row level security;
alter table public.protocols          enable row level security;
alter table public.order_requests     enable row level security;
alter table public.waste_containers   enable row level security;
alter table public.strains            enable row level security;
alter table public.strain_events      enable row level security;
alter table public.strain_photos      enable row level security;
alter table public.strain_seqs        enable row level security;
alter table public.lab_docs           enable row level security;
alter table public.strain_stocks      enable row level security;
alter table public.funds              enable row level security;
alter table public.fund_managers      enable row level security;
alter table public.fund_expenses      enable row level security;
alter table public.freezers           enable row level security;
alter table public.boxes              enable row level security;
alter table public.box_slots          enable row level security;
alter table public.instrument_log     enable row level security;
alter table public.lc_columns         enable row level security;
alter table public.chamber_slots      enable row level security;
alter table public.practicals         enable row level security;
alter table public.protocol_runs      enable row level security;
alter table public.lab_journal        enable row level security;
alter table public.lab_journal_versions enable row level security;
alter table public.lab_projects       enable row level security;
alter table public.coffee_orders      enable row level security;
alter table public.coffee_reviews     enable row level security;
alter table public.coffee_hidden      enable row level security;
alter table public.students           enable row level security;
alter table public.lab_authors        enable row level security;
alter table public.paper_skip         enable row level security;
alter table public.journal_shares     enable row level security;
alter table public.backups            enable row level security;
alter table public.ai_usage           enable row level security;

revoke all on public.profiles, public.items, public.alerts, public.instruments,
              public.bookings, public.push_subscriptions, public.item_log,
              public.tasks, public.task_log, public.issues, public.issue_comments,
              public.cylinders, public.item_codes, public.flowcells,
              public.flowcell_checks, public.protocols, public.order_requests, public.waste_containers,
              public.strains, public.strain_events, public.strain_photos, public.strain_seqs, public.lab_docs, public.strain_stocks, public.freezers, public.boxes, public.box_slots,
              public.instrument_log, public.lc_columns, public.chamber_slots, public.coffee_orders, public.coffee_reviews, public.coffee_hidden, public.students, public.lab_authors, public.paper_skip, public.practicals, public.protocol_runs, public.lab_journal, public.lab_journal_versions, public.lab_projects, public.journal_shares, public.backups, public.ai_usage,
              public.funds, public.fund_managers, public.fund_expenses from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, prefs) on public.profiles to authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select on public.alerts to authenticated;
grant select, insert, update, delete on public.instruments to authenticated;
grant select, insert, update, delete on public.bookings to authenticated;
grant select, delete on public.push_subscriptions to authenticated;
grant select on public.item_log to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, delete on public.task_log to authenticated;
grant select, delete on public.issues to authenticated;
grant insert (title, description, location, urgency, status, photos, kind, incident_type, happened_at, involved, item_id, instrument_id, actions) on public.issues to authenticated;
grant update (title, description, location, urgency, status, photos, kind, incident_type, happened_at, involved, item_id, instrument_id, actions) on public.issues to authenticated;
grant select, insert, delete on public.issue_comments to authenticated;
grant select, insert, update, delete on public.cylinders to authenticated;
grant select on public.item_codes to authenticated;
grant select, delete on public.flowcells to authenticated;
grant insert (code, kind, batch, received_on, expiry, status, run_note, notes) on public.flowcells to authenticated;
grant update (code, kind, batch, received_on, expiry, status, run_note, notes) on public.flowcells to authenticated;
grant select, delete on public.flowcell_checks to authenticated;
grant insert (flowcell_id, pores, checked_at, note) on public.flowcell_checks to authenticated;
grant select, insert, update, delete on public.protocols to authenticated;
grant select, insert, update, delete on public.order_requests to authenticated;
grant select, insert, update, delete on public.waste_containers to authenticated;
grant select, insert, update, delete on public.strains to authenticated;
grant select, delete on public.strain_events to authenticated;
grant insert (strain_id, kind, note, on_date) on public.strain_events to authenticated;
grant select, delete on public.strain_photos to authenticated;
grant insert (strain_id, path, kind, side, medium, temp_c, age_days, passage, light, taken_on, note) on public.strain_photos to authenticated;
grant update (kind, side, medium, temp_c, age_days, passage, light, taken_on, note) on public.strain_photos to authenticated;
grant select, delete on public.strain_seqs to authenticated;
grant insert (strain_id, locus, header, seq, accession, note) on public.strain_seqs to authenticated;
grant update (locus, header, seq, accession, note) on public.strain_seqs to authenticated;
grant select, delete on public.lab_docs to authenticated;
grant insert (kind, title, authors, journal, year, doi, url, path, file_name, mime, size, note, links, abstract, pdf_url, license) on public.lab_docs to authenticated;
grant update (kind, title, authors, journal, year, doi, url, path, file_name, mime, size, note, links, abstract, pdf_url, license) on public.lab_docs to authenticated;
grant select, delete on public.lab_authors to authenticated;
grant insert (full_name, orcids, active) on public.lab_authors to authenticated;
grant update (full_name, orcids, active) on public.lab_authors to authenticated;
grant select, delete on public.strain_stocks to authenticated;
grant insert (strain_id, kind, made_on, renew_months, qty, place, keeper_id, note, status, snooze_until) on public.strain_stocks to authenticated;
grant update (kind, made_on, renew_months, qty, place, keeper_id, note, status, snooze_until) on public.strain_stocks to authenticated;
grant select, insert, update, delete on public.freezers to authenticated;
grant select, insert, update, delete on public.boxes to authenticated;
grant select, insert, update, delete on public.box_slots to authenticated;
grant select, delete on public.instrument_log to authenticated;
grant insert (instrument_id, kind, body, at) on public.instrument_log to authenticated;
grant select, insert, update, delete on public.lc_columns to authenticated;
grant select, insert, update, delete on public.chamber_slots to authenticated;
grant select, delete on public.practicals to authenticated;
grant select, delete on public.protocol_runs to authenticated;
grant insert (protocol_id, protocol_title, label, run_on, amount, unit, reagents, steps_done, steps_total, params, notes, problems, status, project_id) on public.protocol_runs to authenticated;
grant update (label, run_on, amount, unit, reagents, steps_done, steps_total, params, notes, problems, status, project_id) on public.protocol_runs to authenticated;
grant select, delete on public.lab_journal to authenticated;
grant insert (day, title, samples, notes, problems, project_id, aim, results, next_steps, tags, photos, photo_caps, links, materials, proto_changes, signed_at, addenda) on public.lab_journal to authenticated;
grant update (day, title, samples, notes, problems, project_id, aim, results, next_steps, tags, photos, photo_caps, links, materials, proto_changes, signed_at, addenda) on public.lab_journal to authenticated;
grant select on public.lab_journal_versions to authenticated;
grant select, delete on public.lab_projects to authenticated;
grant insert (name, description, active, members) on public.lab_projects to authenticated;
grant update (name, description, active, members) on public.lab_projects to authenticated;
grant select, delete on public.journal_shares to authenticated;
grant insert (viewer_id, project_id, from_day, to_day, entry_ids, include_runs, note) on public.journal_shares to authenticated;
grant update (project_id, from_day, to_day, entry_ids, include_runs, note) on public.journal_shares to authenticated;
grant select (id, made_at, kind, made_by, counts, bytes, data), delete on public.backups to authenticated;
grant select on public.ai_usage to authenticated;
grant select, delete on public.coffee_orders to authenticated;
grant insert (user_id, person_name, points, on_date, note, coffee) on public.coffee_orders to authenticated;
grant update (user_id, person_name, points, on_date, note, coffee) on public.coffee_orders to authenticated;
grant select, delete on public.coffee_hidden to authenticated;
grant insert (user_id, person_name) on public.coffee_hidden to authenticated;
grant select, delete on public.students to authenticated;
grant insert (full_name, level, course, topic, tutors, tutor_ids, period, graduation, status, notes) on public.students to authenticated;
grant update (full_name, level, course, topic, tutors, tutor_ids, period, graduation, status, notes) on public.students to authenticated;
grant select, delete on public.coffee_reviews to authenticated;
grant insert (coffee, rating, comment) on public.coffee_reviews to authenticated;
grant update (coffee, rating, comment) on public.coffee_reviews to authenticated;
grant select, delete on public.funds to authenticated;
grant update (name, code, budget, ends_on, notes, active) on public.funds to authenticated;
grant select, delete on public.fund_managers to authenticated;
grant insert (fund_id, user_id) on public.fund_managers to authenticated;
grant select, delete on public.fund_expenses to authenticated;
grant insert (fund_id, amount, spent_on, description, supplier, request_id, items) on public.fund_expenses to authenticated;
grant update (fund_id, amount, spent_on, description, supplier, request_id, items) on public.fund_expenses to authenticated;

drop policy if exists "profili leggibili dai membri" on public.profiles;
create policy "profili leggibili dai membri" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_member());
drop policy if exists "ognuno modifica il proprio nome" on public.profiles;
create policy "ognuno modifica il proprio nome" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "inventario: lettura" on public.items;
create policy "inventario: lettura" on public.items
  for select to authenticated using (public.is_member());
drop policy if exists "inventario: inserimento" on public.items;
create policy "inventario: inserimento" on public.items
  for insert to authenticated with check (public.is_member());
drop policy if exists "inventario: modifica" on public.items;
create policy "inventario: modifica" on public.items
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "inventario: eliminazione" on public.items;
create policy "inventario: eliminazione" on public.items
  for delete to authenticated using (public.is_member());

drop policy if exists "segnalazioni: lettura" on public.alerts;
create policy "segnalazioni: lettura" on public.alerts
  for select to authenticated using (public.is_member());

drop policy if exists "strumenti: lettura" on public.instruments;
create policy "strumenti: lettura" on public.instruments
  for select to authenticated using (public.is_member());
drop policy if exists "strumenti: gestione admin" on public.instruments;
create policy "strumenti: gestione admin" on public.instruments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "prenotazioni: lettura" on public.bookings;
create policy "prenotazioni: lettura" on public.bookings
  for select to authenticated using (public.is_member());
drop policy if exists "prenotazioni: nuove a proprio nome" on public.bookings;
create policy "prenotazioni: nuove a proprio nome" on public.bookings
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "prenotazioni: modifica proprie" on public.bookings;
create policy "prenotazioni: modifica proprie" on public.bookings
  for update to authenticated
  using (public.is_member() and (user_id = auth.uid() or public.is_admin()))
  with check (public.is_member() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "prenotazioni: cancella proprie" on public.bookings;
create policy "prenotazioni: cancella proprie" on public.bookings
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists "storico: lettura" on public.item_log;
create policy "storico: lettura" on public.item_log
  for select to authenticated using (public.is_member());

drop policy if exists "compiti: lettura" on public.tasks;
create policy "compiti: lettura" on public.tasks
  for select to authenticated using (public.is_member());
drop policy if exists "compiti: inserimento" on public.tasks;
create policy "compiti: inserimento" on public.tasks
  for insert to authenticated with check (public.is_member());
drop policy if exists "compiti: modifica" on public.tasks;
create policy "compiti: modifica" on public.tasks
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "compiti: eliminazione" on public.tasks;
create policy "compiti: eliminazione" on public.tasks
  for delete to authenticated using (public.is_member());
drop policy if exists "registro compiti: lettura" on public.task_log;
create policy "registro compiti: lettura" on public.task_log
  for select to authenticated using (public.is_member());
drop policy if exists "registro compiti: a proprio nome" on public.task_log;
create policy "registro compiti: a proprio nome" on public.task_log
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "registro compiti: annulla il proprio" on public.task_log;
create policy "registro compiti: annulla il proprio" on public.task_log
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists "problemi: lettura" on public.issues;
create policy "problemi: lettura" on public.issues
  for select to authenticated using (public.is_member());
drop policy if exists "problemi: segnalazione" on public.issues;
create policy "problemi: segnalazione" on public.issues
  for insert to authenticated with check (public.is_member());
drop policy if exists "problemi: aggiornamento" on public.issues;
create policy "problemi: aggiornamento" on public.issues
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "problemi: eliminazione" on public.issues;
create policy "problemi: eliminazione" on public.issues
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "commenti: lettura" on public.issue_comments;
create policy "commenti: lettura" on public.issue_comments
  for select to authenticated using (public.is_member());
drop policy if exists "commenti: a proprio nome" on public.issue_comments;
create policy "commenti: a proprio nome" on public.issue_comments
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "commenti: cancella i propri" on public.issue_comments;
create policy "commenti: cancella i propri" on public.issue_comments
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

drop policy if exists "bombole: lettura" on public.cylinders;
create policy "bombole: lettura" on public.cylinders
  for select to authenticated using (public.is_member());
drop policy if exists "bombole: inserimento" on public.cylinders;
create policy "bombole: inserimento" on public.cylinders
  for insert to authenticated with check (public.is_member());
drop policy if exists "bombole: modifica" on public.cylinders;
create policy "bombole: modifica" on public.cylinders
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "bombole: eliminazione" on public.cylinders;
create policy "bombole: eliminazione" on public.cylinders
  for delete to authenticated using (public.is_member());

drop policy if exists "etichette numerate: lettura" on public.item_codes;
create policy "etichette numerate: lettura" on public.item_codes
  for select to authenticated using (public.is_member());

drop policy if exists "flow cell: lettura" on public.flowcells;
create policy "flow cell: lettura" on public.flowcells
  for select to authenticated using (public.is_member());
drop policy if exists "flow cell: inserimento" on public.flowcells;
create policy "flow cell: inserimento" on public.flowcells
  for insert to authenticated with check (public.is_member());
drop policy if exists "flow cell: modifica" on public.flowcells;
create policy "flow cell: modifica" on public.flowcells
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "flow cell: eliminazione" on public.flowcells;
create policy "flow cell: eliminazione" on public.flowcells
  for delete to authenticated using (public.is_member());
drop policy if exists "check pori: lettura" on public.flowcell_checks;
create policy "check pori: lettura" on public.flowcell_checks
  for select to authenticated using (public.is_member());
drop policy if exists "check pori: a proprio nome" on public.flowcell_checks;
create policy "check pori: a proprio nome" on public.flowcell_checks
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "check pori: cancella i propri" on public.flowcell_checks;
create policy "check pori: cancella i propri" on public.flowcell_checks
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists "protocolli: lettura" on public.protocols;
create policy "protocolli: lettura" on public.protocols
  for select to authenticated using (public.is_member());
drop policy if exists "protocolli: inserimento" on public.protocols;
create policy "protocolli: inserimento" on public.protocols
  for insert to authenticated with check (public.is_member());
drop policy if exists "protocolli: modifica" on public.protocols;
create policy "protocolli: modifica" on public.protocols
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "protocolli: eliminazione" on public.protocols;
create policy "protocolli: eliminazione" on public.protocols
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

drop policy if exists "richieste: lettura" on public.order_requests;
create policy "richieste: lettura" on public.order_requests
  for select to authenticated using (public.is_member());
drop policy if exists "richieste: inserimento" on public.order_requests;
create policy "richieste: inserimento" on public.order_requests
  for insert to authenticated with check (public.is_member());
drop policy if exists "richieste: modifica" on public.order_requests;
create policy "richieste: modifica" on public.order_requests
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "richieste: eliminazione" on public.order_requests;
create policy "richieste: eliminazione" on public.order_requests
  for delete to authenticated using (public.is_member() and (requested_by = auth.uid() or public.is_admin()));

drop policy if exists "taniche: lettura" on public.waste_containers;
create policy "taniche: lettura" on public.waste_containers
  for select to authenticated using (public.is_member());
drop policy if exists "taniche: inserimento" on public.waste_containers;
create policy "taniche: inserimento" on public.waste_containers
  for insert to authenticated with check (public.is_member());
drop policy if exists "taniche: modifica" on public.waste_containers;
create policy "taniche: modifica" on public.waste_containers
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "taniche: eliminazione" on public.waste_containers;
create policy "taniche: eliminazione" on public.waste_containers
  for delete to authenticated using (public.is_member());

drop policy if exists "ceppi: lettura" on public.strains;
create policy "ceppi: lettura" on public.strains
  for select to authenticated using (public.is_member());
drop policy if exists "ceppi: inserimento" on public.strains;
create policy "ceppi: inserimento" on public.strains
  for insert to authenticated with check (public.is_member());
drop policy if exists "ceppi: modifica" on public.strains;
create policy "ceppi: modifica" on public.strains
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "ceppi: eliminazione" on public.strains;
create policy "ceppi: eliminazione" on public.strains
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "eventi ceppi: lettura" on public.strain_events;
create policy "eventi ceppi: lettura" on public.strain_events
  for select to authenticated using (public.is_member());
drop policy if exists "eventi ceppi: a proprio nome" on public.strain_events;
create policy "eventi ceppi: a proprio nome" on public.strain_events
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "eventi ceppi: cancella i propri" on public.strain_events;
create policy "eventi ceppi: cancella i propri" on public.strain_events
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "esecuzioni: lettura" on public.protocol_runs;
create policy "esecuzioni: lettura" on public.protocol_runs
  for select to authenticated using (public.is_member());
drop policy if exists "esecuzioni: a proprio nome" on public.protocol_runs;
create policy "esecuzioni: a proprio nome" on public.protocol_runs
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "esecuzioni: modifica chi le ha fatte" on public.protocol_runs;
create policy "esecuzioni: modifica chi le ha fatte" on public.protocol_runs
  for update to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "esecuzioni: cancella chi le ha fatte" on public.protocol_runs;
create policy "esecuzioni: cancella chi le ha fatte" on public.protocol_runs
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

-- giro 54: il diario lo leggono solo chi lo scrive e chi lo riceve con Manda (o con l'accesso d'emergenza)
drop policy if exists "diario: lo legge chi lo scrive e l'amministratore" on public.lab_journal;
drop policy if exists "diario: lo legge chi lo scrive e chi lo riceve" on public.lab_journal;
create policy "diario: lo legge chi lo scrive e chi lo riceve" on public.lab_journal
  for select to authenticated using (public.is_member() and (user_id = auth.uid() or public.journal_shared(user_id, project_id, day, id)));
drop policy if exists "diario: a proprio nome" on public.lab_journal;
create policy "diario: a proprio nome" on public.lab_journal
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "diario: modifica solo chi lo scrive" on public.lab_journal;
create policy "diario: modifica solo chi lo scrive" on public.lab_journal
  for update to authenticated using (public.is_member() and user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());
drop policy if exists "diario: cancella solo chi lo scrive" on public.lab_journal;
create policy "diario: cancella solo chi lo scrive" on public.lab_journal
  for delete to authenticated using (public.is_member() and user_id = auth.uid() and signed_at is null);
drop policy if exists "diario: versioni di chi lo scrive e dell'amministratore" on public.lab_journal_versions;
drop policy if exists "diario: versioni di chi lo scrive" on public.lab_journal_versions;
create policy "diario: versioni di chi lo scrive" on public.lab_journal_versions
  for select to authenticated using (public.is_member() and exists (select 1 from public.lab_journal j where j.id = entry_id and j.user_id = auth.uid()));
drop policy if exists "condivisioni: le vede chi manda, chi riceve e l'amministratore" on public.journal_shares;
drop policy if exists "condivisioni: le vedono chi manda e chi riceve" on public.journal_shares;
create policy "condivisioni: le vedono chi manda e chi riceve" on public.journal_shares
  for select to authenticated using (public.is_member() and (owner_id = auth.uid() or viewer_id = auth.uid()));
drop policy if exists "condivisioni: il proprio diario a un collega" on public.journal_shares;
create policy "condivisioni: il proprio diario a un collega" on public.journal_shares
  for insert to authenticated with check (public.is_member() and owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = viewer_id and p.role in ('member', 'admin')));
drop policy if exists "condivisioni: le cambia chi le ha mandate" on public.journal_shares;
create policy "condivisioni: le cambia chi le ha mandate" on public.journal_shares
  for update to authenticated using (public.is_member() and owner_id = auth.uid() and not forced) with check (public.is_member() and owner_id = auth.uid() and not forced);
drop policy if exists "condivisioni: le toglie chi manda o chi riceve" on public.journal_shares;
create policy "condivisioni: le toglie chi manda o chi riceve" on public.journal_shares
  for delete to authenticated using (public.is_member() and ((owner_id = auth.uid() and not forced) or viewer_id = auth.uid()));
-- giro 54: nelle copie c'è tutto, diari e fondi compresi: solo lo sviluppatore
drop policy if exists "copie: solo l'amministratore" on public.backups;
drop policy if exists "copie: solo lo sviluppatore" on public.backups;
create policy "copie: solo lo sviluppatore" on public.backups
  for select to authenticated using (public.is_developer());
drop policy if exists "copie: le cancella l'amministratore" on public.backups;
drop policy if exists "copie: le cancella lo sviluppatore" on public.backups;
create policy "copie: le cancella lo sviluppatore" on public.backups
  for delete to authenticated using (public.is_developer());
drop policy if exists "AI: ognuno vede le sue pagine lette" on public.ai_usage;
create policy "AI: ognuno vede le sue pagine lette" on public.ai_usage
  for select to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "progetti: lettura" on public.lab_projects;
create policy "progetti: lettura" on public.lab_projects
  for select to authenticated using (public.is_member());
drop policy if exists "progetti: li crea chi lavora in laboratorio" on public.lab_projects;
create policy "progetti: li crea chi lavora in laboratorio" on public.lab_projects
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "progetti: modifica chi li ha creati o l'amministratore" on public.lab_projects;
create policy "progetti: modifica chi li ha creati o l'amministratore" on public.lab_projects
  for update to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin())) with check (public.is_member());
drop policy if exists "progetti: cancella chi li ha creati o l'amministratore" on public.lab_projects;
create policy "progetti: cancella chi li ha creati o l'amministratore" on public.lab_projects
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

drop policy if exists "esercitazioni: lettura" on public.practicals;
create policy "esercitazioni: lettura" on public.practicals
  for select to authenticated using (public.is_member());
drop policy if exists "esercitazioni: cancella chi le ha segnate" on public.practicals;
create policy "esercitazioni: cancella chi le ha segnate" on public.practicals
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

drop policy if exists "sequenze: lettura" on public.strain_seqs;
create policy "sequenze: lettura" on public.strain_seqs
  for select to authenticated using (public.is_member());
drop policy if exists "sequenze: a proprio nome" on public.strain_seqs;
create policy "sequenze: a proprio nome" on public.strain_seqs
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "sequenze: modifica chi le ha messe" on public.strain_seqs;
create policy "sequenze: modifica chi le ha messe" on public.strain_seqs
  for update to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_member());
drop policy if exists "sequenze: cancella chi le ha messe" on public.strain_seqs;
create policy "sequenze: cancella chi le ha messe" on public.strain_seqs
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
-- i documenti sono di tutto il laboratorio: chiunque li collega a un campione o li corregge, li cancella chi li ha messi o un amministratore
drop policy if exists "documenti: lettura" on public.lab_docs;
create policy "documenti: lettura" on public.lab_docs
  for select to authenticated using (public.is_member());
drop policy if exists "documenti: a proprio nome" on public.lab_docs;
create policy "documenti: a proprio nome" on public.lab_docs
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "documenti: modifica chi lavora in laboratorio" on public.lab_docs;
create policy "documenti: modifica chi lavora in laboratorio" on public.lab_docs
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "documenti: cancella chi li ha messi" on public.lab_docs;
create policy "documenti: cancella chi li ha messi" on public.lab_docs
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "persone seguite: lettura" on public.lab_authors;
create policy "persone seguite: lettura" on public.lab_authors
  for select to authenticated using (public.is_member());
drop policy if exists "persone seguite: aggiunge un amministratore" on public.lab_authors;
create policy "persone seguite: aggiunge un amministratore" on public.lab_authors
  for insert to authenticated with check (public.is_admin() and created_by = auth.uid());
drop policy if exists "persone seguite: modifica un amministratore" on public.lab_authors;
create policy "persone seguite: modifica un amministratore" on public.lab_authors
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "persone seguite: toglie un amministratore" on public.lab_authors;
create policy "persone seguite: toglie un amministratore" on public.lab_authors
  for delete to authenticated using (public.is_admin());
drop policy if exists "foto ceppi: lettura" on public.strain_photos;
create policy "foto ceppi: lettura" on public.strain_photos
  for select to authenticated using (public.is_member());
drop policy if exists "foto ceppi: a proprio nome" on public.strain_photos;
create policy "foto ceppi: a proprio nome" on public.strain_photos
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "foto ceppi: modifica chi le ha messe" on public.strain_photos;
create policy "foto ceppi: modifica chi le ha messe" on public.strain_photos
  for update to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()))
  with check (public.is_member());
drop policy if exists "foto ceppi: cancella chi le ha messe" on public.strain_photos;
create policy "foto ceppi: cancella chi le ha messe" on public.strain_photos
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "conservazioni: lettura" on public.strain_stocks;
create policy "conservazioni: lettura" on public.strain_stocks
  for select to authenticated using (public.is_member());
drop policy if exists "conservazioni: inserimento" on public.strain_stocks;
create policy "conservazioni: inserimento" on public.strain_stocks
  for insert to authenticated with check (public.is_member());
drop policy if exists "conservazioni: modifica" on public.strain_stocks;
create policy "conservazioni: modifica" on public.strain_stocks
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "conservazioni: eliminazione" on public.strain_stocks;
create policy "conservazioni: eliminazione" on public.strain_stocks
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or keeper_id = auth.uid() or public.is_admin()));

drop policy if exists "congelatori: lettura" on public.freezers;
create policy "congelatori: lettura" on public.freezers
  for select to authenticated using (public.is_member());
drop policy if exists "congelatori: inserimento" on public.freezers;
create policy "congelatori: inserimento" on public.freezers
  for insert to authenticated with check (public.is_member());
drop policy if exists "congelatori: modifica" on public.freezers;
create policy "congelatori: modifica" on public.freezers
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "congelatori: eliminazione" on public.freezers;
create policy "congelatori: eliminazione" on public.freezers
  for delete to authenticated using (public.is_admin());

drop policy if exists "scatole: lettura" on public.boxes;
create policy "scatole: lettura" on public.boxes
  for select to authenticated using (public.is_member());
drop policy if exists "scatole: inserimento" on public.boxes;
create policy "scatole: inserimento" on public.boxes
  for insert to authenticated with check (public.is_member());
drop policy if exists "scatole: modifica" on public.boxes;
create policy "scatole: modifica" on public.boxes
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "scatole: eliminazione" on public.boxes;
create policy "scatole: eliminazione" on public.boxes
  for delete to authenticated using (public.is_member());

drop policy if exists "posizioni: lettura" on public.box_slots;
create policy "posizioni: lettura" on public.box_slots
  for select to authenticated using (public.is_member());
drop policy if exists "posizioni: inserimento" on public.box_slots;
create policy "posizioni: inserimento" on public.box_slots
  for insert to authenticated with check (public.is_member());
drop policy if exists "posizioni: modifica" on public.box_slots;
create policy "posizioni: modifica" on public.box_slots
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "posizioni: eliminazione" on public.box_slots;
create policy "posizioni: eliminazione" on public.box_slots
  for delete to authenticated using (public.is_member());

drop policy if exists "registro strumenti: lettura" on public.instrument_log;
create policy "registro strumenti: lettura" on public.instrument_log
  for select to authenticated using (public.is_member());
drop policy if exists "registro strumenti: a proprio nome" on public.instrument_log;
create policy "registro strumenti: a proprio nome" on public.instrument_log
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "registro strumenti: cancella i propri" on public.instrument_log;
create policy "registro strumenti: cancella i propri" on public.instrument_log
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists "colonne: lettura" on public.lc_columns;
create policy "colonne: lettura" on public.lc_columns
  for select to authenticated using (public.is_member());
drop policy if exists "colonne: inserimento" on public.lc_columns;
create policy "colonne: inserimento" on public.lc_columns
  for insert to authenticated with check (public.is_member());
drop policy if exists "colonne: modifica" on public.lc_columns;
create policy "colonne: modifica" on public.lc_columns
  for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "colonne: eliminazione" on public.lc_columns;
create policy "colonne: eliminazione" on public.lc_columns
  for delete to authenticated using (public.is_member());

drop policy if exists "ripiani: lettura" on public.chamber_slots;
create policy "ripiani: lettura" on public.chamber_slots
  for select to authenticated using (public.is_member());
drop policy if exists "ripiani: a proprio nome" on public.chamber_slots;
create policy "ripiani: a proprio nome" on public.chamber_slots
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "ripiani: modifica propri" on public.chamber_slots;
create policy "ripiani: modifica propri" on public.chamber_slots
  for update to authenticated
  using (public.is_member() and (user_id = auth.uid() or public.is_admin()))
  with check (public.is_member() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "ripiani: libera propri" on public.chamber_slots;
create policy "ripiani: libera propri" on public.chamber_slots
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));

drop policy if exists "recensioni caffè: lettura" on public.coffee_reviews;
create policy "recensioni caffè: lettura" on public.coffee_reviews
  for select to authenticated using (public.is_member());
drop policy if exists "recensioni caffè: a proprio nome" on public.coffee_reviews;
create policy "recensioni caffè: a proprio nome" on public.coffee_reviews
  for insert to authenticated with check (public.is_member() and user_id = auth.uid());
drop policy if exists "recensioni caffè: cambia la propria" on public.coffee_reviews;
create policy "recensioni caffè: cambia la propria" on public.coffee_reviews
  for update to authenticated using (public.is_member() and user_id = auth.uid()) with check (public.is_member() and user_id = auth.uid());
drop policy if exists "recensioni caffè: cancella la propria" on public.coffee_reviews;
create policy "recensioni caffè: cancella la propria" on public.coffee_reviews
  for delete to authenticated using (public.is_member() and (user_id = auth.uid() or public.is_admin()));
drop policy if exists "caffè: lettura" on public.coffee_orders;
create policy "caffè: lettura" on public.coffee_orders
  for select to authenticated using (public.is_member());
drop policy if exists "caffè: registra" on public.coffee_orders;
create policy "caffè: registra" on public.coffee_orders
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "caffè: correggi i propri" on public.coffee_orders;
create policy "caffè: correggi i propri" on public.coffee_orders
  for update to authenticated
  using (public.is_member() and (created_by = auth.uid() or user_id = auth.uid() or public.is_admin()))
  with check (public.is_member());
drop policy if exists "caffè: cancella i propri" on public.coffee_orders;
create policy "caffè: cancella i propri" on public.coffee_orders
  for delete to authenticated using (public.is_member() and (created_by = auth.uid() or user_id = auth.uid() or public.is_admin()));
drop policy if exists "caffè, non più in lab: lettura" on public.coffee_hidden;
create policy "caffè, non più in lab: lettura" on public.coffee_hidden
  for select to authenticated using (public.is_member());
drop policy if exists "caffè, non più in lab: segna" on public.coffee_hidden;
create policy "caffè, non più in lab: segna" on public.coffee_hidden
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "caffè, non più in lab: rimetti" on public.coffee_hidden;
create policy "caffè, non più in lab: rimetti" on public.coffee_hidden
  for delete to authenticated using (public.is_member());

drop policy if exists "tesisti: lettura dei membri" on public.students;
create policy "tesisti: lettura dei membri" on public.students
  for select to authenticated using (public.is_member());
drop policy if exists "tesisti: aggiunge un membro" on public.students;
create policy "tesisti: aggiunge un membro" on public.students
  for insert to authenticated with check (public.is_member() and created_by = auth.uid());
drop policy if exists "tesisti: modificano i referenti" on public.students;
create policy "tesisti: modificano i referenti" on public.students
  for update to authenticated
  using (public.is_member() and (public.is_admin() or created_by = auth.uid() or auth.uid() = any (tutor_ids)))
  with check (public.is_member());
drop policy if exists "tesisti: cancella chi l'ha messo" on public.students;
create policy "tesisti: cancella chi l'ha messo" on public.students
  for delete to authenticated using (public.is_member() and (public.is_admin() or created_by = auth.uid()));

drop policy if exists "fondi: solo i responsabili" on public.funds;
create policy "fondi: solo i responsabili" on public.funds
  for select to authenticated using (public.is_fund_manager(id));
drop policy if exists "fondi: modifica dei responsabili" on public.funds;
create policy "fondi: modifica dei responsabili" on public.funds
  for update to authenticated using (public.is_fund_manager(id)) with check (public.is_fund_manager(id));
drop policy if exists "fondi: eliminazione dei responsabili" on public.funds;
create policy "fondi: eliminazione dei responsabili" on public.funds
  for delete to authenticated using (public.is_fund_manager(id));
drop policy if exists "responsabili: visti dai responsabili" on public.fund_managers;
create policy "responsabili: visti dai responsabili" on public.fund_managers
  for select to authenticated using (user_id = auth.uid() or public.is_fund_manager(fund_id));
drop policy if exists "responsabili: aggiunti dai responsabili" on public.fund_managers;
create policy "responsabili: aggiunti dai responsabili" on public.fund_managers
  for insert to authenticated with check (public.is_fund_manager(fund_id)
    and exists (select 1 from public.profiles p where p.id = user_id and p.role in ('member', 'admin')));
drop policy if exists "responsabili: tolti dai responsabili" on public.fund_managers;
create policy "responsabili: tolti dai responsabili" on public.fund_managers
  for delete to authenticated using (public.is_fund_manager(fund_id));
drop policy if exists "spese: solo i responsabili" on public.fund_expenses;
create policy "spese: solo i responsabili" on public.fund_expenses
  for select to authenticated using (public.is_fund_manager(fund_id));
drop policy if exists "spese: registrate dai responsabili" on public.fund_expenses;
create policy "spese: registrate dai responsabili" on public.fund_expenses
  for insert to authenticated with check (public.is_fund_manager(fund_id) and created_by = auth.uid());
drop policy if exists "spese: corrette dai responsabili" on public.fund_expenses;
create policy "spese: corrette dai responsabili" on public.fund_expenses
  for update to authenticated using (public.is_fund_manager(fund_id)) with check (public.is_fund_manager(fund_id));
drop policy if exists "spese: cancellate dai responsabili" on public.fund_expenses;
create policy "spese: cancellate dai responsabili" on public.fund_expenses
  for delete to authenticated using (public.is_fund_manager(fund_id));

drop policy if exists "push: solo le proprie" on public.push_subscriptions;
create policy "push: solo le proprie" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "push: cancella le proprie" on public.push_subscriptions;
create policy "push: cancella le proprie" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.items_after_write() from public, anon, authenticated;
revoke execute on function public.set_member_role(uuid, text) from public, anon;
revoke execute on function public.remove_member(uuid) from public, anon;
revoke execute on function public.adjust_quantity(uuid, numeric) from public, anon;
revoke execute on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke execute on function public.complete_task(uuid, text) from public, anon;
revoke execute on function public.undo_complete_task(uuid) from public, anon;
grant execute on function public.complete_task(uuid, text) to authenticated;
grant execute on function public.undo_complete_task(uuid) to authenticated;
grant execute on function public.set_member_role(uuid, text) to authenticated;
grant execute on function public.remove_member(uuid) to authenticated;
grant execute on function public.adjust_quantity(uuid, numeric) to authenticated;
revoke execute on function public.consumi(int) from public, anon;
grant execute on function public.consumi(int) to authenticated;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
revoke execute on function public.recount_codes(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.flowcell_checks_sync() from public, anon, authenticated;
revoke execute on function public.use_item(uuid, numeric, text) from public, anon;
revoke execute on function public.use_barcodes(uuid, int[], numeric, text) from public, anon;
revoke execute on function public.add_codes(uuid, text[]) from public, anon;
revoke execute on function public.remove_codes(uuid, text[]) from public, anon;
revoke execute on function public.take_code(uuid, text, text) from public, anon;
revoke execute on function public.release_code(uuid) from public, anon;
grant execute on function public.use_item(uuid, numeric, text) to authenticated;
grant execute on function public.use_barcodes(uuid, int[], numeric, text) to authenticated;
grant execute on function public.add_codes(uuid, text[]) to authenticated;
grant execute on function public.remove_codes(uuid, text[]) to authenticated;
grant execute on function public.take_code(uuid, text, text) to authenticated;
grant execute on function public.release_code(uuid) to authenticated;
revoke execute on function public.strain_events_sync() from public, anon, authenticated;
revoke execute on function public.lab_journal_before_update() from public, anon, authenticated;
revoke execute on function public.journal_shared(uuid, uuid, date, uuid) from public, anon;
grant execute on function public.journal_shared(uuid, uuid, date, uuid) to authenticated;
revoke execute on function public.is_developer() from public, anon;
grant execute on function public.is_developer() to authenticated;
revoke execute on function public.force_diary_access(uuid, text) from public, anon;
grant execute on function public.force_diary_access(uuid, text) to authenticated;
revoke execute on function public.make_backup(text) from public, anon;
grant execute on function public.make_backup(text) to authenticated;
revoke execute on function public.backup_missing(bigint) from public, anon;
grant execute on function public.backup_missing(bigint) to authenticated;
revoke execute on function public.restore_rows(bigint, text, text[]) from public, anon;
grant execute on function public.restore_rows(bigint, text, text[]) to authenticated;
revoke execute on function public.fund_managers_keep_one() from public, anon, authenticated;
revoke execute on function public.create_fund(text, text, numeric, date, text) from public, anon;
grant execute on function public.create_fund(text, text, numeric, date, text) to authenticated;
revoke execute on function public.is_fund_manager(uuid) from public, anon;
grant execute on function public.is_fund_manager(uuid) to authenticated;
revoke execute on function public.set_instrument_settings(uuid, text) from public, anon;
grant execute on function public.set_instrument_settings(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
--  Giro 25 (ottobre 2026): codice del prodotto letto dall'etichetta del fornitore e spazio usato
-- ---------------------------------------------------------------------
-- GTIN del codice GS1 (Data Matrix delle bottiglie Sigma, Merck e altri): si abbina all'articolo la prima volta,
-- poi l'etichetta porta da sola lotto e scadenza
alter table public.items add column if not exists gtin text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'items_gtin_valido') then
    alter table public.items add constraint items_gtin_valido check (gtin is null or gtin ~ '^[0-9]{8,14}$');
  end if;
end;
$$;
create index if not exists items_gtin_idx on public.items (gtin) where gtin is not null;

-- quanto spazio occupano foto, documenti e database, da confrontare con i limiti del piano gratuito (solo amministratori)
create or replace function public.storage_usage()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo gli amministratori vedono lo spazio usato' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'foto', (select jsonb_build_object('n', count(*) filter (where o.name !~ '\.t\.jpg$'), 'bytes', coalesce(sum((o.metadata->>'size')::bigint), 0))
               from storage.objects o where o.bucket_id = 'foto'),
    'documenti', (select jsonb_build_object('n', count(*), 'bytes', coalesce(sum((o.metadata->>'size')::bigint), 0))
               from storage.objects o where o.bucket_id = 'documenti'),
    'files', (select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o),
    'db', pg_database_size(current_database()),
    'backups', (select coalesce(sum(pg_column_size(b.data)), 0) from public.backups b));
end;
$$;
revoke execute on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;

-- ---------------------------------------------------------------------
--  Giro 27 (ottobre 2026): doppioni dell'inventario, prenotazioni nel calendario del telefono,
--  provenienza dei ceppi (Nagoya e quarantena) e ingresso dei nuovi
-- ---------------------------------------------------------------------

-- Doppioni: coppie di articoli che un amministratore ha detto essere prodotti diversi, così non si propongono più
create table if not exists public.item_dup_ok (
  a        uuid not null references public.items (id) on delete cascade,
  b        uuid not null references public.items (id) on delete cascade,
  by_user  uuid default auth.uid() references public.profiles (id) on delete set null,
  at       timestamptz not null default now(),
  primary key (a, b),
  constraint item_dup_ok_ordine check (a < b)
);
alter table public.item_dup_ok enable row level security;
grant select, insert, delete on public.item_dup_ok to authenticated;
drop policy if exists "doppioni: lettura" on public.item_dup_ok;
create policy "doppioni: lettura" on public.item_dup_ok for select to authenticated using (public.is_member());
drop policy if exists "doppioni: inserimento" on public.item_dup_ok;
create policy "doppioni: inserimento" on public.item_dup_ok for insert to authenticated with check (public.is_admin());
drop policy if exists "doppioni: eliminazione" on public.item_dup_ok;
create policy "doppioni: eliminazione" on public.item_dup_ok for delete to authenticated using (public.is_admin());

-- articoli uniti: resta la riga vecchia, chi l'ha unita e in quale articolo
create table if not exists public.item_merges (
  id        bigint generated always as identity primary key,
  old_id    uuid not null,
  old_name  text not null,
  new_id    uuid references public.items (id) on delete set null,
  data      jsonb,
  by_user   uuid default auth.uid() references public.profiles (id) on delete set null,
  at        timestamptz not null default now()
);
alter table public.item_merges enable row level security;
grant select on public.item_merges to authenticated;
drop policy if exists "articoli uniti: lettura" on public.item_merges;
create policy "articoli uniti: lettura" on public.item_merges for select to authenticated using (public.is_member());

-- sostituisce un id dentro un elenco json ([{"item_id": ...}] oppure [{"t": "item", "id": ...}]), senza doppioni
create or replace function public.json_swap_id(a jsonb, k text, o uuid, n uuid)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(case when e->>k = o::text then jsonb_set(e, array[k], to_jsonb(n::text)) else e end order by i), '[]'::jsonb)
    from jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]'::jsonb end) with ordinality as t (e, i);
$$;
create or replace function public.json_swap_link(a jsonb, kind text, o uuid, n uuid)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x.e order by x.i), '[]'::jsonb)
    from (
      select e, i, row_number() over (partition by e order by i) as r
        from (
          select case when e->>'t' = kind and e->>'id' = o::text then jsonb_set(e, '{id}', to_jsonb(n::text)) else e end as e, i
            from jsonb_array_elements(case when jsonb_typeof(a) = 'array' then a else '[]'::jsonb end) with ordinality as t (e, i)
        ) y
    ) x
   where x.r = 1;
$$;

-- unisce uno o più articoli in quello da tenere (solo amministratori): storico, segnalazioni, codici, scatole dei congelatori,
-- ordini, problemi, esecuzioni dei protocolli, diario, documenti e preferiti passano all'articolo tenuto; gli altri si cancellano
create or replace function public.merge_items(p_keep uuid, p_drop uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d uuid;
  o public.items;
  k public.items;
  pat text;
begin
  if not public.is_admin() then
    raise exception 'Solo gli amministratori uniscono gli articoli' using errcode = '42501';
  end if;
  select * into k from public.items where id = p_keep for update;
  if not found then
    raise exception 'L''articolo da tenere non c''è più';
  end if;
  perform set_config('labapp.unione', 'on', true);
  foreach d in array coalesce(p_drop, '{}'::uuid[]) loop
    continue when d = p_keep;
    select * into o from public.items where id = d for update;
    continue when not found;
    pat := '%' || d::text || '%';
    update public.alerts set item_id = p_keep where item_id = d;
    update public.item_log set item_id = p_keep where item_id = d;
    update public.issues set item_id = p_keep where item_id = d;
    update public.order_requests set item_id = p_keep where item_id = d;
    update public.box_slots set item_id = p_keep where item_id = d;
    update public.items set parent_id = p_keep where parent_id = d and id <> p_keep;
    update public.item_codes c set item_id = p_keep
     where c.item_id = d and not exists (select 1 from public.item_codes x where x.item_id = p_keep and x.code = c.code);
    delete from public.item_codes where item_id = d;
    update public.protocol_runs set reagents = public.json_swap_id(reagents, 'item_id', d, p_keep) where reagents::text like pat;
    update public.protocols set istd = jsonb_set(istd, '{stds}', public.json_swap_id(istd->'stds', 'item_id', d, p_keep))
     where istd is not null and jsonb_typeof(istd->'stds') = 'array' and istd::text like pat;
    update public.lab_journal set materials = public.json_swap_id(materials, 'item_id', d, p_keep), links = public.json_swap_link(links, 'item', d, p_keep)
     where materials::text like pat or links::text like pat;
    update public.lab_docs set links = public.json_swap_link(links, 'item', d, p_keep) where links::text like pat;
    update public.profiles set prefs = jsonb_set(prefs, '{favorites}', public.json_swap_link(prefs->'favorites', 'item', d, p_keep))
     where jsonb_typeof(prefs->'favorites') = 'array' and prefs::text like pat;
    insert into public.item_merges (old_id, old_name, new_id, data) values (d, o.name, p_keep, to_jsonb(o));
    insert into public.item_log (item_id, user_id, action, note)
    values (p_keep, auth.uid(), 'unito', left('con ' || o.name || coalesce(' (' || nullif(o.location, '') || ')', ''), 300));
    delete from public.items where id = d;
  end loop;
  perform set_config('labapp.unione', 'off', true);
  select * into k from public.items where id = p_keep;
  return to_jsonb(k);
end;
$$;
revoke execute on function public.merge_items(uuid, uuid[]) from public, anon;
grant execute on function public.merge_items(uuid, uuid[]) to authenticated;

-- Prenotazioni nel calendario del telefono: ognuno ha un link segreto che la funzione notify trasforma in un calendario .ics.
-- La tabella non si legge dall'app (niente regole): il link si ottiene solo con calendar_token(), che può anche cambiarlo
create table if not exists public.calendar_tokens (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  token       text not null unique check (length(token) >= 32),
  created_at  timestamptz not null default now()
);
alter table public.calendar_tokens enable row level security;
create or replace function public.calendar_token(p_new boolean default false)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'Solo i membri del laboratorio' using errcode = '42501';
  end if;
  if p_new then
    delete from public.calendar_tokens where user_id = auth.uid();
  end if;
  insert into public.calendar_tokens (user_id, token)
  values (auth.uid(), replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
  on conflict (user_id) do nothing;
  return (select t.token from public.calendar_tokens t where t.user_id = auth.uid());
end;
$$;
revoke execute on function public.calendar_token(boolean) from public, anon;
grant execute on function public.calendar_token(boolean) to authenticated;
revoke execute on function public.coffee_link(text, uuid) from public, anon;
grant execute on function public.coffee_link(text, uuid) to authenticated;
revoke execute on function public.coffee_link_names() from public, anon, authenticated;
revoke execute on function public.students_link_tutors() from public, anon, authenticated;
revoke execute on function public.coffee_profiles_link() from public, anon, authenticated;
revoke execute on function public.coffee_keep_name() from public, anon, authenticated;
revoke execute on function public.lab_docs_skip() from public, anon, authenticated;

-- Provenienza dei ceppi per il protocollo di Nagoya (Reg. UE 511/2014) e gli organismi da quarantena (Reg. UE 2019/2072):
-- paese dove è stato raccolto, come è arrivato (isolato da noi, da una collezione, da un collega), da dove e quando,
-- stato dei documenti di accesso (IRCC, PIC, MAT o MTA) e, per gli organismi da quarantena, l'autorizzazione del Servizio fitosanitario.
-- quarantine nullo = lo decide l'app dall'elenco dell'allegato II
alter table public.strains add column if not exists country     text check (country is null or length(country) <= 80);
alter table public.strains add column if not exists provenance  text check (provenance is null or provenance in ('isolato', 'collezione', 'collega'));
alter table public.strains add column if not exists source_ref  text check (source_ref is null or length(source_ref) <= 300);
alter table public.strains add column if not exists received_on date;
alter table public.strains add column if not exists abs_status  text check (abs_status is null or abs_status in ('non_serve', 'documenti', 'da_verificare'));
alter table public.strains add column if not exists abs_ref     text check (abs_ref is null or length(abs_ref) <= 500);
alter table public.strains add column if not exists quarantine  boolean;
alter table public.strains add column if not exists qp_auth     text check (qp_auth is null or length(qp_auth) <= 300);
-- giro 47: progetto e coordinate del punto di raccolta, per filtrare i ceppi e metterli sulla mappa
alter table public.strains add column if not exists project     text check (project is null or length(project) <= 80);
alter table public.strains add column if not exists lat         numeric check (lat is null or lat between -90 and 90);
alter table public.strains add column if not exists lon         numeric check (lon is null or lon between -180 and 180);
-- giro 47: le foto delle colture in brodo (PDB, MEB...)
alter table public.strain_photos drop constraint if exists strain_photos_kind_check;
alter table public.strain_photos add constraint strain_photos_kind_check check (kind in ('piastra', 'liquido', 'spore', 'microscopio', 'altro'));
-- giro 48: chi ha isolato il ceppo, una volta scritto, lo cambia solo un amministratore (dal SQL Editor si può sempre)
create or replace function public.strains_keep_isolator()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is not null and nullif(btrim(coalesce(old.isolated_by, '')), '') is not null
     and new.isolated_by is distinct from old.isolated_by and not public.is_admin() then
    raise exception 'Chi ha isolato il ceppo lo cambia solo un amministratore' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists strains_keep_isolator on public.strains;
create trigger strains_keep_isolator before update of isolated_by on public.strains
  for each row execute function public.strains_keep_isolator();
revoke execute on function public.strains_keep_isolator() from public, anon, authenticated;

-- Impostazioni del laboratorio (per ora la lista dell'ingresso dei nuovi): le leggono tutti, le cambiano gli amministratori
create table if not exists public.lab_settings (
  key         text primary key check (key ~ '^[a-z_]{2,40}$'),
  value       jsonb not null,
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.lab_settings enable row level security;
grant select, insert, update, delete on public.lab_settings to authenticated;
drop policy if exists "impostazioni: lettura" on public.lab_settings;
create policy "impostazioni: lettura" on public.lab_settings for select to authenticated using (public.is_member());
drop policy if exists "impostazioni: scrittura" on public.lab_settings;
create policy "impostazioni: scrittura" on public.lab_settings for insert to authenticated with check (public.is_admin());
drop policy if exists "impostazioni: modifica" on public.lab_settings;
create policy "impostazioni: modifica" on public.lab_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "impostazioni: eliminazione" on public.lab_settings;
create policy "impostazioni: eliminazione" on public.lab_settings for delete to authenticated using (public.is_admin());

-- Ingresso dei nuovi: una lista per persona (corsi sulla sicurezza, DPI, giro del laboratorio, strumenti, accessi) con il tutor.
-- La vedono la persona, il suo tutor e gli amministratori; la persona e il tutor spuntano, gli amministratori la aprono e la chiudono
create table if not exists public.onboarding (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  tutor_id    uuid references public.profiles (id) on delete set null,
  started_on  date not null default ((now() at time zone 'Europe/Rome')::date),
  items       jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 80),
  note        text check (note is null or length(note) <= 2000),
  done_at     timestamptz,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.onboarding enable row level security;
grant select, insert, update, delete on public.onboarding to authenticated;
drop policy if exists "ingresso: lettura" on public.onboarding;
create policy "ingresso: lettura" on public.onboarding for select to authenticated
  using (public.is_admin() or user_id = auth.uid() or tutor_id = auth.uid());
drop policy if exists "ingresso: inserimento" on public.onboarding;
create policy "ingresso: inserimento" on public.onboarding for insert to authenticated with check (public.is_admin());
drop policy if exists "ingresso: modifica" on public.onboarding;
create policy "ingresso: modifica" on public.onboarding for update to authenticated
  using (public.is_admin() or user_id = auth.uid() or tutor_id = auth.uid())
  with check (public.is_admin() or user_id = auth.uid() or tutor_id = auth.uid());
drop policy if exists "ingresso: eliminazione" on public.onboarding;
create policy "ingresso: eliminazione" on public.onboarding for delete to authenticated using (public.is_admin());

-- chi non amministra cambia solo le spunte: tutor, data, note e chiusura restano com'erano
create or replace function public.onboarding_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    new.tutor_id := old.tutor_id;
    new.started_on := old.started_on;
    new.done_at := old.done_at;
    if old.tutor_id is distinct from auth.uid() then
      new.note := old.note;
    end if;
    if jsonb_array_length(new.items) <> jsonb_array_length(old.items)
       or exists (select 1 from jsonb_array_elements(new.items) with ordinality a (e, i)
                    join jsonb_array_elements(old.items) with ordinality b (e, i) using (i)
                   where a.e->>'k' is distinct from b.e->>'k' or a.e->>'l' is distinct from b.e->>'l') then
      raise exception 'Le voci della lista le cambia un amministratore';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists onboarding_before_update on public.onboarding;
create trigger onboarding_before_update before update on public.onboarding
  for each row execute function public.onboarding_before_update();

-- ---------------------------------------------------------------------
--  Giro 28 (ottobre 2026): primer e coppie di primer, per la Tm, la temperatura di annealing con la regola
--  di ogni polimerasi, i dimeri e la PCR in silico sulle sequenze della micoteca (i conti li fa l'app)
-- ---------------------------------------------------------------------
create table if not exists public.primers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(btrim(name)) between 1 and 60),
  seq         text not null check (length(seq) between 6 and 200 and seq ~ '^[ACGTRYKMSWBDHVNI]+$'),
  direction   text check (direction is null or direction in ('F', 'R')),
  locus       text check (locus is null or length(locus) <= 40),
  target      text check (target is null or length(target) <= 120),
  ref         text check (ref is null or length(ref) <= 600),
  doi         text check (doi is null or length(doi) <= 200),
  notes       text check (notes is null or length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at  timestamptz not null default now()
);
create unique index if not exists primers_name_key on public.primers (upper(btrim(name)));

create table if not exists public.primer_pairs (
  id          uuid primary key default gen_random_uuid(),
  fwd_id      uuid not null references public.primers (id) on delete cascade,
  rev_id      uuid not null references public.primers (id) on delete cascade,
  name        text check (name is null or length(name) <= 80),
  locus       text check (locus is null or length(locus) <= 40),
  size_bp     int check (size_bp is null or size_bp between 20 and 20000),
  polymerase  text check (polymerase is null or length(polymerase) <= 30),
  notes       text check (notes is null or length(notes) <= 1000),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint coppia_diversa check (fwd_id <> rev_id),
  unique (fwd_id, rev_id)
);

-- sequenza sempre maiuscola e senza spazi, nome senza spazi ai lati, chi e quando ha cambiato
create or replace function public.primers_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.seq := translate(upper(regexp_replace(new.seq, '[^A-Za-z]', '', 'g')), 'U', 'T');
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' then
    new.updated_at := now();
    new.updated_by := auth.uid();
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  return new;
end;
$$;
drop trigger if exists primers_before_write on public.primers;
create trigger primers_before_write before insert or update on public.primers
  for each row execute function public.primers_before_write();

alter table public.primers enable row level security;
alter table public.primer_pairs enable row level security;
grant select, insert, update, delete on public.primers to authenticated;
grant select, insert, update, delete on public.primer_pairs to authenticated;
drop policy if exists "primer: lettura" on public.primers;
create policy "primer: lettura" on public.primers for select to authenticated using (public.is_member());
drop policy if exists "primer: inserimento" on public.primers;
create policy "primer: inserimento" on public.primers for insert to authenticated with check (public.is_member());
drop policy if exists "primer: modifica" on public.primers;
create policy "primer: modifica" on public.primers for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "primer: eliminazione" on public.primers;
create policy "primer: eliminazione" on public.primers for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));
drop policy if exists "coppie: lettura" on public.primer_pairs;
create policy "coppie: lettura" on public.primer_pairs for select to authenticated using (public.is_member());
drop policy if exists "coppie: inserimento" on public.primer_pairs;
create policy "coppie: inserimento" on public.primer_pairs for insert to authenticated with check (public.is_member());
drop policy if exists "coppie: modifica" on public.primer_pairs;
create policy "coppie: modifica" on public.primer_pairs for update to authenticated using (public.is_member()) with check (public.is_member());
drop policy if exists "coppie: eliminazione" on public.primer_pairs;
create policy "coppie: eliminazione" on public.primer_pairs for delete to authenticated using (public.is_member() and (created_by = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------
--  Strumenti iniziali (si rinominano o eliminano dall'app)
-- ---------------------------------------------------------------------
insert into public.instruments (name, kind)
select v.name, v.kind
  from (values ('Cappa a flusso laminare', 'cappa'), ('Microscopio', 'microscopio')) as v (name, kind)
 where not exists (select 1 from public.instruments);

-- ---------------------------------------------------------------------
--  Copia di sicurezza ogni notte alle 3 circa (ora italiana). Serve pg_cron, che si attiva con promemoria.sql
--  o da Database > Extensions. Se non c'è ancora, rieseguire questo file dopo averlo attivato.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('labapp-backup', '10 1 * * *', 'select public.make_backup(''auto'')');
  else
    raise notice 'pg_cron non attivo: la copia notturna partirà dopo averlo attivato e rieseguito schema.sql';
  end if;
end;
$$;
