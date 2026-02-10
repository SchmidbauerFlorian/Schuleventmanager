import { loadEvents, updateEventDropdown, updateInteractionStatistics } from "./main.js";

document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();

    updateEventDropdown(events["all_events"]);
    updateInteractionStatistics(events["current_event"]["statistics"]);
});