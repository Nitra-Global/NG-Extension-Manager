/**
 * NG Extension Manager - Add-on Store Script v3.3 (Customization & Status Panel)
 *
 * Fetches, displays, sorts, and manages Add-ons from a GitHub repository.
 * UI aligned with the Updates page (Sidebar layout, CSS variables).
 * Features: Service Status Check (displayed in Status Panel), Lazy Loading Add-on cards,
 * Sorting, Card Display Customization (Version, Author, Description),
 * Enhanced Caching (chrome.storage.local), Error Handling, Search Highlighting,
 * Consistent Modals (Changelog, Install Instructions), Toast Notifications.
 * Cache clearing removed from Advanced panel.
 */

(() => { // IIFE
    'use strict';

    // == Configuration ==
    const CONFIG = {
        repoOwner: 'Nitra-Global', // Replace if needed
        repoName: 'addons', // Replace if needed
        addOnsPath: 'Add-on%20Store%20NGEM', // URL-encoded path if needed
        serviceStatusFile: 'service-status.json', // In repo root
        get repoApiUrl() { return `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.addOnsPath}`; },
        get rawUrlBase() { return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/${this.addOnsPath}/`; },
        get serviceStatusUrl() { return `https://raw.githubusercontent.com/${this.repoOwner}/${this.repoName}/main/${this.serviceStatusFile}`; },
        addOnsPerPage: 12, // Adjust as needed
        storageKeys: { // Using chrome.storage.local
            addOnList: 'ngStore_addOnList_v2',
            lastFetchedList: 'ngStore_lastFetchedList_v2',
            serviceStatus: 'ngStore_serviceStatus_v2',
            lastFetchedStatus: 'ngStore_lastFetchedStatus_v2',
            addOnDataPrefix: 'ngStore_addOnData_v2_',
            // New keys for display settings
            displaySettings: 'ngStore_displaySettings_v1',
        },
        cacheTTL: {
            list: 3600 * 1000,       // 1 hour for list
            status: 300 * 1000,      // 5 minutes for status
            individualAddOn: 86400 * 1000 // 24 hours for individual add-on details
        },
        fetchTimeout: 15000, // 15 seconds timeout
        fetchRetries: 2,
        lazyLoadMargin: '250px', // Trigger loading sooner
        toastDuration: 4000, // 4 seconds for toasts
    };

    // == State Management ==
    const state = {
        currentPage: 1,
        allAddOns: [],      // Holds { name, path, sha, _displayName, ... } from GitHub API
        addOnDataCache: {}, // In-memory cache for { data: addonJson, changelog: changelogJson } fetched during session
        isLoadingList: false,
        isLoadingStatus: false,
        hasListError: false,
        listErrorMessage: '',
        serviceStatus: { status: 'unknown', message: '' }, // Holds { status: 'online'|'offline'|'maintenance'|'unknown', message: string }
        serviceStatusLastChecked: null, // Timestamp for service status check
        searchQuery: '',
        sortOrder: 'name-asc',
        // Default display settings
        displaySettings: {
            showVersion: true,
            showAuthor: true,
            showDescription: true,
        },
        observer: null,
        activeModal: null,
        lastFocusedElement: null,
        currentPanel: 'panel-addon-store',
    };

    // == DOM Elements Cache ==
    const dom = {}; // Populated by initDomElements

    // == Utility Functions ==
    const log = (...args) => console.log('[AddonStore]', ...args);
    const warn = (...args) => console.warn('[AddonStore]', ...args);
    const error = (...args) => console.error('[AddonStore]', ...args);

    function debounce(func, wait) { /* ... (same as before) ... */
        let timeout;
        return function executedFunction(...args) {
            const later = () => { clearTimeout(timeout); func.apply(this, args); };
            clearTimeout(timeout); timeout = setTimeout(later, wait);
        };
    }

    // Ensure markdown.js functions are available
    const escapeHTML = window.escapeHTML || ((str) => str || '');
    const sanitizeUrl = window.sanitizeUrl || ((str) => str || '');
    const markdownToHTML = window.markdownToHTML || ((text) => `<p>Markdown Error</p><pre>${escapeHTML(text)}</pre>`);

    function formatBytes(bytes) { /* ... (same as before) ... */
        if (bytes === null || typeof bytes === 'undefined' || isNaN(bytes)) return 'N/A';
        if (bytes === 0) return '0 Bytes';
        const k = 1024; const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    function highlightText(text, query) { /* ... (same as before) ... */
        if (!query || !text) return escapeHTML(text || '');
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapeHTML(text).replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    async function fetchWithTimeout(url, options = {}, timeout = CONFIG.fetchTimeout, retries = CONFIG.fetchRetries) { /* ... (same robust version as before) ... */
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        log(`[Fetch] Attempt: ${url} (Retries left: ${retries})`);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal, cache: options.cache || 'no-cache' });
            clearTimeout(timeoutId);
            if (!response.ok) {
                let errorBody = ''; try { errorBody = await response.text(); } catch (e) { /* ignore */ }
                const httpError = new Error(`HTTP ${response.status} (${response.statusText}) for ${url}. ${errorBody.substring(0,100)}`);
                httpError.name = 'HttpError'; httpError.status = response.status;
                error(`[Fetch] ${httpError.message}`); throw httpError;
            }
            log(`[Fetch] Success: ${url} Status: ${response.status}`); return response;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                warn(`[Fetch] Timeout: ${url}`);
                if (retries > 0) return fetchWithTimeout(url, options, timeout, retries - 1);
                const timeoutError = new Error(`Timeout after ${CONFIG.fetchRetries + 1} attempts: ${url}`);
                timeoutError.name = 'TimeoutError'; throw timeoutError;
            } else if (err.name === 'HttpError') {
                 if ((err.status >= 500 || err.status === 403 || err.status === 429) && retries > 0) {
                    warn(`[Fetch] Retrying error ${err.status} (${retries} left)...`);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    return fetchWithTimeout(url, options, timeout, retries - 1);
                 } throw err;
            } else {
                error(`[Fetch] Network error for ${url}:`, err);
                if (retries > 0) {
                    warn(`[Fetch] Retrying network error (${retries} left)...`);
                    await new Promise(resolve => setTimeout(resolve, 800));
                    return fetchWithTimeout(url, options, timeout, retries - 1);
                }
                const networkError = new Error(`Network error: ${err.message}`);
                networkError.name = 'NetworkError'; throw networkError;
            }
        }
     }

    // == Storage & Caching (Using chrome.storage.local) ==
    async function storageGet(key) { /* ... (same as before) ... */
        if (!window.chrome?.storage?.local) { warn("chrome.storage.local not available."); return null; }
        try { const result = await chrome.storage.local.get(key); return typeof key === 'string' ? (result[key] ?? null) : result; }
        catch (err) { error("Error getting data from chrome.storage.local", { key, err }); throw err; }
    }
    async function storageSet(items) { /* ... (same as before) ... */
        if (!window.chrome?.storage?.local) { warn("chrome.storage.local not available."); return; }
        try { await chrome.storage.local.set(items); }
        catch (err) { error("Error setting data", { items, err }); if (err.message.toLowerCase().includes('quota')) showToast("Extension storage quota exceeded.", 'error'); throw err; }
    }
    async function storageRemove(key) { /* ... (same as before) ... */
        if (!window.chrome?.storage?.local) { warn("chrome.storage.local not available."); return; }
        try { await chrome.storage.local.remove(key); }
        catch (err) { error("Error removing data", { key, err }); throw err; }
    }
    async function getCachedItem(key, timestampKey, ttl) { /* ... (same as before) ... */
        log(`[Cache] Getting: ${key}`); try { const data = await storageGet([key, timestampKey]); const item = data[key]; const lastFetched = data[timestampKey] || 0; if (!item) { log(`[Cache] Miss: ${key}`); return null; } const age = Date.now() - lastFetched; if (age > ttl) { log(`[Cache] Expired: ${key} (Age: ${Math.round(age/1000)}s > TTL: ${ttl/1000}s)`); await storageRemove([key, timestampKey]); return null; } log(`[Cache] Hit: ${key}`); return item; } catch (err) { error(`[Cache] Error getting ${key}:`, err); return null; }
    }
    async function cacheItem(key, item, timestampKey) { /* ... (same as before) ... */
         log(`[Cache] Setting: ${key}`); try { await storageSet({ [key]: item, [timestampKey]: Date.now() }); log(`[Cache] Cached: ${key}`); } catch (err) { error(`[Cache] Error setting ${key}:`, err); }
    }
    // Removed clearAddonStoreCache function

    // == DOM Elements Initialization ==
    /** Caches references to frequently used DOM elements. */
    function initDomElements() {
        log("Initializing DOM Elements Cache");
        const getElem = (id) => document.getElementById(id);
        const getQuery = (selector, parent = document) => parent.querySelector(selector);

        // Sidebar & Core
        dom.sidebar = getQuery('.sidebar');
        dom.sidebarNav = dom.sidebar?.querySelector('.sidebar-nav');
        dom.sidebarButtons = dom.sidebarNav?.querySelectorAll('.sidebar-button');
        dom.extensionTitleHeading = getElem("extension-title");
        dom.currentYearSpan = getElem("current-year");
        dom.contentArea = getQuery('.content-area');
        dom.contentPanels = dom.contentArea?.querySelectorAll('.content-panel');
        dom.toastContainer = getElem("toast-container");

        // Status Panel Elements
        dom.statusPanel = getElem('panel-status');
        dom.serviceStatusPanelIconWrapper = getElem('service-status-panel-icon-wrapper');
        dom.serviceStatusPanelIcon = getElem('service-status-panel-icon');
        dom.serviceStatusPanelText = getElem('service-status-panel-text');
        dom.serviceStatusPanelMessage = getElem('service-status-panel-message');
        dom.serviceStatusLastChecked = getElem('service-status-last-checked');


        // Add-on Store Panel Elements
        dom.addonStorePanel = getElem('panel-addon-store');
        dom.searchInput = getElem("search-input");
        dom.sortSelect = getElem("sort-select");
        dom.refreshButton = getElem("refresh-button");
        dom.addOnListContainer = getElem("addon-list");
        dom.paginationContainer = getElem("pagination");
        dom.serviceStatusOverlay = getElem("service-status-overlay"); // Overlay within store panel
        dom.serviceStatusTitle = getElem("service-status-title");
        dom.serviceStatusMessage = getElem("service-status-message");
        dom.serviceStatusIcon = getElem("service-status-icon");

        // Modals
        dom.instructionModal = getElem("instruction-modal");
        dom.instructionModalName = getElem("modal-addon-name");
        dom.goToGitHubButton = getElem("go-to-addon-button");
        dom.changelogModal = getElem("changelog-modal");
        dom.changelogModalName = getElem("changelog-modal-addon-name");
        dom.changelogContentContainer = getElem("changelog-content");

        // Advanced Panel (Display Settings)
        dom.advancedPanel = getElem('panel-advanced');
        dom.settingShowVersion = getElem('setting-show-version');
        dom.settingShowAuthor = getElem('setting-show-author');
        dom.settingShowDescription = getElem('setting-show-description');
        // Removed clearStoreCacheButton reference

        // Footer
        dom.versionElement = getElem("extension-version");

        // Check essential elements
        if (!dom.addonStorePanel || !dom.addOnListContainer || !dom.searchInput || !dom.sortSelect || !dom.statusPanel) {
            error("CRITICAL: Essential UI elements missing!");
        }
    }

    // == Core Fetching Logic ==
    /** Fetches and updates the service status. */
    async function fetchServiceStatus(forceRefresh = false) {
        log(`[ServiceStatus] Fetching ${forceRefresh ? '(forced)' : ''}`);
        state.isLoadingStatus = true;
        updateUIState(); // Show loading on refresh button potentially
        try {
            const key = CONFIG.storageKeys.serviceStatus;
            const tsKey = CONFIG.storageKeys.lastFetchedStatus;
            const ttl = CONFIG.cacheTTL.status;
            let statusData = null;
            let checkTimestamp = null; // Store timestamp separately

            if (!forceRefresh) {
                const cached = await storageGet([key, tsKey]); // Get both at once
                statusData = cached[key];
                checkTimestamp = cached[tsKey]; // Get cached timestamp
                const age = Date.now() - (checkTimestamp || 0);
                if (!statusData || age > ttl) {
                    log(`[ServiceStatus] Cache miss or expired (Age: ${Math.round(age/1000)}s > TTL: ${ttl/1000}s)`);
                    statusData = null; // Force fetch if expired
                } else {
                    log(`[ServiceStatus] Hit (storage)`);
                }
            }

            if (!statusData) {
                log("[ServiceStatus] Fetching fresh...");
                const response = await fetchWithTimeout(CONFIG.serviceStatusUrl, { headers: { 'Accept': 'application/json' }, cache: 'no-store' });
                const data = await response.json();
                if (typeof data?.status !== 'string' || !['online', 'offline', 'maintenance'].includes(data.status)) {
                    throw new Error("Invalid service status format received.");
                }
                statusData = {
                    status: data.status,
                    message: data.message || `Service is ${data.status}.`
                };
                checkTimestamp = Date.now(); // Update timestamp on fresh fetch
                log("[ServiceStatus] New:", statusData);
                await storageSet({ [key]: statusData, [tsKey]: checkTimestamp }); // Cache status and timestamp
            }
            // Update state
            state.serviceStatus = statusData;
            state.serviceStatusLastChecked = checkTimestamp; // Update timestamp in state
            return statusData;
        } catch (err) {
            error("[ServiceStatus] Error:", err);
            state.serviceStatus = { status: 'unknown', message: `Could not get store status (${err.name || 'Unknown Error'}).` };
            state.serviceStatusLastChecked = null; // Reset timestamp on error
            return state.serviceStatus;
        } finally {
            state.isLoadingStatus = false;
            updateUIState();
            displayServiceStatusPanel(); // Update the dedicated status panel UI
        }
    }

    /** Fetches the list of add-ons from GitHub. */
    async function fetchAddOns(forceRefresh = false) { /* ... (No changes needed here) ... */
        log(`[Addons] Fetching list ${forceRefresh ? '(forced)' : ''}`);
        setListLoadingState(true); state.hasListError = false; state.listErrorMessage = '';
        updateListMessage('loading');

        const cacheKey = CONFIG.storageKeys.addOnList; const timestampKey = CONFIG.storageKeys.lastFetchedList; const ttl = CONFIG.cacheTTL.list;
        let usedCache = false; let fetchedAddons = null;

        if (!forceRefresh) { fetchedAddons = await getCachedItem(cacheKey, timestampKey, ttl); if (fetchedAddons?.length > 0) { log("[Addons] Using valid cached list."); state.allAddOns = fetchedAddons; usedCache = true; } else if (fetchedAddons) { log("[Addons] Cached list exists but is empty."); } }

        if (!usedCache) {
            log(`[Addons] Fetching fresh from: ${CONFIG.repoApiUrl}`);
            try {
                const response = await fetchWithTimeout(CONFIG.repoApiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json' } }); const data = await response.json();
                if (!Array.isArray(data)) throw new Error('Invalid API response format (expected array).');
                const addOns = data.filter(item => item.type === 'dir' && item.name && !item.name.startsWith('.')).map(item => ({ name: item.name, path: item.path, sha: item.sha, url: item.url, _displayName: item.name.replace(/[-_]/g, ' ') }));
                log(`[Addons] Found ${addOns.length} directories.`); await cacheItem(cacheKey, addOns, timestampKey); state.allAddOns = addOns;
            } catch (err) {
                error("[Addons] Error fetching list:", err); state.listErrorMessage = `Could not load add-ons: ${err.message}`; state.hasListError = true; state.allAddOns = [];
                if (!forceRefresh) { try { const expiredData = await storageGet(cacheKey); if (expiredData?.length > 0) { warn("[Addons] Fetch failed, using EXPIRED cache as fallback."); state.allAddOns = expiredData; state.hasListError = false; showToast("Failed to fetch latest list, showing cached version.", "warning"); } else { updateListMessage('error', state.listErrorMessage); } } catch (e) { error("[Addons] Error accessing expired cache:", e); updateListMessage('error', state.listErrorMessage); } }
                else { updateListMessage('error', state.listErrorMessage); }
            }
        }
        setListLoadingState(false); await displayAddOns();
    }

    /** Fetches details (addon.json, changelog.json) for a specific add-on. */
    async function getAddOnData(addOnName, forceRefresh = false) { /* ... (No changes needed here) ... */
        if (!addOnName) { error("[AddonData] Invalid name provided."); return null; }
        log(`[AddonData] Requesting: ${addOnName} ${forceRefresh ? '(forced)' : ''}`);
        if (!forceRefresh && state.addOnDataCache[addOnName]) { log(`[AddonData] Hit (memory): ${addOnName}`); return state.addOnDataCache[addOnName]; }
        const cacheKey = `${CONFIG.storageKeys.addOnDataPrefix}${addOnName}`; const timestampKey = `${cacheKey}_timestamp`; const ttl = CONFIG.cacheTTL.individualAddOn;
        if (!forceRefresh) { const cached = await getCachedItem(cacheKey, timestampKey, ttl); if (cached) { log(`[AddonData] Hit (storage): ${addOnName}`); state.addOnDataCache[addOnName] = cached; return cached; } }
        log(`[AddonData] Fetching fresh: ${addOnName}`); const now = Date.now(); const addOnJsonUrl = `${CONFIG.rawUrlBase}${encodeURIComponent(addOnName)}/addon.json?t=${now}`; const changelogJsonUrl = `${CONFIG.rawUrlBase}${encodeURIComponent(addOnName)}/changelog.json?t=${now}`; let addOnData = null; let changelogData = null;
        try {
            const [addOnRes, clRes] = await Promise.allSettled([ fetchWithTimeout(addOnJsonUrl, { headers: { 'Accept': 'application/json' } }), fetchWithTimeout(changelogJsonUrl, { headers: { 'Accept': 'application/json' } }) ]);
            if (addOnRes.status === 'fulfilled') { try { addOnData = await addOnRes.value.json(); if (!addOnData?.name || !addOnData?.description) { warn(`[AddonData] Invalid addon.json format for ${addOnName}`); addOnData = { _error: 'Invalid format' }; } } catch (e) { error(`[AddonData] Parse error addon.json ${addOnName}:`, e); addOnData = { _error: `Parse error: ${e.message}` }; } }
            else { const r = addOnRes.reason; error(`[AddonData] Fetch error addon.json ${addOnName}:`, r); addOnData = { _error: r.status === 404 ? 'Not found (404)' : `Fetch error: ${r.message}` }; }
            if (clRes.status === 'fulfilled') { try { changelogData = await clRes.value.json(); if (!Array.isArray(changelogData)) { warn(`[AddonData] Invalid changelog.json format for ${addOnName} (not an array)`); changelogData = null; } } catch (e) { warn(`[AddonData] Parse error changelog.json ${addOnName}:`, e); changelogData = null; } }
            else { if(clRes.reason.status !== 404) { warn(`[AddonData] Fetch error changelog.json ${addOnName}:`, clRes.reason); } changelogData = null; }
            const dataBundle = { data: addOnData, changelog: changelogData }; await cacheItem(cacheKey, dataBundle, timestampKey); state.addOnDataCache[addOnName] = dataBundle; log(`[AddonData] Fetched/cached: ${addOnName}`); return dataBundle;
        } catch (err) { error(`[AddonData] Unexpected fetch/cache error for ${addOnName}:`, err); return { data: { _error: `Unexpected error: ${err.message}` }, changelog: null }; }
     }

    // == UI Rendering Logic ==
    /** Updates the message displayed within the add-on list container. */
    function updateListMessage(type = 'clear', message = '') { /* ... (No changes needed here) ... */
        log(`[UI] List message: type=${type}`); const container = dom.addOnListContainer; if (!container) return; let loading = container.querySelector('.loading-indicator'); let errorEl = container.querySelector('.error-message'); let noResults = container.querySelector('.no-results');
        if (type === 'loading' && !loading) { container.innerHTML = '<div class="loading-indicator" style="display: none;"><span class="icon icon-spinner loading-spinner" aria-hidden="true"></span> Loading Add-ons...</div>'; loading = container.querySelector('.loading-indicator'); }
        if (type === 'error' && !errorEl) { container.innerHTML = '<div class="error-message" style="display: none;"></div>'; errorEl = container.querySelector('.error-message'); }
        if (type === 'noresults' && !noResults) { container.innerHTML = '<div class="no-results" style="display: none;"></div>'; noResults = container.querySelector('.no-results'); }
        if (loading) loading.style.display = 'none'; if (errorEl) errorEl.style.display = 'none'; if (noResults) noResults.style.display = 'none'; container.setAttribute('aria-busy', 'false');
        switch (type) { case 'loading': if (loading) loading.style.display = 'flex'; container.setAttribute('aria-busy', 'true'); break; case 'error': if (errorEl) { errorEl.textContent = escapeHTML(message || 'An error occurred.'); errorEl.style.display = 'block'; } break; case 'noresults': if (noResults) { noResults.textContent = escapeHTML(message || 'No add-ons found.'); noResults.style.display = 'block'; } break; }
    }

    /** Creates HTML skeleton for an Add-on card placeholder. */
    function createAddOnCardSkeletonHTML(addOnDirInfo) { /* ... (No changes needed here) ... */
        const dirName = escapeHTML(addOnDirInfo.name); const displayName = escapeHTML(addOnDirInfo._displayName || dirName);
        return ` <div class="addon-card skeleton" data-addon-name="${dirName}" data-loaded="false" aria-busy="true" role="group" aria-label="Loading add-on ${displayName}"> <div class="skeleton-card-content"> <div class="skeleton skeleton-line short" style="height: 1.4em; width: 60%; margin-bottom: 0.8rem;"></div> <div class="skeleton skeleton-line small" style="height: 0.9em; width: 40%; margin-bottom: 1rem;"></div> <div class="skeleton skeleton-line" style="height: 1em; width: 90%;"></div> <div class="skeleton skeleton-line medium" style="height: 1em; width: 70%; margin-bottom: 1.5rem;"></div> </div> <div class="skeleton-actions"> <div class="skeleton skeleton-button small" style="width: 110px;"></div> <div class="skeleton skeleton-button" style="width: 90px;"></div> </div> </div>`;
    }

    /** Fetches data and populates a single add-on card element, applying display settings. */
    async function populateAddOnCard(cardElement, addOnDirInfo) {
        const addOnName = addOnDirInfo.name;
        const displayName = addOnDirInfo._displayName || addOnName;
        log(`[LazyLoad] Populating: ${addOnName}`);

        cardElement.setAttribute('aria-busy', 'true');
        cardElement.classList.remove('skeleton');
        cardElement.innerHTML = `<p class="loading-text"><span class="icon icon-spinner loading-spinner" aria-hidden="true"></span> Loading ${escapeHTML(displayName)}...</p>`;

        const addOnBundle = await getAddOnData(addOnName);
        const addOnData = addOnBundle?.data;
        const changelogData = addOnBundle?.changelog;
        const query = state.searchQuery;
        let cardContentHTML = '';
        let cardClass = 'addon-card visible';
        let matchesSearch = !query;

        // Apply display settings from state
        const { showVersion, showAuthor, showDescription } = state.displaySettings;

        if (addOnData && !addOnData._error) {
            const name = addOnData.name || displayName;
            // Conditionally include author based on settings
            const authorHTML = showAuthor && addOnData.author
                ? `<span class="addon-author">by ${escapeHTML(addOnData.author)}</span>`
                : '';
            // Conditionally include description based on settings
            const descriptionHTML = showDescription
                ? `<p class="addon-description">${escapeHTML(addOnData.description || 'No description provided.')}</p>`
                : '';
            // Conditionally include version based on settings
            const versionHTML = showVersion && addOnData.version
                ? `<span class="addon-version">v${escapeHTML(addOnData.version)}</span>`
                : '';
            const hasChangelog = changelogData?.length > 0;

            // Apply highlighting
            const highlightedName = highlightText(name, query);
            const highlightedDesc = showDescription ? highlightText(addOnData.description || 'No description provided.', query) : '';
            const highlightedAuthor = showAuthor && addOnData.author ? highlightText(`by ${addOnData.author}`, query) : '';

            // Check search match (include conditional fields)
            if (query) {
                matchesSearch = name.toLowerCase().includes(query.toLowerCase()) ||
                                (showDescription && (addOnData.description || '').toLowerCase().includes(query.toLowerCase())) ||
                                addOnName.toLowerCase().includes(query.toLowerCase()) ||
                                (showAuthor && addOnData.author && addOnData.author.toLowerCase().includes(query.toLowerCase()));
            }

            // Construct HTML based on settings
            cardContentHTML = `
                <h3>${highlightedName} ${versionHTML}</h3>
                ${authorHTML ? `<span class="addon-author">${highlightedAuthor.replace(/^by /, 'by ')}</span>` : ''}
                ${showDescription ? `<p class="addon-description">${highlightedDesc}</p>` : ''}
                <div class="addon-actions">
                    ${hasChangelog ? `<button class="changelog-button btn tertiary" data-addon-name="${addOnName}" title="View Changelog"><span class="icon icon-changelog"></span> <span class="button-text">Changelog</span></button>` : ''}
                    <button class="install-addon-button btn primary" data-addon-name="${addOnName}" title="Show Installation Instructions"><span class="icon icon-install"></span> <span class="button-text">Install</span></button>
                </div>`;
        } else {
            // Error case remains mostly the same
            cardClass += ' addon-card-error';
            const errorMsg = addOnData?._error || 'Could not load details.';
            warn(`[AddonData] Card error ${addOnName}: ${errorMsg}`);
            if (query) {
                matchesSearch = addOnName.toLowerCase().includes(query.toLowerCase()) ||
                                displayName.toLowerCase().includes(query.toLowerCase());
            }
            cardContentHTML = `
                <h3>${highlightText(displayName, query)}</h3>
                <p class="error-text">${escapeHTML(errorMsg)}</p>
                <div class="addon-actions">
                    <button class="retry-button btn secondary" data-addon-name="${addOnName}" title="Retry Loading"><span class="icon icon-retry"></span> <span class="button-text">Retry</span></button>
                </div>`;
        }

        cardElement.className = cardClass;
        cardElement.innerHTML = cardContentHTML;
        cardElement.dataset.loaded = 'true';
        cardElement.setAttribute('aria-busy', 'false');

        if (!matchesSearch) {
            log(`[Search] Hiding ${addOnName} as details don't match "${query}"`);
            cardElement.classList.add('hidden-by-search');
        } else {
            cardElement.classList.remove('hidden-by-search');
        }
     }

    /** Filters, sorts, paginates, and renders the add-on cards. */
    async function displayAddOns() { /* ... (No changes needed here, filtering/sorting happens before pagination) ... */
        log('[UI] Displaying Add-ons...'); const container = dom.addOnListContainer; const pagination = dom.paginationContainer; if (!container || !pagination) { error("UI render error: Containers missing!"); return; }
        if (state.observer) state.observer.disconnect(); container.innerHTML = ''; pagination.innerHTML = ''; updateListMessage();
        if (state.serviceStatus.status !== 'online') { showServiceStatusOverlay(); container.style.display = 'none'; pagination.style.display = 'none'; return; }
        else { hideServiceStatusOverlay(); container.style.display = 'grid'; pagination.style.display = 'flex'; }
        if (state.isLoadingList) { updateListMessage('loading'); return; }
        if (state.hasListError && state.allAddOns.length === 0) { updateListMessage('error', state.listErrorMessage); return; }
        if (!state.isLoadingList && !state.hasListError && state.allAddOns.length === 0) { updateListMessage('noresults', 'No add-ons found.'); return; }
        const query = state.searchQuery.toLowerCase().trim(); let filteredAddOns = state.allAddOns.filter(a => a && a.name);
        if (query) { filteredAddOns = filteredAddOns.filter(a => a.name.toLowerCase().includes(query) || (a._displayName && a._displayName.toLowerCase().includes(query))); log(`[Search] Pre-filter found ${filteredAddOns.length} potential matches for "${query}"`); }
        const sortOrder = state.sortOrder; log(`[Sort] Applying order: ${sortOrder}`); filteredAddOns.sort((a, b) => { const nameA = (a._displayName || a.name).toLowerCase(); const nameB = (b._displayName || b.name).toLowerCase(); switch (sortOrder) { case 'name-desc': return nameB.localeCompare(nameA); case 'name-asc': default: return nameA.localeCompare(nameB); } });
        const totalItems = filteredAddOns.length; const totalPages = Math.ceil(totalItems / CONFIG.addOnsPerPage); state.currentPage = Math.max(1, Math.min(state.currentPage, totalPages)); const start = (state.currentPage - 1) * CONFIG.addOnsPerPage; const end = start + CONFIG.addOnsPerPage; const addOnsToDisplay = filteredAddOns.slice(start, end); log(`[UI] Page ${state.currentPage}/${totalPages}, items ${start + 1}-${Math.min(end, totalItems)} of ${totalItems} filtered`);
        if (addOnsToDisplay.length === 0 && query) { updateListMessage('noresults', `No add-ons found matching "${escapeHTML(state.searchQuery)}".`); pagination.style.display = 'none'; return; }
        else if (addOnsToDisplay.length === 0 && !query) { updateListMessage('noresults', 'No add-ons available.'); pagination.style.display = 'none'; return; }
        container.innerHTML = addOnsToDisplay.map(createAddOnCardSkeletonHTML).join(''); container.setAttribute('aria-busy', 'true'); setupIntersectionObserver(); displayPagination(totalItems, totalPages);
    }

    /** Sets up the Intersection Observer to lazy-load card details. */
    function setupIntersectionObserver() { /* ... (No changes needed here) ... */
        log('[LazyLoad] Setting up Observer.'); const options = { root: null, rootMargin: CONFIG.lazyLoadMargin, threshold: 0.01 };
        const callback = (entries, observer) => { let listStillLoading = false; entries.forEach(entry => { const card = entry.target; if (entry.isIntersecting) { const name = card.dataset.addonName; const loaded = card.dataset.loaded === 'true'; const loading = card.dataset.loading === 'true'; if (!loaded && !loading) { card.dataset.loading = 'true'; log(`[LazyLoad] Intersecting: ${name}`); const dirInfo = state.allAddOns.find(a => a.name === name); if (dirInfo) { populateAddOnCard(card, dirInfo).catch(err => { error(`[LazyLoad] Error populating ${name}:`, err); card.innerHTML = `<p class="error-text">Failed to load details.</p><h3>${escapeHTML(name)}</h3>`; card.setAttribute('aria-busy', 'false'); card.classList.add('addon-card-error'); }).finally(() => { card.dataset.loading = 'false'; checkAllCardsHidden(); }); } else { warn(`[LazyLoad] Directory info missing for card: ${name}`); card.innerHTML = `<p class="error-text">Error: Data missing.</p>`; card.dataset.loaded = 'true'; card.setAttribute('aria-busy', 'false'); card.dataset.loading = 'false'; } observer.unobserve(card); } } if (card.dataset.loaded !== 'true') { listStillLoading = true; } }); if (!listStillLoading && dom.addOnListContainer) { dom.addOnListContainer.setAttribute('aria-busy', 'false'); log('[LazyLoad] All observed cards processed.'); } };
        state.observer = new IntersectionObserver(callback, options); const cards = dom.addOnListContainer?.querySelectorAll('.addon-card[data-loaded="false"]'); if (cards?.length > 0) { log(`[LazyLoad] Observing ${cards.length} cards.`); cards.forEach(card => state.observer.observe(card)); if (dom.addOnListContainer) dom.addOnListContainer.setAttribute('aria-busy', 'true'); } else { log('[LazyLoad] No cards to observe.'); if (dom.addOnListContainer) dom.addOnListContainer.setAttribute('aria-busy', 'false'); }
    }

    /** Checks if all cards are hidden by search and updates message/pagination. */
    function checkAllCardsHidden() { /* ... (No changes needed here) ... */
        const container = dom.addOnListContainer; if (!container || !state.searchQuery) return; const visibleCards = container.querySelectorAll('.addon-card:not(.hidden-by-search)'); const hiddenCards = container.querySelectorAll('.addon-card.hidden-by-search'); const totalCards = container.querySelectorAll('.addon-card').length; if (totalCards > 0 && visibleCards.length === 0 && hiddenCards.length === totalCards) { log('[Search] All cards on current page hidden by search.'); updateListMessage('noresults', `No add-ons found matching "${escapeHTML(state.searchQuery)}".`); if (dom.paginationContainer) dom.paginationContainer.style.display = 'none'; } else { if (dom.paginationContainer) dom.paginationContainer.style.display = 'flex'; const noRes = container.querySelector('.no-results'); if (noRes?.style.display !== 'none') { updateListMessage('clear'); } }
    }

    /** Renders pagination controls based on total items and current page. */
    function displayPagination(totalItems, totalPages) { /* ... (No changes needed here) ... */
        const container = dom.paginationContainer; if (!container) return; container.innerHTML = ''; container.style.display = 'flex'; log(`[UI] Pagination: ${state.currentPage}/${totalPages} (Total: ${totalItems})`); if (totalPages <= 1) { container.style.display = 'none'; return; } const createBtn = (page, text, isCurrent, isDisabled, ariaLabel, extraClass = '') => { const b = document.createElement('button'); b.textContent = text; b.disabled = isDisabled; b.setAttribute('aria-label', ariaLabel); b.className = `btn tertiary ${isCurrent ? 'pagination-current' : 'pagination-button'} ${extraClass}`; b.onclick = () => { if (state.currentPage !== page && !state.isLoadingList) { log(`[UI] Page nav: ${page}`); state.currentPage = page; displayAddOns(); dom.addOnListContainer?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }; return b; }; const createEllipsis = () => { const s = document.createElement('span'); s.textContent = '...'; s.className = 'pagination-ellipsis'; s.setAttribute('aria-hidden', 'true'); return s; }; const MAX_VISIBLE_PAGES = 5; const SIDE_BUTTONS = Math.floor((MAX_VISIBLE_PAGES - 1) / 2); container.appendChild(createBtn(state.currentPage - 1, '←', false, state.currentPage === 1, 'Previous page', 'pagination-prev')); if (totalPages <= MAX_VISIBLE_PAGES + 2) { for (let i = 1; i <= totalPages; i++) { container.appendChild(createBtn(i, i.toString(), i === state.currentPage, false, `Page ${i}`)); } } else { container.appendChild(createBtn(1, '1', 1 === state.currentPage, false, 'Page 1')); if (state.currentPage > SIDE_BUTTONS + 2) { container.appendChild(createEllipsis()); } let startPage = Math.max(2, state.currentPage - SIDE_BUTTONS); let endPage = Math.min(totalPages - 1, state.currentPage + SIDE_BUTTONS); if (state.currentPage <= SIDE_BUTTONS + 1) { endPage = Math.max(endPage, MAX_VISIBLE_PAGES); } if (state.currentPage >= totalPages - SIDE_BUTTONS) { startPage = Math.min(startPage, totalPages - MAX_VISIBLE_PAGES + 1); } for (let i = startPage; i <= endPage; i++) { container.appendChild(createBtn(i, i.toString(), i === state.currentPage, false, `Page ${i}`)); } if (state.currentPage < totalPages - SIDE_BUTTONS - 1) { container.appendChild(createEllipsis()); } container.appendChild(createBtn(totalPages, totalPages.toString(), totalPages === state.currentPage, false, `Page ${totalPages}`)); } container.appendChild(createBtn(state.currentPage + 1, '→', false, state.currentPage === totalPages, 'Next page', 'pagination-next'));
    }

    /** Updates the loading state of the refresh button and list container. */
    function updateUIState() { /* ... (No changes needed here) ... */
        log('[UI] Updating general UI state.'); const refresh = dom.refreshButton; if (refresh) { refresh.disabled = state.isLoadingList || state.isLoadingStatus; if (state.isLoadingList || state.isLoadingStatus) { refresh.classList.add('loading'); refresh.setAttribute('aria-label', 'Refreshing...'); } else { refresh.classList.remove('loading'); refresh.setAttribute('aria-label', 'Refresh add-on list'); } } if (dom.addOnListContainer) { dom.addOnListContainer.setAttribute('aria-busy', state.isLoadingList ? 'true' : 'false'); }
    }
    /** Sets the loading state specifically for the add-on list fetching process. */
    function setListLoadingState(isLoading) { /* ... (No changes needed here) ... */
        log(`[State] List loading: ${isLoading}`); state.isLoadingList = isLoading; updateUIState();
    }

    // == Modal Logic ==
    function trapFocus(modalElement) { /* ... (same as before) ... */
        const focusable = modalElement.querySelectorAll('a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'); if (focusable.length === 0) return () => {}; const first = focusable[0]; const last = focusable[focusable.length - 1]; const handler = (e) => { if (e.key === 'Tab') { if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } } }; modalElement.addEventListener('keydown', handler); return () => modalElement.removeEventListener('keydown', handler);
    }
    function handleModalEscKey(event) { /* ... (same as before) ... */
        if (event.key === 'Escape' && state.activeModal) { closeModal(); }
    }
    function closeModal() { /* ... (same as before) ... */
        const modal = state.activeModal; if (!modal || modal.style.display === 'none') return; log(`[UI] Closing modal: #${modal.id}`); modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; const closeBtn = modal.querySelector('.modal-close-button'); if (closeBtn) closeBtn.onclick = null; modal.onclick = null; document.removeEventListener('keydown', handleModalEscKey); if (modal.focusTrapCleanup) { modal.focusTrapCleanup(); delete modal.focusTrapCleanup; } state.activeModal = null; if (state.lastFocusedElement) { try { state.lastFocusedElement.focus(); } catch(e) {warn("Failed to restore focus", e);} state.lastFocusedElement = null; }
    }
    function openModal(modalElement) { /* ... (same as before) ... */
        if (!modalElement) { error("[UI] Modal element not found."); return; } if (state.activeModal) closeModal(); log(`[UI] Opening modal: #${modalElement.id}`); state.lastFocusedElement = document.activeElement; state.activeModal = modalElement; modalElement.style.display = 'block'; modalElement.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; const focusable = modalElement.querySelector('h2, button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (focusable) { setTimeout(() => { try { focusable.focus(); } catch(e){} }, 50); } else { try { modalElement.focus(); } catch(e){} } const closeBtn = modalElement.querySelector('.modal-close-button'); if (closeBtn) closeBtn.onclick = closeModal; modalElement.onclick = (e) => { if (e.target === modalElement) closeModal(); }; document.addEventListener('keydown', handleModalEscKey); modalElement.focusTrapCleanup = trapFocus(modalElement);
    }
    function openInstallModal(addOnName) { /* ... (same as before) ... */
        log(`[UI] Install modal: ${addOnName}`); const modal = dom.instructionModal; const nameEl = dom.instructionModalName; const btn = dom.goToGitHubButton; if (!modal || !nameEl || !btn) { error("Instruction modal elements missing."); return; } const addOnInfo = state.allAddOns.find(a => a.name === addOnName); nameEl.textContent = escapeHTML(addOnInfo?._displayName || addOnName); const url = `https://github.com/${CONFIG.repoOwner}/${CONFIG.repoName}/tree/main/${CONFIG.addOnsPath}/${encodeURIComponent(addOnName)}`; btn.onclick = () => window.open(url, '_blank', 'noopener,noreferrer'); openModal(modal);
    }
    async function openChangelogModal(addOnName) { /* ... (same as before) ... */
        log(`[UI] Changelog modal: ${addOnName}`); const modal = dom.changelogModal; const nameEl = dom.changelogModalName; const content = dom.changelogContentContainer; if (!modal || !nameEl || !content) { error("Changelog modal elements missing."); return; } const addOnInfo = state.allAddOns.find(a => a.name === addOnName); nameEl.textContent = escapeHTML(addOnInfo?._displayName || addOnName); content.innerHTML = `<p class="loading-text"><span class="icon icon-spinner loading-spinner" aria-hidden="true"></span> Loading Changelog...</p>`; content.setAttribute('aria-busy', 'true'); openModal(modal);
        try { const bundle = await getAddOnData(addOnName); const changelog = bundle?.changelog; if (changelog?.length > 0) { log(`[UI] Rendering changelog for ${addOnName}`); changelog.sort((a, b) => (b.version || '').localeCompare(a.version || '', undefined, { numeric: true, sensitivity: 'base' })); let html = ''; changelog.forEach(entry => { const v = escapeHTML(entry.version || 'N/A'); const d = entry.date ? `<span class="changelog-date">(${escapeHTML(entry.date)})</span>` : ''; let changes = ''; if (Array.isArray(entry.changes)) { changes = '<ul>' + entry.changes.map(c => `<li>${markdownToHTML(c)}</li>`).join('') + '</ul>'; } else { changes = '<p><em>No specific changes listed for this version.</em></p>'; } html += `<div class="changelog-version"><h4>Version ${v} ${d}</h4>${changes}</div>`; }); content.innerHTML = html; } else if (changelog === null && bundle?.data && !bundle.data._error) { content.innerHTML = '<p class="no-results">No changelog information available for this add-on.</p>'; } else { content.innerHTML = `<p class="error-text">Could not load changelog information. (${escapeHTML(bundle?.data?._error || 'Unknown error')})</p>`; } } catch (err) { error(`[UI] Error rendering changelog ${addOnName}:`, err); content.innerHTML = `<p class="error-text">Error loading changelog: ${escapeHTML(err.message)}</p>`; } finally { content.setAttribute('aria-busy', 'false'); }
    }

    // == Service Status UI ==
    /** Displays the service status overlay if not online (within store panel). */
    function showServiceStatusOverlay() { /* ... (same as before) ... */
        const overlay = dom.serviceStatusOverlay; if (!overlay) return; const { status, message } = state.serviceStatus; log(`[UI] Service status overlay update: ${status}`); if (status === 'online') { hideServiceStatusOverlay(); return; } const title = dom.serviceStatusTitle; const msg = dom.serviceStatusMessage; const icon = dom.serviceStatusIcon; if (!title || !msg || !icon) return; const statusText = status.charAt(0).toUpperCase() + status.slice(1); title.textContent = `Store Status: ${statusText}`; msg.textContent = escapeHTML(message || `The store is currently ${status}.`); overlay.className = 'service-status-overlay content-section'; icon.className = 'icon'; switch (status) { case 'offline': overlay.classList.add('offline'); icon.classList.add('icon-status-offline'); break; case 'maintenance': overlay.classList.add('maintenance'); icon.classList.add('icon-status-maintenance'); break; default: overlay.classList.add('unknown'); icon.classList.add('icon-status-unknown'); title.textContent = 'Store Status: Unknown'; break; } overlay.style.display = 'flex';
    }
    /** Hides the service status overlay. */
    function hideServiceStatusOverlay() { /* ... (same as before) ... */
        const overlay = dom.serviceStatusOverlay; if (overlay && overlay.style.display !== 'none') { log('[UI] Hiding service status overlay.'); overlay.style.display = 'none'; }
    }
    /** Updates the dedicated Status Panel with service status details. */
    function displayServiceStatusPanel() {
        log("[UI] Updating Status Panel");
        if (!dom.statusPanel || !dom.serviceStatusPanelText || !dom.serviceStatusPanelMessage || !dom.serviceStatusPanelIcon || !dom.serviceStatusLastChecked || !dom.serviceStatusPanelIconWrapper) {
            warn("[UI] Status panel elements missing, cannot update.");
            return;
        }
        const { status, message } = state.serviceStatus;
        const statusText = status.charAt(0).toUpperCase() + status.slice(1);

        // Update main text and message
        dom.serviceStatusPanelText.textContent = `Service is ${statusText}`;
        dom.serviceStatusPanelMessage.textContent = escapeHTML(message || `The Add-on store service is currently ${status}.`);

        // Update icon and wrapper data attribute for styling
        dom.serviceStatusPanelIconWrapper.setAttribute('data-status', status); // Use data-status for consistency
        dom.serviceStatusPanelIcon.className = 'icon'; // Reset icon class
        switch (status) {
            case 'online': dom.serviceStatusPanelIcon.classList.add('icon-check'); break; // Use check for online
            case 'offline': dom.serviceStatusPanelIcon.classList.add('icon-status-offline'); break;
            case 'maintenance': dom.serviceStatusPanelIcon.classList.add('icon-status-maintenance'); break;
            default: dom.serviceStatusPanelIcon.classList.add('icon-help'); break; // Unknown
        }

        // Update last checked time
        const timestamp = state.serviceStatusLastChecked;
        if (timestamp && typeof timestamp === 'number') {
            try {
                const date = new Date(timestamp);
                if (!isNaN(date)) {
                    const formattedDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
                    dom.serviceStatusLastChecked.textContent = `Checked: ${formattedDate}`;
                    dom.serviceStatusLastChecked.setAttribute('datetime', date.toISOString());
                    dom.serviceStatusLastChecked.title = `Status last checked: ${date.toLocaleString()}`;
                } else { throw new Error("Invalid Date"); }
            } catch (e) {
                error("Failed to format status timestamp", e);
                dom.serviceStatusLastChecked.textContent = 'Checked: Error';
                dom.serviceStatusLastChecked.title = 'Error displaying check time';
            }
        } else {
            dom.serviceStatusLastChecked.textContent = 'Never checked';
            dom.serviceStatusLastChecked.removeAttribute('datetime');
            dom.serviceStatusLastChecked.title = 'Service status has not been checked yet';
        }
    }

    // == Toast Notifications ==
    function showToast(message, type = 'info', duration = CONFIG.toastDuration) { /* ... (same as before) ... */
        const container = dom.toastContainer; if (!container) { error("Toast container missing!"); return; } log(`[UI] Toast (${type}): ${message}`); const toast = document.createElement("div"); toast.className = `toast ${type}`; toast.textContent = escapeHTML(message); toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); container.appendChild(toast); requestAnimationFrame(() => { toast.classList.add("show"); }); setTimeout(() => { toast.classList.remove("show"); toast.addEventListener('transitionend', () => { if (toast.parentElement) toast.remove(); }, { once: true }); }, duration);
    }

    // == Sidebar Navigation ==
    function setupSidebarNavigation() { /* ... (same as before, calls displayServiceStatusPanel on switch) ... */
        log("Setting up sidebar navigation"); if (!dom.sidebarNav) { error("Sidebar nav container missing."); return; }
        dom.sidebarNav.addEventListener('click', (e) => { const btn = e.target.closest('.sidebar-button'); if (btn && !btn.classList.contains('active')) { switchPanel(btn); } });
    }
    function switchPanel(newButton) { /* ... (same as before, calls displayServiceStatusPanel on switch) ... */
        const targetId = newButton.getAttribute('data-panel-target'); if (!targetId) { warn("Button missing data-panel-target"); return; } log(`Switching panel to '${targetId}'`); state.currentPanel = targetId;
        dom.sidebarButtons?.forEach(b => { b.classList.remove('active'); b.removeAttribute('aria-current'); }); dom.contentPanels?.forEach(p => { p.hidden = true; });
        newButton.classList.add('active'); newButton.setAttribute('aria-current', 'page');
        const newPanel = document.getElementById(targetId);
        if (newPanel) {
            newPanel.hidden = false;
            setTimeout(() => { try { newPanel.focus({ preventScroll: true }); } catch(e){} }, 50);
            // If switching to the Status panel, update its content
            if (targetId === 'panel-status') {
                displayServiceStatusPanel();
                 // Optionally trigger a fresh status check if desired when panel is viewed
                 // fetchServiceStatus(true);
            }
        } else { error(`Target panel not found: ${targetId}`); showToast(`Error finding panel '${targetId}'.`, "error"); }
    }

    // == Display Settings Logic ==
    /** Loads display settings from storage and updates UI checkboxes. */
    async function loadDisplaySettings() {
        log("[Settings] Loading display settings...");
        try {
            const savedSettings = await storageGet(CONFIG.storageKeys.displaySettings);
            if (savedSettings && typeof savedSettings === 'object') {
                // Merge saved settings with defaults, ensuring all keys exist
                state.displaySettings = {
                    ...state.displaySettings, // Start with defaults
                    ...savedSettings // Overwrite with saved values
                };
                log("[Settings] Loaded settings:", state.displaySettings);
            } else {
                log("[Settings] No saved settings found, using defaults.");
                // Save defaults if nothing was loaded
                await saveDisplaySettings();
            }
        } catch (err) {
            error("[Settings] Error loading display settings:", err);
            // Use defaults in case of error
        }
        // Update checkbox UI to reflect current state
        applyDisplaySettingsToUI();
    }

    /** Saves the current display settings state to storage. */
    async function saveDisplaySettings() {
        log("[Settings] Saving display settings:", state.displaySettings);
        try {
            await storageSet({ [CONFIG.storageKeys.displaySettings]: state.displaySettings });
            log("[Settings] Settings saved.");
        } catch (err) {
            error("[Settings] Error saving display settings:", err);
            showToast("Error saving display settings.", "error");
        }
    }

    /** Updates the checkbox elements in the UI based on the current settings state. */
    function applyDisplaySettingsToUI() {
        log("[Settings] Applying settings to UI checkboxes");
        if (dom.settingShowVersion) dom.settingShowVersion.checked = state.displaySettings.showVersion;
        if (dom.settingShowAuthor) dom.settingShowAuthor.checked = state.displaySettings.showAuthor;
        if (dom.settingShowDescription) dom.settingShowDescription.checked = state.displaySettings.showDescription;
    }

    /** Handles changes to the display setting checkboxes. */
    function handleDisplaySettingChange(event) {
        const checkbox = event.target;
        const settingKey = checkbox.id.replace('setting-', '').replace(/-(\w)/g, (match, letter) => letter.toUpperCase()); // e.g., setting-show-version -> showVersion

        if (settingKey in state.displaySettings) {
            log(`[Settings] Setting changed: ${settingKey} = ${checkbox.checked}`);
            state.displaySettings[settingKey] = checkbox.checked;
            saveDisplaySettings(); // Save immediately on change
            // Re-render the currently visible add-ons to apply the change instantly
            displayAddOns();
        } else {
            warn(`[Settings] Unknown setting key derived from checkbox ID: ${checkbox.id}`);
        }
    }


    // == Event Handlers ==
    async function handleRefreshClick() { /* ... (same as before) ... */
        if (state.isLoadingList || state.isLoadingStatus) return; log("[Event] Refresh triggered."); setListLoadingState(true); state.isLoadingStatus = true; updateUIState(); state.hasListError = false; state.listErrorMessage = '';
        try { state.serviceStatus = await fetchServiceStatus(true); showServiceStatusOverlay(); displayServiceStatusPanel(); if (state.serviceStatus.status === 'online') { state.currentPage = 1; await fetchAddOns(true); showToast('Add-on list refreshed.', 'success'); } else { warn("[Event] Service offline/maintenance during refresh."); state.allAddOns = []; state.addOnDataCache = {}; displayAddOns(); } log("[Event] Refresh complete."); } catch (err) { error("[Event] Error during refresh:", err); state.hasListError = true; state.listErrorMessage = `Failed to refresh: ${err.message}`; showToast(`Refresh failed: ${err.message}`, 'error'); displayAddOns(); } finally { setListLoadingState(false); state.isLoadingStatus = false; updateUIState(); }
    }
    function handleSearchInput() { /* ... (same as before) ... */
        const query = dom.searchInput?.value || ''; if (query.trim().toLowerCase() !== state.searchQuery.trim().toLowerCase()) { log(`[Event] Search: "${query}"`); state.searchQuery = query; state.currentPage = 1; displayAddOns(); }
    }
    function handleSortChange(event) { /* ... (same as before) ... */
        const newSortOrder = event.target.value; if (newSortOrder !== state.sortOrder) { log(`[Event] Sort changed to: ${newSortOrder}`); state.sortOrder = newSortOrder; state.currentPage = 1; displayAddOns(); }
    }
    async function handleAddOnListClick(event) { /* ... (same as before) ... */
        const target = event.target.closest('button'); if (!target) return; const name = target.dataset.addonName; if (!name) return; log(`[Event] List click: ${name}, Action: ${target.className}`); if (target.matches('.install-addon-button')) { openInstallModal(name); } else if (target.matches('.changelog-button')) { await openChangelogModal(name); } else if (target.matches('.retry-button')) { const card = target.closest('.addon-card'); if (!card) return; target.disabled = true; target.innerHTML = `<span class="icon icon-spinner loading-spinner" aria-hidden="true"></span> Retrying...`; card.classList.remove('addon-card-error'); card.dataset.loaded = 'false'; card.dataset.loading = 'true'; card.setAttribute('aria-busy', 'true'); log(`[Event] Retrying: ${name}`); try { const cacheKey = `${CONFIG.storageKeys.addOnDataPrefix}${name}`; await storageRemove([cacheKey, `${cacheKey}_timestamp`]); delete state.addOnDataCache[name]; const dirInfo = state.allAddOns.find(a => a.name === name); if (dirInfo) { await populateAddOnCard(card, dirInfo); } else { throw new Error("Directory info missing for retry."); } } catch (err) { error(`Retry failed for ${name}:`, err); card.classList.add('addon-card-error'); target.disabled = false; target.innerHTML = `<span class="icon icon-error"></span> Retry Failed`; card.setAttribute('aria-busy', 'false'); card.dataset.loading = 'false'; } }
    }
    // Removed handleClearStoreCacheClick handler

    // == Initialization ==
    /** Sets up the page and loads initial data. */
    async function initialize() {
        console.log("--- Initializing NG Add-on Store (v3.3) ---");
        initDomElements(); // Cache DOM elements first

        // Set initial loading states
        setListLoadingState(true);
        state.isLoadingStatus = true;
        updateUIState();
        state.hasListError = false;

        // Display Version from Manifest
        try { const manifest = window.chrome?.runtime?.getManifest?.(); if (dom.versionElement && manifest?.version) { dom.versionElement.textContent = `v${manifest.version}`; } else if (dom.versionElement) { dom.versionElement.textContent = 'N/A'; } } catch (e) { warn("Error getting extension version:", e); if (dom.versionElement) dom.versionElement.textContent = 'Error'; }

        // Load Display Settings *before* fetching add-ons
        await loadDisplaySettings();

        // Setup Event Listeners
        log('[Init] Setting up listeners...');
        dom.searchInput?.addEventListener('input', debounce(handleSearchInput, 300));
        dom.sortSelect?.addEventListener('change', handleSortChange);
        dom.refreshButton?.addEventListener('click', handleRefreshClick);
        dom.addOnListContainer?.addEventListener('click', handleAddOnListClick);
        // Add listeners for display settings checkboxes
        dom.settingShowVersion?.addEventListener('change', handleDisplaySettingChange);
        dom.settingShowAuthor?.addEventListener('change', handleDisplaySettingChange);
        dom.settingShowDescription?.addEventListener('change', handleDisplaySettingChange);
        // Removed listener for clearStoreCacheButton
        setupSidebarNavigation();
        log('[Init] Listeners complete.');

        // Fetch Initial Data
        log('[Init] Fetching initial status and list...');
        try {
            state.serviceStatus = await fetchServiceStatus(false); // Fetches status and updates status panel
            showServiceStatusOverlay(); // Show overlay in store panel if needed

            if (state.serviceStatus.status === 'online') {
                await fetchAddOns(false); // Fetch list (applies display settings during populate)
            } else {
                warn(`[Init] Service not online (${state.serviceStatus.status}). Add-on list fetch skipped.`);
                displayAddOns(); // Show overlay/message in list container
            }
        } catch (error) {
            console.error("[Init] Critical error during initial load:", error);
            state.hasListError = true;
            state.listErrorMessage = `Failed to initialize: ${error.message}`;
            displayAddOns(); // Attempt to display error state
        } finally {
            setListLoadingState(false);
            state.isLoadingStatus = false; // Status fetch is complete
            updateUIState();
            console.log("--- Initialization Complete ---");
        }
    }

    // Confirmation Dialog Helper
    function confirmAction(message, callback) { /* ... (same as before) ... */
        log("Requesting confirmation", { message }); if (window.confirm(message)) { log("Confirmed."); if (typeof callback === 'function') { try { const res = callback(); if (res instanceof Promise) res.catch(err => { error("Async confirm action failed", err); showToast("Action failed.", "error"); }); } catch (err) { error("Sync confirm action failed", err); showToast("Action failed.", "error"); } } } else log("User cancelled action.");
    }

    // --- Start Application ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})(); // End IIFE
