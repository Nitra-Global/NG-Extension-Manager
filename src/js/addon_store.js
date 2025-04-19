/**
 * Nitra Add-on Store v2.0
 * Handles fetching, displaying, and managing Add-ons from a GitHub repository
 * Includes Service Status Check, Changelog display, and enhanced Caching/Error Handling.
 */

// --- Configuration ---
const CONFIG = {
    repoOwner: 'Nitra-Global',
    repoName: 'addons',
    addOnsPath: 'Add-on%20Store%20NGEM', // URL-encoded path within the repo
    serviceStatusFile: 'service-status.json',
    get repoApiUrl() {
        return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.addOnsPath}`;
    },
    get rawUrlBase() {
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/${this.addOnsPath}/`;
    },
    get serviceStatusUrl() {
        // Assumes service-status.json is at the ROOT of the main branch
        return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/${this.serviceStatusFile}`;
    },
    addOnsPerPage: 10,
    storageKeys: {
        addOnList: 'addOnList',
        lastFetchedList: 'lastFetchedListTimestamp',
        serviceStatus: 'serviceStatus',
        lastFetchedStatus: 'lastFetchedStatusTimestamp',
        addOnDataPrefix: 'addOnData_', // Prefix for individual add-on data cache
    },
    cacheTTL: {
        list: 3600000,       // 1 hour for the main add-on list
        status: 300000,      // 5 minutes for the service status
        individualAddOn: 86400000 // 24 hours for individual add-on details (addon.json, changelog.json)
    },
    fetchTimeout: 10000, // 10 seconds
    fetchRetries: 2,
};

// --- State Management ---
const state = {
    currentPage: 1,
    allAddOns: [],      // Holds the list of add-on directory info { name, path, sha, ... }
    isLoading: false,
    hasError: false,    // General error flag
    errorMessage: '',   // General error message
    serviceStatus: {    // Holds status like { status: 'online' | 'offline' | 'maintenance', message: '...' }
        status: 'unknown',
        message: '',
    },
};

// --- DOM Elements (Cached for performance) ---
const DOM = {
    get searchInput() { return document.getElementById('search-input'); },
    get refreshButton() { return document.getElementById('refresh-button'); },
    get addOnListContainer() { return document.getElementById('addon-list'); },
    get paginationContainer() { return document.getElementById('pagination'); },
    get errorNotificationBar() { return document.getElementById('error-notification'); },
    get errorNotificationMessage() { return document.getElementById('error-notification-message'); },
    get errorCloseButton() { return document.querySelector('#error-notification .error-close-button'); },
    get versionElement() { return document.getElementById('extension-version'); },
    // Modals
    get instructionModal() { return document.getElementById('instruction-modal'); },
    get instructionModalContent() { return document.querySelector('#instruction-modal .modal-content'); },
    get instructionModalCloseButton() { return document.querySelector('#instruction-modal .close-button'); },
    get modalAddonNameElement() { return document.getElementById('modal-addon-name'); },
    get goToGitHubButton() { return document.getElementById('go-to-addon-button'); },
    get changelogModal() { return document.getElementById('changelog-modal'); },
    get changelogModalContent() { return document.querySelector('#changelog-modal .modal-content'); },
    get changelogModalCloseButton() { return document.querySelector('#changelog-modal .close-button'); },
    get changelogModalAddonName() { return document.getElementById('changelog-modal-addon-name'); },
    get changelogContentContainer() { return document.getElementById('changelog-content'); },
    // Service Status
    get serviceStatusOverlay() { return document.getElementById('service-status-overlay'); },
    get serviceStatusTitle() { return document.getElementById('service-status-title'); },
    get serviceStatusMessage() { return document.getElementById('service-status-message'); },
};

// --- Utility Functions ---

/**
 * Basic sanitization against XSS for text content.
 * @param {*} unsafe - Input to sanitize.
 * @returns {string} Sanitized string.
 */
function sanitizeHTML(unsafe) {
    if (unsafe === null || typeof unsafe === 'undefined') return '';
    return unsafe
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Debounces a function.
 * @param {Function} func The function to debounce.
 * @param {number} wait The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Generic fetch wrapper with timeout and retries.
 * @param {string} url - The URL to fetch.
 * @param {object} options - Fetch options (e.g., headers, signal).
 * @param {number} timeout - Timeout in milliseconds.
 * @param {number} retries - Number of retries left.
 * @returns {Promise<Response>} - The fetch Response object.
 * @throws {Error} - Throws specific errors for timeout, network issues, or bad HTTP status.
 */
async function fetchWithTimeout(url, options = {}, timeout = CONFIG.fetchTimeout, retries = CONFIG.fetchRetries) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    let wasAborted = false;

    try {
        console.debug(`Fetching: ${url} (Retries left: ${retries})`);
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId); // Clear timeout if fetch completes successfully

        if (!response.ok) {
            let errorData = { message: `HTTP error ${response.status}` };
            try {
                errorData = await response.json(); // Try to get more details from API
            } catch (e) { /* Ignore if response body isn't JSON */ }
            throw new Error(`GitHub API Error: ${response.status} ${response.statusText}. ${errorData.message || ''}`);
        }
        return response;

    } catch (error) {
        clearTimeout(timeoutId); // Clear timeout on any error
        if (error.name === 'AbortError') {
            wasAborted = true; // Specifically mark timeout
            console.warn(`Request timed out: ${url}`);
            if (retries > 0) {
                console.log(`Retrying fetch... (${retries} retries left)`);
                return fetchWithTimeout(url, options, timeout, retries - 1); // Retry
            } else {
                throw new Error(`Request timed out after ${CONFIG.fetchRetries + 1} attempts: ${url}`);
            }
        }
        // Handle other network errors or errors thrown from !response.ok
        console.error(`Fetch error for ${url}:`, error);
         // Don't retry for non-timeout errors unless specifically designed to
         if (!wasAborted && retries > 0) {
             console.log(`Retrying fetch due to error... (${retries} retries left)`);
             // Optional: Add delay before retry?
             // await new Promise(resolve => setTimeout(resolve, 1000));
             return fetchWithTimeout(url, options, timeout, retries - 1); // Retry other errors too
         }
        throw error; // Re-throw the original or timeout error if retries exhausted
    }
}


// --- Caching Logic ---

/**
 * Retrieves an item from local storage cache if not expired.
 * @param {string} key - The storage key.
 * @param {string} timestampKey - The key for the timestamp.
 * @param {number} ttl - Time-to-live in milliseconds.
 * @returns {Promise<any|null>} Cached data or null if not found/expired.
 */
async function getCachedItem(key, timestampKey, ttl) {
    try {
        const data = await chrome.storage.local.get([key, timestampKey]);
        const item = data[key];
        const lastFetched = data[timestampKey] || 0;

        if (!item) {
             console.debug(`Cache miss for key: ${key}`);
            return null; // Not in cache
        }

        if (Date.now() - lastFetched > ttl) {
            console.log(`Cache expired for key: ${key}. TTL: ${ttl}ms, Elapsed: ${Date.now() - lastFetched}ms`);
            // Optionally remove expired item
            await chrome.storage.local.remove([key, timestampKey]);
            return null; // Expired
        }

        console.debug(`Cache hit for key: ${key}`);
        return item;
    } catch (error) {
        console.error(`Error retrieving cached item for key ${key}:`, error);
        return null; // Error retrieving
    }
}

/**
 * Stores an item in the local storage cache with a timestamp.
 * @param {string} key - The storage key.
 * @param {any} item - The data to store.
 * @param {string} timestampKey - The key for the timestamp.
 */
async function cacheItem(key, item, timestampKey) {
    try {
        await chrome.storage.local.set({
            [key]: item,
            [timestampKey]: Date.now()
        });
        console.debug(`Item cached successfully for key: ${key}`);
    } catch (error) {
        console.error(`Error caching item for key ${key}:`, error);
    }
}

/** Clears all known cache keys. */
async function clearAllCache() {
    console.log("Clearing all Add-on Store cache...");
    const keysToRemove = [
        CONFIG.storageKeys.addOnList,
        CONFIG.storageKeys.lastFetchedList,
        CONFIG.storageKeys.serviceStatus,
        CONFIG.storageKeys.lastFetchedStatus,
    ];
    try {
        const allStorage = await chrome.storage.local.get(null);
        for (const key in allStorage) {
            if (key.startsWith(CONFIG.storageKeys.addOnDataPrefix)) {
                keysToRemove.push(key);
            }
        }
        if (keysToRemove.length > 0) {
            console.debug("Removing keys:", keysToRemove);
            await chrome.storage.local.remove(keysToRemove);
            console.log("Cache cleared.");
        } else {
            console.log("No relevant cache keys found to clear.");
        }
    } catch (error) {
        console.error("Error clearing cache:", error);
        // Decide if this should be a fatal error or just logged
        throw new Error("Failed to clear cache."); // Propagate error
    }
}


// --- Core Fetching Logic ---

/**
 * Fetches the service status (online, offline, maintenance).
 * Checks cache first.
 * @param {boolean} forceRefresh - If true, bypasses cache.
 * @returns {Promise<object>} Service status object { status, message }.
 */
async function fetchServiceStatus(forceRefresh = false) {
    const cacheKey = CONFIG.storageKeys.serviceStatus;
    const timestampKey = CONFIG.storageKeys.lastFetchedStatus;
    const ttl = CONFIG.cacheTTL.status;

    if (!forceRefresh) {
        const cachedStatus = await getCachedItem(cacheKey, timestampKey, ttl);
        if (cachedStatus) {
            return cachedStatus;
        }
    }

    console.log("Fetching fresh service status...");
    try {
        const response = await fetchWithTimeout(CONFIG.serviceStatusUrl, {
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' } // Ensure we get latest status file
        });
        const statusData = await response.json();

        // Validate status data structure (basic)
        if (typeof statusData.status !== 'string' || !['online', 'offline', 'maintenance'].includes(statusData.status)) {
            throw new Error("Invalid service status format received.");
        }

        const newStatus = {
            status: statusData.status,
            message: statusData.message || '' // Use provided message or default to empty
        };

        await cacheItem(cacheKey, newStatus, timestampKey);
        return newStatus;

    } catch (error) {
        console.error("Error fetching or parsing service status:", error);
        // Fallback status on error - treat as 'unknown' or maybe 'offline'?
        // Let's treat as potentially offline to be safe, but log the error.
        return {
            status: 'offline', // Or 'unknown'
            message: `Could not fetch service status. Please try again later. (${error.message})`
        };
    }
}


/**
 * Fetches the list of Add-on directories from GitHub.
 * Checks cache first.
 * @param {boolean} forceRefresh - If true, bypasses cache.
 * @returns {Promise<Array>} Array of Add-on directory objects.
 */
async function fetchAddOns(forceRefresh = false) {
    state.isLoading = true;
    let fetchErrorOccurred = false; // Flag to track if error happened during fetch attempt
    updateUIState(); // Show loading indicator

    const cacheKey = CONFIG.storageKeys.addOnList;
    const timestampKey = CONFIG.storageKeys.lastFetchedList;
    const ttl = CONFIG.cacheTTL.list;

    if (!forceRefresh) {
        const cachedAddOns = await getCachedItem(cacheKey, timestampKey, ttl);
        if (cachedAddOns && cachedAddOns.length > 0) { // Ensure cache is not empty
            console.log("Using valid cached Add-on list.");
            state.allAddOns = cachedAddOns;
            state.isLoading = false;
            state.hasError = false;
            updateUIState();
            return cachedAddOns;
        } else if (cachedAddOns) {
             console.log("Cached Add-on list exists but is empty. Fetching fresh list.");
        }
    }

    console.log(`Fetching fresh Add-on list from: ${CONFIG.repoApiUrl}`);
    try {
        const response = await fetchWithTimeout(CONFIG.repoApiUrl, {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error('Invalid response format from GitHub API. Expected an array.');
        }

        // Filter for directories only
        const addOns = data.filter(item => item.type === 'dir');
        if (addOns.length === 0) {
            console.warn('No Add-on directories found in the repository path.');
        } else {
            console.log(`Found ${addOns.length} Add-on directories.`);
        }

        await cacheItem(cacheKey, addOns, timestampKey);
        state.allAddOns = addOns;
        state.hasError = false;
        state.errorMessage = '';
        return addOns;

    } catch (error) {
        fetchErrorOccurred = true; // Mark that fetch failed
        console.error("Error fetching Add-on list:", error);
        state.errorMessage = `Could not load Add-on list: ${error.message}`;
        state.hasError = true;
        state.allAddOns = []; // Clear potentially stale data

        // Attempt to use expired cache as a last resort if fetch fails
        if (!forceRefresh) { // Don't use expired cache if user forced refresh
            try {
                 const allStorage = await chrome.storage.local.get([cacheKey]); // Get potentially expired item
                 const expiredCache = allStorage[cacheKey];
                 if (expiredCache && expiredCache.length > 0) {
                     console.warn("Using expired cached Add-on list due to fetch failure.");
                     state.allAddOns = expiredCache;
                     // Keep hasError=true and errorMessage to indicate data might be stale
                     // state.hasError = false; // Optionally hide error if showing stale data
                     return expiredCache;
                 }
            } catch (cacheError) {
                 console.error("Error trying to access expired cache:", cacheError)
            }
        }
        return []; // Return empty on definite failure

    } finally {
        state.isLoading = false;
         // Update UI only if not using cached data (which updates UI earlier)
         // Or if an error occurred during the fetch attempt.
         const usingValidCache = !forceRefresh && !fetchErrorOccurred && (await getCachedItem(cacheKey, timestampKey, ttl));
         if (!usingValidCache || fetchErrorOccurred) {
            updateUIState();
         }
    }
}


/**
 * Fetches individual Add-on metadata (addon.json) and changelog (changelog.json).
 * Checks cache first. Fetches concurrently if cache miss.
 * @param {string} addOnName - Name of the Add-on directory.
 * @param {boolean} forceRefresh - If true, bypasses cache for this specific add-on.
 * @returns {Promise<Object|null>} Object containing { data: addonJsonData, changelog: changelogJsonData } or null if critical data fetch fails.
 */
async function getAddOnData(addOnName, forceRefresh = false) {
    if (!addOnName) {
        console.error("getAddOnData called with invalid name.");
        return null;
    }

    const cacheKey = `${CONFIG.storageKeys.addOnDataPrefix}${addOnName}`;
    // Use a single timestamp for both addon.json and changelog.json for simplicity
    const timestampKey = `${cacheKey}_timestamp`;
    const ttl = CONFIG.cacheTTL.individualAddOn;

    if (!forceRefresh) {
        const cachedBundle = await getCachedItem(cacheKey, timestampKey, ttl);
        if (cachedBundle) {
             // We expect cachedBundle to be { data: ..., changelog: ... }
            return cachedBundle;
        }
    }

    console.log(`Fetching fresh data for Add-on: ${addOnName}`);
    const addOnJsonUrl = `${CONFIG.rawUrlBase}${encodeURIComponent(addOnName)}/addon.json`;
    const changelogJsonUrl = `${CONFIG.rawUrlBase}${encodeURIComponent(addOnName)}/changelog.json`;

    try {
        const results = await Promise.allSettled([
            fetchWithTimeout(addOnJsonUrl, { headers: { 'Accept': 'application/json' } }),
            fetchWithTimeout(changelogJsonUrl, { headers: { 'Accept': 'application/json' } })
        ]);

        let addOnData = null;
        let changelogData = null;
        let fetchError = null;

        // Process addon.json result
        const addOnResult = results[0];
        if (addOnResult.status === 'fulfilled') {
            try {
                addOnData = await addOnResult.value.json();
                // Basic validation
                if (!addOnData || typeof addOnData.name !== 'string' || typeof addOnData.description !== 'string') {
                     console.warn(`Invalid or incomplete addon.json for "${addOnName}". Missing required fields.`);
                     // Treat as if not found if essential fields missing
                     addOnData = null;
                     // Don't throw error yet, maybe changelog worked
                }
            } catch (e) {
                 console.error(`Error parsing addon.json for ${addOnName}:`, e);
                 fetchError = fetchError || e; // Store first parsing error
                 addOnData = null;
            }
        } else {
            // Handle fetch error for addon.json
             if (addOnResult.reason && addOnResult.reason.message && addOnResult.reason.message.includes('404')) {
                 console.warn(`addon.json not found for "${addOnName}" (404).`);
                 // This might be acceptable, depends on requirements. Treat as null.
                 addOnData = null;
             } else {
                console.error(`Failed to fetch addon.json for ${addOnName}:`, addOnResult.reason);
                fetchError = fetchError || addOnResult.reason; // Store fetch error
                 addOnData = null;
             }
        }

        // Process changelog.json result
        const changelogResult = results[1];
         if (changelogResult.status === 'fulfilled') {
            try {
                changelogData = await changelogResult.value.json();
                 // Basic validation (array of versions)
                 if (!Array.isArray(changelogData)) {
                      console.warn(`Invalid changelog.json format for "${addOnName}". Expected an array.`);
                      changelogData = null; // Treat invalid format as not found
                 }
            } catch (e) {
                 console.error(`Error parsing changelog.json for ${addOnName}:`, e);
                 // Non-critical if changelog fails to parse, just set to null
                 changelogData = null;
                 // fetchError = fetchError || e; // Optionally track changelog parse errors
            }
         } else {
            // Handle fetch error for changelog.json (less critical than addon.json)
            if (changelogResult.reason && changelogResult.reason.message && changelogResult.reason.message.includes('404')) {
                 console.debug(`changelog.json not found for "${addOnName}" (404).`); // Debug level is fine
            } else {
                 console.warn(`Failed to fetch changelog.json for ${addOnName}:`, changelogResult.reason);
            }
             changelogData = null; // Set to null if fetch fails
         }

        // Decide what to return and cache
        if (addOnData === null && fetchError) {
             // If addon.json failed critically (fetch or parse error other than 404 maybe)
             console.error(`Critical failure fetching data for ${addOnName}. Error: ${fetchError.message}`);
             // Don't cache failures unless specifically intended
             return null; // Indicate failure
         }

        // Cache the bundle (even if changelog is null, cache the result)
        const dataBundle = { data: addOnData, changelog: changelogData };
         await cacheItem(cacheKey, dataBundle, timestampKey);
         console.log(`Fetched and cached data bundle for Add-on: ${addOnName}`);
         return dataBundle; // Return whatever we got (addon.json might be null if 404'd)

    } catch (error) {
        // Catch errors from Promise.allSettled itself (unlikely)
        console.error(`Unexpected error in getAddOnData for ${addOnName}:`, error);
        return null;
    }
}


// --- UI Rendering Logic ---

/** Creates the HTML for a single Add-on card. */
function createAddOnCardHTML(addOnDirInfo, addOnBundle) {
    const addOnData = addOnBundle?.data; // From addon.json
    const changelogData = addOnBundle?.changelog; // From changelog.json
    const dirName = sanitizeHTML(addOnDirInfo.name);

    let cardContent = '';
    let cardClass = 'addon-card'; // Base class

    if (state.isLoading && !addOnBundle) {
        // Loading state specific to this card
        cardContent = `
            <h3>${dirName}</h3>
            <p class="loading-text">Loading details...</p>
            <div class="addon-actions"></div>
        `;
    } else if (addOnData) {
        // Data loaded successfully
        const name = sanitizeHTML(addOnData.name);
        const description = sanitizeHTML(addOnData.description);
        const version = addOnData.version ? `<span class="addon-version">v${sanitizeHTML(addOnData.version)}</span>` : '';
        const hasChangelog = changelogData && changelogData.length > 0;

        cardContent = `
            <h3>${name} ${version}</h3>
            <p>${description || 'No description provided.'}</p>
            <div class="addon-actions">
                ${hasChangelog ? `<button class="changelog-button" data-addon-name="${addOnDirInfo.name}">Changelog</button>` : ''}
                <button class="install-addon-button" data-addon-name="${addOnDirInfo.name}">Install</button>
            </div>
        `;
    } else {
        // Failed to load addon.json or data was invalid
        cardClass += ' addon-card-error'; // Add error class for styling
        cardContent = `
            <h3>${dirName}</h3>
            <p class="error-text">Could not load Add-on details.</p>
            <div class="addon-actions">
                <button class="retry-button" data-addon-name="${addOnDirInfo.name}">Retry</button>
            </div>
        `;
    }

    return `<div class="${cardClass}" data-addon-name="${addOnDirInfo.name}">${cardContent}</div>`;
}

/** Displays filtered Add-ons based on search input and current page. */
async function displayAddOns() {
    const container = DOM.addOnListContainer;
    const paginationContainer = DOM.paginationContainer;
    if (!container || !paginationContainer) {
        console.error("Add-on list or pagination container not found!");
        setErrorState("UI Error: Could not find essential page elements.");
        return;
    }

    // Clear previous content and pagination
    container.innerHTML = '';
    paginationContainer.innerHTML = '';

     // Handle Service Status Overlay first
     if (state.serviceStatus.status !== 'online') {
        showServiceStatusOverlay();
         // Optionally hide search/refresh controls when offline/maintenance
         // DOM.controls?.[...]?.style.display = 'none';
        return; // Stop rendering add-ons
     } else {
         hideServiceStatusOverlay();
         // Ensure controls are visible
         // DOM.controls?.[...]?.style.display = 'flex';
     }


    // Handle general loading/error states for the whole list
    if (state.isLoading && state.allAddOns.length === 0) {
        container.innerHTML = '<div class="loading-indicator">Loading Add-ons...</div>';
        return;
    }
    if (state.hasError && state.allAddOns.length === 0) {
        // Display general error only if list couldn't be loaded at all (and no cache)
        container.innerHTML = `<div class="error-message">${sanitizeHTML(state.errorMessage)}</div>`;
        return;
    }
    if (!state.isLoading && !state.hasError && state.allAddOns.length === 0) {
        container.innerHTML = '<div class="no-results">No Add-ons found in the store.</div>';
        return;
    }

    // Filter Add-ons
    const searchInput = DOM.searchInput?.value.toLowerCase().trim() || '';
    let filteredAddOns = state.allAddOns;
    if (searchInput) {
        // Search in directory name AND potentially fetched addon.json name/description later
        filteredAddOns = filteredAddOns.filter(addOnDir =>
            addOnDir.name.toLowerCase().includes(searchInput)
            // TODO: Enhance filtering after data fetch? More complex.
        );
    }

    if (filteredAddOns.length === 0 && searchInput) {
        container.innerHTML = `<div class="no-results">No Add-ons found matching "${sanitizeHTML(searchInput)}".</div>`;
        return; // No pagination needed
    }
     if (filteredAddOns.length === 0 && !searchInput) {
         // This case should be covered by the earlier check, but defensively:
         container.innerHTML = '<div class="no-results">No Add-ons available.</div>';
         return;
     }


    // Calculate pagination
    const totalItems = filteredAddOns.length;
    const totalPages = Math.ceil(totalItems / CONFIG.addOnsPerPage);
    state.currentPage = Math.max(1, Math.min(state.currentPage, totalPages)); // Clamp page number
    const start = (state.currentPage - 1) * CONFIG.addOnsPerPage;
    const end = start + CONFIG.addOnsPerPage;
    const addOnsToDisplay = filteredAddOns.slice(start, end);

    // Fetch data and create card HTML (concurrently)
    const cardPromises = addOnsToDisplay.map(async (addOnDirInfo) => {
        // Pass forceRefresh=false, getAddOnData handles its own cache logic
        const addOnBundle = await getAddOnData(addOnDirInfo.name, false);
        return createAddOnCardHTML(addOnDirInfo, addOnBundle);
    });

    const cardHTMLs = await Promise.all(cardPromises);
    container.innerHTML = cardHTMLs.join(''); // Render all cards at once

    // Display pagination controls
    displayPagination(totalItems);
}


/** Displays pagination controls. */
function displayPagination(totalItems) {
    const paginationContainer = DOM.paginationContainer;
     if (!paginationContainer) return; // Guard
    paginationContainer.innerHTML = ''; // Clear previous

    const totalPages = Math.ceil(totalItems / CONFIG.addOnsPerPage);
    if (totalPages <= 1) return; // No pagination needed

    const createButton = (page, text, isCurrent, isDisabled, ariaLabel, extraClass = '') => {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.disabled = isDisabled;
        btn.setAttribute('aria-label', ariaLabel);
        if (isCurrent) {
            btn.className = 'pagination-current';
            btn.setAttribute('aria-current', 'page');
        }
        if (extraClass) btn.classList.add(extraClass);
        btn.addEventListener('click', () => {
            if (state.currentPage !== page) {
                state.currentPage = page;
                displayAddOns();
                DOM.addOnListContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
        return btn;
    };

    const createEllipsis = () => {
        const span = document.createElement('span');
        span.textContent = '...';
        span.className = 'pagination-ellipsis';
        span.setAttribute('aria-hidden', 'true');
        return span;
    };

    // Previous Button
    paginationContainer.appendChild(createButton(state.currentPage - 1, '← Previous', false, state.currentPage === 1, 'Go to previous page', 'pagination-prev'));

    // Page Number Logic (simplified example)
    const maxPagesToShow = 5; // Max numeric buttons
    let startPage, endPage;

     if (totalPages <= maxPagesToShow + 2) { // Show all if few pages
         startPage = 1;
         endPage = totalPages;
     } else {
         // Logic for ellipsis
         const maxSide = Math.floor((maxPagesToShow -1) / 2);
         if (state.currentPage <= maxSide + 1) {
             startPage = 1;
             endPage = maxPagesToShow;
         } else if (state.currentPage >= totalPages - maxSide) {
             startPage = totalPages - maxPagesToShow + 1;
             endPage = totalPages;
         } else {
             startPage = state.currentPage - maxSide;
             endPage = state.currentPage + maxSide;
         }
     }

     // Page 1 and Ellipsis
     if (startPage > 1) {
         paginationContainer.appendChild(createButton(1, '1', false, false, 'Go to page 1'));
         if (startPage > 2) paginationContainer.appendChild(createEllipsis());
     }

     // Middle Pages
     for (let i = startPage; i <= endPage; i++) {
         paginationContainer.appendChild(createButton(i, i.toString(), i === state.currentPage, false, `Go to page ${i}`));
     }

     // Ellipsis and Last Page
     if (endPage < totalPages) {
         if (endPage < totalPages - 1) paginationContainer.appendChild(createEllipsis());
         paginationContainer.appendChild(createButton(totalPages, totalPages.toString(), false, false, `Go to page ${totalPages}`));
     }

    // Next Button
    paginationContainer.appendChild(createButton(state.currentPage + 1, 'Next →', false, state.currentPage === totalPages, 'Go to next page', 'pagination-next'));
}


/** Updates UI elements based on the global state (loading, error). */
function updateUIState() {
    // Refresh button state
    if (DOM.refreshButton) {
        DOM.refreshButton.disabled = state.isLoading;
        DOM.refreshButton.textContent = state.isLoading ? 'Loading...' : 'Refresh';
    }

    // Error Notification Bar (for persistent errors)
    if (DOM.errorNotificationBar && DOM.errorNotificationMessage) {
         // Show persistent error bar ONLY if the service status is online
         // AND there's a general error AND the add-on list is completely empty.
         // Card-specific errors are handled within the card rendering.
        if (state.hasError && state.allAddOns.length === 0 && state.serviceStatus.status === 'online') {
            DOM.errorNotificationMessage.textContent = state.errorMessage;
            DOM.errorNotificationBar.style.display = 'block';
        } else {
            DOM.errorNotificationBar.style.display = 'none';
        }
    }

    // Re-render the main content area
     // displayAddOns handles showing loading/error states within its container too
     // Avoid calling displayAddOns directly here if it was already called by the function triggering the state change
     // For example, fetchAddOns calls updateUIState AND displayAddOns internally in some paths.
     // Consider if a more targeted UI update is needed instead of full re-render every time.
     // For now, we let displayAddOns handle the rendering based on the state.
     // displayAddOns(); // Potentially redundant if called elsewhere
}

/** Sets the global error state and updates UI. */
function setErrorState(message) {
    state.hasError = true;
    state.errorMessage = message;
    state.isLoading = false; // Ensure loading is off on error
    updateUIState();
    // Also explicitly call displayAddOns here if the error should clear the list/show message
     displayAddOns();
}

/** Clears the global error state. */
function clearErrorState() {
    state.hasError = false;
    state.errorMessage = '';
    // Don't hide the bar immediately, updateUIState will handle it based on conditions
    // if (DOM.errorNotificationBar) DOM.errorNotificationBar.style.display = 'none';
}

// --- Modal Logic ---

function closeModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'none';
        // Remove event listeners added specifically for this modal instance if necessary
    }
}

function openModal(modalElement) {
    if (modalElement) {
        modalElement.style.display = 'block';
        // Add closing listeners
        const closeBtn = modalElement.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.onclick = () => closeModal(modalElement); // Simple onclick is fine here
        }
        // Close on clicking background
        window.onclick = (event) => {
            if (event.target === modalElement) {
                closeModal(modalElement);
            }
        };
    } else {
        console.error("Attempted to open a modal that wasn't found.");
    }
}

/** Opens the installation instruction modal. */
function openInstallModal(addOnName) {
    const modal = DOM.instructionModal;
    if (!modal || !DOM.modalAddonNameElement || !DOM.goToGitHubButton) {
        console.error("Instruction modal elements not found.");
        return;
    }
    DOM.modalAddonNameElement.textContent = sanitizeHTML(addOnName);
    const githubUrl = `https://github.com/${CONFIG.repoOwner}/${CONFIG.repoName}/tree/main/${CONFIG.addOnsPath}/${encodeURIComponent(addOnName)}`;
    console.log(`Setting modal GitHub link to: ${githubUrl}`);
    DOM.goToGitHubButton.onclick = () => { // Use onclick for simplicity
        window.open(githubUrl, '_blank', 'noopener,noreferrer');
    };
    openModal(modal);
}

/** Opens the changelog modal and populates it. */
async function openChangelogModal(addOnName) {
    const modal = DOM.changelogModal;
    const nameElement = DOM.changelogModalAddonName;
    const contentContainer = DOM.changelogContentContainer;

    if (!modal || !nameElement || !contentContainer) {
        console.error("Changelog modal elements not found.");
        return;
    }

    nameElement.textContent = sanitizeHTML(addOnName);
    contentContainer.innerHTML = '<p class="loading-text">Loading changelog...</p>'; // Show loading state
    openModal(modal);

    try {
        // Fetch data again (should hit cache unless expired/forced)
        const addOnBundle = await getAddOnData(addOnName);
        const changelog = addOnBundle?.changelog;

        if (changelog && Array.isArray(changelog) && changelog.length > 0) {
            let changelogHTML = '';
            // Sort changelog by version (descending) - assuming version is sortable string like '1.2.3'
            // Basic semantic version sort (adjust if versions are dates or other formats)
             try {
                 changelog.sort((a, b) => {
                     const partsA = a.version.split('.').map(Number);
                     const partsB = b.version.split('.').map(Number);
                     for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
                         const numA = partsA[i] || 0;
                         const numB = partsB[i] || 0;
                         if (numA < numB) return 1; // Descending
                         if (numA > numB) return -1;
                     }
                     return 0;
                 });
             } catch (sortError) {
                 console.warn(`Could not sort changelog versions for ${addOnName}. Displaying in original order.`, sortError);
             }


            changelog.forEach(entry => {
                const version = sanitizeHTML(entry.version);
                const date = entry.date ? `<span class="changelog-date">(${sanitizeHTML(entry.date)})</span>` : '';
                let changesHTML = '<ul>';
                if (Array.isArray(entry.changes)) {
                    entry.changes.forEach(change => {
                        changesHTML += `<li>${sanitizeHTML(change)}</li>`;
                    });
                } else {
                     changesHTML += `<li>No specific changes listed.</li>`; // Handle missing changes array
                }
                changesHTML += '</ul>';

                changelogHTML += `
                    <div class="changelog-version">
                        <h4>Version ${version} ${date}</h4>
                        ${changesHTML}
                    </div>
                `;
            });
            contentContainer.innerHTML = changelogHTML;
        } else if (changelog === null && addOnBundle?.data) {
             // addon.json loaded, but changelog didn't (e.g., 404)
             contentContainer.innerHTML = '<p class="no-results">No changelog file (changelog.json) found for this add-on.</p>';
        } else {
            // Failed to load addon data bundle entirely
            contentContainer.innerHTML = '<p class="error-text">Could not load changelog information.</p>';
        }
    } catch (error) {
        console.error(`Error loading changelog for ${addOnName}:`, error);
        contentContainer.innerHTML = `<p class="error-text">Error loading changelog: ${error.message}</p>`;
    }
}

// --- Service Status UI ---

function showServiceStatusOverlay() {
    const overlay = DOM.serviceStatusOverlay;
    const title = DOM.serviceStatusTitle;
    const message = DOM.serviceStatusMessage;
    if (!overlay || !title || !message) return;

    title.textContent = `Store Status: ${state.serviceStatus.status.charAt(0).toUpperCase() + state.serviceStatus.status.slice(1)}`;
    message.textContent = sanitizeHTML(state.serviceStatus.message || 'The add-on store is currently unavailable.');

    overlay.classList.remove('offline', 'maintenance'); // Clear previous states
    if (state.serviceStatus.status === 'offline') {
        overlay.classList.add('offline');
    } else if (state.serviceStatus.status === 'maintenance') {
        overlay.classList.add('maintenance');
    }

    overlay.style.display = 'block';
    DOM.addOnListContainer.style.display = 'none'; // Hide add-on list
    DOM.paginationContainer.style.display = 'none'; // Hide pagination
}

function hideServiceStatusOverlay() {
    const overlay = DOM.serviceStatusOverlay;
     if (overlay) overlay.style.display = 'none';
     if (DOM.addOnListContainer) DOM.addOnListContainer.style.display = 'grid'; // Restore display type
     if (DOM.paginationContainer) DOM.paginationContainer.style.display = 'flex'; // Restore display type
}


// --- Event Handlers ---

/** Handles clicks within the add-on list container (delegated). */
async function handleAddOnListClick(event) {
    const target = event.target;

    // Install button
    if (target.matches('.install-addon-button')) {
        const addOnName = target.dataset.addonName;
        if (addOnName) {
            openInstallModal(addOnName);
        } else {
            console.error("Install button clicked, but 'data-addon-name' is missing.");
        }
        return; // Prevent further actions
    }

    // Changelog button
    if (target.matches('.changelog-button')) {
        const addOnName = target.dataset.addonName;
        if (addOnName) {
            await openChangelogModal(addOnName); // Make sure it's async if needed
        } else {
            console.error("Changelog button clicked, but 'data-addon-name' is missing.");
        }
        return; // Prevent further actions
    }

    // Retry button
    if (target.matches('.retry-button')) {
        const addOnName = target.dataset.addonName;
        const parentCard = target.closest('.addon-card');
        if (addOnName && parentCard) {
             target.disabled = true;
             target.textContent = 'Retrying...';
             console.log(`Retrying fetch for Add-on: ${addOnName}`);
             try {
                 // Force refresh for this specific add-on (bypass cache)
                 const addOnBundle = await getAddOnData(addOnName, true);
                 // Re-render just this card (more efficient than full list render)
                 const cardHTML = createAddOnCardHTML({ name: addOnName }, addOnBundle); // Need original dir info? Fetch it? Or just use name.
                 parentCard.outerHTML = cardHTML; // Replace the old card
                 // Note: Event listeners on the new card won't be attached automatically.
                 // Full re-render might be simpler if listeners are complex.
                 // await displayAddOns(); // Simpler alternative: re-render the whole page list
             } catch (error) {
                 console.error(`Retry failed for ${addOnName}:`, error);
                 // Optionally update card to show retry failed msg
                 target.disabled = false; // Re-enable on error
                 target.textContent = 'Retry';
             }
        } else {
            console.error("Retry button clicked, but 'data-addon-name' or parent card not found.");
        }
        return; // Prevent further actions
    }
}

/** Handles the refresh button click. */
async function handleRefreshClick() {
    if (state.isLoading) return; // Prevent concurrent refreshes

    console.log("Manual refresh triggered. Clearing cache and fetching fresh data...");
    clearErrorState(); // Clear previous errors on manual refresh
    state.isLoading = true;
    updateUIState(); // Show loading on button

    try {
        await clearAllCache();
        // Fetch status first, then add-ons (force refresh for both)
        state.serviceStatus = await fetchServiceStatus(true);
        if (state.serviceStatus.status === 'online') {
            await fetchAddOns(true); // This will update state.allAddOns
        } else {
            state.allAddOns = []; // Ensure list is empty if not online
            console.warn(`Service status is ${state.serviceStatus.status}. Add-on list fetch skipped.`);
        }
         state.currentPage = 1; // Reset to first page
         displayAddOns(); // Render based on new data/status

    } catch (error) {
        console.error("Error during manual refresh:", error);
        setErrorState(`Failed to refresh: ${error.message}`);
    } finally {
        state.isLoading = false;
        updateUIState(); // Update button state, potentially show error msg
    }
}

/** Handles search input changes. */
function handleSearchInput() {
    console.debug(`Search input: ${DOM.searchInput?.value}`);
    state.currentPage = 1; // Reset to first page on search
    displayAddOns(); // Re-render the list with filter
}

// --- Initialization ---

/** Initializes the Add-on Store application. */
async function initialize() {
    console.log("Initializing Add-on Store v2.0...");
    state.isLoading = true;
    clearErrorState(); // Clear any previous errors
    updateUIState();

    // 0. Basic DOM checks
    if (!DOM.addOnListContainer || !DOM.paginationContainer || !DOM.searchInput || !DOM.refreshButton) {
        console.error("Initialization failed: Required DOM elements are missing.");
        document.body.innerHTML = '<p style="color: red; font-weight: bold;">Error: Application cannot start. Essential HTML elements are missing. Please check the console.</p>';
        state.isLoading = false;
        return;
    }

    // 1. Display Extension Version
    try {
        const manifest = chrome.runtime.getManifest();
        if (DOM.versionElement && manifest.version) {
            DOM.versionElement.textContent = `v${manifest.version}`;
        }
    } catch (error) {
        console.warn("Could not display extension version:", error);
    }

    // 2. Setup Global Event Listeners
    DOM.searchInput.addEventListener('input', debounce(handleSearchInput, 350));
    DOM.refreshButton.addEventListener('click', handleRefreshClick);
    DOM.addOnListContainer.addEventListener('click', handleAddOnListClick); // Delegated listener
    if (DOM.errorCloseButton) {
         DOM.errorCloseButton.onclick = () => { // Simple handler for close button
             if (DOM.errorNotificationBar) DOM.errorNotificationBar.style.display = 'none';
             // Optionally clear the error state fully
             // clearErrorState();
         };
    }

    // 3. Fetch Service Status (Check cache first)
    try {
        state.serviceStatus = await fetchServiceStatus(false); // false = use cache if valid
        console.log("Service Status:", state.serviceStatus);

        // If not online, display status and stop further loading
        if (state.serviceStatus.status !== 'online') {
            displayAddOns(); // This will show the overlay
            state.isLoading = false;
            updateUIState();
            return; // Stop initialization
        }

    } catch (error) {
         // Should be handled within fetchServiceStatus, but catch just in case
         console.error("Critical error fetching initial service status:", error);
         setErrorState(`Failed to get store status: ${error.message}`);
         state.isLoading = false;
         updateUIState();
         return; // Stop initialization
    }

    // 4. Fetch Add-on List (Check cache first)
    try {
        await fetchAddOns(false); // false = use cache if valid
        // fetchAddOns updates state.allAddOns and handles its own loading/error display via updateUIState/displayAddOns

    } catch (error) {
        // Should be handled within fetchAddOns, but catch just in case
        console.error("Critical error fetching initial Add-on list:", error);
        // setErrorState is likely already called by fetchAddOns on failure
        // If not, call it here: setErrorState(`Failed to load add-ons: ${error.message}`);
    } finally {
        // Ensure loading state is off and final UI is rendered
        state.isLoading = false;
        // fetchAddOns should have called displayAddOns/updateUIState
        // But call again defensively? Might cause flicker. Test this.
         updateUIState(); // Ensure button state is correct
         displayAddOns(); // Ensure final render happens
         console.log("Initialization complete.");
    }
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initialize);

// --- Optional: Export for Testing ---
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG, state, DOM,
        fetchServiceStatus, fetchAddOns, getAddOnData,
        sanitizeHTML, debounce, initialize,
    };
}
