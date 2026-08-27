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

// --- Riferimenti DOM ---
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

let currentPrivateData = {}; // cache dati privati per unione con quelli pubblici nel calendario
let serviziCache = [];

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
  selectable: true,
  dateClick: (info) => openModal("new", info),
  eventClick: (info) => openModal("edit", info.event)
});
calendar.render();

// --- Sincronizzazione dati privati e pubblici, unione per il rendering ---
let pubbliciSnapshot = {};
let privatiSnapshot = {};

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
      color: "#6b4226",
      extendedProps: { pubblico: pub, privato: priv }
    });
  });
}

onSnapshot(collection(db, "appuntamenti_pubblici"), (snapshot) => {
  pubbliciSnapshot = {};
  snapshot.forEach((docSnap) => {
    pubbliciSnapshot[docSnap.id] = docSnap.data();
  });
  ricostruisciCalendario();
});

onSnapshot(collection(db, "appuntamenti_privati"), (snapshot) => {
  privatiSnapshot = {};
  snapshot.forEach((docSnap) => {
    privatiSnapshot[docSnap.id] = docSnap.data();
  });
  ricostruisciCalendario();
});

// --- Salvataggio (crea o aggiorna) ---
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
      // Genera un nuovo id condiviso tra le due collezioni
      const nuovoDocRef = doc(collection(db, "appuntamenti_pubblici"));
      id = nuovoDocRef.id;
      await setDoc(nuovoDocRef, datiPubblici);
      await setDoc(doc(db, "appuntamenti_privati", id), datiPrivati);
    } else {
      await setDoc(doc(db, "appuntamenti_pubblici", id), datiPubblici);
      await setDoc(doc(db, "appuntamenti_privati", id), datiPrivati);
    }
    closeModal();
  } catch (err) {
    errorEl.textContent = "Errore durante il salvataggio. Riprova.";
    console.error(err);
  }
});

// --- Eliminazione ---
deleteBtn.addEventListener("click", async () => {
  const id = idInput.value;
  if (!id) return;
  if (!confirm("Eliminare definitivamente questo appuntamento?")) return;

  try {
    await deleteDoc(doc(db, "appuntamenti_pubblici", id));
    await deleteDoc(doc(db, "appuntamenti_privati", id));
    closeModal();
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
  serviziCache = [];
  servicesListEl.innerHTML = "";
  servizioSelect.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const nome = docSnap.data().nome;
    serviziCache.push({ id: docSnap.id, nome });

    const row = document.createElement("div");
    row.className = "service-row";
    row.innerHTML = `<span>${nome}</span>`;
    const delBtn = document.createElement("button");
    delBtn.textContent = "Elimina";
    delBtn.addEventListener("click", async () => {
      if (confirm(`Eliminare il servizio "${nome}"?`)) {
        await deleteDoc(doc(db, "servizi", docSnap.id));
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
});
