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
  slotMinTime: "08:00:00",
  slotMaxTime: "20:00:00",
  allDaySlot: false,
  height: "auto",
  hiddenDays: [],
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

// --- Stato locale, ricostruito ad ogni cambiamento su una qualsiasi fonte ---
let appuntamenti = {};
let giorniChiusuraSettimanali = [];
let pausa = null; // { attiva, inizio, fine }
let chiusureGiorno = {};
let chiusureOrario = {};

function ricostruisci() {
  calendar.setOption("hiddenDays", giorniChiusuraSettimanali);
  calendar.removeAllEvents();

  // Appuntamenti: nella vista pubblica non si mostra il servizio, solo "Occupato".
  Object.values(appuntamenti).forEach((dati) => {
    const inizio = new Date(`${dati.data}T${dati.ora}`);
    const fine = new Date(inizio.getTime() + (Number(dati.durata) || 30) * 60000);
    calendar.addEvent({
      title: "Occupato",
      start: inizio,
      end: fine,
      color: "#8b5e3c"
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
      color: "#c9756a"
    });
  }

  // Chiusure per giorno intero (es. ferie, festività)
  Object.values(chiusureGiorno).forEach((c) => {
    calendar.addEvent({
      title: "Chiuso",
      start: c.data,
      allDay: true,
      display: "background",
      color: "#c9756a"
    });
  });

  // Chiusure per fascia oraria in data specifica
  Object.values(chiusureOrario).forEach((c) => {
    calendar.addEvent({
      title: "Chiuso",
      start: `${c.data}T${c.oraInizio}`,
      end: `${c.data}T${c.oraFine}`,
      display: "background",
      color: "#c9756a"
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
