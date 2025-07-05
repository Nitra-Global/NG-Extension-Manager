document.addEventListener('DOMContentLoaded', initializePage);

// --- Constants & UI Elements ---
const SYNC_QUOTA_BYTES = 102400; // 100 KB
const AUTO_SYNC_SETTING_KEY = 'cloudSyncEnabled';
const SYNC_ON_STARTUP_KEY = 'cloudSyncOnStartup';
const SYNC_ON_CHANGE_KEY = 'cloudSyncOnChange';
const SYNC_INTERVAL_KEY = 'cloudSyncInterval';
const LAST_AUTO_SYNC_TIMESTAMP_KEY = 'lastAutoSyncTimestamp';
const DEVICE_NAME_OPTION_KEY = 'deviceNameOption';
const CUSTOM_DEVICE_NAME_KEY = 'customDeviceName';
const SYNC_LOG_KEY = 'syncLog';
const MAX_LOG_ENTRIES = 50;

// UI Elements
const enableAutoSyncCheckbox = document.getElementById('enableAutoSync');
const syncOnStartupCheckbox = document.getElementById('syncOnStartup');
const syncOnChangeCheckbox = document.getElementById('syncOnChange');
const syncIntervalSelect = document.getElementById('syncInterval');
const syncNowBtn = document.getElementById('syncNowBtn');
const restoreBtn = document.getElementById('restoreBtn');
const clearSyncBtn = document.getElementById('clearSyncBtn');
const syncProgressBarContainer = document.getElementById('syncProgressBarContainer');
const syncProgress = document.getElementById('syncProgress');
const syncProgressText = document.getElementById('syncProgressText');
const statusMessage = document.getElementById('statusMessage');
const tabLinks = document.querySelectorAll('.tab-link');
const panels = document.querySelectorAll('.panel');
const deviceNameOptionRadios = document.querySelectorAll('input[name="deviceNameOption"]');
const customDeviceNameInput = document.getElementById('customDeviceName');
const currentDeviceIdSpan = document.getElementById('currentDeviceId');
const chromeSyncStatus = document.getElementById('chromeSyncStatus');
const extensionSyncStatus = document.getElementById('extensionSyncStatus');
const lastAutoSyncTimestampSpan = document.getElementById('lastAutoSyncTimestamp');
const syncLog = document.getElementById('syncLog');

// --- Initialization ---
async function initializePage() {
    // 1. Load settings from local storage
    const settings = await chrome.storage.local.get([
        AUTO_SYNC_SETTING_KEY,
        SYNC_ON_STARTUP_KEY,
        SYNC_ON_CHANGE_KEY,
        SYNC_INTERVAL_KEY,
        LAST_AUTO_SYNC_TIMESTAMP_KEY,
        DEVICE_NAME_OPTION_KEY,
        CUSTOM_DEVICE_NAME_KEY,
        SYNC_LOG_KEY
    ]);
    
    // 2. Set UI elements based on loaded settings
    enableAutoSyncCheckbox.checked = settings[AUTO_SYNC_SETTING_KEY] || false;
    syncOnStartupCheckbox.checked = settings[SYNC_ON_STARTUP_KEY] || false;
    syncOnChangeCheckbox.checked = settings[SYNC_ON_CHANGE_KEY] || false;
    syncIntervalSelect.value = settings[SYNC_INTERVAL_KEY] || '60';

    if (settings[LAST_AUTO_SYNC_TIMESTAMP_KEY]) {
        lastAutoSyncTimestampSpan.textContent = new Date(settings[LAST_AUTO_SYNC_TIMESTAMP_KEY]).toLocaleString();
    }

    const deviceNameOption = settings[DEVICE_NAME_OPTION_KEY] || 'userAgent';
    document.querySelector(`input[name="deviceNameOption"][value="${deviceNameOption}"]`).checked = true;
    customDeviceNameInput.value = settings[CUSTOM_DEVICE_NAME_KEY] || '';
    updateDeviceIdDisplay();
    updateCustomNameInputState();

    // 3. Set dynamic status indicators
    const syncStatus = await chrome.storage.sync.get(null);
    chromeSyncStatus.textContent = Object.keys(syncStatus).length > 0 ? 'Active' : 'Inactive or Disabled';
    chromeSyncStatus.className = `status-indicator status-${Object.keys(syncStatus).length > 0 ? 'active' : 'inactive'}`;
    
    extensionSyncStatus.textContent = enableAutoSyncCheckbox.checked ? 'Enabled' : 'Disabled';
    extensionSyncStatus.className = `status-indicator status-${enableAutoSyncCheckbox.checked ? 'active' : 'inactive'}`;

    // 4. Load and display current sync usage & log
    await updateSyncProgressBar();

    // 5. Add all event listeners
    addEventListeners();
}

/**
 * Adds all event listeners for UI interactions.
 */
function addEventListeners() {
    // Sync option settings listeners
    enableAutoSyncCheckbox.addEventListener('change', toggleAutoSync);
    syncOnStartupCheckbox.addEventListener('change', updateSyncSetting);
    syncOnChangeCheckbox.addEventListener('change', updateSyncSetting);
    syncIntervalSelect.addEventListener('change', updateSyncSetting);
    
    // Manual action buttons
    syncNowBtn.addEventListener('click', manualSyncToCloud);
    restoreBtn.addEventListener('click', manualRestoreFromCloud);
    clearSyncBtn.addEventListener('click', clearCloudData);
    
    // Tab navigation
    tabLinks.forEach(link => link.addEventListener('click', () => switchPanel(link)));

    // Device naming options
    deviceNameOptionRadios.forEach(radio => radio.addEventListener('change', handleDeviceNameChange));
    customDeviceNameInput.addEventListener('input', handleCustomNameInput);

    // Listen for storage changes from other contexts (e.g., background script)
    chrome.storage.onChanged.addListener(handleStorageChange);
}

// --- UI Functions ---
/**
 * Switches the active panel based on the clicked tab.
 * @param {HTMLElement} clickedTab The tab link element that was clicked.
 */
function switchPanel(clickedTab) {
    tabLinks.forEach(link => link.classList.remove('active'));
    panels.forEach(panel => panel.classList.remove('active'));
    clickedTab.classList.add('active');
    const panelId = clickedTab.dataset.panel;
    document.getElementById(panelId).classList.add('active');
}

/**
 * Updates the sync quota progress bar, text, and button states by getting all keys from sync storage.
 */
async function updateSyncProgressBar() {
    syncProgressBarContainer.style.display = 'block';
    setUIState(false); // Reset state before checking quota
    try {
        const syncData = await chrome.storage.sync.get(null);
        let totalBytes = 0;

        for (const key in syncData) {
            const valueString = JSON.stringify(syncData[key]);
            totalBytes += valueString.length + key.length; 
        }
        
        const percentage = (totalBytes / SYNC_QUOTA_BYTES) * 100;
        syncProgress.style.width = `${Math.min(percentage, 100)}%`;
        syncProgressText.textContent = `${(totalBytes / 1024).toFixed(2)} KB / 100 KB (${totalBytes.toLocaleString()} bytes)`;

        if (totalBytes > SYNC_QUOTA_BYTES) {
            statusMessage.textContent = 'Warning: Sync quota exceeded! All cloud sync actions are disabled.';
            statusMessage.className = 'status-message error';
            syncProgress.style.backgroundColor = '#dc3545'; // Red for overflow
            // Disable manual sync buttons when quota is exceeded
            syncNowBtn.disabled = true;
            restoreBtn.disabled = true;
            clearSyncBtn.disabled = true;
        } else if (totalBytes > SYNC_QUOTA_BYTES * 0.8) {
            statusMessage.textContent = 'Warning: You are approaching the sync quota limit.';
            statusMessage.className = 'status-message warning';
            syncProgress.style.backgroundColor = '#ffc107'; // Yellow for warning
            // Ensure buttons are enabled if not exceeding
            syncNowBtn.disabled = false;
            restoreBtn.disabled = false;
            clearSyncBtn.disabled = false;
        } else {
            statusMessage.textContent = 'Sync usage is healthy and within limits.';
            statusMessage.className = 'status-message success';
            syncProgress.style.backgroundColor = '#28a745'; // Green for good
            // Ensure buttons are enabled
            syncNowBtn.disabled = false;
            restoreBtn.disabled = false;
            clearSyncBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error updating sync progress bar:', error);
        statusMessage.textContent = 'Error: Could not retrieve sync usage.';
        statusMessage.className = 'status-message error';
    }
}

/**
 * Updates the sync log display from local storage.
 */
async function updateSyncLog() {
    const { [SYNC_LOG_KEY]: logEntries } = await chrome.storage.local.get(SYNC_LOG_KEY);
    syncLog.innerHTML = ''; // Clear log display
    
    if (!logEntries || logEntries.length === 0) {
        syncLog.innerHTML = '<p style="text-align: center; color: #888;">No sync events recorded yet.</p>';
        return;
    }

    // Sort log entries by timestamp in descending order
    logEntries.sort((a, b) => b.timestamp - a.timestamp);

    logEntries.forEach(entry => {
        const logEntryDiv = document.createElement('div');
        logEntryDiv.className = 'log-entry';
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-timestamp';
        timestampSpan.textContent = `[${new Date(entry.timestamp).toLocaleString()}] `;
        const messageSpan = document.createElement('span');
        messageSpan.className = `log-message ${entry.type === 'error' ? 'error-log' : ''}`;
        messageSpan.textContent = entry.message;
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(messageSpan);
        syncLog.appendChild(logEntryDiv);
    });
}

/**
 * Adds an entry to the sync log in local storage.
 * @param {string} message The log message.
 * @param {string} type The type of log ('info', 'success', 'error').
 */
async function addLogEntry(message, type = 'info') {
    const { [SYNC_LOG_KEY]: currentLog } = await chrome.storage.local.get(SYNC_LOG_KEY);
    const newLog = Array.isArray(currentLog) ? currentLog : [];
    
    // Get the device name based on user's preference
    const deviceName = await getDeviceName();

    const newEntry = {
        timestamp: Date.now(),
        message: `${message} (Device: ${deviceName})`,
        type: type
    };

    newLog.push(newEntry);
    
    // Trim the log to a maximum size
    if (newLog.length > MAX_LOG_ENTRIES) {
        newLog.splice(0, newLog.length - MAX_LOG_ENTRIES);
    }
    
    try {
        await chrome.storage.local.set({ [SYNC_LOG_KEY]: newLog });
        // Update the log display if we are on the log tab
        if (document.getElementById('log-panel').classList.contains('active')) {
            await updateSyncLog();
        }
    } catch (error) {
        console.error('Error saving log entry to local storage:', error);
    }
}

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
 * Updates the displayed device ID based on the user's selected naming option.
 */
async function updateDeviceIdDisplay() {
    currentDeviceIdSpan.textContent = await getDeviceName();
}

// --- Sync Logic ---
/**
 * Toggles the main automatic sync setting and saves all settings.
 */
async function toggleAutoSync() {
    await updateSyncSetting();
    const isEnabled = enableAutoSyncCheckbox.checked;
    extensionSyncStatus.textContent = isEnabled ? 'Enabled' : 'Disabled';
    extensionSyncStatus.className = `status-indicator status-${isEnabled ? 'active' : 'inactive'}`;
    statusMessage.textContent = `Automatic background sync is now ${isEnabled ? 'enabled' : 'disabled'}.`;
    statusMessage.className = 'status-message info';
    
    // Tell the background script to re-schedule alarms
    chrome.runtime.sendMessage({ type: 'UPDATE_SYNC_SETTINGS' });
    
    await addLogEntry(`Automatic sync was ${isEnabled ? 'enabled' : 'disabled'} by user.`, 'info');
}

/**
 * Saves all sync-related settings to local storage and updates the background script.
 */
async function updateSyncSetting() {
    const settings = {
        [AUTO_SYNC_SETTING_KEY]: enableAutoSyncCheckbox.checked,
        [SYNC_ON_STARTUP_KEY]: syncOnStartupCheckbox.checked,
        [SYNC_ON_CHANGE_KEY]: syncOnChangeCheckbox.checked,
        [SYNC_INTERVAL_KEY]: parseInt(syncIntervalSelect.value, 10)
    };
    
    await chrome.storage.local.set(settings);

    // Send a message to the background script to update alarms/listeners
    chrome.runtime.sendMessage({ type: 'UPDATE_SYNC_SETTINGS' });
}

/**
 * Toggles the enabled/disabled state of the custom name input field.
 */
function updateCustomNameInputState() {
    customDeviceNameInput.disabled = document.querySelector('input[name="deviceNameOption"]:checked').value !== 'custom';
}

/**
 * Handles change events for the device naming radio buttons.
 */
async function handleDeviceNameChange() {
    const selectedValue = document.querySelector('input[name="deviceNameOption"]:checked').value;
    await chrome.storage.local.set({ [DEVICE_NAME_OPTION_KEY]: selectedValue });
    updateCustomNameInputState();
    updateDeviceIdDisplay();
}

/**
 * Handles input events for the custom device name field.
 */
async function handleCustomNameInput() {
    const customName = customDeviceNameInput.value;
    await chrome.storage.local.set({ [CUSTOM_DEVICE_NAME_KEY]: customName });
    updateDeviceIdDisplay();
}

/**
 * Manually copies ALL data from local storage to sync storage.
 */
async function manualSyncToCloud() {
    setUIState(true, 'Syncing all local data to the cloud...');
    try {
        // Get ALL data from local storage
        const localData = await chrome.storage.local.get(null);
        
        // Exclude internal settings from the synced data to avoid conflicts, but keep the log for now
        const dataToSync = { ...localData };
        delete dataToSync[LAST_AUTO_SYNC_TIMESTAMP_KEY];
        delete dataToSync[AUTO_SYNC_SETTING_KEY];
        delete dataToSync[SYNC_ON_STARTUP_KEY];
        delete dataToSync[SYNC_ON_CHANGE_KEY];
        delete dataToSync[SYNC_INTERVAL_KEY];
        delete dataToSync[DEVICE_NAME_OPTION_KEY];
        delete dataToSync[CUSTOM_DEVICE_NAME_KEY];
        
        await chrome.storage.sync.set(dataToSync);
        
        statusMessage.textContent = 'Manual sync successful! All local data copied to the cloud.';
        statusMessage.className = 'status-message success';
        await updateSyncProgressBar();
        await addLogEntry('Manual sync to cloud was successful.', 'success');
    } catch (error) {
        console.error('Manual sync failed:', error);
        let errorMessage = 'An unknown error occurred.';
        if (error.message && error.message.includes('QUOTA_BYTES_PER_ITEM_LIMIT')) {
            errorMessage = 'Sync failed: An individual item is too large (over 8KB).';
        } else if (error.message && error.message.includes('QUOTA_BYTES_LIMIT')) {
            errorMessage = 'Sync failed: Total data size exceeds the 100KB quota. Please clear some data first.';
        } else if (error.message && error.message.includes('MAX_WRITE_OPERATIONS_PER_HOUR')) {
            errorMessage = 'Sync failed: You have exceeded the hourly write limit.';
        } else if (error.message && error.message.includes('MAX_WRITE_OPERATIONS_PER_MINUTE')) {
            errorMessage = 'Sync failed: You are writing too frequently (over 120 writes/min).';
        } else if (error.message) {
            errorMessage = `Sync failed: ${error.message}`;
        }
        statusMessage.textContent = errorMessage;
        statusMessage.className = 'status-message error';
        await addLogEntry(`Manual sync failed: ${errorMessage}`, 'error');
    } finally {
        setUIState(false);
        updateSyncProgressBar(); // Re-evaluate button state after operation
    }
}

/**
 * Manually restores ALL data from sync storage to local storage.
 */
async function manualRestoreFromCloud() {
    if (!confirm("Are you sure you want to restore from the cloud? This will PERMANENTLY OVERWRITE all your current local data.")) {
        return;
    }

    setUIState(true, 'Restoring all data from the cloud...');
    try {
        // Get ALL data from sync storage
        const syncData = await chrome.storage.sync.get(null);
        
        // We restore everything from sync storage, including the log, as this is a full restore.
        if (Object.keys(syncData).length === 0) {
            statusMessage.textContent = 'No extension data found in the cloud to restore.';
            statusMessage.className = 'status-message warning';
            await addLogEntry('Restore from cloud failed: No data found in cloud.', 'warning');
        } else {
            await chrome.storage.local.set(syncData);
            statusMessage.textContent = 'Restore successful! All local data has been updated.';
            statusMessage.className = 'status-message success';
            await addLogEntry('Manual restore from cloud was successful.', 'success');
        }
    } catch (error) {
        console.error('Manual restore failed:', error);
        const errorMessage = error.message || 'An unknown error occurred.';
        statusMessage.textContent = `Restore failed: ${errorMessage}`;
        statusMessage.className = 'status-message error';
        await addLogEntry(`Manual restore failed: ${errorMessage}`, 'error');
    } finally {
        setUIState(false);
        updateSyncProgressBar(); // Re-evaluate button state after operation
    }
}

/**
 * Clears all synced extension data from the cloud.
 */
async function clearCloudData() {
    if (!confirm("WARNING: This will permanently delete ALL synced extension data from the cloud. This cannot be undone. Are you sure?")) {
        return;
    }

    setUIState(true, 'Clearing all cloud data...');
    try {
        // Get all keys from the sync storage.
        const allKeys = Object.keys(await chrome.storage.sync.get(null));
        
        // Remove all data from sync storage.
        await chrome.storage.sync.clear();

        statusMessage.textContent = 'All synced extension data has been cleared from the cloud.';
        statusMessage.className = 'status-message success';
        await updateSyncProgressBar();
        await addLogEntry('All cloud data was permanently cleared by user.', 'success');
    } catch (error) {
        console.error('Clear cloud data failed:', error);
        const errorMessage = error.message || 'An unknown error occurred.';
        statusMessage.textContent = `Clearing failed: ${errorMessage}`;
        statusMessage.className = 'status-message error';
        await addLogEntry(`Clearing cloud data failed: ${errorMessage}`, 'error');
    } finally {
        setUIState(false);
        updateSyncProgressBar(); // Re-evaluate button state after operation
    }
}

/**
 * Sets the UI state (e.g., disables buttons) during an operation.
 * @param {boolean} isLoading Whether a process is running.
 * @param {string} message The message to display.
 */
function setUIState(isLoading, message = '') {
    // Disable the buttons if a process is running
    syncNowBtn.disabled = isLoading;
    restoreBtn.disabled = isLoading;
    clearSyncBtn.disabled = isLoading;
    
    // Also disable settings when a process is running
    enableAutoSyncCheckbox.disabled = isLoading;
    syncOnStartupCheckbox.disabled = isLoading;
    syncOnChangeCheckbox.disabled = isLoading;
    syncIntervalSelect.disabled = isLoading;
    deviceNameOptionRadios.forEach(radio => radio.disabled = isLoading);
    customDeviceNameInput.disabled = isLoading || document.querySelector('input[name="deviceNameOption"]:checked').value !== 'custom';

    if (message) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message info';
    }
}

/**
 * Handles changes in the storage and updates the UI.
 * @param {object} changes The changes object from chrome.storage.onChanged.
 * @param {string} areaName The storage area that changed.
 */
function handleStorageChange(changes, areaName) {
    // We only need to check sync changes for the progress bar, as local changes are handled by UI events.
    if (areaName === 'sync') {
        updateSyncProgressBar();
    }
    
    // We need to check for local changes to update the log and timestamps if they were changed from the background script.
    if (areaName === 'local') {
        if (changes[SYNC_LOG_KEY]) {
            updateSyncLog();
        }
        if (changes[LAST_AUTO_SYNC_TIMESTAMP_KEY]) {
            lastAutoSyncTimestampSpan.textContent = new Date(changes[LAST_AUTO_SYNC_TIMESTAMP_KEY].newValue).toLocaleString();
        }
    }
}