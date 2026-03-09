import { showMessageBox, loadEvents, loadEvent, openOverlay, closeOverlay, updateEventDetails, updateEventDropdown, updateMessageHistory, updateRessourceStatistics, updateInteractionStatistics, updateAllEventUI } from "./main.js";

const createEventBtn = document.getElementById("btnCreateEvent");
const createEventSubmitBtn = document.getElementById("btnCreateEventSubmit");
const deleteEventBtn = document.getElementById("btnDeleteEvent");
const deleteEventSubmitBtn = document.getElementById("btnDeleteEventSubmit");
const expandTreeViewBtn = document.getElementById("btnExpandTreeView");

// --- Horizontal Scroll Buttons ---
const scrollContainer = document.getElementById("section-body-event");
const btnScrollLeft = document.getElementById("btnScrollLeft");
const btnScrollRight = document.getElementById("btnScrollRight");

btnScrollLeft.addEventListener("click", (e) => {
  e.stopPropagation();
  scrollContainer.scrollBy({ left: -250, behavior: "smooth" });
});
btnScrollRight.addEventListener("click", (e) => {
  e.stopPropagation();
  scrollContainer.scrollBy({ left: 250, behavior: "smooth" });
});

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

  const response = await fetch("/api/events", {
    method: "DELETE",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ eventName })
  });

  const events = await response.json();
  updateAllEventUI(events);
  await refreshTreeView();
  await refreshDropdowns();
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
  await refreshTreeView();
  await refreshDropdowns();
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
  const groups = Array.from(selectedGroups);

  try {
    const response = await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resourceName, groups, eventInstanceId: eventId }),
    });

    if (response.ok) {
      showMessageBox(`Ressource '${resourceName}' erstellt!`);
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
    payload.permission = document.getElementById("apiBerechtigungSelectedText").textContent;
    payload.entityType = document.getElementById("apiHinzufuegenSelectedText").textContent;
    if (payload.entityType === "Hinzufügen zu") {
      showMessageBox("Fehler: Bitte Ziel-Ressource wählen!");
      return;
    }
  } else if (activeType === "ressource") {
    payload.sourceEntity = document.getElementById("resRessourceSelectedText").textContent;
    payload.sourceAttribute = document.getElementById("resAttributSelectedText").textContent;
    payload.targetEntity = document.getElementById("resHinzufuegenSelectedText").textContent;
    if (payload.sourceEntity === "Ressource wählen" || payload.targetEntity === "Hinzufügen zu" || payload.sourceAttribute === "Attribut der Ressource wählen") {
      showMessageBox("Fehler: Bitte alle Felder auswählen!");
      return;
    }
  } else if (activeType === "eingabe") {
    payload.attributeName = document.getElementById("eingabeAttributName").value.trim();
    if (!payload.attributeName) {
      showMessageBox("Fehler: Attributname darf nicht leer sein!");
      return;
    }
    payload.permission = document.getElementById("eingabeBerechtigungSelectedText").textContent;
    payload.datatype = document.getElementById("eingabeFormatSelectedText").textContent;
    if (payload.datatype === "Formatvorgabe") {
      showMessageBox("Fehler: Bitte Formatvorgabe wählen (Text, Zahl oder Datum)!");
      return;
    }
    payload.expirationDate = document.getElementById("eingabeZeitlimitDate").value || null;
    payload.isRequired = isPflichtfeld;
    payload.entityType = document.getElementById("eingabeHinzufuegenSelectedText").textContent;
    if (payload.entityType === "Hinzufügen zu") {
      showMessageBox("Fehler: Bitte Ziel-Ressource wählen!");
      return;
    }
  }

  try {
    const response = await fetch("/api/attributes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      showMessageBox("Attribut erstellt!");
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

async function refreshTreeView() {
  const eventId = getCurrentEventId();
  const grid = document.querySelector(".section-body-event .ressource-grid");
  if (!eventId) {
    grid.innerHTML = "";
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

async function addListEntry(entityType, attributes) {
  const eventId = getCurrentEventId();
  if (!eventId || attributes.length === 0) return;

  try {
    const values = {};
    attributes.filter(a => a.source === 'entity').forEach(attr => { values[attr.name] = ''; });
    await fetch('/api/list-entry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType, eventInstanceId: eventId, values }),
    });
    refreshTreeView();
  } catch (err) {
    console.error("Listeneintrag Fehler:", err);
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

    fetch(`/api/reference-values/${encodeURIComponent(attr.ref_entity_type)}/${encodeURIComponent(attr.ref_attribute_name)}?eventId=${eventId}`)
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
          entityType: resource.entity_type,
          source: attr.source || 'entity',
        };
        if (attr.source === 'relation') {
          payload.relationId = resource.relation_id;
          payload.relInstanceId = instance._rel_instance_id;
        }
        await fetch('/api/update-instance-value', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('Update Fehler:', err);
      }
    };
    select.addEventListener('change', save);
    select.addEventListener('blur', () => {
      setTimeout(() => {
        if (!saved && cell.contains(select)) {
          const newP = document.createElement('p');
          newP.textContent = instance[attr.name] || '';
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
        entityType: resource.entity_type,
        source: attr.source || 'entity',
      };
      if (attr.source === 'relation') {
        payload.relationId = resource.relation_id;
        payload.relInstanceId = instance._rel_instance_id;
      }
      await fetch('/api/update-instance-value', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Update Fehler:', err);
    }
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') input.blur();
  });
}

function renderTreeView(resources, unlinkedEntities = []) {
  const grid = document.querySelector(".section-body-event .ressource-grid");
  grid.innerHTML = "";

  // Calculate dynamic column count: 1 (resource name) + max attribute count
  let maxAttrCount = 0;
  resources.forEach(r => { if (r.attributes.length > maxAttrCount) maxAttrCount = r.attributes.length; });
  const totalCols = Math.max(maxAttrCount + 1, 2);

  // Update CSS custom property for grid columns
  const sectionBody = document.getElementById('section-body-event');
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

  let rowIndex = 1;
  resources.forEach((resource) => {
    const attrs = resource.attributes;

    // Resource name button (column 1)
    const nameBtn = document.createElement("div");
    nameBtn.className = "button-dark tree-resource-name";
    nameBtn.style.gridColumn = "1";
    nameBtn.style.gridRow = `${rowIndex}`;
    if (resource.hasPersons) {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p><img src="/static/assets/images/users.svg" alt="Users">`;
    } else if (attrs.length > 0) {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
      const plusBtn = document.createElement('img');
      plusBtn.src = '/static/assets/images/plus.svg';
      plusBtn.alt = 'Add';
      plusBtn.className = 'tree-add-entry';
      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        addListEntry(resource.entity_type, resource.attributes);
      });
      nameBtn.appendChild(plusBtn);
    } else {
      nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
    }
    grid.appendChild(nameBtn);

    // Attribute headers (columns 2+)
    attrs.forEach((attr, idx) => {
      const header = document.createElement("div");
      header.className = "button-light tree-attr-header";
      header.style.gridColumn = `${idx + 2}`;
      header.style.gridRow = `${rowIndex}`;
      let attrIcon;
      if (attr.isInputField) {
        attrIcon = '/static/assets/images/tv_input.svg';
      } else if (attr.isPersonRessource) {
        attrIcon = '/static/assets/images/tv_api.svg';
      } else {
        attrIcon = '/static/assets/images/tv_ressource.svg';
      }
      header.innerHTML = `<p>${attr.name}</p><img src="${attrIcon}" alt="Type">`;
      grid.appendChild(header);
    });
    rowIndex++;

    // Instance rows
    resource.instances.forEach((instance) => {
      // Empty spacer for resource column
      const spacer = document.createElement("div");
      spacer.style.gridColumn = "1";
      spacer.style.gridRow = `${rowIndex}`;
      grid.appendChild(spacer);

      // Values
      attrs.forEach((attr, idx) => {
        const cell = document.createElement("div");
        cell.className = "tree-cell";
        cell.style.gridColumn = `${idx + 2}`;
        cell.style.gridRow = `${rowIndex}`;
        const val = instance[attr.name];
        const displayVal = val !== null && val !== undefined ? val : '';

        if (attr.isSingularRessource && attr.ref_entity_type && attr.ref_attribute_name) {
          // Dependent resource with reference → dropdown of source values
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
              const res = await fetch(`/api/reference-values/${encodeURIComponent(attr.ref_entity_type)}/${encodeURIComponent(attr.ref_attribute_name)}?eventId=${eventId}`);
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
                    entityType: resource.entity_type,
                    source: attr.source || 'entity',
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
          // Dependent resource → dropdown
          cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/chevron.svg" alt="Select" class="tree-cell-icon">`;
          cell.classList.add('tree-cell-editable');
          cell.querySelector('.tree-cell-icon').addEventListener('click', async (e) => {
            e.stopPropagation();
            // Check if dropdown already open
            if (cell.querySelector('.tree-cell-dropdown')) {
              cell.querySelector('.tree-cell-dropdown').remove();
              return;
            }
            // Fetch entries from linked resource
            try {
              const res = await fetch(`/api/entity-instances/${encodeURIComponent(attr.name)}`);
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
                    entityType: resource.entity_type,
                    source: attr.source || 'entity',
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
        } else {
          // Eingabe / API attribute → editable text
          cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/tv_input.svg" alt="Edit" class="tree-cell-icon">`;
          cell.querySelector('.tree-cell-icon').addEventListener('click', (e) => {
            e.stopPropagation();
            startInlineEdit(cell, instance, attr, resource);
          });
        }
        grid.appendChild(cell);
      });
      rowIndex++;
    });

    // Spacer row between resources
    rowIndex++;
  });
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