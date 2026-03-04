import { loadEvents, updateEventDropdown, updateInteractionStatistics, updateInteractionTree, updateAllEventUI } from "./main.js";

document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();
    updateAllEventUI(events);
});