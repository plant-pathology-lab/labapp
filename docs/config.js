// Configurazione dell'app.
// Compila i valori dopo aver creato il progetto Supabase (vedi la guida).
// Se SUPABASE_URL resta vuoto l'app parte in modalità prova:
// i dati restano solo su quel telefono e le notifiche non partono.

export const CONFIG = {
  // Nome mostrato in alto nell'app
  LAB_NAME: 'Patologia vegetale',

  // Supabase > Project Settings > Data API > Project URL
  SUPABASE_URL: 'https://sqfddyfyizhtlaithtoc.supabase.co',

  // Supabase > Project Settings > API Keys > Publishable key (oppure la "anon public" legacy)
  SUPABASE_KEY: 'sb_publishable_Uf3ly9BD5Z8ApBPjbpNpaw_rkU80Oqr',

  // Chiave pubblica VAPID per le notifiche push (è quella di CHIAVI-NOTIFICHE.txt, già inserita)
  VAPID_PUBLIC_KEY: 'BDxUmzpdxsVlSG-A86IjH9Aq7MvsPQHnpkIs_TtNPXPkzo1YAhaN5QjAYHmj08yOMiYpKiCTMSkZMw9HVkB46T0',
};
