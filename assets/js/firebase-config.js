// Configurazione Firebase
// Sostituisci i valori sottostanti con quelli del tuo progetto Firebase
// (Console Firebase > Impostazioni progetto > Le tue app > Configurazione SDK)
// Nota: queste chiavi sono pubbliche per natura (finiscono nel codice client).
// La sicurezza reale è garantita dalle Firestore Security Rules, non dalla segretezza di questi valori.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBu0TUAcSCx8XtgKaPp8jl23Z4Ps2iH18E",
  authDomain: "barbershop-21889.firebaseapp.com",
  projectId: "barbershop-21889",
  storageBucket: "barbershop-21889.firebasestorage.app",
  messagingSenderId: "937939129606",
  appId: "1:937939129606:web:541aa9414fe9f916083a87"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
