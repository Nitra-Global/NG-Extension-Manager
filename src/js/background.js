// background.js (Service Worker)
'use strict';

// --- Constants ---
const STORAGE_KEY = 'extensionScheduleRules_v2'; // Must match the key used in rules.js

// --- Helper Functions ---

/**
 * Gets the name of the current day (e.g., "Monday").
 * @returns {string} The name of the current day.
 */
function getCurrentDayName() {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[new Date().getDay()];
}

/**
 * Checks if a specific rule should be active based on the current date and day.
 * @param {object} rule The rule object.
 * @returns {boolean} True if the rule should be active today, false otherwise.
 */
function isRuleActiveToday(rule) {
    // Ensure rule exists and has necessary properties
    if (!rule) return false;

    const now = new Date();
    // Get today's date at midnight for accurate date comparisons
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Check overall active status stored within the rule
    // Default to true if 'active' property is somehow missing (shouldn't happen with v2 rules)
    if (rule.active === false) {
        // console.log(`Rule skipped: Deactivated by user.`); // DEBUG
        return false;
    }

    // 2. Check date range
    try {
        if (rule.startDate) {
            // Compare date parts only (YYYY-MM-DD)
            const startDate = new Date(rule.startDate + 'T00:00:00'); // Use T00:00:00 to avoid timezone issues affecting the date part
            if (today < startDate) {
                 // console.log(`Rule skipped: Start date (${rule.startDate}) is in the future.`); // DEBUG
                 return false;
            }
        }
        if (rule.endDate) {
            const endDate = new Date(rule.endDate + 'T00:00:00');
             if (today > endDate) {
                 // console.log(`Rule skipped: End date (${rule.endDate}) has passed.`); // DEBUG
                 return false;
             }
        }
    } catch(e) {
        console.error("Error parsing rule start/end dates:", rule.startDate, rule.endDate, e);
        // Decide how to handle parse errors - skip the rule for safety?
        return false;
    }


    // 3. Check days of the week
    if (rule.days && rule.days.length > 0) {
        const currentDay = getCurrentDayName();
        if (!rule.days.includes(currentDay)) {
            // console.log(`Rule skipped: Not scheduled for ${currentDay}.`); // DEBUG
            return false;
        }
    }

    // If all checks pass, the rule is active for today
    // console.log("Rule should be active today."); // DEBUG
    return true;
}

/**
 * Loads all rules from storage. Used by alarm handler and setup functions.
 * @returns {Promise<Array>} A promise that resolves with the array of rules, or an empty array on error/no rules.
 */
async function loadRulesFromStorage() {
    try {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (chrome.runtime.lastError) {
            console.error("Error loading rules in background:", chrome.runtime.lastError);
            return [];
        }
        if (data && data[STORAGE_KEY]) {
            const rules = JSON.parse(data[STORAGE_KEY]);
            if (Array.isArray(rules)) {
                // Ensure default 'active' state if missing (for safety, though v2 should have it)
                 rules.forEach(rule => {
                    if (rule.active === undefined) {
                        rule.active = true;
                    }
                });
                return rules;
            }
        }
        return []; // Return empty array if no rules or invalid format
    } catch (e) {
        console.error("Error parsing rules in background:", e);
        return []; // Return empty array on parsing error
    }
}


/**
 * Schedules all necessary alarms based on the rules loaded from storage.
 * This should be run on install, update, and browser startup.
 */
async function scheduleAllAlarmsBackground() {
    console.log("Attempting to schedule all alarms...");
    const rules = await loadRulesFromStorage();
    if (!rules || rules.length === 0) {
        console.log("No rules found to schedule.");
        // Clear any potentially lingering alarms if no rules exist
        chrome.alarms.clearAll(() => {
             if (chrome.runtime.lastError) console.error("Error clearing alarms:", chrome.runtime.lastError);
             else console.log("Cleared all alarms as no rules were found.");
        });
        return;
    }

    // Clear existing alarms before rescheduling to prevent duplicates/stale alarms
    chrome.alarms.clearAll(async () => {
        if (chrome.runtime.lastError) {
            console.error("Error clearing alarms before rescheduling:", chrome.runtime.lastError);
            // Proceed with scheduling anyway, might lead to duplicates but better than nothing
        } else {
            console.log("Cleared existing alarms.");
        }

        let scheduledCount = 0;
        for (const [index, rule] of rules.entries()) {
             const isActive = rule.active !== undefined ? rule.active : true;

             // Only schedule alarms for rules marked as active
             if (isActive) {
                try {
                    const [hours, minutes] = rule.time.split(':').map(Number);

                    // Use the same alarm name format as in rules.js for consistency
                    const alarmName = `rule-${index}-${rule.extensionId}-${rule.action}`;

                    const now = new Date();
                    let nextRun = new Date();
                    nextRun.setHours(hours, minutes, 0, 0);

                    // If time is already past for today, schedule for the next day
                    if (nextRun <= now) {
                        nextRun.setDate(nextRun.getDate() + 1);
                    }
                     // console.log(`Scheduling alarm: ${alarmName} for ${nextRun}`); // DEBUG

                    // Create a repeating daily alarm. The listener will check day/date constraints.
                    await chrome.alarms.create(alarmName, {
                        when: nextRun.getTime(),
                        periodInMinutes: 24 * 60 // Repeat daily
                    });
                    scheduledCount++;

                } catch (e) {
                    console.error(`Error scheduling alarm for rule index ${index}:`, rule, e);
                }
            }
        }
         console.log(`Scheduled ${scheduledCount} alarms.`);
    });
}


// --- Alarm Listener ---

chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log("Background: Alarm fired:", alarm.name);

    if (alarm.name.startsWith('rule-')) {
        // Load the rules fresh each time an alarm fires to ensure we have the latest data
        const rules = await loadRulesFromStorage();
        if (!rules) {
            console.error("Could not load rules to handle alarm:", alarm.name);
            return;
        }

        try {
            const parts = alarm.name.split('-');
            if (parts.length < 4) {
                console.error("Malformed alarm name:", alarm.name);
                return;
            }
            const ruleIndex = parseInt(parts[1], 10);
            const extensionId = parts[2];
            // Action might contain hyphens if extensionId did, reconstruct carefully if needed, but assume simple case for now
            const action = parts[3]; // 'enable' or 'disable'

            if (isNaN(ruleIndex) || ruleIndex < 0 || ruleIndex >= rules.length) {
                console.warn(`Alarm fired for invalid or out-of-bounds rule index: ${ruleIndex}. Alarm:`, alarm.name);
                 // Clear this specific invalid alarm
                chrome.alarms.clear(alarm.name, (wasCleared) => {
                    if(chrome.runtime.lastError) console.error("Error clearing invalid alarm:", alarm.name, chrome.runtime.lastError);
                    else if (wasCleared) console.log("Cleared invalid alarm:", alarm.name);
                });
                return;
            }

            const rule = rules[ruleIndex];

             // *** CRUCIAL CHECK ***
             // Verify if the rule should actually run *today* based on its settings
            if (isRuleActiveToday(rule)) {
                console.log(`Executing action '${action}' for extension ${extensionId} based on rule index ${ruleIndex}:`, rule);

                // Perform the action using chrome.management
                chrome.management.setEnabled(extensionId, action === 'enable', () => {
                    if (chrome.runtime.lastError) {
                        // Handle potential errors, e.g., extension was uninstalled
                        console.error(`Error executing rule action for ${extensionId}:`, chrome.runtime.lastError.message);
                        // Maybe disable the rule in storage if the extension is gone? Requires careful implementation.
                    } else {
                        console.log(`Action '${action}' completed successfully for ${extensionId}.`);
                    }
                });
            } else {
                 console.log(`Rule index ${ruleIndex} (${rule.name || extensionId}) skipped today (Not active or outside date/day constraints).`);
            }

        } catch (e) {
            console.error("Error processing alarm:", alarm.name, e);
        }
    }
});


// --- Lifecycle Event Listeners ---

// Schedule alarms when the extension is first installed or updated
chrome.runtime.onInstalled.addListener((details) => {
    console.log("Extension installed or updated:", details.reason);
    scheduleAllAlarmsBackground();
});

// Schedule alarms when the browser starts (if the extension is enabled)
// Note: onStartup might not fire reliably in all scenarios, onInstalled is more robust for updates.
// It's good to have both as a fallback.
chrome.runtime.onStartup.addListener(() => {
    console.log("Browser startup detected.");
    // Optional: Add a small delay before scheduling to ensure everything is ready
    // setTimeout(scheduleAllAlarmsBackground, 1000);
    scheduleAllAlarmsBackground(); // Schedule immediately
});

console.log("Background service worker started.");
// Initial scheduling check in case onInstalled/onStartup didn't cover it (e.g., enabling extension manually)
// Do this carefully to avoid excessive rescheduling. Maybe check if alarms already exist first?
// For simplicity, let's rely on onInstalled and onStartup for now.
// scheduleAllAlarmsBackground();
