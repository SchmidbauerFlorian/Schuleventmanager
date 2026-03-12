import { showMessageBox, updateEventDropdown, updateInteractionStatistics, updateInteractionTree } from "./main.js";

// =========================================================================
// Scroll buttons for tree view
// =========================================================================
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

// =========================================================================
// Initialisation
// =========================================================================
document.addEventListener('DOMContentLoaded', async function () {
    const events = await loadMyEvents();
    if (!events || !events.current_event) return;

    window._currentEventId = events.current_event.id;
    updateTreeViewHeading(events.current_event.name);
    updateEventDropdown(events.all_events);
    if (events.current_event.statistics) {
        updateInteractionStatistics(events.current_event.statistics);
        updateInteractionTree(
            events.current_event.statistics["required-fields"],
            events.current_event.statistics["required-remaining"]
        );
    }
    if (events.current_event.id) {
        await refreshParticipantTree(events.current_event.id);
    }
});

// Refresh tree when an event is selected from the dropdown
window.addEventListener("eventSelected", async () => {
    const eventId = window._currentEventId;
    if (!eventId) return;
    await refreshParticipantTree(eventId);
});

// =========================================================================
// Data loading
// =========================================================================
async function loadMyEvents() {
    try {
        const res = await fetch('/api/my-events');
        return await res.json();
    } catch (err) {
        console.error('Fehler beim Laden der eigenen Events:', err);
        return null;
    }
}

async function refreshParticipantTree(eventId) {
    const grid = document.querySelector(".section-body-event .ressource-grid");
    if (!eventId) { grid.innerHTML = ""; return; }
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
    grid.innerHTML = "";

    let maxAttrCount = 0;
    resources.forEach(r => { if (r.attributes.length > maxAttrCount) maxAttrCount = r.attributes.length; });
    const totalCols = Math.max(maxAttrCount + 1, 2);

    const sectionBody = document.getElementById('section-body-event');
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