import { db } from "./firebase-config.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const calendarEl = document.getElementById("calendar");

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
  events: []
});

calendar.render();

// Ascolta in tempo reale la collezione pubblica degli appuntamenti.
// Nessun dato sensibile (nome cliente, telefono, note) è presente qui:
// quei dati vivono solo in "appuntamenti_privati", leggibile esclusivamente dal barbiere autenticato.
onSnapshot(collection(db, "appuntamenti_pubblici"), (snapshot) => {
  calendar.removeAllEvents();
  snapshot.forEach((docSnap) => {
    const dati = docSnap.data();
    const inizio = new Date(`${dati.data}T${dati.ora}`);
    const fine = new Date(inizio.getTime() + (Number(dati.durata) || 30) * 60000);
    calendar.addEvent({
      id: docSnap.id,
      title: dati.servizio || "Occupato",
      start: inizio,
      end: fine,
      color: "#8b5e3c"
    });
  });
});
