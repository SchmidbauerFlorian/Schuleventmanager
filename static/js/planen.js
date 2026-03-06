import { showMessageBox, loadEvents, loadEvent, openOverlay, closeOverlay, updateEventDetails, updateEventDropdown, updateMessageHistory, updateRessourceStatistics, updateInteractionStatistics, updateAllEventUI } from "./main.js";

const createEventBtn = document.getElementById("btnCreateEvent");
const createEventSubmitBtn = document.getElementById("btnCreateEventSubmit");
const deleteEventBtn = document.getElementById("btnDeleteEvent");
const deleteEventSubmitBtn = document.getElementById("btnDeleteEventSubmit");
const expandTreeViewBtn = document.getElementById("btnExpandTreeView");

expandTreeViewBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const sectionEvent = document.getElementById("section-event");
  const sectionBodyEvent = document.getElementById("section-body-event");
  const sectionBodyEventExtended = document.getElementById("section-body-event-extended");
  const expandedContainer = document.getElementById("expanded-container");
  const iconExpandTreeView = document.getElementById("iconExpandTreeView");

  if(sectionEvent.style.position === "fixed"){
    sectionEvent.style.position = "relative";
    sectionEvent.style.borderRadius = "calc(var(--space) * 4)";
    sectionEvent.style.padding = "calc(var(--space) * 4)";

    sectionBodyEvent.style.height = "388px";

    sectionBodyEventExtended.style.display = "none";

    expandedContainer.style.width = "100%";
    expandedContainer.style.margin = "0";

    iconExpandTreeView.src = "/static/assets/images/arrow-expand.svg";
  }
  else{
    sectionEvent.style.position = "fixed";
    sectionEvent.style.borderRadius = "0";
    sectionEvent.style.padding = "calc(var(--space) * 2)";

    sectionBodyEvent.style.height = "auto";

    sectionBodyEventExtended.style.display = "flex";

    expandedContainer.style.width = "calc(1366px - (var(--space) * 4 * 2))";
    expandedContainer.style.margin = "0 auto";

    iconExpandTreeView.src = "/static/assets/images/overlay-close.svg";
  }
});
createEventBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  openOverlay("create-event");
});
deleteEventBtn.addEventListener("click",  (e) => {
  e.stopPropagation();
  openOverlay("delete-event");
});
createEventSubmitBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeOverlay();

  const eventName = document.getElementById("inputEventName").value;
  if(!eventName){
    showMessageBox("Fehler: Eventname darf nicht leer sein!");
    return;
  }

  await createEvent();
});
deleteEventSubmitBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeOverlay();

  const eventNameInput = document.getElementById("inputEventNameDelete").value;
  const eventName = document.getElementById("eventName").innerHTML;

  if(eventNameInput !== eventName){
    showMessageBox("Fehler: Eventname stimmt nicht überein!");
    return;
  }

  await deleteEvent();
});
document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();
    updateAllEventUI(events);
});

async function deleteEvent() {
  const eventName = document.getElementById("inputEventNameDelete").value;

  const response = await fetch("/api/events", {
    method: "DELETE",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ eventName })
  });

  const events = await response.json();
  updateAllEventUI(events);
}

async function createEvent() {
  const eventName = document.getElementById("inputEventName").value;

  const response = await fetch("/api/events", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ eventName })
  });

  const events = await response.json();
  updateAllEventUI(events);
}

// --- Ressource Dropdown & Tags ---
const personenDropdownBtn = document.getElementById("personenDropdownBtn");
const personenDropdown = document.getElementById("personenDropdown");
const personenSearch = document.getElementById("personenSearch");
const selectedGroupsContainer = document.getElementById("selectedGroups");
const selectedGroups = new Set();

personenDropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = personenDropdown.style.display === "flex";
  attributDropdown.style.display = "none";
  closeAllSubDropdowns();
  personenDropdown.style.display = isOpen ? "none" : "flex";
  if (!isOpen) personenSearch.focus();
});

personenSearch.addEventListener("input", () => {
  const query = personenSearch.value.toLowerCase();
  const items = personenDropdown.querySelectorAll(".dropdown-item");
  items.forEach(item => {
    const group = item.dataset.group.toLowerCase();
    const alreadySelected = selectedGroups.has(item.dataset.group);
    item.style.display = (!alreadySelected && group.includes(query)) ? "flex" : "none";
  });
});

personenSearch.addEventListener("click", (e) => {
  e.stopPropagation();
  personenDropdown.style.display = "flex";
  filterDropdownItems(personenSearch.value.toLowerCase());
});

personenDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  const group = item.dataset.group;
  if (selectedGroups.has(group)) return;
  selectedGroups.add(group);
  item.style.display = "none";
  renderTags();
  personenSearch.value = "";
  filterDropdownItems("");
});

document.addEventListener("click", () => {
  personenDropdown.style.display = "none";
});

function filterDropdownItems(query) {
  const items = personenDropdown.querySelectorAll(".dropdown-item");
  items.forEach(item => {
    const group = item.dataset.group.toLowerCase();
    const alreadySelected = selectedGroups.has(item.dataset.group);
    item.style.display = (!alreadySelected && group.includes(query)) ? "flex" : "none";
  });
}

function renderTags() {
  selectedGroupsContainer.innerHTML = "";
  selectedGroups.forEach(group => {
    const tag = document.createElement("div");
    tag.className = "group-tag";
    tag.innerHTML = `<p>${group}</p><img src="/static/assets/images/tv_x.svg" alt="Remove">`;
    tag.querySelector("img").addEventListener("click", () => {
      selectedGroups.delete(group);
      renderTags();
      filterDropdownItems(personenSearch.value.toLowerCase());
    });
    selectedGroupsContainer.appendChild(tag);
  });
}

// --- Attribut Dropdown ---
const attributDropdownBtn = document.getElementById("attributDropdownBtn");
const attributDropdown = document.getElementById("attributDropdown");
const attributFieldsApi = document.getElementById("attributFieldsApi");
const attributFieldsRessource = document.getElementById("attributFieldsRessource");

attributDropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = attributDropdown.style.display === "flex";
  closeAllSubDropdowns();
  personenDropdown.style.display = "none";
  attributDropdown.style.display = isOpen ? "none" : "flex";
});

attributDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  const type = item.dataset.type;
  const text = item.querySelector("p").textContent;
  document.getElementById("attributSelectedText").textContent = text;
  attributDropdown.style.display = "none";

  attributFieldsApi.style.display = type === "api" ? "flex" : "none";
  attributFieldsRessource.style.display = type === "ressource" ? "flex" : "none";
  const attributFieldsEingabe = document.getElementById("attributFieldsEingabe");
  attributFieldsEingabe.style.display = type === "eingabe" ? "flex" : "none";
  closeAllSubDropdowns();
});

document.addEventListener("click", () => {
  attributDropdown.style.display = "none";
  closeAllSubDropdowns();
});

// --- Generic sub-dropdown logic ---
const subDropdowns = [
  { btn: "apiEmailDropdownBtn", dropdown: "apiEmailDropdown", text: "apiEmailSelectedText" },
  { btn: "apiBerechtigungDropdownBtn", dropdown: "apiBerechtigungDropdown", text: "apiBerechtigungSelectedText" },
  { btn: "apiHinzufuegenDropdownBtn", dropdown: "apiHinzufuegenDropdown", text: "apiHinzufuegenSelectedText" },
  { btn: "resRessourceDropdownBtn", dropdown: "resRessourceDropdown", text: "resRessourceSelectedText" },
  { btn: "resAttributDropdownBtn", dropdown: "resAttributDropdown", text: "resAttributSelectedText" },
  { btn: "resHinzufuegenDropdownBtn", dropdown: "resHinzufuegenDropdown", text: "resHinzufuegenSelectedText" },
  { btn: "eingabeBerechtigungDropdownBtn", dropdown: "eingabeBerechtigungDropdown", text: "eingabeBerechtigungSelectedText" },
  { btn: "eingabeFormatDropdownBtn", dropdown: "eingabeFormatDropdown", text: "eingabeFormatSelectedText" },
  { btn: "eingabeHinzufuegenDropdownBtn", dropdown: "eingabeHinzufuegenDropdown", text: "eingabeHinzufuegenSelectedText" },
];

function closeAllSubDropdowns() {
  subDropdowns.forEach(sd => {
    const dd = document.getElementById(sd.dropdown);
    if (dd) dd.style.display = "none";
  });
}

subDropdowns.forEach(sd => {
  const btn = document.getElementById(sd.btn);
  const dropdown = document.getElementById(sd.dropdown);
  const textEl = document.getElementById(sd.text);

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = dropdown.style.display === "flex";
    closeAllSubDropdowns();
    attributDropdown.style.display = "none";
    personenDropdown.style.display = "none";
    dropdown.style.display = isOpen ? "none" : "flex";
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
    const item = e.target.closest(".dropdown-item");
    if (!item) return;
    textEl.textContent = item.querySelector("p").textContent;
    dropdown.style.display = "none";
  });
});

// --- Eingabe: Zeitlimit (date picker) ---
const eingabeZeitlimitBtn = document.getElementById("eingabeZeitlimitBtn");
const eingabeZeitlimitDate = document.getElementById("eingabeZeitlimitDate");
const eingabeZeitlimitText = document.getElementById("eingabeZeitlimitText");

eingabeZeitlimitBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  eingabeZeitlimitDate.showPicker ? eingabeZeitlimitDate.showPicker() : eingabeZeitlimitDate.click();
});

eingabeZeitlimitDate.addEventListener("change", () => {
  if (eingabeZeitlimitDate.value) {
    const parts = eingabeZeitlimitDate.value.split("-");
    eingabeZeitlimitText.textContent = parts[2] + "." + parts[1] + "." + parts[0];
  } else {
    eingabeZeitlimitText.textContent = "Kein Zeitlimit";
  }
});

// --- Eingabe: Pflichtfeld Toggle ---
const eingabePflichtBtn = document.getElementById("eingabePflichtBtn");
const eingabePflichtText = document.getElementById("eingabePflichtText");
const eingabePflichtIcon = document.getElementById("eingabePflichtIcon");
let isPflichtfeld = false;

eingabePflichtBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  isPflichtfeld = !isPflichtfeld;
  eingabePflichtText.textContent = isPflichtfeld ? "Pflichtfeld" : "Kein Pflichtfeld";
  eingabePflichtIcon.src = isPflichtfeld ? "/static/assets/images/toggle-right.svg" : "/static/assets/images/toggle-left.svg";
});