import { loadEvents, updateEventDropdown, updateInteractionStatistics, updateInteractionTree } from "./main.js";

document.addEventListener('DOMContentLoaded', async function() {
    const events = await loadEvents();

    updateEventDropdown(events["all_events"]);
    updateInteractionStatistics(events["current_event"]["statistics"]);
    updateInteractionTree(events["current_event"]["statistics"]["required-fields"], events["current_event"]["statistics"]["required-remaining"]);
});