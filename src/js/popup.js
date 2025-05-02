/**
 * popup.js - Logic for the NG Extension Manager Popup (v3.2 - Enhanced Grouping/UX)
 *
 * Key Enhancements:
 * - Smarter Search: Matches multiple terms, highlights all matches.
 * - Bulk Actions: Select multiple extensions via checkboxes for Enable/Disable/Uninstall/Assign Group.
 * - Improved Grouping UX: Bulk assignment, clearer modal hints, better drag/drop feedback.
 * - UI/UX Tweaks: Added list header, refined feedback messages, tooltips.
 * - Code Refinements: Better state management for selections, more comments.
 */

// --- Constants ---
const EXTENSIONS_PER_PAGE = 12;
const SETTINGS_STORAGE_KEY = 'extensionManagerSettings_v2'; // Keep consistent if structure unchanged
const PREFERENCES_STORAGE_KEY = 'extensionManagerPreferences_v2';
const GROUPS_STORAGE_KEY = 'extensionManagerGroups_v2';
const DEFAULT_ICON_PLACEHOLDER = '../../public/icons/svg/updatelogo.svg'; // Default icon path
// --- ICON PATHS (Ensure these paths are correct) ---
const ICON_PATHS = {
    toggleOn: '../../public/icons/svg/power.svg',
    toggleOff: '../../public/icons/svg/power.svg',
    details: '../../public/icons/svg/info.svg',
    delete: '../../public/icons/svg/trash.svg',
    addGroup: '../../public/icons/svg/plus.svg',
    renameGroup: '../../public/icons/svg/edit.svg',
    deleteGroup: '../../public/icons/svg/trash.svg',
    enableGroup: '../../public/icons/svg/power.svg', // Consider checkmark
    disableGroup: '../../public/icons/svg/power.svg', // Consider x-mark
    prevPage: '../../public/icons/svg/arrow-left.svg',
    nextPage: '../../public/icons/svg/arrow-right.svg',
};
// ------------------------------------------------------------------------------------

// --- DOM Elements Cache ---
const elements = {
    // Main UI
    loadingIndicator: document.getElementById('loading-indicator'),
    errorMessage: document.getElementById('error-message'),
    successMessage: document.getElementById('success-message'),
    extensionList: document.getElementById('extension-list'),
    extensionListHeader: document.getElementById('extension-list-header'),
    searchInput: document.getElementById('search-input'),
    typeFilter: document.getElementById('type-filter'),
    statusFilter: document.getElementById('status-filter'),
    groupFilter: document.getElementById('group-filter'),
    currentPageSpan: document.getElementById('current-page'),
    totalPagesSpan: document.getElementById('total-pages'),
    prevPageButton: document.getElementById('prev-page'),
    nextPageButton: document.getElementById('next-page'),
    // Bulk Actions
    bulkActionsContainer: document.getElementById('bulk-actions-container'),
    selectedCountSpan: document.getElementById('selected-count'),
    bulkAssignGroupSelect: document.getElementById('bulk-assign-group-select'),
    bulkEnableButton: document.getElementById('bulk-enable-button'),
    bulkDisableButton: document.getElementById('bulk-disable-button'),
    bulkUninstallButton: document.getElementById('bulk-uninstall-button'),
    selectAllCheckbox: document.getElementById('select-all-checkbox'),
    // Group Modal
    groupModal: document.getElementById('group-management-modal'),
    groupModalTrigger: document.getElementById('group-management-modal-trigger'),
    groupModalCloseButton: document.querySelector('#group-management-modal .modal-close-button'),
    modalNewGroupNameInput: document.getElementById('modal-new-group-name'),
    modalAddGroupButton: document.getElementById('modal-add-group-button'),
    modalGroupList: document.getElementById('modal-group-management-list'),
    modalSuccessMessage: document.getElementById('modal-success-message'),
    modalErrorMessage: document.getElementById('modal-error-message'),
};

// --- State ---
let draggedGroupItem = null; // For group reordering drag/drop
let searchDebounceTimeout;
let allFetchedExtensions = []; // Cache fetched extensions for filtering
let currentFilteredExtensions = []; // Cache currently filtered/sorted extensions
let selectedExtensionIds = new Set(); // Store IDs of selected extensions

// --- Utility Functions ---

/**
 * Sanitize text content to prevent XSS.
 * @param {string|null|undefined} str - The input string.
 * @returns {string} - The sanitized text string.
 */
function sanitizeText(str) {
    if (str === null || typeof str === 'undefined') return '';
    const temp = document.createElement('div');
    temp.textContent = String(str); // Use textContent for safety
    return temp.textContent;
}

/**
 * Highlight multiple search terms within text, returning safe HTML.
 * Handles overlapping terms correctly.
 * @param {string} text - The original text.
 * @param {string[]} searchTerms - Array of terms to highlight.
 * @returns {string} - HTML string with highlights or original sanitized text.
 */
function highlightSearchTerms(text, searchTerms) {
    const sanitizedText = sanitizeText(text);
    if (!searchTerms || searchTerms.length === 0 || !text) {
        return sanitizedText;
    }

    // Filter out empty terms and escape regex characters
    const validSearchTerms = searchTerms
        .map(term => term.trim())
        .filter(Boolean)
        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); // Escape regex chars

    if (validSearchTerms.length === 0) {
        return sanitizedText;
    }

    try {
        // Create a regex that matches any of the search terms
        const regex = new RegExp(`(${validSearchTerms.join('|')})`, 'gi');
        // Replace matches with highlighted span
        return sanitizedText.replace(regex, '<span class="search-highlight">$1</span>');
    } catch (e) {
        console.error("Highlight regex error:", e);
        return sanitizedText; // Fallback to sanitized text on error
    }
}


// --- Loading, Error & Success Feedback ---

function showLoading() {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'flex';
        elements.loadingIndicator.setAttribute('aria-hidden', 'false');
    }
}
function hideLoading() {
    if (elements.loadingIndicator) {
        elements.loadingIndicator.style.display = 'none';
        elements.loadingIndicator.setAttribute('aria-hidden', 'true');
    }
}

/**
 * Shows a feedback message in a specific container (popup or modal).
 * @param {string} message The message text.
 * @param {'error'|'success'} type The type of message.
 * @param {'popup'|'modal'} location Where to show the message.
 */
function showFeedbackMessage(message, type = 'error', location = 'popup') {
    const targetElement = location === 'modal'
        ? (type === 'error' ? elements.modalErrorMessage : elements.modalSuccessMessage)
        : (type === 'error' ? elements.errorMessage : elements.successMessage);
    const otherElement = location === 'modal'
        ? (type === 'error' ? elements.modalSuccessMessage : elements.modalErrorMessage)
        : (type === 'error' ? elements.successMessage : elements.errorMessage);

    if (!targetElement) return;

    targetElement.textContent = sanitizeText(message);
    targetElement.style.display = 'flex'; // Use flex for centering
    targetElement.setAttribute('aria-hidden', 'false');
    if (otherElement) {
        otherElement.style.display = 'none';
        otherElement.setAttribute('aria-hidden', 'true');
    }

    // Auto-hide after a delay
    setTimeout(() => hideFeedbackMessage(type, location), type === 'error' ? 6000 : 4000);
}

/** Hides feedback messages. */
function hideFeedbackMessage(type = 'both', location = 'popup') {
    const errorEl = location === 'modal' ? elements.modalErrorMessage : elements.errorMessage;
    const successEl = location === 'modal' ? elements.modalSuccessMessage : elements.successMessage;
    if ((type === 'error' || type === 'both') && errorEl) {
        errorEl.textContent = ''; errorEl.style.display = 'none'; errorEl.setAttribute('aria-hidden', 'true');
    }
    if ((type === 'success' || type === 'both') && successEl) {
        successEl.textContent = ''; successEl.style.display = 'none'; successEl.setAttribute('aria-hidden', 'true');
    }
}

// Convenience functions for feedback
const showPopupMessage = (msg, type) => showFeedbackMessage(msg, type, 'popup');
const hidePopupMessage = (type) => hideFeedbackMessage(type, 'popup');
const showModalMessage = (msg, type) => showFeedbackMessage(msg, type, 'modal');
const hideModalMessage = (type) => hideFeedbackMessage(type, 'modal');

// --- LocalStorage & Preferences ---

/** Gets user preferences (group order only). */
function getPreferences() {
    const defaultPrefs = { groupOrder: [] };
    try {
        const prefsString = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!prefsString) return defaultPrefs;
        const prefs = JSON.parse(prefsString);
        const mergedPrefs = { ...defaultPrefs, ...(prefs && typeof prefs === 'object' ? prefs : {}) };
        if (!Array.isArray(mergedPrefs.groupOrder) || mergedPrefs.groupOrder.some(item => typeof item !== 'string')) {
            mergedPrefs.groupOrder = defaultPrefs.groupOrder;
        }
        delete mergedPrefs.sortOrder; // Clean up old key if present
        return mergedPrefs;
    } catch (e) {
        console.error("Error reading preferences:", e);
        localStorage.removeItem(PREFERENCES_STORAGE_KEY); // Clear corrupted data
        return defaultPrefs;
    }
}

/** Saves user preferences (group order only). */
function savePreferences(prefs) {
    try {
        if (!prefs || typeof prefs !== 'object' || !Array.isArray(prefs.groupOrder)) {
            throw new Error("Invalid preferences object structure.");
        }
        const prefsToSave = { groupOrder: prefs.groupOrder };
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefsToSave));
    } catch (e) {
        console.error("Error saving preferences:", e);
        showPopupMessage("Could not save preferences.", 'error');
    }
}

/** Saves the current order of groups. */
function saveGroupOrderPreference(groupNames) {
    if (!Array.isArray(groupNames)) {
        console.error("Attempted to save invalid group order (must be an array).");
        return;
    }
    const prefs = getPreferences();
    prefs.groupOrder = groupNames;
    savePreferences(prefs);
}

// --- LocalStorage Group Data ---

/** Gets group data. */
function getGroups() {
    try {
        const groupsString = localStorage.getItem(GROUPS_STORAGE_KEY);
        if (!groupsString) return {};
        const groups = JSON.parse(groupsString);
        // Basic validation
        if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
             let isValid = true;
             Object.entries(groups).forEach(([key, value]) => {
                 if (typeof key !== 'string' || !Array.isArray(value) || value.some(id => typeof id !== 'string')) isValid = false;
             });
             if (isValid) return groups;
             else throw new Error("Invalid group structure.");
        } else throw new Error("Invalid groups format.");
    } catch (e) {
        console.error("Error reading groups:", e);
        localStorage.removeItem(GROUPS_STORAGE_KEY); // Clear corrupted data
        return {};
    }
}

/** Saves the entire groups object. */
function saveGroups(groups) {
    try {
        if (typeof groups !== 'object' || Array.isArray(groups)) throw new Error("Invalid groups format.");
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (e) {
        console.error("Error saving groups:", e);
        const message = "Failed to save group data.";
        // Show message in modal if open, otherwise in popup
        if (elements.groupModal?.classList.contains('visible')) showModalMessage(message, 'error');
        else showPopupMessage(message, 'error');
    }
}


// --- Group Management Core Logic ---

/** Adds a new group. */
function addGroup(groupName) {
    hideModalMessage(); // Clear previous messages
    const trimmedName = groupName.trim();
    if (!trimmedName) {
        showModalMessage("Group name cannot be empty.", 'error');
        return false;
    }
    const groups = getGroups();
    if (groups.hasOwnProperty(trimmedName)) {
        showModalMessage(`Group "${sanitizeText(trimmedName)}" already exists.`, 'error');
        return false;
    }
    // Reserved names check
    if (trimmedName.toLowerCase() === 'all' || trimmedName.toLowerCase() === 'no group' || trimmedName === '--remove--') {
        showModalMessage(`"${sanitizeText(trimmedName)}" is a reserved name.`, 'error');
        return false;
    }

    groups[trimmedName] = []; // Add new group with empty array
    saveGroups(groups);

    // Update preferences with new group order
    const prefs = getPreferences();
    if (!prefs.groupOrder.includes(trimmedName)) {
        prefs.groupOrder.push(trimmedName);
        saveGroupOrderPreference(prefs.groupOrder);
    }

    // Update UI elements
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList(); // Update dropdowns in the main list
    updateBulkAssignGroupDropdown(); // Update dropdown in bulk actions
    displayGroupManagementListInModal(); // Refresh modal list
    showModalMessage(`Group "${sanitizeText(trimmedName)}" added successfully.`, 'success');
    return true;
}

/** Renames a group. */
function renameGroup(oldName, newName) {
    hideModalMessage();
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
        showModalMessage("New group name cannot be empty.", 'error');
        return false;
    }
    if (trimmedNewName === oldName) return true; // No change needed

    const groups = getGroups();
    if (!groups.hasOwnProperty(oldName)) {
        showModalMessage(`Group "${sanitizeText(oldName)}" not found. Cannot rename.`, 'error');
        return false;
    }
    if (groups.hasOwnProperty(trimmedNewName)) {
        showModalMessage(`Group name "${sanitizeText(trimmedNewName)}" already exists.`, 'error');
        return false;
    }
    if (trimmedNewName.toLowerCase() === 'all' || trimmedNewName.toLowerCase() === 'no group' || trimmedNewName === '--remove--') {
        showModalMessage(`"${sanitizeText(trimmedNewName)}" is a reserved name.`, 'error');
        return false;
    }

    // Perform rename
    groups[trimmedNewName] = groups[oldName]; // Copy members
    delete groups[oldName]; // Remove old group
    saveGroups(groups);

    // Update preferences order
    const prefs = getPreferences();
    const orderIndex = prefs.groupOrder.indexOf(oldName);
    if (orderIndex > -1) {
        prefs.groupOrder[orderIndex] = trimmedNewName;
    } else {
        // If somehow not in order, just add the new name
        prefs.groupOrder.push(trimmedNewName);
    }
    // Remove the old name if it still exists elsewhere (shouldn't happen often)
    prefs.groupOrder = prefs.groupOrder.filter(name => name !== oldName);
    saveGroupOrderPreference(prefs.groupOrder);

    // Update UI
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList();
    updateBulkAssignGroupDropdown();
    displayGroupManagementListInModal();
    showModalMessage(`Group "${sanitizeText(oldName)}" renamed to "${sanitizeText(trimmedNewName)}".`, 'success');
    return true;
}

/** Deletes a group. */
function deleteGroup(groupName) {
    hideModalMessage();
    const groups = getGroups();
    if (!groups.hasOwnProperty(groupName)) {
        showModalMessage(`Group "${sanitizeText(groupName)}" not found.`, 'error');
        return false;
    }
    // Confirmation dialog
    if (!confirm(`Are you sure you want to delete the group "${sanitizeText(groupName)}"? Extensions currently in this group will become ungrouped.`)) {
        return false;
    }

    delete groups[groupName];
    saveGroups(groups);

    // Update preferences order
    const prefs = getPreferences();
    prefs.groupOrder = prefs.groupOrder.filter(name => name !== groupName);
    saveGroupOrderPreference(prefs.groupOrder);

    // Update UI
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList();
    updateBulkAssignGroupDropdown();
    displayGroupManagementListInModal();
    showModalMessage(`Group "${sanitizeText(groupName)}" deleted.`, 'success');

    // If the deleted group was selected in the filter, reset filter
    if (elements.groupFilter?.value === groupName) {
        elements.groupFilter.value = 'all';
        renderExtensionList(getCurrentPage()); // Re-render list with updated filter
    }
    return true;
}

/** Assigns a single extension to a group. */
function assignExtensionToGroup(extensionId, groupName) {
    const groups = getGroups();
    // Treat empty string or "--remove--" as removing from group
    const targetGroupName = (groupName && groupName !== '--remove--') ? groupName.trim() : "";
    let changed = false;
    let previousGroup = null;

    // Remove extension from any group it's currently in
    Object.keys(groups).forEach(key => {
        const index = groups[key].indexOf(extensionId);
        if (index > -1) {
            if (key !== targetGroupName) { // Don't remove if assigning to the same group
                groups[key].splice(index, 1);
                previousGroup = key;
                changed = true;
            } else {
                // Already in the target group, no change needed unless removing
                if (!targetGroupName) { // If target is "No Group"
                    groups[key].splice(index, 1);
                    previousGroup = key;
                    changed = true;
                }
            }
        }
    });

    // Add to the target group if specified and valid
    if (targetGroupName) {
        if (groups.hasOwnProperty(targetGroupName)) {
            if (!groups[targetGroupName].includes(extensionId)) {
                groups[targetGroupName].push(extensionId);
                changed = true;
            }
        } else {
            // This case should ideally not happen if dropdowns are up-to-date
            console.warn(`Assign failed: Target group "${sanitizeText(targetGroupName)}" not found.`);
            // Optionally show an error message
            // showPopupMessage(`Error: Group "${sanitizeText(targetGroupName)}" no longer exists.`, 'error');
            // Revert UI dropdown if possible? Or refresh everything.
            // For now, just log it. The saveGroups will proceed without adding.
        }
    }


    if (changed) {
        saveGroups(groups);
        updateGroupFilterDropdown(); // Update counts in filter dropdown
        updateBulkAssignGroupDropdown(); // Update counts in bulk assign dropdown

        // Highlight the changed item in the list
        const extensionItem = elements.extensionList?.querySelector(`.extension-item[data-extension-id="${extensionId}"]`);
        if (extensionItem) {
            extensionItem.classList.add('item-highlight');
            setTimeout(() => extensionItem.classList.remove('item-highlight'), 800);
        }
        // If the modal is open, refresh its list (counts might change)
        if (elements.groupModal?.classList.contains('visible')) {
            displayGroupManagementListInModal();
        }
        // If filtering by the previous or new group, refresh the list view
        const currentGroupFilter = elements.groupFilter?.value;
        if (currentGroupFilter === previousGroup || currentGroupFilter === targetGroupName) {
             renderExtensionList(getCurrentPage());
        }
    }
}

/** Assigns multiple extensions to a group or removes them. */
function assignMultipleExtensionsToGroup(extensionIds, groupName) {
    if (!extensionIds || extensionIds.size === 0) return; // Nothing to assign

    const groups = getGroups();
    const targetGroupName = (groupName && groupName !== '--remove--') ? groupName.trim() : "";
    let changed = false;

    extensionIds.forEach(extensionId => {
        // Remove from all current groups
        Object.keys(groups).forEach(key => {
            const index = groups[key].indexOf(extensionId);
            if (index > -1) {
                groups[key].splice(index, 1);
                changed = true;
            }
        });

        // Add to the target group if specified and valid
        if (targetGroupName && groups.hasOwnProperty(targetGroupName)) {
            if (!groups[targetGroupName].includes(extensionId)) {
                groups[targetGroupName].push(extensionId);
                changed = true;
            }
        } else if (targetGroupName && !groups.hasOwnProperty(targetGroupName)) {
            console.warn(`Bulk Assign failed for ${extensionId}: Target group "${sanitizeText(targetGroupName)}" not found.`);
            // Decide if we should stop or continue for others
        }
    });

    if (changed) {
        saveGroups(groups);
        updateGroupFilterDropdown();
        updateBulkAssignGroupDropdown();
        if (elements.groupModal?.classList.contains('visible')) {
            displayGroupManagementListInModal();
        }
        // Refresh the main list to reflect changes and update individual dropdowns
        renderExtensionList(getCurrentPage());
        showPopupMessage(`${extensionIds.size} extension(s) ${targetGroupName ? 'assigned to' : 'removed from'} group "${sanitizeText(targetGroupName || 'No Group')}".`, 'success');
    } else if (targetGroupName && !groups.hasOwnProperty(targetGroupName)) {
        showPopupMessage(`Error: Group "${sanitizeText(targetGroupName)}" not found.`, 'error');
    } else {
         showPopupMessage(`No changes made to group assignments.`, 'success'); // Or maybe no message needed
    }

    // Clear selection after bulk action
    clearSelection();
}


// --- UI Update Functions ---

/** Gets the ordered list of group names based on preferences. */
function getOrderedGroupNames() {
    const groups = getGroups();
    const groupOrderPref = getPreferences().groupOrder;
    // Start with names that are in preferences AND exist in current groups
    let orderedNames = groupOrderPref.filter(name => groups.hasOwnProperty(name));
    // Find names in current groups that are NOT in preferences (newly added or prefs corrupted)
    const groupsNotInOrder = Object.keys(groups)
        .filter(name => !orderedNames.includes(name))
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Sort alphabetically
    // Combine them
    return [...orderedNames, ...groupsNotInOrder];
}

/** Populates a generic group select dropdown. */
function populateGroupSelect(selectElement, includeAllOption = false, includeNoGroupOption = false, includeRemoveOption = false) {
    if (!selectElement) return;

    const currentVal = selectElement.value; // Preserve current selection if possible
    selectElement.innerHTML = ''; // Clear existing options

    if (includeAllOption) {
        const option = document.createElement('option');
        option.value = "all";
        option.textContent = "All Groups";
        selectElement.appendChild(option);
    }
    if (includeNoGroupOption) {
        const option = document.createElement('option');
        option.value = ""; // Use empty string for "No Group"
        option.textContent = "No Group";
        selectElement.appendChild(option);
    }
     if (includeRemoveOption) {
        const option = document.createElement('option');
        option.value = "--remove--"; // Special value for removing
        option.textContent = "Remove from Group";
        selectElement.appendChild(option);
    }

    const groups = getGroups();
    const orderedGroupNames = getOrderedGroupNames();

    orderedGroupNames.forEach(groupName => {
        const count = groups[groupName]?.length || 0;
        const option = document.createElement('option');
        option.value = groupName;
        // Display count only in the main filter dropdown for clarity
        option.textContent = selectElement === elements.groupFilter
            ? `${sanitizeText(groupName)} (${count})`
            : sanitizeText(groupName);
        selectElement.appendChild(option);
    });

    // Try to restore previous selection
    if (Array.from(selectElement.options).some(opt => opt.value === currentVal)) {
        selectElement.value = currentVal;
    } else if (includeAllOption) {
        selectElement.value = 'all'; // Default to 'All Groups' if previous value invalid
    } else if (includeNoGroupOption) {
        selectElement.value = ''; // Default to 'No Group'
    }
}


/** Populates the main group filter dropdown. */
function updateGroupFilterDropdown() {
    populateGroupSelect(elements.groupFilter, true, false); // Include 'All Groups'
}

/** Populates the bulk assignment dropdown. */
function updateBulkAssignGroupDropdown() {
    // Pass 'true' for includeNoGroupOption if you want "No Group" explicitly,
    // but '--remove--' might be clearer for bulk actions.
    populateGroupSelect(elements.bulkAssignGroupSelect, false, false, true); // Include 'Remove from Group'
    elements.bulkAssignGroupSelect.value = ""; // Reset to default prompt
}


/** Populates a single assignment dropdown within an extension item. */
function populateAssignGroupDropdown(selectElement, extensionId) {
    if (!selectElement) return;
    const groups = getGroups();
    let currentGroupForExtension = ""; // Default to "No Group"

    // Find the current group for this specific extension
    Object.entries(groups).forEach(([groupName, members]) => {
        if (members.includes(extensionId)) {
            currentGroupForExtension = groupName;
        }
    });

    // Populate using the generic function
    populateGroupSelect(selectElement, false, true); // Include 'No Group'

    // Set the value to the found group
    selectElement.value = currentGroupForExtension;
}

/** Event handler for individual group assignment dropdown changes. */
function handleAssignGroupChange(event) {
    const selectElement = event.target.closest('.assign-group-select');
    if (selectElement?.dataset.extensionId) {
         assignExtensionToGroup(selectElement.dataset.extensionId, selectElement.value);
    }
}

/** Updates all visible assignment dropdowns in the main list. */
function updateAssignGroupDropdownsInList() {
    elements.extensionList?.querySelectorAll('.assign-group-select').forEach(select => {
        if (select.dataset.extensionId) {
            populateAssignGroupDropdown(select, select.dataset.extensionId);
        }
    });
}

// --- Group Management Modal ---

/** Opens the group management modal */
function openGroupManagementModal() {
    const modal = elements.groupModal; if (!modal) return;
    hideModalMessage(); // Clear any previous messages
    displayGroupManagementListInModal(); // Populate list
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    // Use setTimeout to allow display change before adding class for transition
    setTimeout(() => {
        modal.classList.add('visible');
        elements.modalNewGroupNameInput?.focus(); // Focus the input field
    }, 10); // Small delay
}

/** Closes the group management modal */
function closeGroupManagementModal() {
    const modal = elements.groupModal; if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');

    // Use transitionend event to set display: none after fade out
    const listener = (e) => {
        // Ensure the event is for the modal overlay itself and the transition is opacity
        if (e.target === modal && e.propertyName === 'opacity' && !modal.classList.contains('visible')) {
            modal.style.display = 'none';
            modal.removeEventListener('transitionend', listener); // Clean up listener
        }
    };
    modal.addEventListener('transitionend', listener);

    // Fallback timeout in case transitionend doesn't fire (e.g., transition disabled)
    setTimeout(() => {
        if (!modal.classList.contains('visible')) {
            modal.style.display = 'none';
            modal.removeEventListener('transitionend', listener); // Clean up listener
        }
    }, 350); // Slightly longer than transition duration
}

/** Displays the group list in the modal. */
function displayGroupManagementListInModal() {
    const listElement = elements.modalGroupList; if (!listElement) return;
    listElement.innerHTML = ''; // Clear previous list
    const groups = getGroups();
    const orderedGroupNames = getOrderedGroupNames();

    if (orderedGroupNames.length === 0) {
        listElement.innerHTML = '<li class="no-groups-message">No groups created yet. Use the input above.</li>';
        return;
    }

    const fragment = document.createDocumentFragment();
    orderedGroupNames.forEach(groupName => {
        const count = groups[groupName]?.length || 0;
        const listItem = document.createElement('li');
        listItem.dataset.groupname = groupName;
        listItem.draggable = true; // Make item draggable
        listItem.setAttribute('role', 'listitem');
        listItem.setAttribute('aria-label', `${sanitizeText(groupName)} group, ${count} extensions. Draggable.`); // ARIA label

        // Structure: Details | Actions
        listItem.innerHTML = `
            <div class="group-item-details" title="${sanitizeText(groupName)} (${count} extensions)">
                <span class="group-item-name">${sanitizeText(groupName)}</span>
                <span class="group-item-count" aria-label="${count} extensions in group">${count}</span>
            </div>
            <div class="group-item-actions">
                <button class="enable-group-btn button-small button-success" data-groupname="${groupName}" title="Enable all extensions in '${sanitizeText(groupName)}'">
                    <img src="${ICON_PATHS.enableGroup}" alt="" aria-hidden="true"> Enable All
                </button>
                <button class="disable-group-btn button-small button-danger" data-groupname="${groupName}" title="Disable all extensions in '${sanitizeText(groupName)}'">
                    <img src="${ICON_PATHS.disableGroup}" alt="" aria-hidden="true"> Disable All
                </button>
                <button class="rename-group-btn button-small icon-only" data-groupname="${groupName}" title="Rename Group" aria-label="Rename Group '${sanitizeText(groupName)}'">
                     <img src="${ICON_PATHS.renameGroup}" alt="Rename" aria-hidden="true">
                </button>
                <button class="delete-group-btn button-small button-danger icon-only" data-groupname="${groupName}" title="Delete Group" aria-label="Delete Group '${sanitizeText(groupName)}'">
                     <img src="${ICON_PATHS.deleteGroup}" alt="Delete" aria-hidden="true">
                </button>
            </div>
        `;
        fragment.appendChild(listItem);
    });
    listElement.appendChild(fragment);
    addGroupDragDropListeners(listElement); // Attach drag/drop handlers
}

// --- Drag and Drop for Groups ---

function addGroupDragDropListeners(listElement) {
    const items = listElement.querySelectorAll('li[draggable="true"]');
    items.forEach(item => {
        // Use capture phase for dragover/dragleave to handle internal elements better
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver, false); // Use bubbling phase is fine here
        item.addEventListener('dragleave', handleDragLeave, false); // Use bubbling phase is fine here
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        // Prevent buttons inside from triggering drag
        item.querySelectorAll('button').forEach(button => {
            button.addEventListener('mousedown', (e) => e.stopPropagation()); // Stop drag start on button press
        });
    });
}

function handleDragStart(e) {
    // Ensure we're dragging the list item itself
    draggedGroupItem = e.target.closest('li[draggable="true"]');
    if (!draggedGroupItem) {
        e.preventDefault(); // Prevent dragging if not the li
        return;
    }

    // Use setTimeout to allow the browser to render the drag image before applying class
    setTimeout(() => {
        if (draggedGroupItem) draggedGroupItem.classList.add('dragging');
    }, 0);

    e.dataTransfer.effectAllowed = 'move';
    // Set data (group name) - use text/plain as fallback
    try {
        e.dataTransfer.setData('text/plain', draggedGroupItem.dataset.groupname);
    } catch (err) {
        console.warn("Could not set drag data:", err);
    }
}

function handleDragOver(e) {
    e.preventDefault(); // Necessary to allow dropping
    const targetItem = e.target.closest('li[draggable="true"]');

    if (targetItem && targetItem !== draggedGroupItem) {
        // Add drag-over class for visual feedback
        targetItem.classList.add('drag-over');
        e.dataTransfer.dropEffect = 'move'; // Indicate a move operation

        // Remove drag-over from other items
        elements.modalGroupList.querySelectorAll('.drag-over').forEach(el => {
            if (el !== targetItem) el.classList.remove('drag-over');
        });
    } else {
        // If over self or not over a valid target, deny drop
        e.dataTransfer.dropEffect = 'none';
        // Ensure no other items have the drag-over class
        elements.modalGroupList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
}

function handleDragLeave(e) {
    // Remove visual feedback when dragging leaves an item
    const targetItem = e.target.closest('li[draggable="true"]');
    if (targetItem) {
        targetItem.classList.remove('drag-over');
    }
    // Clean up if leaving the list container itself
    if (e.target === elements.modalGroupList) {
        elements.modalGroupList.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    }
}

function handleDrop(e) {
    e.preventDefault(); // Prevent default drop behavior (e.g., opening link)
    e.stopPropagation(); // Stop propagation to parent elements

    const targetItem = e.target.closest('li[draggable="true"]');
    targetItem?.classList.remove('drag-over'); // Clean up target visual

    if (targetItem && targetItem !== draggedGroupItem && draggedGroupItem) {
        const list = targetItem.parentNode; // The UL element
        const rect = targetItem.getBoundingClientRect();
        const offsetY = e.clientY - rect.top; // Vertical position within the target item

        // Determine if dropping above or below the middle of the target item
        const isAfter = offsetY > rect.height / 2;

        // Insert the dragged item relative to the target item
        if (isAfter) {
            list.insertBefore(draggedGroupItem, targetItem.nextSibling); // Insert after target
        } else {
            list.insertBefore(draggedGroupItem, targetItem); // Insert before target
        }

        // Get the new order of group names from the DOM
        const newOrder = Array.from(list.querySelectorAll('li[data-groupname]'))
                              .map(li => li.dataset.groupname);

        // Save the new order and update relevant UI parts
        saveGroupOrderPreference(newOrder);
        updateGroupFilterDropdown(); // Update main filter dropdown order
        updateAssignGroupDropdownsInList(); // Update order in item dropdowns
        updateBulkAssignGroupDropdown(); // Update order in bulk dropdown
    }
}

function handleDragEnd(e) {
    // Clean up styles applied during drag, regardless of drop success
    draggedGroupItem?.classList.remove('dragging');
    elements.modalGroupList?.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    draggedGroupItem = null; // Reset the dragged item state
}


// --- Group Enable/Disable Actions ---

/** Sets the enabled state for all extensions within a group. */
async function setGroupExtensionsState(groupName, enable) {
    hideModalMessage();
    const groups = getGroups();
    const extensionIds = groups[groupName]; // Get IDs from the specific group

    if (!extensionIds || extensionIds.length === 0) {
        showModalMessage(`Group "${sanitizeText(groupName)}" is empty. No extensions to ${enable ? 'enable' : 'disable'}.`, 'error');
        return;
    }

    showLoading(); // Show loading indicator
    let successCount = 0;
    let errorCount = 0;
    const totalCount = extensionIds.length;
    const actionText = enable ? 'enable' : 'disable';
    const actionPastTense = enable ? 'enabled' : 'disabled';

    // Use Promise.allSettled to process all enable/disable requests concurrently
    const results = await Promise.allSettled(extensionIds.map(id =>
        new Promise((resolve, reject) => {
            chrome.management.setEnabled(id, enable, () => {
                if (chrome.runtime.lastError) {
                    // Reject with error details
                    reject({ id, error: chrome.runtime.lastError.message });
                } else {
                    // Resolve with the ID on success
                    resolve(id);
                }
            });
        })
    ));

    // Process results
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            successCount++;
        } else {
            errorCount++;
            // Log specific errors for debugging
            console.error(`Error ${actionText}ing extension ${result.reason.id}:`, result.reason.error);
        }
    });

    hideLoading(); // Hide loading indicator

    // Provide feedback based on results
    if (errorCount > 0 && successCount > 0) {
        showModalMessage(`Partially completed: Could not ${actionText} ${errorCount} extension(s). Successfully ${actionPastTense} ${successCount} in group "${sanitizeText(groupName)}".`, 'error');
    } else if (errorCount > 0) {
        showModalMessage(`Failed to ${actionText} ${errorCount}/${totalCount} extension(s) in group "${sanitizeText(groupName)}". Check console for details.`, 'error');
    } else {
        showModalMessage(`Successfully ${actionPastTense} all ${totalCount} extension(s) in group "${sanitizeText(groupName)}".`, 'success');
    }

    // Refresh the main extension list to show updated states
    renderExtensionList(getCurrentPage());
}

// --- Modal Action Handlers (Delegated) ---

/** Handles clicks within the modal's group list (rename, delete, enable/disable all). */
function handleModalListClick(event) {
    const button = event.target.closest('button[data-groupname]');
    if (!button) return; // Click wasn't on a button with groupname data

    const groupName = button.dataset.groupname;
    if (!groupName) return; // Should not happen if button found

    // Determine action based on button class
    if (button.classList.contains('rename-group-btn')) {
        const currentName = groupName; // For clarity in prompt
        const newName = prompt(`Enter new name for group "${sanitizeText(currentName)}":`, currentName);
        if (newName !== null) { // Prompt wasn't cancelled
            if (newName.trim()) {
                renameGroup(currentName, newName.trim());
            } else {
                // User entered empty name after prompt
                showModalMessage("Group name cannot be empty.", 'error');
            }
        } // If null, user cancelled, do nothing.
    } else if (button.classList.contains('delete-group-btn')) {
        deleteGroup(groupName); // deleteGroup includes confirmation
    } else if (button.classList.contains('enable-group-btn')) {
        setGroupExtensionsState(groupName, true);
    } else if (button.classList.contains('disable-group-btn')) {
        setGroupExtensionsState(groupName, false);
    }
}

// --- Extension Data Fetching & Filtering ---

/** Fetches all extensions using chrome.management.getAll. */
function fetchAllExtensions() {
    return new Promise((resolve, reject) => {
        chrome.management.getAll((extensions) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(extensions || []); // Ensure it resolves with an array
            }
        });
    });
}

/** Filters and sorts extensions based on current criteria. */
function filterAndSortExtensions(extensions) {
    // --- Get Filter Values ---
    const searchInput = elements.searchInput?.value.toLowerCase().trim() || '';
    // Split search into terms for smarter matching
    const searchTerms = searchInput.split(/\s+/).filter(Boolean); // Split by space, remove empty strings
    const typeFilter = elements.typeFilter?.value || 'all';
    const statusFilter = elements.statusFilter?.value || 'all';
    const groupFilter = elements.groupFilter?.value || 'all';
    const groups = getGroups();

    // --- 1. Filter ---
    let filtered = extensions.filter(ext => {
        // Type Filter
        if (typeFilter !== 'all') {
            // Determine extension type (handle potential inconsistencies)
            const extType = ext.type || (ext.isApp ? 'app' : 'extension');
            if (typeFilter === 'extension' && extType !== 'extension') return false;
            if (typeFilter === 'theme' && extType !== 'theme') return false;
            if (typeFilter === 'app' && extType !== 'app') return false;
            // Add more types if necessary (e.g., 'hosted_app')
        }
        // Status Filter
        if (statusFilter !== 'all') {
            if (statusFilter === 'enabled' && !ext.enabled) return false;
            if (statusFilter === 'disabled' && ext.enabled) return false;
        }
        // Group Filter
        if (groupFilter !== 'all') {
            // Check if the extension ID is present in the selected group's array
            if (!groups[groupFilter]?.includes(ext.id)) return false;
        }
        // Search Term Filter (match ALL terms entered)
        if (searchTerms.length > 0) {
            const name = ext.name?.toLowerCase() || '';
            const description = ext.description?.toLowerCase() || '';
            const id = ext.id?.toLowerCase() || '';
            // Check if *all* search terms are found in name, description, or ID
            const allTermsMatch = searchTerms.every(term =>
                name.includes(term) || description.includes(term) || id.includes(term)
            );
            if (!allTermsMatch) return false;
        }
        // If all filters pass, keep the extension
        return true;
    });

    // --- 2. Sort (Default Alphabetical by Name) ---
    filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    return filtered;
}


// --- Extension List Rendering ---

/**
 * Renders the filtered and paginated list of extensions.
 * @param {number} [page=1] - The page number to display.
 */
function renderExtensionList(page = 1) {
    if (!elements.extensionList) {
        console.error("Extension list element not found.");
        hideLoading();
        return;
    }
    elements.extensionList.innerHTML = ''; // Clear previous items
    hidePopupMessage(); // Clear any previous popup messages

    // --- Use cached filtered data ---
    const extensionsToPaginate = currentFilteredExtensions;

    // --- Pagination Logic ---
    const totalExtensions = extensionsToPaginate.length;
    const totalPages = Math.ceil(totalExtensions / EXTENSIONS_PER_PAGE) || 1;
    const currentPage = Math.min(Math.max(page, 1), totalPages); // Ensure page is within bounds
    const startIndex = (currentPage - 1) * EXTENSIONS_PER_PAGE;
    const extensionsToDisplay = extensionsToPaginate.slice(startIndex, startIndex + EXTENSIONS_PER_PAGE);

    // --- Update Pagination Controls ---
    if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
    if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
    if (elements.prevPageButton) elements.prevPageButton.disabled = currentPage === 1;
    if (elements.nextPageButton) elements.nextPageButton.disabled = currentPage === totalPages;

    // --- Render List Items ---
    const fragment = document.createDocumentFragment();
    const searchTerms = (elements.searchInput?.value.toLowerCase().trim() || '').split(/\s+/).filter(Boolean);

    if (extensionsToDisplay.length > 0) {
        elements.extensionListHeader.style.display = 'flex'; // Show header if items exist
        extensionsToDisplay.forEach(extension => {
            const extensionItem = document.createElement('div');
            extensionItem.classList.add('extension-item');
            extensionItem.dataset.extensionId = extension.id;
            extensionItem.setAttribute('role', 'listitem');
            // Add selected class if needed
            if (selectedExtensionIds.has(extension.id)) {
                extensionItem.classList.add('selected');
            }

            // Checkbox for selection
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('extension-select-checkbox');
            checkbox.dataset.extensionId = extension.id;
            checkbox.checked = selectedExtensionIds.has(extension.id);
            checkbox.setAttribute('aria-label', `Select ${sanitizeText(extension.name)}`);
            checkbox.title = `Select/Deselect ${sanitizeText(extension.name)}`;

            // Icon
            const icon = document.createElement('img');
            const bestIcon = extension.icons?.sort((a, b) => b.size - a.size)[0]; // Get largest icon
            icon.src = bestIcon ? bestIcon.url : DEFAULT_ICON_PLACEHOLDER;
            icon.alt = ""; // Decorative icon
            icon.classList.add('extension-icon');
            icon.loading = 'lazy'; // Lazy load icons
            // Fallback icon source
            icon.onerror = () => {
                if (icon.src !== DEFAULT_ICON_PLACEHOLDER) {
                    icon.src = DEFAULT_ICON_PLACEHOLDER;
                }
                icon.onerror = null; // Prevent infinite loop if placeholder fails
            };

            // Details (Name)
            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('extension-details');
            const nameSpan = document.createElement('span');
            nameSpan.classList.add('extension-name');
            // Highlight search terms in the name
            nameSpan.innerHTML = highlightSearchTerms(extension.name, searchTerms);
            nameSpan.title = sanitizeText(extension.name); // Full name on hover
            detailsDiv.appendChild(nameSpan);

            // Actions Container
            const actions = document.createElement('div');
            actions.classList.add('extension-actions');

            // Toggle Button
            const toggleButton = document.createElement('button');
            toggleButton.classList.add('toggle-button', 'button-small');
            toggleButton.dataset.action = 'toggle';
            toggleButton.dataset.extensionId = extension.id;
            toggleButton.dataset.currentState = extension.enabled ? 'enabled' : 'disabled';
            // Use appropriate icon based on state
            toggleButton.innerHTML = `<img src="${extension.enabled ? ICON_PATHS.toggleOff : ICON_PATHS.toggleOn}" alt="" aria-hidden="true">`;
            toggleButton.title = `${extension.enabled ? 'Disable' : 'Enable'} ${sanitizeText(extension.name)}`;
            toggleButton.setAttribute('aria-label', `${extension.enabled ? 'Disable' : 'Enable'} ${sanitizeText(extension.name)}`);
            toggleButton.setAttribute('aria-pressed', String(extension.enabled)); // Indicate toggle state

            // Details Button (links to details.html)
            const detailsButton = document.createElement('button');
            detailsButton.classList.add('details-button', 'button-small');
            detailsButton.dataset.action = 'details';
            detailsButton.dataset.extensionId = extension.id;
            detailsButton.innerHTML = `<img src="${ICON_PATHS.details}" alt="" aria-hidden="true">`;
            detailsButton.title = `View details for ${sanitizeText(extension.name)}`;
            detailsButton.setAttribute('aria-label', `View details for ${sanitizeText(extension.name)}`);

            // Assign Group Dropdown
            const assignGroupSelect = document.createElement('select');
            assignGroupSelect.classList.add('assign-group-select');
            assignGroupSelect.dataset.extensionId = extension.id;
            assignGroupSelect.setAttribute('aria-label', `Assign ${sanitizeText(extension.name)} to Group`);
            assignGroupSelect.title = "Assign to Group";
            populateAssignGroupDropdown(assignGroupSelect, extension.id); // Populate with groups

            // Delete Button
            const deleteButton = document.createElement('button');
            deleteButton.classList.add('delete-button', 'button-small', 'button-danger', 'icon-only');
            deleteButton.dataset.action = 'delete';
            deleteButton.dataset.extensionId = extension.id;
            deleteButton.dataset.extensionName = sanitizeText(extension.name); // Store name for confirmation
            deleteButton.innerHTML = `<img src="${ICON_PATHS.delete}" alt="" aria-hidden="true">`;
            deleteButton.title = `Uninstall ${sanitizeText(extension.name)}`;
            deleteButton.setAttribute('aria-label', `Uninstall ${sanitizeText(extension.name)}`);

            // Append elements to the action container
            actions.appendChild(toggleButton);
            actions.appendChild(detailsButton);
            actions.appendChild(assignGroupSelect);
            actions.appendChild(deleteButton);

            // Append all parts to the main item container
            extensionItem.appendChild(checkbox);
            extensionItem.appendChild(icon);
            extensionItem.appendChild(detailsDiv);
            extensionItem.appendChild(actions);

            // Add the complete item to the document fragment
            fragment.appendChild(extensionItem);
        });
    } else {
        // Display message if no extensions match filters
        elements.extensionListHeader.style.display = 'none'; // Hide header if no items
        const noExtensionsMessage = document.createElement('p');
        noExtensionsMessage.textContent = 'No extensions match the current filters.';
        noExtensionsMessage.classList.add('no-extensions-message');
        fragment.appendChild(noExtensionsMessage);
    }

    // Append the fragment to the list and hide loading indicator
    elements.extensionList.appendChild(fragment);
    hideLoading();

    // Update the state of the "Select All" checkbox
    updateSelectAllCheckboxState();
    // Update the visibility and content of the bulk actions bar
    updateBulkActionsUI();
}


/** Fetches, filters, sorts, and then renders the extension list. */
async function refreshExtensionDataAndRender(page = 1) {
    showLoading();
    try {
        allFetchedExtensions = await fetchAllExtensions();
        currentFilteredExtensions = filterAndSortExtensions(allFetchedExtensions);
        renderExtensionList(page);
    } catch (error) {
        hideLoading();
        showPopupMessage(`Error fetching extensions: ${error.message}`, 'error');
        console.error("Extension fetch/render error:", error);
        elements.extensionList.innerHTML = '<p class="error-message">Could not load extensions.</p>';
        elements.extensionListHeader.style.display = 'none'; // Hide header on error
    }
}


// --- Extension Action Handlers (Delegation) ---

/** Handles clicks within the main extension list (toggle, details, delete). */
function handleExtensionListClick(event) {
    const target = event.target;

    // Handle checkbox clicks
    if (target.classList.contains('extension-select-checkbox')) {
        const extensionId = target.dataset.extensionId;
        if (target.checked) {
            selectedExtensionIds.add(extensionId);
            target.closest('.extension-item')?.classList.add('selected');
        } else {
            selectedExtensionIds.delete(extensionId);
            target.closest('.extension-item')?.classList.remove('selected');
        }
        updateBulkActionsUI(); // Update count and button states
        updateSelectAllCheckboxState(); // Update master checkbox
        return; // Stop further processing for checkbox clicks
    }

    // Handle action button clicks
    const actionButton = target.closest('button[data-action]');
    if (!actionButton) return; // Click wasn't on an action button

    const action = actionButton.dataset.action;
    const extensionId = actionButton.dataset.extensionId;
    if (!extensionId) {
        console.error("Action button missing extension ID.");
        return;
    }

    // Perform action based on button type
    switch (action) {
        case 'toggle':
            // Determine the new state based on the current state dataset attribute
            const enable = actionButton.dataset.currentState === 'disabled';
            toggleExtension(extensionId, enable);
            break;
        case 'details':
            openDetailsPage(extensionId); // Use updated function name
            break;
        case 'delete':
            // Get the extension name from the button's dataset for the confirmation dialog
            const extensionName = actionButton.dataset.extensionName || 'this extension';
            confirmAndDeleteExtension(extensionId, extensionName); // Use updated function name
            break;
        default:
            console.warn("Unknown action:", action);
    }
}

// --- Core Extension Actions (Single) ---

/** Toggles a single extension's enabled state. */
function toggleExtension(extensionId, enable) {
    showLoading();
    hidePopupMessage();
    chrome.management.setEnabled(extensionId, enable, () => {
        hideLoading();
        if (chrome.runtime.lastError) {
            showPopupMessage(`Error: ${chrome.runtime.lastError.message}`, 'error');
            console.error("setEnabled error:", chrome.runtime.lastError);
        } else {
            // Find the specific item and update its state visually
            const item = elements.extensionList?.querySelector(`.extension-item[data-extension-id="${extensionId}"]`);
            const button = item?.querySelector('.toggle-button');
            if (item && button) {
                // Update button state, icon, and aria attributes
                button.dataset.currentState = enable ? 'enabled' : 'disabled';
                button.innerHTML = `<img src="${enable ? ICON_PATHS.toggleOff : ICON_PATHS.toggleOn}" alt="" aria-hidden="true">`;
                button.title = `${enable ? 'Disable' : 'Enable'} ${sanitizeText(item.querySelector('.extension-name')?.textContent || '')}`;
                button.setAttribute('aria-label', button.title);
                button.setAttribute('aria-pressed', String(enable));
                // Optionally update status filter if active
                if (elements.statusFilter.value !== 'all') {
                     refreshExtensionDataAndRender(getCurrentPage()); // Full refresh if status filter active
                }
            } else {
                 refreshExtensionDataAndRender(getCurrentPage()); // Fallback to full refresh
            }
            // Update the underlying data cache
            const cachedExt = allFetchedExtensions.find(ext => ext.id === extensionId);
            if (cachedExt) cachedExt.enabled = enable;
            const filteredCachedExt = currentFilteredExtensions.find(ext => ext.id === extensionId);
             if (filteredCachedExt) filteredCachedExt.enabled = enable;
        }
    });
}

/** Opens the custom details page for an extension. */
function openDetailsPage(extensionId) {
    // --- IMPORTANT: Ensure this path is correct relative to the popup HTML file ---
    const detailsPageRelativeUrl = `src/html/details.html?id=${extensionId}`;
    // -----------------------------------------------------------------------------
    try {
         // Construct the full URL using runtime.getURL
         const fullUrl = chrome.runtime.getURL(detailsPageRelativeUrl);
         // Open in a new tab
         chrome.tabs.create({ url: fullUrl }, (tab) => {
            if (chrome.runtime.lastError) {
                 showPopupMessage(`Error opening details page: ${chrome.runtime.lastError.message}`, 'error');
                 console.error("tabs.create error:", chrome.runtime.lastError);
            }
            // Optional: Close the popup after opening the details page
            // window.close();
         });
    } catch (e) {
         showPopupMessage(`Could not construct details page URL.`, 'error');
         console.error("Error creating details URL:", e);
    }
}

/** Confirms and then triggers uninstallation of an extension. */
function confirmAndDeleteExtension(extensionId, extensionName) {
    const sanitizedName = sanitizeText(extensionName); // Sanitize name for display
    if (confirm(`Are you sure you want to uninstall "${sanitizedName}"? This action cannot be undone.`)) {
        uninstallExtension(extensionId, sanitizedName);
    }
}

/** Uninstalls the specified extension after confirmation. */
function uninstallExtension(extensionId, sanitizedName) {
    showLoading();
    hidePopupMessage();
    // Use showConfirmDialog: false because we already confirmed manually
    chrome.management.uninstall(extensionId, { showConfirmDialog: false }, () => {
        hideLoading();
        if (chrome.runtime.lastError) {
            showPopupMessage(`Error uninstalling "${sanitizedName}": ${chrome.runtime.lastError.message}`, 'error');
            console.error("uninstall error:", chrome.runtime.lastError);
        } else {
            showPopupMessage(`"${sanitizedName}" uninstalled successfully.`, 'success');
            // Remove from selection if it was selected
            selectedExtensionIds.delete(extensionId);
            // Refresh data and UI
            refreshExtensionDataAndRender(getCurrentPage());
            // Update group counts as the extension is gone
            updateGroupFilterDropdown();
            updateBulkAssignGroupDropdown();
            if (elements.groupModal?.classList.contains('visible')) {
                displayGroupManagementListInModal();
            }
        }
    });
}

// --- Bulk Actions ---

/** Updates the visibility and content of the bulk actions bar. */
function updateBulkActionsUI() {
    const count = selectedExtensionIds.size;
    if (count > 0) {
        elements.selectedCountSpan.textContent = `${count} selected`;
        elements.bulkActionsContainer.style.display = 'flex';
        // Enable/disable buttons based on selection (optional: could check if *all* selected are enabled/disabled)
        elements.bulkEnableButton.disabled = false;
        elements.bulkDisableButton.disabled = false;
        elements.bulkUninstallButton.disabled = false;
        elements.bulkAssignGroupSelect.disabled = false;
    } else {
        elements.bulkActionsContainer.style.display = 'none';
        elements.bulkAssignGroupSelect.value = ""; // Reset dropdown
    }
}

/** Updates the state of the "Select All" checkbox based on visible items. */
function updateSelectAllCheckboxState() {
    const visibleCheckboxes = elements.extensionList.querySelectorAll('.extension-select-checkbox');
    if (!visibleCheckboxes.length) {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = false;
        elements.selectAllCheckbox.disabled = true; // Disable if no items visible
        return;
    }

    elements.selectAllCheckbox.disabled = false; // Enable if items are visible
    const allVisibleSelected = Array.from(visibleCheckboxes).every(cb => cb.checked);
    const someVisibleSelected = Array.from(visibleCheckboxes).some(cb => cb.checked);

    if (allVisibleSelected) {
        elements.selectAllCheckbox.checked = true;
        elements.selectAllCheckbox.indeterminate = false;
    } else if (someVisibleSelected) {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = true;
    } else {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = false;
    }
}

/** Handles the "Select All" checkbox change event. */
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const visibleCheckboxes = elements.extensionList.querySelectorAll('.extension-select-checkbox');

    visibleCheckboxes.forEach(checkbox => {
        const extensionId = checkbox.dataset.extensionId;
        checkbox.checked = isChecked;
        const item = checkbox.closest('.extension-item');
        if (isChecked) {
            selectedExtensionIds.add(extensionId);
            item?.classList.add('selected');
        } else {
            selectedExtensionIds.delete(extensionId);
            item?.classList.remove('selected');
        }
    });

    updateBulkActionsUI();
    // No need to call updateSelectAllCheckboxState again here, it's implicitly correct
}

/** Clears the current selection state. */
function clearSelection() {
    selectedExtensionIds.clear();
    elements.extensionList.querySelectorAll('.extension-item.selected').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.extension-select-checkbox');
        if (checkbox) checkbox.checked = false;
    });
    updateBulkActionsUI();
    updateSelectAllCheckboxState();
}

/** Performs bulk enable/disable/uninstall actions. */
async function performBulkAction(action) {
    const idsToProcess = new Set(selectedExtensionIds); // Copy the set
    if (idsToProcess.size === 0) {
        showPopupMessage("No extensions selected.", "error");
        return;
    }

    let confirmMessage = "";
    let actionFn;
    let actionPastTense = "";

    switch (action) {
        case 'enable':
            actionFn = (id) => new Promise((res, rej) => chrome.management.setEnabled(id, true, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()));
            actionPastTense = "enabled";
            break;
        case 'disable':
            actionFn = (id) => new Promise((res, rej) => chrome.management.setEnabled(id, false, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()));
            actionPastTense = "disabled";
            break;
        case 'uninstall':
             confirmMessage = `Are you sure you want to uninstall ${idsToProcess.size} selected extension(s)? This cannot be undone.`;
             actionFn = (id) => new Promise((res, rej) => chrome.management.uninstall(id, { showConfirmDialog: false }, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res()));
             actionPastTense = "uninstalled";
             break;
        default:
            console.error("Unknown bulk action:", action);
            return;
    }

    // Confirm uninstall action
    if (action === 'uninstall' && !confirm(confirmMessage)) {
        return; // User cancelled
    }

    showLoading();
    hidePopupMessage();
    let successCount = 0;
    let errorCount = 0;

    const results = await Promise.allSettled(
        Array.from(idsToProcess).map(id => actionFn(id).catch(error => ({ id, error }))) // Wrap potential rejections
    );

    results.forEach(result => {
        if (result.status === 'fulfilled' && !result.value?.error) { // Check for wrapped errors too
            successCount++;
        } else {
            errorCount++;
            const errorInfo = result.reason || result.value; // Get error details
            console.error(`Error performing bulk ${action} on ${errorInfo?.id || 'unknown ID'}:`, errorInfo?.error || errorInfo);
        }
    });

    hideLoading();

    // Show summary feedback
    if (errorCount > 0) {
        showPopupMessage(`Completed with errors. ${successCount} ${actionPastTense}, ${errorCount} failed. Check console.`, 'error');
    } else {
        showPopupMessage(`Successfully ${actionPastTense} ${successCount} extension(s).`, 'success');
    }

    // Clear selection and refresh UI after action
    clearSelection();
    refreshExtensionDataAndRender(getCurrentPage());
    if (action === 'uninstall') {
        // Update group counts if uninstalling
        updateGroupFilterDropdown();
        updateBulkAssignGroupDropdown();
        if (elements.groupModal?.classList.contains('visible')) {
            displayGroupManagementListInModal();
        }
    }
}

/** Handles change event for the bulk assign group dropdown. */
function handleBulkAssignGroupChange(event) {
    const selectedGroupName = event.target.value;
    if (selectedGroupName === "") { // Ignore the placeholder "Assign to Group..."
        return;
    }
    if (selectedExtensionIds.size === 0) {
        showPopupMessage("No extensions selected to assign.", "error");
        event.target.value = ""; // Reset dropdown
        return;
    }

    assignMultipleExtensionsToGroup(selectedExtensionIds, selectedGroupName);
    // assignMultipleExtensionsToGroup handles feedback and UI refresh/clear selection
}


// --- Pagination ---

/** Gets the current page number from the UI. */
function getCurrentPage() {
    const pageNum = parseInt(elements.currentPageSpan?.textContent || '1', 10);
    // Return 1 if parsing fails or number is invalid
    return isNaN(pageNum) || pageNum < 1 ? 1 : pageNum;
}

/** Sets up pagination button listeners. */
function setupPagination() {
    elements.prevPageButton?.addEventListener('click', () => {
        if (!elements.prevPageButton.disabled) {
            renderExtensionList(getCurrentPage() - 1);
        }
    });
    elements.nextPageButton?.addEventListener('click', () => {
        if (!elements.nextPageButton.disabled) {
            renderExtensionList(getCurrentPage() + 1);
        }
    });
}

// --- Filters & Search Setup ---

/** Sets up filters and search listeners. */
function setupFiltersAndSearch() {
    // Common handler for filter changes
    const handleFilterChange = () => {
        clearSelection(); // Clear selection when filters change
        currentFilteredExtensions = filterAndSortExtensions(allFetchedExtensions);
        renderExtensionList(1); // Go back to page 1 and render
    };

    elements.typeFilter?.addEventListener('change', handleFilterChange);
    elements.statusFilter?.addEventListener('change', handleFilterChange);
    elements.groupFilter?.addEventListener('change', handleFilterChange);

    // Initial population of group dropdowns
    updateGroupFilterDropdown();
    updateBulkAssignGroupDropdown();

    // Search listener with debounce
    elements.searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(() => {
             clearSelection(); // Clear selection on search
             currentFilteredExtensions = filterAndSortExtensions(allFetchedExtensions);
             renderExtensionList(1); // Go to page 1 and render search results
        }, 300); // 300ms debounce delay
    });
}

// --- Modal Event Listeners Setup ---

/** Sets up modal event listeners. */
function setupModalEventListeners() {
    elements.groupModalTrigger?.addEventListener('click', openGroupManagementModal);
    elements.groupModalCloseButton?.addEventListener('click', closeGroupManagementModal);
    // Close modal if clicking outside the content area
    elements.groupModal?.addEventListener('click', (event) => {
        if (event.target === elements.groupModal) { // Check if click is on the overlay itself
            closeGroupManagementModal();
        }
    });
    // Add group button click
    elements.modalAddGroupButton?.addEventListener('click', () => {
        const input = elements.modalNewGroupNameInput;
        if (input?.value) {
            if (addGroup(input.value)) { // addGroup handles feedback
                input.value = ''; // Clear input on success
                input.focus(); // Keep focus for adding more
            } else {
                 input.focus(); // Keep focus on error (e.g., duplicate name)
                 input.select();
            }
        } else if (input) {
             showModalMessage("Group name cannot be empty.", 'error');
             input.focus();
        }
    });
    // Enter key press in group name input
    elements.modalNewGroupNameInput?.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission (if applicable)
            elements.modalAddGroupButton?.click(); // Trigger add button click
        }
    });
    // Event delegation for actions within the modal group list
    elements.modalGroupList?.addEventListener('click', handleModalListClick);
}

// --- Bulk Action Listeners Setup ---
function setupBulkActionListeners() {
    elements.selectAllCheckbox?.addEventListener('change', handleSelectAllChange);
    elements.bulkEnableButton?.addEventListener('click', () => performBulkAction('enable'));
    elements.bulkDisableButton?.addEventListener('click', () => performBulkAction('disable'));
    elements.bulkUninstallButton?.addEventListener('click', () => performBulkAction('uninstall'));
    elements.bulkAssignGroupSelect?.addEventListener('change', handleBulkAssignGroupChange);
}


// --- Initialization ---

/** Initializes the popup: sets up listeners and performs initial render. */
async function initializePopup() {
    console.log("NG Extension Manager Popup Initializing (v3.2)...");
    setupPagination();
    setupFiltersAndSearch(); // Includes initial group dropdown population
    setupModalEventListeners();
    setupBulkActionListeners(); // Setup listeners for bulk actions

    // Setup event delegation for the main extension list
    elements.extensionList?.addEventListener('click', handleExtensionListClick);
    // Setup delegation for individual assign group dropdown changes
    elements.extensionList?.addEventListener('change', handleAssignGroupChange);

    // Listener for potential messages from other parts of the extension (e.g., background script)
    chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'showError' && request.message) {
            showPopupMessage(request.message, 'error');
        }
        // Add other message handlers if needed
    });

    // Global keydown listener (e.g., for closing modal with Escape key)
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && elements.groupModal?.classList.contains('visible')) {
            closeGroupManagementModal();
        }
    });

    // Perform initial data fetch and render
    await refreshExtensionDataAndRender(1);

    console.log("NG Extension Manager Popup Initialized.");
}

// --- Run Initialization ---
// Use DOMContentLoaded to ensure the DOM is fully loaded before running scripts
document.addEventListener('DOMContentLoaded', initializePopup);
