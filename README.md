# LabApp

L'app del Plant Pathology Lab (Sapienza) per il telefono. Raccoglie inventario e ordini, prenotazione degli strumenti, micoteca con il riconoscimento degli isolati, campioni, sequenziamento, protocolli e primer, diario di laboratorio, documenti, sicurezza, cose da fare e problemi.

È una PWA in JavaScript senza passaggi di build. GitHub Pages pubblica la cartella `docs/` così com'è. I dati stanno su Supabase (Postgres con RLS, Auth, Storage, Edge Functions) e si vedono solo entrando con un account approvato.

## Cartelle

| Percorso | Cosa contiene |
|---|---|
| `docs/` | L'app: `index.html`, `app.js`, `api.js`, `spiegazioni.js`, `funghi.js`, `styles.css`, `sw.js`, `manifest.webmanifest`, icone e foto. È la cartella `app` del pacchetto, qui si chiama `docs` perché GitHub Pages pubblica questa |
| `docs/config.js` | Indirizzo e chiave pubblica di Supabase, chiave pubblica VAPID, nome del laboratorio. Sono fatte per stare nell'app, i dati li proteggono le regole del database |
| `supabase/schema.sql` | Il database: tabelle, regole di accesso, funzioni. Si può rilanciare a ogni versione |
| `supabase/notify.ts` | Edge Function delle notifiche, dei promemoria, del calendario delle prenotazioni e degli articoli nuovi del lunedì |
| `supabase/trascrivi.ts` | Edge Function facoltativa che trascrive le pagine scritte a mano e guarda le foto degli isolati (Claude o Gemini) |
| `supabase/promemoria.esempio.sql` | I promemoria delle prenotazioni e il riepilogo del lunedì, da completare con l'indirizzo del progetto e il CRON_SECRET |
| `GUIDA.html` | Installazione, aggiornamenti e uso, passo per passo |

## Cosa non c'è

I dati del laboratorio (inventario, protocolli, micoteca, strumenti, articoli, standard, tesisti, caffè) e i loro script SQL restano sul computer e si lanciano una volta dal SQL Editor di Supabase. Nessun segreto: la chiave privata VAPID, il CRON_SECRET e le chiavi delle AI stanno solo nei Secrets di Supabase.

## Pubblicazione

Settings, Pages, Deploy from a branch, ramo `main`, cartella `/docs`, Save. L'indirizzo è `https://<organizzazione>.github.io/<repository>/` e va messo come Site URL e tra i Redirect URLs di Supabase (Authentication, URL Configuration).

## Una versione nuova

1. Carica i file nuovi dentro `docs/` (Add file, Upload files, Commit changes). Non caricare un `config.js` vuoto sopra quello compilato.
2. Se è cambiato, incolla di nuovo `supabase/schema.sql` nel SQL Editor e ripubblica le Edge Functions.

GitHub Pages ripubblica in un minuto circa e i telefoni prendono la versione nuova alla riapertura dell'app.
