import { db, auth } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

// --- Protezione della pagina: se non autenticato, torna al login ---
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
  }
});

document.getElementById("logout-link").addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "login.html";
});

// --- Toast di conferma/errore ---
const toastEl = document.getElementById("toast");
let toastTimer;
function mostraToast(messaggio, tipo) {
  clearTimeout(toastTimer);
  toastEl.textContent = messaggio;
  toastEl.className = "toast show" + (tipo === "error" ? " error" : "");
  toastTimer = setTimeout(() => {
    toastEl.className = "toast";
  }, 2600);
}

// --- Gestione tab ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "tab-calendario") {
      setTimeout(() => calendar.updateSize(), 50);
    }
  });
});

// --- Riferimenti DOM modale appuntamento ---
const overlay = document.getElementById("appointment-overlay");
const modalTitle = document.getElementById("modal-title");
const form = document.getElementById("appointment-form");
const idInput = document.getElementById("appointment-id");
const dataInput = document.getElementById("app-data");
const oraInput = document.getElementById("app-ora");
const durataInput = document.getElementById("app-durata");
const servizioSelect = document.getElementById("app-servizio");
const nomeInput = document.getElementById("app-nome");
const telefonoInput = document.getElementById("app-telefono");
const noteInput = document.getElementById("app-note");
const errorEl = document.getElementById("appointment-error");
const deleteBtn = document.getElementById("delete-btn");
const cancelBtn = document.getElementById("cancel-btn");

// Durata selezionabile solo in multipli di 15 minuti (da 15 min a 3 ore)
function formattaDurata(minuti) {
  if (minuti < 60) return `${minuti} min`;
  const ore = Math.floor(minuti / 60);
  const resto = minuti % 60;
  return resto === 0 ? `${ore} h` : `${ore} h ${resto} min`;
}
for (let m = 15; m <= 180; m += 15) {
  const option = document.createElement("option");
  option.value = m;
  option.textContent = formattaDurata(m);
  durataInput.appendChild(option);
}

function openModal(mode, evento) {
  errorEl.textContent = "";
  form.reset();
  durataInput.value = 30;

  if (mode === "new") {
    modalTitle.textContent = "Nuovo appuntamento";
    idInput.value = "";
    deleteBtn.style.display = "none";
    if (evento && evento.dateStr) {
      const d = new Date(evento.dateStr);
      dataInput.value = d.toISOString().slice(0, 10);
      oraInput.value = d.toTimeString().slice(0, 5);
    }
  } else {
    modalTitle.textContent = "Modifica appuntamento";
    deleteBtn.style.display = "inline-block";
    const pub = evento.extendedProps.pubblico;
    const priv = evento.extendedProps.privato || {};
    idInput.value = evento.id;
    dataInput.value = pub.data;
    oraInput.value = pub.ora;
    durataInput.value = pub.durata;
    servizioSelect.value = pub.servizio;
    nomeInput.value = priv.nomeCliente || "";
    telefonoInput.value = priv.telefono || "";
    noteInput.value = priv.note || "";
  }

  overlay.classList.add("open");
}

function closeModal() {
  overlay.classList.remove("open");
}

cancelBtn.addEventListener("click", closeModal);

// --- Calendario ---
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
  selectable: true,
  dateClick: (info) => openModal("new", info),
  eventClick: (info) => {
    if (info.event.display === "background") return; // le chiusure si gestiscono dalla tab "Orari"
    openModal("edit", info.event);
  }
});

let calendarShown = false;
function mostraCalendario() {
  if (calendarShown) return;
  calendarShown = true;
  loadingEl.style.display = "none";
  calendarEl.style.display = "block";
  calendar.render();
}

// --- Stato locale per la ricostruzione del calendario ---
let pubbliciSnapshot = {};
let privatiSnapshot = {};
let giorniChiusuraSettimanali = [];
let pausa = null;
let chiusureGiornoSnap = {};
let chiusureOrarioSnap = {};

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

function ricostruisciCalendario() {
  calendar.removeAllEvents();

  Object.keys(pubbliciSnapshot).forEach((id) => {
    const pub = pubbliciSnapshot[id];
    const priv = privatiSnapshot[id] || {};
    const inizio = new Date(`${pub.data}T${pub.ora}`);
    const fine = new Date(inizio.getTime() + (Number(pub.durata) || 30) * 60000);
    calendar.addEvent({
      id,
      title: `${pub.servizio || "Servizio"} - ${priv.nomeCliente || ""}`,
      start: inizio,
      end: fine,
      color: "#9E3B36",
      extendedProps: { pubblico: pub, privato: priv }
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

  if (pausa && pausa.attiva && pausa.inizio && pausa.fine) {
    calendar.addEvent({
      title: "Chiuso (pausa)",
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      startTime: pausa.inizio,
      endTime: pausa.fine,
      display: "background",
      color: "#C79A4E"
    });
  }

  Object.values(chiusureGiornoSnap).forEach((c) => {
    const fine = c.dataFine || c.dataInizio || c.data;
    calendar.addEvent({
      title: c.motivo ? `Chiuso - ${c.motivo}` : "Chiuso",
      start: c.dataInizio || c.data,
      end: aggiungiGiorni(fine, 1),
      allDay: true,
      display: "background",
      color: "#C79A4E"
    });
  });

  Object.values(chiusureOrarioSnap).forEach((c) => {
    calendar.addEvent({
      title: c.motivo ? `Chiuso - ${c.motivo}` : "Chiuso",
      start: `${c.data}T${c.oraInizio}`,
      end: `${c.data}T${c.oraFine}`,
      display: "background",
      color: "#C79A4E"
    });
  });

  mostraCalendario();
}

onSnapshot(collection(db, "appuntamenti_pubblici"), (snapshot) => {
  pubbliciSnapshot = {};
  snapshot.forEach((docSnap) => { pubbliciSnapshot[docSnap.id] = docSnap.data(); });
  ricostruisciCalendario();
});

onSnapshot(collection(db, "appuntamenti_privati"), (snapshot) => {
  privatiSnapshot = {};
  snapshot.forEach((docSnap) => { privatiSnapshot[docSnap.id] = docSnap.data(); });
  ricostruisciCalendario();
});

// --- Salvataggio appuntamento (crea o aggiorna) ---
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorEl.textContent = "";

  const datiPubblici = {
    data: dataInput.value,
    ora: oraInput.value,
    durata: Number(durataInput.value),
    servizio: servizioSelect.value
  };
  const datiPrivati = {
    nomeCliente: nomeInput.value.trim(),
    telefono: telefonoInput.value.trim(),
    note: noteInput.value.trim()
  };

  try {
    let id = idInput.value;
    if (!id) {
      const nuovoDocRef = doc(collection(db, "appuntamenti_pubblici"));
      id = nuovoDocRef.id;
      await setDoc(nuovoDocRef, datiPubblici);
      await setDoc(doc(db, "appuntamenti_privati", id), datiPrivati);
    } else {
      await setDoc(doc(db, "appuntamenti_pubblici", id), datiPubblici);
      await setDoc(doc(db, "appuntamenti_privati", id), datiPrivati);
    }
    closeModal();
    mostraToast("Appuntamento salvato");
  } catch (err) {
    errorEl.textContent = "Errore durante il salvataggio. Riprova.";
    console.error(err);
  }
});

deleteBtn.addEventListener("click", async () => {
  const id = idInput.value;
  if (!id) return;
  if (!confirm("Eliminare definitivamente questo appuntamento?")) return;

  try {
    await deleteDoc(doc(db, "appuntamenti_pubblici", id));
    await deleteDoc(doc(db, "appuntamenti_privati", id));
    closeModal();
    mostraToast("Appuntamento eliminato");
  } catch (err) {
    errorEl.textContent = "Errore durante l'eliminazione. Riprova.";
    console.error(err);
  }
});

// --- Gestione lista servizi ---
const servicesListEl = document.getElementById("services-list");
const addServiceForm = document.getElementById("add-service-form");
const newServiceInput = document.getElementById("new-service-name");

onSnapshot(collection(db, "servizi"), (snapshot) => {
  servicesListEl.innerHTML = "";
  servizioSelect.innerHTML = "";

  if (snapshot.empty) {
    servicesListEl.innerHTML = '<p class="empty-state">Nessun servizio ancora. Aggiungine uno qui sotto.</p>';
  }

  snapshot.forEach((docSnap) => {
    const nome = docSnap.data().nome;

    const row = document.createElement("div");
    row.className = "service-row";
    row.innerHTML = `<span>${nome}</span>`;
    const delBtn = document.createElement("button");
    delBtn.className = "link-btn";
    delBtn.textContent = "Elimina";
    delBtn.addEventListener("click", async () => {
      if (confirm(`Eliminare il servizio "${nome}"?`)) {
        await deleteDoc(doc(db, "servizi", docSnap.id));
        mostraToast("Servizio eliminato");
      }
    });
    row.appendChild(delBtn);
    servicesListEl.appendChild(row);

    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    servizioSelect.appendChild(option);
  });
});

addServiceForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = newServiceInput.value.trim();
  if (!nome) return;
  await addDoc(collection(db, "servizi"), { nome });
  newServiceInput.value = "";
  mostraToast("Servizio aggiunto");
});

// --- Orari: giorni di chiusura settimanali + pausa giornaliera ---
const weekdayGrid = document.getElementById("weekday-grid");
const pausaAttivaInput = document.getElementById("pausa-attiva");
const pausaInizioInput = document.getElementById("pausa-inizio");
const pausaFineInput = document.getElementById("pausa-fine");
const saveOrariBtn = document.getElementById("save-orari-btn");
const orariErrorEl = document.getElementById("orari-error");

onSnapshot(doc(db, "config", "orari"), (docSnap) => {
  const dati = docSnap.data() || {};
  giorniChiusuraSettimanali = dati.giorniChiusuraSettimanali || [];
  pausa = { attiva: dati.pausaAttiva, inizio: dati.pausaInizio, fine: dati.pausaFine };

  weekdayGrid.querySelectorAll("input[type=checkbox]").forEach((cb) => {
    cb.checked = giorniChiusuraSettimanali.includes(Number(cb.value));
  });
  pausaAttivaInput.checked = !!dati.pausaAttiva;
  if (dati.pausaInizio) pausaInizioInput.value = dati.pausaInizio;
  if (dati.pausaFine) pausaFineInput.value = dati.pausaFine;

  ricostruisciCalendario();
});

saveOrariBtn.addEventListener("click", async () => {
  orariErrorEl.textContent = "";
  const giorniSelezionati = Array.from(weekdayGrid.querySelectorAll("input[type=checkbox]:checked")).map((cb) => Number(cb.value));

  try {
    await setDoc(doc(db, "config", "orari"), {
      giorniChiusuraSettimanali: giorniSelezionati,
      pausaAttiva: pausaAttivaInput.checked,
      pausaInizio: pausaInizioInput.value,
      pausaFine: pausaFineInput.value
    });
    mostraToast("Orari salvati");
  } catch (err) {
    orariErrorEl.textContent = "Errore durante il salvataggio degli orari.";
    console.error(err);
  }
});

// --- Chiusure per data intera ---
const closuresDayListEl = document.getElementById("closures-day-list");
const addClosureDayForm = document.getElementById("add-closure-day-form");

onSnapshot(collection(db, "chiusure_giorno"), (snapshot) => {
  chiusureGiornoSnap = {};
  closuresDayListEl.innerHTML = "";

  if (snapshot.empty) {
    closuresDayListEl.innerHTML = '<p class="empty-state">Nessuna chiusura per data intera.</p>';
  }

  const righe = [];
  snapshot.forEach((docSnap) => {
    chiusureGiornoSnap[docSnap.id] = docSnap.data();
    righe.push({ id: docSnap.id, ...docSnap.data() });
  });
  righe.sort((a, b) => (a.dataInizio || a.data).localeCompare(b.dataInizio || b.data));

  righe.forEach((c) => {
    const inizio = c.dataInizio || c.data;
    const fine = c.dataFine || c.dataInizio || c.data;
    const etichettaData = inizio === fine ? inizio : `${inizio} → ${fine}`;
    const row = document.createElement("div");
    row.className = "closure-row";
    row.innerHTML = `<div class="closure-info"><div class="closure-date">${etichettaData}</div>${c.motivo ? `<div class="closure-motivo">${c.motivo}</div>` : ""}</div>`;
    const delBtn = document.createElement("button");
    delBtn.className = "link-btn";
    delBtn.textContent = "Elimina";
    delBtn.addEventListener("click", async () => {
      if (confirm("Eliminare questa chiusura?")) {
        await deleteDoc(doc(db, "chiusure_giorno", c.id));
        mostraToast("Chiusura eliminata");
      }
    });
    row.appendChild(delBtn);
    closuresDayListEl.appendChild(row);
  });

  ricostruisciCalendario();
});

const closureDayInizioInput = document.getElementById("closure-day-date-inizio");
const closureDayFineInput = document.getElementById("closure-day-date-fine");
const closureDayErrorEl = document.getElementById("closure-day-error");

// Comodità: quando si sceglie la data di inizio, precompila la data di fine se vuota
closureDayInizioInput.addEventListener("change", () => {
  if (!closureDayFineInput.value) closureDayFineInput.value = closureDayInizioInput.value;
});

addClosureDayForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  closureDayErrorEl.textContent = "";
  const dataInizio = closureDayInizioInput.value;
  const dataFine = closureDayFineInput.value || dataInizio;
  const motivo = document.getElementById("closure-day-motivo").value.trim();
  if (!dataInizio) return;

  if (dataFine < dataInizio) {
    closureDayErrorEl.textContent = "La data di fine non può precedere la data di inizio.";
    return;
  }

  await addDoc(collection(db, "chiusure_giorno"), { dataInizio, dataFine, motivo });
  addClosureDayForm.reset();
  mostraToast("Chiusura aggiunta");
});

// --- Chiusure per fascia oraria in data specifica ---
const closuresTimeListEl = document.getElementById("closures-time-list");
const addClosureTimeForm = document.getElementById("add-closure-time-form");

onSnapshot(collection(db, "chiusure_orario"), (snapshot) => {
  chiusureOrarioSnap = {};
  closuresTimeListEl.innerHTML = "";

  if (snapshot.empty) {
    closuresTimeListEl.innerHTML = '<p class="empty-state">Nessuna chiusura per fascia oraria specifica.</p>';
  }

  const righe = [];
  snapshot.forEach((docSnap) => {
    chiusureOrarioSnap[docSnap.id] = docSnap.data();
    righe.push({ id: docSnap.id, ...docSnap.data() });
  });
  righe.sort((a, b) => (a.data + a.oraInizio).localeCompare(b.data + b.oraInizio));

  righe.forEach((c) => {
    const row = document.createElement("div");
    row.className = "closure-row";
    row.innerHTML = `<div class="closure-info"><div class="closure-date">${c.data} · ${c.oraInizio}-${c.oraFine}</div>${c.motivo ? `<div class="closure-motivo">${c.motivo}</div>` : ""}</div>`;
    const delBtn = document.createElement("button");
    delBtn.className = "link-btn";
    delBtn.textContent = "Elimina";
    delBtn.addEventListener("click", async () => {
      if (confirm("Eliminare questa chiusura?")) {
        await deleteDoc(doc(db, "chiusure_orario", c.id));
        mostraToast("Chiusura eliminata");
      }
    });
    row.appendChild(delBtn);
    closuresTimeListEl.appendChild(row);
  });

  ricostruisciCalendario();
});

addClosureTimeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = document.getElementById("closure-time-date").value;
  const oraInizio = document.getElementById("closure-time-inizio").value;
  const oraFine = document.getElementById("closure-time-fine").value;
  const motivo = document.getElementById("closure-time-motivo").value.trim();
  if (!data || !oraInizio || !oraFine) return;

  await addDoc(collection(db, "chiusure_orario"), { data, oraInizio, oraFine, motivo });
  addClosureTimeForm.reset();
  mostraToast("Chiusura aggiunta");
});

// --- Anagrafica attività ---
const anagraficaForm = document.getElementById("anagrafica-form");
const anagraficaNomeAttivitaInput = document.getElementById("anagrafica-nome-attivita");
const anagraficaNomeBarbiereInput = document.getElementById("anagrafica-nome-barbiere");
const anagraficaIndirizzoInput = document.getElementById("anagrafica-indirizzo");
const anagraficaCellulareInput = document.getElementById("anagrafica-cellulare");
const anagraficaErrorEl = document.getElementById("anagrafica-error");

onSnapshot(doc(db, "config", "anagrafica"), (docSnap) => {
  const dati = docSnap.data() || {};
  anagraficaNomeAttivitaInput.value = dati.nomeAttivita || "";
  anagraficaNomeBarbiereInput.value = dati.nomeBarbiere || "";
  anagraficaIndirizzoInput.value = dati.indirizzo || "";
  anagraficaCellulareInput.value = dati.cellulare || "";
});

anagraficaForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  anagraficaErrorEl.textContent = "";

  try {
    await setDoc(doc(db, "config", "anagrafica"), {
      nomeAttivita: anagraficaNomeAttivitaInput.value.trim(),
      nomeBarbiere: anagraficaNomeBarbiereInput.value.trim(),
      indirizzo: anagraficaIndirizzoInput.value.trim(),
      cellulare: anagraficaCellulareInput.value.trim()
    });
    mostraToast("Anagrafica salvata");
  } catch (err) {
    anagraficaErrorEl.textContent = "Errore durante il salvataggio. Riprova.";
    console.error(err);
  }
});
