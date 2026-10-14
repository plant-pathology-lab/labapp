-- =====================================================================
--  LabApp: promemoria 15 minuti prima delle prenotazioni
--  e riepilogo della settimana il lunedì mattina
--  Da eseguire in Supabase > SQL Editor dopo schema.sql e dopo aver
--  pubblicato la funzione "notify". Ogni 5 minuti il database chiama
--  la funzione, che avvisa chi ha una prenotazione in arrivo. Il lunedì
--  alle 8 (le 7 con l'ora solare) manda a tutti il riepilogo della settimana.
--  Si può rieseguire senza creare doppioni.
--  Prima di eseguirlo sostituisci INDIRIZZO_PROGETTO con il Project URL
--  (es. https://abcdefgh.supabase.co) e IL_TUO_CRON_SECRET con il CRON_SECRET
--  di CHIAVI-NOTIFICHE.txt (compaiono due volte). Salva la copia compilata come
--  promemoria.sql: resta fuori da GitHub.
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'labapp-promemoria',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'INDIRIZZO_PROGETTO/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'IL_TUO_CRON_SECRET'),
    body := '{"promemoria": true}'::jsonb
  );
  $$
);

select cron.schedule(
  'labapp-riepilogo',
  '0 6 * * 1',
  $$
  select net.http_post(
    url := 'INDIRIZZO_PROGETTO/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'IL_TUO_CRON_SECRET'),
    body := '{"riepilogo": true}'::jsonb
  );
  $$
);
