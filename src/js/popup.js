/**
 * popup.js - Logic for the Popup (v4.4)
 *
 * Key Enhancements from v4.3:
 * - Replaced all text-based confirmation prompts with standard `confirm()` dialogs for improved UX.
 * - Removed the restriction that prevented assigning keyboard shortcuts to profiles created from the current state.
 * - Fixed an issue where the "Clear Filter" button could appear incorrectly or duplicate.
 * - Added a suite of new keyboard shortcuts for common actions (opening modals, pagination, etc.).
 * - General performance and logic enhancements for a smoother experience.
 * - MODIFICATION: Refactored data storage to use chrome.storage.local instead of localStorage for cross-script consistency.
 * - SECURITY REFACTOR: Eliminated all usage of `innerHTML` to prevent potential XSS vulnerabilities. DOM elements are now created and appended programmatically.
 */

// --- Constants ---
const EXTENSIONS_PER_PAGE = 12;
const PREFERENCES_STORAGE_KEY = 'extensionManagerPreferences_v4';
const GROUPS_STORAGE_KEY = 'extensionManagerGroups_v4'; // Incremented for shortcutAction
const PROFILES_STORAGE_KEY = 'extensionManagerProfiles_v2';
const DEFAULT_ICON_PLACEHOLDER = '../../public/icons/svg/updatelogo.svg';
const ACTION_FEEDBACK_DURATION = 2500;
const ITEM_FEEDBACK_HIGHLIGHT_DURATION = 800;
const PROFILE_TYPE_CURRENT_STATE = 'current_state';
const SHORTCUT_MODIFIER_KEYS = ['Ctrl', 'Alt', 'Shift'];
const VALID_SHORTCUT_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


// --- ICON PATHS ---
const ICON_PATHS = {
    toggleOn: '../../public/icons/svg/power.svg',
    toggleOff: '../../public/icons/svg/power.svg',
    details: '../../public/icons/svg/info.svg',
    delete: '../../public/icons/svg/trash.svg',
    addGroup: '../../public/icons/svg/plus.svg',
    deleteGroup: '../../public/icons/svg/trash.svg',
    enableGroup: '../../public/icons/svg/power.svg',
    disableGroup: '../../public/icons/svg/power.svg',
    prevPage: '../../public/icons/svg/arrow-left.svg',
    nextPage: '../../public/icons/svg/arrow-right.svg',
    profiles: '../../public/icons/svg/layers.svg',
    addProfile: '../../public/icons/svg/plus.svg',
    deleteProfile: '../../public/icons/svg/trash.svg',
    applyProfile: '../../public/icons/svg/check.svg',
    configure: '../../public/icons/svg/settings.svg',
    saveConfig: '../../public/icons/svg/save.svg',
    backToList: '../../public/icons/svg/arrow-left.svg',
    successTick: '../../public/icons/svg/check-circle.svg',
    infoCircle: '../../public/icons/svg/info-circle.svg',
    duplicate: '../../public/icons/svg/copy.svg',
    current: '../../public/icons/svg/current.svg',
    ungroup: '../../public/icons/svg/ungroup.svg',
    shortcut: '../../public/icons/svg/keyboard.svg',
    chat: '../../public/icons/svg/chat.svg', // New icon
    bug: '../../public/icons/svg/error.svg', // New icon
    documentation: '../../public/icons/svg/help.svg', // New icon
    feedback: '../../public/icons/svg/feedback.svg', // New icon
    donate: '../../public/icons/svg/support.svg' // New icon
};
// ------------------------------------------------------------------------------------

// --- DOM Elements Cache ---
const elements = {
    // Main UI
    loadingIndicator: document.getElementById('loading-indicator'),
    errorMessage: document.getElementById('error-message'),
    successMessage: document.getElementById('success-message'),
    actionFeedbackMessage: document.getElementById('action-feedback'),
    extensionList: document.getElementById('extension-list'),
    extensionListHeader: document.getElementById('extension-list-header'),
    emptyStateMessageContainer: document.getElementById('empty-state-message'),
    searchInput: document.getElementById('search-input'),
    typeFilter: document.getElementById('type-filter'),
    statusFilter: document.getElementById('status-filter'),
    groupFilter: document.getElementById('group-filter'),
    filtersRow: document.getElementById('filters'),
    currentPageSpan: document.getElementById('current-page'),
    totalPagesSpan: document.getElementById('total-pages'),
    prevPageButton: document.getElementById('prev-page'),
    nextPageButton: document.getElementById('next-page'),
    paginationContainer: document.getElementById('pagination-container'),
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
    modalGroupListSection: document.getElementById('modal-group-list-section'),
    modalSuccessMessage: document.getElementById('modal-success-message'),
    modalErrorMessage: document.getElementById('modal-error-message'),
    ungroupAllButton: document.getElementById('ungroup-all-button'),

    // Group Configuration View Elements
    groupConfigurationModal: document.getElementById('group-configuration-modal'),
    groupConfigTitle: document.getElementById('group-config-title'),
    groupConfigNameInput: document.getElementById('group-config-name-input'),
    groupConfigShortcutInput: document.getElementById('group-config-shortcut-input'),
    groupConfigActionSelect: document.getElementById('group-config-action-select'),
    groupConfigExtensionList: document.getElementById('group-config-extension-list'),
    saveGroupConfigBtn: document.getElementById('save-group-config-btn'),
    backToGroupsBtn: document.getElementById('back-to-groups-btn'),
    modalGroupConfigSuccessMessage: document.getElementById('modal-group-config-success-message'),
    modalGroupConfigErrorMessage: document.getElementById('modal-group-config-error-message'),

    // Profiles Modal
    profilesModal: document.getElementById('profiles-modal'),
    profilesModalTrigger: document.getElementById('profiles-modal-trigger'),
    profilesModalCloseButton: document.querySelector('#profiles-modal .modal-close-button'),
    modalNewProfileNameInput: document.getElementById('modal-new-profile-name'),
    modalAddProfileButton: document.getElementById('modal-add-profile-button'),
    createFromCurrentStateButton: document.getElementById('create-from-current-state-button'),
    modalProfileListSection: document.getElementById('modal-profile-list-section'),
    modalProfileList: document.getElementById('modal-profile-management-list'),
    modalProfileCreationSection: document.getElementById('modal-profile-creation'),
    modalProfilesSuccessMessage: document.getElementById('modal-profiles-success-message'),
    modalProfilesErrorMessage: document.getElementById('modal-profiles-error-message'),

    // Profile Configuration View Elements
    profileConfigurationView: document.getElementById('modal-profile-configuration-view'),
    profileConfigurationTitle: document.getElementById('profile-config-title'),
    profileConfigNameInput: document.getElementById('profile-config-name-input'),
    profileConfigShortcutInput: document.getElementById('profile-config-shortcut-input'),
    profileConfigShortcutMessage: document.getElementById('profile-config-shortcut-message'),
    profileConfigurationExtensionList: document.getElementById('profile-config-extension-list'),
    profileConfigurationActionsBar: document.getElementById('profile-config-actions-bar'),
    saveProfileConfigBtn: document.getElementById('save-profile-config-btn'),
    backToProfilesBtn: document.getElementById('back-to-profiles-btn'),

    // Help Modal
    helpModal: document.getElementById('help-modal'),
    helpModalTrigger: document.getElementById('help-modal-trigger'),
    helpModalCloseButton: document.querySelector('#help-modal .modal-close-button'),
};


// --- State ---
let searchDebounceTimeout;
let allFetchedExtensions = [];
let currentFilteredExtensions = [];
let selectedExtensionIds = new Set();
let selectedGroupNames = new Set();
let selectedProfileIds = new Set();
let ephemeralFeedbackTimeout;
let currentConfiguringProfileId = null;
let currentConfiguringGroupName = null;

const activeShortcutHandlers = new Map();


// --- Utility Functions ---
function sanitizeText(str) {
    if (str === null || typeof str === 'undefined') return '';
    const temp = document.createElement('div');
    temp.textContent = String(str);
    return temp.textContent;
}

function highlightSearchTerms(text, searchTerms) {
    const sanitizedText = sanitizeText(text);
    if (!searchTerms || searchTerms.length === 0 || !text) {
        return document.createTextNode(sanitizedText);
    }
    const validSearchTerms = searchTerms
        .map(term => term.trim())
        .filter(Boolean)
        .map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (validSearchTerms.length === 0) {
        return document.createTextNode(sanitizedText);
    }

    try {
        const regex = new RegExp(`(${validSearchTerms.join('|')})`, 'gi');
        const parts = sanitizedText.split(regex);
        const fragment = document.createDocumentFragment();

        parts.forEach(part => {
            if (regex.test(part) && validSearchTerms.some(term => part.toLowerCase() === term.toLowerCase())) {
                const span = document.createElement('span');
                span.className = 'search-highlight';
                span.textContent = part;
                fragment.appendChild(span);
            } else if (part) {
                fragment.appendChild(document.createTextNode(part));
            }
        });
        return fragment;
    } catch (e) {
        console.error("Highlight regex error:", e);
        return document.createTextNode(sanitizedText);
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

function showFeedbackMessage(message, type = 'error', location = 'popup', isEphemeral = false) {
    let targetElement, otherElement;

    if (location === 'modal') {
        targetElement = type === 'error' ? elements.modalErrorMessage : elements.modalSuccessMessage;
        otherElement = type === 'error' ? elements.modalSuccessMessage : elements.modalErrorMessage;
    } else if (location === 'profiles-modal') {
        targetElement = type === 'error' ? elements.modalProfilesErrorMessage : elements.modalProfilesSuccessMessage;
        otherElement = type === 'error' ? elements.modalProfilesSuccessMessage : elements.modalProfilesErrorMessage;
    } else if (location === 'group-config-modal') {
        targetElement = type === 'error' ? elements.modalGroupConfigErrorMessage : elements.modalGroupConfigSuccessMessage;
        otherElement = type === 'error' ? elements.modalGroupConfigSuccessMessage : elements.modalGroupConfigErrorMessage;
    } else if (location === 'profile-config-shortcut') {
        targetElement = elements.profileConfigShortcutMessage;
        otherElement = null;
        if (targetElement) {
            targetElement.className = 'feedback-message modal-feedback';
            if (type === 'success') targetElement.classList.add('success-message');
            else if (type === 'error') targetElement.classList.add('error-message');
            else targetElement.classList.add('info-message');
        }
    }
    else if (location === 'action') {
        targetElement = elements.actionFeedbackMessage;
        otherElement = null;
        if (targetElement) {
            targetElement.className = 'feedback-message action-feedback';
            if (type === 'success') targetElement.classList.add('success-message');
            else if (type === 'error') targetElement.classList.add('error-message');
        }
    }
    else { // Default to 'popup'
        targetElement = type === 'error' ? elements.errorMessage : elements.successMessage;
        otherElement = type === 'error' ? elements.successMessage : elements.errorMessage;
    }

    if (!targetElement) return;

    targetElement.textContent = message; // Use textContent instead of innerHTML
    targetElement.style.display = 'flex';
    targetElement.setAttribute('aria-hidden', 'false');
    if (otherElement) {
        otherElement.style.display = 'none';
        otherElement.setAttribute('aria-hidden', 'true');
    }

    clearTimeout(ephemeralFeedbackTimeout);

    const duration = (isEphemeral || location === 'action')
        ? ACTION_FEEDBACK_DURATION
        : (type === 'error' ? 6000 : 4000);

    ephemeralFeedbackTimeout = setTimeout(() => hideFeedbackMessage(type, location), duration);
}


function hideFeedbackMessage(type = 'both', location = 'popup') {
    let errorEl, successEl, actionEl, profileShortcutEl;
    if (location === 'modal') {
        errorEl = elements.modalErrorMessage; successEl = elements.modalSuccessMessage;
    } else if (location === 'profiles-modal') {
        errorEl = elements.modalProfilesErrorMessage; successEl = elements.modalProfilesSuccessMessage;
    } else if (location === 'group-config-modal') {
        errorEl = elements.modalGroupConfigErrorMessage; successEl = elements.modalGroupConfigSuccessMessage;
    } else if (location === 'profile-config-shortcut') {
        profileShortcutEl = elements.profileConfigShortcutMessage;
    } else if (location === 'action') {
        actionEl = elements.actionFeedbackMessage;
    } else { // popup
        errorEl = elements.errorMessage; successEl = elements.successMessage;
    }

    if (actionEl && (type === 'info' || type === 'success' || type === 'error' || type === 'both')) {
        actionEl.textContent = ''; actionEl.style.display = 'none'; actionEl.setAttribute('aria-hidden', 'true');
    }
    if ((type === 'error' || type === 'both') && errorEl) {
        errorEl.textContent = ''; errorEl.style.display = 'none'; errorEl.setAttribute('aria-hidden', 'true');
    }
    if ((type === 'success' || type === 'both') && successEl) {
        successEl.textContent = ''; successEl.style.display = 'none'; successEl.setAttribute('aria-hidden', 'true');
    }
    if (profileShortcutEl) {
        profileShortcutEl.textContent = ''; profileShortcutEl.style.display = 'none'; profileShortcutEl.setAttribute('aria-hidden', 'true');
    }
}

const showPopupMessage = (msg, type, isEphemeral = false) => showFeedbackMessage(msg, type, 'popup', isEphemeral);
const hidePopupMessage = (type) => hideFeedbackMessage(type, 'popup');
const showActionFeedback = (msg, type = 'info') => showFeedbackMessage(msg, type, 'action', true);
const showModalMessage = (msg, type, isEphemeral = true) => showFeedbackMessage(msg, type, 'modal', isEphemeral);
const hideModalMessage = (type) => hideFeedbackMessage(type, 'modal');
const showProfilesModalMessage = (msg, type, isEphemeral = true) => showFeedbackMessage(msg, type, 'profiles-modal', isEphemeral);
const hideProfilesModalMessage = (type) => hideFeedbackMessage(type, 'profiles-modal');
const showGroupConfigMessage = (msg, type, isEphemeral = true) => showFeedbackMessage(msg, type, 'group-config-modal', isEphemeral);
const hideGroupConfigMessage = (type) => hideFeedbackMessage(type, 'group-config-modal');
const showProfileConfigShortcutMessage = (msg, type, isEphemeral = true) => showFeedbackMessage(msg, type, 'profile-config-shortcut', isEphemeral);


// --- Preferences (Includes Filters & Orderings) ---
function getPreferences() {
    const defaultPrefs = {
        groupOrder: [],
        profileOrder: [],
        extensionOrder: [],
        filters: {
            searchQuery: '',
            type: 'all',
            status: 'all',
            group: 'all',
        }
    };
    try {
        const prefsString = localStorage.getItem(PREFERENCES_STORAGE_KEY);
        if (!prefsString) return defaultPrefs;
        const parsed = JSON.parse(prefsString);
        const prefs = {
            ...defaultPrefs,
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
            filters: {
                ...defaultPrefs.filters,
                ...(parsed?.filters && typeof parsed.filters === 'object' ? parsed.filters : {})
            }
        };
        ['groupOrder', 'profileOrder', 'extensionOrder'].forEach(key => {
            if (!Array.isArray(prefs[key]) || prefs[key].some(item => typeof item !== 'string')) {
                prefs[key] = defaultPrefs[key];
            }
        });
        return prefs;
    } catch (e) {
        console.error("Error reading preferences:", e);
        localStorage.removeItem(PREFERENCES_STORAGE_KEY);
        return defaultPrefs;
    }
}

function savePreferences(prefs) {
    try {
        if (!prefs || typeof prefs !== 'object' || typeof prefs.filters !== 'object' ||
            !Array.isArray(prefs.groupOrder) ||
            !Array.isArray(prefs.profileOrder) ||
            !Array.isArray(prefs.extensionOrder)) {
            throw new Error("Invalid preferences object structure.");
        }
        const validFilterKeys = ['searchQuery', 'type', 'status', 'group'];
        const sanitizedFilters = {};
        validFilterKeys.forEach(key => {
            sanitizedFilters[key] = prefs.filters.hasOwnProperty(key) ? prefs.filters[key] : (key === 'searchQuery' ? '' : 'all');
        });

        const prefsToSave = {
            groupOrder: prefs.groupOrder,
            profileOrder: prefs.profileOrder,
            extensionOrder: prefs.extensionOrder,
            filters: sanitizedFilters
        };
        localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefsToSave));
    } catch (e) {
        console.error("Error saving preferences:", e);
        showPopupMessage("Could not save preferences.", 'error');
    }
}

function saveCurrentFilters() {
    const prefs = getPreferences();
    prefs.filters.searchQuery = elements.searchInput?.value || '';
    prefs.filters.type = elements.typeFilter?.value || 'all';
    prefs.filters.status = elements.statusFilter?.value || 'all';
    prefs.filters.group = elements.groupFilter?.value || 'all';
    savePreferences(prefs);
}

function applySavedFilters() {
    const prefsFilters = getPreferences().filters;
    if (elements.searchInput) elements.searchInput.value = prefsFilters.searchQuery;
    if (elements.typeFilter) elements.typeFilter.value = prefsFilters.type;
    if (elements.statusFilter) elements.statusFilter.value = prefsFilters.status;
    if (elements.groupFilter) {
      if (Array.from(elements.groupFilter.options).some(opt => opt.value === prefsFilters.group)) {
        elements.groupFilter.value = prefsFilters.group;
      } else {
        elements.groupFilter.value = 'all';
      }
    }
}

function saveOrderPreference(key, orderArray) {
    if (!['groupOrder', 'profileOrder', 'extensionOrder'].includes(key) || !Array.isArray(orderArray)) return;
    const prefs = getPreferences();
    prefs[key] = orderArray;
    savePreferences(prefs);
}


// --- Chrome Storage Group Data ---
async function getGroups() {
    try {
        const data = await chrome.storage.local.get(GROUPS_STORAGE_KEY);
        const groups = data[GROUPS_STORAGE_KEY];
        if (!groups) return {};
        if (groups && typeof groups === 'object' && !Array.isArray(groups)) {
             Object.values(groups).forEach(groupData => {
                 if (Array.isArray(groupData)) { // Legacy format check
                    // This case should ideally not happen with schema versioning, but defensive coding helps.
                 } else {
                    if (typeof groupData.name === 'undefined') groupData.name = 'Unnamed Group'; // Ensure name property exists
                    if (!Array.isArray(groupData.members)) groupData.members = [];
                    if (typeof groupData.shortcut === 'undefined') groupData.shortcut = null;
                    if (typeof groupData.shortcutAction === 'undefined') groupData.shortcutAction = 'toggle';
                 }
             });
             return groups;
        } else {
            console.warn("Invalid groups format found in storage. Resetting.");
            await chrome.storage.local.remove(GROUPS_STORAGE_KEY);
            return {};
        }
    } catch (e) {
        console.error("Error reading groups from chrome.storage:", e);
        return {};
    }
}
async function saveGroups(groups) {
    try {
        if (typeof groups !== 'object' || Array.isArray(groups)) throw new Error("Invalid groups format.");
        await chrome.storage.local.set({ [GROUPS_STORAGE_KEY]: groups });
    }
    catch (e) {
        console.error("Error saving groups to chrome.storage:", e);
        const message = "Failed to save group data.";
        if (elements.groupModal?.classList.contains('visible')) showModalMessage(message, 'error');
        else showPopupMessage(message, 'error');
    }
}

// --- Group Management Core Logic ---
async function addGroup(groupName) {
    hideModalMessage();
    const trimmedName = groupName.trim();
    if (!trimmedName) {
        showModalMessage("Group name cannot be empty.", 'error');
        return false;
    }
    const groups = await getGroups();
    // Check if the actual group name (stored as 'name' property) exists
    if (Object.values(groups).some(group => group.name.toLowerCase() === trimmedName.toLowerCase())) {
        showModalMessage(`Group "${sanitizeText(trimmedName)}" already exists.`, 'error');
        return false;
    }
    if (trimmedName.toLowerCase() === 'all' || trimmedName.toLowerCase() === 'no group' || trimmedName === '--remove--') {
        showModalMessage(`"${sanitizeText(trimmedName)}" is a reserved name.`, 'error');
        return false;
    }
    // Use the trimmedName as the key, and store the name inside the object as well
    groups[trimmedName] = { name: trimmedName, members: [], shortcut: null, shortcutAction: 'toggle' }; // Initialize with new schema
    await saveGroups(groups);
    const prefs = getPreferences();
    if (!prefs.groupOrder.includes(trimmedName)) {
        prefs.groupOrder.push(trimmedName);
        saveOrderPreference('groupOrder', prefs.groupOrder);
    }
    await updateGroupFilterDropdown();
    await updateAssignGroupDropdownsInList();
    await updateBulkAssignGroupDropdown();
    await displayGroupManagementListInModal();
    showModalMessage(`Group "${sanitizeText(trimmedName)}" added successfully.`, 'success', true);
    await registerKeyboardShortcuts();
    return true;
}

function renameGroupInPrefs(oldName, newName) {
    const prefs = getPreferences();
    // Remove old name, add new name. Position in order is lost, but new name is added.
    prefs.groupOrder = prefs.groupOrder.filter(name => name !== oldName);
    if (!prefs.groupOrder.includes(newName)) { // Only add if it's truly new or wasn't there
        prefs.groupOrder.push(newName);
    }
    saveOrderPreference('groupOrder', prefs.groupOrder);

    // If the renamed group was selected for bulk deletion, update the set
    if (selectedGroupNames.has(oldName)) {
        selectedGroupNames.delete(oldName);
        selectedGroupNames.add(newName);
    }
}


async function deleteGroups(groupNamesToDelete) {
    hideModalMessage();
    if (groupNamesToDelete.size === 0) return false;

    const groupNamesArray = Array.from(groupNamesToDelete);
    const confirmationMessage = `Are you sure you want to delete ${groupNamesArray.length} selected group(s)?\n\n${groupNamesArray.map(sanitizeText).join('\n')}\n\nExtensions in these groups will become ungrouped.`;
    if (!confirm(confirmationMessage)) {
        showModalMessage("Group deletion cancelled.", 'info');
        return false;
    }

    const groups = await getGroups();
    let deletedCount = 0;
    groupNamesArray.forEach(groupName => {
        if (groups.hasOwnProperty(groupName)) {
            delete groups[groupName];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await saveGroups(groups);
        const prefs = getPreferences();
        prefs.groupOrder = prefs.groupOrder.filter(name => !groupNamesToDelete.has(name));
        saveOrderPreference('groupOrder', prefs.groupOrder);

        selectedGroupNames.clear();
        await updateGroupFilterDropdown();
        await updateAssignGroupDropdownsInList();
        await updateBulkAssignGroupDropdown();
        await displayGroupManagementListInModal();
        showModalMessage(`${deletedCount} group(s) deleted.`, 'success', true);
        
        if (groupNamesToDelete.has(elements.groupFilter?.value)) {
            elements.groupFilter.value = 'all';
            saveCurrentFilters();
            await renderExtensionList(getCurrentPage());
        }
        await registerKeyboardShortcuts();
    }
    return true;
}

async function ungroupAllExtensions() {
    hideModalMessage();
    if (!confirm("Are you sure you want to remove ALL extensions from their assigned groups? This will not delete groups or uninstall extensions.")) {
        showModalMessage("Ungrouping cancelled.", 'info', true);
        return;
    }

    const groups = await getGroups();
    let changedCount = 0;
    const newGroups = {};

    Object.keys(groups).forEach(groupName => {
        if (groups[groupName].members.length > 0) {
            changedCount += groups[groupName].members.length;
        }
        newGroups[groupName] = { ...groups[groupName], members: [] };
    });

    if (changedCount === 0) {
        showModalMessage("No extensions are currently assigned to any group.", 'info', true);
        return;
    }

    await saveGroups(newGroups);
    await updateGroupFilterDropdown();
    await updateAssignGroupDropdownsInList();
    await updateBulkAssignGroupDropdown();
    await displayGroupManagementListInModal();
    showModalMessage(`Successfully ungrouped ${changedCount} extension(s).`, 'success');
    await renderExtensionList(getCurrentPage());
    if (elements.groupFilter?.value !== 'all' && elements.groupFilter?.value !== 'no-group') {
        elements.groupFilter.value = 'all';
        saveCurrentFilters();
        await renderExtensionList(getCurrentPage());
    }
    await registerKeyboardShortcuts();
}


async function assignExtensionToGroup(extensionId, groupName) {
    const groups = await getGroups();
    const targetGroupName = (groupName && groupName !== '--remove--') ? groupName.trim() : "";
    let changed = false;
    let previousGroup = null;

    Object.keys(groups).forEach(key => {
        const index = groups[key].members.indexOf(extensionId);
        if (index > -1) {
            if (key !== targetGroupName) {
                groups[key].members.splice(index, 1);
                previousGroup = key;
                changed = true;
            } else if (!targetGroupName) { // If targetGroupName is empty (meaning "No Group")
                groups[key].members.splice(index, 1);
                previousGroup = key;
                changed = true;
            }
        }
    });

    if (targetGroupName) {
        if (groups.hasOwnProperty(targetGroupName)) {
            if (!groups[targetGroupName].members.includes(extensionId)) {
                groups[targetGroupName].members.push(extensionId);
                changed = true;
            }
        } else {
            console.warn(`Assign failed: Target group "${sanitizeText(targetGroupName)}" not found.`);
            showActionFeedback(`Error: Group "${sanitizeText(targetGroupName)}" no longer exists.`, 'error');
            await renderExtensionList(getCurrentPage());
            return;
        }
    }

    if (changed) {
        await saveGroups(groups);
        showActionFeedback(`Extension moved to "${sanitizeText(targetGroupName || 'No Group')}".`, 'success');
        const extensionItem = elements.extensionList?.querySelector(`.extension-item[data-extension-id="${extensionId}"]`);
        if (extensionItem) {
            extensionItem.classList.add('item-feedback-highlight', 'info');
            setTimeout(() => extensionItem.classList.remove('item-feedback-highlight', 'info'), ITEM_FEEDBACK_HIGHLIGHT_DURATION);
        }
        await updateGroupFilterDropdown();
        await updateBulkAssignGroupDropdown();
        if (elements.groupModal?.style.display === 'flex') {
            await displayGroupManagementListInModal();
        } else if (elements.groupConfigurationModal?.style.display === 'flex') {
            await renderExtensionsForGroupConfiguration(currentConfiguringGroupName);
        }
        const currentGroupFilter = elements.groupFilter?.value;
        if (currentGroupFilter !== 'all' && (currentGroupFilter === previousGroup || currentGroupFilter === targetGroupName)) {
             setTimeout(async () => await renderExtensionList(getCurrentPage()), 50);
        }
        await registerKeyboardShortcuts();
    }
}

async function assignMultipleExtensionsToGroup(extensionIds, groupName) {
    if (!extensionIds || extensionIds.size === 0) return;
    const groups = await getGroups();
    const targetGroupName = (groupName && groupName !== '--remove--') ? groupName.trim() : "";
    let changed = false;
    extensionIds.forEach(extensionId => {
        Object.keys(groups).forEach(key => {
            const index = groups[key].members.indexOf(extensionId);
            if (index > -1) {
                groups[key].members.splice(index, 1);
                changed = true;
            }
        });
        if (targetGroupName && groups.hasOwnProperty(targetGroupName)) {
            if (!groups[targetGroupName].members.includes(extensionId)) {
                groups[targetGroupName].members.push(extensionId);
                changed = true;
            }
        } else if (targetGroupName && !groups.hasOwnProperty(targetGroupName)) {
            console.warn(`Bulk Assign failed for ${extensionId}: Target group "${sanitizeText(targetGroupName)}" not found.`);
        }
    });

    if (changed) {
        await saveGroups(groups);
        await updateGroupFilterDropdown();
        await updateAssignGroupDropdownsInList();
        await updateBulkAssignGroupDropdown();
        if (elements.groupModal?.style.display === 'flex') {
            await displayGroupManagementListInModal();
        } else if (elements.groupConfigurationModal?.style.display === 'flex') {
            await renderExtensionsForGroupConfiguration(currentConfiguringGroupName);
        }
        await renderExtensionList(getCurrentPage());
        showPopupMessage(`${extensionIds.size} extension(s) moved to "${sanitizeText(targetGroupName || 'No Group')}".`, 'success');
        await registerKeyboardShortcuts();
    } else if (targetGroupName && !groups.hasOwnProperty(targetGroupName) && extensionIds.size > 0) {
        showPopupMessage(`Error: Group "${sanitizeText(targetGroupName)}" not found.`, 'error');
    } else {
         showPopupMessage(`No changes made to group assignments.`, 'info', true);
    }
    clearSelection();
}

// --- UI Update Functions ---
async function getOrderedGroupNames() {
    const groups = await getGroups();
    const groupOrderPref = getPreferences().groupOrder;
    let orderedNames = groupOrderPref.filter(name => groups.hasOwnProperty(name));
    const groupsNotInOrder = Object.keys(groups)
        .filter(name => !orderedNames.includes(name))
        .sort((a, b) => (groups[a].name || "").localeCompare(groups[b].name || "", undefined, { sensitivity: 'base' })); // Use group.name for sorting
    return [...orderedNames, ...groupsNotInOrder];
}
async function populateGroupSelect(selectElement, includeAllOption = false, includeNoGroupOption = false, includeRemoveOption = false) {
    if (!selectElement) return;
    const currentVal = selectElement.value;
    selectElement.innerHTML = '';
    if (includeAllOption) {
        const option = document.createElement('option');
        option.value = "all"; option.textContent = "All Groups";
        selectElement.appendChild(option);
    }
    if (includeNoGroupOption) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = "No Group";
        selectElement.appendChild(option);
    }
     if (includeRemoveOption) {
        const option = document.createElement('option');
        option.value = "--remove--";
        option.textContent = "Remove from Group";
        selectElement.appendChild(option);
    }
    const groups = await getGroups();
    const orderedGroupNames = await getOrderedGroupNames();
    orderedGroupNames.forEach(groupName => {
        const groupData = groups[groupName]; // Get group data by key
        const count = groupData?.members?.length || 0;
        const option = document.createElement('option');
        option.value = groupName; // Use the actual groupName as value
        option.textContent = selectElement === elements.groupFilter
            ? `${sanitizeText(groupData.name)} (${count})` // Use groupData.name for display
            : sanitizeText(groupData.name); // Use groupData.name for display
        selectElement.appendChild(option);
    });
    if (Array.from(selectElement.options).some(opt => opt.value === currentVal)) {
        selectElement.value = currentVal;
    } else if (includeAllOption) {
        selectElement.value = 'all';
    } else if (includeNoGroupOption) {
        selectElement.value = '';
    }
}
async function updateGroupFilterDropdown() {
    await populateGroupSelect(elements.groupFilter, true, false);
    const persistedGroupFilter = getPreferences().filters.group;
    if (elements.groupFilter && Array.from(elements.groupFilter.options).some(opt => opt.value === persistedGroupFilter)) {
        elements.groupFilter.value = persistedGroupFilter;
    } else if (elements.groupFilter) {
        elements.groupFilter.value = 'all';
    }
}
async function updateBulkAssignGroupDropdown() {
    if (elements.bulkAssignGroupSelect) {
        const placeholderOption = document.createElement('option');
        placeholderOption.value = "";
        placeholderOption.textContent = "Assign to Group...";
        placeholderOption.disabled = true;

        await populateGroupSelect(elements.bulkAssignGroupSelect, false, false, true);
        elements.bulkAssignGroupSelect.insertBefore(placeholderOption, elements.bulkAssignGroupSelect.firstChild);
        elements.bulkAssignGroupSelect.value = "";
    }
}
async function populateAssignGroupDropdown(selectElement, extensionId) {
    if (!selectElement) return;
    const groups = await getGroups();
    let currentGroupForExtension = "";
    // Iterate over Object.values to check 'members' array efficiently
    Object.values(groups).forEach(groupData => {
        if (groupData.members.includes(extensionId)) currentGroupForExtension = groupData.name; // Use groupData.name as value
    });
    await populateGroupSelect(selectElement, false, true);
    selectElement.value = currentGroupForExtension;
}
async function handleAssignGroupChange(event) {
    const selectElement = event.target.closest('.assign-group-select');
    if (selectElement?.dataset.extensionId) {
         await assignExtensionToGroup(selectElement.dataset.extensionId, selectElement.value);
    }
}
async function updateAssignGroupDropdownsInList() {
    const selects = elements.extensionList?.querySelectorAll('.assign-group-select');
    if (!selects) return;
    for (const select of selects) {
        if (select.dataset.extensionId) {
            await populateAssignGroupDropdown(select, select.dataset.extensionId);
        }
    }
}

// --- Group Management Modal ---
async function openGroupManagementModal() {
    const modal = elements.groupModal; if (!modal) return;
    hideModalMessage();
    selectedGroupNames.clear();
    currentConfiguringGroupName = null;
    elements.groupModal.style.display = 'flex';
    elements.groupConfigurationModal.style.display = 'none';
    await displayGroupManagementListInModal();
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
        modal.classList.add('visible');
        elements.modalNewGroupNameInput?.focus();
    }, 10);
}
function closeGroupManagementModal() {
    const modal = elements.groupModal; if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        if (!modal.classList.contains('visible')) {
            modal.style.display = 'none';
        }
        elements.groupModalTrigger?.focus();
    }, 350);
}

async function displayGroupManagementListInModal() {
    const listElement = elements.modalGroupList;
    if (!listElement) return;
    listElement.innerHTML = '';
    const groups = await getGroups();
    const orderedGroupNames = await getOrderedGroupNames();

    const existingHeader = elements.modalGroupListSection.querySelector('.modal-list-header');
    if (existingHeader) existingHeader.remove(); // Ensure it's removed before re-adding

    if (orderedGroupNames.length > 0) {
        const header = document.createElement('div');
        header.className = 'modal-list-header';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'select-all-groups-checkbox';
        checkbox.title = 'Select/Deselect all groups';

        const label = document.createElement('label');
        label.htmlFor = 'select-all-groups-checkbox';
        label.textContent = 'Select All';

        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'modal-bulk-delete-groups-btn';
        deleteBtn.className = 'button-small button-danger';
        deleteBtn.style.display = 'none';
        deleteBtn.textContent = 'Delete Selected';

        header.appendChild(checkbox);
        header.appendChild(label);
        header.appendChild(deleteBtn);
        listElement.before(header);
        
        checkbox.addEventListener('change', handleSelectAllGroupsChange);
        deleteBtn.addEventListener('click', () => deleteGroups(selectedGroupNames));
    }


    if (orderedGroupNames.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-groups-message';
        li.setAttribute('role', 'status');
        li.textContent = 'No groups created yet. Use the input above.';
        listElement.appendChild(li);
        updateBulkDeleteGroupsUI();
        return;
    }

    const fragment = document.createDocumentFragment();
    orderedGroupNames.forEach(groupName => { // groupName here is the key
        const groupData = groups[groupName];
        if (!groupData) return;
        const count = groupData?.members?.length || 0;
        const shortcut = groupData?.shortcut ? normalizeShortcut(groupData.shortcut) : '';

        const listItem = document.createElement('li');
        listItem.dataset.groupname = groupName;
        listItem.setAttribute('role', 'listitem');
        
        const isSelected = selectedGroupNames.has(groupName);
        if (isSelected) listItem.classList.add('selected');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'group-select-checkbox';
        checkbox.dataset.groupname = groupName;
        checkbox.checked = isSelected;
        checkbox.setAttribute('aria-label', `Select group ${sanitizeText(groupData.name)}`);
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'group-item-details';
        detailsDiv.title = `${sanitizeText(groupData.name)} (${count} extensions)`;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'group-item-name';
        nameSpan.textContent = sanitizeText(groupData.name);
        detailsDiv.appendChild(nameSpan);

        if (shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'group-item-shortcut';
            const shortcutImg = document.createElement('img');
            shortcutImg.src = ICON_PATHS.shortcut;
            shortcutImg.alt = 'Shortcut';
            shortcutSpan.appendChild(shortcutImg);
            shortcutSpan.appendChild(document.createTextNode(` ${sanitizeText(shortcut)}`));
            detailsDiv.appendChild(shortcutSpan);
        }

        const countSpan = document.createElement('span');
        countSpan.className = 'group-item-count';
        countSpan.setAttribute('aria-label', `${count} extensions in group`);
        countSpan.textContent = count;
        detailsDiv.appendChild(countSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'group-item-actions';

        const createButton = (className, title, text, iconSrc = null) => {
            const button = document.createElement('button');
            button.className = `button-small ${className}`;
            button.dataset.groupname = groupName;
            button.title = title;
            if (iconSrc) {
                const img = document.createElement('img');
                img.src = iconSrc;
                img.alt = '';
                button.appendChild(img);
            }
            if (text) {
                 button.appendChild(document.createTextNode(text));
            }
            return button;
        };

        const enableBtn = createButton('button-success enable-group-btn', `Enable all in '${sanitizeText(groupData.name)}'`, 'Enable All');
        const disableBtn = createButton('button-danger disable-group-btn', `Disable all in '${sanitizeText(groupData.name)}'`, 'Disable All');
        const configureBtn = createButton('configure-group-btn', 'Configure Group', null, ICON_PATHS.configure);
        const deleteBtn = createButton('button-danger icon-only delete-group-btn', 'Delete Group', null, ICON_PATHS.deleteGroup);

        actionsDiv.appendChild(enableBtn);
        actionsDiv.appendChild(disableBtn);
        actionsDiv.appendChild(configureBtn);
        actionsDiv.appendChild(deleteBtn);

        listItem.appendChild(checkbox);
        listItem.appendChild(detailsDiv);
        listItem.appendChild(actionsDiv);
        fragment.appendChild(listItem);
    });
    listElement.appendChild(fragment);
    updateBulkDeleteGroupsUI();
}

// --- Group Bulk Selection & Deletion ---
function updateBulkDeleteGroupsUI() {
    const bulkDeleteBtn = document.getElementById('modal-bulk-delete-groups-btn');
    const selectAllCheckbox = document.getElementById('select-all-groups-checkbox');
    if (!bulkDeleteBtn || !selectAllCheckbox) return;

    const count = selectedGroupNames.size;
    bulkDeleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    if (count > 0) {
        bulkDeleteBtn.textContent = `Delete Selected (${count})`;
    }

    const totalCheckboxes = elements.modalGroupList.querySelectorAll('.group-select-checkbox').length;
    if (totalCheckboxes > 0 && count === totalCheckboxes) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}

function handleSelectAllGroupsChange(event) {
    const isChecked = event.target.checked;
    const groupCheckboxes = elements.modalGroupList.querySelectorAll('.group-select-checkbox');
    groupCheckboxes.forEach(checkbox => {
        const groupName = checkbox.dataset.groupname;
        checkbox.checked = isChecked;
        const item = checkbox.closest('li');
        if (isChecked) {
            selectedGroupNames.add(groupName);
            item.classList.add('selected');
        } else {
            selectedGroupNames.delete(groupName);
            item.classList.remove('selected');
        }
    });
    updateBulkDeleteGroupsUI();
}


// --- Group Enable/Disable Actions ---
async function setGroupExtensionsState(groupName, enable) {
    hideModalMessage();
    const groups = await getGroups();
    const groupData = groups[groupName]; // Use groupName as key
    const extensionIds = groupData?.members || [];

    if (!extensionIds || extensionIds.length === 0) {
        showModalMessage(`Group "${sanitizeText(groupData?.name || groupName)}" is empty.`, 'info', true);
        return;
    }

    showLoading();
    const extensionMap = new Map(allFetchedExtensions.map(ext => [ext.id, ext]));
    let successCount = 0, errorCount = 0, noChangeCount = 0;

    const operations = extensionIds.map(id => {
        return new Promise((resolve) => {
            const currentExt = extensionMap.get(id);
            // The `enable` parameter can be boolean or null (for toggle)
            const targetState = (typeof enable === 'boolean') ? enable : !currentExt.enabled;
            if (currentExt && currentExt.enabled === targetState) {
                return resolve({ status: 'nochange' });
            }
            chrome.management.setEnabled(id, targetState, () => {
                if (chrome.runtime.lastError) {
                    resolve({ status: 'error', id, error: chrome.runtime.lastError.message });
                } else {
                    resolve({ status: 'changed', id,newState: targetState });
                }
            });
        });
    });

    const results = await Promise.all(operations);
    let finalActionVerb = "Toggled";
    if (typeof enable === 'boolean') {
        finalActionVerb = enable ? 'enabled' : 'disabled';
    }


    results.forEach(result => {
        if (result.status === 'changed') {
            successCount++;
            const extToUpdate = extensionMap.get(result.id);
            if (extToUpdate) extToUpdate.enabled = result.newState;
        } else if (result.status === 'nochange') {
            noChangeCount++;
        } else if (result.status === 'error') {
            errorCount++;
            console.error(`Error changing state for extension ${result.id}:`, result.error.message);
        }
    });

    hideLoading();

    let message;
    if (errorCount > 0) {
        message = `Completed with ${errorCount} errors in group "${sanitizeText(groupData?.name || groupName)}".`;
        showModalMessage(message, 'error');
    } else if (successCount > 0) {
        message = `${successCount} extension(s) in group "${sanitizeText(groupData?.name || groupName)}" ${finalActionVerb}.`;
        showModalMessage(message, 'success', true);
    } else {
        message = `All extensions in group "${sanitizeText(groupData?.name || groupName)}" were already in the desired state.`;
        showModalMessage(message, 'info', true);
    }
    
    await renderExtensionList(getCurrentPage());
}

// --- Group Configuration View ---
async function switchToGroupConfigurationView(groupName) {
    currentConfiguringGroupName = groupName;
    const groups = await getGroups();
    const groupData = groups[groupName]; // Access by groupName key

    if (!groupData) {
        await switchToGroupListView();
        return;
    }

    hideModalMessage();
    hideGroupConfigMessage();

    // Properly hide the group management modal
    elements.groupModal.classList.remove('visible'); // Ensure 'visible' class is removed
    elements.groupModal.setAttribute('aria-hidden', 'true'); // Update accessibility attribute
    elements.groupModal.style.display = 'none';

    // Properly show the group configuration modal
    elements.groupConfigurationModal.style.display = 'flex';
    elements.groupConfigurationModal.setAttribute('aria-hidden', 'false'); // Update accessibility attribute
    setTimeout(() => { // Add 'visible' class after a short delay for animation/transition
        elements.groupConfigurationModal.classList.add('visible');
    }, 10);

    if (elements.groupConfigTitle) {
        elements.groupConfigTitle.textContent = `Configure Group: ${sanitizeText(groupData.name)}`; // Use groupData.name for title
    }
    if (elements.groupConfigNameInput) {
        elements.groupConfigNameInput.value = groupData.name; // Set input value to actual group name
    }
    if (elements.groupConfigShortcutInput) {
        elements.groupConfigShortcutInput.value = groupData.shortcut ? normalizeShortcut(groupData.shortcut) : '';
    }
    if (elements.groupConfigActionSelect) {
        elements.groupConfigActionSelect.value = groupData.shortcutAction || 'toggle';
    }

    await renderExtensionsForGroupConfiguration(groupName);
    elements.saveGroupConfigBtn?.focus();
}

async function switchToGroupListView() {
    currentConfiguringGroupName = null;
    // Properly hide the group configuration modal
    elements.groupConfigurationModal.classList.remove('visible'); // Ensure 'visible' class is removed
    elements.groupConfigurationModal.setAttribute('aria-hidden', 'true'); // Update accessibility attribute
    elements.groupConfigurationModal.style.display = 'none';

    // Properly show the group management modal
    elements.groupModal.style.display = 'flex';
    elements.groupModal.setAttribute('aria-hidden', 'false'); // Update accessibility attribute
    setTimeout(() => { // Add 'visible' class after a short delay for animation/transition
        elements.groupModal.classList.add('visible');
    }, 10);

    await displayGroupManagementListInModal();
    elements.modalNewGroupNameInput?.focus();
}

async function renderExtensionsForGroupConfiguration(groupName) {
    const listEl = elements.groupConfigExtensionList;
    if (!listEl) return;
    listEl.innerHTML = '';

    const userControllableExtensions = allFetchedExtensions.filter(ext => ext.mayDisable)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    if (userControllableExtensions.length === 0) {
        const p = document.createElement('p');
        p.textContent = "No user-controllable extensions available to add to groups.";
        listEl.appendChild(p);
        return;
    }

    const groups = await getGroups();
    const groupData = groups[groupName];
    const groupMembers = groupData?.members || [];
    const fragment = document.createDocumentFragment();

    userControllableExtensions.forEach(ext => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'profile-config-extension-item';
        
        const isMemberOfGroup = groupMembers.includes(ext.id);
        const checkboxId = `group-cfg-ext-${ext.id}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.className = 'group-config-ext-checkbox';
        checkbox.dataset.extensionId = ext.id;
        checkbox.checked = isMemberOfGroup;

        const img = document.createElement('img');
        img.src = ext.icons?.find(i => i.size >= 16)?.url || DEFAULT_ICON_PLACEHOLDER;
        img.className = 'extension-icon-small';
        img.alt = '';

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = sanitizeText(ext.name);

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(img);
        itemDiv.appendChild(label);
        fragment.appendChild(itemDiv);
    });
    listEl.appendChild(fragment);
}

async function saveCurrentGroupConfiguration() {
    if (!currentConfiguringGroupName) return;
    hideGroupConfigMessage();

    const newName = elements.groupConfigNameInput.value.trim();
    if (!newName) {
        showGroupConfigMessage("Group name cannot be empty.", 'error');
        return;
    }

    const groups = await getGroups();
    // Check if renaming and if the new name is taken by another group (by its 'name' property)
    if (newName.toLowerCase() !== groups[currentConfiguringGroupName]?.name.toLowerCase() && Object.values(groups).some(group => group.name.toLowerCase() === newName.toLowerCase() && group.name !== groups[currentConfiguringGroupName]?.name)) {
        showGroupConfigMessage(`Group name "${sanitizeText(newName)}" already exists.`, 'error');
        return;
    }

    const newShortcut = elements.groupConfigShortcutInput?.value.trim() || null;
    let validatedShortcut = null;
    if (newShortcut) {
        const validationResult = await validateShortcut(newShortcut, await getExistingShortcuts(currentConfiguringGroupName, null));
        if (validationResult.isValid) {
            validatedShortcut = validationResult.normalizedShortcut;
        } else {
            showGroupConfigMessage(`Shortcut error: ${validationResult.message}`, 'error');
            return;
        }
    }

    // Passed validation, now update the group
    const newMembers = Array.from(elements.groupConfigExtensionList.querySelectorAll('.group-config-ext-checkbox:checked'))
                            .map(cb => cb.dataset.extensionId);
    
    const newShortcutAction = elements.groupConfigActionSelect.value;
    
    const originalGroupData = groups[currentConfiguringGroupName];
    const updatedGroupData = {
        ...originalGroupData,
        name: newName, // Crucial: Update the 'name' property inside the object
        members: newMembers,
        shortcut: validatedShortcut,
        shortcutAction: newShortcutAction
    };

    // If the name (and thus the key) changed, we need to delete the old key and add a new one
    if (newName !== currentConfiguringGroupName) {
        delete groups[currentConfiguringGroupName];
    }
    groups[newName] = updatedGroupData; // Use newName as the key for storage
    await saveGroups(groups);

    // Update preferences if name changed
    if (newName !== currentConfiguringGroupName) {
        renameGroupInPrefs(currentConfiguringGroupName, newName);
        currentConfiguringGroupName = newName; // Update state to reflect the new name (key)
    }

    showGroupConfigMessage(`Configuration saved for "${sanitizeText(newName)}".`, 'success', true);
    await updateGroupFilterDropdown();
    await updateAssignGroupDropdownsInList();
    await updateBulkAssignGroupDropdown();
    await registerKeyboardShortcuts();
}

// --- Modal Action Handlers (Delegated) ---
async function handleModalListClick(event) {
    const target = event.target;
    
    if (target.matches('.group-select-checkbox')) {
        const groupName = target.dataset.groupname;
        const item = target.closest('li');
        if (target.checked) {
            selectedGroupNames.add(groupName);
            item.classList.add('selected');
        } else {
            selectedGroupNames.delete(groupName);
            item.classList.remove('selected');
        }
        updateBulkDeleteGroupsUI();
        return;
    }

    const button = event.target.closest('button[data-groupname]');
    if (!button) return;
    const groupName = button.dataset.groupname; // This is the KEY
    if (!groupName) return;

    if (button.classList.contains('delete-group-btn')) {
        await deleteGroups(new Set([groupName]));
    } else if (button.classList.contains('enable-group-btn')) {
        await setGroupExtensionsState(groupName, true);
    } else if (button.classList.contains('disable-group-btn')) {
        await setGroupExtensionsState(groupName, false);
    } else if (button.classList.contains('configure-group-btn')) {
        event.stopPropagation();
        await switchToGroupConfigurationView(groupName);
    }
}

// --- Extension Data Fetching & Filtering ---
function fetchAllExtensions() {
    return new Promise((resolve, reject) => {
        chrome.management.getAll((extensions) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            }
            else resolve(extensions || []);
        });
    });
}

async function filterAndSortExtensions(extensions) {
    const searchInput = elements.searchInput?.value.toLowerCase().trim() || '';
    const searchTerms = searchInput.split(/\s+/).filter(Boolean);
    const typeFilter = elements.typeFilter?.value || 'all';
    const statusFilter = elements.statusFilter?.value || 'all';
    const groupFilterValue = elements.groupFilter?.value; 
    const groups = await getGroups();
    const extensionOrder = getPreferences().extensionOrder;
    const orderMap = new Map(extensionOrder.map((id, index) => [id, index]));

    let filtered = extensions.filter(ext => {
        if (typeFilter !== 'all') {
            let extActualType = ext.isApp ? 'app' : (ext.type || 'extension');
            if (typeFilter === 'extension' && !['extension', 'packaged_app'].includes(extActualType)) return false; 
            if (typeFilter === 'theme' && extActualType !== 'theme') return false;
            if (typeFilter === 'app' && !['app', 'hosted_app'].includes(extActualType)) return false; 
        }
        if (statusFilter !== 'all') {
            if (statusFilter === 'enabled' && !ext.enabled) return false;
            if (statusFilter === 'disabled' && ext.enabled) return false;
        }
        if (groupFilterValue !== 'all' && groupFilterValue !== 'no-group') {
            if (!groups[groupFilterValue]?.members?.includes(ext.id)) return false; // Check against the correct key
        }
        if (searchTerms.length > 0) {
            const name = ext.name?.toLowerCase() || '';
            const description = ext.description?.toLowerCase() || '';
            const id = ext.id?.toLowerCase() || '';
            return searchTerms.every(term => name.includes(term) || description.includes(term) || id.includes(term));
        }
        return true;
    });

    filtered.sort((a, b) => {
        const aInOrder = orderMap.has(a.id);
        const bInOrder = orderMap.has(b.id);
        if (aInOrder && bInOrder) {
            return orderMap.get(a.id) - orderMap.get(b.id);
        }
        if (aInOrder) return -1;
        if (bInOrder) return 1;
        return (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: 'base' });
    });

    return filtered;
}

// --- Extension List Rendering ---
async function renderExtensionList(page = 1) {
    if (!elements.extensionList) {
        hideLoading(); return;
    }
    elements.extensionList.innerHTML = '';
    elements.emptyStateMessageContainer.style.display = 'none';
    elements.emptyStateMessageContainer.innerHTML = '';
    hidePopupMessage(); 

    currentFilteredExtensions = await filterAndSortExtensions(allFetchedExtensions); 
    const totalExtensions = currentFilteredExtensions.length;
    const totalPages = Math.ceil(totalExtensions / EXTENSIONS_PER_PAGE) || 1;
    const currentPage = Math.min(Math.max(page, 1), totalPages);
    const startIndex = (currentPage - 1) * EXTENSIONS_PER_PAGE;
    const extensionsToDisplay = currentFilteredExtensions.slice(startIndex, startIndex + EXTENSIONS_PER_PAGE);

    if (elements.currentPageSpan) elements.currentPageSpan.textContent = currentPage;
    if (elements.totalPagesSpan) elements.totalPagesSpan.textContent = totalPages;
    if (elements.prevPageButton) elements.prevPageButton.disabled = currentPage === 1;
    if (elements.nextPageButton) elements.nextPageButton.disabled = currentPage === totalPages;

    const fragment = document.createDocumentFragment();
    const searchTerms = (elements.searchInput?.value.toLowerCase().trim() || '').split(/\s+/).filter(Boolean);

    if (extensionsToDisplay.length > 0) {
        if(elements.extensionListHeader) elements.extensionListHeader.style.display = 'flex';
        for (const extension of extensionsToDisplay) {
            const extensionItem = document.createElement('div');
            extensionItem.className = 'extension-item';
            extensionItem.dataset.extensionId = extension.id;
            extensionItem.setAttribute('role', 'listitem');
            if (selectedExtensionIds.has(extension.id)) {
                extensionItem.classList.add('selected');
                extensionItem.setAttribute('aria-selected', 'true');
            } else {
                extensionItem.setAttribute('aria-selected', 'false');
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'extension-select-checkbox';
            checkbox.dataset.extensionId = extension.id;
            checkbox.checked = selectedExtensionIds.has(extension.id);
            checkbox.setAttribute('aria-label', `Select ${sanitizeText(extension.name)}`);
            checkbox.title = `Select/Deselect ${sanitizeText(extension.name)}`;

            const icon = document.createElement('img');
            const bestIcon = extension.icons?.sort((a, b) => b.size - a.size)[0];
            icon.src = bestIcon ? bestIcon.url : DEFAULT_ICON_PLACEHOLDER;
            icon.alt = ""; 
            icon.className = 'extension-icon';
            icon.loading = 'lazy';
            icon.onerror = () => { if (icon.src !== DEFAULT_ICON_PLACEHOLDER) icon.src = DEFAULT_ICON_PLACEHOLDER; icon.onerror = null; };

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'extension-details';
            
            const nameSpan = document.createElement('span');
            nameSpan.className = 'extension-name';
            nameSpan.appendChild(highlightSearchTerms(extension.name, searchTerms));
            nameSpan.title = sanitizeText(extension.name);
            detailsDiv.appendChild(nameSpan);

            const actions = document.createElement('div');
            actions.className = 'extension-actions';

            const createButton = (text, iconSrc) => {
                const button = document.createElement('button');
                const img = document.createElement('img');
                img.src = iconSrc;
                img.alt = "";
                button.appendChild(img);
                if (text) {
                    button.appendChild(document.createTextNode(` ${text}`));
                }
                return button;
            };
            
            const toggleButton = createButton(extension.enabled ? 'Disable' : 'Enable', extension.enabled ? ICON_PATHS.toggleOff : ICON_PATHS.toggleOn);
            toggleButton.className = 'toggle-button button-small';
            toggleButton.classList.add(extension.enabled ? 'button-danger' : 'button-success');
            toggleButton.dataset.action = 'toggle';
            toggleButton.dataset.extensionId = extension.id;
            toggleButton.dataset.currentState = extension.enabled ? 'enabled' : 'disabled';
            toggleButton.title = `${extension.enabled ? 'Disable' : 'Enable'} ${sanitizeText(extension.name)}`;
            toggleButton.setAttribute('aria-pressed', String(extension.enabled));

            const detailsButton = createButton('Details', ICON_PATHS.details);
            detailsButton.className = 'details-button button-small';
            detailsButton.dataset.action = 'details';
            detailsButton.dataset.extensionId = extension.id;
            detailsButton.title = `View details for ${sanitizeText(extension.name)}`;

            const assignGroupSelect = document.createElement('select');
            assignGroupSelect.className = 'assign-group-select';
            assignGroupSelect.dataset.extensionId = extension.id;
            assignGroupSelect.title = "Assign to Group";
            await populateAssignGroupDropdown(assignGroupSelect, extension.id); 

            const deleteButton = createButton(null, ICON_PATHS.delete);
            deleteButton.className = 'delete-button button-small button-danger icon-only';
            deleteButton.dataset.action = 'delete';
            deleteButton.dataset.extensionId = extension.id;
            deleteButton.dataset.extensionName = sanitizeText(extension.name);
            deleteButton.title = `Uninstall ${sanitizeText(extension.name)}`;

            actions.appendChild(toggleButton);
            actions.appendChild(detailsButton);
            actions.appendChild(assignGroupSelect);
            actions.appendChild(deleteButton);

            extensionItem.appendChild(checkbox);
            extensionItem.appendChild(icon);
            extensionItem.appendChild(detailsDiv);
            extensionItem.appendChild(actions);
            fragment.appendChild(extensionItem);
        }
    } else {
        if(elements.extensionListHeader) elements.extensionListHeader.style.display = 'none';
        if(elements.emptyStateMessageContainer) {
            elements.emptyStateMessageContainer.style.display = 'block';
            const p1 = document.createElement('p');
            p1.textContent = 'No extensions found matching your criteria.';
            elements.emptyStateMessageContainer.appendChild(p1);

             if (elements.searchInput?.value.trim() || elements.typeFilter?.value !== 'all' || elements.statusFilter?.value !== 'all' || elements.groupFilter?.value !== 'all') {
                const p2 = document.createElement('p');
                p2.textContent = 'Try clearing your search or adjusting filters.';
                elements.emptyStateMessageContainer.appendChild(p2);
            }
        }
    }

    elements.extensionList.appendChild(fragment);
    hideLoading();
    updateSelectAllCheckboxState();
    updateBulkActionsUI();
}

async function refreshExtensionDataAndRender(page = 1) {
    showLoading();
    try {
        allFetchedExtensions = await fetchAllExtensions();
        await renderExtensionList(page);
    } catch (error) {
        hideLoading();
        showPopupMessage(`Error fetching extensions: ${error.message || 'Unknown error'}`, 'error');
        console.error("Extension fetch/render error:", error);
    }
}

// --- Extension Action Handlers (Delegation) ---
function handleExtensionListClick(event) {
    const target = event.target;

    if (target.classList.contains('extension-select-checkbox')) {
        const extensionId = target.dataset.extensionId;
        const item = target.closest('.extension-item');
        if (target.checked) {
            selectedExtensionIds.add(extensionId);
            item?.classList.add('selected');
        } else {
            selectedExtensionIds.delete(extensionId);
            item?.classList.remove('selected');
        }
        updateBulkActionsUI();
        updateSelectAllCheckboxState();
        return; 
    }

    const actionButton = target.closest('button[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const extensionId = actionButton.dataset.extensionId;
    if (!extensionId) return; 

    switch (action) {
        case 'toggle':
            toggleExtension(extensionId, actionButton.dataset.currentState === 'disabled', actionButton);
            break;
        case 'details':
            openDetailsPage(extensionId);
            break;
        case 'delete':
            confirmAndDeleteExtension(extensionId, actionButton.dataset.extensionName || 'this extension');
            break;
    }
}

// --- Core Extension Actions (Single) ---
function toggleExtension(extensionId, enable, buttonElement) {
    showLoading();
    hidePopupMessage(); 
    chrome.management.setEnabled(extensionId, enable, async () => {
        hideLoading();
        if (chrome.runtime.lastError) {
            showActionFeedback(`Error: ${chrome.runtime.lastError.message}`, 'error');
        } else {
            showActionFeedback(`Extension ${enable ? 'enabled' : 'disabled'}.`, 'success');

            const cachedExt = allFetchedExtensions.find(ext => ext.id === extensionId);
            if (cachedExt) cachedExt.enabled = enable;

            const item = elements.extensionList?.querySelector(`.extension-item[data-extension-id="${extensionId}"]`);
            const button = buttonElement || item?.querySelector('.toggle-button');

            if (item && button) {
                button.dataset.currentState = enable ? 'enabled' : 'disabled';
                
                // Clear and rebuild button content
                button.textContent = ''; // Clear existing text nodes
                const img = document.createElement('img');
                img.src = enable ? ICON_PATHS.toggleOff : ICON_PATHS.toggleOn;
                img.alt = "";
                button.appendChild(img);
                button.appendChild(document.createTextNode(` ${enable ? 'Disable' : 'Enable'}`));

                button.title = `${enable ? 'Disable' : 'Enable'} ${sanitizeText(cachedExt.name)}`;
                button.setAttribute('aria-pressed', String(enable));
                button.classList.remove('button-success', 'button-danger');
                button.classList.add(enable ? 'button-danger' : 'button-success');

                item.classList.add('item-feedback-highlight', enable ? 'success' : 'info');
                setTimeout(() => item.classList.remove('item-feedback-highlight', 'success', 'info'), ITEM_FEEDBACK_HIGHLIGHT_DURATION);

                if (elements.statusFilter?.value !== 'all') {
                     setTimeout(async () => await refreshExtensionDataAndRender(getCurrentPage()), ITEM_FEEDBACK_HIGHLIGHT_DURATION + 50);
                }
            } else {
                 await refreshExtensionDataAndRender(getCurrentPage());
            }
        }
    });
}
function openDetailsPage(extensionId) {
    chrome.tabs.create({ url: `src/html/details.html?id=${extensionId}` });
}
function confirmAndDeleteExtension(extensionId, extensionName) {
    if (confirm(`Are you sure you want to uninstall "${extensionName}"?\n\nThis cannot be undone.`)) {
        uninstallExtension(extensionId, extensionName);
    } else {
        showPopupMessage("Uninstallation cancelled.", 'info', true);
    }
}
function uninstallExtension(extensionId, sanitizedName) {
    showLoading();
    hidePopupMessage(); 
    chrome.management.uninstall(extensionId, { showConfirmDialog: false }, async () => {
        hideLoading();
        if (chrome.runtime.lastError) {
            showPopupMessage(`Error uninstalling "${sanitizedName}": ${chrome.runtime.lastError.message}`, 'error');
        } else {
            showPopupMessage(`"${sanitizedName}" uninstalled.`, 'success');
            selectedExtensionIds.delete(extensionId); 

            const prefs = getPreferences();
            prefs.extensionOrder = prefs.extensionOrder.filter(id => id !== extensionId);
            saveOrderPreference('extensionOrder', prefs.extensionOrder);

            await refreshExtensionDataAndRender(getCurrentPage()); 
            await updateGroupFilterDropdown(); 
            await updateBulkAssignGroupDropdown(); 
            if (elements.groupModal?.style.display === 'flex') {
                await displayGroupManagementListInModal(); 
            } else if (elements.groupConfigurationModal?.style.display === 'flex') {
                await renderExtensionsForGroupConfiguration(currentConfiguringGroupName);
            }
            if (elements.profilesModal?.style.display === 'flex') {
                await displayProfileManagementListInModal();
                if (currentConfiguringProfileId) {
                    await renderExtensionsForProfileConfiguration(currentConfiguringProfileId);
                }
            }
            await registerKeyboardShortcuts();
        }
    });
}

// --- Bulk Actions ---
function updateBulkActionsUI() {
    const count = selectedExtensionIds.size;
    const bulkContainer = elements.bulkActionsContainer;
    if (!bulkContainer) return;

    if (count > 0) {
        if(elements.selectedCountSpan) elements.selectedCountSpan.textContent = `${count} selected`;
        bulkContainer.style.display = 'flex';
        [elements.bulkEnableButton, elements.bulkDisableButton, elements.bulkUninstallButton, elements.bulkAssignGroupSelect].forEach(el => {
            if (el) { el.disabled = false; }
        });
    } else {
        bulkContainer.style.display = 'none';
        if(elements.bulkAssignGroupSelect) elements.bulkAssignGroupSelect.value = ""; 
    }
}
function updateSelectAllCheckboxState() {
    if (!elements.selectAllCheckbox) return;
    const visibleCheckboxes = elements.extensionList?.querySelectorAll('.extension-select-checkbox') || [];
    if (!visibleCheckboxes.length) {
        elements.selectAllCheckbox.checked = false;
        elements.selectAllCheckbox.indeterminate = false;
        elements.selectAllCheckbox.disabled = true; return;
    }
    elements.selectAllCheckbox.disabled = false;
    const allVisibleSelected = Array.from(visibleCheckboxes).every(cb => cb.checked);
    const someVisibleSelected = Array.from(visibleCheckboxes).some(cb => cb.checked);

    if (allVisibleSelected) { 
        elements.selectAllCheckbox.checked = true; elements.selectAllCheckbox.indeterminate = false;
    } else if (someVisibleSelected) {
        elements.selectAllCheckbox.checked = false; elements.selectAllCheckbox.indeterminate = true;
    } else {
        elements.selectAllCheckbox.checked = false; elements.selectAllCheckbox.indeterminate = false;
    }
}
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const visibleCheckboxes = elements.extensionList?.querySelectorAll('.extension-select-checkbox') || [];

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
}
function clearSelection() {
    selectedExtensionIds.clear();
    elements.extensionList?.querySelectorAll('.extension-item.selected').forEach(item => {
        item.classList.remove('selected');
        const checkbox = item.querySelector('.extension-select-checkbox');
        if (checkbox) checkbox.checked = false;
    });
    updateBulkActionsUI();
    updateSelectAllCheckboxState(); 
}
async function performBulkAction(action) {
    const idsToProcess = new Set(selectedExtensionIds); 
    if (idsToProcess.size === 0) { return; }

    let actionFn, actionPastTense = "";
    switch (action) {
        case 'enable':
            actionFn = (id) => new Promise((res, rej) => chrome.management.setEnabled(id, true, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(id)));
            actionPastTense = "enabled";
            break;
        case 'disable':
            actionFn = (id) => new Promise((res, rej) => chrome.management.setEnabled(id, false, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(id)));
            actionPastTense = "disabled";
            break;
        case 'uninstall':
            if (!confirm(`Are you sure you want to uninstall ${idsToProcess.size} selected extension(s)?\n\nThis cannot be undone.`)) {
                showPopupMessage("Bulk uninstallation cancelled.", 'info', true);
                return;
            }
            actionFn = (id) => new Promise((res, rej) => chrome.management.uninstall(id, { showConfirmDialog: false }, () => chrome.runtime.lastError ? rej(chrome.runtime.lastError) : res(id))); 
            actionPastTense = "uninstalled";
            break;
        default: return;
    }

    showLoading(); hidePopupMessage();
    const extensionMap = new Map(allFetchedExtensions.map(ext => [ext.id, ext]));
    let successCount = 0, errorCount = 0;

    const operations = Array.from(idsToProcess).map(id => actionFn(id).catch(e => ({error: e, id})));
    const results = await Promise.all(operations);

    results.forEach(result => {
        if (!result?.error) {
            successCount++;
            const extensionId = result;
            if (action === 'enable' || action === 'disable') {
                const extToUpdate = extensionMap.get(extensionId);
                if (extToUpdate) extToUpdate.enabled = (action === 'enable');
            }
        } else {
            errorCount++;
            console.error(`Error bulk action on ${result.id}:`, result.error.message);
        }
    });

    hideLoading();
    if (errorCount > 0) {
        showPopupMessage(`Completed with errors. ${successCount} ${actionPastTense}, ${errorCount} failed.`, 'error');
    } else if (successCount > 0) {
        showPopupMessage(`Successfully ${actionPastTense} ${successCount} extension(s).`, 'success');
    }

    clearSelection(); 
    await refreshExtensionDataAndRender(getCurrentPage()); 

    if (action === 'uninstall') {
        await updateGroupFilterDropdown(); 
        await updateBulkAssignGroupDropdown();
        if (elements.groupModal?.style.display === 'flex') await displayGroupManagementListInModal();
        if (elements.profilesModal?.style.display === 'flex') await displayProfileManagementListInModal();
        if (currentConfiguringProfileId) await renderExtensionsForProfileConfiguration(currentConfiguringProfileId);
        if (currentConfiguringGroupName) await renderExtensionsForGroupConfiguration(currentConfiguringGroupName);
    }
    await registerKeyboardShortcuts();
}
async function handleBulkAssignGroupChange(event) {
    const selectedGroupName = event.target.value;
    if (selectedExtensionIds.size === 0) {
        event.target.value = ""; 
        return;
    }
    if (selectedGroupName === "") return;
    await assignMultipleExtensionsToGroup(selectedExtensionIds, selectedGroupName);
    event.target.value = ""; 
}

// --- Pagination ---
function getCurrentPage() {
    return parseInt(elements.currentPageSpan?.textContent || '1', 10);
}
function setupPagination() {
    elements.prevPageButton?.addEventListener('click', async () => { if (!elements.prevPageButton.disabled) await renderExtensionList(getCurrentPage() - 1); });
    elements.nextPageButton?.addEventListener('click', async () => { if (!elements.nextPageButton.disabled) await renderExtensionList(getCurrentPage() + 1); });
}

// --- Filters & Search Setup ---
async function setupFiltersAndSearch() {
    let clearFiltersBtn;
    
    async function clearAllFilters() {
        elements.searchInput.value = '';
        elements.typeFilter.value = 'all';
        elements.statusFilter.value = 'all';
        elements.groupFilter.value = 'all';
        await handleFilterOrSearchChange();
    }
    
    function createAndManageClearFiltersButton() {
        if (!document.getElementById('clear-filters-btn')) {
            clearFiltersBtn = document.createElement('button');
            clearFiltersBtn.id = 'clear-filters-btn';
            clearFiltersBtn.className = 'button-small';
            clearFiltersBtn.textContent = 'Clear Filters';
            clearFiltersBtn.title = 'Reset all search and filter options (Ctrl+Shift+F)';
            clearFiltersBtn.style.display = 'none';
            elements.filtersRow?.appendChild(clearFiltersBtn);

            clearFiltersBtn.addEventListener('click', clearAllFilters);
        } else {
            clearFiltersBtn = document.getElementById('clear-filters-btn');
        }
    }

    function updateClearFiltersButtonVisibility() {
        if (!clearFiltersBtn) return;
        const isAnyFilterActive = (
            elements.searchInput?.value.trim() !== '' ||
            elements.typeFilter?.value !== 'all' ||
            elements.statusFilter?.value !== 'all' ||
            elements.groupFilter?.value !== 'all'
        );
        clearFiltersBtn.style.display = isAnyFilterActive ? 'inline-flex' : 'none';
    }
    
    const handleFilterOrSearchChange = async () => {
        saveCurrentFilters(); 
        clearSelection(); 
        await renderExtensionList(1);
        updateClearFiltersButtonVisibility();
    };
    
    applySavedFilters(); 
    createAndManageClearFiltersButton();
    updateClearFiltersButtonVisibility();

    elements.typeFilter?.addEventListener('change', handleFilterOrSearchChange);
    elements.statusFilter?.addEventListener('change', handleFilterOrSearchChange);
    elements.groupFilter?.addEventListener('change', handleFilterOrSearchChange);

    await updateGroupFilterDropdown();
    await updateBulkAssignGroupDropdown();

    elements.searchInput?.addEventListener('input', () => {
        clearTimeout(searchDebounceTimeout);
        searchDebounceTimeout = setTimeout(handleFilterOrSearchChange, 300); 
    });

    // Return the clear function for shortcut access
    return { clearAllFilters };
}

// --- Help Modal Functions ---
function openHelpModal() {
    const modal = elements.helpModal;
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
        modal.classList.add('visible');
        modal.querySelector('.modal-close-button')?.focus();
    }, 10);
}

function closeHelpModal() {
    const modal = elements.helpModal;
    if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        if (!modal.classList.contains('visible')) {
            modal.style.display = 'none';
        }
        elements.helpModalTrigger?.focus();
    }, 350);
}


// --- Modal Event Listeners Setup ---
function setupModalEventListeners() {
    // Group Modal
    elements.groupModalTrigger?.addEventListener('click', openGroupManagementModal);
    elements.groupModalCloseButton?.addEventListener('click', closeGroupManagementModal);
    elements.groupModal?.addEventListener('click', (e) => { if (e.target === elements.groupModal) closeGroupManagementModal(); });
    elements.modalAddGroupButton?.addEventListener('click', async () => {
        const input = elements.modalNewGroupNameInput;
        if (input?.value.trim()) {
            if (await addGroup(input.value.trim())) input.value = '';
            input.focus();
        }
    });
    elements.modalNewGroupNameInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.modalAddGroupButton?.click(); });
    elements.modalGroupList?.addEventListener('click', handleModalListClick);
    elements.ungroupAllButton?.addEventListener('click', ungroupAllExtensions);

    // Group Configuration Modal
    elements.groupConfigurationModal?.addEventListener('click', (e) => { if (e.target === elements.groupConfigurationModal) switchToGroupListView(); });
    elements.groupConfigurationModal?.querySelector('.modal-close-button')?.addEventListener('click', switchToGroupListView);
    elements.saveGroupConfigBtn?.addEventListener('click', saveCurrentGroupConfiguration);
    elements.backToGroupsBtn?.addEventListener('click', switchToGroupListView);
    elements.groupConfigShortcutInput?.addEventListener('input', handleShortcutInput);


    // Profiles Modal
    elements.profilesModalTrigger?.addEventListener('click', openProfilesModal);
    elements.profilesModalCloseButton?.addEventListener('click', closeProfilesModal);
    elements.profilesModal?.addEventListener('click', (e) => { if (e.target === elements.profilesModal) closeProfilesModal(); });
    elements.modalAddProfileButton?.addEventListener('click', async () => {
        const input = elements.modalNewProfileNameInput;
        if (input?.value.trim()) {
            if(await addProfile(input.value.trim())) input.value = '';
            input.focus();
        }
    });
    elements.modalNewProfileNameInput?.addEventListener('keypress', (e) => { if (e.key === 'Enter') elements.modalAddProfileButton?.click(); });
    elements.modalProfileList?.addEventListener('click', handleProfilesModalListClick);
    elements.createFromCurrentStateButton?.addEventListener('click', createProfileFromCurrentState);

    // Profile Configuration View Buttons
    elements.saveProfileConfigBtn?.addEventListener('click', saveCurrentProfileConfiguration);
    elements.backToProfilesBtn?.addEventListener('click', switchToProfileListView);
    elements.profileConfigShortcutInput?.addEventListener('input', handleShortcutInput);

    // Help Modal
    elements.helpModalTrigger?.addEventListener('click', openHelpModal);
    elements.helpModalCloseButton?.addEventListener('click', closeHelpModal);
    elements.helpModal?.addEventListener('click', (e) => {
        if (e.target === elements.helpModal) closeHelpModal();
    });
}

// --- Profiles Management ---

async function getProfiles() {
    try {
        const data = await chrome.storage.local.get(PROFILES_STORAGE_KEY);
        const profiles = data[PROFILES_STORAGE_KEY];
        if (!profiles) return {};

        if (typeof profiles === 'object' && !Array.isArray(profiles)) {
            Object.values(profiles).forEach(p => {
                if (typeof p.name !== 'string') p.name = "Unnamed Profile";
                if (typeof p.extensionStates !== 'object' || p.extensionStates === null) p.extensionStates = {};
                if (typeof p.shortcut === 'undefined') p.shortcut = null;
                if (typeof p.type === 'undefined') p.type = 'custom';
            });
            return profiles;
        }
        console.warn("Invalid profiles format in storage. Resetting.");
        await chrome.storage.local.remove(PROFILES_STORAGE_KEY);
        return {};
    } catch (e) {
        console.error("Error reading profiles from chrome.storage:", e);
        return {};
    }
}

async function saveProfiles(profiles) {
    try {
        await chrome.storage.local.set({ [PROFILES_STORAGE_KEY]: profiles });
    } catch (e) {
        console.error("Error saving profiles to chrome.storage:", e);
        showProfilesModalMessage("Could not save profiles.", "error");
    }
}

async function getOrderedProfileIds() { 
    const profiles = await getProfiles();
    const profileOrderPref = getPreferences().profileOrder; 
    let orderedIds = profileOrderPref.filter(id => profiles.hasOwnProperty(id));
    const profilesNotInOrderIds = Object.keys(profiles)
        .filter(id => !orderedIds.includes(id))
        .sort((a, b) => (profiles[a].name || "").localeCompare(profiles[b].name || "", undefined, { sensitivity: 'base' }));
    return [...orderedIds, ...profilesNotInOrderIds];
}


async function openProfilesModal() {
    const modal = elements.profilesModal; if (!modal) return;
    hideProfilesModalMessage(); 
    selectedProfileIds.clear();
    currentConfiguringProfileId = null;
    elements.profilesModal.style.display = 'flex';
    elements.profileConfigurationView.style.display = 'none';
    await switchToProfileListView(); 
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
        modal.classList.add('visible');
        elements.modalNewProfileNameInput?.focus();
    }, 10); 
}
function closeProfilesModal() {
    const modal = elements.profilesModal; if (!modal) return;
    currentConfiguringProfileId = null; 
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    setTimeout(() => {
        if (!modal.classList.contains('visible')) { 
            modal.style.display = 'none';
        }
        elements.profilesModalTrigger?.focus(); 
    }, 350); 
}

async function addProfile(profileName) {
    hideProfilesModalMessage();
    const trimmedName = profileName.trim();
    if (!trimmedName) {
        showProfilesModalMessage("Profile name cannot be empty.", 'error');
        return false;
    }
    const profiles = await getProfiles();
    // Check if the actual profile name (stored as 'name' property) exists
    if (Object.values(profiles).some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        showProfilesModalMessage(`Profile "${sanitizeText(trimmedName)}" already exists.`, 'error');
        return false;
    }

    const newProfileId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    profiles[newProfileId] = { id: newProfileId, name: trimmedName, extensionStates: {}, shortcut: null, type: 'custom' };
    await saveProfiles(profiles);

    const prefs = getPreferences();
    prefs.profileOrder.push(newProfileId); 
    saveOrderPreference('profileOrder', prefs.profileOrder);

    await displayProfileManagementListInModal(); 
    showProfilesModalMessage(`Profile "${sanitizeText(trimmedName)}" added.`, 'success', true);
    await registerKeyboardShortcuts();
    return true;
}

function renameProfileInPrefs(profileId, newName) {
    // This function is currently just a placeholder in your code,
    // as profileOrder uses IDs, not names. No change needed here.
}


async function deleteProfiles(profileIdsToDelete) {
    hideProfilesModalMessage();
    if(profileIdsToDelete.size === 0) return false;

    const profiles = await getProfiles();
    const profileNames = Array.from(profileIdsToDelete).map(id => `"${sanitizeText(profiles[id]?.name)}"`).join(', ');
    const confirmationMessage = `Are you sure you want to delete ${profileIdsToDelete.size} profile(s)?\n\n${profileNames}\n\nThis cannot be undone.`;
    if (!confirm(confirmationMessage)) {
        showProfilesModalMessage("Profile deletion cancelled.", 'info');
        return false;
    }
    
    let deletedCount = 0;
    profileIdsToDelete.forEach(profileId => {
        if (profiles[profileId]) {
            delete profiles[profileId];
            deletedCount++;
        }
    });

    if (deletedCount > 0) {
        await saveProfiles(profiles);

        const prefs = getPreferences();
        prefs.profileOrder = prefs.profileOrder.filter(id => !profileIdsToDelete.has(id));
        saveOrderPreference('profileOrder', prefs.profileOrder);

        selectedProfileIds.clear();
        await displayProfileManagementListInModal();
        showProfilesModalMessage(`${deletedCount} profile(s) deleted.`, 'success', true);
        await registerKeyboardShortcuts();
    }
    return true;
}

async function duplicateProfile(sourceProfileId) {
    hideProfilesModalMessage();
    const profiles = await getProfiles();
    const sourceProfile = profiles[sourceProfileId];

    if (!sourceProfile) {
        showProfilesModalMessage("Source profile not found.", 'error');
        return false;
    }

    let newName = `${sourceProfile.name} (Copy)`;
    let counter = 1;
    while (Object.values(profiles).some(p => p.name.toLowerCase() === newName.toLowerCase())) {
        counter++;
        newName = `${sourceProfile.name} (Copy ${counter})`;
    }

    const newProfileId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    profiles[newProfileId] = {
        id: newProfileId,
        name: newName,
        extensionStates: JSON.parse(JSON.stringify(sourceProfile.extensionStates || {})),
        shortcut: null,
        type: 'custom'
    };
    await saveProfiles(profiles);

    const prefs = getPreferences();
    prefs.profileOrder.push(newProfileId);
    saveOrderPreference('profileOrder', prefs.profileOrder);

    await displayProfileManagementListInModal();
    showProfilesModalMessage(`Profile duplicated as "${sanitizeText(newName)}".`, 'success', true);
    await registerKeyboardShortcuts();
    return true;
}

async function createProfileFromCurrentState() {
    hideProfilesModalMessage();
    showLoading();

    let profileName = prompt("Enter a name for the new profile:", "Current State Profile");
    if (profileName === null) {
        hideLoading();
        return;
    }
    profileName = profileName.trim();
    if (!profileName) {
        hideLoading();
        showProfilesModalMessage("Profile name cannot be empty.", 'error');
        return;
    }

    const profiles = await getProfiles();
    if (Object.values(profiles).some(p => p.name.toLowerCase() === profileName.toLowerCase())) {
        hideLoading();
        showProfilesModalMessage(`Profile "${sanitizeText(profileName)}" already exists.`, 'error');
        return;
    }

    const newProfileId = `profile_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const extensionStates = {};
    allFetchedExtensions.forEach(ext => {
        if (ext.mayDisable) {
             extensionStates[ext.id] = ext.enabled;
        }
    });

    profiles[newProfileId] = {
        id: newProfileId,
        name: profileName,
        extensionStates,
        shortcut: null,
        type: PROFILE_TYPE_CURRENT_STATE
    };
    await saveProfiles(profiles);

    const prefs = getPreferences();
    prefs.profileOrder.push(newProfileId);
    saveOrderPreference('profileOrder', prefs.profileOrder);

    hideLoading();
    await displayProfileManagementListInModal();
    showProfilesModalMessage(`Profile "${sanitizeText(profileName)}" created from current state.`, 'success', true);
    await registerKeyboardShortcuts();
}


async function displayProfileManagementListInModal() {
    const listEl = elements.modalProfileList;
    if (!listEl) return;
    listEl.innerHTML = ''; 
    const profiles = await getProfiles();
    const orderedProfileIds = await getOrderedProfileIds();

    const existingHeader = elements.modalProfileListSection.querySelector('.modal-list-header');
    if (existingHeader) existingHeader.remove(); // Ensure it's removed before re-adding

    if (orderedProfileIds.length > 0) {
        const header = document.createElement('div');
        header.className = 'modal-list-header';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'select-all-profiles-checkbox';
        checkbox.title = 'Select/Deselect all profiles';

        const label = document.createElement('label');
        label.htmlFor = 'select-all-profiles-checkbox';
        label.textContent = 'Select All';

        const deleteBtn = document.createElement('button');
        deleteBtn.id = 'modal-bulk-delete-profiles-btn';
        deleteBtn.className = 'button-small button-danger';
        deleteBtn.style.display = 'none';
        deleteBtn.textContent = 'Delete Selected';

        header.appendChild(checkbox);
        header.appendChild(label);
        header.appendChild(deleteBtn);
        listEl.before(header);
        
        header.querySelector('#select-all-profiles-checkbox').addEventListener('change', handleSelectAllProfilesChange);
        header.querySelector('#modal-bulk-delete-profiles-btn').addEventListener('click', () => deleteProfiles(selectedProfileIds));
    }


    if (orderedProfileIds.length === 0) {
        const li = document.createElement('li');
        li.className = 'no-profiles-message';
        li.setAttribute('role', 'status');
        li.textContent = 'No profiles created yet.';
        listEl.appendChild(li);
        updateBulkDeleteProfilesUI();
        return;
    }

    const fragment = document.createDocumentFragment();
    orderedProfileIds.forEach(profileId => {
        const profile = profiles[profileId];
        if (!profile) return; 

        const listItem = document.createElement('li');
        listItem.dataset.profileid = profileId;
        listItem.setAttribute('role', 'listitem');
        const sanitizedProfileName = sanitizeText(profile.name);
        
        const isSelected = selectedProfileIds.has(profileId);
        if (isSelected) listItem.classList.add('selected');
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'profile-select-checkbox';
        checkbox.dataset.profileid = profileId;
        checkbox.checked = isSelected;
        checkbox.setAttribute('aria-label', `Select profile ${sanitizedProfileName}`);

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'profile-item-details';
        detailsDiv.title = sanitizedProfileName;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'profile-item-name';
        nameSpan.textContent = sanitizedProfileName;
        detailsDiv.appendChild(nameSpan);
        
        if (profile.shortcut) {
            const shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'profile-item-shortcut';
            const shortcutImg = document.createElement('img');
            shortcutImg.src = ICON_PATHS.shortcut;
            shortcutImg.alt = 'Shortcut';
            shortcutSpan.appendChild(shortcutImg);
            shortcutSpan.appendChild(document.createTextNode(` ${sanitizeText(profile.shortcut)}`));
            detailsDiv.appendChild(shortcutSpan);
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'profile-item-actions';

        const createButton = (className, title, text, iconSrc = null) => {
            const button = document.createElement('button');
            button.className = `button-small ${className}`;
            button.dataset.profileid = profileId;
            button.title = title;
            if (iconSrc) {
                const img = document.createElement('img');
                img.src = iconSrc;
                img.alt = '';
                button.appendChild(img);
            }
            if(text) {
                button.appendChild(document.createTextNode(text));
            }
            return button;
        };

        const applyBtn = createButton('button-success apply-profile-btn', 'Apply Profile', 'Apply');
        const configureBtn = createButton('configure-profile-btn', 'Configure Profile', null, ICON_PATHS.configure);
        const duplicateBtn = createButton('icon-only duplicate-profile-btn', 'Duplicate Profile', null, ICON_PATHS.duplicate);
        const deleteBtn = createButton('button-danger icon-only delete-profile-btn', 'Delete Profile', null, ICON_PATHS.deleteProfile);
        
        actionsDiv.appendChild(applyBtn);
        actionsDiv.appendChild(configureBtn);
        actionsDiv.appendChild(duplicateBtn);
        actionsDiv.appendChild(deleteBtn);
        
        listItem.appendChild(checkbox);
        listItem.appendChild(detailsDiv);
        listItem.appendChild(actionsDiv);
        fragment.appendChild(listItem);
    });
    listEl.appendChild(fragment);
    updateBulkDeleteProfilesUI();
}

async function applyProfile(profileId) {
    hideProfilesModalMessage();
    showLoading(); 
    const profiles = await getProfiles();
    const profile = profiles[profileId];

    if (!profile || !profile.extensionStates) {
        hideLoading();
        showProfilesModalMessage(`Profile not found or is empty.`, 'error');
        return;
    }

    const extensionsToChange = Object.entries(profile.extensionStates);
    if (extensionsToChange.length === 0) {
        hideLoading();
        showProfilesModalMessage(`Profile "${sanitizeText(profile.name)}" has no extensions configured.`, 'info', true);
        return;
    }

    const extensionMap = new Map(allFetchedExtensions.map(e => [e.id, e]));
    let successCount = 0, errorCount = 0, noChangeCount = 0;

    const operations = extensionsToChange.map(([extId, shouldBeEnabled]) => {
        return new Promise(resolve => {
            const currentExt = extensionMap.get(extId);
            if (!currentExt || !currentExt.mayDisable) { 
                return resolve({status: 'skipped'});
            }
            if (currentExt.enabled === shouldBeEnabled) { 
                return resolve({status: 'nochange'});
            }
            chrome.management.setEnabled(extId, shouldBeEnabled, () => {
                if (chrome.runtime.lastError) {
                    resolve({status: 'error', id: extId, error: chrome.runtime.lastError.message});
                } else {
                    resolve({status: 'success', id: extId});
                }
            });
        });
    });

    const results = await Promise.all(operations);
    
    results.forEach(result => {
        if(result.status === 'success') {
            successCount++;
            const ext = extensionMap.get(result.id);
            if (ext) ext.enabled = !ext.enabled;
        } else if (result.status === 'nochange') {
            noChangeCount++;
        } else if (result.status === 'error') {
            errorCount++;
            console.error(`Error applying profile to ${result.id}:`, result.error);
        }
    });
    
    hideLoading();

    let message, messageType = "info";
    if (errorCount > 0) {
        message = `Profile "${sanitizeText(profile.name)}" applied with ${errorCount} error(s).`;
        messageType = "error";
    } else if (successCount > 0) {
        message = `Profile "${sanitizeText(profile.name)}" applied. ${successCount} changed, ${noChangeCount} unchanged.`;
        messageType = "success";
    } else {
        message = `All extensions in profile "${sanitizeText(profile.name)}" were already in the desired state.`;
    }

    showProfilesModalMessage(message, messageType, messageType !== 'error'); 
    await refreshExtensionDataAndRender(getCurrentPage()); 
}


async function switchToProfileConfigurationView(profileId) {
    currentConfiguringProfileId = profileId;
    const profiles = await getProfiles();
    const profile = profiles[profileId];

    if (!profile) {
        await switchToProfileListView(); 
        return;
    }

    hideProfilesModalMessage();
    hideFeedbackMessage('both', 'profile-config-shortcut');
    elements.modalProfileCreationSection.style.display = 'none';
    elements.modalProfileListSection.style.display = 'none';
    elements.profileConfigurationView.style.display = 'block';

    if (elements.profileConfigurationTitle) {
        elements.profileConfigurationTitle.textContent = `Configure Profile: ${sanitizeText(profile.name)}`;
    }
    if (elements.profileConfigNameInput) {
        elements.profileConfigNameInput.value = profile.name;
    }

    if (elements.profileConfigShortcutInput) {
        elements.profileConfigShortcutInput.disabled = false;
        elements.profileConfigShortcutInput.value = profile.shortcut ? normalizeShortcut(profile.shortcut) : '';
        elements.profileConfigShortcutInput.placeholder = 'e.g., Ctrl+Shift+P';
    }

    await renderExtensionsForProfileConfiguration(profileId);
    elements.saveProfileConfigBtn?.focus(); 
}

async function switchToProfileListView() {
    currentConfiguringProfileId = null; 
    elements.profileConfigurationView.style.display = 'none';
    elements.modalProfileCreationSection.style.display = 'block';
    elements.modalProfileListSection.style.display = 'block';
    await displayProfileManagementListInModal(); 
    elements.modalNewProfileNameInput?.focus();
    hideFeedbackMessage('both', 'profile-config-shortcut');
}

async function renderExtensionsForProfileConfiguration(profileId) {
    const listEl = elements.profileConfigurationExtensionList;
    listEl.innerHTML = ''; 
    const userControllableExtensions = allFetchedExtensions.filter(ext => ext.mayDisable)
      .sort((a,b) => (a.name || "").localeCompare(b.name || ""));

    if (userControllableExtensions.length === 0) {
        const p = document.createElement('p');
        p.textContent = "No user-controllable extensions available.";
        listEl.appendChild(p);
        return;
    }

    const profiles = await getProfiles();
    const profile = profiles[profileId];
    const profileExtensionStates = profile.extensionStates || {};
    const fragment = document.createDocumentFragment();

    userControllableExtensions.forEach(ext => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'profile-config-extension-item';
        
        const isEnabledInProfile = profileExtensionStates[ext.id] ?? ext.enabled;                    
        const checkboxId = `profile-cfg-ext-${ext.id}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.className = 'profile-config-ext-checkbox';
        checkbox.dataset.extensionId = ext.id;
        checkbox.checked = isEnabledInProfile;

        const img = document.createElement('img');
        img.src = ext.icons?.find(i => i.size >= 16)?.url || DEFAULT_ICON_PLACEHOLDER;
        img.className = 'extension-icon-small';
        img.alt = '';

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = sanitizeText(ext.name);

        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(img);
        itemDiv.appendChild(label);
        fragment.appendChild(itemDiv);
    });
    listEl.appendChild(fragment);
}

async function saveCurrentProfileConfiguration() {
    if (!currentConfiguringProfileId) return;
    hideProfilesModalMessage();
    hideFeedbackMessage('both', 'profile-config-shortcut');

    const profiles = await getProfiles();
    const profile = profiles[currentConfiguringProfileId];
    if (!profile) return;

    // --- Name Validation ---
    const newName = elements.profileConfigNameInput.value.trim();
    if (!newName) {
        showProfilesModalMessage("Profile name cannot be empty.", 'error');
        return;
    }
    const originalName = profile.name;
    // Check if renaming and if the new name is taken by another profile (by its 'name' property)
    if (newName.toLowerCase() !== originalName.toLowerCase() && Object.values(profiles).some(p => p.name.toLowerCase() === newName.toLowerCase() && p.id !== profile.id)) {
        showProfilesModalMessage(`Profile name "${sanitizeText(newName)}" already exists.`, 'error');
        return;
    }

    // --- Shortcut Validation ---
    const newShortcut = elements.profileConfigShortcutInput?.value.trim() || null;
    let validatedShortcut = null;
    if (newShortcut) {
        const validationResult = await validateShortcut(newShortcut, await getExistingShortcuts(null, currentConfiguringProfileId));
        if (validationResult.isValid) {
            validatedShortcut = validationResult.normalizedShortcut;
        } else {
            showProfileConfigShortcutMessage(`Shortcut error: ${validationResult.message}`, 'error');
            return;
        }
    }

    // --- Update Data ---
    const newExtensionStates = {};
    elements.profileConfigurationExtensionList?.querySelectorAll('.profile-config-ext-checkbox').forEach(checkbox => {
        newExtensionStates[checkbox.dataset.extensionId] = checkbox.checked;
    });
    
    profile.name = newName; // Update the 'name' property
    profile.extensionStates = newExtensionStates;
    profile.shortcut = validatedShortcut;
    
    // If it was a 'current_state' profile, editing it makes it a 'custom' one.
    if (profile.type === PROFILE_TYPE_CURRENT_STATE) {
        profile.type = 'custom';
    }

    await saveProfiles(profiles);
    
    showProfilesModalMessage(`Configuration saved for "${sanitizeText(profile.name)}".`, 'success', true);
    await registerKeyboardShortcuts();
}


async function handleProfilesModalListClick(event) {
    const target = event.target;

    if (target.matches('.profile-select-checkbox')) {
        const profileId = target.dataset.profileid;
        const item = target.closest('li');
        if (target.checked) {
            selectedProfileIds.add(profileId);
            item.classList.add('selected');
        } else {
            selectedProfileIds.delete(profileId);
            item.classList.remove('selected');
        }
        updateBulkDeleteProfilesUI();
        return;
    }

    const button = event.target.closest('button[data-profileid]');
    if (!button) return;
    const profileId = button.dataset.profileid;
    if (!profileId) return; 

    if (button.classList.contains('delete-profile-btn')) {
        await deleteProfiles(new Set([profileId]));
    } else if (button.classList.contains('apply-profile-btn')) {
        await applyProfile(profileId);
    } else if (button.classList.contains('configure-profile-btn')) {
        await switchToProfileConfigurationView(profileId);
    } else if (button.classList.contains('duplicate-profile-btn')) {
        await duplicateProfile(profileId);
    }
}

// --- Profile Bulk Selection ---
function updateBulkDeleteProfilesUI() {
    const bulkDeleteBtn = document.getElementById('modal-bulk-delete-profiles-btn');
    const selectAllCheckbox = document.getElementById('select-all-profiles-checkbox');
    if (!bulkDeleteBtn || !selectAllCheckbox) return;

    const count = selectedProfileIds.size;
    bulkDeleteBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    if (count > 0) {
        bulkDeleteBtn.textContent = `Delete Selected (${count})`;
    }

    const totalCheckboxes = elements.modalProfileList.querySelectorAll('.profile-select-checkbox').length;
    if (totalCheckboxes > 0 && count === totalCheckboxes) {
        selectAllCheckbox.checked = true;
        selectAllCheckbox.indeterminate = false;
    } else if (count > 0) {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = true;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}

function handleSelectAllProfilesChange(event) {
    const isChecked = event.target.checked;
    const checkboxes = elements.modalProfileList.querySelectorAll('.profile-select-checkbox');
    checkboxes.forEach(checkbox => {
        const profileId = checkbox.dataset.profileid;
        checkbox.checked = isChecked;
        const item = checkbox.closest('li');
        if (isChecked) {
            selectedProfileIds.add(profileId);
            item.classList.add('selected');
        } else {
            selectedProfileIds.delete(profileId);
            item.classList.remove('selected');
        }
    });
    updateBulkDeleteProfilesUI();
}

// --- Bulk Action Listeners Setup ---
function setupBulkActionListeners() {
    elements.selectAllCheckbox?.addEventListener('change', handleSelectAllChange);
    elements.bulkEnableButton?.addEventListener('click', () => performBulkAction('enable'));
    elements.bulkDisableButton?.addEventListener('click', () => performBulkAction('disable'));
    elements.bulkUninstallButton?.addEventListener('click', () => performBulkAction('uninstall'));
    elements.bulkAssignGroupSelect?.addEventListener('change', handleBulkAssignGroupChange);
}

// --- Global Keyboard Shortcut Management ---
function normalizeShortcut(shortcut) {
    if (!shortcut) return null;
    let parts = shortcut.toLowerCase().split('+').map(p => p.trim());
    let modifiers = [];
    let key = '';

    parts.forEach(part => {
        if (SHORTCUT_MODIFIER_KEYS.map(m => m.toLowerCase()).includes(part)) {
            modifiers.push(part.charAt(0).toUpperCase() + part.slice(1));
        } else if (VALID_SHORTCUT_KEYS.toLowerCase().includes(part)) {
            key = part.toUpperCase();
        }
    });

    if (!key) return null;
    if (modifiers.length > 2) return null;
    if (!modifiers.includes('Ctrl') && !modifiers.includes('Alt')) return null;

    modifiers.sort((a, b) => {
        if (a === 'Ctrl') return -1;
        if (b === 'Ctrl') return 1;
        if (a === 'Alt') return -1;
        if (b === 'Alt') return 1;
        return 0;
    });

    return [...modifiers, key].join('+');
}

async function getExistingShortcuts(excludeGroupName = null, excludeProfileId = null) {
    const existing = new Map();

    const profiles = await getProfiles();
    Object.entries(profiles).forEach(([id, data]) => {
        if (id !== excludeProfileId && data.shortcut) {
            existing.set(normalizeShortcut(data.shortcut), `Profile: "${data.name}"`);
        }
    });

    const groups = await getGroups();
    // Use Object.values to iterate over the group objects themselves, accessing their 'name' property
    Object.values(groups).forEach(groupData => {
        if (groupData.name !== excludeGroupName && groupData.shortcut) {
            existing.set(normalizeShortcut(groupData.shortcut), `Group: "${groupData.name}"`);
        }
    });
    return existing;
}

async function validateShortcut(shortcut, existingShortcuts) {
    const normalized = normalizeShortcut(shortcut);

    if (!normalized) {
        return { isValid: false, message: "Invalid format. Use Ctrl+Shift+<Key> or Alt+Shift+<Key>.", normalizedShortcut: null };
    }

    const parts = normalized.split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, parts.length - 1);

    if (key.length !== 1 || !VALID_SHORTCUT_KEYS.includes(key)) {
        return { isValid: false, message: `Invalid key "${key}". Must be a letter or number.`, normalizedShortcut: null };
    }
    if (modifiers.length === 0 || !modifiers.some(m => ['Ctrl', 'Alt'].includes(m))) {
        return { isValid: false, message: "Must include 'Ctrl' or 'Alt' modifier.", normalizedShortcut: null };
    }
    if (modifiers.length > 2 || (modifiers.includes('Shift') && (!modifiers.includes('Ctrl') && !modifiers.includes('Alt')))) {
        return { isValid: false, message: "Invalid combination. Use Ctrl+Shift+<Key> or Alt+Shift+<Key>.", normalizedShortcut: null };
    }
    
    if (existingShortcuts.has(normalized)) {
        return { isValid: false, message: `Shortcut already used by ${existingShortcuts.get(normalized)}.`, normalizedShortcut: null };
    }

    return { isValid: true, message: "Shortcut is valid.", normalizedShortcut: normalized };
}

async function handleShortcutInput(event) {
    const inputElement = event.target;
    const value = inputElement.value.trim();
    
    let feedbackLocation, excludeName, excludeId;
    
    if (inputElement === elements.profileConfigShortcutInput) {
        feedbackLocation = 'profile-config-shortcut';
        excludeId = currentConfiguringProfileId;
    } else if (inputElement === elements.groupConfigShortcutInput) {
        feedbackLocation = 'group-config-modal';
        excludeName = elements.groupConfigNameInput.value.trim(); // Get current name from input for group config
    }

    if (!value) {
        hideFeedbackMessage('both', feedbackLocation);
        return;
    }

    const validationResult = await validateShortcut(value, await getExistingShortcuts(excludeName, excludeId));
    showFeedbackMessage(validationResult.message, validationResult.isValid ? 'success' : 'error', feedbackLocation, true);
}


async function registerKeyboardShortcuts() {
    console.log("Registering keyboard shortcuts...");
    activeShortcutHandlers.forEach((handler) => {
        document.removeEventListener('keydown', handler);
    });
    activeShortcutHandlers.clear();

    const profiles = await getProfiles();
    const groups = await getGroups();

    Object.entries(profiles).forEach(([profileId, profile]) => {
        if (profile.shortcut) {
            const normalizedShortcut = normalizeShortcut(profile.shortcut);
            if (normalizedShortcut && !activeShortcutHandlers.has(normalizedShortcut)) {
                const handler = (event) => {
                    const shortcutPressed = [];
                    if (event.ctrlKey) shortcutPressed.push('Ctrl');
                    if (event.altKey) shortcutPressed.push('Alt');
                    if (event.shiftKey) shortcutPressed.push('Shift');
                    shortcutPressed.push(event.key.toUpperCase());
                    if (normalizeShortcut(shortcutPressed.join('+')) === normalizedShortcut) {
                        event.preventDefault();
                        applyProfile(profileId).then(() => window.close());
                    }
                };
                document.addEventListener('keydown', handler);
                activeShortcutHandlers.set(normalizedShortcut, handler);
            }
        }
    });

    Object.values(groups).forEach(groupData => { // Iterate over values (group objects)
        if (groupData.shortcut) {
            const normalizedShortcut = normalizeShortcut(groupData.shortcut);
            if (normalizedShortcut && !activeShortcutHandlers.has(normalizedShortcut)) {
                const handler = (event) => {
                    const shortcutPressed = [];
                    if (event.ctrlKey) shortcutPressed.push('Ctrl');
                    if (event.altKey) shortcutPressed.push('Alt');
                    if (event.shiftKey) shortcutPressed.push('Shift');
                    shortcutPressed.push(event.key.toUpperCase());
                    
                    if (normalizeShortcut(shortcutPressed.join('+')) === normalizedShortcut) {
                        event.preventDefault();
                        let targetState = null; // null means toggle
                        if (groupData.shortcutAction === 'enable') {
                            targetState = true;
                        } else if (groupData.shortcutAction === 'disable') {
                            targetState = false;
                        }
                        setGroupExtensionsState(groupData.name, targetState).then(() => window.close()); // Use groupData.name here
                    }
                };
                document.addEventListener('keydown', handler);
                activeShortcutHandlers.set(normalizedShortcut, handler);
            }
        }
    });
}


// --- Initialization ---
async function initializePopup() {
    console.log("modcore EM Popup Initializing (v4.4)...");
    
    const extListHeaderSpan = elements.extensionListHeader?.querySelector('span:not(.header-actions-label) em');
    if (extListHeaderSpan) extListHeaderSpan.remove();
    const groupModalTitle = elements.groupModal?.querySelector('#modal-group-list-section h3 .subtle-hint');
    if (groupModalTitle) groupModalTitle.remove();
    const profileModalTitle = elements.profilesModal?.querySelector('#modal-profile-list-section h3 .subtle-hint');
    if (profileModalTitle) profileModalTitle.remove();

    setupPagination();
    const { clearAllFilters } = await setupFiltersAndSearch(); 
    setupModalEventListeners();
    setupBulkActionListeners();

    elements.extensionList?.addEventListener('click', handleExtensionListClick);
    elements.extensionList?.addEventListener('change', (event) => {
        if (event.target.classList.contains('assign-group-select')) {
            handleAssignGroupChange(event);
        }
    });

    document.addEventListener('keydown', (event) => {
        const activeEl = document.activeElement;
        const isInputActive = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');

        // Global shortcuts that should work even if an input is not focused
        if (event.key === 'Escape') {
            if (elements.groupConfigurationModal?.style.display === 'flex') {
                switchToGroupListView();
            } else if (elements.groupModal?.classList.contains('visible')) {
                 closeGroupManagementModal();
            } else if (elements.profilesModal?.classList.contains('visible')) {
                if (currentConfiguringProfileId) {
                    switchToProfileListView(); 
                } else {
                    closeProfilesModal(); 
                }
            } else if (elements.helpModal?.classList.contains('visible')) { // New: Close help modal on Escape
                closeHelpModal();
            }
        }


        // Shortcuts that should NOT fire when typing in an input field
        if (isInputActive && event.key !== 'Escape') {
            return;
        }

        if (event.key === '/') {
            event.preventDefault();
            elements.searchInput?.focus();
            elements.searchInput?.select();
        }
        
        // New shortcuts
        if (event.ctrlKey && event.shiftKey) {
            switch (event.key.toUpperCase()) {
                case 'G':
                    event.preventDefault();
                    openGroupManagementModal();
                    break;
                case 'P':
                    event.preventDefault();
                    openProfilesModal();
                    break;
                case 'A':
                    event.preventDefault();
                    if (elements.selectAllCheckbox && !elements.selectAllCheckbox.disabled) {
                        elements.selectAllCheckbox.click();
                    }
                    break;
                case 'F':
                    event.preventDefault();
                    clearAllFilters();
                    break;
                case 'H': // Updated: Open help modal
                    event.preventDefault();
                    openHelpModal();
                    break;
            }
        }
        
        if (event.altKey) {
            switch(event.key) {
                case 'ArrowRight':
                    event.preventDefault();
                    if (elements.nextPageButton && !elements.nextPageButton.disabled) {
                        elements.nextPageButton.click();
                    }
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    if (elements.prevPageButton && !elements.prevPageButton.disabled) {
                        elements.prevPageButton.click();
                    }
                    break;
            }
        }
    });

    await refreshExtensionDataAndRender(1); 
    
    elements.searchInput?.focus({ preventScroll: true });

    await registerKeyboardShortcuts();

    console.log("modcore EM Popup Initialized.");
}

document.addEventListener('DOMContentLoaded', initializePopup);
