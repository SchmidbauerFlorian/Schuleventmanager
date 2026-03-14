import { showMessageBox, updateEventDropdown, updateInteractionStatistics, updateInteractionTree } from "./main.js";

// =========================================================================
// Scroll buttons for tree view
// =========================================================================
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

if (scrollContainer) {
    scrollContainer.addEventListener("scroll", updateTreeScrollButtons);
    window.addEventListener("resize", updateTreeScrollButtons);
}

btnScrollLeft.addEventListener("click", (e) => {
  e.stopPropagation();
    if (!scrollContainer || scrollContainer.scrollLeft <= 1) return;
  scrollContainer.scrollBy({ left: -250, behavior: "smooth" });
});
btnScrollRight.addEventListener("click", (e) => {
  e.stopPropagation();
    if (!scrollContainer) return;
    const maxScrollLeft = Math.max(scrollContainer.scrollWidth - scrollContainer.clientWidth, 0);
    if (scrollContainer.scrollLeft >= maxScrollLeft - 1) return;
  scrollContainer.scrollBy({ left: 250, behavior: "smooth" });
});

updateTreeScrollButtons();

// =========================================================================
// Initialisation
// =========================================================================
document.addEventListener('DOMContentLoaded', async function () {
    const events = await loadMyEvents();
    if (!events || !events.current_event) {
        window._currentEventId = null;
        renderNoParticipantEventsHint();
        return;
    }
    await applyParticipantEventState(events);
});

// Participant-specific dropdown selection handler from main.js
window.addEventListener("participantEventSelected", async (e) => {
    const selectedEventId = e.detail?.eventId;
    const events = await loadMyEvents(selectedEventId);
    if (!events || !events.current_event) {
        window._currentEventId = null;
        renderNoParticipantEventsHint();
        return;
    }
    await applyParticipantEventState(events);
});

// =========================================================================
// Data loading
// =========================================================================
async function loadMyEvents(selectedEventId = undefined) {
    try {
        let url = '/api/my-events';
        if (selectedEventId === null) {
            url += '?eventId=all';
        } else if (selectedEventId !== undefined) {
            url += `?eventId=${encodeURIComponent(String(selectedEventId))}`;
        }
        const res = await fetch(url);
        return await res.json();
    } catch (err) {
        console.error('Fehler beim Laden der eigenen Events:', err);
        return null;
    }
}

async function applyParticipantEventState(events) {
    window._currentEventId = events.current_event.id;
    updateTreeViewHeading(events.current_event.name);
    updateEventDropdown(events.all_events);

    const dropdownSelectedItem = document.getElementById("dropdownSelectedItem");
    if (dropdownSelectedItem) {
        dropdownSelectedItem.textContent = events.current_event.name || "Alle Events";
    }

    if (events.current_event.statistics) {
        updateInteractionStatistics(events.current_event.statistics);
        updateInteractionTree(
            events.current_event.statistics["required-fields"],
            events.current_event.statistics["required-remaining"]
        );
    }
    await refreshParticipantTree(events.current_event.id);
}

async function refreshParticipantTree(eventId) {
    if (!eventId) {
        renderSelectEventHint();
        return;
    }
    try {
        const tree = await fetch(`/api/resources/${eventId}/participant-tree`).then(r => r.json());
        renderParticipantTree(tree);
    } catch (err) {
        console.error('Participant tree Fehler:', err);
    }
}

// =========================================================================
// Tree view rendering (participant view)
// =========================================================================
let cachedParticipantTree = [];

function renderTreeHint(message) {
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
        sectionBody.appendChild(overlay);
    }
    overlay.innerHTML = `<p class="text-bold">${message}</p>`;

    if (headlineGrid) headlineGrid.querySelectorAll("p:not(.text-bold)").forEach((p) => p.remove());

    requestAnimationFrame(updateTreeScrollButtons);
}

function renderNoParticipantEventsHint() {
    updateTreeViewHeading("Event wählen");
    renderTreeHint("Du bist noch keinem Event zugeordnet.");
}

function renderSelectEventHint() {
    renderTreeHint("Bitte zuerst ein Event auswählen.");
}

function updateTreeViewHeading(name) {
    const el = document.getElementById("treeViewEventName");
    if (el) el.textContent = name || "Event wählen";
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

function renderParticipantTree(resources) {
    cachedParticipantTree = resources;
    const grid = document.querySelector(".section-body-event .ressource-grid");
    const sectionBody = document.getElementById('section-body-event');

    if (sectionBody) {
        sectionBody.classList.remove("tree-empty-mode");
        const overlay = sectionBody.querySelector(".tree-empty-overlay");
        if (overlay) overlay.remove();
    }

    grid.innerHTML = "";

    let maxAttrCount = 0;
    resources.forEach(r => { if (r.attributes.length > maxAttrCount) maxAttrCount = r.attributes.length; });
    const totalCols = Math.max(maxAttrCount + 1, 2);

    sectionBody.style.setProperty('--tree-cols', totalCols);

    // Rebuild headline labels
    const headlineGrid = document.getElementById('headlineGrid');
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

        // Header row
        const headerRow = document.createElement("div");
        headerRow.className = "tree-resource-header-row";
        headerRow.style.gridTemplateColumns = `repeat(${totalCols}, 246px)`;

        const nameBtn = document.createElement("div");
        nameBtn.className = "button-dark tree-resource-name";
        nameBtn.innerHTML = `<p>${resource.entity_type}</p>`;
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
            // Show pencil icon if user can edit this attribute
            if (attr.userCanEdit) {
                attrIcon = '/static/assets/images/tv_input.svg';
            }
            header.innerHTML = `<p>${attr.name}</p><img src="${attrIcon}" alt="Type">`;
            headerRow.appendChild(header);
        });
        block.appendChild(headerRow);

        // Entry rows
        const entriesContainer = document.createElement("div");
        entriesContainer.className = "tree-entries-container";

        resource.instances.forEach((instance) => {
            const entryRow = document.createElement("div");
            entryRow.className = "tree-entry-row";
            entryRow.style.gridTemplateColumns = `repeat(${totalCols}, 246px)`;

            // Spacer in resource column (no delete icon for participant view)
            const spacer = document.createElement("div");
            spacer.className = "tree-entry-spacer";
            entryRow.appendChild(spacer);

            attrs.forEach((attr) => {
                const cell = document.createElement("div");
                cell.className = "tree-cell";
                const val = instance[attr.name];
                const displayVal = formatDisplayValue(val, attr.datatype);

                if (attr.userCanEdit) {
                    // Editable cell: show edit icon, click to inline edit
                    cell.innerHTML = `<p>${displayVal}</p><img src="/static/assets/images/tv_input.svg" alt="Edit" class="tree-cell-icon">`;
                    cell.classList.add('tree-cell-editable');
                    cell.querySelector('.tree-cell-icon').addEventListener('click', (e) => {
                        e.stopPropagation();
                        startParticipantInlineEdit(cell, instance, attr, resource);
                    });
                } else {
                    // Read-only cell
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
// Inline editing for write-access attributes (own row in person resource)
// =========================================================================
function startParticipantInlineEdit(cell, instance, attr, resource) {
    const p = cell.querySelector('p');
    if (!p || cell.querySelector('input') || cell.querySelector('select')) return;

    const input = document.createElement('input');
    const dtype = (attr.datatype || '').toUpperCase();
    if (dtype === 'INTEGER') {
        input.type = 'number';
    } else if (dtype === 'DATE') {
        input.type = 'date';
        // Convert DD.MM.YYYY to YYYY-MM-DD for the input value
        if (p.textContent) {
            const parts = p.textContent.split('.');
            if (parts.length === 3) input.value = `${parts[2]}-${parts[1]}-${parts[0]}`;
            else input.value = p.textContent;
        }
    } else {
        input.type = 'text';
        input.value = p.textContent;
    }
    if (dtype !== 'DATE') input.value = p.textContent;
    input.className = 'tree-cell-input';
    p.replaceWith(input);
    input.focus();

    const save = async () => {
        let newVal = input.value;
        if (dtype === 'INTEGER' && newVal && isNaN(Number(newVal))) {
            showMessageBox('Fehler: Bitte eine gültige Zahl eingeben!');
            const newP = document.createElement('p');
            newP.textContent = instance[attr.name] || '';
            input.replaceWith(newP);
            return;
        }
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
            }
        } catch (err) {
            console.error('Update Fehler:', err);
            showMessageBox('Fehler beim Speichern!');
        }
    };
    input.addEventListener('blur', save);
    input.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') input.blur();
        if (ev.key === 'Escape') {
            const newP = document.createElement('p');
            newP.textContent = formatDisplayValue(instance[attr.name], attr.datatype);
            input.replaceWith(newP);
        }
    });
}