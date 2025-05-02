/**
 * NG Extension Manager - Updates Page Script v3.3 (Improved & Refactored)
 *
 * Handles checking for extension updates via GitHub Releases API, displaying status,
 * the latest changelog, advanced info (including cache/storage usage), and managing cache.
 * Uses automatic OS-based light/dark theme via CSS.
 * Icons are implemented using CSS Masks.
 * Relies on an external `markdown.js` for secure Markdown rendering.
 * Debug panel and functionality have been removed.
 * Changelog now shows only the latest version.
 * Cache and Storage usage are displayed in the Advanced panel.
 *
 * Improvements in v3.3:
 * - Removed all Debug logic and UI elements.
 * - Simplified Changelog display to only show the latest version.
 * - Added Cache Usage display (using chrome.storage.local.getBytesInUse).
 * - Added Storage Usage display (chrome.storage, localStorage, sessionStorage).
 * - Refined UI element handling and state management.
 * - Enhanced error handling for API calls and storage access.
 * - Improved informative text and user feedback.
 * - Integrated network status checks more directly.
 */

(() => { // IIFE to encapsulate scope
    'use strict';

    // == Configuration ==
    /** @const {boolean} Master switch for enabling/disabling Development logging (not debug panel). */
    const ENABLE_DEV_LOGGING = true; // Keep console logs for development
    /** @const {string} URL of the target GitHub repository. */
    const GITHUB_REPO_URL = "https://github.com/Nitra-Global/NG-Extension-Manager"; // Replace with your actual repo URL

    // == Constants ==
    /** @const {string} Base URL for the GitHub API. */
    const API_BASE = "https://api.github.com";
    /** @type {string} GitHub repository path (owner/repo), extracted from GITHUB_REPO_URL. */
    let repoPath = 'N/A';
    try {
        const url = new URL(GITHUB_REPO_URL);
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            repoPath = pathParts.slice(-2).join('/');
        } else {
            console.error("Could not extract owner/repo from GITHUB_REPO_URL:", GITHUB_REPO_URL);
        }
    } catch (e) {
        console.error("Invalid GITHUB_REPO_URL format:", GITHUB_REPO_URL, e);
    }
    /** @const {object} API endpoints used for fetching data. */
    const API_ENDPOINTS = {
        RELEASES: repoPath !== 'N/A' ? `${API_BASE}/repos/${repoPath}/releases` : '',
        // RATE_LIMIT: `${API_BASE}/rate_limit` // Usually not needed explicitly
    };
    /** @const {object} Keys used for storing data in extension storage. */
    const CACHE_KEYS = {
        RELEASES: "ngExt_releases_v8", // Versioned key
        LAST_CHECKED: "ngExt_lastChecked_v8",
        ETAG_RELEASES: "ngExt_releasesETag_v8"
    };
    /** @const {number} Cache Time-To-Live in seconds (1 hour). */
    const CACHE_TTL_SECONDS = 3600;
    /** @const {string} Direct link to the GitHub releases page. */
    const GITHUB_RELEASES_PAGE_URL = `${GITHUB_REPO_URL}/releases`;
    /** @const {number} Debounce delay in milliseconds for frequent actions like refresh. */
    const DEBOUNCE_DELAY_MS = 400;

    // == State Variables ==
    /** @type {string} Installed version of the extension. */
    let installedVersion = "0.0.0";
    /** @type {string} Name/title of the extension. */
    let extensionTitle = "NG Extension Manager";
    /** @type {object|null} Processed information about the latest release found. */
    let latestVersionInfo = null;
    /** @type {Array<object>} Raw list of all fetched releases from the API. */
    let allReleases = [];
    /** @type {boolean} Flag to prevent concurrent API fetches. */
    let isLoading = false;
    /** @type {number|null} Timestamp of the last successful update check. */
    let lastCheckedTimestamp = null;
    /** @type {string|null} ETag value for the releases endpoint for conditional fetching. */
    let currentETag = null;
    /** @type {string} Current status key ('initializing', 'loading', 'up-to-date', 'outdated', 'error', 'unknown'). */
    let currentStatus = 'initializing';
    /** @type {{remaining: number|string, reset: Date|null}} GitHub API rate limit information. */
    let rateLimitInfo = { remaining: 'N/A', reset: null };

    // == DOM Elements Cache ==
    /** @type {object} Cache for frequently accessed DOM elements. */
    const dom = {};

    // == Utility Functions ==
    /**
     * Basic console logging controlled by ENABLE_DEV_LOGGING.
     */
    const log = (...args) => {
        if (ENABLE_DEV_LOGGING) console.log('[NG Updates]', ...args);
    };
    const warn = (...args) => {
        if (ENABLE_DEV_LOGGING) console.warn('[NG Updates]', ...args);
    };
    const error = (...args) => {
        // Always log errors
        console.error('[NG Updates]', ...args);
    };

    /**
     * Debounces a function call.
     * @param {Function} func The function to debounce.
     * @param {number} delay The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    function debounce(func, delay) {
        let timeoutId;
        return function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    }

    /**
     * Formats bytes into a human-readable string (KB, MB).
     * @param {number|null|undefined} bytes The number of bytes.
     * @returns {string} Formatted string (e.g., "12.3 KB", "1.5 MB") or "N/A".
     */
     function formatBytes(bytes) {
        if (bytes === null || typeof bytes === 'undefined' || isNaN(bytes)) {
            return 'N/A';
        }
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB']; // Add more if needed
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        // Ensure index is within bounds
        const unitIndex = Math.min(i, sizes.length - 1);
        const value = parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(1));
        return `${value} ${sizes[unitIndex]}`;
     }


    // Check for markdown.js functions (from global scope)
    if (typeof window.escapeHTML !== 'function' || typeof window.sanitizeUrl !== 'function' || typeof window.markdownToHTML !== 'function') {
        error("CRITICAL: markdown.js functions (escapeHTML, sanitizeUrl, markdownToHTML) not found. Ensure markdown.js is loaded before updates.js.");
        // Provide dummy functions to prevent immediate crashes, but functionality will be broken.
        window.escapeHTML = window.escapeHTML || ((str) => str || '');
        window.sanitizeUrl = window.sanitizeUrl || (() => '');
        window.markdownToHTML = window.markdownToHTML || ((text) => `<p>Error: Markdown parser not loaded.</p><pre>${window.escapeHTML(text)}</pre>`);
    }
    // Alias for clarity
    const escapeHTML = window.escapeHTML;
    const sanitizeUrl = window.sanitizeUrl;
    const markdownToHTML = window.markdownToHTML;

    // == Initialization ==
    /** Initializes the application: caches DOM, sets up listeners, loads data, performs initial check. */
    async function initializeApp() {
        log("--- initializeApp Start ---");
        try {
            initDomElements();
            setupEventListeners();
            await getManifestData(); // Wait for manifest data
            displayStaticInfo();
            await loadCachedData(); // Wait for cache loading
            setupSidebarNavigation();
            updateCurrentYear();
            updateStorageUsageDisplay(); // Initial trigger for storage calculation

            log("Base initialization complete. Performing initial update check.");

            // Perform initial check after setup
            await checkVersionAndUpdateStatus();
            log("Initial update check finished (or used cache).");

        } catch (err) {
             error("CRITICAL error during initialization.", err);
             // Display a critical error message to the user if possible
             if (dom.contentArea) {
                 dom.contentArea.innerHTML = `<div class="api-error-display" style="display: block; margin: 2em;" role="alert">
                     <strong>Critical Error:</strong> Failed to initialize the update page. Please check the console or try reloading.
                     <pre>${escapeHTML(err.message)}\n${escapeHTML(err.stack)}</pre>
                 </div>`;
             } else {
                 alert("Critical Error: Failed to initialize the update page. Check console.");
             }
        } finally {
             log("--- initializeApp End ---");
        }
    }

    /** Caches references to frequently used DOM elements. */
    function initDomElements() {
        log("Initializing DOM Elements Cache");
        const getElem = (id) => document.getElementById(id);
        const getQuery = (selector, parent = document) => parent.querySelector(selector);
        const getQueryAll = (selector, parent = document) => parent.querySelectorAll(selector);

        // Core structure
        dom.body = document.body;
        dom.pageWrapper = getQuery('.page-wrapper');
        dom.sidebar = getQuery('.sidebar');
        dom.contentArea = getQuery('.content-area');
        dom.toastContainer = getElem("toast-container");

        // Sidebar
        dom.sidebarNav = dom.sidebar?.querySelector('.sidebar-nav');
        dom.sidebarButtons = dom.sidebarNav?.querySelectorAll('.sidebar-button');
        dom.extensionTitleHeading = getElem("extension-title");
        dom.changelogNavButton = getElem("nav-changelog");
        dom.currentYearSpan = getElem("current-year");

        // Panels
        dom.contentPanels = dom.contentArea?.querySelectorAll('.content-panel');
        dom.statusPanel = getElem('panel-status');
        dom.advancedPanel = getElem('panel-advanced');
        dom.changelogPanel = getElem('panel-changelog');
        // Removed debug panel reference

        // Status Panel Content
        dom.statusContentWrapper = dom.statusPanel?.querySelector(".status-content-wrapper");
        dom.statusIndicatorWrapper = getElem("status-indicator-wrapper");
        dom.statusIcon = getElem("status-icon");
        dom.statusIconWrapper = getElem("status-icon-wrapper");
        dom.statusMessage = getElem("status-message");
        dom.refreshButton = getElem("refresh-check");
        dom.lastCheckedTimeSpan = getElem("last-checked-time");
        dom.apiErrorMessage = getElem("api-error-message");
        dom.downloadButton = getElem("download-button");
        dom.viewAllReleasesLink = getElem("view-all-releases-link");

        // Advanced Panel Content
        dom.installedVersionSpan = getElem("installed-version");
        dom.latestVersionSpan = getElem("latest-version");
        dom.latestReleaseDateSpan = getElem("latest-release-date-adv"); // New
        dom.copyButtons = getQueryAll(".copy-btn");
        dom.githubRepoPathSpan = getElem("github-repo-path");
        dom.apiRateLimitSpan = getElem("api-rate-limit");
        dom.apiRateLimitResetSpan = getElem("api-rate-limit-reset");
        // Cache Management
        dom.clearCacheButton = getElem("clear-cache-button");
        dom.clearETagButton = getElem("clear-etag-button");
        dom.cacheUsageSpan = getElem("cache-usage"); // New
        dom.cacheUsageErrorSpan = getElem("cache-usage-error"); // New
        // Storage Usage
        dom.chromeStorageUsageSpan = getElem("chrome-storage-usage"); // New
        dom.localStorageUsageSpan = getElem("local-storage-usage");   // New
        dom.sessionStorageUsageSpan = getElem("session-storage-usage"); // New
        dom.chromeStorageErrorSpan = getElem("chrome-storage-error"); // New
        dom.localStorageErrorSpan = getElem("local-storage-error");   // New
        dom.sessionStorageErrorSpan = getElem("session-storage-error"); // New


        // Changelog Panel
        dom.changelogHeading = getElem("changelog-heading-main");
        dom.changelogVersionHeading = getElem("changelog-version-heading"); // New heading for version
        dom.changelogContentWrapper = getElem("changelog-content-wrapper"); // Wrapper needed for loading state
        dom.changelogContent = getElem("changelog-content");
        // Removed version select reference

        // Check essential elements after attempting to cache all
        const essentialElems = {
            statusIcon: dom.statusIcon, statusMessage: dom.statusMessage, statusWrapper: dom.statusContentWrapper,
            sidebarNav: dom.sidebarNav, changelogContent: dom.changelogContent, contentArea: dom.contentArea,
            installedVersionSpan: dom.installedVersionSpan, latestVersionSpan: dom.latestVersionSpan // Add more as needed
        };
        const missing = Object.entries(essentialElems).filter(([, el]) => !el).map(([key]) => key);
        if (missing.length > 0) {
             error(`CRITICAL ERROR: Essential UI elements missing: ${missing.join(', ')}! Check IDs and structure.`);
             // Throwing here might be too aggressive, log and continue cautiously.
             // throw new Error(`Missing essential DOM elements: ${missing.join(', ')}`);
        } else {
            log("Essential DOM elements found.");
        }
    }

    /** Retrieves extension manifest data (version, name) using chrome.runtime API. */
    async function getManifestData() {
        log("Getting manifest data...");
        try {
            if (window.chrome?.runtime?.getManifest) {
                const manifestData = await chrome.runtime.getManifest(); // Use async if needed or just call directly
                installedVersion = manifestData.version || "0.0.0";
                extensionTitle = manifestData.name || "NG Extension Manger";
                log("Manifest data retrieved", { version: installedVersion, name: extensionTitle });
            } else {
                warn("chrome.runtime.getManifest API not available. Using fallback values.");
                installedVersion = "1.0.0-dev"; // Explicit fallback
                extensionTitle = "NG Extension Manager (Dev Mode)";
            }
        } catch (err) {
            error("Error retrieving manifest data", err);
            // Ensure fallback values are used on error
            installedVersion = "0.0.0";
            extensionTitle = "NG Extension Manager";
        }
    }

    /** Displays static information like title, version, links in the UI. */
    function displayStaticInfo() {
        log("Displaying static info");
        try {
            if (dom.extensionTitleHeading) dom.extensionTitleHeading.textContent = extensionTitle;
            if (dom.installedVersionSpan) dom.installedVersionSpan.textContent = installedVersion;
            if (dom.viewAllReleasesLink) dom.viewAllReleasesLink.href = GITHUB_RELEASES_PAGE_URL;
            if (dom.githubRepoPathSpan) dom.githubRepoPathSpan.textContent = repoPath;
            updateLastCheckedDisplay(); // Display initial time ('Never checked' or cached)
            updateRateLimitDisplay(); // Display initial rate limit ('N/A')
        } catch (err) {
             error("Error displaying static info", err);
        }
     }

    /** Loads cached data (releases, ETag, last checked time) from extension storage. */
    async function loadCachedData() {
        log("Loading cached data from storage...");
        try {
            const [cachedTimestamp, cachedETag, cachedReleasesData] = await Promise.all([
                storageGet(CACHE_KEYS.LAST_CHECKED),
                storageGet(CACHE_KEYS.ETAG_RELEASES),
                storageGet(CACHE_KEYS.RELEASES)
            ]);

            lastCheckedTimestamp = cachedTimestamp; // Can be null
            currentETag = cachedETag; // Can be null
            if (currentETag) log("Loaded ETag from cache:", currentETag);

            // Check releases cache validity (exists and not expired)
            const isValidCache = cachedReleasesData && cachedReleasesData.data && (!cachedReleasesData.expiry || Date.now() < cachedReleasesData.expiry);

            if (isValidCache && Array.isArray(cachedReleasesData.data) && cachedReleasesData.data.length > 0) {
                log(`Using ${cachedReleasesData.data.length} cached releases.`);
                allReleases = cachedReleasesData.data; // Store cached releases globally
                processReleaseData(allReleases); // Determine latestVersionInfo from cache
                displayLatestChangelog(); // Show latest changelog from cache
                compareVersionsAndUpdateUI(); // Compare versions and set initial status UI
            } else {
                if (cachedReleasesData && !isValidCache) log("Cached releases found but expired or invalid.");
                else log("No valid cached releases found.");
                // Set UI to loading/default states
                if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A';
                if (dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'N/A';
                updateChangelogUI(null, '<p>Checking for updates...</p>'); // Update changelog panel
            }
            updateLastCheckedDisplay(); // Display cached time or 'Never checked'
        } catch (err) {
             error("Error loading cached data", err);
             // Attempt to clear potentially corrupted cache? Risky. Better to let user manually clear.
             if (dom.apiErrorMessage) showApiError("Error loading cached data. Try clearing cache.");
        }
    }

    /** Updates the copyright year in the footer. */
    function updateCurrentYear() {
         if (dom.currentYearSpan) {
            try {
                 dom.currentYearSpan.textContent = new Date().getFullYear();
            } catch (e) {
                 error("Failed to update current year", e);
                 dom.currentYearSpan.textContent = "20XX"; // Fallback
            }
        }
     }

    // == Event Listeners ==
    /** Sets up all necessary event listeners for UI interactions. */
    function setupEventListeners() {
        log("Setting up event listeners");
        const debouncedRefresh = debounce(handleRefreshClick, DEBOUNCE_DELAY_MS);

        // Helper to safely add listeners
        const addSafeListener = (element, event, handler, options = {}) => {
            if (element) {
                element.addEventListener(event, handler, options);
            } else {
                 warn(`Could not attach listener for ${event} - element not found.`);
            }
        };

        // --- Buttons ---
        addSafeListener(dom.refreshButton, "click", debouncedRefresh);
        addSafeListener(dom.downloadButton, "click", handleDownloadClick);
        addSafeListener(dom.clearCacheButton, "click", handleClearCacheClick);
        addSafeListener(dom.clearETagButton, "click", handleClearETagClick);
        dom.copyButtons?.forEach(button => addSafeListener(button, 'click', handleCopyClick));

        // --- Network Status ---
        window.addEventListener('online', handleOnlineStatus);
        window.addEventListener('offline', handleOfflineStatus);

        log("Event listeners setup complete.");
     }

    // --- Event Handlers ---
    /** Handles the click event for the manual refresh button. */
    async function handleRefreshClick() {
        log("Manual refresh triggered via button click.");
        try {
            await checkVersionAndUpdateStatus(true); // forceRefresh = true
        } catch (err) {
            error("Manual refresh check failed after button click.", err);
            // UI state (error message, status) is handled within checkVersionAndUpdateStatus
        }
     }

    /** Handles the click event for the "Clear All Cache" button. */
    async function handleClearCacheClick() {
        log("Clear ALL cache button clicked");
        confirmAction("This will clear all cached update data (releases, ETag, last checked time) and force a full refresh. Continue?", async () => {
            log("Full cache clearing confirmed by user");
            try {
                await clearCache(); // Clear storage
                resetStateAndUIForRefresh("Clearing cache..."); // Reset state and UI
                updateStorageUsageDisplay(); // Update usage display after clearing

                // Trigger a forced refresh
                await checkVersionAndUpdateStatus(true);
                showToast("All cached data cleared. Refreshing...", 'info');
            } catch(err) {
                 error("Error during full cache clear process", err);
                 showToast("Error clearing cache.", "error");
                 handlePostRefreshError(); // Reset UI from loading state on error
            }
        });
     }

     /** Handles the click event for the "Force Data Refresh" button. */
     async function handleClearETagClick() {
        log("Force Data Refresh button clicked");
         confirmAction("This will clear only the ETag, forcing the app to re-download release data on the next check (if available). Continue?", async () => {
            log("ETag clearing confirmed by user");
            try {
                await storageRemove(CACHE_KEYS.ETAG_RELEASES); // Clear only ETag
                currentETag = null; // Reset state
                resetStateAndUIForRefresh("Forcing data refresh..."); // Reset UI for consistency

                // Trigger a forced refresh
                await checkVersionAndUpdateStatus(true);
                 showToast("ETag cleared. Forcing data refresh...", 'info');
            } catch(err) {
                 error("Error during ETag clear process", err);
                 showToast("Error clearing ETag.", "error");
                 handlePostRefreshError();
            }
        });
     }

     /** Resets application state and UI elements to a loading state before a forced refresh. */
     function resetStateAndUIForRefresh(loadingMessage = "Refreshing data...") {
            log("Resetting state and UI for forced refresh.", {loadingMessage});
            try {
                // Reset state variables
                latestVersionInfo = null;
                allReleases = [];
                currentETag = null; // Keep lastCheckedTimestamp for now, it gets updated on success
                rateLimitInfo = { remaining: 'N/A', reset: null };
                updateRateLimitDisplay();

                // Reset UI elements safely
                if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A';
                if (dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'N/A';

                updateChangelogUI(null, `<p>${loadingMessage}</p>`); // Clear changelog
                setChangelogNavIndicator(false);

                // Trigger loading state UI
                if (dom.statusContentWrapper) {
                    dom.statusContentWrapper.setAttribute('aria-busy', 'true'); // Show skeleton
                }
                updateStatus("loading", loadingMessage, loadingMessage, true); // Clear API error
            } catch (err) {
                 error("Error during resetStateAndUIForRefresh", err);
                 // Attempt to recover or show error
                 showToast("Error resetting UI.", "error");
            }
     }

     /** Resets the UI from a loading state after a failed refresh attempt. */
     function handlePostRefreshError() {
          log("Handling post-refresh error state.");
          try {
              if (dom.statusContentWrapper) {
                  dom.statusContentWrapper.setAttribute('aria-busy', 'false'); // Hide skeleton
              }
              // The error status/message should already be set by checkVersionAndUpdateStatus
          } catch (err) {
               error("Error during handlePostRefreshError", err);
          }
     }

    /** Handles clicks on copy buttons to copy version text. */
    function handleCopyClick(event) {
        const button = event.currentTarget;
        const targetId = button?.getAttribute('data-copy-target');
        const targetElement = targetId ? document.getElementById(targetId) : null;

        if (!targetElement) {
            warn('Copy target element not found.', { targetId });
            showToast('Cannot copy: Target element missing.', 'error');
            return;
        }
        if (!navigator.clipboard?.writeText) {
            warn('Clipboard API (writeText) not available.');
            showToast('Cannot copy: Browser does not support clipboard access.', 'warning');
            return;
        }

        const textToCopy = targetElement.textContent?.trim() || '';
        if (!textToCopy || textToCopy === 'N/A' || textToCopy === 'Error') {
             warn('Nothing valid to copy from target element.', { targetId, text: textToCopy });
             showToast('Nothing to copy.', 'info');
             return;
        }

        log(`Attempting to copy: "${textToCopy}" from #${targetId}`);
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                const type = targetId === 'installed-version' ? 'Installed Version' : 'Latest Version';
                showToast(`${type} copied!`, 'success', 1500);
                log("Text copied successfully.");
            })
            .catch(err => {
                error('Clipboard writeText failed', err);
                showToast('Failed to copy version to clipboard.', 'error');
            });
     }

    /** Handles the browser going online. */
    function handleOnlineStatus() {
        log("Network status changed: Online");
        showToast("Connection restored.", 'success', 2000);
        hideApiError(); // Hide any persistent API errors
        // If we were in an error state due to network, automatically trigger a refresh
        if (currentStatus === 'error' && dom.apiErrorMessage?.textContent?.includes('offline')) {
            log("Network online, re-checking version status automatically.");
            checkVersionAndUpdateStatus().catch(err => {
                error("Online status auto-check failed", err);
            });
        }
     }

    /** Handles the browser going offline. */
    function handleOfflineStatus() {
        warn("Network status changed: Offline");
        if (!isLoading) { // Only update status if not already loading
            updateStatus('error', "You are offline", "Offline");
            showApiError("Cannot check for updates. Please check your internet connection.");
            showToast("Connection lost. Unable to check for updates.", 'warning', 6000);
        } else {
            // If already loading, the fetch operation should fail and handle the error state.
            log("Offline status detected during loading, fetch should handle it.");
        }
    }

    /** Handles the click event for the download button. */
    function handleDownloadClick() {
        if (!latestVersionInfo?.downloadUrl) {
            showToast("Download link not available for the latest version.", 'error');
            error("Download click failed: No download URL in latestVersionInfo.", latestVersionInfo);
            return;
        }
        const url = latestVersionInfo.downloadUrl;
        let filename = `NG-Extension-Manager-${latestVersionInfo.tagName || 'latest'}.zip`;
        try {
            const urlFilename = new URL(url).pathname.split('/').pop();
            if (urlFilename && urlFilename.toLowerCase().endsWith('.zip')) filename = urlFilename;
        } catch (e) { warn("Could not parse URL to extract filename", e); }

        log(`Download initiated: Name='${filename}', URL='${url}'`);

        // Use chrome.downloads API if available
        if (window.chrome?.downloads?.download) {
            try {
                chrome.downloads.download({ url: url, filename: filename }, downloadId => {
                    if (chrome.runtime.lastError) {
                        error("chrome.downloads.download API error", chrome.runtime.lastError);
                        showToast(`Download error: ${chrome.runtime.lastError.message}. Opening link instead.`, 'error', 4000);
                         setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), 500); // Open link as fallback
                    } else if (downloadId !== undefined) {
                        showToast("Download started...", 'success');
                        log(`Download started via API with ID: ${downloadId}`);
                    } else { // Fallback if downloadId is undefined but no error
                        warn("Download did not start via API (no ID returned), opening link as fallback.");
                        showToast("Opening download link.", 'info');
                        window.open(url, '_blank', 'noopener,noreferrer');
                    }
                });
            } catch (e) { // Catch synchronous errors during the API call itself
                error("Exception calling chrome.downloads.download", e);
                showToast("Download failed. Opening link instead.", 'info');
                window.open(url, '_blank', 'noopener,noreferrer');
            }
        } else { // Fallback if the API is not available
            log("chrome.downloads API not available, opening link directly.");
            showToast("Opening download link in new tab.", 'info');
            window.open(url, '_blank', 'noopener,noreferrer'); // Ensure security attributes
        }
     }

    // == Sidebar Navigation ==
    /** Sets up event listeners for the sidebar navigation buttons. */
    function setupSidebarNavigation() {
        log("Setting up sidebar navigation");
        if (!dom.sidebarNav) {
             error("Sidebar navigation container not found.");
             return;
        }
        // Use event delegation on the container
        dom.sidebarNav.addEventListener('click', (event) => {
            const clickedButton = event.target.closest('.sidebar-button');
            // Ignore clicks outside buttons or on the currently active button
            if (!clickedButton || clickedButton.classList.contains('active')) {
                return;
            }
            switchPanel(clickedButton);
        });
    }

    /** Switches the active content panel based on the clicked sidebar button. */
    function switchPanel(newButton) {
        const functionName = "switchPanel";
        if (!newButton) return;
        const targetPanelId = newButton.getAttribute('data-panel-target');
        if (!targetPanelId) {
             warn("Clicked button has no 'data-panel-target' attribute.");
             return;
        }

        log(`Switching panel to '${targetPanelId}'`);

        try {
            // Deactivate all buttons and hide all panels safely
            dom.sidebarButtons?.forEach(button => {
                button.classList.remove('active');
                button.removeAttribute('aria-current');
            });
            dom.contentPanels?.forEach(panel => {
                panel.hidden = true;
            });

            // Activate the new button and show the corresponding panel
            newButton.classList.add('active');
            newButton.setAttribute('aria-current', 'page'); // Use aria-current for active nav item

            const newPanel = document.getElementById(targetPanelId);
            if (newPanel) {
                newPanel.hidden = false;
                // Set focus to the panel for accessibility, prevent scrolling jump
                setTimeout(() => { newPanel.focus({ preventScroll: true }); }, 50);

                 // If switching to Advanced, refresh storage display
                 if (targetPanelId === 'panel-advanced') {
                    updateStorageUsageDisplay();
                 }

            } else {
                error(`Target panel not found for ID: ${targetPanelId}`);
                showToast(`Error: Could not find content panel '${targetPanelId}'.`, "error");
            }

        } catch (err) {
             error("Error switching panel", err);
             showToast("Error switching view.", "error");
        }
    }

    // == Core Logic: Update Check ==
    /**
     * Checks for extension updates via the GitHub API.
     * Uses caching and ETags for efficiency. Updates UI accordingly.
     * @param {boolean} [forceRefresh=false] - If true, bypasses cache and forces a new API request.
     * @returns {Promise<void>} A promise that resolves when the check is complete (or fails).
     */
    async function checkVersionAndUpdateStatus(forceRefresh = false) {
        const functionName = "checkVersionAndUpdateStatus";
        log(`Entering ${functionName}`, { forceRefresh });

        // Prevent concurrent executions
        if (isLoading) {
            warn("Update check skipped: Another check already in progress.");
            return Promise.resolve(); // Indicate immediate completion without action
        }
        // Check configuration
        if (!API_ENDPOINTS.RELEASES) {
            const errorMsg = "API endpoint not configured. Cannot check for updates.";
            error(errorMsg);
            updateStatus('error', 'Configuration Error', 'Error');
            showApiError("Update check endpoint is not configured correctly.");
            return Promise.reject(new Error(errorMsg)); // Reject promise for caller
        }

        // --- Set Loading State ---
        isLoading = true;
        currentStatus = 'loading';
        updateStatus("loading", "Checking for updates...", "Checking for updates", true); // Clear API error display
        if (dom.statusContentWrapper) {
            dom.statusContentWrapper.setAttribute('aria-busy', 'true'); // Show skeleton
        }
        log("Starting update check...");
        enableLoadingState(true); // Disable interactive elements

        try {
            // --- Check Network Status ---
            if (!navigator.onLine) {
                warn("Network offline during check initiation.");
                throw new Error("Offline"); // Throw specific error
            }

            // --- Fetch Releases Data ---
            log(`Workspaceing releases from ${API_ENDPOINTS.RELEASES}`);
            const releasesResponse = await fetchWithCache(
                API_ENDPOINTS.RELEASES,
                CACHE_KEYS.RELEASES,
                CACHE_KEYS.ETAG_RELEASES,
                forceRefresh,
                currentETag // Pass current ETag for conditional request
            );
            log(`Workspace response received: Status=${releasesResponse.status}`);


            // --- Update Rate Limit Info (Best Effort) ---
            updateRateLimitFromHeaders(releasesResponse.headers);

            // --- Process Fetch Response ---
            let usedCache = false;
            if (releasesResponse.status === 304) { // Status: Not Modified
                log("Releases not modified (304). Using cached data.");
                if (!allReleases || allReleases.length === 0) {
                    // If 304 received but no local cache, something is inconsistent. Force a full refresh.
                    warn("Received 304 but local cache is empty. Forcing full refresh.");
                    currentETag = null; // Clear ETag to ensure full fetch next time
                    await storageRemove(CACHE_KEYS.ETAG_RELEASES);
                    // MUST await the recursive call to ensure it completes before this one finishes.
                    await checkVersionAndUpdateStatus(true); // Retry with force=true
                    return; // Exit this attempt as the recursive call handles the rest
                }
                usedCache = true; // Indicate cache was used
                // Use existing 'allReleases' data from state

            } else if (releasesResponse.status === 200 && releasesResponse.data) { // Status: OK (New Data)
                log("Received new release data (200 OK).");
                const fetchedData = releasesResponse.data; // Store globally

                // Validate data format (basic check)
                if (!Array.isArray(fetchedData)) {
                    error("Invalid data format from API - Expected an array.");
                    throw new Error("Invalid data format from API: Expected an array.");
                }
                 allReleases = fetchedData; // Update global state

                const newETag = releasesResponse.etag; // Get new ETag from response header

                // Cache the new data and ETag
                await cacheData(CACHE_KEYS.RELEASES, allReleases);
                if (newETag) {
                    currentETag = newETag; // Update state variable
                    await cacheData(CACHE_KEYS.ETAG_RELEASES, newETag);
                    log(`Cached ${allReleases.length} releases. New ETag: ${newETag}`);
                } else {
                    // If no ETag received (unusual for GitHub API), clear the cached one
                    warn("No ETag received in 200 OK response. Clearing cached ETag.");
                    currentETag = null;
                    await storageRemove(CACHE_KEYS.ETAG_RELEASES);
                }
            } else { // Status: Unexpected (Should be caught by fetchWithCache, but handle defensively)
                error(`Unexpected response status after fetch: ${releasesResponse.status}`);
                throw new Error(`Unexpected response status from fetch: ${releasesResponse.status}`);
            }

            // --- Process Data & Update UI (Common for both 200 and 304 using cache) ---
             if (allReleases.length === 0) {
                 warn("No releases found in the repository (or cache).");
                 if (!usedCache) showToast("No public releases found.", 'warning'); // Only show toast if fresh check
                 updateStatus("up-to-date", `Up to date (v${installedVersion}). No remote releases found.`, "Up to date");
                 if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A';
                 if (dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'N/A';
                 latestVersionInfo = null; // Reset latest info state
                 updateChangelogUI(null, '<p><em>No releases found in the repository.</em></p>'); // Update changelog panel
             } else {
                 processReleaseData(allReleases); // Process data, populates latestVersionInfo
                 displayLatestChangelog(); // Show latest changelog initially
                 compareVersionsAndUpdateUI(); // Compare versions and update status display
             }

             // Update last checked time
             lastCheckedTimestamp = Date.now();
             await cacheData(CACHE_KEYS.LAST_CHECKED, lastCheckedTimestamp);
             updateLastCheckedDisplay();
             hideApiError(); // Ensure any previous API error is hidden

            log("Update check process completed successfully.");
            // Resolve the promise on success
            return Promise.resolve();

        } catch (err) {
            // --- Centralized Error Handling for the Check Process ---
            error("Error during update check:", err); // Log full error to console

            let userMessage = "Error checking for updates."; // Default user message
            let statusType = 'error'; // Default status type
            let apiErrorDetails = `An unexpected error occurred: ${err.message || 'Check console.'}`; // Default detailed message

            // Customize messages based on specific error types/statuses
            if (err.message === "Offline") {
                userMessage = "You are offline"; statusType = 'warning'; apiErrorDetails = "Cannot check for updates. Please check your internet connection.";
            } else if (err.status === 403) { // Rate limit exceeded
                userMessage = "API Rate Limit Exceeded"; statusType = 'warning'; apiErrorDetails = "GitHub API rate limit reached. Please wait or check Advanced info for reset time.";
                updateRateLimitFromHeaders(err.headers); // Attempt to update rate limit info from error headers
            } else if (err.status === 404) { // Repository not found
                userMessage = "Repository Not Found"; apiErrorDetails = `Could not find repository releases (${repoPath}). Check configuration or repository status.`;
            } else if (err.status >= 400 && err.status < 500) { // Other client errors
                userMessage = `API Client Error (${err.status})`; apiErrorDetails = `Error fetching updates: ${err.details?.message || err.message || 'Check console.'}`;
            } else if (err.status >= 500) { // Server errors
                userMessage = `API Server Error (${err.status})`; apiErrorDetails = `Update server (GitHub) returned an error. Please try again later.`;
            } // Add more specific error handling as needed (e.g., JSON parse errors)

            // Update UI to reflect the error state
            updateStatus(statusType, userMessage, `Error: ${userMessage}`);
            showApiError(apiErrorDetails); // Display detailed error in the designated area
            if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = "Error"; // Update Advanced panel
            if (dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = "Error";
            if (dom.downloadButton) { dom.downloadButton.disabled = true; dom.downloadButton.setAttribute("aria-disabled", "true"); }
            setChangelogNavIndicator(false); // Ensure indicator is off on error
            // Keep existing 'allReleases' data if available, so changelog might still work with stale data if already loaded.

            // Reject the promise to indicate failure to the caller
            return Promise.reject(err);

        } finally {
            // --- Cleanup: Always run regardless of success or error ---
            isLoading = false; // Reset loading flag
            enableLoadingState(false); // Re-enable interactive elements
            if (dom.statusContentWrapper) {
                dom.statusContentWrapper.setAttribute('aria-busy', 'false'); // Hide skeleton
            }
            log(`Exiting checkVersionAndUpdateStatus. Final status: ${currentStatus}`);
        }
    }


    // == API Interaction & Data Processing ==
    /**
     * Fetches data from a URL, using caching and ETags.
     * @param {string} url - The URL to fetch.
     * @param {string} dataCacheKey - The storage key for the data object (containing data + expiry).
     * @param {string} etagCacheKey - The storage key for the ETag.
     * @param {boolean} [forceRefresh=false] - If true, bypass ETag check.
     * @param {string|null} [currentETagValue=null] - The current known ETag.
     * @returns {Promise<{status: number, data: any|null, etag: string|null, headers: Headers|null}>} Result object.
     */
    async function fetchWithCache(url, dataCacheKey, etagCacheKey, forceRefresh = false, currentETagValue = null) {
        const functionName = "fetchWithCache";
        log(`Entering ${functionName}`, { url, forceRefresh, hasETag: !!currentETagValue });

        const headers = {
            'Accept': 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28' // Recommended header
        };
        // Add ETag for conditional request if available and not forcing refresh
        if (currentETagValue && !forceRefresh) {
            headers['If-None-Match'] = currentETagValue;
            log(`${functionName}: Using ETag for conditional request: ${currentETagValue}`);
        }

        let response = null; // Declare response outside try block
        try {
            response = await fetch(url, {
                method: 'GET',
                headers: headers,
                cache: 'no-cache' // Let our ETag logic control caching
            });
            log(`${functionName}: Fetch response received`, { url, status: response.status });

            // Handle 304 Not Modified
            if (response.status === 304) {
                log(`${functionName}: 304 Not Modified received.`);
                // We rely on the caller (checkVersionAndUpdateStatus) to have the cached data loaded already.
                // Simply return status 304.
                return { status: 304, data: null, etag: currentETagValue, headers: response.headers };
            }

            // Handle non-OK responses (4xx, 5xx)
            if (!response.ok) {
                let errorText = response.statusText;
                let errorDetails = null;
                try { // Attempt to parse error details from GitHub API response
                    errorDetails = await response.json();
                    errorText = errorDetails.message || errorText;
                } catch (e) { /* Ignore if response body is not JSON */ }

                const httpError = new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
                httpError.status = response.status; // Attach status code
                httpError.details = errorDetails; // Attach parsed details
                httpError.headers = response.headers; // Attach headers (useful for rate limit info on 403)
                error(`${functionName}: Fetch failed with status ${response.status}`, { error: httpError });
                throw httpError; // Throw the custom error object
            }

            // Handle successful 200 OK response
            const data = await response.json(); // Parse JSON body
            const newEtag = response.headers.get('ETag'); // Extract new ETag
            log(`${functionName}: Fetch OK (200). New ETag: ${newEtag || 'None'}`);

            // Optional: Basic validation for specific endpoints
            if (url.includes('/releases') && !Array.isArray(data)) {
                 error(`${functionName}: Invalid data format - Expected array from releases endpoint.`);
                throw new Error("Invalid data format: Expected array from releases endpoint.");
            }

            return { status: 200, data: data, etag: newEtag, headers: response.headers }; // Return success object

        } catch (err) {
            // Catch fetch-related errors (network, CORS) or the HTTP errors thrown above
            if (!(err instanceof Error)) err = new Error(String(err)); // Ensure it's an Error object
            // Add context for generic fetch errors
            if (!err.status && (err.message.includes('fetch') || err.message.includes('NetworkError'))) {
                 err.message = `Network error or CORS issue: ${err.message}`;
                 // If offline, ensure the error reflects that
                  if (!navigator.onLine) err.message = "Offline";
            }
            // Attach headers if available from a failed response (might be undefined for network errors)
            if (response && !err.headers) err.headers = response.headers;
            error(`${functionName}: Fetch failed`, { url, error: err.message, status: err.status, name: err.name });
            throw err; // Re-throw the error to be handled by the caller
        }
    }

    /** Extracts and updates rate limit info from response headers. */
    function updateRateLimitFromHeaders(headers) {
        if (!headers) {
             warn("updateRateLimitFromHeaders: No headers object provided.");
             return;
        }
        try {
            const remaining = headers.get('x-ratelimit-remaining');
            const resetTimestamp = headers.get('x-ratelimit-reset'); // Unix timestamp (seconds)

            let updated = false;
            if (remaining !== null) {
                rateLimitInfo.remaining = parseInt(remaining, 10);
                updated = true;
            }
            if (resetTimestamp !== null) {
                // Ensure timestamp is valid before creating Date
                const resetSeconds = parseInt(resetTimestamp, 10);
                if (!isNaN(resetSeconds)) {
                    rateLimitInfo.reset = new Date(resetSeconds * 1000); // Convert seconds to milliseconds
                    updated = true;
                } else {
                     warn("updateRateLimitFromHeaders: Invalid reset timestamp received", {resetTimestamp});
                }
            }

            if (updated) {
                log("Updated rate limit info from headers", {remaining: rateLimitInfo.remaining, reset: rateLimitInfo.reset?.toISOString()});
                updateRateLimitDisplay(); // Update UI
            }
        } catch (e) {
            error("Failed to parse rate limit headers", e);
        }
    }

    /** Updates the rate limit display in the Advanced panel. */
    function updateRateLimitDisplay() {
        if (!dom.apiRateLimitSpan || !dom.apiRateLimitResetSpan) return;
        try {
            dom.apiRateLimitSpan.textContent = rateLimitInfo.remaining ?? 'N/A';

            if (rateLimitInfo.reset instanceof Date && !isNaN(rateLimitInfo.reset)) {
                const now = new Date();
                const diffMs = rateLimitInfo.reset.getTime() - now.getTime();
                const resetTimeString = rateLimitInfo.reset.toLocaleTimeString();
                let resetText = `(Resets: ${resetTimeString})`;

                // Calculate minutes remaining if reset time is in the future
                if (diffMs > 0) {
                    const diffMins = Math.ceil(diffMs / (1000 * 60));
                    resetText = `(Resets in ~${diffMins} min at ${resetTimeString})`;
                }

                dom.apiRateLimitResetSpan.textContent = resetText;
                dom.apiRateLimitResetSpan.title = `Rate limit window resets at ${rateLimitInfo.reset.toLocaleString()}`;
            } else {
                // Clear reset time display if invalid or null
                dom.apiRateLimitResetSpan.textContent = '';
                dom.apiRateLimitResetSpan.title = '';
            }
        } catch (err) {
             error("Error updating rate limit display", err);
             dom.apiRateLimitSpan.textContent = 'Error';
             dom.apiRateLimitResetSpan.textContent = '';
        }
    }

    /** Processes the raw release data to find the latest version and store its info. */
    function processReleaseData(releases) {
        const functionName = "processReleaseData";
        log(`Entering ${functionName}`, { releaseCount: releases?.length });

        // Reset latest info before processing
        latestVersionInfo = null;

        if (!releases || !Array.isArray(releases) || releases.length === 0) {
            warn(`${functionName}: No valid releases array provided.`);
            if(dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'N/A';
            if(dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'N/A';
            return; // Exit if no data
        }

        try {
            // Sort releases by publication date (most recent first) - Robust sorting
            const sortedReleases = [...releases].sort((a, b) => {
                const dateA = a?.published_at || a?.created_at;
                const dateB = b?.published_at || b?.created_at;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1; // Put items without date last
                if (!dateB) return -1;
                try {
                    return new Date(dateB) - new Date(dateA); // Descending order
                } catch (e) {
                    warn(`${functionName}: Date parsing failed during sort`, { dateA, dateB, error: e });
                    return 0; // Treat as equal on parsing error
                }
            });

            // Find the latest *stable* release (not prerelease, not draft, must have tag)
            const latestStable = sortedReleases.find(r => r?.tag_name && !r.prerelease && !r.draft);

            // Find the absolute latest release (including prereleases, excluding drafts, must have tag)
            const definitiveLatest = latestStable || sortedReleases.find(r => r?.tag_name && !r.draft);

            if (!definitiveLatest) {
                error(`${functionName}: Could not determine a valid latest release (stable or prerelease).`);
                if(dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'Error';
                if(dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'Error';
                return; // Exit if no suitable release found
            }

            log(`${functionName}: Latest release determined: Tag='${definitiveLatest.tag_name}', Pre='${definitiveLatest.prerelease}'`);

            // Extract relevant information
            const tagName = definitiveLatest.tag_name;
            const version = tagName.replace(/^v/i, ''); // Remove leading 'v'
            const downloadUrl = findReleaseDownloadUrl(definitiveLatest);
            const releaseNotes = definitiveLatest.body || "No release notes provided.";
            const isPrerelease = definitiveLatest.prerelease || false;
            const publishedAtStr = definitiveLatest.published_at || definitiveLatest.created_at;
            let publishedAt = null;
            if (publishedAtStr) {
                 try { publishedAt = new Date(publishedAtStr); } catch (e) { warn(`${functionName}: Failed to parse release date`, { dateStr: publishedAtStr, error: e }); }
            }

            // Store the processed info globally
            latestVersionInfo = {
                version, tagName, downloadUrl, releaseNotes, isPrerelease, publishedAt, id: definitiveLatest.id
            };

            log(`${functionName}: Updated latestVersionInfo`, latestVersionInfo);

            // Update the "Latest Version" display in the Advanced panel
            if (dom.latestVersionSpan) {
                dom.latestVersionSpan.textContent = latestVersionInfo.tagName || 'Error';
            }
            // Update Latest Release Date
             updateLatestReleaseDateDisplay();

        } catch (err) {
             error(`${functionName}: Error processing release data`, err);
             if (dom.latestVersionSpan) dom.latestVersionSpan.textContent = 'Error';
             if (dom.latestReleaseDateSpan) dom.latestReleaseDateSpan.textContent = 'Error';
             latestVersionInfo = null; // Ensure state is reset on error
        }
         log(`Exiting ${functionName}`);
    }

    /** Compares installed version with latest found version and updates status UI. */
    function compareVersionsAndUpdateUI() {
        const functionName = "compareVersionsAndUpdateUI";
        log(`Entering ${functionName}`);
        try {
            updateStatusBasedOnComparison(); // This function handles the core logic and UI updates
        } catch (err) {
             error(`${functionName}: Error during version comparison or UI update`, err);
             // Attempt to set a generic error state
             updateStatus("error", "Error comparing versions", "Error");
        }
         log(`Exiting ${functionName}`);
     }

    // == Storage & Caching (Using chrome.storage.local) ==
    /**
     * Gets an item from chrome.storage.local.
     * @param {string|string[]|object|null} key The key(s) to retrieve.
     * @returns {Promise<any>} A promise resolving with the retrieved item(s).
     */
     async function storageGet(key) {
        if (!window.chrome?.storage?.local) {
            warn("chrome.storage.local is not available.");
            return null; // Or throw error?
        }
        try {
            const result = await chrome.storage.local.get(key);
            // If single key requested, return its value directly (or null if not found)
            if (typeof key === 'string') {
                return result[key] ?? null;
            }
            // Otherwise return the whole result object
            return result;
        } catch (err) {
            error("Error getting data from chrome.storage.local", { key, err });
            throw err; // Re-throw to be handled by caller
        }
     }

    /**
     * Sets an item in chrome.storage.local.
     * @param {object} items An object containing key/value pairs to set.
     * @returns {Promise<void>} A promise resolving when the operation is complete.
     */
     async function storageSet(items) {
        if (!window.chrome?.storage?.local) {
            warn("chrome.storage.local is not available.");
            return; // Or throw error?
        }
        try {
            await chrome.storage.local.set(items);
        } catch (err) {
            error("Error setting data in chrome.storage.local", { items, err });
            // Handle potential quota exceeded error
            if (err.message.toLowerCase().includes('quota')) {
                showToast("Extension storage quota exceeded. Cannot save data.", 'error');
            }
            throw err; // Re-throw
        }
     }

     /**
      * Removes an item from chrome.storage.local.
      * @param {string|string[]} key The key(s) to remove.
      * @returns {Promise<void>} A promise resolving when the operation is complete.
      */
      async function storageRemove(key) {
        if (!window.chrome?.storage?.local) {
            warn("chrome.storage.local is not available.");
            return; // Or throw error?
        }
        try {
            await chrome.storage.local.remove(key);
        } catch (err) {
            error("Error removing data from chrome.storage.local", { key, err });
            throw err; // Re-throw
        }
      }

    /**
     * Caches data in chrome.storage.local with an optional expiry.
     * @param {string} key - The storage key.
     * @param {any} data - The data to cache.
     */
    async function cacheData(key, data) {
        const cacheEntry = { data: data };
        // Add expiry timestamp only for the main releases data
        if (key === CACHE_KEYS.RELEASES) {
            cacheEntry.expiry = Date.now() + (CACHE_TTL_SECONDS * 1000);
        }
        try {
            await storageSet({ [key]: cacheEntry });
            log(`Cached data for key: ${key}`, { hasExpiry: !!cacheEntry.expiry });
        } catch (err) {
            error(`Cache store failed for key: ${key}`, err);
            // Error (like quota) already handled/logged in storageSet
        }
     }

    /** Clears all related cache items from chrome.storage.local. */
    async function clearCache() {
        log("Clearing all related cache items from chrome.storage.local...");
        const keysToRemove = Object.values(CACHE_KEYS);
        try {
            await storageRemove(keysToRemove);
            log("All related cache items cleared.");
        } catch (err) {
            error("Failed to clear cache items.", err);
            showToast("Error clearing some cache items.", "error");
        }
     }


    // == UI Updates ==
    /** Updates the main status display based on version comparison. */
    function updateStatusBasedOnComparison() {
        const functionName = "updateStatusBasedOnComparison";
        log(`Entering ${functionName}`);
        let comparisonStatus = 'unknown'; // Default status

        try {
            if (!latestVersionInfo?.version) {
                warn(`${functionName}: Comparison skipped: latestVersionInfo or version is invalid.`);
                // If not already in an error state, set one now.
                if (currentStatus !== 'error') {
                    updateStatus("error", "Could not determine latest version", "Error");
                }
                comparisonStatus = 'error';
                // Ensure download button is disabled
                if (dom.downloadButton) {
                    dom.downloadButton.disabled = true; dom.downloadButton.setAttribute("aria-disabled", "true");
                }
                setChangelogNavIndicator(false); // No update available
            } else {
                const current = installedVersion;
                const latest = latestVersionInfo.version;
                const latestTag = latestVersionInfo.tagName || latest;

                log(`${functionName}: Comparing versions: Installed='${current}', Latest='${latest}' (Tag: '${latestTag}')`);

                if (isNewVersionAvailable(current, latest)) {
                    // --- Outdated ---
                    log(`${functionName}: New version available: ${latestTag}`);
                    updateStatus("outdated", `Update available: ${latestTag}`, `Update available`);
                    comparisonStatus = 'outdated';
                    setChangelogNavIndicator(true); // Show indicator on nav item

                    const canDownload = !!latestVersionInfo.downloadUrl;
                    if (dom.downloadButton) {
                        dom.downloadButton.disabled = !canDownload;
                        dom.downloadButton.setAttribute("aria-disabled", String(!canDownload));
                        dom.downloadButton.title = canDownload ? `Download version ${latestTag}` : `Download unavailable for ${latestTag}`;
                        dom.downloadButton.setAttribute("aria-label", canDownload ? `Download version ${latestTag}` : `Download not available`);
                    }
                } else {
                    // --- Up to Date ---
                    log(`${functionName}: Extension is up to date.`);
                    updateStatus("up-to-date", `Up to date (v${installedVersion})`, `Up to date`);
                    comparisonStatus = 'up-to-date';
                    setChangelogNavIndicator(false); // Hide indicator

                    if (dom.downloadButton) {
                        dom.downloadButton.disabled = true;
                        dom.downloadButton.setAttribute("aria-disabled", "true");
                        dom.downloadButton.title = `Version ${installedVersion} is the latest`;
                        dom.downloadButton.setAttribute("aria-label", `Latest version installed`);
                    }
                }
            }

            // Update the logical status only if we didn't encounter an error during the check itself
            if (currentStatus !== 'error') {
                currentStatus = comparisonStatus;
            }
        } catch (err) {
             error(`${functionName}: Error during comparison`, err);
             updateStatus("error", "Error comparing versions", "Error");
             currentStatus = 'error'; // Set logical status to error
        }
         log(`Exiting ${functionName}, status set to: ${currentStatus}`);
    }

    /**
     * Updates the main status message, icon, and ARIA attributes in the Status Panel.
     * @param {string} statusKey - The status key ('initializing', 'loading', 'up-to-date', 'outdated', 'error', 'unknown').
     * @param {string} message - The user-facing status message.
     * @param {string|null} [ariaLabel=null] - Optional ARIA label override.
     * @param {boolean} [clearApiError=false] - If true, hides the API error display area.
     */
    function updateStatus(statusKey, message, ariaLabel = null, clearApiError = false) {
        const validStatuses = ['initializing', 'loading', 'up-to-date', 'outdated', 'error', 'unknown'];
        statusKey = validStatuses.includes(statusKey) ? statusKey : 'unknown';
        log(`Updating status UI: Key='${statusKey}', Message='${message}'`);

        // Check essential elements exist
        if (!dom.statusMessage || !dom.statusIcon || !dom.statusIndicatorWrapper || !dom.statusIconWrapper) {
            error("Cannot update status UI - essential elements missing.");
            return;
        }

        try {
            // Update text message
            dom.statusMessage.textContent = message;
            // Update ARIA label
            dom.statusIndicatorWrapper.setAttribute("aria-label", `Current status: ${ariaLabel || message}`);
            // Update data attribute for CSS styling (text color, etc.)
            dom.statusIndicatorWrapper.setAttribute("data-status", statusKey);

            // Update icon class for CSS mask styling
            const icon = dom.statusIcon;
            icon.className = 'icon'; // Reset classes first
            icon.classList.remove('loading'); // Ensure loading animation is removed

            switch (statusKey) {
                case 'loading': icon.classList.add('icon-loading', 'loading'); break;
                case 'initializing': icon.classList.add('icon-info'); break;
                case 'up-to-date': icon.classList.add('icon-check'); break;
                case 'outdated': icon.classList.add('icon-warning'); break;
                case 'error': icon.classList.add('icon-error'); break;
                default: icon.classList.add('icon-help'); break; // 'unknown'
            }

            // Optionally clear the API error display
            if (clearApiError) {
                hideApiError();
            }
        } catch (err) {
             error("Error updating status UI elements", err);
        }
    }

    /**
     * Renders the changelog content using the markdown parser.
     * @param {object|null} releaseData - The release object containing notes and tag.
     * @param {string|null} fallbackHtml - HTML to display if no valid release data.
     */
    function updateChangelogUI(releaseData, fallbackHtml = '<p><em>No release notes available.</em></p>') {
        const functionName = "updateChangelogUI";
        const tagName = releaseData?.tag_name || null;
        const markdownNotes = releaseData?.body || null;
        log(`Entering ${functionName}`, { tagName });

        if (typeof markdownToHTML !== 'function') {
            error(`${functionName}: markdownToHTML function not found!`);
             if (dom.changelogContent) dom.changelogContent.innerHTML = `<p><strong>Error:</strong> Cannot display changelog content. Markdown parser missing.</p>`;
            return;
        }
        if (!dom.changelogContent || !dom.changelogVersionHeading || !dom.changelogContentWrapper) {
             error(`${functionName}: Changelog DOM elements missing.`);
             return;
        }

        // Set loading state for content area
        dom.changelogContentWrapper.setAttribute('aria-busy', 'true');

        // Update version heading
        dom.changelogVersionHeading.textContent = tagName ? `Version ${tagName}` : 'Latest Release';

        // Handle empty or missing notes or data
        if (!releaseData || !markdownNotes || typeof markdownNotes !== 'string' || markdownNotes.trim() === '') {
            dom.changelogContent.innerHTML = fallbackHtml;
            log(`${functionName}: Rendered fallback message.`);
        } else {
            try {
                // Convert markdown to HTML using the custom parser
                log(`${functionName}: Parsing markdown for tag: ${tagName}`);
                const htmlContent = markdownToHTML(markdownNotes);
                dom.changelogContent.innerHTML = htmlContent;
                log(`${functionName}: Changelog HTML successfully updated.`);

                // Enhance external links
                dom.changelogContent.querySelectorAll('a[href^="http"]').forEach(link => {
                    link.setAttribute('target', '_blank');
                    link.setAttribute('rel', 'noopener noreferrer'); // Security best practice
                    link.setAttribute('title', `Opens in new tab: ${link.href}`); // Accessibility
                });
            } catch (err) {
                error(`${functionName}: Markdown parsing or rendering failed`, err);
                // Display error and the raw markdown as fallback
                dom.changelogContent.innerHTML = `<p><strong>Error displaying release notes.</strong></p><pre>${escapeHTML(markdownNotes)}</pre>`;
            }
        }
         // Remove loading state
         dom.changelogContentWrapper.setAttribute('aria-busy', 'false');
         log(`Exiting ${functionName}`);
    }

    /** Displays the changelog notes for the latest available version. */
    function displayLatestChangelog() {
        const functionName = "displayLatestChangelog";
        log(`Entering ${functionName}`);

        if (!allReleases || allReleases.length === 0) {
             warn(`${functionName}: No releases available to display.`);
             updateChangelogUI(null, '<p><em>No releases available to display. Check for updates first.</em></p>');
             return;
        }

        // Find the latest release data (already processed into latestVersionInfo)
        if (latestVersionInfo) {
             log(`${functionName}: Displaying changelog for latest release: ${latestVersionInfo.tagName}`);
             // Pass the relevant info from latestVersionInfo
             updateChangelogUI(
                { tag_name: latestVersionInfo.tagName, body: latestVersionInfo.releaseNotes },
                '<p><em>No release notes found for the latest version.</em></p>'
             );
        } else {
             // This might happen if processing failed after fetch
             error(`${functionName}: Could not find latest release data state.`);
             updateChangelogUI(null, `<p><em>Error: Could not load release notes for the latest version.</em></p>`);
        }
         log(`Exiting ${functionName}`);
    }

    /** Sets the visibility of the update indicator on the Changelog navigation button. */
    function setChangelogNavIndicator(show) {
         if (dom.changelogNavButton) {
             try {
                 dom.changelogNavButton.classList.toggle('has-update', !!show);
                 log(`Changelog sidebar button update indicator ${show ? 'shown' : 'hidden'}.`);
             } catch (err) {
                  error("Error toggling changelog indicator class", err);
             }
         }
     }

    /** Updates the display of the "Last Checked" timestamp. */
    function updateLastCheckedDisplay() {
        if (!dom.lastCheckedTimeSpan) return;
        try {
            if (lastCheckedTimestamp && typeof lastCheckedTimestamp === 'number') {
                const date = new Date(lastCheckedTimestamp);
                // Use Intl for locale-aware formatting, check if date is valid
                if (!isNaN(date)) {
                    const formattedDate = new Intl.DateTimeFormat(undefined, {
                        dateStyle: 'medium', timeStyle: 'short'
                    }).format(date);
                    dom.lastCheckedTimeSpan.textContent = `Checked: ${formattedDate}`;
                    dom.lastCheckedTimeSpan.setAttribute('datetime', date.toISOString());
                    dom.lastCheckedTimeSpan.title = `Last check performed: ${date.toLocaleString()}`;
                } else {
                     throw new Error("Invalid Date object from timestamp.");
                }
            } else {
                dom.lastCheckedTimeSpan.textContent = 'Never checked';
                dom.lastCheckedTimeSpan.removeAttribute('datetime');
                dom.lastCheckedTimeSpan.title = 'Update status has not been checked yet';
            }
        } catch (e) {
            error("Failed to format or display lastCheckedTimestamp", { timestamp: lastCheckedTimestamp, error: e });
            dom.lastCheckedTimeSpan.textContent = 'Checked: Error';
            dom.lastCheckedTimeSpan.removeAttribute('datetime');
            dom.lastCheckedTimeSpan.title = 'Error displaying last check time';
        }
     }

     /** Updates the display for the latest release date in the Advanced panel. */
     function updateLatestReleaseDateDisplay() {
         if (!dom.latestReleaseDateSpan) return;
         try {
            if (latestVersionInfo?.publishedAt instanceof Date && !isNaN(latestVersionInfo.publishedAt)) {
                 const date = latestVersionInfo.publishedAt;
                 const formattedDate = new Intl.DateTimeFormat(undefined, {
                     dateStyle: 'long' // e.g., "April 27, 2025"
                 }).format(date);
                 dom.latestReleaseDateSpan.textContent = formattedDate;
                 dom.latestReleaseDateSpan.setAttribute('datetime', date.toISOString());
                 dom.latestReleaseDateSpan.title = `Published on ${date.toLocaleString()}`;
            } else {
                 dom.latestReleaseDateSpan.textContent = 'N/A';
                 dom.latestReleaseDateSpan.removeAttribute('datetime');
                 dom.latestReleaseDateSpan.title = 'Release date not available';
            }
         } catch (e) {
             error("Failed to format or display latest release date", { date: latestVersionInfo?.publishedAt, error: e });
             dom.latestReleaseDateSpan.textContent = 'Error';
             dom.latestReleaseDateSpan.removeAttribute('datetime');
             dom.latestReleaseDateSpan.title = 'Error displaying release date';
         }
      }

     /** Updates the display for cache and storage usage in the Advanced panel. */
     async function updateStorageUsageDisplay() {
        log("Updating storage usage display...");

        // Helper to update a single storage display element
        const updateDisplay = (valueElem, errorElem, valuePromise) => {
            if (!valueElem || !errorElem) return;
            valueElem.textContent = 'Calculating...';
            errorElem.style.display = 'none';

            valuePromise.then(bytes => {
                valueElem.textContent = formatBytes(bytes);
            }).catch(err => {
                error(`Failed to calculate size for ${valueElem.id}`, err);
                valueElem.textContent = 'Error';
                errorElem.textContent = err.message || 'Could not calculate size';
                errorElem.style.display = 'inline';
            });
        };

        // 1. Chrome Storage (Local) - Cache Usage and General Usage
        if (window.chrome?.storage?.local?.getBytesInUse) {
            const cacheKeys = Object.values(CACHE_KEYS);
            updateDisplay(dom.cacheUsageSpan, dom.cacheUsageErrorSpan, chrome.storage.local.getBytesInUse(cacheKeys));
            updateDisplay(dom.chromeStorageUsageSpan, dom.chromeStorageErrorSpan, chrome.storage.local.getBytesInUse(null)); // Get total usage
        } else {
            warn("chrome.storage.local.getBytesInUse API not available.");
            if (dom.cacheUsageSpan) dom.cacheUsageSpan.textContent = 'N/A';
            if (dom.chromeStorageUsageSpan) dom.chromeStorageUsageSpan.textContent = 'N/A';
            if (dom.cacheUsageErrorSpan) { dom.cacheUsageErrorSpan.textContent = 'API unavailable'; dom.cacheUsageErrorSpan.style.display = 'inline'; }
            if (dom.chromeStorageErrorSpan) { dom.chromeStorageErrorSpan.textContent = 'API unavailable'; dom.chromeStorageErrorSpan.style.display = 'inline'; }
        }

        // 2. Web localStorage
        const getLocalStorageSize = () => new Promise((resolve, reject) => {
            try {
                let total = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        const value = localStorage.getItem(key);
                        total += (key.length + (value?.length || 0)) * 2; // Rough estimate (UTF-16)
                    }
                }
                resolve(total);
            } catch (err) { reject(err); }
        });
        updateDisplay(dom.localStorageUsageSpan, dom.localStorageErrorSpan, getLocalStorageSize());

        // 3. Web sessionStorage
        const getSessionStorageSize = () => new Promise((resolve, reject) => {
             try {
                 let total = 0;
                 for (let i = 0; i < sessionStorage.length; i++) {
                     const key = sessionStorage.key(i);
                     if (key) {
                         const value = sessionStorage.getItem(key);
                         total += (key.length + (value?.length || 0)) * 2; // Rough estimate (UTF-16)
                     }
                 }
                 resolve(total);
             } catch (err) { reject(err); }
         });
        updateDisplay(dom.sessionStorageUsageSpan, dom.sessionStorageErrorSpan, getSessionStorageSize());
     }


    /** Shows the API error message display area with the provided message. */
    function showApiError(message) {
        if (dom.apiErrorMessage) {
            try {
                // Ensure message is escaped before inserting as HTML
                dom.apiErrorMessage.innerHTML = `<strong>Error:</strong> ${escapeHTML(message)}`;
                dom.apiErrorMessage.style.display = 'block'; // Make visible
                dom.apiErrorMessage.setAttribute('aria-hidden', 'false');
                error(`API Error Displayed: ${message}`);
            } catch (err) {
                 error("Error showing API error message", err);
            }
        } else {
             error("Cannot show API error: apiErrorMessage element not found.");
        }
     }

    /** Hides the API error message display area. */
    function hideApiError() {
        if (dom.apiErrorMessage) {
            try {
                dom.apiErrorMessage.style.display = 'none'; // Hide
                dom.apiErrorMessage.setAttribute('aria-hidden', 'true');
                dom.apiErrorMessage.innerHTML = ''; // Clear content
                log("API Error Hidden");
            } catch (err) {
                 error("Error hiding API error message", err);
            }
        }
     }

    /** Enables or disables interactive elements during loading states. */
    function enableLoadingState(enable) {
        log(`Setting loading state: ${enable}`);
        const buttonsToDisable = [
            dom.refreshButton, dom.downloadButton, dom.clearCacheButton,
            dom.clearETagButton, ...(dom.copyButtons || [])
        ];

        // Disable/enable buttons
        buttonsToDisable.forEach(btn => {
            if (btn) {
                try {
                    btn.disabled = enable;
                    // Set aria-disabled for buttons performing actions
                     if (btn.classList.contains('btn') && !btn.classList.contains('copy-btn') && !btn.classList.contains('icon-btn')) {
                        btn.setAttribute("aria-disabled", enable.toString());
                    }
                } catch (err) {
                     error("Error setting disabled state on a button", {button: btn, error: err});
                }
            }
        });

        // Handle refresh button loading class and label
        if (dom.refreshButton) {
             try {
                dom.refreshButton.classList.toggle('loading', enable);
                dom.refreshButton.setAttribute('aria-label', enable ? 'Refreshing update status, please wait' : 'Refresh update status');
             } catch (err) {
                  error("Error toggling refresh button loading state", err);
             }
        }
     }

    /** Displays a short-lived toast notification. */
    function showToast(message, type = 'info', duration = 3500) {
        log(`Toast: [${type}] "${message}" (Duration: ${duration}ms)`);
        if (!dom.toastContainer) { error("Toast container element (#toast-container) missing!"); return; }

        try {
            const toastElement = document.createElement("div");
            toastElement.className = `toast ${type}`; // Add base and type classes
            toastElement.textContent = message;
            toastElement.setAttribute('role', 'status'); // Announce to screen readers
            toastElement.setAttribute('aria-live', 'assertive');
            dom.toastContainer.appendChild(toastElement);

            // Trigger animation/transition after appending
            requestAnimationFrame(() => { toastElement.classList.add("show"); });

            // Remove toast after duration
            setTimeout(() => {
                toastElement.classList.remove("show");
                toastElement.addEventListener('transitionend', () => {
                     // Check if the element still has a parent before removing
                     if (toastElement.parentElement) toastElement.remove();
                }, { once: true }); // Use {once: true} for cleanup
            }, duration);
        } catch (err) {
             error("Error displaying toast message", err);
        }
     }

    // == Helper Functions ==
    /** Finds the best download URL (.zip) from a GitHub release object. */
    function findReleaseDownloadUrl(release) {
        if (!release) return null;
        log(`Finding download URL for release: ${release.tag_name || release.id}`);
        // 1. Prioritize .zip asset
        if (release.assets?.length > 0) {
            const zipAsset = release.assets.find(asset => asset?.browser_download_url && (asset.content_type === 'application/zip' || asset.name?.toLowerCase().endsWith('.zip')));
            if (zipAsset) { log(`Found asset ZIP: ${zipAsset.browser_download_url}`); return zipAsset.browser_download_url; }
            warn("No suitable .zip asset found in release assets.", { assets: release.assets });
        }
        // 2. Fallback to source code zip URL from tag
        if (release.tag_name) { const sourceCodeUrl = `${GITHUB_REPO_URL}/archive/refs/tags/${encodeURIComponent(release.tag_name)}.zip`; log(`Falling back to source code ZIP URL: ${sourceCodeUrl}`); return sourceCodeUrl; }
        // 3. No URL found
        error(`No download URL found for release: ${release.id}`); return null;
    }

    /**
     * Compares two version strings (e.g., "1.0.0", "1.2.3-beta").
     * Handles basic semantic versioning comparison (Major.Minor.Patch).
     * @param {string} currentVersion - The current installed version.
     * @param {string} latestVersion - The latest available version.
     * @returns {boolean} True if latestVersion is newer than currentVersion.
     */
    function isNewVersionAvailable(currentVersion, latestVersion) {
        if (typeof currentVersion !== 'string' || typeof latestVersion !== 'string') { error("Invalid version format for comparison (must be strings)", { currentVersion, latestVersion }); return false; }
        // Normalize: remove 'v', trim, take only numeric parts before any hyphen (pre-release tag)
        const normalize = (v) => (v || '').trim().replace(/^v/i, '').split('-')[0];
        const currentNorm = normalize(currentVersion);
        const latestNorm = normalize(latestVersion);

        if (currentNorm === latestNorm) return false; // Versions are identical

        const currentParts = currentNorm.split('.').map(Number);
        const latestParts = latestNorm.split('.').map(Number);

        // Check for invalid parts (NaN)
        if (currentParts.some(isNaN) || latestParts.some(isNaN)) { error("Invalid version number part found (NaN) after normalization.", { current: currentVersion, latest: latestVersion, currentParts, latestParts }); return false; }

        const len = Math.max(currentParts.length, latestParts.length);
        for (let i = 0; i < len; i++) {
            const cPart = currentParts[i] || 0; // Default to 0 if part missing
            const lPart = latestParts[i] || 0;
            if (lPart > cPart) return true; // Latest is newer
            if (lPart < cPart) return false; // Current is newer
        }
        return false; // All parts equal
     }

    /** Shows a confirmation dialog before executing a callback. */
    function confirmAction(message, callback) {
        log("Requesting user confirmation", { message });
        if (window.confirm(message)) {
            log("User confirmed action.");
            if (typeof callback === 'function') {
                try {
                    // If callback is async, handle its promise
                    const result = callback();
                    if (result instanceof Promise) {
                        result.catch(err => {
                             error("Error executing confirmed async action callback", err);
                             showToast("An error occurred while performing the action.", "error");
                        });
                    }
                } catch (err) {
                     error("Error executing confirmed sync action callback", err);
                     showToast("An error occurred while performing the action.", "error");
                }
            }
        } else {
            log("User cancelled action.");
        }
     }

    // == Polyfills == (requestAnimationFrame unchanged)
    (function() { let lastTime = 0; const vendors = ['ms', 'moz', 'webkit', 'o']; for (let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) { window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame']; window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || window[vendors[x] + 'CancelRequestAnimationFrame']; } if (!window.requestAnimationFrame) window.requestAnimationFrame = function(callback) { const currTime = new Date().getTime(); const timeToCall = Math.max(0, 16 - (currTime - lastTime)); const id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall); lastTime = currTime + timeToCall; return id; }; if (!window.cancelAnimationFrame) window.cancelAnimationFrame = function(id) { clearTimeout(id); }; }());

    // == Start the application ==
    // Use DOMContentLoaded to ensure HTML is parsed
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // DOM is already ready, run immediately
        initializeApp();
    }

})(); // End IIFE
