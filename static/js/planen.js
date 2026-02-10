import { loadEvents, openOverlay, closeOverlay, updateEventDetails, updateEventDropdown, updateMessageHistory, updateRessourceStatistics, updateInteractionStatistics } from "./main.js";

const createEventBtn = document.getElementById("btnCreateEvent");
const createEventSubmitBtn = document.getElementById("btnCreateEventSubmit");

createEventBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  openOverlay("create-event");
});
createEventSubmitBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  closeOverlay();
  await createEvent();
});
document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();

    updateEventDetails(events["current_event"]["name"], events["current_event"]["created_at"], events["current_event"]["duration"]);
    updateEventDropdown(events["all_events"]);
    updateMessageHistory(events["current_event"]["messages"]);
    updateRessourceStatistics(events["current_event"]["statistics"]);
    updateInteractionStatistics(events["current_event"]["statistics"]);
});

async function createEvent() {
  const eventName = document.getElementById("inputEventName").value;

  await fetch("/api/events", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ eventName })
  });

  const events = await loadEvents();

  updateEventDetails(events["current_event"]["name"], events["current_event"]["created_at"], events["current_event"]["duration"]);
  updateEventDropdown(events["all_events"]);
  updateMessageHistory(events["current_event"]["messages"]);
  updateRessourceStatistics(events["current_event"]["statistics"]);
  updateInteractionStatistics(events["current_event"]["statistics"]);
}