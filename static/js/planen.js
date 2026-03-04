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