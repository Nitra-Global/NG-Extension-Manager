/**
 * @file background.js
 * This service worker handles the core logic for the automation rules and
 * now includes cloud sync functionality.
 */

// --- Constants for storage keys ---
const RULES_STORAGE_KEY = 'rules';
const GROUPS_STORAGE_KEY = 'extensionManagerGroups_v4';
const PROFILES_STORAGE_KEY = 'extensionManagerProfiles_v2';
const AUTO_SYNC_SETTING_KEY = 'cloudSyncEnabled';
const SYNC_ON_STARTUP_KEY = 'cloudSyncOnStartup';
const SYNC_ON_CHANGE_KEY = 'cloudSyncOnChange';
const SYNC_INTERVAL_KEY = 'cloudSyncInterval';
const LAST_AUTO_SYNC_TIMESTAMP_KEY = 'lastAutoSyncTimestamp';
const SYNC_LOG_KEY = 'syncLog';
const DEVICE_NAME_OPTION_KEY = 'deviceNameOption';
const CUSTOM_DEVICE_NAME_KEY = 'customDeviceName';
const SYNC_QUOTA_BYTES = 102400; // 100 KB total sync quota
const SYNC_ALARM_NAME = 'cloud_sync_alarm';

// PERFORMANCE: Cache for URL-based rules to reduce storage reads on navigation.
let urlRulesCache = [];
let syncDebounceTimeout = null;
const SYNC_DEBOUNCE_DELAY_MS = 1000; // 1 second debounce delay

/**
 * Updates all Chrome alarms based on currently stored rules and refreshes the URL rules cache.
 * This is the central function for keeping the extension's state in sync.
 */
const updateAlarmsAndCache = async () => {
    try {
        const { rules } = await chrome.storage.local.get(RULES_STORAGE_KEY);
        if (!rules) {
            urlRulesCache = [];
            return;
        }

        // PERFORMANCE: Update the URL rules cache.
        urlRulesCache = rules.filter(rule => rule.enabled && rule.trigger.type === 'url');
        console.log(`URL rules cache updated. ${urlRulesCache.length} rules active.`);

        await chrome.alarms.clearAll();
        console.log("All modcore EM alarms cleared. Re-scheduling...");

        const timeRules = rules.filter(rule => rule.enabled && rule.trigger.type === 'time');

        for (const rule of timeRules) {
            const [hour, minute] = rule.trigger.time.split(':').map(Number);
            const now = new Date();
            let nextTrigger = new Date();

            nextTrigger.setHours(hour, minute, 0, 0);

            if (nextTrigger < now) {
                nextTrigger.setDate(nextTrigger.getDate() + 1);
            }
            
            let foundNextDay = false;
            for(let i = 0; i < 7; i++) { // Check next 7 days to find the earliest next scheduled day
                if(rule.trigger.days.includes(nextTrigger.getDay())) {
                    foundNextDay = true;
                    break;
                }
                nextTrigger.setDate(nextTrigger.getDate() + 1);
            }

            if(foundNextDay) {
                chrome.alarms.create(`rule_${rule.id}`, {
                    when: nextTrigger.getTime(),
                    periodInMinutes: 7 * 24 * 60 // Repeat weekly
                });
                console.log(`Alarm scheduled for rule "${rule.name}" at: ${nextTrigger.toString()}`);
            } else {
                console.log(`Rule "${rule.name}" has no future days selected. Skipping alarm.`);
            }
        }
    } catch (error) {
        console.error("Error updating alarms and cache:", error);
    }
};

/**
 * Executes the action (enable/disable extension, apply profile, toggle/enable/disable group) for a given rule.
 * @param {object} rule The rule object to execute.
 */
const executeRuleAction = async (rule) => {
    console.log(`Executing rule: "${rule.name}" (ID: ${rule.id}, Type: ${rule.targetType}, Action: ${rule.action})`);

    try {
        if (rule.targetType === 'extension') {
            const shouldEnable = rule.action === 'enable';
            for (const extId of rule.targetIds) {
                try {
                    await chrome.management.setEnabled(extId, shouldEnable);
                    console.log(`  Extension ${extId} set to enabled: ${shouldEnable}`);
                } catch (error) {
                    console.warn(`  Error toggling extension ${extId} for rule "${rule.name}" (it may have been uninstalled or permission denied):`, error.message);
                }
            }
        } else if (rule.targetType === 'profile') {
            const profileId = rule.targetIds[0];
            if (!profileId) {
                console.warn(`  Rule "${rule.name}" (profile type) has no target profile ID.`);
                return;
            }

            const profilesData = await chrome.storage.local.get(PROFILES_STORAGE_KEY);
            const allProfiles = profilesData[PROFILES_STORAGE_KEY] || {};
            const targetProfile = allProfiles[profileId];

            if (!targetProfile || !targetProfile.extensionStates) {
                console.warn(`  Target profile "${profileId}" for rule "${rule.name}" not found or has no extension states.`);
                return;
            }

            console.log(`  Applying profile "${targetProfile.name}" for rule "${rule.name}".`);
            for (const extId in targetProfile.extensionStates) {
                const shouldBeEnabled = targetProfile.extensionStates[extId];
                try {
                    const extInfo = await chrome.management.get(extId);
                    if (extInfo && extInfo.mayDisable) {
                        await chrome.management.setEnabled(extId, shouldBeEnabled);
                        console.log(`    Extension ${extId} set to enabled: ${shouldBeEnabled} (via profile)`);
                    } else {
                        console.log(`    Skipping non-user-controllable extension ${extId} from profile.`);
                    }
                } catch (error) {
                    console.warn(`    Error applying profile to extension ${extId} for rule "${rule.name}" (it may have been uninstalled or permission denied):`, error.message);
                }
            }
        } else if (rule.targetType === 'group') {
            const groupsData = await chrome.storage.local.get(GROUPS_STORAGE_KEY);
            const allGroups = groupsData[GROUPS_STORAGE_KEY] || {};

            for (const groupName of rule.targetIds) {
                const targetGroup = allGroups[groupName];
                if (!targetGroup || !Array.isArray(targetGroup.members)) {
                    console.warn(`  Target group "${groupName}" for rule "${rule.name}" not found or has no members.`);
                    continue;
                }

                console.log(`  Processing group "${groupName}" for rule "${rule.name}" with action "${rule.action}".`);
                const groupMembers = targetGroup.members;
                for (const extId of groupMembers) {
                    let shouldEnable;
                    if (rule.action === 'enable') {
                        shouldEnable = true;
                    } else if (rule.action === 'disable') {
                        shouldEnable = false;
                    } else if (rule.action === 'toggle') {
                        try {
                            const extInfo = await chrome.management.get(extId);
                            if (extInfo && extInfo.mayDisable) {
                                shouldEnable = !extInfo.enabled;
                                console.log(`    Toggling extension ${extId} from ${extInfo.enabled} to ${shouldEnable}`);
                            } else {
                                console.log(`    Skipping non-user-controllable extension ${extId} from group toggle.`);
                                continue;
                            }
                        } catch (error) {
                            console.warn(`    Could not get current state for extension ${extId}. Skipping toggle.`, error.message);
                            continue;
                        }
                    } else {
                        console.warn(`  Unknown action "${rule.action}" for group rule "${rule.name}". Skipping.`);
                        continue;
                    }

                    try {
                        await chrome.management.setEnabled(extId, shouldEnable);
                        console.log(`    Extension ${extId} in group "${groupName}" set to enabled: ${shouldEnable}`);
                    } catch (error) {
                        console.warn(`    Error toggling extension ${extId} in group "${groupName}" for rule "${rule.name}" (it may have been uninstalled or permission denied):`, error.message);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Fatal error during rule execution for "${rule.name}":`, error);
    }
};

/**
 * Determines the device name based on user settings.
 * @returns {Promise<string>} The formatted device name.
 */
async function getDeviceName() {
    const { [DEVICE_NAME_OPTION_KEY]: option, [CUSTOM_DEVICE_NAME_KEY]: customName } = await chrome.storage.local.get([DEVICE_NAME_OPTION_KEY, CUSTOM_DEVICE_NAME_KEY]);
    
    if (option === 'custom' && customName) {
        return customName;
    } else if (option === 'browser') {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Chrome')) {
            const os = userAgent.includes('Win') ? 'Windows' : userAgent.includes('Mac') ? 'macOS' : userAgent.includes('Linux') ? 'Linux' : 'Unknown OS';
            return `Chrome on ${os}`;
        }
        return 'Unknown Browser';
    } else { // 'userAgent' or default
        return navigator.userAgent.substring(0, 100); // Truncate for log
    }
}

/**
 * Adds an entry to the sync log in local storage.
 * @param {string} message The log message.
 * @param {string} type The type of log ('info', 'success', 'error').
 */
async function addLogEntry(message, type = 'info') {
    const { [SYNC_LOG_KEY]: currentLog } = await chrome.storage.local.get(SYNC_LOG_KEY);
    const newLog = Array.isArray(currentLog) ? currentLog : [];
    
    const deviceName = await getDeviceName();

    const newEntry = {
        timestamp: Date.now(),
        message: `${message} (Device: ${deviceName})`,
        type: type
    };

    newLog.push(newEntry);
    
    // Trim the log to a maximum size
    const MAX_LOG_ENTRIES = 50;
    if (newLog.length > MAX_LOG_ENTRIES) {
        newLog.splice(0, newLog.length - MAX_LOG_ENTRIES);
    }
    
    try {
        await chrome.storage.local.set({ [SYNC_LOG_KEY]: newLog });
    } catch (error) {
        console.error('Error saving log entry to local storage:', error);
    }
}

/**
 * @function syncLocalDataToCloud
 * Copies ALL data from chrome.storage.local to chrome.storage.sync.
 */
const syncLocalDataToCloud = async (isAutomatic = true) => {
    // Only perform automatic sync if the feature is enabled
    if (isAutomatic) {
        const { [AUTO_SYNC_SETTING_KEY]: isAutoSyncEnabled } = await chrome.storage.local.get(AUTO_SYNC_SETTING_KEY);
        if (!isAutoSyncEnabled) {
            console.log('Automatic cloud sync is disabled. Skipping sync.');
            return;
        }
    }

    console.log('Starting sync of all local data to the cloud...');
    let logMessage = isAutomatic ? 'Automatic sync to cloud started.' : 'Manual sync to cloud started.';
    let logType = 'info';

    try {
        // Get all data from local storage
        const localData = await chrome.storage.local.get(null);

        // Exclude UI-specific settings from sync storage to avoid syncing device-specific configurations
        const dataToSync = { ...localData };
        delete dataToSync[AUTO_SYNC_SETTING_KEY];
        delete dataToSync[SYNC_ON_STARTUP_KEY];
        delete dataToSync[SYNC_ON_CHANGE_KEY];
        delete dataToSync[SYNC_INTERVAL_KEY];
        delete dataToSync[LAST_AUTO_SYNC_TIMESTAMP_KEY];
        delete dataToSync[DEVICE_NAME_OPTION_KEY];
        delete dataToSync[CUSTOM_DEVICE_NAME_KEY];
        
        // The log is synced as part of the data.
        
        // Calculate the total size of the data to be synced
        let totalBytes = 0;
        for (const key in dataToSync) {
            const valueString = JSON.stringify(dataToSync[key]);
            totalBytes += valueString.length + key.length;
        }
        
        // Check if the data exceeds the sync quota
        if (totalBytes > SYNC_QUOTA_BYTES) {
            const errorMessage = `Sync aborted: Data size (${totalBytes} bytes) exceeds sync quota (${SYNC_QUOTA_BYTES} bytes). Please clear some data.`;
            console.error(errorMessage);
            await addLogEntry(errorMessage, 'error');
            // Add a notification to alert the user
            chrome.notifications.create({
                type: 'basic',
                iconUrl: '../images/icon128.png',
                title: 'Cloud Sync Failed',
                message: `Your data size (${(totalBytes/1024).toFixed(1)} KB) exceeds the Chrome Sync limit of 100 KB. Please clear some data or disable sync.`,
                priority: 2
            });
            return; // Exit function if quota is exceeded
        }

        // Set the data in sync storage
        await chrome.storage.sync.set(dataToSync);
        
        // Update the last sync timestamp in local storage
        await chrome.storage.local.set({ [LAST_AUTO_SYNC_TIMESTAMP_KEY]: Date.now() });

        logMessage = isAutomatic ? 'Automatic sync successful.' : 'Manual sync successful.';
        logType = 'success';
        console.log(logMessage);

    } catch (error) {
        let errorMessage = 'An unknown sync error occurred.';
        if (chrome.runtime.lastError) {
            errorMessage = `Chrome runtime error: ${chrome.runtime.lastError.message}`;
        } else if (error.message) {
            errorMessage = error.message;
        }
        logMessage = isAutomatic ? `Automatic sync failed: ${errorMessage}` : `Manual sync failed: ${errorMessage}`;
        logType = 'error';
        console.error('Error syncing local data to cloud:', error);
    } finally {
        await addLogEntry(logMessage, logType);
    }
};

/**
 * @function restoreDataFromCloud
 * Restores ALL data from chrome.storage.sync to chrome.storage.local.
 */
const restoreDataFromCloud = async () => {
    console.log('Starting restore of all data from cloud...');
    try {
        const syncData = await chrome.storage.sync.get(null);
        if (Object.keys(syncData).length === 0) {
            const warningMessage = 'No data found in cloud storage to restore.';
            console.warn(warningMessage);
            await addLogEntry(warningMessage, 'warning');
            return;
        }
        
        // Overwrite all data in local storage with the synced data
        await chrome.storage.local.set(syncData);
        
        console.log('Data successfully restored from cloud to local storage.');
        await addLogEntry('Data restore from cloud was successful.', 'success');

        // Re-calculate alarms and cache after a restore
        updateAlarmsAndCache();

    } catch (error) {
        const errorMessage = `Restore from cloud failed: ${error.message || 'An unknown error occurred.'}`;
        console.error(errorMessage, error);
        await addLogEntry(errorMessage, 'error');
    }
};

/**
 * Updates the sync alarms based on user settings.
 */
const updateSyncAlarms = async () => {
    console.log('Updating sync alarms...');
    await chrome.alarms.clear(SYNC_ALARM_NAME);
    const { [AUTO_SYNC_SETTING_KEY]: isEnabled, [SYNC_INTERVAL_KEY]: interval } = await chrome.storage.local.get([AUTO_SYNC_SETTING_KEY, SYNC_INTERVAL_KEY]);
    
    if (isEnabled) {
        const periodInMinutes = parseInt(interval, 10) || 60;
        chrome.alarms.create(SYNC_ALARM_NAME, { periodInMinutes });
        console.log(`Cloud sync alarm scheduled to run every ${periodInMinutes} minutes.`);
    } else {
        console.log('Cloud sync is disabled. Sync alarm removed.');
    }
};

// --- Chrome API Event Listeners ---

// On extension install/update, initialize storage and alarms.
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('modcore EM installed or updated.');
    if (details.reason === 'install') {
        // Initialize settings with sensible defaults for new users
        await chrome.storage.local.set({
            [RULES_STORAGE_KEY]: [],
            [AUTO_SYNC_SETTING_KEY]: false,
            [SYNC_ON_STARTUP_KEY]: false,
            [SYNC_ON_CHANGE_KEY]: true, // Recommended to be on
            [SYNC_INTERVAL_KEY]: 60, // 1 hour
            [LAST_AUTO_SYNC_TIMESTAMP_KEY]: 0,
            [SYNC_LOG_KEY]: [],
            [DEVICE_NAME_OPTION_KEY]: 'browser',
            [CUSTOM_DEVICE_NAME_KEY]: ''
        });
        console.log('Initialized local storage settings for the first time.');
    }
    updateAlarmsAndCache();
    updateSyncAlarms(); // Schedule the periodic sync alarm
});

// On browser startup, re-sync alarms and optionally trigger a sync.
chrome.runtime.onStartup.addListener(async () => {
    console.log('Browser started. Re-initializing alarms and cache.');
    updateAlarmsAndCache();
    updateSyncAlarms();
    
    // Trigger sync on startup if the user has enabled the setting.
    const { [SYNC_ON_STARTUP_KEY]: syncOnStartup } = await chrome.storage.local.get(SYNC_ON_STARTUP_KEY);
    if (syncOnStartup) {
        console.log('Sync on startup is enabled. Triggering a sync...');
        syncLocalDataToCloud();
    }
});

// Listen for messages from the UI (e.g., when rules are saved or sync settings are changed).
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SAVE_RULES') {
        chrome.storage.local.set({ [RULES_STORAGE_KEY]: request.payload }, () => {
            console.log('Rules saved. Re-calculating alarms and updating cache.');
            updateAlarmsAndCache();
            sendResponse({ status: 'success' });
        });
        return true;
    } else if (request.type === 'UPDATE_SYNC_SETTINGS') {
        console.log('Sync settings updated from UI. Re-scheduling sync alarm.');
        updateSyncAlarms();
    }
});

// Listen for the time-based and sync alarms to fire.
chrome.alarms.onAlarm.addListener(async (alarm) => {
    console.log('Alarm fired:', alarm.name);
    if (alarm.name.startsWith('rule_')) {
        const { [RULES_STORAGE_KEY]: rules } = await chrome.storage.local.get(RULES_STORAGE_KEY);
        const ruleToExecute = rules?.find(r => `rule_${r.id}` === alarm.name);

        if (ruleToExecute && ruleToExecute.enabled) {
            // Safeguard: re-verify the day, as a weekly alarm might fire
            const today = new Date().getDay();
            if (ruleToExecute.trigger.days.includes(today)) {
                executeRuleAction(ruleToExecute);
            } else {
                console.log(`Alarm for rule "${ruleToExecute.name}" fired on a non-scheduled day. Skipping execution.`);
            }
        }
    } else if (alarm.name === SYNC_ALARM_NAME) {
        // This alarm is for the periodic background sync
        syncLocalDataToCloud(true);
    }
});

// PERFORMANCE: Listen for tab updates to handle URL-based triggers using the in-memory cache.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url || urlRulesCache.length === 0) {
        return;
    }

    for (const rule of urlRulesCache) {
        if (rule.enabled && rule.trigger.type === 'url' && tab.url.includes(rule.trigger.url)) {
            executeRuleAction(rule);
        }
    }
});

// Listen for any storage changes to trigger a debounced sync if enabled.
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    const { [SYNC_ON_CHANGE_KEY]: syncOnChange } = await chrome.storage.local.get(SYNC_ON_CHANGE_KEY);
    
    // Check if the change is in the local storage area and the setting is enabled.
    if (areaName === 'local' && syncOnChange) {
        // Exclude changes to the sync log itself to prevent an infinite loop
        if (changes[SYNC_LOG_KEY]) {
            return;
        }

        // Debounce the sync operation to prevent excessive writes
        clearTimeout(syncDebounceTimeout);
        syncDebounceTimeout = setTimeout(() => {
            console.log('Storage change detected. Triggering debounced sync...');
            syncLocalDataToCloud(true);
        }, SYNC_DEBOUNCE_DELAY_MS);
    }
});
