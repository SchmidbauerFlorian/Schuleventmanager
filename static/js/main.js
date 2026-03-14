const eventsDropdown = document.getElementById("dropdownEventsBtn");
const profileBtn = document.getElementById("btnProfile");
const btnSEM = document.getElementById("btnSEM");
const logoutBtn = document.getElementById("btnLogout");
const toggleModeBtn = document.getElementById("toggleMode");
const messageBox = document.getElementById("message-box");
const messageBoxText = document.getElementById("message-box-text");
const messageBoxIcon = messageBox ? messageBox.querySelector("img") : null;
const overlayContainer = document.getElementById("overlayContainer");

let overlayHiddenByScroll = false;
let overlayHiddenByExpandedTree = false;

function applyOverlayVisibility() {
    if (!overlayContainer) return;
    const shouldHide = overlayHiddenByScroll || overlayHiddenByExpandedTree;
    overlayContainer.style.opacity = shouldHide ? "0" : "1";
    overlayContainer.style.transform = shouldHide ? "translateY(20px)" : "translateY(0px)";
    overlayContainer.style.pointerEvents = shouldHide ? "none" : "auto";
}

export function setOverlayHiddenByExpandedTree(hidden) {
    overlayHiddenByExpandedTree = Boolean(hidden);
    applyOverlayVisibility();
}

const MESSAGE_ICON_WARNING = "/static/assets/images/alert-triangle.svg";
const MESSAGE_ICON_INFO = "/static/assets/images/alert-square.svg";

export function showMessageBox(message, type = "warning") {
    if (!messageBox || !messageBoxText) return;

    const isInfo = type === "info";
    if (messageBoxIcon) {
        messageBoxIcon.src = isInfo ? MESSAGE_ICON_INFO : MESSAGE_ICON_WARNING;
        messageBoxIcon.alt = isInfo ? "Info Icon" : "Warning Icon";
    }

    messageBoxText.textContent = message;
    messageBox.style.animation = "none";
    void messageBox.offsetWidth; // reflow erzwingen
    messageBox.style.animation = "messageBoxShow 5s";
}

toggleModeBtn.addEventListener("click", () => {
  const currentMode = toggleModeBtn.dataset.currentMode;
        if (currentMode === 'teilnehmen') {
            window.location.href = '/planen';
        }
        else {
            window.location.href = '/teilnehmen';
        }
});
eventsDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  openDropdown();
});
profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openOverlay("profile");
});
btnSEM.addEventListener("click", (e) => {
    e.stopPropagation();
    openOverlay("SEM");
});
logoutBtn.addEventListener("click", () => {
  window.location.href = `/logout`;
});

document.getElementById("overlayContainer").addEventListener("click", (e) => {
    e.stopPropagation();
});
document.querySelectorAll('.btnCloseOverlay').forEach(el => {
  el.addEventListener('click', () => {
    closeOverlay();
  });
});
document.addEventListener('click', () => {
    closeOverlay();
    closeDropdown();
});
window.addEventListener('scroll', () => {
  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 200;

    overlayHiddenByScroll = nearBottom;
    applyOverlayVisibility();
});

applyOverlayVisibility();





export async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const events = await response.json();
        return events;
    } catch (error) {
        console.error('Fehler beim Laden der Events:', error);
        alert('Events konnten nicht geladen werden');
    }
}

export async function loadEvent(eventId) {
    try {
        const response = await fetch(`/api/events/${eventId}`);
        const events = await response.json();
        return events;
    } catch (error) {
        console.error('Fehler beim Laden des Events:', error);
        alert('Event konnte nicht geladen werden');
    }
}

export function updateAllEventUI(events) {
    const fallbackStats = {
        "ressources": 0,
        "people": 0,
        "lists": 0,
        "informations": 0,
        "input-fields": 0,
        "input-remaining": 0,
        "required-fields": 0,
        "required-remaining": 0,
    };
    const ev = events?.current_event || {
        id: null,
        name: "Alle Events",
        created_at: "",
        duration: "",
        messages: [],
        statistics: fallbackStats,
    };
    const allEvents = (Array.isArray(events?.all_events) && events.all_events.length > 0)
        ? events.all_events
        : [{ id: null, name: "Alle Events" }];

    window._currentEventId = ev.id;
    updateEventDetails(ev.name, ev.created_at, ev.duration, ev.id);
    updateEventDropdown(allEvents);
    updateMessageHistory(ev.messages || []);
    updateRessourceStatistics(ev.statistics || fallbackStats);
    updateInteractionStatistics(ev.statistics || fallbackStats);
    updateInteractionTree(
        (ev.statistics || fallbackStats)["required-fields"],
        (ev.statistics || fallbackStats)["required-remaining"]
    );
    // Update tree view section header
    const treeTitle = document.getElementById("treeViewEventName");
    if (treeTitle) treeTitle.textContent = ev.name || "Event wählen";
}
export function openDropdown() {
    const dropdownEventsContainer = document.getElementById("dropdownEvents");
    if(dropdownEventsContainer.style.display === "flex"){
        dropdownEventsContainer.style.display = "none";
    } else {
        dropdownEventsContainer.style.display = "flex";
    }
};
export function closeDropdown() {
    const dropdownEventsContainer = document.getElementById("dropdownEvents");
    dropdownEventsContainer.style.display = "none";
}
export function openOverlay(overlayId) {
  const overlayContainer = document.getElementById("overlayContainer");
  const overlays = overlayContainer.querySelectorAll(".overlay");

  let overlay;
  if (overlayId === "create-event") {
    overlay = document.getElementById("overlayCreateEvent");
    overlayContainer.style.height = "356px";
  } else if (overlayId === "profile") {
    overlay = document.getElementById("overlayProfile");
    overlayContainer.style.height = "536px";
  } else if (overlayId === "delete-event") {
    const eventName = document.getElementById("eventName").innerHTML;
    const deleteEventText = document.getElementById("deleteEventText");

    deleteEventText.innerHTML = `Zum löschen '${eventName}' in das Feld eintippen und bestätigen`;

    overlay = document.getElementById("overlayDeleteEvent");
    overlayContainer.style.height = "356px";
  } else if (overlayId === "SEM") {
    overlay = document.getElementById("overlaySEM");
    overlayContainer.style.height = "536px";
  }

  const wasVisible = overlay.style.display === "flex";

  overlays.forEach(overlay => {
      overlay.style.display = "none";
      overlay.classList.remove('shake');
  });

  overlay.style.display = "flex";
  overlay.style.opacity = "1";
  overlayContainer.style.width = "672px";

  if (wasVisible) {
    void overlay.offsetWidth;
    overlay.classList.add('shake');
  }
}
export function closeOverlay() {
  const overlayContainer = document.getElementById("overlayContainer");
  const overlays = overlayContainer.querySelectorAll(".overlay");

  overlayContainer.style.width = "160px";
  overlayContainer.style.height = "160px";

  overlays.forEach(overlay => {
    overlay.style.opacity = "0";
    overlay.style.display = "none";
  });
}





export function updateEventDetails(name, createdAt, duration, eventId = null) {
  const dropdownSelectedItem = document.getElementById("dropdownSelectedItem");
  const eventNameElem        = document.getElementById("eventName");
  const eventCreatedAtElem   = document.getElementById("eventCreatedAt");
  const eventDurationElem    = document.getElementById("eventDuration");
    const deleteEventBtn       = document.getElementById("btnDeleteEvent");

    const isAllEventsSelected = eventId === null || eventId === undefined;
    const createdAtSection = eventCreatedAtElem ? eventCreatedAtElem.parentElement : null;
    const deleteEventSection = deleteEventBtn ? deleteEventBtn.parentElement : null;

  if (dropdownSelectedItem) dropdownSelectedItem.textContent = name;
  if (eventNameElem)        eventNameElem.textContent = name;
  if (eventCreatedAtElem)   eventCreatedAtElem.textContent = createdAt;
  if (eventDurationElem)    eventDurationElem.textContent = duration;

    // In plan view, these controls should only be visible for a concrete event selection.
    if (createdAtSection) createdAtSection.style.display = isAllEventsSelected ? "none" : "";
    if (deleteEventSection) deleteEventSection.style.display = isAllEventsSelected ? "none" : "";
}

export function updateEventDropdown(events){
    const dropdownEventsContainer = document.getElementById("dropdownEvents");
    if (!dropdownEventsContainer) return;
    const normalizedEvents = (Array.isArray(events) && events.length > 0)
        ? events
        : [{ id: null, name: "Alle Events" }];
    dropdownEventsContainer.innerHTML = "";

    normalizedEvents.forEach(event => {
        const eventItem = document.createElement("div");
        const eventText = document.createElement("p");
        const eventIcon = document.createElement("img");

        eventIcon.src = "/static/assets/images/ticket.svg";
        eventIcon.alt = "Ticket Icon";
        eventItem.classList.add("dropdown-item");
        eventItem.id = "event-" + event["id"];
        eventText.textContent = event["name"];

        eventItem.appendChild(eventIcon);
        eventItem.appendChild(eventText);

        eventItem.addEventListener("click", async (e) => {
            e.stopPropagation();
            closeDropdown();

            // Participant view has its own filtered event data source.
            const currentMode = toggleModeBtn?.dataset?.currentMode;
            if (currentMode === "teilnehmen") {
                window.dispatchEvent(new CustomEvent("participantEventSelected", {
                    detail: {
                        eventId: event["id"],
                    },
                }));
                return;
            }

            const events = event["id"] === null
                ? await loadEvents()
                : await loadEvent(event["id"]);
            updateAllEventUI(events);
            // Dispatch custom event so planen.js can refresh tree/dropdowns
            window.dispatchEvent(new CustomEvent("eventSelected"));
        });

        dropdownEventsContainer.appendChild(eventItem);
    });
};
export function updateMessageHistory(messages){
    const messageHistoryContainer = document.getElementById("message-history");
    if (!messageHistoryContainer) return;
    messageHistoryContainer.innerHTML = "";
    const messageTitleElem = document.createElement("h2");
    messageTitleElem.textContent = "Verlauf";
    messageHistoryContainer.appendChild(messageTitleElem);

    messages.forEach(message => {
        const messageItem = document.createElement("div");
        messageItem.classList.add("verlauf-item");

        const messageTitle = document.createElement("p");
        messageTitle.classList.add("text-bold");
        messageTitle.textContent = message["title"];

        const messageDetails = document.createElement("p");
        messageDetails.textContent = `${message["type"]} - ${message["date"]}`;

        messageItem.appendChild(messageTitle);
        messageItem.appendChild(messageDetails);

        messageHistoryContainer.appendChild(messageItem);
    });
};
export function updateRessourceStatistics(stats){
    const statsRessources = document.getElementById("stats-ressources");
    if (!statsRessources) return;
    const statsPeople = document.getElementById("stats-people");
    const statsLists = document.getElementById("stats-lists");
    const statsInformations = document.getElementById("stats-informations");

    const ressources = Number(stats["ressources"]) || 0;
    const people = Number(stats["people"]) || 0;
    const lists = Number(stats["lists"]) || 0;
    const informations = Number(stats["informations"]) || 0;

    statsRessources.textContent = ressources;
    statsPeople.textContent = people;
    statsLists.textContent = lists;
    statsInformations.textContent = informations;
    
    const statsUsersGraph = document.getElementById("stats-users-graph");
    const statsListsGraph = document.getElementById("stats-lists-graph");
    const statsInformationsGraph = document.getElementById("stats-informations-graph");

    if (ressources <= 0) {
        statsInformationsGraph.style.height = "0px";
        statsListsGraph.style.height = "0px";
        statsListsGraph.style.paddingBottom = "calc(0px + var(--space))";
        statsUsersGraph.style.paddingBottom = "calc(0px + var(--space))";
        return;
    }

    var informationsRatioInPixel = (informations / ressources) * 312;
    var listsRatioInPixel = (lists / ressources) * 312;
    var usersRatioInPixel = (people / ressources) * 312;

    if(informationsRatioInPixel < 36 && listsRatioInPixel < 36){
        informationsRatioInPixel = 36;
        listsRatioInPixel = 36;
        usersRatioInPixel = 240;
    }
    else if(listsRatioInPixel < 36 && usersRatioInPixel < 36){
        listsRatioInPixel = 36;
        usersRatioInPixel = 36;
        informationsRatioInPixel = 240;
    }
    else if(usersRatioInPixel < 36 && informationsRatioInPixel < 36){
        usersRatioInPixel = 36;
        informationsRatioInPixel = 36;
        listsRatioInPixel = 240;
    }
    else if(informationsRatioInPixel < 36){
        informationsRatioInPixel = 36;
        var newTotal = stats["ressources"] - stats["informations"];
        listsRatioInPixel = (stats["lists"] / newTotal) * 276;
        usersRatioInPixel = (stats["people"] / newTotal) * 276;
        if(listsRatioInPixel < 36){
            listsRatioInPixel = 36;
            usersRatioInPixel = 240;
        }
        else if(usersRatioInPixel < 36){
            usersRatioInPixel = 36;
            listsRatioInPixel = 240;
        }
    }
    else if(listsRatioInPixel < 36){
        listsRatioInPixel = 36;
        var newTotal = stats["ressources"] - stats["lists"];
        informationsRatioInPixel = (stats["informations"] / newTotal) * 276;
        usersRatioInPixel = (stats["people"] / newTotal) * 276;
        if(informationsRatioInPixel < 36){
            informationsRatioInPixel = 36;
            usersRatioInPixel = 240;
        }
        else if(usersRatioInPixel < 36){
            usersRatioInPixel = 36;
            informationsRatioInPixel = 240;
        }
    }
    else if(usersRatioInPixel < 36){
        usersRatioInPixel = 36;
        var newTotal = stats["ressources"] - stats["people"];
        informationsRatioInPixel = (stats["informations"] / newTotal) * 276;
        listsRatioInPixel = (stats["lists"] / newTotal) * 276;
        if(informationsRatioInPixel < 36){
            informationsRatioInPixel = 36;
            listsRatioInPixel = 240;
        }
        else if(listsRatioInPixel < 36){
            listsRatioInPixel = 36;
            informationsRatioInPixel = 240;
        }
    }

    statsInformationsGraph.style.height = `${informationsRatioInPixel}px`;
    statsListsGraph.style.height = `${informationsRatioInPixel + listsRatioInPixel}px`;
    statsListsGraph.style.paddingBottom = `calc(${informationsRatioInPixel}px + var(--space))`;
    statsUsersGraph.style.paddingBottom = `calc(${informationsRatioInPixel + listsRatioInPixel}px + var(--space))`;
}
export function updateInteractionStatistics(stats){
    const inputRequiredRatio = document.getElementById("input-required-ratio");
    if (!inputRequiredRatio) return;
    const inpreqInputFields = document.getElementById("inpreq-input-fields");
    const inpreqRequiredFields = document.getElementById("inpreq-required-fields");
    const inputRemainingRatio = document.getElementById("input-remaining-ratio");
    const inpremInputFields = document.getElementById("inprem-input-fields");
    const inpremInputRemaining = document.getElementById("inprem-input-remaining");
    const requiredRemainingRatio = document.getElementById("required-remaining-ratio");
    const reqremRequiredFields = document.getElementById("reqrem-required-fields");
    const reqremRequiredRemaining = document.getElementById("reqrem-required-remaining");

    const inputFields = Number(stats["input-fields"]) || 0;
    const requiredFields = Number(stats["required-fields"]) || 0;
    const inputRemaining = Number(stats["input-remaining"]) || 0;
    const requiredRemaining = Number(stats["required-remaining"]) || 0;

    const requiredInputRatio = inputFields > 0 ? ((requiredFields / inputFields) * 100).toFixed(0) : "0";
    const inputRemainingRatioPct = inputFields > 0 ? ((inputRemaining / inputFields) * 100).toFixed(0) : "0";
    const requiredRemainingRatioPct = requiredFields > 0 ? ((requiredRemaining / requiredFields) * 100).toFixed(0) : "0";

    inputRequiredRatio.textContent = `${requiredInputRatio}%`;
    inpreqInputFields.textContent = inputFields;
    inpreqRequiredFields.textContent = requiredFields;
    inputRemainingRatio.textContent = `${inputRemainingRatioPct}%`;
    inpremInputFields.textContent = inputFields;
    inpremInputRemaining.textContent = inputRemaining;
    requiredRemainingRatio.textContent = `${requiredRemainingRatioPct}%`;
    reqremRequiredFields.textContent = requiredFields;
    reqremRequiredRemaining.textContent = requiredRemaining;
    
    const statsInpreqGraph = document.getElementById("stats-inpreq-graph");
    const statsInpremGraph = document.getElementById("stats-inprem-graph");
    const statsReqremGraph = document.getElementById("stats-reqrem-graph");

    var inpreqRatioInPixel = inputFields > 0 ? (requiredFields / inputFields) * 160 : 0;
    var inpremRatioInPixel = inputFields > 0 ? (inputRemaining / inputFields) * 160 : 0;
    var reqremRatioInPixel = requiredFields > 0 ? (requiredRemaining / requiredFields) * 160 : 0;

    if(inpreqRatioInPixel < 36){inpreqRatioInPixel = 36;}
    if(inpremRatioInPixel < 36){inpremRatioInPixel = 36;}
    if(reqremRatioInPixel < 36){reqremRatioInPixel = 36;}

    statsInpreqGraph.style.height = `${inpreqRatioInPixel}px`;
    statsInpremGraph.style.height = `${inpremRatioInPixel}px`;
    statsReqremGraph.style.height = `${reqremRatioInPixel}px`;
};
export function updateInteractionTree(requiredFields, requiredRemaining){
    const interactionTreeImg = document.getElementById("interactionTreeImg");
    const interactionTreeText = document.getElementById("reqrem-interaction-tree");
    if (!interactionTreeImg || !interactionTreeText) return;

    const totalRequired = Number(requiredFields) || 0;
    const remainingRequired = Number(requiredRemaining) || 0;
    const completed = totalRequired - remainingRequired;
    const requiredCompletedRatio = totalRequired > 0 ? (completed / totalRequired) : 0;

    const minHeight = 144;
    const maxHeight = 432;

    const height = minHeight + (requiredCompletedRatio * (maxHeight - minHeight));
    interactionTreeImg.style.height = `${height}px`;
    interactionTreeText.textContent = remainingRequired;
};