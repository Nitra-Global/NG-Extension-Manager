/**
 * NG Extension Manager - Details Page Script v1.8 (Reconfirmed Implementation)
 *
 * Handles displaying extension details, permissions, status, and troubleshooting options.
 * Fetches data using chrome.management API.
 * Defines permission details (description, risk) directly within this script.
 * Implements panel navigation, loading states, toast notifications.
 * Adds debounced permission searching and list/grid layout toggle.
 * Improves troubleshooting checks and help text.
 * Includes accessibility and performance enhancements.
 *
 * v1.8 Changes:
 * - Reconfirmed that all core logic (fetching details, handling actions, diagnostics)
 * using the chrome.management API is implemented correctly.
 * - Emphasized dependency on correct execution context (extension page) and URL parameter.
 */

(() => { // IIFE to encapsulate scope
    'use strict';

    // == Configuration ==
    const ENABLE_DEV_LOGGING = true; // Set to false for production
    const SEARCH_DEBOUNCE_MS = 250; // Delay for permission search debounce (in milliseconds)
    const TOAST_DEFAULT_DURATION = 3500; // Default duration for toast notifications

    // ** Inline Permissions Data (Risk levels: Low, Medium, High, Varies) **
    // Comprehensive list of known Chrome extension permissions and their general risk assessment.
    const ALL_PERMISSIONS_DATA = [
        // Core API Permissions
        { name: "alarms", description: "Schedule code to run periodically or at a specific time, even when the extension isn't actively running.", risk: "Low" },
        { name: "bookmarks", description: "Allows the extension to read and modify your bookmarks (create, query, update, remove).", risk: "Medium" },
        { name: "browsingData", description: "Allows the extension to clear browsing data like history, cache, cookies, downloads, etc.", risk: "High" }, // Corrected capitalization
        { name: "contentSettings", description: "Control website features like cookies, JavaScript, plugins, pop-ups etc., on a per-site basis.", risk: "Medium" },
        { name: "contextMenus", description: "Add items to the browser's context menu (right-click menu).", risk: "Low" },
        { name: "cookies", description: "Access and modify browser cookies for websites it has host permissions for.", risk: "Medium" },
        { name: "declarativeContent", description: "Take actions depending on the content of a page, without reading the page's content (e.g., show page action).", risk: "Low" },
        { name: "declarativeNetRequest", description: "Block or modify network requests based on declarative rules without intercepting content. Primarily used by content blockers.", risk: "Medium" },
        { name: "declarativeNetRequestWithHostAccess", description: "Extends declarativeNetRequest to allow redirects and header modifications which require host permissions.", risk: "High" },
        { name: "declarativeNetRequestFeedback", description: "Allows observing actions taken by the declarativeNetRequest API (e.g., for debugging).", risk: "Low" },
        { name: "dns", description: "Resolve domain names using the browser's DNS resolver.", risk: "Low" },
        { name: "downloads", description: "Manage downloads (start, monitor, pause, resume, cancel, search).", risk: "Medium" },
        { name: "downloads.shelf", description: "Control the browser's download shelf.", risk: "Low" },
        { name: "downloads.ui", description: "Opens the download manager UI.", risk: "Low" },
        { name: "fontSettings", description: "Manage the browser's font settings.", risk: "Low" },
        { name: "gcm", description: "Receive messages from Google Cloud Messaging.", risk: "Medium" },
        { name: "geolocation", description: "Allows the extension to get the user's current geographical location.", risk: "Medium" },
        { name: "history", description: "Allows the extension to read and modify your browser history.", risk: "High" },
        { name: "identity", description: "Access user identity information (e.g., Google Account sign-in, OAuth2 tokens).", risk: "High" },
        { name: "idle", description: "Detect when the machine's idle state changes.", risk: "Low" },
        { name: "loginState", description: "Read the user's login state (signed-in or signed-out) in the browser profile.", risk: "Low" },
        { name: "management", description: "Manage other installed extensions and apps (query, enable, disable, uninstall). Requires significant trust.", risk: "High" },
        { name: "nativeMessaging", description: "Exchange messages with native applications installed on the user's computer.", risk: "High" },
        { name: "notifications", description: "Create and display rich notifications to the user.", risk: "Low" },
        { name: "offscreen", description: "Create and manage offscreen documents to use DOM APIs not available in service workers.", risk: "Low" },
        { name: "pageCapture", description: "Save a web page as MHTML.", risk: "Medium" },
        { name: "platformKeys", description: "Access hardware-backed certificates managed by the OS.", risk: "High" },
        { name: "power", description: "Override the system's power management features.", risk: "Low" },
        { name: "printerProvider", description: "Implement print management capabilities.", risk: "Medium" },
        { name: "printing", description: "Send print jobs to printers.", risk: "Medium" },
        { name: "printingMetrics", description: "Query usage statistics for printers.", risk: "Low" },
        { name: "privacy", description: "Control usage of browser features that can affect user privacy (e.g., network prediction, reporting).", risk: "Medium" },
        { name: "processes", description: "Access information about the browser's processes.", risk: "Medium" },
        { name: "proxy", description: "Manage the browser's proxy settings, potentially routing all traffic.", risk: "High" },
        { name: "readingList", description: "Read and modify items in the browser's Reading List.", risk: "Medium" },
        { name: "runtime", description: "Access basic runtime information (extension ID, manifest), manage message passing, reload extension.", risk: "Low" },
        { name: "scripting", description: "Inject scripts and CSS into web pages to modify their behavior or content.", risk: "High" },
        { name: "search", description: "Allows the extension to invoke search via the default search provider.", risk: "Low" },
        { name: "sessions", description: "Query and restore recently closed tabs and windows.", risk: "Medium" },
        { name: "sidePanel", description: "Allows extensions to display their own UI in the browser's side panel.", risk: "Low" },
        { name: "storage", description: "Store and retrieve extension data locally using key-value storage.", risk: "Low" },
        { name: "system.cpu", description: "Provides access to CPU metadata.", risk: "Low" },
        { name: "system.display", description: "Query metadata about attached displays.", risk: "Low" },
        { name: "system.memory", description: "Provides access to physical memory metadata.", risk: "Low" },
        { name: "system.storage", description: "Provides access to storage device metadata and notifications.", risk: "Low" },
        { name: "tabCapture", description: "Capture the visible content of a tab.", risk: "Medium" },
        { name: "tabGroups", description: "Organize tabs into groups (create, query, update, move tabs).", risk: "Medium" },
        { name: "tabs", description: "Access and manipulate browser tabs (create, query, modify, rearrange, reload, etc.).", risk: "Medium" },
        { name: "topSites", description: "Access the list of most visited sites displayed on the new tab page.", risk: "Medium" },
        { name: "tts", description: "Use the browser's text-to-speech engine.", risk: "Low" },
        { name: "ttsEngine", description: "Implement a text-to-speech engine.", risk: "Low" },
        { name: "unlimitedStorage", description: "Removes the default 5MB limit for `chrome.storage.local`, allowing much larger data storage.", risk: "Low" },
        { name: "vpnProvider", description: "Implement a VPN client.", risk: "High" },
        { name: "wallpaper", description: "Change the ChromeOS wallpaper.", risk: "Low" }, // ChromeOS specific
        { name: "webAuthenticationProxy", description: "Act as a proxy for Web Authentication requests, often used for security keys.", risk: "High" },
        { name: "webNavigation", description: "Receive notifications about the status of navigation requests (e.g., before navigate, DOM loaded).", risk: "Medium" },
        { name: "webRequest", description: "Observe, analyze, block, or modify network requests in flight. Powerful but carries performance and privacy implications.", risk: "High" },
        { name: "webRequestBlocking", description: "Required in addition to 'webRequest' to synchronously block or modify network requests.", risk: "High" }, // Often used with webRequest
        { name: "windows", description: "Interact with browser windows (create, query, update).", risk: "Medium" },

        // Common permissions that don't map 1:1 to an API namespace
        { name: "activeTab", description: "Grants temporary access to the currently active tab only when the user explicitly invokes the extension (e.g., clicks its icon). No warning shown on install.", risk: "Low" },
        { name: "background", description: "Allows the extension to run a script constantly in the background (via background page/service worker).", risk: "Low" }, // Manifest key, but acts like a permission
        { name: "clipboardRead", description: "Allows the extension to read data from the system clipboard. Requires user interaction.", risk: "Medium" },
        { name: "clipboardWrite", description: "Allows the extension to write data to the system clipboard.", risk: "Low" },
        { name: "debugger", description: "Allows the extension to interact with the browser's debugger protocol, enabling introspection and control over pages.", risk: "High" },
        { name: "desktopCapture", description: "Capture content of the screen, individual windows, or tabs.", risk: "Medium" },
        { name: "documentScan", description: "Access attached document scanning devices.", risk: "Medium" }, // ChromeOS specific?
        { name: "fileBrowserHandler", description: "Allows the extension to extend the ChromeOS file browser.", risk: "Medium" }, // ChromeOS specific
        { name: "fileSystemProvider", description: "Allows the extension to create virtual file systems accessible from ChromeOS.", risk: "High" }, // ChromeOS specific
        { name: "hid", description: "Connect to HID (Human Interface Devices).", risk: "High" },
        { name: "mdns", description: "Allows the extension to discover services over mDNS.", risk: "Low" },
        // { name: "nativeMessaging", description: "Communicate with a cooperating native application installed on the user's computer.", risk: "High" }, // Duplicate, already listed above
        { name: "serial", description: "Read from and write to serial devices.", risk: "High" },
        { name: "socket", description: "Send and receive data over the network using TCP and UDP sockets.", risk: "High" }, // Requires manifest permission
        { name: "enterprise.deviceAttributes", description: "Read device attributes on managed ChromeOS devices.", risk: "Medium" }, // Enterprise specific
        { name: "enterprise.hardwarePlatform", description: "Read hardware platform info on managed devices.", risk: "Low" }, // Enterprise specific
        { name: "enterprise.networkingAttributes", description: "Read network details on managed devices.", risk: "Medium" }, // Enterprise specific
        { name: "enterprise.platformKeys", description: "Access client certificates managed by the enterprise policy.", risk: "High" }, // Enterprise specific

        // Special placeholder for host permissions
        { name: "host", description: "Base description for host permissions. Specific details depend on the pattern.", risk: "Varies" }
    ];

    // == State Variables ==
    let extensionId = null;
    let extensionInfo = null;
    let isLoading = true;
    let currentPanel = 'panel-details'; // Default active panel ID
    let currentPermissionsLayout = 'list'; // Default permissions view layout ('list' or 'grid')
    let searchDebounceTimeout = null; // Stores the timeout ID for debouncing

    // == DOM Elements Cache ==
    // Populated by initDomElements()
    const dom = {};

    // == Utility Functions ==

    /** Basic logging wrapper, controlled by ENABLE_DEV_LOGGING */
    const log = (...args) => { if (ENABLE_DEV_LOGGING) console.log('[NG Details]', ...args); };
    /** Basic warning wrapper, controlled by ENABLE_DEV_LOGGING */
    const warn = (...args) => { if (ENABLE_DEV_LOGGING) console.warn('[NG Details]', ...args); };
    /** Basic error wrapper */
    const error = (...args) => { console.error('[NG Details]', ...args); };

    /**
     * Escapes HTML special characters to prevent XSS.
     * @param {string} str The string to escape.
     * @returns {string} The escaped string.
     */
    const escapeHTML = (str) => {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => {
            switch (match) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case "'": return '&#39;'; // Use HTML entity for single quote
                default: return match;
            }
        });
    };

    /** Simple querySelector alias */
    const getElem = (id) => document.getElementById(id);
    /** Simple querySelector alias */
    const getQuery = (selector, parent = document) => parent.querySelector(selector);
    /** Simple querySelectorAll alias */
    const getAllQuery = (selector, parent = document) => parent.querySelectorAll(selector);

    /**
     * Debounce function: Executes the provided function only after a certain delay
     * since the last time it was invoked.
     * @param {Function} func The function to debounce.
     * @param {number} delay The debounce delay in milliseconds.
     * @returns {Function} The debounced function.
     */
    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                func.apply(this, args);
            }, delay);
        };
    };


    // == Initialization ==

    /** Main initialization function, called on DOMContentLoaded */
    async function initializeApp() {
        log("--- initializeApp Start ---");
        setPageLoading(true); // Show initial loading state

        try {
            extensionId = getExtensionIdFromUrl();
            if (!extensionId) {
                throw new Error("No Extension ID found in URL query parameter 'id'.");
            }
            log("Target Extension ID:", extensionId);

            initDomElements(); // Cache DOM elements
            updateCurrentYear(); // Set footer year
            showLoadingOverlay(true); // Show spinner overlay

            // Load essential extension data using chrome.management API
            const extensionDataLoaded = await loadExtensionData();

            if (extensionDataLoaded) {
                log("Extension data loaded successfully.");
                updateSidebarHeader(); // Update sidebar with ext name/icon
                populateAllPanels(); // Fill content panels using loaded data
                setupAllListeners(); // Attach event handlers for buttons etc.
                showLoadingOverlay(false); // Hide spinner overlay
                // Activate the default panel (usually 'details')
                switchPanel(currentPanel);
            } else {
                // Error already logged/displayed by loadExtensionData
                error("Initialization failed: Could not load extension data.");
                showLoadingOverlay(false);
                disableUIOnError(); // Grey out UI
            }

        } catch (err) {
            error("CRITICAL error during initialization sequence.", err);
            showLoadingOverlay(false);
            // Display error message to the user
            displayGlobalError(`Initialization Failed: ${err.message || 'Unknown error'}`);
            disableUIOnError();
        } finally {
            setPageLoading(false); // Mark page loading as complete
            log("--- initializeApp End (isLoading:", isLoading, ") ---");
        }
    }

    /** Sets the overall page loading state (e.g., for aria-busy on body) */
    function setPageLoading(loading) {
        isLoading = loading;
        document.body.setAttribute('aria-busy', loading ? 'true' : 'false');
        log("Page loading state set to:", loading);
    }

    /** Caches frequently used DOM elements into the `dom` object */
    function initDomElements() {
        log("Initializing DOM elements cache...");
        dom.sidebar = getQuery('.sidebar');
        dom.sidebarIcon = getElem('sidebar-extension-icon');
        dom.sidebarTitle = getElem('sidebar-extension-title');
        dom.sidebarNav = getQuery('.sidebar-nav');
        dom.currentYearSpan = getElem('current-year');
        dom.contentArea = getQuery('.content-area');
        dom.initialLoadingOverlay = getElem('initial-loading-indicator');
        dom.errorContainer = getElem('error-container');

        // Panel Containers
        dom.detailsPanel = getElem('panel-details');
        dom.permissionsPanel = getElem('panel-permissions');
        dom.diagnosisPanel = getElem('panel-diagnosis');

        // Details Panel Elements
        dom.detailsContentWrapper = getElem('details-content-wrapper');
        dom.detailsActualContent = getElem('details-actual-content');
        dom.detailName = getElem('detail-name');
        dom.detailVersion = getElem('detail-version');
        dom.detailId = getElem('detail-id');
        dom.copyIdButton = getElem('copy-id-button');
        dom.detailInstallType = getElem('detail-install-type');
        dom.detailDescription = getElem('detail-description');
        dom.detailHomepageUrl = getElem('detail-homepage-url');
        dom.detailUpdateUrl = getElem('detail-update-url');
        dom.detailsActionsContent = getElem('details-actions-content');
        dom.detailsActualActions = getElem('details-actual-actions');
        dom.enableToggleButton = getElem('enable-toggle-button');
        dom.optionsButton = getElem('options-button');
        dom.storeButton = getElem('store-button');
        dom.uninstallButton = getElem('uninstall-button');

        // Permissions Panel Elements
        dom.permissionsContentWrapper = getElem('permissions-content-wrapper');
        dom.permissionsActualContent = getElem('permissions-actual-content');
        dom.permissionSearchInput = getElem('permission-search-input');
        dom.layoutListButton = getElem('layout-list-btn');
        dom.layoutGridButton = getElem('layout-grid-btn');
        dom.apiPermCountSpan = getElem('api-perm-count');
        dom.hostPermCountSpan = getElem('host-perm-count');
        dom.apiPermissionsList = getElem('api-permissions-list');
        dom.hostPermissionsList = getElem('host-permissions-list');
        dom.permissionsListContainers = getAllQuery('.permissions-list'); // NodeList

        // Diagnosis Panel Elements
        dom.diagnosisResultsList = getElem('diagnosis-results-list');
        dom.diagnosisActualContent = getElem('diagnosis-actual-content');
        dom.diagInitialPlaceholder = getElem('diag-initial-placeholder');
        dom.diagActionItems = getElem('diag-action-items');
        dom.diagActualActions = getElem('diag-actual-actions');
        dom.reloadExtensionButton = getElem('reload-extension-button');
        dom.checkErrorsButton = getElem('check-errors-button');

        // Other
        dom.toastContainer = getElem('toast-container');
        log("DOM elements cached.");
    }

    /** Extracts the 'id' query parameter from the URL */
    function getExtensionIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        log(`Extension ID from URL: ${id}`);
        return id;
    }

    /** Updates the copyright year in the footer */
    function updateCurrentYear() {
        if (dom.currentYearSpan) {
            dom.currentYearSpan.textContent = new Date().getFullYear();
        }
    }

    // == Data Loading ==

    /** Loads data for the specific extension using chrome.management API */
    async function loadExtensionData() {
        log(`Attempting to load data for extension ID: ${extensionId}`);
        if (!extensionId) {
            // This case should be caught by initializeApp, but double-check
            displayGlobalError("Extension ID is missing in the URL.");
            return false;
        }
        try {
            // CRITICAL: Check if the necessary API is available
            const apiAvailable = typeof window.chrome?.management?.get === 'function';
            if (!apiAvailable) {
                // This is a common reason for the page appearing non-functional
                throw new Error("The required `chrome.management` API is unavailable. This page must be run within a privileged extension context (e.g., chrome-extension://...).");
            }
            // Fetch extension info using the API
            log(`Calling chrome.management.get('${extensionId}')`);
            extensionInfo = await chrome.management.get(extensionId);

            // Check if the extension was actually found
            if (!extensionInfo) {
                throw new Error(`Extension ID "${extensionId}" not found via API. Is it installed and does this context have permission?`);
            }

            log("Extension data loaded successfully via API:", extensionInfo);
            return true; // Indicate success
        } catch (err) {
             error("Error loading extension data:", err);
             extensionInfo = null; // Clear potentially partial data
             // Display a user-friendly error message
             displayGlobalError(`Failed to load details for extension ID "${escapeHTML(extensionId)}": ${escapeHTML(err.message)}.`);
             return false; // Indicate failure
        }
    }


    // == UI Population & State ==

    /** Updates the sidebar header with the extension's icon and name */
    function updateSidebarHeader() {
        if (!extensionInfo || !dom.sidebarIcon || !dom.sidebarTitle) return;
        log("Updating sidebar header");
        const bestIcon = findBestIconUrl(extensionInfo.icons);
        dom.sidebarIcon.src = bestIcon || '../../public/icons/svg/terminal.svg'; // Provide fallback
        dom.sidebarIcon.alt = `${extensionInfo.name || 'Extension'} icon`; // Add alt text
        dom.sidebarTitle.textContent = extensionInfo.name || 'Details';
    }

    /** Finds the best icon URL from the available icons array, preferring larger sizes */
    function findBestIconUrl(icons, preferredSize = 128) {
        if (!icons || icons.length === 0) return null;
        // Sort icons by size descending to prioritize larger icons
        icons.sort((a, b) => b.size - a.size);
        // Find the first icon >= preferredSize, or take the largest if none meet preference
        const suitableIcon = icons.find(icon => icon.size >= preferredSize) || icons[0];
        return suitableIcon.url;
    }

    /** Populates content for all panels based on the loaded extensionInfo object */
    function populateAllPanels() {
        // This function requires extensionInfo to be loaded successfully
        if (!extensionInfo) {
            warn("Cannot populate panels, missing extensionInfo (likely due to loading error).");
            return;
         }
        log("Populating all panels with data:", extensionInfo);
        populateDetailsPanel();      // Fill the main details section
        populatePermissionsPanel();  // Fill the permissions section
        populateDiagnosisPanel();    // Fill the troubleshooting section (triggers async checks)
    }

    /** Populates the 'Details' panel using data from `extensionInfo` */
    function populateDetailsPanel() {
        log("Populating Details Panel");
        if (!dom.detailsPanel || !dom.detailsContentWrapper || !dom.detailsActualContent || !extensionInfo) {
             error("Details panel elements or extension info missing, cannot populate."); return;
        }

        // Show skeleton loaders while populating
        setBusyState(dom.detailsContentWrapper, true);
        setBusyState(dom.detailsActionsContent, true);

        // Use requestAnimationFrame to ensure skeleton is rendered before replacing content
        requestAnimationFrame(() => {
            try {
                // --- Populate Details Grid ---
                // Use helper functions to safely set text and update links
                setText(dom.detailName, extensionInfo.name);
                setText(dom.detailVersion, extensionInfo.version);
                setText(dom.detailId, extensionInfo.id);
                setText(dom.detailInstallType, getInstallTypeDescription(extensionInfo.installType));
                setText(dom.detailDescription, extensionInfo.description || 'No description provided.');
                updateLink(dom.detailHomepageUrl, extensionInfo.homepageUrl, extensionInfo.homepageUrl || 'N/A');
                setText(dom.detailUpdateUrl, extensionInfo.updateUrl || 'N/A'); // Often blank for store extensions

                // --- Populate Action Buttons ---
                updateEnableToggleButton(extensionInfo.enabled); // Set initial state of enable/disable button
                setElementVisibility(dom.optionsButton, !!extensionInfo.optionsUrl); // Show options button only if URL exists
                if (extensionInfo.optionsUrl) {
                    // Assign the click handler ONLY if the button is visible/functional
                    dom.optionsButton.onclick = handleOptionsClick;
                }
                setupStoreButton(); // Handle visibility/link for the 'View in Store' button

                log("Details panel populated successfully.");
            } catch(err) {
                error("Error populating details panel:", err);
                // Display an error within the panel content area
                setText(dom.detailsActualContent, "Failed to display extension details.");
                setText(dom.detailsActualActions, ""); // Clear actions on error
            } finally {
                // Hide skeleton loaders and show the actual content
                setBusyState(dom.detailsContentWrapper, false);
                setBusyState(dom.detailsActionsContent, false);
            }
        });
    }

    /** Gets a user-friendly description for the extension install type */
    function getInstallTypeDescription(installType) {
        switch (installType) {
            case 'admin': return 'Installed by administrator policy';
            case 'development': return 'Loaded unpacked (Development mode)';
            case 'normal': return 'Installed normally (e.g., from Chrome Web Store)';
            case 'sideload': return 'Sideloaded';
            case 'other': return 'Other installation method';
            default: return installType || 'Unknown'; // Fallback
        }
    }

    /** Sets up the 'View in Store' button visibility and link */
    function setupStoreButton() {
        if (!dom.storeButton || !extensionInfo) return;
        // Basic check: Is it likely a Chrome Web Store extension?
        // Assumes 32-char lowercase ID and 'normal' install type. Might need refinement.
        const isWebStoreExtension = extensionInfo.id && /^[a-z]{32}$/.test(extensionInfo.id) && (extensionInfo.installType === 'normal' || !extensionInfo.installType);
        const storeUrl = isWebStoreExtension ? `https://chrome.google.com/webstore/detail/${extensionInfo.id}` : null;

        // Show the button only if we could construct a store URL
        setElementVisibility(dom.storeButton, !!storeUrl);
        if (storeUrl) {
            // Add click listener to open the store page in a new tab
            dom.storeButton.onclick = () => window.open(storeUrl, '_blank');
        }
    }

    /** Populates the 'Permissions' panel */
    function populatePermissionsPanel() {
        log("Populating Permissions Panel");
         if (!dom.permissionsPanel || !dom.permissionsContentWrapper || !dom.permissionsActualContent || !extensionInfo) {
             error("Permissions panel elements or extension info missing, cannot populate."); return;
        }

        setBusyState(dom.permissionsContentWrapper, true); // Show skeleton

        requestAnimationFrame(() => {
            try {
                // Get permissions arrays from the loaded extension info
                const apiPerms = extensionInfo.permissions || [];
                const hostPerms = extensionInfo.hostPermissions || [];

                // Update permission counts displayed in headings
                setText(dom.apiPermCountSpan, apiPerms.length);
                setText(dom.hostPermCountSpan, hostPerms.length);

                // Render the lists of API and Host permissions
                renderPermissionsList(dom.apiPermissionsList, apiPerms, 'api');
                renderPermissionsList(dom.hostPermissionsList, hostPerms, 'host');

                // Apply initial filter (e.g., if search box has a value) and layout
                filterPermissions(); // Apply search filter
                applyPermissionsLayout(currentPermissionsLayout); // Apply list/grid view

                log("Permissions panel populated.");
            } catch (err) {
                error("Error populating permissions panel", err);
                // Display error message within the panel
                if (dom.permissionsActualContent) dom.permissionsActualContent.innerHTML = `<p class="error-message">Failed to load permissions.</p>`;
            } finally {
                setBusyState(dom.permissionsContentWrapper, false); // Hide skeleton
            }
        });
    }

    /** Renders a list of permissions (API or Host) into the specified container */
    function renderPermissionsList(listContainer, permissions, type) {
         if (!listContainer) {
             warn(`Permissions list container for type '${type}' not found.`);
             return;
         }
         listContainer.innerHTML = ''; // Clear previous content (e.g., placeholders or old data)
         const placeholderText = type === 'api' ? 'No API permissions requested.' : 'No specific host permissions requested.';

         // If no permissions of this type, show a placeholder message
         if (!permissions || permissions.length === 0) {
             listContainer.appendChild(createPlaceholderElement(placeholderText, 'info'));
             return;
         }

         // Create and append an element for each permission
         permissions.forEach(perm => {
            // Find the description and risk level from our inline data
            const permDef = findPermissionDefinition(perm, type);
            // Create the HTML element for this permission
            const itemDiv = createPermissionElement(perm, type, permDef);
            listContainer.appendChild(itemDiv);
        });
    }

    /**
     * Finds the definition (description, risk) for a given permission name.
     * Uses the inline ALL_PERMISSIONS_DATA constant.
     * Handles specific logic for host permissions.
     * @param {string} permissionName - The name of the permission (e.g., "tabs", "<all_urls>").
     * @param {'api' | 'host'} type - The type of permission.
     * @returns {object | null} The permission definition object or a fallback/null.
     */
    function findPermissionDefinition(permissionName, type) {
        // Determine the name to search for in our data (use 'host' for all host permissions)
        const searchName = type === 'host' ? 'host' : permissionName;
        // Find definition (case-insensitive matching can be added if needed)
        const definition = ALL_PERMISSIONS_DATA.find(p => p.name.toLowerCase() === searchName.toLowerCase());

        // --- Handle API Permissions ---
        if (type === 'api') {
            if (!definition) {
                // If an API permission isn't in our list, provide a generic fallback
                warn(`No definition found for API permission: ${permissionName}`);
                return {
                    name: permissionName,
                    description: `Allows access to browser features related to '${escapeHTML(permissionName)}'. (No specific description available).`,
                    risk: "Medium" // Default risk for unknown APIs
                };
            }
            return definition; // Return the found definition
        }

        // --- Handle Host Permissions ---
        if (type === 'host') {
            // Find the base 'host' definition, or use the specific match if one existed (less common)
            const baseDefinition = definition || ALL_PERMISSIONS_DATA.find(p => p.name === 'host');
            if (!baseDefinition) {
                 // This should not happen if 'host' is defined in ALL_PERMISSIONS_DATA
                 error(`Base 'host' permission definition not found!`);
                 return { name: permissionName, description: `Access host: ${escapeHTML(permissionName)}`, risk: 'Medium' };
            }

            let hostDesc = baseDefinition.description; // Start with base description
            let hostRisk = baseDefinition.risk; // Start with base risk ('Varies')

            // Refine description and risk based on the specific host pattern
            const escapedName = escapeHTML(permissionName);
            if (permissionName === "<all_urls>") {
                hostDesc = "Grants permission to access data and modify behavior on ALL websites. This is a very broad permission.";
                hostRisk = "High";
            } else if (permissionName.startsWith("*://*/*")) { // e.g., "*://*/*" or "https://*/*"
                hostDesc = `Grants broad access to websites matching the pattern: ${escapedName}.`;
                hostRisk = "High";
            } else if (permissionName.includes('*')) { // e.g., "*://*.google.com/*"
                hostDesc = `Grants access to specific websites matching the pattern: ${escapedName}.`;
                hostRisk = "Medium";
            } else { // Specific URL like "https://www.google.com/"
                hostDesc = `Grants access to the specific website: ${escapedName}.`;
                hostRisk = "Medium"; // Access to even one site is medium risk
            }
            // Return a synthesized definition using the base but with refined details
            return { ...baseDefinition, name: permissionName, description: hostDesc, risk: hostRisk };
        }

        // Should not be reached if type is 'api' or 'host'
        warn(`Invalid type "${type}" passed to findPermissionDefinition.`);
        return null;
    }

    /**
     * Creates a DOM element representing a single permission item.
     * @param {string} permissionName - The name of the permission.
     * @param {'api' | 'host'} type - The type of permission.
     * @param {object | null} definition - The permission definition (containing description, risk).
     * @returns {HTMLElement} The created permission item div.
     */
    function createPermissionElement(permissionName, type, definition) {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'permission-item';
        // Use lowercase for data attribute for easier CSS/JS selection if needed
        itemDiv.dataset.permissionName = permissionName.toLowerCase();

        const safePermName = escapeHTML(permissionName);
        // Determine description and risk, providing fallbacks if definition is missing
        const description = definition?.description || (type === 'api'
            ? `Unknown permission: ${safePermName}`
            : `Allows access to host: ${safePermName}`);
        const riskLevel = definition?.risk?.toLowerCase() || 'medium'; // Default to medium risk
        const riskText = definition?.risk || 'Medium'; // Display text (e.g., "Medium", "High")

        // Add risk class for styling (e.g., border color)
        itemDiv.classList.add(`risk-${riskLevel}`);

        // Determine icon based on type
        const iconClass = type === 'host' ? 'icon-host' : 'icon-api';

        // Construct the inner HTML for the permission item
        itemDiv.innerHTML = `
            <div class="permission-item-header">
                <span class="icon ${iconClass}" aria-hidden="true"></span>
                ${type === 'host'
                    // Display host permissions as code
                    ? `<code>${safePermName}</code>`
                    // Display API permissions as normal text
                    : `<span class="perm-name">${safePermName}</span>`
                }
                <span class="risk-indicator ${riskLevel}">${escapeHTML(riskText)} Risk</span>
            </div>
            <div class="permission-item-description">${escapeHTML(description)}</div>
        `;
        return itemDiv;
    }

    /** Creates a placeholder element (e.g., "No permissions found", "Loading...") */
    function createPlaceholderElement(text, type = 'info') { // type can be 'info', 'loading', etc.
        const placeholder = document.createElement('div');
        placeholder.className = `placeholder info-message type-${type}`; // Add type class for styling
        const iconType = type === 'loading' ? 'loading loading' : 'info'; // Use loading spinner if type is 'loading'
        placeholder.innerHTML = `
            <span class="icon icon-${iconType}" aria-hidden="true"></span>
            <span>${escapeHTML(text)}</span>`;
        return placeholder;
    }

    /** Populates the 'Troubleshooting' panel and initiates diagnostic checks */
    function populateDiagnosisPanel() {
        log("Populating Diagnosis Panel");
        if (!dom.diagnosisPanel || !dom.diagnosisResultsList || !dom.diagActionItems || !extensionInfo) {
            error("Diagnosis panel elements or extension info missing, cannot populate."); return;
        }

        // Clear previous results and show loading/skeleton states
        if (dom.diagnosisActualContent) dom.diagnosisActualContent.innerHTML = ''; // Clear old results
        setBusyState(dom.diagnosisResultsList, true); // Show skeleton for results list
        setBusyState(dom.diagActionItems, true);      // Show skeleton for action buttons
        setElementVisibility(dom.diagInitialPlaceholder, true); // Show "Running checks..." message

        // Run diagnostics asynchronously, as checks might take time or involve async ops
        runDiagnostics()
            .catch(err => {
                // Handle any errors during the diagnostic process
                error("Error running diagnostics:", err);
                addDiagnosticItem('error', 'Failed to run diagnostic checks.', escapeHTML(err.message));
            })
            .finally(() => {
                // Once diagnostics are complete (success or error):
                setBusyState(dom.diagnosisResultsList, false); // Hide results skeleton
                setBusyState(dom.diagActionItems, false);      // Hide actions skeleton
                setElementVisibility(dom.diagInitialPlaceholder, false); // Hide "Running checks..."
                log("Diagnostics run complete.");
            });
    }

    /** Runs automated checks for common extension issues based on `extensionInfo` */
    async function runDiagnostics() {
        log("Running diagnostics...");
        // Requires extensionInfo and the container to add results to
        if (!extensionInfo || !dom.diagnosisActualContent) return;

        // Clear previous diagnostic items before adding new ones
        dom.diagnosisActualContent.innerHTML = '';

        let issueFound = false; // Flag to track if any warnings/errors were found

        // --- Check 1: Is the extension enabled? ---
        if (!extensionInfo.enabled) {
            addDiagnosticItem('warning', 'Extension is currently disabled.', 'Enable the extension from the "Details" panel if you want to use it.');
            issueFound = true;
        } else {
            addDiagnosticItem('success', 'Extension is enabled.');
        }

        // --- Check 2: Can runtime errors be checked? ---
        // `mayEnableErrorReporting` indicates if the "Errors" button on chrome://extensions works
        if (extensionInfo.mayEnableErrorReporting) {
            // MODIFY the message and suggestion for clarity:
            addDiagnosticItem(
                'info',
                'Runtime errors may be viewable for this extension.', // More accurate message
                'If you suspect issues, you can try checking for errors manually. Use the "Check Runtime Errors" button below to open the relevant browser page (if available).' // Clearer suggestion
            );
            // Keep the button enabled below
        } else {
             // Keep this check, it's useful information
    addDiagnosticItem(
        'info',
        'Runtime error reporting is not enabled or directly accessible for this type of extension.' // Slightly clearer
    );
    // Ensure the button is disabled if reporting isn't possible
    if (dom.checkErrorsButton) {
         dom.checkErrorsButton.disabled = true;
         dom.checkErrorsButton.title = 'Runtime error checking not available for this extension.';
    }
}

// Ensure the button state is also set correctly after the check:
if (dom.checkErrorsButton && !extensionInfo.mayEnableErrorReporting) {
     dom.checkErrorsButton.disabled = true;
     dom.checkErrorsButton.title = 'Runtime error checking not available for this extension.';
} else if (dom.checkErrorsButton) {
     dom.checkErrorsButton.disabled = false; // Ensure enabled otherwise
     dom.checkErrorsButton.title = '';
}


        // --- Check 3: Are there high-risk permissions? ---
        // Check both API permissions and Host permissions
        const highRiskPerms = (extensionInfo.permissions || [])
            .map(p => findPermissionDefinition(p, 'api')) // Get definitions
            .filter(def => def?.risk?.toLowerCase() === 'high'); // Filter for high risk

        const highRiskHosts = (extensionInfo.hostPermissions || [])
             .map(p => findPermissionDefinition(p, 'host')) // Get definitions
             .filter(def => def?.risk?.toLowerCase() === 'high'); // Filter for high risk (e.g., <all_urls>)

             if (highRiskPerms.length > 0 || highRiskHosts.length > 0) {
                // Combine names of high-risk permissions found
                // This line constructs the HTML string:
                const names = [...highRiskPerms, ...highRiskHosts].map(p => `<code>${escapeHTML(p.name)}</code>`).join(', ');
                // This line passes it to addDiagnosticItem with allowHtmlInMessage implicitly true if not passed (or explicitly true)
                addDiagnosticItem('warning', `High-risk permissions detected: ${names}.`, 'Ensure you trust this extension...', true); // Added true for clarity
                issueFound = true;
            }
        // --- Check 4: Source/Installation Type ---
        const isWebStoreExtension = extensionInfo.id && /^[a-z]{32}$/.test(extensionInfo.id) && (extensionInfo.installType === 'normal' || !extensionInfo.installType);
        if (extensionInfo.installType === 'development') {
            addDiagnosticItem('info', 'Extension loaded in development mode.', 'Ensure source code is trusted. Reloading may be needed after making code changes.');
        } else if (!isWebStoreExtension && extensionInfo.installType !== 'admin') {
            // If not development, not admin-installed, and doesn't look like a store ID/type
            addDiagnosticItem('warning', 'Extension may not be from the official Web Store.', 'Be cautious with extensions installed from unknown sources. Verify its origin and trustworthiness.');
            issueFound = true;
        } else if (extensionInfo.installType === 'admin') {
             addDiagnosticItem('info', 'Extension installed by administrator policy.', 'Changes may be restricted by your organization.');
        }

        // --- Check 5: Update URL ---
        // Store extensions usually don't list an updateUrl or it points to google.com
        if (!extensionInfo.updateUrl && isWebStoreExtension) {
             // This is normal for store extensions
             addDiagnosticItem('info', 'No explicit update URL found, likely managed by the Chrome Web Store.');
        } else if (extensionInfo.updateUrl && !extensionInfo.updateUrl.includes('google.com')) {
             // Custom update URL - potentially risky if source isn't trusted
             addDiagnosticItem('warning', 'Uses a custom update URL.', 'Updates are handled outside the official store. Ensure the source is trustworthy.');
             issueFound = true;
        }

        // --- Final Summary Message ---
        // If no specific issues were flagged and the extension is enabled
        if (!issueFound && extensionInfo.enabled) {
            addDiagnosticItem('success', 'No common issues automatically detected.', 'If problems persist, try reloading the extension or consult the further assistance tips below.');
        } else if (!issueFound && !extensionInfo.enabled) {
            // If no issues found but it's disabled, mention that
             addDiagnosticItem('info', 'No common issues automatically detected (extension is currently disabled).');
        }
    }

    /** Adds an item (success, warning, error, info) to the diagnosis results list */
    function addDiagnosticItem(type, message, suggestion = null, allowHtmlInMessage = false) {
        if (!dom.diagnosisActualContent) return; // Ensure container exists

        const itemDiv = document.createElement('div');
        // Apply classes for styling based on type (success, warning, error, info)
        itemDiv.className = `diag-item ${type}`;

        // Determine the appropriate icon class
        let iconClass = 'icon-info'; // Default icon
        switch (type) {
            case 'success': iconClass = 'icon-check'; break;
            case 'warning': iconClass = 'icon-warning'; break;
            case 'error': iconClass = 'icon-error'; break;
        }

        // Sanitize message and suggestion to prevent XSS, unless explicitly allowed (use carefully)
        const safeMessage = allowHtmlInMessage ? message : escapeHTML(message);
        const safeSuggestion = suggestion ? escapeHTML(suggestion) : '';

        // Construct the inner HTML for the diagnostic item
        itemDiv.innerHTML = `
            <span class="icon ${iconClass}" aria-hidden="true"></span>
            <div class="diag-content">
                <span class="diag-message">${safeMessage}</span>
                ${safeSuggestion ? `<span class="diag-suggestion">${safeSuggestion}</span>` : ''}
            </div>
        `;
        // Append the new item to the results list
        dom.diagnosisActualContent.appendChild(itemDiv);
    }


    // == Event Listeners & Handlers ==

    /** Sets up all necessary event listeners for the page */
    function setupAllListeners() {
        log("Setting up event listeners...");
        setupSidebarNavigation();          // For switching panels
        setupActionListeners();            // For buttons like Enable, Uninstall, Reload etc.
        setupPermissionControlsListeners();// For search and layout toggles in Permissions panel
        log("Event listeners set up.");
    }

    /** Sets up listeners for sidebar navigation buttons to switch panels */
    function setupSidebarNavigation() {
        if (!dom.sidebarNav) return;
        const buttons = getAllQuery('.sidebar-button', dom.sidebarNav);
        buttons.forEach(button => {
            addSafeListener(button, 'click', (event) => {
                // Get the target panel ID from the button's data attribute
                const targetPanelId = event.currentTarget.dataset.panelTarget;
                if (targetPanelId) {
                    // Call the function to switch to the target panel
                    switchPanel(targetPanelId);
                } else {
                    warn("Sidebar button clicked without 'data-panel-target'.");
                }
            });
        });
    }

    /** Sets up listeners for primary action buttons (enable, options, uninstall, etc.) */
    function setupActionListeners() {
        // Add listeners using the safe utility function
        addSafeListener(dom.enableToggleButton, 'click', handleEnableToggleClick);
        // Note: Options button listener is added dynamically in populateDetailsPanel if optionsUrl exists
        addSafeListener(dom.uninstallButton, 'click', handleUninstallClick);
        addSafeListener(dom.reloadExtensionButton, 'click', handleReloadClick);
        addSafeListener(dom.checkErrorsButton, 'click', handleCheckErrorsClick);
        addSafeListener(dom.copyIdButton, 'click', handleCopyIdClick);
    }

    /** Sets up listeners for permission search input and layout toggle buttons */
    function setupPermissionControlsListeners() {
        // Debounced search input handler prevents filtering on every keystroke
        const debouncedSearchHandler = debounce((event) => {
            filterPermissions(event.target.value); // Call filter function with input value
        }, SEARCH_DEBOUNCE_MS);
        addSafeListener(dom.permissionSearchInput, 'input', debouncedSearchHandler);

        // Layout toggle buttons (List/Grid view)
        addSafeListener(dom.layoutListButton, 'click', handleLayoutToggle);
        addSafeListener(dom.layoutGridButton, 'click', handleLayoutToggle);
    }

    /** Utility to safely add event listeners, checking if element exists first */
    function addSafeListener(element, event, handler) {
        if (element) {
            // Element exists, add the listener
            element.addEventListener(event, handler);
        } else {
            // Log a warning if trying to add listener to a non-existent element
            // This helps catch issues if IDs in HTML change or elements are missing
            warn(`Attempted to add listener for "${event}" to a non-existent element.`);
        }
    }

    // --- Event Handlers ---

    /** Handles click on the Enable/Disable toggle button */
    async function handleEnableToggleClick() {
        // Requires extensionInfo and the button element
        if (!extensionInfo || !dom.enableToggleButton) return;

        const newState = !extensionInfo.enabled; // Determine the desired new state
        log(`Toggling enabled state to: ${newState} for ID: ${extensionId}`);

        // Disable button during the async operation to prevent double-clicks
        dom.enableToggleButton.disabled = true;
        dom.enableToggleButton.setAttribute('aria-busy', 'true'); // Indicate loading state

        try {
            // Call the chrome.management API to set the enabled state
            await chrome.management.setEnabled(extensionId, newState);

            // --- Success ---
            log(`Successfully set enabled state to ${newState}`);
            // Update local state and UI *after* API call succeeds
            extensionInfo.enabled = newState;
            updateEnableToggleButton(newState); // Update button appearance/text
            showToast(`Extension ${newState ? 'enabled' : 'disabled'} successfully.`, 'success');

            // Re-run diagnostics as the enabled state affects checks
            if (currentPanel === 'panel-diagnosis') {
                 populateDiagnosisPanel();
            }
        } catch (err) {
            // --- Error ---
            error("Error toggling extension state:", err);
            showToast(`Failed to ${newState ? 'enable' : 'disable'} extension: ${err.message}`, 'error');
            // Optional: Revert UI optimistically if API failed (or refresh data)
            updateEnableToggleButton(extensionInfo.enabled); // Set button back to original state
        } finally {
            // Re-enable the button regardless of success or failure
            dom.enableToggleButton.disabled = false;
            dom.enableToggleButton.removeAttribute('aria-busy');
        }
    }

    /** Handles click on the Options button */
    function handleOptionsClick() {
        // Check if the extension actually has an options page URL
        if (extensionInfo?.optionsUrl) {
            log(`Opening options page: ${extensionInfo.optionsUrl}`);
            // Use chrome.tabs API if available (preferred, opens within extension context if possible)
            if (typeof chrome?.tabs?.create === 'function') {
                chrome.tabs.create({ url: extensionInfo.optionsUrl });
            } else {
                // Fallback if tabs API is not available (e.g., script running in unexpected context)
                window.open(extensionInfo.optionsUrl, '_blank');
                warn("chrome.tabs.create not available, using window.open as fallback for options page.");
            }
        } else {
            warn("Options button clicked, but no optionsUrl found in extensionInfo.");
        }
    }

    /** Handles click on the Uninstall button */
    function handleUninstallClick() {
        if (!extensionInfo) return; // Need extension info to uninstall
        log(`Uninstall requested for: ${extensionInfo.name} (${extensionId})`);

        // Use a simple confirmation dialog before proceeding
        // NOTE: The browser might show its own confirmation dialog as well depending on settings/context.
        if (!window.confirm(`Are you sure you want to uninstall "${extensionInfo.name}"? This action cannot be undone.`)) {
            log("Uninstall cancelled by user.");
            return; // Stop if user cancels
        }

        // Disable button during the operation
        dom.uninstallButton.disabled = true;
        dom.uninstallButton.setAttribute('aria-busy', 'true');

        // Call the chrome.management API to uninstall
        // showConfirmDialog: false - because we already asked with window.confirm
        chrome.management.uninstall(extensionId, { showConfirmDialog: false })
            .then(() => {
                // --- Success ---
                log("Extension uninstalled successfully via API.");
                showToast(`"${extensionInfo.name}" uninstalled.`, 'success');
                // After successful uninstall, the page is no longer relevant
                displayGlobalError(`Extension "${escapeHTML(extensionInfo.name)}" has been uninstalled. You may close this page.`);
                disableUIOnError(); // Grey out the page content
                // Optionally, redirect the user after a short delay:
                // setTimeout(() => { window.location.href = 'manage_extensions.html'; }, 2000);
            })
            .catch(err => {
                // --- Error ---
                error("Error uninstalling extension:", err);
                showToast(`Failed to uninstall: ${err.message}`, 'error');
                // Re-enable the button if uninstall failed
                dom.uninstallButton.disabled = false;
                dom.uninstallButton.removeAttribute('aria-busy');
            });
    }

    /** Handles click on the Reload Extension button (Troubleshooting panel) */
    async function handleReloadClick() {
        if (!extensionInfo || !dom.reloadExtensionButton) return;
        log(`Reload requested for: ${extensionId}`);

        // Disable button and show loading text
        dom.reloadExtensionButton.disabled = true;
        dom.reloadExtensionButton.setAttribute('aria-busy', 'true');
        const originalButtonText = dom.reloadExtensionButton.querySelector('span:not(.icon)')?.textContent;
        setText(dom.reloadExtensionButton.querySelector('span:not(.icon)'), 'Reloading...');

        try {
            // Reloading is often done by disabling then re-enabling the extension
            await chrome.management.setEnabled(extensionId, false); // Disable first
            // Optional: Short delay to ensure disable completes before re-enabling
            await new Promise(resolve => setTimeout(resolve, 150));
            await chrome.management.setEnabled(extensionId, true); // Then re-enable

            // --- Success ---
            log("Extension reloaded successfully.");
            showToast(`"${extensionInfo.name}" reloaded.`, 'success');

            // Refresh data as the reload might change state or fix errors
            log("Refreshing extension data after reload...");
            await loadExtensionData(); // Re-fetch data
            populateAllPanels(); // Re-populate UI with potentially updated info

        } catch (err) {
            // --- Error ---
            error("Error reloading extension:", err);
            showToast(`Failed to reload: ${err.message}`, 'error');
        } finally {
            // Re-enable button and restore original text
            dom.reloadExtensionButton.disabled = false;
            dom.reloadExtensionButton.removeAttribute('aria-busy');
            setText(dom.reloadExtensionButton.querySelector('span:not(.icon)'), originalButtonText || 'Reload Extension');
        }
    }

    /** Handles click on the Check Runtime Errors button (Troubleshooting panel) */
    function handleCheckErrorsClick() {
        if (!extensionInfo) return;
        // Construct the special Chrome URL that opens the extensions page focused on this extension's errors
        const errorUrl = `chrome://extensions/?errors=${extensionId}`;
        log(`Opening runtime errors page: ${errorUrl}`);

        // Open this URL in a new tab
        if (typeof chrome?.tabs?.create === 'function') {
            chrome.tabs.create({ url: errorUrl });
        } else {
            // Fallback if tabs API isn't available
            window.open(errorUrl, '_blank');
             warn("chrome.tabs.create not available, using window.open as fallback for error page.");
        }
    }

     /** Handles click on the Copy Extension ID button */
     function handleCopyIdClick() {
         // Check if ID exists and Clipboard API is available
         if (!extensionInfo?.id || !navigator.clipboard) {
             showToast('Cannot copy ID (Clipboard API unavailable or ID missing).', 'error');
             return;
         }
         // Use the Clipboard API to write the ID text
         navigator.clipboard.writeText(extensionInfo.id)
             .then(() => {
                 // --- Success ---
                 log(`Copied ID to clipboard: ${extensionInfo.id}`);
                 showToast('Extension ID copied to clipboard!', 'success');
             })
             .catch(err => {
                 // --- Error ---
                 error('Failed to copy extension ID:', err);
                 showToast('Could not copy ID to clipboard.', 'error');
             });
     }

    // --- Permission Control Handlers ---

    /** Filters the displayed permissions based on the search term */
    function filterPermissions(searchTerm = dom.permissionSearchInput?.value || '') {
        const term = searchTerm.trim().toLowerCase(); // Normalize search term
        log(`Filtering permissions with term: "${term}"`);
        let visibleCount = 0;

        // Iterate over all permission items in both API and Host lists
        getAllQuery('.permission-item', dom.permissionsActualContent).forEach(item => {
            // Get permission name (from data attribute) and description text
            const name = item.dataset.permissionName || ''; // Already lowercase
            const description = item.querySelector('.permission-item-description')?.textContent?.toLowerCase() || '';
            // Check if the term matches the name or description
            const isVisible = !term || name.includes(term) || description.includes(term);
            // Show or hide the item based on the match
            setElementVisibility(item, isVisible);
            if (isVisible) visibleCount++;
        });

        // Show/hide placeholder messages if lists become empty after filtering
        [dom.apiPermissionsList, dom.hostPermissionsList].forEach(list => {
            if (!list) return; // Skip if list container not found
            // Count visible items *within this specific list*
            const visibleItemsInList = list.querySelectorAll('.permission-item:not([hidden])').length;
            const placeholder = list.querySelector('.placeholder'); // Find the placeholder element

            if (placeholder) {
                // Show placeholder if no items are visible in this list
                setElementVisibility(placeholder, visibleItemsInList === 0);
                // Update placeholder text dynamically based on whether filtering is active
                if (visibleItemsInList === 0 && term) {
                    // If filtering resulted in no matches
                    placeholder.querySelector('span:not(.icon)').textContent = `No permissions match "${escapeHTML(searchTerm)}".`;
                } else if (visibleItemsInList === 0 && !term) {
                    // If list is empty and there's no filter term (reset to default)
                    const type = list.id.includes('api') ? 'api' : 'host'; // Determine list type
                    placeholder.querySelector('span:not(.icon)').textContent = type === 'api' ? 'No API permissions requested.' : 'No specific host permissions requested.';
                }
            }
        });

        log(`Filtering complete. ${visibleCount} total items visible across lists.`);
    }

    /** Handles clicks on the layout toggle buttons (List/Grid) */
    function handleLayoutToggle(event) {
        const button = event.currentTarget;
        const newLayout = button.dataset.layout; // Get 'list' or 'grid' from data attribute
        // Only switch if the clicked layout is different from the current one
        if (newLayout && newLayout !== currentPermissionsLayout) {
            log(`Switching permissions layout to: ${newLayout}`);
            applyPermissionsLayout(newLayout); // Apply the new layout
        }
    }

    /** Applies the specified layout (list or grid) to the permission lists */
    function applyPermissionsLayout(layout) {
        currentPermissionsLayout = layout; // Update the state variable

        // Update button active states and aria-pressed attributes
        dom.layoutListButton.classList.toggle('active', layout === 'list');
        dom.layoutListButton.setAttribute('aria-pressed', layout === 'list' ? 'true' : 'false');
        dom.layoutGridButton.classList.toggle('active', layout === 'grid');
        dom.layoutGridButton.setAttribute('aria-pressed', layout === 'grid' ? 'true' : 'false');

        // Update list container classes to apply CSS rules for list/grid view
        dom.permissionsListContainers.forEach(container => {
            container.classList.remove('list-view', 'grid-view'); // Remove old layout class
            container.classList.add(`${layout}-view`); // Add new layout class
        });
        log(`Permissions layout set to ${layout}-view.`);
    }


    // == Panel Switching ==

    /** Switches the visible content panel and updates sidebar active state */
    function switchPanel(targetPanelId) {
        log(`Switching panel to: ${targetPanelId}`);
        const targetPanel = getElem(targetPanelId);
        if (!targetPanel) {
            error(`Target panel "${targetPanelId}" not found.`);
            return;
        }

        // --- Deactivate currently active panel and sidebar button ---
        getAllQuery('.content-panel.active', dom.contentArea).forEach(panel => {
            panel.hidden = true;
            panel.classList.remove('active');
        });
        getAllQuery('.sidebar-button.active', dom.sidebarNav).forEach(button => {
            button.classList.remove('active');
            button.removeAttribute('aria-current');
        });

        // --- Activate the target panel ---
        targetPanel.hidden = false;
        targetPanel.classList.add('active');
        // Set focus to the newly activated panel for accessibility
        // Use try/catch as focus might fail in some edge cases (e.g., if element is still hidden by CSS)
        try { targetPanel.focus(); } catch(e) { warn("Could not focus target panel:", e); }
        currentPanel = targetPanelId; // Update state variable

        // --- Activate the corresponding sidebar button ---
        const activeButton = getQuery(`.sidebar-button[data-panel-target="${targetPanelId}"]`, dom.sidebarNav);
        if (activeButton) {
            activeButton.classList.add('active');
            activeButton.setAttribute('aria-current', 'page'); // Mark as current page for accessibility
        } else {
            warn(`Sidebar button for panel "${targetPanelId}" not found.`);
        }

        // --- Special actions for specific panels ---
        // Re-run diagnostics specifically when switching TO that panel
        if (targetPanelId === 'panel-diagnosis' && extensionInfo) { // Only run if data is loaded
            populateDiagnosisPanel();
        }

        log(`Panel switched successfully to ${targetPanelId}.`);
    }

    // == UI State Helpers ==

    /** Shows or hides the main initial loading overlay */
    function showLoadingOverlay(show) {
        setElementVisibility(dom.initialLoadingOverlay, show);
        log(`Initial loading overlay ${show ? 'shown' : 'hidden'}.`);
    }

    /** Displays a global error message at the top of the content area */
    function displayGlobalError(message, container = dom.errorContainer) {
        if (container) {
            // Construct message with an error icon. Use escapeHTML for safety.
            container.innerHTML = `<span class="icon icon-error" aria-hidden="true"></span> <strong>Error:</strong> ${escapeHTML(message)}`;
            setElementVisibility(container, true); // Make the error container visible
        }
        // Always log the error to the console for debugging
        error("Global Error Displayed:", message);
    }

    /** Disables/greys out the main content area and sidebar actions on critical error */
    function disableUIOnError() {
        log("Disabling UI due to critical error.");
        // Add a class to grey out the content area (CSS should handle the styling)
        dom.contentArea?.classList.add('disabled-state');
        // Disable all sidebar buttons to prevent navigation
        getAllQuery('.sidebar-button', dom.sidebarNav).forEach(button => {
            button.disabled = true;
        });
        // Disable all buttons within the main content panels
        getAllQuery('.panel-content button', dom.contentArea).forEach(button => {
            button.disabled = true;
        });
    }

    /**
     * Sets the aria-busy state on a container element.
     * Used to indicate loading state for sections, often paired with CSS
     * to show/hide skeleton loaders.
     * @param {HTMLElement} container - The container element.
     * @param {boolean} isBusy - True if the container is busy/loading.
     */
    function setBusyState(container, isBusy) {
        if (!container) return; // Do nothing if container doesn't exist
        container.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        // Note: The actual showing/hiding of skeleton loaders vs content
        // is handled by the CSS rules targeting the [aria-busy="true/false"] attribute.
        // Example CSS:
        // [aria-busy="true"] > .skeleton-loader { display: block; }
        // [aria-busy="true"] > *:not(.skeleton-loader) { visibility: hidden; }
        // [aria-busy="false"] > .skeleton-loader { display: none; }
        // [aria-busy="false"] > *:not(.skeleton-loader) { visibility: visible; }
    }

    /** Updates the appearance and text of the Enable/Disable toggle button */
    function updateEnableToggleButton(isEnabled) {
        if (!dom.enableToggleButton) return; // Ensure button exists
        const icon = dom.enableToggleButton.querySelector('.icon');
        const textSpan = dom.enableToggleButton.querySelector('span:not(.icon)');

        // Toggle 'enabled' class for styling
        dom.enableToggleButton.classList.toggle('enabled', isEnabled);
        // Update icon class
        if (icon) {
            icon.className = `icon ${isEnabled ? 'icon-toggle-on' : 'icon-toggle-off'}`;
        }
        // Update button text
        if (textSpan) {
            textSpan.textContent = isEnabled ? 'Enabled' : 'Disabled';
        }
        // Update ARIA state for accessibility
        dom.enableToggleButton.setAttribute('aria-pressed', isEnabled ? 'true' : 'false');
        // Update accessible name to reflect the action (Disable or Enable)
        const action = isEnabled ? 'Disable' : 'Enable';
        dom.enableToggleButton.setAttribute('aria-label', `${action} ${extensionInfo?.name || 'extension'}`);
        log(`Enable toggle button updated to state: ${isEnabled}`);
    }

    /** Safely sets the textContent of an element, handling null/undefined */
    function setText(element, text) {
        if (element) {
            // Use empty string as fallback for null or undefined text
            element.textContent = text ?? '';
        }
    }

    /** Updates a link's href and text, handling empty/null URLs gracefully */
    function updateLink(element, url, text) {
        if (!element) return; // Ensure link element exists
        const safeText = text || url || 'N/A'; // Determine display text (use URL if text is missing, else 'N/A')

        if (url) {
            // If URL exists, set href and make it look like an active link
            element.href = url;
            element.textContent = safeText;
            element.removeAttribute('aria-disabled'); // Ensure not marked as disabled
            element.style.opacity = '';             // Remove potential disabled styles
            element.style.pointerEvents = '';
            element.setAttribute('target', '_blank'); // Assume external links open in new tab
            element.setAttribute('rel', 'noopener noreferrer'); // Security best practice
        } else {
            // If URL is missing, make it look like disabled text
            element.removeAttribute('href');          // Remove href attribute
            element.textContent = safeText;           // Show 'N/A' or similar
            element.setAttribute('aria-disabled', 'true'); // Mark as disabled for accessibility
            // Optional: Add inline styles for disabled appearance if CSS doesn't cover it
            element.style.opacity = '0.6';
            element.style.textDecoration = 'none';
            element.style.pointerEvents = 'none';     // Prevent clicks
        }
    }

    /** Sets the visibility of an element using the 'hidden' attribute */
    function setElementVisibility(element, visible) {
        if (!element) return; // Ensure element exists
        // The 'hidden' attribute is semantically correct for hiding/showing elements
        element.hidden = !visible;

        // Special handling for elements within aria-busy containers (skeleton loaders)
        // We might need to force visibility style if CSS relies on it.
        // This ensures content appears correctly when aria-busy becomes false.
        const busyParent = element.closest('[aria-busy]');
        if (busyParent) {
            element.style.visibility = visible ? 'visible' : 'hidden';
            // Optional: Fade-in effect could be handled here or purely in CSS
            // element.style.opacity = visible ? '1' : '0';
        }
    }

    /** Displays a temporary toast notification */
    function showToast(message, type = 'info', duration = TOAST_DEFAULT_DURATION) {
        if (!dom.toastContainer) {
            error("Toast container not found, cannot show toast:", message);
            return;
        }
        log(`Showing toast (${type}): ${message}`);

        // Create the toast element
        const toast = document.createElement('div');
        toast.className = `toast ${type}`; // Apply type class (info, success, warning, error)
        toast.textContent = message;
        // ARIA attributes for screen readers
        toast.setAttribute('role', 'status'); // Use 'status' for polite announcements
        toast.setAttribute('aria-live', 'polite');

        // Add toast to the container
        dom.toastContainer.appendChild(toast);

        // Trigger fade-in animation (using requestAnimationFrame ensures CSS transition applies)
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });

        // Automatically remove the toast after the specified duration
        setTimeout(() => {
            toast.classList.remove('show'); // Trigger fade-out animation
            // Remove the element from the DOM *after* the fade-out transition completes
            toast.addEventListener('transitionend', () => {
                if (toast.parentElement) { // Check if still attached before removing
                    toast.remove();
                    log("Toast removed.");
                }
            }, { once: true }); // Ensure listener runs only once
        }, duration);
    }

    // == Start ==
    // Initialize the application when the DOM is ready.
    // Using 'DOMContentLoaded' is generally preferred and more reliable than checking readyState.
    if (document.readyState === 'loading') {
        // If DOM is still loading, wait for it to finish
        document.addEventListener('DOMContentLoaded', initializeApp);
    } else {
        // If DOM is already loaded (e.g., script loaded async/defer late), run immediately
        // Double-check essential elements exist as a safeguard
        if (getElem('initial-loading-indicator') && getQuery('.content-area')) {
            initializeApp();
        } else {
            // Fallback retry mechanism if elements aren't found immediately after DOMContentLoaded
            let retries = 5;
            const retryInterval = setInterval(() => {
                log(`DOM ready, but core elements might be missing. Retrying init... (${retries} left)`);
                if (getElem('initial-loading-indicator') && getQuery('.content-area')) {
                    clearInterval(retryInterval); // Stop retrying once elements are found
                    initializeApp();
                } else if (--retries <= 0) {
                    // Stop retrying after several attempts
                    clearInterval(retryInterval);
                    error("Failed to initialize: Core DOM elements not found after retries.");
                    // Display error to user as the page cannot function
                    displayGlobalError("Failed to load page components. Please try reloading.");
                }
            }, 100); // Retry every 100ms
        }
    }

})(); // End IIFE
