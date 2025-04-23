/**
 * NG Extension Manager - Updates Page Script v2.0
 *
 * Handles checking for extension updates via GitHub Releases API,
 * displaying status, changelogs, and debug information.
 * Uses automatic OS-based light/dark theme via CSS.
 * Icons are referenced via <img> tags.
 */

(() => { // IIFE to encapsulate scope
    'use strict';

    // == Configuration ==
    const ENABLE_DEBUG_LOGGING = true; // Master switch for debug features
    const GITHUB_REPO_URL = "https://github.com/Nitra-Global/NG-Extension-Manager"; // Target repository

    // --- Icon File Paths (relative to updates.html) ---
    // Ensure these files exist!
    const ICON_PATH_PREFIX = '../../public/icons/svg/';
    const ICONS = {
        // Status Icons
        INITIALIZING: `${ICON_PATH_PREFIX}info.svg`,
        LOADING: `${ICON_PATH_PREFIX}loading.svg`, // Assumes an animated loader SVG
        UP_TO_DATE: `${ICON_PATH_PREFIX}check.svg`, // Use filled icons for clarity
        OUTDATED: `${ICON_PATH_PREFIX}warning.svg`,
        ERROR: `${ICON_PATH_PREFIX}error.svg`,
        UNKNOWN: `${ICON_PATH_PREFIX}help.svg`,
        // Other icons used in HTML are directly referenced there now.
    };

    // == Constants ==
    const API_BASE = "https://api.github.com";
    let repoPath = '';
    try {
        repoPath = new URL(GITHUB_REPO_URL).pathname.split('/').filter(Boolean).slice(-2).join('/');
    } catch (e) {
        console.error("Invalid GITHUB_REPO_URL format:", GITHUB_REPO_URL);
    }
    const API_ENDPOINTS = {
        RELEASES: repoPath ? `${API_BASE}/repos/${repoPath}/releases` : '' // Prevent API call if path invalid
    };
    const CACHE_KEYS = {
        RELEASES: "ngExt_releases_v5", // Incremented version
        LAST_CHECKED: "ngExt_lastChecked_v5",
        ETAG_RELEASES: "ngExt_releasesETag_v5"
    };
    const CACHE_TTL_SECONDS = 3600; // 1 hour
    const GITHUB_RELEASES_PAGE_URL = `${GITHUB_REPO_URL}/releases`;
    const DEBOUNCE_DELAY_MS = 400; // Debounce for refresh clicks

    // == State Variables ==
    let installedVersion = "0.0.0";
    let extensionTitle = "NG Extension Manager";
    let latestVersionInfo = null; // { version, tagName, downloadUrl, releaseNotes, isPrerelease, publishedAt }
    let allReleases = [];
    let isLoading = false; // Prevent concurrent fetches
    let lastCheckedTimestamp = null;
    let currentETag = null; // ETag for releases endpoint
    let currentStatus = 'initializing'; // 'initializing', 'loading', 'up-to-date', 'outdated', 'error', 'unknown'

    // == DOM Elements Cache ==
    const dom = {}; // Populated in initDomElements

    // == Utility Functions ==
    function debounce(func, delay) { /* ... (same as previous) ... */
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }
    function escapeHTML(str) { /* ... (same as previous) ... */
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
     }

    // == Enhanced Debugging ==
    const logDebug = (() => { /* ... (same as previous, using levels) ... */
        if (!ENABLE_DEBUG_LOGGING) {
            return Object.assign(() => {}, {
                info: () => {}, warn: () => {}, error: () => {}, clear: () => {}
            });
        }
        const log = (level, message, data = null) => {
            const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
            const levelIndicator = level.toUpperCase().padEnd(5);
            const logEntry = `[${time}] ${levelIndicator} | ${message}`;

            switch (level) {
                case 'error': console.error(logEntry, data !== null ? data : ''); break;
                case 'warn': console.warn(logEntry, data !== null ? data : ''); break;
                default: console.log(logEntry, data !== null ? data : ''); break;
            }
            if (dom.debugOutput) {
                const previousContent = dom.debugOutput.textContent;
                const dataString = data ? `\n${JSON.stringify(data, null, 2)}` : '';
                dom.debugOutput.textContent = `${logEntry}${dataString}\n\n${previousContent}`;
                dom.debugOutput.scrollTop = 0;
            }
        };
        const clearLog = () => {
             if (dom.debugOutput) {
                 dom.debugOutput.textContent = `[${new Date().toLocaleTimeString('en-GB')}] DEBUG   | Log cleared.\n`;
                 log('info', 'Debug log cleared manually.');
             }
        };
        return Object.assign((message, data) => log('info', message, data), {
            info: (message, data) => log('info', message, data),
            warn: (message, data) => log('warn', message, data),
            error: (message, data) => log('error', message, data),
            clear: clearLog
        });
    })();

    // == Initialization ==
    function initializeApp() {
        initDomElements(); // Cache DOM elements
        setupEventListeners(); // Setup interactions
        getManifestData(); // Get local extension info
        displayStaticInfo(); // Show static text
        loadCachedData(); // Load cached API data if available
        setupTabNavigation(); // Setup tab interactivity
        updateCurrentYear(); // Set footer year

        logDebug.info("Application initialized. Performing initial update check.");

        // Start initial check, managing loading state
        checkVersionAndUpdateStatus().catch(err => {
            logDebug.error("Initial version check failed during initialization", err);
            // Ensure loading state is reset even if initial check fails
            if (isLoading) {
                isLoading = false;
                enableLoadingState(false);
                if (dom.statusContentWrapper) {
                     dom.statusContentWrapper.classList.remove('loading');
                     dom.statusContentWrapper.setAttribute('aria-busy', 'false');
                }
                // Update status to error if not already set
                if (currentStatus !== 'error') {
                     updateStatus('error', 'Failed to check for updates', 'Error');
                     showApiError(err.message || 'Could not connect to update server.');
                }
            }
        });
    }

    function initDomElements() {
        logDebug.info("Caching DOM elements");
        const getElem = (id) => document.getElementById(id); // Simpler access
        const getQuery = (selector, parent = document) => parent.querySelector(selector);
        const getQueryAll = (selector, parent = document) => parent.querySelectorAll(selector);

        // Main elements
        dom.body = document.body;
        dom.pageWrapper = getQuery('.page-wrapper');
        dom.extensionTitleHeading = getElem("extension-title");
        dom.statusContentWrapper = getQuery("#panel-status .status-content-wrapper");

        // Tabs & Panels
        dom.tabList = getQuery('[role="tablist"]');
        dom.tabs = getQueryAll('[role="tab"]');
        dom.tabPanels = getQueryAll('[role="tabpanel"]');
        dom.changelogTab = getElem("tab-changelog");
        dom.debugTab = getElem("tab-debug");
        dom.debugPanel = getElem("panel-debug");

        // Status Panel Content
        dom.statusIndicatorWrapper = getElem("status-indicator-wrapper");
        dom.statusIcon = getElem("status-icon");
        dom.statusMessage = getElem("status-message");
        dom.refreshButton = getElem("refresh-check");
        dom.lastCheckedTimeSpan = getElem("last-checked-time");
        dom.apiErrorMessage = getElem("api-error-message");
        dom.installedVersionSpan = getElem("installed-version");
        dom.latestVersionSpan = getElem("latest-version");
        dom.copyButtons = getQueryAll(".copy-btn");
        dom.downloadButton = getElem("download-button");
        dom.viewAllReleasesLink = getElem("view-all-releases-link");
        dom.clearCacheButton = getElem("clear-cache-button");

        // Changelog Panel
        dom.changelogHeading = getElem("changelog-heading-main");
        dom.changelogContent = getElem("changelog-content");

        // Debug Panel
        dom.debugOutput = getElem("debug-output");
        dom.copyDebugLogButton = getElem("copy-debug-log");

        // Footer
        dom.currentYearSpan = getElem("current-year");

        // Other
        dom.toastContainer = getElem("toast-container");

        // Check required elements
        if (!dom.statusIcon || !dom.statusMessage || !dom.statusContentWrapper) {
             console.error("CRITICAL ERROR: Essential status UI elements not found!");
             logDebug.error("Essential Status UI elements missing, functionality may be impaired.");
        }

        // Conditionally hide debug tab via JS as fallback/confirmation
        if (dom.debugTab) {
            dom.debugTab.classList.toggle('hidden', !ENABLE_DEBUG_LOGGING);
        }
        if (dom.debugPanel && !ENABLE_DEBUG_LOGGING) {
            dom.debugPanel.hidden = true;
        }
    }

    function getManifestData() { /* ... (same as previous, uses optional chaining) ... */
        logDebug.info("Attempting to retrieve extension manifest data...");
        try {
            if (window.chrome?.runtime?.getManifest) {
                const manifestData = chrome.runtime.getManifest();
                installedVersion = manifestData.version || installedVersion;
                extensionTitle = manifestData.name || extensionTitle;
                logDebug.info("Manifest data retrieved", { version: installedVersion, name: extensionTitle });
            } else {
                logDebug.warn("chrome.runtime.getManifest API not available. Using default values.");
                installedVersion = "1.0.0-dev";
                extensionTitle = "NG Extension Manager (Dev Mode)";
            }
        } catch (error) {
            logDebug.error("Error retrieving manifest data", error);
            installedVersion = "0.0.0";
            extensionTitle = "NG Extension Manager";
        }
    }

    function displayStaticInfo() { /* ... (same as previous) ... */
        logDebug.info("Displaying static information");
        if (dom.extensionTitleHeading) dom.extensionTitleHeading.textContent = extensionTitle;
        if (dom.installedVersionSpan) dom.installedVersionSpan.textContent = installedVersion;
        if (dom.viewAllReleasesLink) dom.viewAllReleasesLink.href = GITHUB_RELEASES_PAGE_URL;
        updateLastCheckedDisplay();
     }

    function loadCachedData() { /* ... (same as previous, updates log level) ... */
        logDebug.info("Loading cached data from localStorage");
        lastCheckedTimestamp = getCachedData(CACHE_KEYS.LAST_CHECKED);
        currentETag = getCachedData(CACHE_KEYS.ETAG_RELEASES);
        if (currentETag) logDebug.info(`Loaded ETag from cache: ${currentETag}`);

        const cachedReleases = getCachedData(CACHE_KEYS.RELEASES);
        if (cachedReleases && Array.isArray(cachedReleases) && cachedReleases.length > 0) {
            logDebug.info(`Using ${cachedReleases.length} cached releases for initial UI.`);
            allReleases = cachedReleases;
            processReleaseData(allReleases);
            compareVersionsAndUpdateUI();
            updateChangelogFromCache();
        } else {
            logDebug.info("No valid cached releases found or cache expired.");
            if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = '...';
            if (dom.changelogContent) dom.changelogContent.innerHTML = '<p>Loading latest changelog...</p>';
        }
        updateLastCheckedDisplay();
    }

    function updateCurrentYear() { /* ... (same as previous) ... */
         if (dom.currentYearSpan) {
            dom.currentYearSpan.textContent = new Date().getFullYear();
        }
     }

    // == Event Listeners ==
    function setupEventListeners() { /* ... (same as previous) ... */
        logDebug.info("Setting up event listeners");
        const debouncedRefresh = debounce(handleRefreshClick, DEBOUNCE_DELAY_MS);
        if (dom.refreshButton) dom.refreshButton.addEventListener("click", debouncedRefresh);
        if (dom.downloadButton) dom.downloadButton.addEventListener("click", handleDownloadClick);
        if (dom.clearCacheButton) dom.clearCacheButton.addEventListener("click", handleClearCacheClick);
        if (dom.copyButtons) {
            dom.copyButtons.forEach(button => button.addEventListener('click', handleCopyClick));
        }
        if (dom.copyDebugLogButton && ENABLE_DEBUG_LOGGING) {
            dom.copyDebugLogButton.addEventListener('click', handleCopyDebugLogClick);
        }
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);
     }

    function handleRefreshClick() { /* ... (same as previous) ... */
        logDebug.info("Manual refresh triggered");
        checkVersionAndUpdateStatus(true).catch(err => {
            logDebug.error("Manual refresh check failed", err);
        });
     }
    function handleClearCacheClick() { /* ... (same as previous, includes skeleton reset) ... */
        logDebug.warn("Clear cache button clicked");
        confirmAction("Clear all cached update data and force a full refresh?", () => {
            logDebug.warn("Cache clearing confirmed by user");
            clearCache(); // Clears relevant localStorage items
            // Reset state variables
            latestVersionInfo = null;
            allReleases = [];
            currentETag = null;
            lastCheckedTimestamp = null;
            updateLastCheckedDisplay(); // Reset 'Last checked' time display

            // Reset UI elements to initial loading state
            if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = '...';
            if (dom.changelogContent) dom.changelogContent.innerHTML = '<p>Loading latest changelog...</p>'; // Or show skeleton
            if (dom.downloadButton) {
                dom.downloadButton.disabled = true;
                dom.downloadButton.setAttribute("aria-disabled", "true");
            }
            setChangelogTabIndicator(false); // Ensure indicator is off

            // Explicitly trigger loading state (show skeleton) before check
            if (dom.statusContentWrapper) {
                 dom.statusContentWrapper.classList.add('loading');
                 dom.statusContentWrapper.setAttribute('aria-busy', 'true');
            }
            updateStatus("loading", "Checking for updates...", "Checking for updates", true); // Show loading message/icon

            // Trigger a forced refresh
            checkVersionAndUpdateStatus(true).catch(err => {
                logDebug.error("Post-cache-clear check failed", err);
                // Ensure loading state is removed even if check fails
                 if (dom.statusContentWrapper) {
                     dom.statusContentWrapper.classList.remove('loading');
                     dom.statusContentWrapper.setAttribute('aria-busy', 'false');
                 }
            });
        });
     }
    function handleCopyClick(event) { /* ... (same as previous) ... */
        const button = event.currentTarget;
        const targetId = button?.getAttribute('data-copy-target');
        const targetElement = targetId ? document.getElementById(targetId) : null;

        if (targetElement && navigator.clipboard?.writeText) {
            const textToCopy = targetElement.textContent?.trim() || '';
            logDebug.info(`Attempting to copy: "${textToCopy}" from #${targetId}`);
            navigator.clipboard.writeText(textToCopy)
                .then(() => {
                    const type = targetId === 'installed-version' ? 'Installed' : 'Latest';
                    showToast(`${type} version copied!`, 'success', 1500);
                })
                .catch(err => {
                    logDebug.error('Clipboard writeText failed', err);
                    showToast('Failed to copy version.', 'error');
                });
        } else {
            logDebug.warn('Cannot copy: Target element or clipboard API unavailable.', { targetId, clipboard: !!navigator.clipboard });
            showToast('Cannot copy text to clipboard.', 'warning');
        }
     }
    function handleCopyDebugLogClick() { /* ... (same as previous) ... */
        if (dom.debugOutput && navigator.clipboard?.writeText) {
            const logText = dom.debugOutput.textContent || '';
            logDebug.info('Copying debug log');
            navigator.clipboard.writeText(logText)
                .then(() => { showToast('Debug log copied!', 'success', 1500); })
                .catch(err => {
                    logDebug.error('Failed to copy debug log', err);
                    showToast('Failed to copy debug log.', 'error');
                });
        } else {
            logDebug.warn('Cannot copy debug log - element or clipboard API missing');
            showToast('Cannot copy debug log.', 'error');
        }
    }
    function handleOnlineStatus() { /* ... (same as previous) ... */
        logDebug.info("Network status changed: Online");
        showToast("Connection restored.", 'success', 2000);
        hideApiError();
        if (currentStatus === 'error') {
            logDebug.info("Network online, re-checking version status.");
            checkVersionAndUpdateStatus().catch(err => {
                logDebug.error("Online status check failed", err);
            });
        }
     }
    function handleOfflineStatus() { /* ... (same as previous) ... */
        logDebug.warn("Network status changed: Offline");
        if (!isLoading) {
            updateStatus('error', "You are offline", "Offline");
            showApiError("Cannot check for updates. Please check your internet connection.");
            showToast("Connection lost. Unable to check for updates.", 'warning', 6000);
        } else {
            logDebug.info("Offline status detected during loading, fetch should handle it.");
        }
    }
    function handleDownloadClick() { /* ... (same as previous, uses optional chaining) ... */
        if (!latestVersionInfo?.downloadUrl) {
            showToast("Download link not available for the latest version.", 'error');
            logDebug.error("Download click failed: No download URL in latestVersionInfo.", latestVersionInfo);
            return;
        }
        const url = latestVersionInfo.downloadUrl;
        let filename = `NG-Extension-Manager-${latestVersionInfo.tagName || 'latest'}.zip`;
        try {
            const urlFilename = new URL(url).pathname.split('/').pop();
            if (urlFilename && urlFilename.toLowerCase().endsWith('.zip')) filename = urlFilename;
        } catch (e) { logDebug.warn("Could not parse URL to extract filename", e); }

        logDebug.info(`Download initiated: Name='${filename}', URL='${url}'`);

        if (window.chrome?.downloads?.download) {
            try {
                chrome.downloads.download({ url: url, filename: filename }, downloadId => {
                    if (chrome.runtime.lastError) {
                        logDebug.error("chrome.downloads.download API error", chrome.runtime.lastError);
                        showToast(`Download error: ${chrome.runtime.lastError.message}`, 'error');
                        window.open(url, '_blank');
                    } else if (downloadId !== undefined) {
                        showToast("Download started...", 'success');
                        logDebug.info(`Download started via API with ID: ${downloadId}`);
                    } else {
                        logDebug.warn("Download did not start via API (no ID), opening link.");
                        showToast("Opening download link.", 'info');
                        window.open(url, '_blank');
                    }
                });
            } catch (e) {
                logDebug.error("Exception calling chrome.downloads.download", e);
                showToast("Download failed. Opening link.", 'info');
                window.open(url, '_blank');
            }
        } else {
            logDebug.info("chrome.downloads API not available, opening link directly.");
            showToast("Opening download link in new tab.", 'info');
            window.open(url, '_blank');
        }
     }

    // == Tab Navigation ==
    function setupTabNavigation() { /* ... (same as previous) ... */
        logDebug.info("Setting up tab navigation");
        if (!dom.tabList) return;
        dom.tabList.addEventListener('click', (event) => {
            const clickedTab = event.target.closest('[role="tab"]');
            if (!clickedTab || clickedTab.getAttribute('aria-selected') === 'true') return;
            switchTab(clickedTab);
        });
        dom.tabList.addEventListener('keydown', (event) => {
            const currentTab = event.target.closest('[role="tab"]');
            if (!currentTab) return;
            const visibleTabs = Array.from(dom.tabs).filter(tab => !tab.classList.contains('hidden') && tab.offsetParent !== null);
            const currentIndex = visibleTabs.indexOf(currentTab);
            if (currentIndex === -1) return;
            let newIndex = currentIndex;
            let shouldPreventDefault = false;
            switch (event.key) {
                case 'ArrowRight': case 'ArrowDown': newIndex = (currentIndex + 1) % visibleTabs.length; shouldPreventDefault = true; break;
                case 'ArrowLeft': case 'ArrowUp': newIndex = (currentIndex - 1 + visibleTabs.length) % visibleTabs.length; shouldPreventDefault = true; break;
                case 'Home': newIndex = 0; shouldPreventDefault = true; break;
                case 'End': newIndex = visibleTabs.length - 1; shouldPreventDefault = true; break;
            }
            if (shouldPreventDefault) {
                event.preventDefault();
                const newTab = visibleTabs[newIndex];
                if (newTab) newTab.focus();
            }
        });
     }
    function switchTab(newTab) { /* ... (same as previous) ... */
        if (!newTab) return;
        logDebug.info(`Switching tab to: ${newTab.id}`);
        dom.tabs.forEach(tab => {
            if (!tab) return;
            tab.setAttribute('aria-selected', 'false');
            tab.classList.remove('active');
            tab.setAttribute('tabindex', '-1');
            const panel = document.getElementById(tab.getAttribute('aria-controls'));
            if (panel) panel.hidden = true;
        });
        newTab.setAttribute('aria-selected', 'true');
        newTab.classList.add('active');
        newTab.setAttribute('tabindex', '0');
        const newPanel = document.getElementById(newTab.getAttribute('aria-controls'));
        if (newPanel) {
            newPanel.hidden = false;
            setTimeout(() => { newPanel.focus({ preventScroll: true }); }, 50);
        }
        if (newTab.id === 'tab-debug' && dom.debugOutput) {
            setTimeout(() => { if(dom.debugOutput) dom.debugOutput.scrollTop = 0; }, 50);
        }
    }

    // == Core Logic: Update Check ==
    async function checkVersionAndUpdateStatus(forceRefresh = false) { /* ... (same as previous, includes aria-busy) ... */
        if (isLoading) {
            logDebug.warn("Update check skipped: Another check already in progress.");
            return;
        }
        if (!API_ENDPOINTS.RELEASES) {
            logDebug.error("API endpoint not configured. Cannot check for updates.");
            updateStatus('error', 'Configuration Error', 'Error');
            showApiError("Update check endpoint is not configured correctly.");
            return;
        }

        isLoading = true;
        currentStatus = 'loading';
        updateStatus("loading", "Checking for updates...", "Checking for updates", true);
        if (dom.statusContentWrapper) {
            dom.statusContentWrapper.classList.add('loading');
            dom.statusContentWrapper.setAttribute('aria-busy', 'true');
        }
        logDebug.info(`Starting update check (Force Refresh: ${forceRefresh})`);
        enableLoadingState(true);

        try {
            if (!navigator.onLine) throw new Error("Offline");

            const releasesResponse = await fetchWithCache(
                API_ENDPOINTS.RELEASES, CACHE_KEYS.RELEASES, CACHE_KEYS.ETAG_RELEASES, forceRefresh, currentETag
            );

            if (releasesResponse.status === 304) {
                logDebug.info("Releases not modified (304). Using cached data.");
                if (!allReleases || allReleases.length === 0) {
                    logDebug.warn("Received 304 but local cache is empty. Forcing full refresh.");
                    currentETag = null;
                    clearSpecificCache(CACHE_KEYS.ETAG_RELEASES);
                    await checkVersionAndUpdateStatus(true);
                    return;
                }
                lastCheckedTimestamp = Date.now();
                cacheData(CACHE_KEYS.LAST_CHECKED, lastCheckedTimestamp);
                updateLastCheckedDisplay();
                processReleaseData(allReleases);
                compareVersionsAndUpdateUI();
                // showToast("Version status is current.", "info", 2000); // Can be noisy
                hideApiError();
            } else if (releasesResponse.status === 200 && releasesResponse.data) {
                allReleases = releasesResponse.data;
                const newETag = releasesResponse.etag;
                if (!Array.isArray(allReleases)) throw new Error("Invalid data format from API: Expected an array.");

                cacheData(CACHE_KEYS.RELEASES, allReleases);
                if (newETag) {
                    currentETag = newETag;
                    cacheData(CACHE_KEYS.ETAG_RELEASES, newETag);
                    logDebug.info(`Fetched ${allReleases.length} releases. New ETag: ${newETag}`);
                } else {
                    logDebug.warn("No ETag received in 200 OK response.");
                    currentETag = null;
                    clearSpecificCache(CACHE_KEYS.ETAG_RELEASES);
                }

                if (allReleases.length === 0) {
                    logDebug.warn("No releases found in the repository.");
                    showToast("No public releases found.", 'warning');
                    updateStatus("up-to-date", `Up to date (v${installedVersion}). No releases.`, "Up to date");
                    if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A';
                    latestVersionInfo = null;
                    updateChangelogUI(null, '<p><em>No releases found in the repository.</em></p>');
                } else {
                    processReleaseData(allReleases);
                    compareVersionsAndUpdateUI();
                }
                lastCheckedTimestamp = Date.now();
                cacheData(CACHE_KEYS.LAST_CHECKED, lastCheckedTimestamp);
                updateLastCheckedDisplay();
                hideApiError();
            } else {
                throw new Error(`Unexpected response status from fetch: ${releasesResponse.status}`);
            }
        } catch (error) {
            // Error handling logic (same as previous, but uses logDebug levels)
            console.error("Error during update check:", error);
            logDebug.error("Update check failed", { msg: error.message, status: error.status, name: error.name, details: error.details });
            let userMessage = "Error checking for updates.";
            let statusType = 'error';
            let apiErrorDetails = `An unexpected error occurred: ${error.message || 'Check console.'}`;
            if (error.message === "Offline" || (error instanceof TypeError && error.message.includes('fetch'))) {
                userMessage = "You are offline"; statusType = 'warning'; apiErrorDetails = "Cannot check for updates. Please check your internet connection.";
            } else if (error.status === 403) {
                userMessage = "API Rate Limit Exceeded"; statusType = 'warning'; apiErrorDetails = "GitHub API rate limit reached. Please wait (~1 hour) and try again.";
            } else if (error.status === 404) {
                userMessage = "Repository Not Found"; apiErrorDetails = `Could not find the repository releases. Check configuration.`;
            } else if (error.status >= 400 && error.status < 500) {
                userMessage = `API Client Error (${error.status})`; apiErrorDetails = `Error fetching updates: ${error.details?.message || error.message || 'Check console.'}`;
            } else if (error.status >= 500) {
                userMessage = `API Server Error (${error.status})`; apiErrorDetails = `Update server (GitHub) returned an error. Please try again later.`;
            }
            updateStatus(statusType, userMessage, `Error: ${userMessage}`);
            showApiError(apiErrorDetails);
            if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = "Error";
            if (dom.downloadButton) { dom.downloadButton.disabled = true; dom.downloadButton.setAttribute("aria-disabled", "true"); }
            setChangelogTabIndicator(false);
        } finally {
            isLoading = false;
            enableLoadingState(false);
            if (dom.statusContentWrapper) {
                dom.statusContentWrapper.classList.remove('loading'); // Hide skeleton
                dom.statusContentWrapper.setAttribute('aria-busy', 'false');
            }
            logDebug.info(`Update check finished. Resulting status: ${currentStatus}`);
        }
    }


    // == API Interaction & Data Processing ==
    async function fetchWithCache(url, dataCacheKey, etagCacheKey, forceRefresh = false, currentETagValue = null) { /* ... (same as previous) ... */
        logDebug.info(`Fetching data for: ${url}`, { forceRefresh, hasETag: !!currentETagValue });
        const headers = { 'Accept': 'application/vnd.github.v3+json', 'X-GitHub-Api-Version': '2022-11-28' };
        if (currentETagValue && !forceRefresh) headers['If-None-Match'] = currentETagValue;

        try {
            const response = await fetch(url, { method: 'GET', headers: headers, cache: 'no-cache' });
            if (response.status === 304) {
                logDebug.info(`304 Not Modified received for ${url}.`);
                const cachedData = getCachedData(dataCacheKey);
                if (!cachedData) {
                     logDebug.warn("Received 304 but no data found in localStorage cache.", { dataCacheKey });
                     return { status: 304, data: null, etag: currentETagValue };
                }
                return { status: 304, data: cachedData, etag: currentETagValue };
            }
            if (!response.ok) {
                let errorText = response.statusText; let errorDetails = null;
                try { errorDetails = await response.json(); errorText = errorDetails.message || errorText; } catch (e) { }
                const httpError = new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                httpError.status = response.status; httpError.details = errorDetails; throw httpError;
            }
            const data = await response.json(); const newEtag = response.headers.get('ETag');
            logDebug.info(`Fetch OK for ${url}. Status: ${response.status}. New ETag: ${newEtag || 'None'}`);
            if (url.endsWith('/releases') && !Array.isArray(data)) throw new Error("Invalid data format: Expected array from releases endpoint.");
            return { status: 200, data: data, etag: newEtag };
        } catch (error) {
            if (!(error instanceof Error)) error = new Error(String(error));
            if (!error.status) error.message = error.message.includes('fetch') ? 'Network error or CORS issue.' : error.message;
            logDebug.error(`Fetch failed for ${url}`, { error: error.message, status: error.status, name: error.name });
            throw error;
        }
     }
    function processReleaseData(releases) { /* ... (same robust sorting and finding logic as previous) ... */
        if (!releases || !Array.isArray(releases) || releases.length === 0) {
            logDebug.warn("processReleaseData: No valid releases array provided."); latestVersionInfo = null; if(dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A'; return;
        }
        logDebug.info(`Processing ${releases.length} releases.`);
        releases.sort((a, b) => { /* ... robust date sorting ... */
            const dateA = a?.published_at || a?.created_at; const dateB = b?.published_at || b?.created_at;
            if (!dateA && !dateB) return 0; if (!dateA) return 1; if (!dateB) return -1;
            try { return new Date(dateB) - new Date(dateA); } catch (e) { return 0; }
        });
        const latestStable = releases.find(r => r && !r.prerelease && !r.draft && r.tag_name);
        const definitiveLatest = latestStable || releases.find(r => r && !r.draft && r.tag_name);
        if (!definitiveLatest) {
            logDebug.error("Could not determine a valid latest release."); latestVersionInfo = null; if(dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'Error'; return;
        }
        logDebug.info(`Latest release determined: Tag='${definitiveLatest.tag_name}', Pre='${definitiveLatest.prerelease}', Draft='${definitiveLatest.draft}'`);
        const tagName = definitiveLatest.tag_name; const version = tagName.replace(/^v/i, '');
        const downloadUrl = findReleaseDownloadUrl(definitiveLatest); const releaseNotes = definitiveLatest.body || "No release notes provided.";
        const isPrerelease = definitiveLatest.prerelease || false; const publishedAtStr = definitiveLatest.published_at || definitiveLatest.created_at;
        let publishedAt = null; if (publishedAtStr) try { publishedAt = new Date(publishedAtStr); } catch (e) { logDebug.warn("Failed to parse release date", e); }
        latestVersionInfo = { version, tagName, downloadUrl, releaseNotes, isPrerelease, publishedAt };
        logDebug.info("Updated latestVersionInfo", latestVersionInfo);
        if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = latestVersionInfo.tagName || 'Error';
        updateChangelogUI(latestVersionInfo.tagName, latestVersionInfo.releaseNotes);
    }
    function updateChangelogFromCache() { /* ... (same as previous) ... */
        if (latestVersionInfo?.releaseNotes) {
            logDebug.info("Updating changelog from initially loaded cached data.");
            updateChangelogUI(latestVersionInfo.tagName, latestVersionInfo.releaseNotes);
        } else {
            logDebug.info("No cached version info for initial changelog display.");
        }
    }
    function compareVersionsAndUpdateUI() { /* ... (same as previous) ... */
        logDebug.info("Comparing versions and updating UI status...");
        updateStatusBasedOnComparison();
     }


    // == Caching ==
    function cacheData(key, data) { /* ... (same as previous) ... */
        if (typeof localStorage === 'undefined') return;
        const cacheEntry = { data: data }; if (key === CACHE_KEYS.RELEASES) cacheEntry.expiry = Date.now() + (CACHE_TTL_SECONDS * 1000);
        try { localStorage.setItem(key, JSON.stringify(cacheEntry)); logDebug.info(`Cached data for key: ${key}`, { hasExpiry: !!cacheEntry.expiry }); } catch (error) { logDebug.error(`Cache store failed for ${key}`, error); if (error.name === 'QuotaExceededError') showToast("Cache storage full.", 'warning'); }
     }
    function getCachedData(key) { /* ... (same as previous) ... */
        if (typeof localStorage === 'undefined') return null;
        try { const d = localStorage.getItem(key); if (!d) return null; const c = JSON.parse(d); if (c.expiry && Date.now() > c.expiry) { logDebug.warn(`Cache expired for key: ${key}.`); localStorage.removeItem(key); return null; } return c.data; } catch (error) { logDebug.error(`Cache retrieve/parse failed for ${key}`, error); try { localStorage.removeItem(key); } catch (e) {} return null; }
     }
    function clearCache() { /* ... (same as previous) ... */
        logDebug.warn("Clearing all related cache items..."); if (typeof localStorage === 'undefined') return; Object.values(CACHE_KEYS).forEach(key => clearSpecificCache(key)); showToast("Cached data cleared.", 'info');
     }
    function clearSpecificCache(key) { /* ... (same as previous) ... */
         if (typeof localStorage === 'undefined') return; try { localStorage.removeItem(key); logDebug.info(`Removed cache item: ${key}`); } catch (e) { logDebug.error(`Failed to remove cache item ${key}`, e); }
     }


    // == UI Updates ==
    function updateStatusBasedOnComparison() { /* ... (same as previous, calls setChangelogTabIndicator) ... */
        let comparisonStatus = 'unknown';
        if (!latestVersionInfo?.version) {
            logDebug.warn("Comparison skipped: latestVersionInfo invalid.");
            if (currentStatus !== 'error') updateStatus("error", "Could not get latest version", "Error");
            comparisonStatus = 'error';
        } else {
            const current = installedVersion; const latest = latestVersionInfo.version; const latestTag = latestVersionInfo.tagName || latest;
            logDebug.info(`Comparing versions: Installed='${current}', Latest='${latest}' (Tag: '${latestTag}')`);
            if (isNewVersionAvailable(current, latest)) {
                logDebug.info(`New version available: ${latestTag}`); updateStatus("outdated", `Update available: ${latestTag}`, `Update available`); comparisonStatus = 'outdated'; setChangelogTabIndicator(true);
                const canDownload = !!latestVersionInfo.downloadUrl;
                if (dom.downloadButton) {
                    dom.downloadButton.disabled = !canDownload; dom.downloadButton.setAttribute("aria-disabled", String(!canDownload)); dom.downloadButton.title = canDownload ? `Download version ${latestTag}` : `Download unavailable`; dom.downloadButton.setAttribute("aria-label", canDownload ? `Download version ${latestTag}` : `Download not available`);
                    if (!canDownload) showToast(`No direct download found for ${latestTag}. Check Releases page.`, 'warning');
                }
            } else {
                logDebug.info("Extension is up to date."); updateStatus("up-to-date", `Up to date (v${installedVersion})`, `Up to date`); comparisonStatus = 'up-to-date'; setChangelogTabIndicator(false);
                if (dom.downloadButton) {
                    dom.downloadButton.disabled = true; dom.downloadButton.setAttribute("aria-disabled", "true"); dom.downloadButton.title = `Version ${installedVersion} is the latest`; dom.downloadButton.setAttribute("aria-label", `Latest version installed`);
                }
                updateChangelogUI(latestTag, latestVersionInfo.releaseNotes); // Still show latest changelog
            }
        }
        if (currentStatus !== 'error') currentStatus = comparisonStatus; // Update logical status
    }

    /** Updates status message, icon source, and ARIA attributes */
    function updateStatus(statusKey, message, ariaLabel = null, clearApiError = false) {
        const validStatuses = ['initializing', 'loading', 'up-to-date', 'outdated', 'error', 'unknown'];
        statusKey = validStatuses.includes(statusKey) ? statusKey : 'unknown';
        logDebug.info(`Updating UI status display: Key='${statusKey}', Message='${message}'`);

        if (!dom.statusMessage || !dom.statusIcon || !dom.statusIndicatorWrapper) {
            logDebug.error("Cannot update status UI - essential elements missing.");
            return;
        }

        dom.statusMessage.textContent = message;
        dom.statusIndicatorWrapper.setAttribute("aria-label", `Current status: ${ariaLabel || message}`);
        dom.statusIndicatorWrapper.setAttribute("data-status", statusKey); // For CSS styling of text

        // Set icon source based on status
        let iconSrc = ICONS.UNKNOWN; // Default icon
        let iconAlt = "Unknown Status";
        dom.statusIcon.classList.remove('loading'); // Remove loading animation class by default

        switch (statusKey) {
            case 'loading':
                iconSrc = ICONS.LOADING; iconAlt = "Loading Status"; dom.statusIcon.classList.add('loading'); break;
            case 'initializing':
                iconSrc = ICONS.INITIALIZING; iconAlt = "Initializing Status"; break;
            case 'up-to-date':
                iconSrc = ICONS.UP_TO_DATE; iconAlt = "Up to Date Status"; break;
            case 'outdated':
                iconSrc = ICONS.OUTDATED; iconAlt = "Update Available Status"; break;
            case 'error':
                iconSrc = ICONS.ERROR; iconAlt = "Error Status"; break;
            default: // unknown
                iconSrc = ICONS.UNKNOWN; iconAlt = "Unknown Status"; break;
        }
        dom.statusIcon.src = iconSrc;
        dom.statusIcon.alt = iconAlt;

        if (clearApiError) hideApiError();
    }

    function updateChangelogUI(tagName, markdownNotes) { /* ... (same as previous, uses markdownToHTML) ... */
        if (typeof markdownToHTML !== 'function') {
            logDebug.error("markdownToHTML function not found! Ensure markdown.js is loaded.");
            if (dom.changelogContent) dom.changelogContent.innerHTML = `<p><strong>Error:</strong> Cannot display changelog content.</p>`;
            if (dom.changelogHeading) dom.changelogHeading.textContent = `Changelog (Error)`; return;
        }
        logDebug.info(`Updating changelog UI. Tag: ${tagName || 'N/A'}`);
        if (!dom.changelogHeading || !dom.changelogContent) { logDebug.error("Changelog UI elements not found."); return; }
        dom.changelogHeading.textContent = tagName ? `Changelog (${tagName})` : 'Latest Changelog';
        if (!markdownNotes) { dom.changelogContent.innerHTML = '<p><em>No release notes available for this version.</em></p>'; return; }
        try {
            dom.changelogContent.innerHTML = markdownToHTML(markdownNotes); logDebug.info("Changelog HTML successfully updated.");
            dom.changelogContent.querySelectorAll('a[href^="http"]').forEach(link => { link.setAttribute('target', '_blank'); link.setAttribute('rel', 'noopener noreferrer'); link.setAttribute('title', `Opens in new tab: ${link.href}`); });
        } catch (error) { logDebug.error("Markdown parsing failed", error); dom.changelogContent.innerHTML = `<p><strong>Error displaying release notes.</strong></p><pre>${escapeHTML(markdownNotes)}</pre>`; }
    }
    function setChangelogTabIndicator(show) { /* ... (same as previous) ... */
         if (dom.changelogTab) {
             dom.changelogTab.classList.toggle('has-update', !!show);
             logDebug.info(`Changelog tab update indicator ${show ? 'shown' : 'hidden'}.`);
         }
     }
    function updateLastCheckedDisplay() { /* ... (same as previous, uses Intl) ... */
        if (!dom.lastCheckedTimeSpan) return; if (lastCheckedTimestamp) { try { const d = new Date(lastCheckedTimestamp); const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d); dom.lastCheckedTimeSpan.textContent = `Checked: ${fmt}`; dom.lastCheckedTimeSpan.setAttribute('datetime', d.toISOString()); dom.lastCheckedTimeSpan.title = `Last check: ${d.toLocaleString()}`; } catch (e) { logDebug.error("Failed to format lastCheckedTimestamp", e); dom.lastCheckedTimeSpan.textContent = 'Checked: Invalid'; } } else { dom.lastCheckedTimeSpan.textContent = 'Never checked'; dom.lastCheckedTimeSpan.removeAttribute('datetime'); dom.lastCheckedTimeSpan.title = 'No check recorded'; }
     }
    function showApiError(message) { /* ... (same as previous) ... */
        if (dom.apiErrorMessage) { dom.apiErrorMessage.innerHTML = `<strong>Error:</strong> ${escapeHTML(message)}`; dom.apiErrorMessage.style.display = 'block'; dom.apiErrorMessage.setAttribute('aria-hidden', 'false'); logDebug.error(`API Error Displayed: ${message}`); } else { logDebug.error("Cannot show API error: apiErrorMessage element not found."); }
     }
    function hideApiError() { /* ... (same as previous) ... */
        if (dom.apiErrorMessage) { dom.apiErrorMessage.style.display = 'none'; dom.apiErrorMessage.setAttribute('aria-hidden', 'true'); dom.apiErrorMessage.innerHTML = ''; logDebug.info("API Error Hidden"); }
     }
    function enableLoadingState(enable) { /* ... (same as previous) ... */
        logDebug.info(`Setting loading state: ${enable}`);
        const buttonsToDisable = [ dom.refreshButton, dom.downloadButton, dom.clearCacheButton, ...(dom.copyButtons || []), dom.copyDebugLogButton ];
        buttonsToDisable.forEach(btn => { if (btn) { btn.disabled = enable; if (btn === dom.downloadButton || btn === dom.clearCacheButton || btn === dom.refreshButton) btn.setAttribute("aria-disabled", enable.toString()); } });
        if (dom.refreshButton) { dom.refreshButton.classList.toggle('loading', enable); dom.refreshButton.setAttribute('aria-label', enable ? 'Refreshing update status, please wait' : 'Refresh update status'); }
     }
    function showToast(message, type = 'info', duration = 3500) { /* ... (same as previous) ... */
        logDebug.info(`Toast: [${type}] "${message}" (Duration: ${duration}ms)`); if (!dom.toastContainer) { logDebug.error("Toast container element missing!"); return; }
        const t = document.createElement("div"); t.className = `toast ${type}`; t.textContent = message; dom.toastContainer.appendChild(t);
        requestAnimationFrame(() => { t.classList.add("show"); });
        setTimeout(() => { t.classList.remove("show"); t.addEventListener('transitionend', () => { if (t.parentElement) t.remove(); }, { once: true }); }, duration);
     }

    // == Helper Functions ==
    function findReleaseDownloadUrl(release) { /* ... (same as previous) ... */
        if (!release) return null; logDebug.info(`Finding download URL for release: ${release.tag_name || release.id}`);
        if (release.assets?.length > 0) { const zip = release.assets.find(a => a?.browser_download_url && (a.content_type === 'application/zip' || a.name?.toLowerCase().endsWith('.zip'))); if (zip) { logDebug.info(`Found asset ZIP: ${zip.browser_download_url}`); return zip.browser_download_url; } logDebug.warn("No suitable .zip asset found.", { assets: release.assets }); }
        if (release.tag_name) { const url = `${GITHUB_REPO_URL}/archive/refs/tags/${encodeURIComponent(release.tag_name)}.zip`; logDebug.info(`Falling back to source code ZIP URL: ${url}`); return url; }
        logDebug.error(`No download URL found for release: ${release.id}`); return null;
    }
    function isNewVersionAvailable(currentVersion, latestVersion) { /* ... (same as previous) ... */
        if (typeof currentVersion !== 'string' || typeof latestVersion !== 'string') { logDebug.error("Invalid version format for comparison", { currentVersion, latestVersion }); return false; }
        const currentNorm = currentVersion.trim().replace(/^v/i, ''); const latestNorm = latestVersion.trim().replace(/^v/i, ''); if (currentNorm === latestNorm) return false;
        const currentParts = currentNorm.split('.').map(Number); const latestParts = latestNorm.split('.').map(Number); if (currentParts.some(isNaN) || latestParts.some(isNaN)) { logDebug.error("Invalid version number part found.", { current: currentVersion, latest: latestVersion }); return false; }
        const len = Math.max(currentParts.length, latestParts.length); for (let i = 0; i < len; i++) { const cPart = currentParts[i] || 0; const lPart = latestParts[i] || 0; if (lPart > cPart) return true; if (lPart < cPart) return false; } return false;
     }
    function confirmAction(message, callback) { /* ... (same as previous) ... */
        if (window.confirm(message)) { if (typeof callback === 'function') callback(); } else { logDebug.info(`Action confirmation denied: "${message}"`); }
     }

    // == Polyfills ==
    // requestAnimationFrame polyfill (same as previous)
    (function() { /* ... */ }());

    // == Start the application ==
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        initializeApp(); // DOM already ready
    }

})(); // End IIFE
