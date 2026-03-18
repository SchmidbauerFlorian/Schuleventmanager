import { showMessageBox, loadEvents, loadEvent, openOverlay, closeOverlay, updateEventDetails, updateEventDropdown, updateMessageHistory, updateRessourceStatistics, updateInteractionStatistics, updateAllEventUI, setOverlayHiddenByExpandedTree } from "./main.js";

const createEventBtn = document.getElementById("btnCreateEvent");
const createEventSubmitBtn = document.getElementById("btnCreateEventSubmit");
const deleteEventBtn = document.getElementById("btnDeleteEvent");
const deleteEventSubmitBtn = document.getElementById("btnDeleteEventSubmit");
const expandTreeViewBtn = document.getElementById("btnExpandTreeView");

// --- Horizontal Scroll Buttons ---
const scrollContainer = document.getElementById("section-body-event");
const btnScrollLeft = document.getElementById("btnScrollLeft");
const btnScrollRight = document.getElementById("btnScrollRight");

const ARROW_LEFT_ACTIVE = "/static/assets/images/arrow-left-active.svg";
const ARROW_LEFT_INACTIVE = "/static/assets/images/arrow-left-inactive.svg";
const ARROW_RIGHT_ACTIVE = "/static/assets/images/arrow-right-active.svg";
const ARROW_RIGHT_INACTIVE = "/static/assets/images/arrow-right-inactive.svg";

function setTreeArrowState(button, isActive, activeSrc, inactiveSrc) {
  if (!button) return;
  button.src = isActive ? activeSrc : inactiveSrc;
  button.classList.toggle("clickable", isActive);
  button.style.pointerEvents = isActive ? "auto" : "none";
  button.style.cursor = isActive ? "pointer" : "default";
  button.setAttribute("aria-disabled", isActive ? "false" : "true");
}

function updateTreeScrollButtons() {
  if (!scrollContainer) return;
  const maxScrollLeft = Math.max(scrollContainer.scrollWidth - scrollContainer.clientWidth, 0);
  const canScrollLeft = scrollContainer.scrollLeft > 1;
  const canScrollRight = scrollContainer.scrollLeft < maxScrollLeft - 1;

  setTreeArrowState(btnScrollLeft, canScrollLeft, ARROW_LEFT_ACTIVE, ARROW_LEFT_INACTIVE);
  setTreeArrowState(btnScrollRight, canScrollRight, ARROW_RIGHT_ACTIVE, ARROW_RIGHT_INACTIVE);
}

function getTreeHorizontalStep() {
  const firstCell = document.querySelector(".tree-resource-header-row > *");
  if (firstCell) {
    const width = Math.round(firstCell.getBoundingClientRect().width);
    if (width > 0) return width;
  }
  return 246;
}

function scheduleTreeScrollButtonsUpdate() {
  requestAnimationFrame(() => {
    updateTreeScrollButtons();
    // Re-check after layout settles (expanded mode changes several dimensions).
    setTimeout(updateTreeScrollButtons, 0);
    setTimeout(updateTreeScrollButtons, 120);
  });
}

if (scrollContainer) {
  scrollContainer.addEventListener("scroll", updateTreeScrollButtons);
  window.addEventListener("resize", updateTreeScrollButtons);

  // Keep arrow state synced when the scroll container size changes (e.g. expanded mode).
  if (typeof ResizeObserver !== "undefined") {
    const treeResizeObserver = new ResizeObserver(() => {
      scheduleTreeScrollButtonsUpdate();
    });
    treeResizeObserver.observe(scrollContainer);
  }
}

btnScrollLeft.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!scrollContainer || scrollContainer.scrollLeft <= 1) return;
  scrollContainer.scrollBy({ left: -getTreeHorizontalStep(), behavior: "smooth" });
});
btnScrollRight.addEventListener("click", (e) => {
  e.stopPropagation();
  if (!scrollContainer) return;
  const maxScrollLeft = Math.max(scrollContainer.scrollWidth - scrollContainer.clientWidth, 0);
  if (scrollContainer.scrollLeft >= maxScrollLeft - 1) return;
  scrollContainer.scrollBy({ left: getTreeHorizontalStep(), behavior: "smooth" });
});

updateTreeScrollButtons();

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
    sectionBodyEvent.style.flex = "";
    sectionBodyEvent.style.minHeight = "";

    sectionBodyEventExtended.style.display = "none";

    expandedContainer.style.width = "100%";
    expandedContainer.style.margin = "0";
    expandedContainer.style.display = "";
    expandedContainer.style.flexDirection = "";
    expandedContainer.style.height = "";

    iconExpandTreeView.src = "/static/assets/images/arrow-expand.svg";
    sectionBodyEvent.classList.remove('expanded');
    setOverlayHiddenByExpandedTree(false);
    exitEditMode();
  }
  else{
    sectionEvent.style.position = "fixed";
    sectionEvent.style.borderRadius = "0";
    sectionEvent.style.padding = "calc(var(--space) * 2)";

    expandedContainer.style.display = "flex";
    expandedContainer.style.flexDirection = "column";
    expandedContainer.style.height = "100%";

    sectionBodyEvent.style.height = "0";
    sectionBodyEvent.style.flex = "1";
    sectionBodyEvent.style.minHeight = "0";

    sectionBodyEventExtended.style.display = "flex";

    expandedContainer.style.width = "calc(1366px - (var(--space) * 4 * 2))";
    expandedContainer.style.margin = "0 auto";

    iconExpandTreeView.src = "/static/assets/images/overlay-close.svg";
    sectionBodyEvent.classList.add('expanded');
    setOverlayHiddenByExpandedTree(true);
  }

  scheduleTreeScrollButtonsUpdate();
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
    await refreshTreeView();
    await refreshDropdowns();
});

// Refresh tree + dropdowns when event is selected from dropdown
window.addEventListener("eventSelected", async () => {
  await refreshTreeView();
  await refreshDropdowns();
});

async function deleteEvent() {
  const eventName = document.getElementById("inputEventNameDelete").value;
  const eventId = getCurrentEventId();
  if (!eventId) {
    showMessageBox("Fehler: Bitte ein einzelnes Event auswählen!");
    return;
  }

  try {
    const response = await fetch("/api/events", {
      method: "DELETE",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ eventName, eventInstanceId: eventId })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error || "Fehler beim Löschen des Events!";
      showMessageBox("Fehler: " + errMsg);
      return;
    }

    const events = await response.json();
    updateAllEventUI(events);
    await refreshTreeView();
    await refreshDropdowns();
    showMessageBox(`Event '${eventName}' gelöscht!`, "info");
  } catch (err) {
    console.error("[Delete Event] Fetch error:", err);
    showMessageBox("Fehler beim Löschen des Events!");
  }
}

async function createEvent() {
  const eventName = document.getElementById("inputEventName").value;

  try {
    const response = await fetch("/api/events", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ eventName })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error || "Fehler beim Erstellen des Events!";
      showMessageBox("Fehler: " + errMsg);
      return;
    }

    const events = await response.json();
    updateAllEventUI(events);
    await refreshTreeView();
    await refreshDropdowns();
    showMessageBox(`Event '${eventName}' erstellt!`, "info");
  } catch (err) {
    console.error("[Create Event] Fetch error:", err);
    showMessageBox("Fehler beim Erstellen des Events!");
  }
}

// --- Ressource Dropdown & Tags ---
const personenDropdownBtn = document.getElementById("personenDropdownBtn");
const personenDropdown = document.getElementById("personenDropdown");
const personenSearch = document.getElementById("personenSearch");
const personenSyncBtn = document.getElementById("personenSyncBtn");
const selectedGroupsContainer = document.getElementById("selectedGroups");
const selectedUsers = new Map(); // uid -> { user_id, display_name, email }
const selectedClasses = new Set(); // class name strings like "5AHIT"
// Compat shim used by exitEditMode / success handler
const selectedGroups = { clear() { selectedUsers.clear(); selectedClasses.clear(); } };

let _userSearchTimer = null;
let _cachedClasses = null;

personenDropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  const isOpen = personenDropdown.style.display === "flex";
  attributDropdown.style.display = "none";
  closeAllSubDropdowns();
  personenDropdown.style.display = isOpen ? "none" : "flex";
  if (!isOpen) {
    personenSearch.focus();
    fetchAndRenderDropdown(personenSearch.value.trim());
  }
});

personenSearch.addEventListener("input", () => {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(() => {
    fetchAndRenderDropdown(personenSearch.value.trim());
    personenDropdown.style.display = "flex";
  }, 250);
});

personenSearch.addEventListener("click", (e) => {
  e.stopPropagation();
  personenDropdown.style.display = "flex";
  fetchAndRenderDropdown(personenSearch.value.trim());
});

if (personenSyncBtn) {
  personenSyncBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    personenSyncBtn.style.pointerEvents = "none";
    personenSyncBtn.style.opacity = "0.5";

    try {
      const response = await fetch("/api/users/sync", { method: "POST" });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error || "Verzeichnis konnte nicht aktualisiert werden.";
        showMessageBox("Fehler: " + errMsg);
        return;
      }

      _cachedClasses = null;
      await fetchAndRenderDropdown(personenSearch.value.trim());
      personenDropdown.style.display = "flex";
      showMessageBox("Verzeichnis aktualisiert.", "info");
    } catch (err) {
      console.error("Directory sync error:", err);
      showMessageBox("Fehler beim Aktualisieren des Verzeichnisses!");
    } finally {
      personenSyncBtn.style.pointerEvents = "auto";
      personenSyncBtn.style.opacity = "1";
    }
  });
}

personenDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  const item = e.target.closest(".dropdown-item");
  if (!item) return;

  if (item.dataset.className) {
    // Class item
    const cls = item.dataset.className;
    if (selectedClasses.has(cls)) return;
    selectedClasses.add(cls);
  } else if (item.dataset.userId) {
    // Individual user item
    const uid = item.dataset.userId;
    if (selectedUsers.has(uid)) return;
    selectedUsers.set(uid, {
      user_id: uid,
      display_name: item.dataset.userName,
      email: item.dataset.userEmail,
    });
  }
  item.style.display = "none";
  renderTags();
  personenSearch.value = "";
});

document.addEventListener("click", () => {
  personenDropdown.style.display = "none";
});

async function fetchAndRenderDropdown(query) {
  // Fetch classes (cached after first load)
  if (!_cachedClasses) {
    try {
      const cRes = await fetch("/api/user-classes");
      _cachedClasses = await cRes.json();
    } catch (err) {
      console.error("User classes error:", err);
      _cachedClasses = [];
    }
  }

  // Fetch users
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  let users = [];
  try {
    const res = await fetch(`/api/users?${params}`);
    users = await res.json();
  } catch (err) {
    console.error("User search error:", err);
  }

  personenDropdown.innerHTML = "";

  // --- Class section ---
  const q = (query || "").toLowerCase();
  const matchingClasses = _cachedClasses.filter(
    c => !selectedClasses.has(c) && c.toLowerCase().includes(q)
  );
  if (matchingClasses.length > 0) {
    const header = document.createElement("div");
    header.className = "dropdown-section-header";
    header.innerHTML = "<p>Klassen</p>";
    personenDropdown.appendChild(header);
    matchingClasses.forEach(cls => {
      const item = document.createElement("div");
      item.className = "dropdown-item clickable";
      item.dataset.className = cls;
      item.innerHTML = `<p>${cls}</p>`;
      personenDropdown.appendChild(item);
    });
  }

  // --- User section ---
  const filteredUsers = users.filter(u => !selectedUsers.has(u.user_id));
  if (filteredUsers.length > 0) {
    const header = document.createElement("div");
    header.className = "dropdown-section-header";
    header.innerHTML = "<p>Personen</p>";
    personenDropdown.appendChild(header);
    filteredUsers.forEach(u => {
      const item = document.createElement("div");
      item.className = "dropdown-item clickable";
      item.dataset.userId = u.user_id;
      item.dataset.userName = u.display_name;
      item.dataset.userEmail = u.email || "";
      const classLabel = (u.job_title || "").trim();
      const nameEmail = u.email ? `${u.display_name} — ${u.email}` : u.display_name;
      const label = classLabel ? `${nameEmail} (${classLabel})` : nameEmail;
      item.innerHTML = `<p>${label}</p>`;
      personenDropdown.appendChild(item);
    });
  }

  if (matchingClasses.length === 0 && filteredUsers.length === 0) {
    const empty = document.createElement("div");
    empty.className = "dropdown-item";
    empty.innerHTML = "<p>Keine Ergebnisse</p>";
    empty.style.pointerEvents = "none";
    empty.style.opacity = "0.5";
    personenDropdown.appendChild(empty);
  }
}

function renderTags() {
  selectedGroupsContainer.innerHTML = "";
  selectedClasses.forEach(cls => {
    const tag = document.createElement("div");
    tag.className = "group-tag";
    tag.innerHTML = `<p>${cls}</p><img src="/static/assets/images/tv_x.svg" alt="Remove">`;
    tag.querySelector("img").addEventListener("click", () => {
      selectedClasses.delete(cls);
      renderTags();
    });
    selectedGroupsContainer.appendChild(tag);
  });
  selectedUsers.forEach((user, uid) => {
    const tag = document.createElement("div");
    tag.className = "group-tag";
    tag.innerHTML = `<p>${user.display_name}</p><img src="/static/assets/images/tv_x.svg" alt="Remove">`;
    tag.querySelector("img").addEventListener("click", () => {
      selectedUsers.delete(uid);
      renderTags();
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
  if (type === "eingabe") {
    const targetText = document.getElementById("eingabeHinzufuegenSelectedText");
    targetText.textContent = "Hinzufügen zu";
    delete targetText.dataset.entityId;
    delete targetText.dataset.hasPersons;

    const berText = document.getElementById("eingabeBerechtigungSelectedText");
    berText.textContent = "Berechtigung";
    delete berText.dataset.access;

    document.querySelectorAll('#eingabeBerechtigungDropdown .dropdown-item').forEach(i => i.style.display = '');
    applyEingabeDependencyState();
  }
  closeAllSubDropdowns();
});

document.addEventListener("click", () => {
  attributDropdown.style.display = "none";
  closeAllSubDropdowns();
  // Close konfig dropdowns
  const kdd = document.getElementById("konfigLinkDropdown");
  if (kdd) kdd.style.display = "none";
  const kad = document.getElementById("konfigAttrDatatypeDropdown");
  if (kad) kad.style.display = "none";
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
    if (btn.classList.contains("is-disabled-20")) return;
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
    if (item.dataset.entityId) textEl.dataset.entityId = item.dataset.entityId;
    if (item.dataset.access) textEl.dataset.access = item.dataset.access;
    if (item.dataset.hasPersons) textEl.dataset.hasPersons = item.dataset.hasPersons;
    dropdown.style.display = "none";

    // Eingabe: when target resource changes, toggle Schreiben option
    if (sd.text === "eingabeHinzufuegenSelectedText") {
      const isPersonRes = item.dataset.hasPersons === "true";
      const writeItem = document.querySelector('#eingabeBerechtigungDropdown .dropdown-item[data-access="write"]');
      if (writeItem) writeItem.style.display = isPersonRes ? '' : 'none';
      // Reset Berechtigung if Schreiben was selected for non-person
      const berText = document.getElementById('eingabeBerechtigungSelectedText');
      if (!isPersonRes && berText.dataset.access === 'write') {
        berText.textContent = 'Berechtigung';
        delete berText.dataset.access;
      }
      applyEingabeDependencyState();
    }
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

function setEingabeControlDisabled(controlEl, disabled) {
  if (!controlEl) return;
  controlEl.classList.toggle("is-disabled-20", Boolean(disabled));
}

function resetEingabeZeitlimitAndPflichtfeld() {
  eingabeZeitlimitDate.value = "";
  eingabeZeitlimitText.textContent = "Kein Zeitlimit";
  isPflichtfeld = false;
  eingabePflichtText.textContent = "Kein Pflichtfeld";
  eingabePflichtIcon.src = "/static/assets/images/toggle-left.svg";
}

function applyEingabeDependencyState() {
  const targetText = document.getElementById("eingabeHinzufuegenSelectedText");
  const hasTarget = Boolean(targetText?.dataset?.entityId);
  const isPersonRes = targetText?.dataset?.hasPersons === "true";

  setEingabeControlDisabled(document.getElementById("eingabeBerechtigungDropdownBtn"), !hasTarget);

  const disableZeitlimitAndPflicht = !hasTarget || !isPersonRes;
  setEingabeControlDisabled(eingabeZeitlimitBtn, disableZeitlimitAndPflicht);
  setEingabeControlDisabled(eingabePflichtBtn, disableZeitlimitAndPflicht);

  if (disableZeitlimitAndPflicht) {
    resetEingabeZeitlimitAndPflichtfeld();
  }
}

applyEingabeDependencyState();

eingabePflichtBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  isPflichtfeld = !isPflichtfeld;
  eingabePflichtText.textContent = isPflichtfeld ? "Pflichtfeld" : "Kein Pflichtfeld";
  eingabePflichtIcon.src = isPflichtfeld ? "/static/assets/images/toggle-right.svg" : "/static/assets/images/toggle-left.svg";
});


// =========================================================================
// Resource & Attribute Creation
// =========================================================================

function getCurrentEventId() {
  return window._currentEventId || null;
}

function getActiveAttributeType() {
  if (document.getElementById("attributFieldsApi").style.display === "flex") return "api";
  if (document.getElementById("attributFieldsRessource").style.display === "flex") return "ressource";
  if (document.getElementById("attributFieldsEingabe").style.display === "flex") return "eingabe";
  return null;
}

// --- Create Resource ---
const btnCreateRessource = document.getElementById("btnCreateRessource");
btnCreateRessource.addEventListener("click", async (e) => {
  e.stopPropagation();
  const resourceName = document.getElementById("ressourceName").value.trim();
  if (!resourceName) {
    showMessageBox("Fehler: Ressourcenname darf nicht leer sein!");
    return;
  }
  const eventId = getCurrentEventId();
  if (!eventId) {
    showMessageBox("Fehler: Bitte zuerst ein einzelnes Event auswählen!");
    return;
  }
  const userIds = Array.from(selectedUsers.keys());
  const classGroups = Array.from(selectedClasses);

  try {
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceName, userIds, classGroups, eventInstanceId: eventId }),
    });

    if (response.ok) {
      showMessageBox(`Ressource '${resourceName}' erstellt!`, "info");
      document.getElementById("ressourceName").value = "";
      selectedGroups.clear();
      renderTags();
      await refreshTreeView();
      await refreshDropdowns();
    } else {
      const errText = await response.text();
      console.error("[Resource] Server error:", response.status, errText);
      showMessageBox("Fehler beim Erstellen der Ressource!");
    }
  } catch (err) {
    console.error("[Resource] Fetch error:", err);
    showMessageBox("Fehler beim Erstellen der Ressource!");
  }
});

// --- Create Attribute ---
const btnCreateAttribut = document.getElementById("btnCreateAttribut");
btnCreateAttribut.addEventListener("click", async (e) => {
  e.stopPropagation();
  const activeType = getActiveAttributeType();
  if (!activeType) {
    showMessageBox("Fehler: Bitte zuerst einen Attributtyp wählen!");
    return;
  }
  const eventId = getCurrentEventId();
  if (!eventId) {
    showMessageBox("Fehler: Bitte zuerst ein einzelnes Event auswählen!");
    return;
  }

  let payload = { type: activeType, eventInstanceId: eventId };

  if (activeType === "api") {
    payload.field = document.getElementById("apiEmailSelectedText").textContent;
    if (payload.field === "Endpunkt") {
      showMessageBox("Fehler: Bitte API-Endpunkt wählen (Name, Email oder Klasse)!");
      return;
    }
    payload.permission = document.getElementById("apiBerechtigungSelectedText").dataset.access || 'read';
    payload.entityId = parseInt(document.getElementById("apiHinzufuegenSelectedText").dataset.entityId);
    if (!payload.entityId) {
      showMessageBox("Fehler: Bitte Ziel-Ressource wählen!");
      return;
    }
  } else if (activeType === "ressource") {
    payload.sourceEntityId = parseInt(document.getElementById("resRessourceSelectedText").dataset.entityId);
    payload.sourceAttribute = document.getElementById("resAttributSelectedText").textContent;
    payload.targetEntityId = parseInt(document.getElementById("resHinzufuegenSelectedText").dataset.entityId);
    if (!payload.sourceEntityId || payload.sourceAttribute === "Attribut der Ressource wählen" || !payload.targetEntityId) {
      showMessageBox("Fehler: Bitte alle Felder auswählen!");
      return;
    }
  } else if (activeType === "eingabe") {
    payload.attributeName = document.getElementById("eingabeAttributName").value.trim();
    if (!payload.attributeName) {
      showMessageBox("Fehler: Attributname darf nicht leer sein!");
      return;
    }
    payload.permission = document.getElementById("eingabeBerechtigungSelectedText").dataset.access || 'read';
    payload.datatype = document.getElementById("eingabeFormatSelectedText").textContent;
    if (payload.datatype === "Formatvorgabe") {
      showMessageBox("Fehler: Bitte Formatvorgabe wählen (Text, Zahl oder Datum)!");
      return;
    }
    const targetText = document.getElementById("eingabeHinzufuegenSelectedText");
    payload.entityId = parseInt(targetText.dataset.entityId);
    if (!payload.entityId) {
      showMessageBox("Fehler: Bitte Ziel-Ressource wählen!");
      return;
    }
    const isPersonRes = targetText.dataset.hasPersons === "true";
    payload.expirationDate = isPersonRes ? (document.getElementById("eingabeZeitlimitDate").value || null) : null;
    payload.isRequired = isPersonRes ? isPflichtfeld : false;
  }

  try {
    const response = await fetch("/api/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      showMessageBox("Attribut erstellt!", "info");
      if (activeType === "eingabe") {
        document.getElementById("eingabeAttributName").value = "";
      }
      await refreshTreeView();
    } else {
      const errData = await response.json().catch(() => null);
      const errMsg = errData?.error || `Server error ${response.status}`;
      console.error("[Attribute] Server error:", response.status, errMsg);
      showMessageBox("Fehler: " + errMsg);
    }
  } catch (err) {
    console.error("[Attribute] Fetch error:", err);
    showMessageBox("Fehler beim Erstellen des Attributs!");
  }
});


// =========================================================================
// Tree View
// =========================================================================

let cachedTreeData = [];

function renderSelectEventHint() {
  const grid = document.querySelector(".section-body-event .ressource-grid");
  const sectionBody = document.getElementById("section-body-event");
  const headlineGrid = document.getElementById("headlineGrid");
  if (!grid || !sectionBody) return;

  grid.innerHTML = "";

  sectionBody.style.setProperty("--tree-cols", 2);
  sectionBody.classList.add("tree-empty-mode");

  let overlay = sectionBody.querySelector(".tree-empty-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "tree-empty-overlay";
    overlay.innerHTML = `<p class="text-bold">Bitte zuerst ein Event auswählen.</p>`;
    sectionBody.appendChild(overlay);
  }

  if (headlineGrid) headlineGrid.querySelectorAll("p:not(.text-bold)").forEach((p) => p.remove());

  scheduleTreeScrollButtonsUpdate();
}

async function refreshTreeView() {
  const eventId = getCurrentEventId();
  if (!eventId) {
    renderSelectEventHint();
    return;
  }
  try {
    const [treeRes, unlinkedRes] = await Promise.all([
      fetch(`/api/resources/${eventId}/tree`).then(r => r.json()),
      fetch(`/api/unlinked-entities?eventId=${eventId}`).then(r => r.json()),
    ]);
    cachedTreeData = treeRes;
    renderTreeView(treeRes, unlinkedRes);

    // Refresh event statistics after tree view changes
    const events = await loadEvent(eventId);
    updateAllEventUI(events);
  } catch (err) {
    console.error("Tree view Fehler:", err);
  }
}

async function addListEntry(entityId, attributes) {
  const eventId = getCurrentEventId();
  if (!eventId || attributes.length === 0) return;

  try {
    const values = {};
    const resp = await fetch('/api/list-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, eventInstanceId: eventId, values }),
    });
    if (!resp.ok) {
      const errData = await resp.json().catch(() => null);
      showMessageBox(errData?.error || "Fehler beim Hinzufügen des Eintrags!");
      return;
    }
    refreshTreeView();
  } catch (err) {
    console.error("Listeneintrag Fehler:", err);
  }
}

async function refreshPlannerStatistics() {
  const eventId = getCurrentEventId();
  if (!eventId) return;
  try {
    const events = await loadEvent(eventId);
    updateAllEventUI(events);
  } catch (err) {
    console.error("Statistik-Refresh Fehler:", err);
  }
}

function startInlineEdit(cell, instance, attr, resource) {
  const p = cell.querySelector('p');
  if (!p || cell.querySelector('input') || cell.querySelector('select')) return;

  // Dependent resource attribute: show a dropdown of reference values
  if (attr.isSingularRessource && attr.ref_entity_type && attr.ref_attribute_name) {
    const eventId = getCurrentEventId();
    const select = document.createElement('select');
    select.className = 'tree-cell-input';
    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '-- wählen --';
    select.appendChild(emptyOpt);
    p.replaceWith(select);
    select.focus();

    fetch(`/api/reference-values/${attr.ref_entity_id}/${encodeURIComponent(attr.ref_attribute_name)}?eventId=${eventId}`)
      .then(r => r.json())
      .then(values => {
        values.forEach(v => {
          const opt = document.createElement('option');
          let displayV = v;
          const dtype = (attr.datatype || '').toUpperCase();
          if (dtype === 'DATE' && v && v.includes('-')) {
            const parts = v.split('-');
            if (parts.length === 3) displayV = `${parts[2]}.${parts[1]}.${parts[0]}`;
          }
          opt.value = v;
          opt.textContent = displayV;
          if (v === (instance[attr.name] || '')) opt.selected = true;
          select.appendChild(opt);
        });
      });

    let saved = false;
    const save = async () => {
      saved = true;
      const newVal = select.value;
      let displayVal = newVal;
      const dtype = (attr.datatype || '').toUpperCase();
      if (dtype === 'DATE' && newVal) {
        const d = new Date(newVal);
        displayVal = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
      }
      const newP = document.createElement('p');
      newP.textContent = displayVal;
      select.replaceWith(newP);
      try {
        const payload = {
          instanceId: instance._id,
          attributeName: attr.name,
          value: newVal,
          entityId: resource.entity_id,
          eventInstanceId: getCurrentEventId(),
          source: attr.source || 'relation',
        };
        if (attr.source === 'relation') {
          payload.relationId = resource.relation_id;
          payload.relInstanceId = instance._rel_instance_id;
        }
        const resp = await fetch('/api/update-instance-value', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          showMessageBox('Fehler beim Speichern!');
          return;
        }
        await refreshPlannerStatistics();
      } catch (err) {
        console.error('Update Fehler:', err);
        showMessageBox('Fehler beim Speichern!');
      }
    };
    select.addEventListener('change', save);
    select.addEventListener('blur', () => {
      setTimeout(() => {
        if (!saved && cell.contains(select)) {
          const newP = document.createElement('p');
          newP.textContent = formatDisplayValue(instance[attr.name], attr.datatype);
          select.replaceWith(newP);
        }
      }, 150);
    });
    return;
  }

  const input = document.createElement('input');
  const dtype = (attr.datatype || '').toUpperCase();
  if (dtype === 'INTEGER') {
    input.type = 'number';
  } else if (dtype === 'DATE') {
    input.type = 'date';
  } else {
    input.type = 'text';
  }
  // For date inputs, convert DD.MM.YYYY display to YYYY-MM-DD value
  if (dtype === 'DATE' && p.textContent) {
    const parts = p.textContent.split('.');
    if (parts.length === 3) input.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
    else input.value = p.textContent;
  } else {
    input.value = p.textContent;
  }
  input.className = 'tree-cell-input';
  p.replaceWith(input);
  input.focus();
  const save = async () => {
    let newVal = input.value;
    // Validate format
    if (dtype === 'INTEGER' && newVal && isNaN(Number(newVal))) {
      showMessageBox('Fehler: Bitte eine gültige Zahl eingeben!');
      const newP = document.createElement('p');
      newP.textContent = instance[attr.name] || '';
      input.replaceWith(newP);
      return;
    }
    // Format date for display
    let displayVal = newVal;
    if (dtype === 'DATE' && newVal) {
      const d = new Date(newVal);
      displayVal = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
    }
    const newP = document.createElement('p');
    newP.textContent = displayVal;
    input.replaceWith(newP);
    try {
      const payload = {
        instanceId: instance._id,
        attributeName: attr.name,
        value: newVal,
        entityId: resource.entity_id,
        eventInstanceId: getCurrentEventId(),
        source: attr.source || 'relation',
      };
      if (attr.source === 'relation') {
        payload.relationId = resource.relation_id;
        payload.relInstanceId = instance._rel_instance_id;
      }
      const resp = await fetch('/api/update-instance-value', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        showMessageBox('Fehler beim Speichern!');
        return;
      }
      await refreshPlannerStatistics();
    } catch (err) {
      console.error('Update Fehler:', err);
      showMessageBox('Fehler beim Speichern!');
    }
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.blur();
  });
}

function formatDisplayValue(val, datatype) {
  if (val === null || val === undefined || val === '') return '';
  const dtype = (datatype || '').toUpperCase();
  if (dtype === 'DATE' && typeof val === 'string' && val.includes('-')) {
    const parts = val.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return String(val);
}

// =========================================================================
// Person Selector — Add persons from t_users to a hasPersons resource
// =========================================================================
let activePersonSelector = null;

async function openPersonSelector(resource, block) {
  // Close any existing selector
  if (activePersonSelector) {
    activePersonSelector.remove();
    if (activePersonSelector._resourceId === resource.entity_id) {
      activePersonSelector = null;
      return;
    }
  }

  const panel = document.createElement('div');
  panel.className = 'person-selector-panel';
  panel._resourceId = resource.entity_id;

  // Class filter row
  const filterRow = document.createElement('div');
  filterRow.className = 'person-selector-filter-row';

  const classSelect = document.createElement('select');
  classSelect.className = 'person-selector-class-select';
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Alle Gruppen';
  classSelect.appendChild(allOpt);

  // Fetch classes
  try {
    const classRes = await fetch('/api/user-classes');
    const classes = await classRes.json();
    const teacherOpt = document.createElement('option');
    teacherOpt.value = 'Teacher';
    teacherOpt.textContent = 'Lehrer';
    classSelect.appendChild(teacherOpt);
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('User classes error:', err);
  }

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name suchen...';
  nameInput.className = 'person-selector-name-input';

  filterRow.appendChild(classSelect);
  filterRow.appendChild(nameInput);
  panel.appendChild(filterRow);

  // User list
  const userList = document.createElement('div');
  userList.className = 'person-selector-user-list';
  panel.appendChild(userList);

  // Action row
  const actionRow = document.createElement('div');
  actionRow.className = 'person-selector-action-row';

  const addSelectedBtn = document.createElement('div');
  addSelectedBtn.className = 'button-dark clickable person-selector-btn';
  addSelectedBtn.innerHTML = '<p>Ausgewählte hinzufügen</p><img src="/static/assets/images/plus.svg" alt="Add">';

  const closeBtn = document.createElement('div');
  closeBtn.className = 'button-light clickable person-selector-btn';
  closeBtn.innerHTML = '<p>Schließen</p>';
  closeBtn.addEventListener('click', () => {
    panel.remove();
    activePersonSelector = null;
  });

  actionRow.appendChild(addSelectedBtn);
  actionRow.appendChild(closeBtn);
  panel.appendChild(actionRow);

  // Insert panel after the header row in the block
  const headerRow = block.querySelector('.tree-resource-header-row');
  if (headerRow && headerRow.nextSibling) {
    block.insertBefore(panel, headerRow.nextSibling);
  } else {
    block.appendChild(panel);
  }
  activePersonSelector = panel;

  // Load users
  async function loadUsers() {
    const filterClass = classSelect.value || null;
    const filterName = nameInput.value.trim() || null;
    const params = new URLSearchParams();
    if (filterClass) params.set('filterClass', filterClass);
    if (filterName) params.set('filterName', filterName);
    try {
      const res = await fetch(`/api/users?${params}`);
      const users = await res.json();
      userList.innerHTML = '';
      if (users.length === 0) {
        userList.innerHTML = '<p class="person-selector-empty">Keine Benutzer gefunden</p>';
        return;
      }
      users.forEach(u => {
        const row = document.createElement('label');
        row.className = 'person-selector-user-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = u.user_id;
        cb.dataset.displayName = u.display_name;
        const info = document.createElement('div');
        info.className = 'person-selector-user-info';
        const classLabel = u.job_title && u.job_title.toLowerCase() !== 'teacher'
          ? u.job_title : (u.job_title === null || u.job_title === undefined ? 'Lehrer' : 'Lehrer');
        info.innerHTML = `<p>${u.display_name}</p><span>${classLabel}</span>`;
        row.appendChild(cb);
        row.appendChild(info);
        userList.appendChild(row);
      });
    } catch (err) {
      console.error('Load users error:', err);
    }
  }

  await loadUsers();

  // Filter events
  classSelect.addEventListener('change', loadUsers);
  let nameTimeout;
  nameInput.addEventListener('input', () => {
    clearTimeout(nameTimeout);
    nameTimeout = setTimeout(loadUsers, 300);
  });

  // Add selected persons
  addSelectedBtn.addEventListener('click', async () => {
    const eventId = getCurrentEventId();
    if (!eventId) return;
    const filterClass = classSelect.value || null;
    const filterName = nameInput.value.trim() || null;
    try {
      const resp = await fetch('/api/add-persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityId: resource.entity_id,
          eventInstanceId: eventId,
          filterClass,
          filterName,
        }),
      });
      if (resp.ok) {
        showMessageBox('Personen hinzugefügt!');
        panel.remove();
        activePersonSelector = null;
        await refreshTreeView();
      } else {
        showMessageBox('Fehler beim Hinzufügen der Personen!');
      }
    } catch (err) {
      console.error('Add persons error:', err);
      showMessageBox('Fehler beim Hinzufügen der Personen!');
    }
  });
}

function renderTreeView(resources, unlinkedEntities = []) {
  const grid = document.querySelector(".section-body-event .ressource-grid");
  const sectionBody = document.getElementById('section-body-event');

  if (sectionBody) {
    sectionBody.classList.remove("tree-empty-mode");
    const overlay = sectionBody.querySelector(".tree-empty-overlay");
    if (overlay) overlay.remove();
  }

  grid.innerHTML = "";

  // Calculate dynamic column count: 1 (resource name) + max attribute count
  let maxAttrCount = 0;
  resources.forEach(r => { if (r.attributes.length > maxAttrCount) maxAttrCount = r.attributes.length; });
  const totalCols = Math.max(maxAttrCount + 1, 2);

  // Update CSS custom property for grid columns
  sectionBody.style.setProperty('--tree-cols', totalCols);

  // Update headline grid: rebuild Ebene labels dynamically
  const headlineGrid = document.getElementById('headlineGrid');
  // Remove old Ebene labels (keep the two text-bold headings)
  headlineGrid.querySelectorAll('p:not(.text-bold)').forEach(p => p.remove());
  for (let i = 0; i < totalCols; i++) {
    const label = document.createElement('p');
    label.textContent = i === 0 ? 'Bezeichnung' : `Ebene ${i}`;
    headlineGrid.appendChild(label);
  }

  resources.forEach((resource) => {
    const attrs = resource.attributes;
    const block = document.createElement("div");
    block.className = "tree-resource-block";

    // Header row (resource name + attribute headers)
    const headerRow = document.createElement("div");
    headerRow.className = "tree-resource-header-row";
    headerRow.style.gridTemplateColumns = `repeat(${totalCols}, 246px)`;

    const nameBtn = document.createElement("div");
    nameBtn.className = "button-dark tree-resource-name";
    if (resource.hasPersons) {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
    } else if (attrs.length > 0) {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
      const plusBtn = document.createElement('img');
      plusBtn.src = '/static/assets/images/plus.svg';
      plusBtn.alt = 'Add';
      plusBtn.className = 'tree-add-entry';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        addListEntry(resource.entity_id, resource.attributes);
      });
      nameBtn.appendChild(plusBtn);
    } else {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
    }
    nameBtn.addEventListener('click', (e) => {
      if (e.target.classList.contains('tree-add-entry')) return;
      e.stopPropagation();
      enterResourceEditMode(resource);
    });
    headerRow.appendChild(nameBtn);

    attrs.forEach((attr) => {
      const header = document.createElement("div");
      header.className = "button-light tree-attr-header";
      let attrIcon;
      if (attr.isInputField) {
        attrIcon = '/static/assets/images/tv_input.svg';
      } else if (attr.isPersonRessource) {
        attrIcon = '/static/assets/images/tv_api.svg';
      } else {
        attrIcon = '/static/assets/images/tv_ressource.svg';
      }
      header.innerHTML = `<p>${attr.name}</p><img src="${attrIcon}" alt="Type">`;
      header.style.cursor = 'pointer';
      header.addEventListener('click', (e) => {
        e.stopPropagation();
        enterAttributeEditMode(attr, resource);
      });
      headerRow.appendChild(header);
    });
    block.appendChild(headerRow);

    // Cardinality count indicator (if FK participant exists)
    if (resource.participantId != null) {
      const cardRow = document.createElement("div");
      cardRow.className = "tree-cardinality-row";
      cardRow.innerHTML = `
        <span class="tree-card-count ${resource.cardMax != null && resource.instances.length >= resource.cardMax ? 'tree-card-count-full' : ''}">${resource.instances.length}${resource.cardMax != null ? '/' + resource.cardMax : ''}</span>
      `;
      block.appendChild(cardRow);
    }

    // Scrollable entries container
    const entriesContainer = document.createElement("div");
    entriesContainer.className = "tree-entries-container";

    resource.instances.forEach((instance) => {
      const entryRow = document.createElement("div");
      entryRow.className = "tree-entry-row";
      entryRow.style.gridTemplateColumns = `repeat(${totalCols}, 246px)`;

      // Delete icon in resource column, aligned right (not for person resources)
      const spacer = document.createElement("div");
      spacer.className = "tree-entry-spacer";
      if (!resource.hasPersons) {
        const deleteIcon = document.createElement("img");
        deleteIcon.src = "/static/assets/images/tv_x_entries.svg";
        deleteIcon.alt = "Delete";
        deleteIcon.className = "tree-entry-delete";
        deleteIcon.addEventListener("click", async (e) => {
          e.stopPropagation();
          try {
            await fetch("/api/list-entry", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instanceId: instance._id,
                relInstanceId: instance._rel_instance_id || null,
                eventInstanceId: getCurrentEventId(),
              }),
            });
            refreshTreeView();
          } catch (err) {
            console.error("Delete entry error:", err);
          }
        });
        spacer.appendChild(deleteIcon);
      }
      entryRow.appendChild(spacer);

      // Values
      attrs.forEach((attr) => {
        const cell = document.createElement("div");
        cell.className = "tree-cell";
        const val = instance[attr.name];
        const displayVal = formatDisplayValue(val, attr.datatype);
        const isRelationAttribute = (attr.source || "relation") === "relation";
        const canInlineEdit = !attr.isSingularRessource && !attr.isPersonRessource && (attr.isInputField || isRelationAttribute);

        if (attr.isSingularRessource && attr.ref_entity_type && attr.ref_attribute_name) {
          cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/chevron.svg" alt="Select" class="tree-cell-icon">`;
          cell.classList.add('tree-cell-editable');
          cell.querySelector('.tree-cell-icon').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (cell.querySelector('.tree-cell-dropdown')) {
              cell.querySelector('.tree-cell-dropdown').remove();
              return;
            }
            try {
              const eventId = getCurrentEventId();
              const res = await fetch(`/api/reference-values/${attr.ref_entity_id}/${encodeURIComponent(attr.ref_attribute_name)}?eventId=${eventId}`);
              const values = await res.json();
              const dd = document.createElement('div');
              dd.className = 'tree-cell-dropdown';
              values.forEach(v => {
                const item = document.createElement('div');
                item.className = 'tree-cell-dropdown-item';
                const dtype = (attr.datatype || '').toUpperCase();
                let label = v;
                if (dtype === 'DATE' && v && v.includes('-')) {
                  const parts = v.split('-');
                  if (parts.length === 3) label = `${parts[2]}.${parts[1]}.${parts[0]}`;
                }
                item.textContent = label;
                item.addEventListener('click', async () => {
                  cell.querySelector('p').textContent = label;
                  dd.remove();
                  const ddPayload = {
                    instanceId: instance._id,
                    attributeName: attr.name,
                    value: v,
                    entityId: resource.entity_id,
                    eventInstanceId: getCurrentEventId(),
                    source: attr.source || 'relation',
                  };
                  if (attr.source === 'relation') {
                    ddPayload.relationId = resource.relation_id;
                    ddPayload.relInstanceId = instance._rel_instance_id;
                  }
                  await fetch('/api/update-instance-value', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ddPayload),
                  });
                });
                dd.appendChild(item);
              });
              cell.style.position = 'relative';
              cell.appendChild(dd);
            } catch (err) {
              console.error('Dropdown Fehler:', err);
            }
          });
        } else if (attr.isSingularRessource) {
          cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/chevron.svg" alt="Select" class="tree-cell-icon">`;
          cell.classList.add('tree-cell-editable');
          cell.querySelector('.tree-cell-icon').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (cell.querySelector('.tree-cell-dropdown')) {
              cell.querySelector('.tree-cell-dropdown').remove();
              return;
            }
            try {
              const refRes = cachedTreeData?.find(r => r.entity_type === attr.name);
              if (!refRes) return;
              const res = await fetch(`/api/entity-instances/${refRes.entity_id}`);
              const entries = await res.json();
              const dd = document.createElement('div');
              dd.className = 'tree-cell-dropdown';
              entries.forEach(entry => {
                const item = document.createElement('div');
                item.className = 'tree-cell-dropdown-item';
                item.textContent = entry.label || entry.name || String(entry.id);
                item.addEventListener('click', async () => {
                  cell.querySelector('p').textContent = item.textContent;
                  dd.remove();
                  const ddPayload = {
                    instanceId: instance._id,
                    attributeName: attr.name,
                    value: item.textContent,
                    entityId: resource.entity_id,
                    eventInstanceId: getCurrentEventId(),
                    source: attr.source || 'relation',
                  };
                  if (attr.source === 'relation') {
                    ddPayload.relationId = resource.relation_id;
                    ddPayload.relInstanceId = instance._rel_instance_id;
                  }
                  await fetch('/api/update-instance-value', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ddPayload),
                  });
                });
                dd.appendChild(item);
              });
              cell.style.position = 'relative';
              cell.appendChild(dd);
            } catch (err) {
              console.error('Dropdown Fehler:', err);
            }
          });
        } else if (canInlineEdit) {
          cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/tv_input.svg" alt="Edit" class="tree-cell-icon">`;
          cell.querySelector('.tree-cell-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineEdit(cell, instance, attr, resource);
          });
        } else if (attr.isPersonRessource) {
          cell.innerHTML = `<p>${displayVal}</p>`;
        } else {
          cell.innerHTML = `<p>${displayVal}</p>`;
        }
        entryRow.appendChild(cell);
      });

      entriesContainer.appendChild(entryRow);
    });

    block.appendChild(entriesContainer);
    grid.appendChild(block);
  });

  requestAnimationFrame(updateTreeScrollButtons);
}


// =========================================================================
// Dynamic Dropdowns
// =========================================================================

async function refreshDropdowns() {
  const eventId = getCurrentEventId();
  if (!eventId) return;

  try {
    const response = await fetch(`/api/entity-types?eventId=${eventId}&detailed=1`);
    const typesDetailed = await response.json();

    // API "Hinzufügen zu" — only person resources
    const apiDd = document.getElementById("apiHinzufuegenDropdown");
    if (apiDd) {
      apiDd.innerHTML = "";
      typesDetailed.filter(t => t.hasPersons).forEach((t) => {
        const item = document.createElement("div");
        item.className = "dropdown-item clickable";
        item.dataset.entityId = t.entity_id;
        item.innerHTML = `<p>${t.name}</p>`;
        apiDd.appendChild(item);
      });
    }

    // Other "Hinzufügen zu" dropdowns — all resource types
    ["resHinzufuegenDropdown", "eingabeHinzufuegenDropdown"].forEach((ddId) => {
      const dd = document.getElementById(ddId);
      if (!dd) return;
      dd.innerHTML = "";
      typesDetailed.forEach((t) => {
        const item = document.createElement("div");
        item.className = "dropdown-item clickable";
        item.dataset.entityId = t.entity_id;
        item.dataset.hasPersons = t.hasPersons ? "true" : "false";
        item.innerHTML = `<p>${t.name}</p>`;
        dd.appendChild(item);
      });
    });

    // Populate "Ressource wählen" dropdown
    const resDropdown = document.getElementById("resRessourceDropdown");
    if (resDropdown) {
      resDropdown.innerHTML = "";
      typesDetailed.forEach((t) => {
        const item = document.createElement("div");
        item.className = "dropdown-item clickable";
        item.dataset.entityId = t.entity_id;
        item.innerHTML = `<p>${t.name}</p>`;
        resDropdown.appendChild(item);
      });
    }
  } catch (err) {
    console.error("Dropdown refresh Fehler:", err);
  }
}

// When a resource is selected in "Ressource wählen", load its attributes
const resRessourceDropdown = document.getElementById("resRessourceDropdown");
resRessourceDropdown.addEventListener("click", async (e) => {
  const item = e.target.closest(".dropdown-item");
  if (!item) return;
  const entityType = item.querySelector("p").textContent;

  const attrDropdown = document.getElementById("resAttributDropdown");
  attrDropdown.innerHTML = "";

  // Use cached tree data to get attributes for the selected resource
  const resource = cachedTreeData.find(r => r.entity_type === entityType);
  if (resource) {
    resource.attributes.forEach((attr) => {
      const attrItem = document.createElement("div");
      attrItem.className = "dropdown-item clickable";
      attrItem.innerHTML = `<p>${attr.name}</p>`;
      attrDropdown.appendChild(attrItem);
    });
  }
});


// =========================================================================
// Edit/Delete Mode for Resources & Attributes
// =========================================================================

let editingResource = null;   // { entity_type, relation_id, hasPersons }
let editingAttribute = null;  // { name, source, entity_type, relation_id, datatype, ... }

function enterResourceEditMode(resource) {
  editingResource = resource;
  editingAttribute = null;

  // Show resource section, hide attribute section
  const resSection = document.querySelector('.event-extended-ressource');
  const attrSection = document.querySelector('.event-extended-attribute');
  resSection.style.display = '';
  attrSection.style.display = 'none';

  // Fill resource form
  const nameInput = document.getElementById('ressourceName');
  nameInput.value = resource.entity_type;

  // Person resources: name is read-only, no person dropdown in edit mode
  const personenDropdown = document.getElementById('personenDropdownBtn');
  const selectedGroupsDiv = document.getElementById('selectedGroups');
  personenDropdown.style.display = 'none';
  selectedGroupsDiv.style.display = 'none';
  if (resource.hasPersons) {
    nameInput.readOnly = true;
    nameInput.style.opacity = '0.6';
  }

  // Show edit buttons, hide create button
  document.getElementById('ressourceCreateButtons').style.display = 'none';
  document.getElementById('ressourceEditButtons').style.display = 'flex';
  // Hide update button for person resources (read-only from t_users)
  document.getElementById('btnUpdateRessource').style.display = resource.hasPersons ? 'none' : '';

  // Show/hide cardinality section
  const cardSection = document.getElementById('ressourceCardinalitySection');
  if (resource.participantId != null) {
    cardSection.style.display = '';
    document.getElementById('ressourceCardMin').value = resource.cardMin ?? 0;
    document.getElementById('ressourceCardMax').value = resource.cardMax != null ? resource.cardMax : '';
  } else {
    cardSection.style.display = 'none';
  }

  // Show cancel button
  document.getElementById('btnCancelRessource').style.display = '';
}

function enterAttributeEditMode(attr, resource) {
  editingAttribute = { ...attr, entity_type: resource.entity_type, entity_id: resource.entity_id, relation_id: resource.relation_id };
  editingResource = null;

  // Show attribute section, hide resource section
  const resSection = document.querySelector('.event-extended-ressource');
  const attrSection = document.querySelector('.event-extended-attribute');
  resSection.style.display = 'none';
  attrSection.style.display = '';

  // Reset attribute type dropdowns
  const attributFieldsApi = document.getElementById('attributFieldsApi');
  const attributFieldsRessource = document.getElementById('attributFieldsRessource');
  const attributFieldsEingabe = document.getElementById('attributFieldsEingabe');
  attributFieldsApi.style.display = 'none';
  attributFieldsRessource.style.display = 'none';
  attributFieldsEingabe.style.display = 'none';

  // Disable attribute type dropdown in edit mode
  document.getElementById('attributDropdownBtn').style.pointerEvents = 'none';
  document.getElementById('attributDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = 'none';

  // Set the attribute type dropdown label
  const accessLabelMap = { 'hidden': 'Versteckt', 'read': 'Lesen', 'write': 'Schreiben' };
  if (attr.isPersonRessource) {
    document.getElementById('attributSelectedText').textContent = 'API-Endpunkt';
    attributFieldsApi.style.display = 'flex';
    document.getElementById('apiEmailSelectedText').textContent = attr.name;
    const apiBer = document.getElementById('apiBerechtigungSelectedText');
    apiBer.textContent = accessLabelMap[attr.access] || 'Berechtigung';
    apiBer.dataset.access = attr.access || 'read';
    document.getElementById('apiHinzufuegenDropdownBtn').style.display = 'none';
  } else if (attr.isSingularRessource) {
    document.getElementById('attributSelectedText').textContent = 'Abhängige Ressource';
    attributFieldsRessource.style.display = 'flex';
    document.getElementById('resRessourceSelectedText').textContent = attr.ref_entity_type || attr.name;
    document.getElementById('resAttributSelectedText').textContent = attr.ref_attribute_name || attr.name;
    document.getElementById('resHinzufuegenSelectedText').textContent = resource.entity_type;
    document.getElementById('resHinzufuegenDropdownBtn').style.display = 'none';
    // Abhängige Ressource: only delete allowed, hide update button
    document.getElementById('btnUpdateAttribut').style.display = 'none';
    // Disable dropdowns - display only
    document.getElementById('resRessourceDropdownBtn').style.pointerEvents = 'none';
    document.getElementById('resRessourceDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = 'none';
    document.getElementById('resAttributDropdownBtn').style.pointerEvents = 'none';
    document.getElementById('resAttributDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = 'none';
  } else {
    document.getElementById('attributSelectedText').textContent = 'Eingabe';
    attributFieldsEingabe.style.display = 'flex';
    document.getElementById('eingabeAttributName').value = attr.name;
    // Map datatype to display
    const dtMap = { 'VARCHAR': 'Text', 'INTEGER': 'Zahl', 'DATE': 'Datum' };
    document.getElementById('eingabeFormatSelectedText').textContent = dtMap[attr.datatype] || attr.datatype;
    const eingBer = document.getElementById('eingabeBerechtigungSelectedText');
    eingBer.textContent = accessLabelMap[attr.access] || 'Berechtigung';
    eingBer.dataset.access = attr.access || 'read';
    // Toggle Schreiben visibility based on resource type
    const writeItem = document.querySelector('#eingabeBerechtigungDropdown .dropdown-item[data-access="write"]');
    if (writeItem) writeItem.style.display = resource.hasPersons ? '' : 'none';
    const eingabeTarget = document.getElementById('eingabeHinzufuegenSelectedText');
    eingabeTarget.dataset.entityId = String(resource.entity_id);
    eingabeTarget.dataset.hasPersons = resource.hasPersons ? 'true' : 'false';
    applyEingabeDependencyState();
    document.getElementById('eingabeHinzufuegenDropdownBtn').style.display = 'none';
    // Formatvorlage is fixed for existing attributes
    const formatBtn = document.getElementById('eingabeFormatDropdownBtn');
    formatBtn.style.pointerEvents = 'none';
    const formatChevron = formatBtn.querySelector('img[alt="Chevron Icon"]');
    if (formatChevron) formatChevron.style.display = 'none';
  }

  // Show edit buttons, hide create button
  document.getElementById('attributCreateButtons').style.display = 'none';
  document.getElementById('attributEditButtons').style.display = 'flex';

  // Show cancel button
  document.getElementById('btnCancelAttribut').style.display = '';
}

function exitEditMode() {
  editingResource = null;
  editingAttribute = null;

  // Reset resource form
  document.getElementById('ressourceName').value = '';
  selectedGroups.clear();
  renderTags();

  // Reset attribute form
  document.getElementById('eingabeAttributName').value = '';
  document.getElementById('attributSelectedText').textContent = 'Attributtyp wählen';
  document.getElementById('attributFieldsApi').style.display = 'none';
  document.getElementById('attributFieldsRessource').style.display = 'none';
  document.getElementById('attributFieldsEingabe').style.display = 'none';

  // Restore hidden "Hinzufügen zu" dropdowns
  document.getElementById('apiHinzufuegenDropdownBtn').style.display = '';
  document.getElementById('resHinzufuegenDropdownBtn').style.display = '';
  document.getElementById('eingabeHinzufuegenDropdownBtn').style.display = '';

  // Reset Berechtigung dropdowns
  const apiBer = document.getElementById('apiBerechtigungSelectedText');
  apiBer.textContent = 'Berechtigung';
  delete apiBer.dataset.access;
  const eingBer = document.getElementById('eingabeBerechtigungSelectedText');
  eingBer.textContent = 'Berechtigung';
  delete eingBer.dataset.access;
  const eingabeTarget = document.getElementById('eingabeHinzufuegenSelectedText');
  eingabeTarget.textContent = 'Hinzufügen zu';
  delete eingabeTarget.dataset.entityId;
  delete eingabeTarget.dataset.hasPersons;
  resetEingabeZeitlimitAndPflichtfeld();
  applyEingabeDependencyState();
  // Restore all Berechtigung options visibility
  document.querySelectorAll('#eingabeBerechtigungDropdown .dropdown-item').forEach(i => i.style.display = '');

  // Restore person dropdown visibility
  document.getElementById('personenDropdownBtn').style.display = '';
  document.getElementById('selectedGroups').style.display = '';

  // Restore resource name editability
  const nameInput = document.getElementById('ressourceName');
  nameInput.readOnly = false;
  nameInput.style.opacity = '';

  // Restore update resource button
  document.getElementById('btnUpdateRessource').style.display = '';

  // Hide cardinality section
  document.getElementById('ressourceCardinalitySection').style.display = 'none';
  document.getElementById('ressourceCardMin').value = 0;
  document.getElementById('ressourceCardMax').value = '';

  // Restore update attribute button (hidden for abhängige Ressource)
  document.getElementById('btnUpdateAttribut').style.display = '';

  // Restore attribute type dropdown
  document.getElementById('attributDropdownBtn').style.pointerEvents = '';
  document.getElementById('attributDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = '';

  // Restore abhängige Ressource dropdowns
  document.getElementById('resRessourceDropdownBtn').style.pointerEvents = '';
  document.getElementById('resRessourceDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = '';
  document.getElementById('resAttributDropdownBtn').style.pointerEvents = '';
  document.getElementById('resAttributDropdownBtn').querySelector('img[alt="Chevron Icon"]').style.display = '';

  // Restore format dropdown interactivity (disabled only while editing existing input attributes)
  const formatBtn = document.getElementById('eingabeFormatDropdownBtn');
  formatBtn.style.pointerEvents = '';
  const formatChevron = formatBtn.querySelector('img[alt="Chevron Icon"]');
  if (formatChevron) formatChevron.style.display = '';

  // Hide cancel buttons
  document.getElementById('btnCancelRessource').style.display = 'none';
  document.getElementById('btnCancelAttribut').style.display = 'none';

  // Show create buttons, hide edit buttons
  document.getElementById('ressourceCreateButtons').style.display = 'flex';
  document.getElementById('ressourceEditButtons').style.display = 'none';
  document.getElementById('attributCreateButtons').style.display = 'flex';
  document.getElementById('attributEditButtons').style.display = 'none';

  // Show both sections
  document.querySelector('.event-extended-ressource').style.display = '';
  document.querySelector('.event-extended-attribute').style.display = '';
}

// --- Cancel Buttons ---
document.getElementById('btnCancelRessource').addEventListener('click', (e) => {
  e.stopPropagation();
  exitEditMode();
});
document.getElementById('btnCancelAttribut').addEventListener('click', (e) => {
  e.stopPropagation();
  exitEditMode();
});

// --- Save Cardinality ---
document.getElementById('btnSaveCardinality').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!editingResource || editingResource.participantId == null) return;
  const minVal = parseInt(document.getElementById('ressourceCardMin').value) || 0;
  const maxRaw = document.getElementById('ressourceCardMax').value.trim();
  const maxVal = maxRaw === '' ? null : parseInt(maxRaw);
  if (maxVal !== null && maxVal < minVal) {
    showMessageBox("Fehler: Max darf nicht kleiner als Min sein!");
    return;
  }
  try {
    const eventId = getCurrentEventId();
    if (!eventId) {
      showMessageBox('Fehler: Kein Event ausgewählt!');
      return;
    }

    const resp = await fetch("/api/cardinality", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: editingResource.participantId, cardMin: minVal, cardMax: maxVal, eventInstanceId: eventId }),
    });
    if (resp.ok) {
      showMessageBox("Kardinalität gespeichert!");
      await refreshTreeView();
    } else {
      showMessageBox("Fehler beim Speichern der Kardinalität!");
    }
  } catch (err) {
    console.error("Cardinality save error:", err);
    showMessageBox("Fehler beim Speichern der Kardinalität!");
  }
});

// --- Update Resource ---
document.getElementById('btnUpdateRessource').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!editingResource) return;

  const newName = document.getElementById('ressourceName').value.trim();
  if (!newName) {
    showMessageBox('Fehler: Ressourcenname darf nicht leer sein!');
    return;
  }

  try {
    const eventId = getCurrentEventId();
    if (!eventId) {
      showMessageBox('Fehler: Kein Event ausgewählt!');
      return;
    }

    if (newName !== editingResource.entity_type) {
      const response = await fetch('/api/resources/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: editingResource.entity_id, newName, eventInstanceId: eventId }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        showMessageBox('Fehler: ' + (err?.error || 'Umbenennung fehlgeschlagen'));
        return;
      }
    }
    showMessageBox(`Ressource '${newName}' aktualisiert!`);
    exitEditMode();
    await refreshTreeView();
    await refreshDropdowns();
  } catch (err) {
    console.error('Update resource error:', err);
    showMessageBox('Fehler beim Aktualisieren der Ressource!');
  }
});

// --- Delete Resource ---
document.getElementById('btnDeleteRessource').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!editingResource) return;

  const eventId = getCurrentEventId();
  if (!eventId) {
    showMessageBox('Fehler: Kein Event ausgewählt!');
    return;
  }

  try {
    const response = await fetch('/api/resources/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId: editingResource.entity_id, eventInstanceId: eventId }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      showMessageBox('Fehler: ' + (err?.error || 'Löschen fehlgeschlagen'));
      return;
    }
    showMessageBox(`Ressource '${editingResource.entity_type}' gelöscht!`, "info");
    exitEditMode();
    await refreshTreeView();
    await refreshDropdowns();
  } catch (err) {
    console.error('Delete resource error:', err);
    showMessageBox('Fehler beim Löschen der Ressource!');
  }
});

// --- Update Attribute ---
document.getElementById('btnUpdateAttribut').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!editingAttribute) return;

  let newName = editingAttribute.name;
  let newAccess = null;

  // For API endpoint attributes, get access from api Berechtigung
  if (editingAttribute.isPersonRessource) {
    newAccess = document.getElementById('apiBerechtigungSelectedText').dataset.access || null;
  }

  // For input attributes, get new name from the form
  if (editingAttribute.isInputField || (!editingAttribute.isPersonRessource && !editingAttribute.isSingularRessource)) {
    newName = document.getElementById('eingabeAttributName').value.trim();
    if (!newName) {
      showMessageBox('Fehler: Attributname darf nicht leer sein!');
      return;
    }
    newAccess = document.getElementById('eingabeBerechtigungSelectedText').dataset.access || null;
  }

  try {
    const eventId = getCurrentEventId();
    if (!eventId) {
      showMessageBox('Fehler: Kein Event ausgewählt!');
      return;
    }

    if (newName !== editingAttribute.name || (newAccess && newAccess !== editingAttribute.access)) {
      const response = await fetch('/api/attributes/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventInstanceId: eventId,
          entityId: editingAttribute.entity_id,
          oldName: editingAttribute.name,
          newName,
          source: editingAttribute.source || 'relation',
          relationId: editingAttribute.relation_id,
          access: newAccess,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        showMessageBox('Fehler: ' + (err?.error || 'Umbenennung fehlgeschlagen'));
        return;
      }
    }
    showMessageBox(`Attribut '${newName}' aktualisiert!`, "info");
    exitEditMode();
    await refreshTreeView();
    await refreshDropdowns();
  } catch (err) {
    console.error('Update attribute error:', err);
    showMessageBox('Fehler beim Aktualisieren des Attributs!');
  }
});

// --- Delete Attribute ---
document.getElementById('btnDeleteAttribut').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!editingAttribute) return;

  try {
    const eventId = getCurrentEventId();
    if (!eventId) {
      showMessageBox('Fehler: Kein Event ausgewählt!');
      return;
    }

    const response = await fetch('/api/attributes/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventInstanceId: eventId,
        entityId: editingAttribute.entity_id,
        attributeName: editingAttribute.name,
        source: editingAttribute.source || 'relation',
        relationId: editingAttribute.relation_id,
      }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => null);
      showMessageBox('Fehler: ' + (err?.error || 'Löschen fehlgeschlagen'));
      return;
    }
    showMessageBox(`Attribut '${editingAttribute.name}' gelöscht!`, "info");
    exitEditMode();
    await refreshTreeView();
    await refreshDropdowns();
  } catch (err) {
    console.error('Delete attribute error:', err);
    showMessageBox('Fehler beim Löschen des Attributs!');
  }
});