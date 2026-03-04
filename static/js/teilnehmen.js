import { loadEvents, updateEventDropdown, updateInteractionStatistics, updateInteractionTree, updateAllEventUI } from "./main.js";

document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();
    updateAllEventUI(events);
    if (events && events.current_event) {
        const stats = events.current_event.statistics;
        updateInteractionTree(stats["required-fields"], stats["required-remaining"]);
    }
});