/**
 * popup.js - Logic for the NG Extension Manager Popup
 */

// --- Constants ---
const EXTENSIONS_PER_PAGE = 10;
const SETTINGS_STORAGE_KEY = 'extensionManagerSettings';
const PREFERENCES_STORAGE_KEY = 'extensionManagerPreferences';
const GROUPS_STORAGE_KEY = 'extensionManagerGroups';

// --- Utility Functions ---

/**
 * Truncate text to a specified length, adding ellipsis if necessary.
 * @param {string} text - The text to truncate.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {string} - Truncated text.
 */
function truncate(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

/**
 * Sanitize HTML to prevent XSS by converting text to HTML entities.
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
function sanitizeHTML(str) {
    if (!str) return ''; // Handle null or undefined input
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// --- Loading, Error & Success Feedback ---

function showLoading() {
    document.getElementById('loading-indicator').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-indicator').style.display = 'none';
}

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'flex';
    // Optional: Hide error after a few seconds
    setTimeout(hideError, 5000);
}

function hideError() {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = '';
    errorMessage.style.display = 'none';
}

function showSuccess(message) {
    const successMessage = document.getElementById('success-message');
    successMessage.textContent = message;
    successMessage.style.display = 'inline'; // Use inline or inline-block
    // Hide message after a few seconds
    setTimeout(() => {
        successMessage.textContent = '';
        successMessage.style.display = 'none';
    }, 3000);
}


// --- LocalStorage Settings/Preferences ---

/**
 * Save general settings to localStorage.
 * @param {string} key - The key of the setting.
 * @param {*} value - The value to save.
 */
function saveSetting(key, value) {
    let settings = getSettings();
    settings[key] = value;
    try {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error("Error saving settings:", e);
        showError("Could not save settings.");
    }
}

/**
 * Get general settings from localStorage.
 * @returns {Object} - The settings object.
 */
function getSettings() {
    try {
        const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
        return settings && typeof settings === 'object' ? settings : {};
    } catch (e) {
        console.error("Error reading settings:", e);
        return {}; // Return default empty object on error
    }
}

/**
 * Save extension preferences (like sort order).
 * @param {Object} prefs - The preferences to save.
 */
function savePreferences(prefs) {
    try {
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {
        console.error("Error saving preferences:", e);
        showError("Could not save preferences.");
    }
}

/**
 * Get extension preferences from localStorage.
 * @returns {Object} - The preferences object.
 */
function getPreferences() {
    try {
        const prefs = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY));
        // Ensure sortOrder is always an array
        const defaultPrefs = { sortOrder: [] };
        if (prefs && typeof prefs === 'object') {
             if (!Array.isArray(prefs.sortOrder)) {
                 prefs.sortOrder = [];
             }
             return { ...defaultPrefs, ...prefs };
        }
        return defaultPrefs;
    } catch (e) {
        console.error("Error reading preferences:", e);
        return { sortOrder: [] }; // Return default on error
    }
}

// --- LocalStorage Group Data ---

/**
 * Get group data from localStorage.
 * @returns {Object} - An object where keys are group names and values are arrays of extension IDs.
 */
function getGroups() {
    try {
        const groups = JSON.parse(localStorage.getItem(GROUPS_STORAGE_KEY));
        // Basic validation: ensure it's an object and values are arrays
        if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
             Object.values(groups).forEach(val => {
                 if (!Array.isArray(val)) throw new Error("Invalid group structure");
             });
            return groups;
        }
    } catch (e) {
        console.error("Error reading groups from localStorage:", e);
        // If corrupted, potentially reset or notify user
    }
    // Return default empty object if not found or invalid
    return {};
}

/**
 * Save group data to localStorage.
 * @param {Object} groups - The groups object to save.
 */
function saveGroups(groups) {
    try {
        // Optional: Add validation before saving
        if (typeof groups !== 'object' || Array.isArray(groups)) {
            throw new Error("Attempted to save invalid groups format");
        }
        localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
    } catch (e) {
        console.error("Error saving groups to localStorage:", e);
        showError("Failed to save group data.");
    }
}


// --- Group Management Core Logic ---

/**
 * Adds a new group.
 * @param {string} groupName - The name of the new group.
 * @returns {boolean} - True if the group was added successfully, false otherwise.
 */
function addGroup(groupName) {
    const trimmedName = groupName.trim();
    if (!trimmedName) {
        showError("Group name cannot be empty.");
        return false;
    }
    const groups = getGroups();
    if (groups.hasOwnProperty(trimmedName)) {
        showError(`Group "${sanitizeHTML(trimmedName)}" already exists.`);
        return false;
    }
    if (trimmedName.toLowerCase() === 'all') { // Reserved keyword
        showError("'All' cannot be used as a group name.");
        return false;
    }

    groups[trimmedName] = []; // Add new group with an empty array
    saveGroups(groups);
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList(); // Update visible assignment dropdowns
    displayGroupManagementList(); // Update the management list
    showSuccess(`Group "${sanitizeHTML(trimmedName)}" added.`);
    return true;
}

/**
 * Renames an existing group.
 * @param {string} oldName - The current name of the group.
 * @param {string} newName - The desired new name for the group.
 * @returns {boolean} - True if successful, false otherwise.
 */
function renameGroup(oldName, newName) {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
        showError("New group name cannot be empty.");
        return false;
    }
    if (trimmedNewName === oldName) {
        // No change needed, maybe show subtle feedback or just return true
        return true;
    }
    const groups = getGroups();
    if (!groups.hasOwnProperty(oldName)) {
        showError(`Group "${sanitizeHTML(oldName)}" not found.`);
        return false;
    }
    if (groups.hasOwnProperty(trimmedNewName)) {
        showError(`Group name "${sanitizeHTML(trimmedNewName)}" already exists.`);
        return false;
    }
    if (trimmedNewName.toLowerCase() === 'all') {
        showError("'All' cannot be used as a group name.");
        return false;
    }

    // Perform rename
    groups[trimmedNewName] = groups[oldName]; // Copy extension list
    delete groups[oldName]; // Remove old entry
    saveGroups(groups);

    // Update UI elements
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList();
    displayGroupManagementList();
    showSuccess(`Group renamed to "${sanitizeHTML(trimmedNewName)}".`);
    return true;
}

/**
 * Deletes a group. Extensions within the group become unassigned.
 * @param {string} groupName - The name of the group to delete.
 * @returns {boolean} - True if successful, false otherwise.
 */
function deleteGroup(groupName) {
    const groups = getGroups();
    if (!groups.hasOwnProperty(groupName)) {
        showError(`Group "${sanitizeHTML(groupName)}" not found.`);
        return false;
    }

    // Confirmation dialog
    const confirmation = confirm(`Are you sure you want to delete the group "${sanitizeHTML(groupName)}"? Extensions in this group will be unassigned.`);
    if (!confirmation) {
        return false;
    }

    // Perform deletion
    delete groups[groupName];
    saveGroups(groups);

    // Update UI elements
    updateGroupFilterDropdown();
    updateAssignGroupDropdownsInList();
    displayGroupManagementList();
    showSuccess(`Group "${sanitizeHTML(groupName)}" deleted.`);
    return true;
}


/**
 * Assigns an extension to a group. Removes it from any previous group.
 * @param {string} extensionId - The ID of the extension.
 * @param {string} groupName - The name of the group to assign to (empty string or null to unassign).
 */
function assignExtensionToGroup(extensionId, groupName) {
    const groups = getGroups();
    const targetGroupName = groupName ? groupName.trim() : ""; // Handle empty/null input

    let previousGroup = null;

    // Remove extension from all existing groups first and find previous group
    Object.keys(groups).forEach(key => {
        const index = groups[key].indexOf(extensionId);
        if (index > -1) {
            previousGroup = key;
            groups[key].splice(index, 1);
        }
    });

    // Add to the target group if a valid group name is provided
    if (targetGroupName && groups.hasOwnProperty(targetGroupName)) {
        if (!groups[targetGroupName].includes(extensionId)) { // Avoid duplicates
            groups[targetGroupName].push(extensionId);
        }
    } else if (targetGroupName) {
        console.warn(`Attempted to assign extension ${extensionId} to non-existent group "${sanitizeHTML(targetGroupName)}"`);
        // Optional: Revert or show error? For now, it just gets unassigned.
    }

    saveGroups(groups);
    updateGroupFilterDropdown(); // Update counts in filter dropdown

    // Optional visual feedback
    const extensionItem = document.querySelector(`.extension-item[data-extension-id="${extensionId}"]`);
    if (extensionItem) {
        extensionItem.classList.add('item-highlight');
        setTimeout(() => extensionItem.classList.remove('item-highlight'), 1000); // Add CSS for .item-highlight
    }

    // Note: We don't need to redraw the whole list unless the *filter* depends on this change.
    // The assignment dropdown itself is updated by its own event handler.
}

// --- UI Update Functions ---

/**
 * Populates the main group filter dropdown, including extension counts.
 */
function updateGroupFilterDropdown() {
    const groupFilterSelect = document.getElementById('group-filter');
    if (!groupFilterSelect) return; // Guard against element not found

    const currentFilterValue = groupFilterSelect.value; // Preserve selection if possible
    groupFilterSelect.innerHTML = '<option value="all">All Groups</option>'; // Reset

    const groups = getGroups();
    const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })); // Case-insensitive sort

    sortedGroupNames.forEach(groupName => {
        const count = groups[groupName].length;
        const option = document.createElement('option');
        option.value = groupName;
        // Sanitize group name before displaying
        option.textContent = `${sanitizeHTML(groupName)} (${count})`;
        groupFilterSelect.appendChild(option);
    });

    // Try to restore previous selection
    if (groups.hasOwnProperty(currentFilterValue) || currentFilterValue === 'all') {
        groupFilterSelect.value = currentFilterValue;
    } else {
         groupFilterSelect.value = 'all'; // Default to 'all' if previous group was deleted/renamed
    }
}


/**
 * Populates a single assignment dropdown for an extension.
 * @param {HTMLSelectElement} selectElement - The <select> element to populate.
 * @param {string} extensionId - The ID of the extension this dropdown is for.
 */
function populateAssignGroupDropdown(selectElement, extensionId) {
    if (!selectElement) return;

    const currentValue = selectElement.value; // Preserve selection during repopulation if needed
    selectElement.innerHTML = '<option value="">No Group</option>'; // Default unassigned option

    const groups = getGroups();
    const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    let currentGroup = ""; // Track which group the extension currently belongs to

    sortedGroupNames.forEach(groupName => {
        const option = document.createElement('option');
        option.value = groupName;
        option.textContent = sanitizeHTML(groupName); // Sanitize group name
        selectElement.appendChild(option);

        // Check if this extension is in the current group being iterated
        if (groups[groupName] && groups[groupName].includes(extensionId)) {
            currentGroup = groupName;
        }
    });

    // Set the selected option
    selectElement.value = currentGroup || ""; // Fallback to "" if not in any group

    // Attach event listener (ensure it's only added once or managed correctly)
    // Remove previous listener before adding a new one to prevent duplicates if called multiple times
     selectElement.removeEventListener('change', handleAssignGroupChange);
     selectElement.addEventListener('change', handleAssignGroupChange);
}

// Named event handler for group assignment change
function handleAssignGroupChange(event) {
    const selectElement = event.target;
    const extensionId = selectElement.dataset.extensionId;
    const newGroupName = selectElement.value;
    if (extensionId) {
        assignExtensionToGroup(extensionId, newGroupName);
    } else {
        console.error("Missing extension ID on assignment dropdown:", selectElement);
    }
}

/**
 * Updates all assignment dropdowns currently visible in the extension list.
 * Useful after adding/renaming/deleting groups.
 */
function updateAssignGroupDropdownsInList() {
    const assignSelects = document.querySelectorAll('#extension-list .assign-group-select');
    assignSelects.forEach(select => {
        const extensionId = select.dataset.extensionId;
        if (extensionId) {
            populateAssignGroupDropdown(select, extensionId);
        }
    });
}

/**
 * Displays the list of groups in the management area with Rename/Delete buttons.
 */
function displayGroupManagementList() {
    const listElement = document.getElementById('group-management-list');
    if (!listElement) return;

    listElement.innerHTML = ''; // Clear current list
    const groups = getGroups();
    const sortedGroupNames = Object.keys(groups).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    if (sortedGroupNames.length === 0) {
        listElement.innerHTML = '<li>No groups created yet.</li>';
        return;
    }

    sortedGroupNames.forEach(groupName => {
        const listItem = document.createElement('li');

        const nameSpan = document.createElement('span');
        nameSpan.textContent = sanitizeHTML(groupName);

        const renameButton = document.createElement('button');
        renameButton.textContent = 'Rename';
        renameButton.classList.add('rename-group-btn', 'button-small'); // Add classes for styling
        renameButton.dataset.groupname = groupName; // Store name for handler

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('delete-group-btn', 'button-small', 'button-danger'); // Add classes for styling
        deleteButton.dataset.groupname = groupName; // Store name for handler

        listItem.appendChild(nameSpan);
        listItem.appendChild(renameButton);
        listItem.appendChild(deleteButton);
        listElement.appendChild(listItem);
    });

    // Attach event listeners (using delegation might be slightly better, but direct is ok for fewer items)
     listElement.querySelectorAll('.rename-group-btn').forEach(button => {
         button.removeEventListener('click', handleRenameGroupClick); // Prevent duplicates
         button.addEventListener('click', handleRenameGroupClick);
     });
     listElement.querySelectorAll('.delete-group-btn').forEach(button => {
         button.removeEventListener('click', handleDeleteGroupClick); // Prevent duplicates
         button.addEventListener('click', handleDeleteGroupClick);
     });
}

// Event handler for Rename button click
function handleRenameGroupClick(event) {
    const oldName = event.target.dataset.groupname;
    const newName = prompt(`Enter new name for group "${sanitizeHTML(oldName)}":`, oldName);
    if (newName !== null) { // prompt returns null if Cancel is clicked
        renameGroup(oldName, newName.trim());
    }
}

// Event handler for Delete button click
function handleDeleteGroupClick(event) {
    const groupName = event.target.dataset.groupname;
    deleteGroup(groupName);
}


/**
 * Toggles the visibility of the group management list container.
 */
function toggleGroupManagementListVisibility() {
     const container = document.getElementById('group-management-list-container');
     const button = document.getElementById('manage-groups-toggle-button');
     if (!container || !button) return;

     const isVisible = container.style.display !== 'none';
     if (isVisible) {
         container.style.display = 'none';
         button.textContent = 'Manage Groups';
         button.setAttribute('aria-expanded', 'false');
     } else {
         displayGroupManagementList(); // Refresh list content when showing
         container.style.display = 'block'; // Or 'flex' depending on layout
         button.textContent = 'Hide Groups';
         button.setAttribute('aria-expanded', 'true');
     }
}


// --- Extension List Display & Actions ---

/**
 * Display all installed extensions with pagination and filters.
 * @param {number} [page=1] - The page number to display.
 */
function displayExtensions(page = 1) {
    showLoading();
    hideError(); // Clear previous errors

    chrome.management.getAll(function(extensions) {
        if (chrome.runtime.lastError) {
            hideLoading();
            showError(`Error fetching extensions: ${chrome.runtime.lastError.message}`);
            console.error("chrome.management.getAll error:", chrome.runtime.lastError);
            return;
        }

        const extensionList = document.getElementById('extension-list');
        if (!extensionList) return; // Guard
        extensionList.innerHTML = ''; // Clear previous list

        const preferences = getPreferences();
        const sortOrder = preferences.sortOrder;

        // 1. Sort extensions based on saved sortOrder (if any)
        if (sortOrder.length > 0) {
            // Create a map for faster lookup
            const orderMap = new Map(sortOrder.map((id, index) => [id, index]));
            extensions.sort((a, b) => {
                const indexA = orderMap.get(a.id);
                const indexB = orderMap.get(b.id);
                if (indexA === undefined && indexB === undefined) return 0; // Both not in order, maintain relative
                if (indexA === undefined) return 1; // a is not in order, put it after
                if (indexB === undefined) return -1; // b is not in order, put it after
                return indexA - indexB; // Both are in order, sort by index
            });
        }
        // Optional: Add secondary sort (e.g., by name) for items not in sortOrder or if sortOrder is empty
        // else { extensions.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })); }


        // 2. Apply Filters (Type, Status, Group, Search)
        const typeFilter = document.getElementById('type-filter')?.value || 'all';
        const statusFilter = document.getElementById('status-filter')?.value || 'all';
        const groupFilter = document.getElementById('group-filter')?.value || 'all';
        const searchTerm = document.getElementById('search-input')?.value.toLowerCase() || '';
        const groups = getGroups();

        const filteredExtensions = extensions.filter(ext => {
            // Type Filter
            if (typeFilter !== 'all') {
                if (typeFilter === 'extension' && (ext.isApp || ext.isTheme)) return false;
                if (typeFilter === 'theme' && !ext.isTheme) return false;
                if (typeFilter === 'app' && !ext.isApp) return false;
            }
            // Status Filter
            if (statusFilter !== 'all') {
                if (statusFilter === 'enabled' && !ext.enabled) return false;
                if (statusFilter === 'disabled' && ext.enabled) return false;
            }
            // Group Filter
            if (groupFilter !== 'all') {
                const extensionsInGroup = groups[groupFilter] || [];
                if (!extensionsInGroup.includes(ext.id)) return false;
            }
            // Search Filter (Name) - Could expand to description later
            if (searchTerm && !ext.name.toLowerCase().includes(searchTerm)) {
                return false;
            }
            // Passed all filters
            return true;
        });


        // 3. Pagination
        const totalExtensions = filteredExtensions.length;
        const totalPages = Math.ceil(totalExtensions / EXTENSIONS_PER_PAGE) || 1; // Ensure totalPages is at least 1
        const currentPage = Math.min(Math.max(page, 1), totalPages); // Clamp page number
        const startIndex = (currentPage - 1) * EXTENSIONS_PER_PAGE;
        const endIndex = startIndex + EXTENSIONS_PER_PAGE;
        const extensionsToDisplay = filteredExtensions.slice(startIndex, endIndex);


        // 4. Update Pagination Controls
        document.getElementById('current-page').textContent = currentPage;
        document.getElementById('total-pages').textContent = totalPages;
        document.getElementById('prev-page').disabled = currentPage === 1;
        document.getElementById('next-page').disabled = currentPage === totalPages;


        // 5. Render Extension Items
        const fragment = document.createDocumentFragment();
        if (extensionsToDisplay.length > 0) {
            extensionsToDisplay.forEach(extension => {
                const extensionItem = document.createElement('div');
                extensionItem.classList.add('extension-item');
                extensionItem.dataset.extensionId = extension.id; // Store ID for actions

                // Icon
                const icon = document.createElement('img');
                const iconUrl = (extension.icons && extension.icons.length > 0)
                    ? extension.icons.sort((a, b) => b.size - a.size)[0].url
                    : 'icons/128x128.png'; // Default icon
                icon.src = iconUrl;
                icon.alt = `${extension.name} icon`; // Alt text
                icon.classList.add('extension-icon');
                icon.onerror = () => { icon.src = 'icons/128x128.png'; }; // Fallback on error

                // Details (Name)
                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('extension-details');
                const nameSpan = document.createElement('span');
                nameSpan.classList.add('extension-name');
                nameSpan.textContent = sanitizeHTML(extension.name); // Use full name, rely on CSS ellipsis
                nameSpan.title = sanitizeHTML(extension.name); // Tooltip for full name
                detailsDiv.appendChild(nameSpan);

                // Actions
                const actions = document.createElement('div');
                actions.classList.add('extension-actions');

                // Enable/Disable Button
                const toggleButton = document.createElement('button');
                toggleButton.textContent = extension.enabled ? 'Disable' : 'Enable';
                toggleButton.classList.add('toggle-button', 'button-small');
                toggleButton.setAttribute('aria-label', `${extension.enabled ? 'Disable' : 'Enable'} ${extension.name}`);
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering other clicks if nested
                    toggleExtension(extension.id, !extension.enabled);
                });

                // Details Button
                const detailsButton = document.createElement('button');
                detailsButton.textContent = 'Details';
                detailsButton.classList.add('details-button', 'button-small');
                detailsButton.setAttribute('aria-label', `View Details for ${extension.name}`);
                detailsButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openDetails(extension.id);
                });

                // Delete Button
                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.classList.add('delete-button', 'button-small', 'button-danger');
                deleteButton.setAttribute('aria-label', `Delete ${extension.name}`);
                deleteButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    confirmDeletion(extension.id, extension.name);
                });

                // Assign to Group Dropdown
                const assignGroupSelect = document.createElement('select');
                assignGroupSelect.classList.add('assign-group-select');
                assignGroupSelect.dataset.extensionId = extension.id;
                assignGroupSelect.setAttribute('aria-label', `Assign ${extension.name} to Group`);
                populateAssignGroupDropdown(assignGroupSelect, extension.id); // Populate options and set current value

                // Append elements
                actions.appendChild(toggleButton);
                actions.appendChild(detailsButton);
                actions.appendChild(deleteButton);
                actions.appendChild(assignGroupSelect);

                extensionItem.appendChild(icon);
                extensionItem.appendChild(detailsDiv);
                extensionItem.appendChild(actions);

                fragment.appendChild(extensionItem);
            });
        } else {
            // Display "No Extensions Found" message
            const noExtensionsMessage = document.createElement('p');
            noExtensionsMessage.textContent = 'No extensions match the current filters.';
            noExtensionsMessage.classList.add('no-extensions-message');
            fragment.appendChild(noExtensionsMessage);
        }

        // Append fragment to the list
        extensionList.appendChild(fragment);

        hideLoading();
    }); // End chrome.management.getAll callback
}


/**
 * Toggle an extension's enabled status.
 * @param {string} extensionId - The ID of the extension to toggle.
 * @param {boolean} enable - Whether to enable or disable the extension.
 */
function toggleExtension(extensionId, enable) {
    showLoading();
    hideError();
    chrome.management.setEnabled(extensionId, enable, function() {
        hideLoading();
        if (chrome.runtime.lastError) {
            showError(`Error toggling extension: ${chrome.runtime.lastError.message}`);
            console.error("setEnabled error:", chrome.runtime.lastError);
        } else {
            showSuccess(`Extension ${enable ? 'enabled' : 'disabled'}.`);
            // Refresh the current view to reflect the change
            displayExtensions(getCurrentPage());
        }
    });
}

/**
 * Open extension details (uses internal details page).
 * @param {string} extensionId - The ID of the extension.
 */
function openDetails(extensionId) {
    const url = `../src/html/details.html?id=${extensionId}`;
    chrome.tabs.create({ url: url }, function(tab) {
        if (chrome.runtime.lastError) {
            showError(`Error opening details: ${chrome.runtime.lastError.message}`);
            console.error("tabs.create error:", chrome.runtime.lastError);
        }
    });
}


/**
 * Confirm and delete (uninstall) an extension.
 * @param {string} extensionId - The ID of the extension to delete.
 * @param {string} extensionName - The name of the extension.
 */
function confirmDeletion(extensionId, extensionName) {
    const confirmation = confirm(`Are you sure you want to delete the extension "${sanitizeHTML(extensionName)}"? This cannot be undone.`);
    if (confirmation) {
        showLoading();
        hideError();
        // We use uninstall, showConfirmDialog: false prevents Chrome's default dialog
        // but we already showed our own confirm().
        chrome.management.uninstall(extensionId, { showConfirmDialog: false }, function() {
            hideLoading();
            if (chrome.runtime.lastError) {
                showError(`Error deleting extension: ${chrome.runtime.lastError.message}`);
                 console.error("uninstall error:", chrome.runtime.lastError);
            } else {
                showSuccess(`Extension "${sanitizeHTML(extensionName)}" deleted.`);
                // Extensions might be removed from groups automatically? Re-check group data if needed.
                // Refresh the list, potentially staying on the current page or going to page 1
                displayExtensions(getCurrentPage());
                // Optionally update group counts if deletion impacts them significantly
                 updateGroupFilterDropdown();
            }
        });
    }
}

/**
 * Toggle all non-app/theme extensions between enabled and disabled.
 * Consider adding options: toggle only visible, toggle only in group.
 */
function toggleAllExtensions() {
    showLoading();
    hideError();
    chrome.management.getAll(function(extensions) {
        if (chrome.runtime.lastError) {
            hideLoading();
            showError(`Error fetching extensions: ${chrome.runtime.lastError.message}`);
            return;
        }

        // Filter for actual extensions (not apps or themes)
        const actualExtensions = extensions.filter(ext => !ext.isApp && !ext.isTheme);
        if (actualExtensions.length === 0) {
             hideLoading();
             showError("No extensions to toggle.");
             return;
        }

        // Determine target state: enable if *any* are disabled, otherwise disable all.
        const shouldEnable = actualExtensions.some(ext => !ext.enabled);

        let completed = 0;
        const totalToToggle = actualExtensions.length;
        let errorsOccurred = false;

        actualExtensions.forEach(function(extension) {
            // Only toggle if the state needs changing
            if (extension.enabled !== shouldEnable) {
                chrome.management.setEnabled(extension.id, shouldEnable, function() {
                    completed++;
                    if (chrome.runtime.lastError) {
                        errorsOccurred = true;
                        console.error(`Failed to toggle ${extension.name}: ${chrome.runtime.lastError.message}`);
                    }
                    // Check if all operations are done
                    if (completed === totalToToggle) {
                        hideLoading();
                        if (errorsOccurred) {
                            showError("Some extensions could not be toggled. Check console.");
                        } else {
                             showSuccess(`All extensions ${shouldEnable ? 'enabled' : 'disabled'}.`);
                        }
                        displayExtensions(getCurrentPage()); // Refresh view
                    }
                });
            } else {
                 // If state already matches target, count it as completed
                 completed++;
                 if (completed === totalToToggle) {
                     hideLoading();
                     if (errorsOccurred) {
                         showError("Some extensions could not be toggled. Check console.");
                     } else {
                          showSuccess(`All extensions already ${shouldEnable ? 'enabled' : 'disabled'}.`); // Or different message
                     }
                     displayExtensions(getCurrentPage()); // Refresh view
                 }
            }
        });
    });
}


// --- Pagination ---

/**
 * Get the current page number from the pagination display.
 * @returns {number} - The current page number.
 */
function getCurrentPage() {
    const currentPageElement = document.getElementById('current-page');
    const currentPage = parseInt(currentPageElement?.textContent || '1', 10);
    return isNaN(currentPage) || currentPage < 1 ? 1 : currentPage;
}

/**
 * Sets up event listeners for pagination buttons.
 */
function setupPagination() {
    const prevButton = document.getElementById('prev-page');
    const nextButton = document.getElementById('next-page');

    if (prevButton) {
        prevButton.addEventListener('click', function() {
            if (!this.disabled) {
                displayExtensions(getCurrentPage() - 1);
            }
        });
    }
     if (nextButton) {
         nextButton.addEventListener('click', function() {
             if (!this.disabled) {
                 displayExtensions(getCurrentPage() + 1);
             }
         });
     }
}

// --- Filters & Search ---

/**
 * Initialize filter dropdowns and attach event listeners.
 */
function setupFilters() {
    const typeFilter = document.getElementById('type-filter');
    const statusFilter = document.getElementById('status-filter');
    const groupFilter = document.getElementById('group-filter');

    const handleFilterChange = () => displayExtensions(1); // Reset to page 1 on filter change

    if (typeFilter) typeFilter.addEventListener('change', handleFilterChange);
    if (statusFilter) statusFilter.addEventListener('change', handleFilterChange);
    if (groupFilter) groupFilter.addEventListener('change', handleFilterChange);

    // Populate the group filter initially
    updateGroupFilterDropdown();
}

/**
 * Initialize search functionality with debounce.
 */
function setupSearch() {
    const searchInput = document.getElementById('search-input');
    if (!searchInput) return;

    let debounceTimeout;
    searchInput.addEventListener('input', function() {
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(function() {
            displayExtensions(1); // Reset to page 1 on search
        }, 300); // 300ms debounce time
    });
}

// --- Initialization ---

/**
 * Initialize the popup by setting up event listeners and displaying extensions.
 */
function initializePopup() {
    setupPagination();
    setupFilters();
    setupSearch();

    // Add Group Listener
    const addGroupButton = document.getElementById('add-group-button');
    const newGroupNameInput = document.getElementById('new-group-name');
    if (addGroupButton && newGroupNameInput) {
        addGroupButton.addEventListener('click', () => {
            if (addGroup(newGroupNameInput.value)) {
                newGroupNameInput.value = ''; // Clear input on success
            }
        });
        // Allow adding group by pressing Enter in the input field
        newGroupNameInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent potential form submission
                addGroupButton.click(); // Trigger the button click
            }
        });
    }

     // Manage Groups Toggle Listener
     const manageGroupsButton = document.getElementById('manage-groups-toggle-button');
     if (manageGroupsButton) {
         manageGroupsButton.addEventListener('click', toggleGroupManagementListVisibility);
     }


    // Initial display of extensions
    displayExtensions(1);

    // Initial display of group management list (it starts hidden)
    // displayGroupManagementList(); // No need to call here, called when toggled visible

    // Add listener for global updates if needed (e.g., from background script)
    // chrome.runtime.onMessage.addListener(...)
}

// --- Global Listeners ---

// Listener for messages (e.g., errors from other parts of the extension)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'error' && request.message) {
        showError(request.message);
        return true; // Indicate async response possibility if needed
    }
    // Handle other message types if necessary
});

// --- Run Initialization ---
document.addEventListener('DOMContentLoaded', initializePopup);
