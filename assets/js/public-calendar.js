import { db } from "./firebase-config.js";
import { collection, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const calendarEl = document.getElementById("calendar");
const loadingEl = document.getElementById("loading");

const calendar = new FullCalendar.Calendar(calendarEl, {
  initialView: "timeGridWeek",
  locale: "it",
  headerToolbar: {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay"
  },
  slotMinTime: "06:00:00",
  slotMaxTime: "20:00:00",
  allDaySlot: false,
  height: "auto",
  events: []
});

let calendarShown = false;
function mostraCalendario() {
  if (calendarShown) return;
  calendarShown = true;
  loadingEl.style.display = "none";
  calendarEl.style.display = "block";
  calendar.render();
}

// Aggiunge "giorni" giorni a una data in formato YYYY-MM-DD (per estremi esclusivi FullCalendar)
// Nota: calcolo interamente in ora locale, senza passare da toISOString(), per evitare
// che la conversione UTC sposti la data di un giorno a seconda del fuso orario.
function aggiungiGiorni(dataIso, giorni) {
  const [y, m, d] = dataIso.split("-").map(Number);
  const data = new Date(y, m - 1, d + giorni);
  const yyyy = data.getFullYear();
  const mm = String(data.getMonth() + 1).padStart(2, "0");
  const dd = String(data.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// --- Stato locale, ricostruito ad ogni cambiamento su una qualsiasi fonte ---
let appuntamenti = {};
let giorniChiusuraSettimanali = [];
let pausa = null; // { attiva, inizio, fine }
let chiusureGiorno = {};
let chiusureOrario = {};

function ricostruisci() {
  calendar.removeAllEvents();

  // Appuntamenti: nella vista pubblica non si mostra il servizio, solo "Occupato".
  Object.values(appuntamenti).forEach((dati) => {
    const inizio = new Date(`${dati.data}T${dati.ora}`);
    const fine = new Date(inizio.getTime() + (Number(dati.durata) || 30) * 60000);
    calendar.addEvent({
      title: "Occupato",
      start: inizio,
      end: fine,
      color: "#9E3B36"
    });
  });

  // Giorni di chiusura settimanali: sempre visibili, mostrati come l'intera giornata "chiusa"
  giorniChiusuraSettimanali.forEach((dow) => {
    calendar.addEvent({
      title: "Chiuso",
      daysOfWeek: [dow],
      allDay: true,
      display: "background",
      color: "#C79A4E"
    });
  });

  // Pausa giornaliera ricorrente
  if (pausa && pausa.attiva && pausa.inizio && pausa.fine) {
    calendar.addEvent({
      title: "Chiuso",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: pausa.inizio,
      endTime: pausa.fine,
      display: "background",
      color: "#C79A4E"
    });
  }

  // Chiusure per intervallo di date (es. ferie, festività)
  Object.values(chiusureGiorno).forEach((c) => {
    const fine = c.dataFine || c.dataInizio || c.data;
    calendar.addEvent({
      title: "Chiuso",
      start: c.dataInizio || c.data,
      end: aggiungiGiorni(fine, 1),
      allDay: true,
      display: "background",
      color: "#C79A4E"
    });
  });

  // Chiusure per fascia oraria in data specifica
  Object.values(chiusureOrario).forEach((c) => {
    calendar.addEvent({
      title: "Chiuso",
      start: `${c.data}T${c.oraInizio}`,
      end: `${c.data}T${c.oraFine}`,
      display: "background",
      color: "#C79A4E"
    });
  });

  mostraCalendario();
}

onSnapshot(collection(db, "appuntamenti_pubblici"), (snapshot) => {
  appuntamenti = {};
  snapshot.forEach((docSnap) => {
    appuntamenti[docSnap.id] = docSnap.data();
  });
  ricostruisci();
});

onSnapshot(doc(db, "config", "orari"), (docSnap) => {
  const dati = docSnap.data() || {};
  giorniChiusuraSettimanali = dati.giorniChiusuraSettimanali || [];
  pausa = { attiva: dati.pausaAttiva, inizio: dati.pausaInizio, fine: dati.pausaFine };
  ricostruisci();
});

onSnapshot(collection(db, "chiusure_giorno"), (snapshot) => {
  chiusureGiorno = {};
  snapshot.forEach((docSnap) => {
    chiusureGiorno[docSnap.id] = docSnap.data();
  });
  ricostruisci();
});

onSnapshot(collection(db, "chiusure_orario"), (snapshot) => {
  chiusureOrario = {};
  snapshot.forEach((docSnap) => {
    chiusureOrario[docSnap.id] = docSnap.data();
  });
  ricostruisci();
});
