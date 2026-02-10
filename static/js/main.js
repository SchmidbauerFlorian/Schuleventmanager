const eventsDropdown = document.getElementById("dropdownEventsBtn");
const profileBtn = document.getElementById("btnProfile");
const logoutBtn = document.getElementById("btnLogout");
const toggleModeBtn = document.getElementById("toggleMode");





toggleModeBtn.addEventListener("click", () => {
  const currentMode = toggleModeBtn.dataset.currentMode;
        if (currentMode === 'teilnehmen') {
            window.location.href = '/planen';
        }
        else {
            window.location.href = '/teilnehmen';
        }
});
document.querySelectorAll('.btnCloseOverlay').forEach(el => {
  el.addEventListener('click', () => {
    closeOverlay();
  });
});
eventsDropdown.addEventListener("click", (e) => {
  e.stopPropagation();
  openDropdown();
});
profileBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openOverlay("profile");
});
logoutBtn.addEventListener("click", () => {
  window.location.href = `/logout`;
});
document.addEventListener('click', () => {
    closeOverlay();
    closeDropdown();
});
document.getElementById("overlayContainer").addEventListener("click", (e) => {
    e.stopPropagation();
});
window.addEventListener('scroll', () => {
  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.documentElement.scrollHeight - 200;

  const overlay = document.getElementById("overlayContainer");

  if (nearBottom){
    overlay.style.opacity = "0";
    overlay.style.transform = "translateY(20px)";
    overlay.style.pointerEvents = "none";
  } 
  else if (overlay.style.opacity === "0"){
    overlay.style.opacity = "1";
    overlay.style.transform = "translateY(0px)";
    overlay.style.pointerEvents = "auto";
  } 
});





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





export function updateEventDetails(name, createdAt, duration) {
  const dropdownSelectedItem = document.getElementById("dropdownSelectedItem");

  const eventNameElem = document.getElementById("eventName");
  const eventCreatedAtElem = document.getElementById("eventCreatedAt");
  const eventDurationElem = document.getElementById("eventDuration");

  dropdownSelectedItem.textContent = name;
  
  eventNameElem.textContent = name;
  eventCreatedAtElem.textContent = createdAt;
  eventDurationElem.textContent = duration;
}

export function updateEventDropdown(events){
    const dropdownEventsContainer = document.getElementById("dropdownEvents");
    dropdownEventsContainer.innerHTML = "";

    events.forEach(event => {
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

        dropdownEventsContainer.appendChild(eventItem);
    });
};
export function updateMessageHistory(messages){
    const messageHistoryContainer = document.getElementById("message-history");
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
    const statsPeople = document.getElementById("stats-people");
    const statsLists = document.getElementById("stats-lists");
    const statsInformations = document.getElementById("stats-informations");

    statsRessources.textContent = stats["ressources"];
    statsPeople.textContent = stats["people"];
    statsLists.textContent = stats["lists"];
    statsInformations.textContent = stats["informations"];
    
    const statsUsersGraph = document.getElementById("stats-users-graph");
    const statsListsGraph = document.getElementById("stats-lists-graph");
    const statsInformationsGraph = document.getElementById("stats-informations-graph");

    var informationsRatioInPixel = (stats["informations"] / stats["ressources"]) * 312;
    var listsRatioInPixel = (stats["lists"] / stats["ressources"]) * 312;
    var usersRatioInPixel = (stats["people"] / stats["ressources"]) * 312;

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
    const inpreqInputFields = document.getElementById("inpreq-input-fields");
    const inpreqRequiredFields = document.getElementById("inpreq-required-fields");
    const inputRemainingRatio = document.getElementById("input-remaining-ratio");
    const inpremInputFields = document.getElementById("inprem-input-fields");
    const inpremInputRemaining = document.getElementById("inprem-input-remaining");
    const requiredRemainingRatio = document.getElementById("required-remaining-ratio");
    const reqremRequiredFields = document.getElementById("reqrem-required-fields");
    const reqremRequiredRemaining = document.getElementById("reqrem-required-remaining");

    inputRequiredRatio.textContent = `${((stats["required-fields"] / stats["input-fields"]) * 100).toFixed(0)}%`;
    inpreqInputFields.textContent = stats["input-fields"];
    inpreqRequiredFields.textContent = stats["required-fields"];
    inputRemainingRatio.textContent = `${((stats["input-remaining"] / stats["input-fields"]) * 100).toFixed(0)}%`;
    inpremInputFields.textContent = stats["input-fields"];
    inpremInputRemaining.textContent = stats["input-remaining"];
    requiredRemainingRatio.textContent = `${((stats["required-remaining"] / stats["required-fields"]) * 100).toFixed(0)}%`;
    reqremRequiredFields.textContent = stats["required-fields"];
    reqremRequiredRemaining.textContent = stats["required-remaining"];
    
    const statsInpreqGraph = document.getElementById("stats-inpreq-graph");
    const statsInpremGraph = document.getElementById("stats-inprem-graph");
    const statsReqremGraph = document.getElementById("stats-reqrem-graph");

    var inpreqRatioInPixel = (stats["required-fields"] / stats["input-fields"]) * 160;
    var inpremRatioInPixel = (stats["input-remaining"] / stats["input-fields"]) * 160;
    var reqremRatioInPixel = (stats["required-remaining"] / stats["required-fields"]) * 160;

    if(inpreqRatioInPixel < 36){inpreqRatioInPixel = 36;}
    if(inpremRatioInPixel < 36){inpremRatioInPixel = 36;}
    if(reqremRatioInPixel < 36){reqremRatioInPixel = 36;}

    statsInpreqGraph.style.height = `${inpreqRatioInPixel}px`;
    statsInpremGraph.style.height = `${inpremRatioInPixel}px`;
    statsReqremGraph.style.height = `${reqremRatioInPixel}px`;
};
