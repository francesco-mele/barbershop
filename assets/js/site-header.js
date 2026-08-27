// Applica in tempo reale l'anagrafica dell'attività (config/anagrafica) a tutti gli elementi
// con classe .site-nome-attivita e .contact-line presenti nella pagina, più il titolo del tab.
// Usato da index.html, admin/login.html e admin/dashboard.html per mantenere le intestazioni coerenti.
import { db } from "./firebase-config.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const DEFAULT_INFO = {
  nomeAttivita: "Barber Shop",
  nomeBarbiere: "",
  indirizzo: "",
  cellulare: ""
};

function applica(dati) {
  const info = { ...DEFAULT_INFO, ...dati };

  document.title = info.nomeAttivita;

  document.querySelectorAll(".site-nome-attivita").forEach((el) => {
    el.textContent = info.nomeAttivita;
  });

  document.querySelectorAll(".contact-line").forEach((el) => {
    const parti = [info.nomeBarbiere, info.indirizzo].filter(Boolean);
    const telefonoHtml = info.cellulare
      ? `<a href="tel:${info.cellulare.replace(/\s+/g, "")}">${info.cellulare}</a>`
      : "";
    const tutte = [...parti, telefonoHtml].filter(Boolean);
    el.innerHTML = tutte.join(" &middot; ");
  });
}

onSnapshot(doc(db, "config", "anagrafica"), (docSnap) => {
  applica(docSnap.data() || {});
});
