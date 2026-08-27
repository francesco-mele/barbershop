# Calendario prenotazioni - Barbiere

Sito statico (compatibile GitHub Pages) con:
- pagina pubblica in sola lettura del calendario appuntamenti (`index.html`)
- area riservata protetta per il barbiere per gestire gli appuntamenti (`admin/`)

Backend: **Firebase** (Firestore + Authentication). Nessun server necessario: tutto funziona lato client.

## Struttura

```
index.html                     pagina pubblica (calendario in sola lettura)
admin/login.html                login barbiere
admin/dashboard.html            gestione appuntamenti (crea/modifica/elimina) + gestione servizi
assets/css/style.css            stili condivisi
assets/js/firebase-config.js    configurazione Firebase (da completare, vedi sotto)
assets/js/public-calendar.js    logica calendario pubblico
assets/js/auth.js               logica login
assets/js/admin-calendar.js     logica dashboard (CRUD appuntamenti + servizi)
firestore.rules                 regole di sicurezza Firestore da caricare in console
```

## Modello dati

- **appuntamenti_pubblici/{id}** → `data`, `ora`, `durata`, `servizio` — leggibile da chiunque, scrivibile solo dal barbiere autenticato. Nella vista pubblica il servizio non viene mostrato: lo slot appare semplicemente come "Occupato".
- **appuntamenti_privati/{id}** (stesso id del documento pubblico collegato) → `nomeCliente`, `telefono`, `note` — leggibile e scrivibile solo dal barbiere autenticato.
- **servizi/{id}** → `nome` — lista dei servizi offerti, leggibile da chiunque, modificabile solo dal barbiere autenticato (gestibile direttamente dalla dashboard).
- **config/orari** (documento singolo) → `giorniChiusuraSettimanali` (array di numeri 0-6, 0=domenica), `pausaAttiva` (bool), `pausaInizio`, `pausaFine` (`HH:MM`) — leggibile da chiunque, scrivibile solo dal barbiere.
- **chiusure_giorno/{id}** → `data` (`YYYY-MM-DD`), `motivo` — chiusure per giornata intera (es. ferie), leggibile da chiunque, scrivibile solo dal barbiere.
- **chiusure_orario/{id}** → `data`, `oraInizio`, `oraFine`, `motivo` — chiusure per una fascia oraria in una data specifica, leggibile da chiunque, scrivibile solo dal barbiere.
- **config/anagrafica** (documento singolo) → `nomeAttivita`, `nomeBarbiere`, `indirizzo`, `cellulare` — leggibile da chiunque, scrivibile solo dal barbiere (tab "Anagrafica" della dashboard). Questi dati vengono applicati in tempo reale all'intestazione di tutte le pagine da [assets/js/site-header.js](assets/js/site-header.js).

## Configurazione passo-passo

### 1. Crea il progetto Firebase
1. Vai su [console.firebase.google.com](https://console.firebase.google.com), crea un nuovo progetto (piano gratuito Spark è sufficiente).
2. In "Build" attiva **Firestore Database** (modalità produzione, scegli una regione europea es. `europe-west`).
3. In "Build" attiva **Authentication** → metodo di accesso **Email/Password**.
4. Crea manualmente l'utente barbiere in Authentication → Users → Aggiungi utente (email + password).

### 2. Recupera la configurazione dell'app
1. Nelle impostazioni del progetto (icona ingranaggio) → "Le tue app" → aggiungi un'app Web.
2. Copia i valori generati (`apiKey`, `authDomain`, `projectId`, ecc.) e incollali in [assets/js/firebase-config.js](assets/js/firebase-config.js), sostituendo i placeholder `INSERISCI_QUI`.

### 3. Carica le regole di sicurezza
1. In Firestore Database → Regole, incolla il contenuto di [firestore.rules](firestore.rules) e pubblica.

### 4. Inserisci i servizi iniziali
Al primo accesso alla dashboard (`admin/dashboard.html`), usa il pannello "Servizi" per aggiungere i servizi standard (es. Taglio, Barba, Taglio+Barba, Colore).

### 5. Pubblica su GitHub Pages
1. Crea un repository GitHub e carica il contenuto di questa cartella.
2. Nelle impostazioni del repository → Pages → seleziona il branch e la cartella root come sorgente.
3. Copia l'URL generato (es. `https://tuonomeutente.github.io/tuorepository/`).

### 6. Autorizza il dominio in Firebase Authentication
1. In Authentication → Settings → Authorized domains, aggiungi il dominio di GitHub Pages (es. `tuonomeutente.github.io`).
   Senza questo passaggio il login non funziona da quel dominio.

## Note

- Le chiavi in `firebase-config.js` sono pubbliche per natura (fanno parte del codice client): la sicurezza reale è garantita dalle regole Firestore, non dalla segretezza di queste chiavi.
- Il calendario pubblico non mostra mai nome cliente, telefono o note: quei dati sono su una collezione separata (`appuntamenti_privati`) accessibile solo dopo login.
- Se in futuro vorrai passare da "sola visualizzazione" a "prenotazione online" da parte dei clienti, questa struttura dati regge l'evoluzione senza cambi di tecnologia.
