// --- Constants ---
const INITIAL_PERMISSIONS_LIMIT = 5; // Number of permissions to show initially

// --- Utility Functions ---

/**
 * Creates an HTML element with specified tag, attributes, and content.
 * @param {string} tag - The HTML tag name.
 * @param {object} [attributes={}] - An object of attributes (e.g., { className: 'foo', id: 'bar', 'data-id': 123 }).
 * @param {string|Node|Array<string|Node>|null} [content=null] - The content to append (string, Node, or array).
 * @returns {HTMLElement} The created element.
 */
const createElement = (tag, attributes = {}, content = null) => {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(attr => {
        const value = attributes[attr];
        try {
            if (attr === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (attr.startsWith('on') && typeof value === 'function') {
                element.addEventListener(attr.substring(2).toLowerCase(), value);
            } else if (value !== null && value !== undefined) {
                // Use setAttribute for common string attributes and ARIA for consistency
                const booleanAttributes = ['disabled', 'checked', 'selected', 'readonly', 'required', 'multiple'];
                if (['className', 'id', 'src', 'alt', 'href', 'target', 'type', 'placeholder', 'title', 'role', 'aria-controls', 'aria-labelledby', 'aria-modal', 'aria-label', 'aria-live', 'aria-hidden', 'aria-expanded'].includes(attr) || attr.startsWith('data-')) {
                    element.setAttribute(attr === 'className' ? 'class' : attr, value);
                } else if (booleanAttributes.includes(attr)) {
                     if (value) { // Set boolean attributes only if true
                         element.setAttribute(attr, '');
                     }
                 } else {
                    element[attr] = value; // For other properties like textContent, value, etc.
                }
            }
        } catch (error) {
            console.warn(`Skipping invalid attribute assignment: ${attr} = ${value}`, error);
        }
    });

    // Append content
    if (content) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(child => {
                if (child instanceof Node) element.appendChild(child);
                else if (typeof child === 'string') element.appendChild(document.createTextNode(child));
            });
        }
    }
    return element;
};

/**
 * Copies text to the clipboard and provides visual feedback on a button.
 * @param {string} text - The text to copy.
 * @param {HTMLButtonElement} buttonElement - The button that triggered the copy.
 */
const copyToClipboard = (text, buttonElement) => {
    if (!navigator.clipboard) {
        showToast('Clipboard API not available in this context.', 'error');
        console.error('Clipboard API not available.');
        return;
    }
    navigator.clipboard.writeText(text).then(() => {
        const originalText = buttonElement.textContent;
        // Check if button still exists before changing it
        if (document.body.contains(buttonElement)) {
            buttonElement.textContent = 'Copied!';
            buttonElement.disabled = true; // Use attribute for boolean
            setTimeout(() => {
                // Check again before reverting
                if (document.body.contains(buttonElement)) {
                    buttonElement.textContent = originalText;
                    buttonElement.disabled = false; // Use attribute for boolean
                }
            }, 1500);
        }
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy text to clipboard', 'error');
    });
};

/**
 * Displays a short-lived toast notification.
 * @param {string} message - The message to display.
 * @param {'info'|'success'|'error'} [type='info'] - The type of toast.
 * @param {number} [duration=3000] - How long the toast stays visible (in ms).
 */
const showToast = (message, type = 'info', duration = 3000) => {
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();

    const toast = createElement('div', {
        id: 'toast-notification',
        className: `toast-notification toast-${type}`,
        // Basic positioning styles - rely on CSS for full styling
        style: { position: 'fixed', bottom: '20px', right: '20px', zIndex: '10000', opacity: '1', transition: 'opacity 0.5s ease-out' },
        textContent: message,
        role: 'alert', // Important for screen readers
        'aria-live': 'assertive' // Announce immediately
    });
    // Basic styling fallback (should be primarily handled by CSS)
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = 'var(--radius-md, 8px)';
    toast.style.color = 'white';
    toast.style.backgroundColor = type === 'error' ? '#d9534f' : (type === 'success' ? '#5cb85c' : '#5bc0de'); // Example colors
    toast.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { if (document.body.contains(toast)) toast.remove(); }, 500); // Wait for fade out
    }, duration);
};

/**
 * Capitalizes the first letter of a string.
 * @param {string} string - The input string.
 * @returns {string} The capitalized string or the original input if not a valid string.
 */
const capitalizeFirstLetter = (string) => {
    if (typeof string !== 'string' || string.length === 0) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
};

/**
 * Displays an error message within a specified container or the body.
 * @param {string} message - The error message.
 * @param {HTMLElement|null} container - The container to prepend the error to. Defaults to document.body.
 */
const showError = (message, container) => {
    const targetContainer = container && document.body.contains(container) ? container : document.body;
    // Remove existing error messages within the target container only
    const existingError = targetContainer.querySelector('.error-box');
    if (existingError) existingError.remove();

    const errorBox = createElement('div', { className: 'error-box', role: 'alert' });
    const errorElement = createElement('p');
    // Provide alt text for the icon for accessibility
    errorElement.innerHTML = `<img src="../../public/icons/svg/error.svg" alt="Error:" class="icon error-icon"> ${message}`;
    errorBox.appendChild(errorElement);

    // Prepend error for visibility
    targetContainer.insertBefore(errorBox, targetContainer.firstChild);

    // Show non-intrusive toast as well
    showToast(message, 'error', 5000); // Longer duration for errors
    console.error("Error Displayed:", message); // Log for debugging
};


// --- Core UI Rendering ---

/**
 * Fetches and displays the extension details. Main entry point.
 */
const showExtensionDetails = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const extensionId = urlParams.get('id');
    const extensionDetailsContainer = document.getElementById('extension-details');

    // --- Critical Pre-checks ---
    if (!extensionDetailsContainer) {
        console.error('Fatal Error: The #extension-details container is missing.');
        document.body.innerHTML = '<p style="color: red; padding: 20px; font-family: sans-serif;">Error: Cannot display details. HTML structure is broken.</p>';
        return;
    }
    extensionDetailsContainer.innerHTML = ''; // Clear

    if (!extensionId) {
        showError('No extension ID provided in the URL query parameter (e.g., ?id=...).', extensionDetailsContainer);
        return;
    }

    // --- Show Loading Indicator ---
    const loadingElement = createElement('div', { className: 'loading-indicator', role: 'status', 'aria-live': 'polite' });
    loadingElement.innerHTML = '<div class="spinner" aria-hidden="true"></div><p class="loading-placeholder">Loading Extension Details...</p>';
    extensionDetailsContainer.appendChild(loadingElement);

    // --- Check for API Availability ---
    if (!chrome?.management?.get) {
         showError('Chrome Management API is not available. This page might not work correctly outside of an extension context.', extensionDetailsContainer);
         if(loadingElement.parentNode === extensionDetailsContainer) extensionDetailsContainer.removeChild(loadingElement); // Remove loading indicator
         return;
    }

    // --- Fetch Extension Data ---
    try {
        chrome.management.get(extensionId, (extension) => {
            // Remove Loading Indicator (check if still present)
             if(loadingElement.parentNode === extensionDetailsContainer) {
                extensionDetailsContainer.removeChild(loadingElement);
             }

            // Handle API Errors
            if (chrome.runtime.lastError) {
                showError(`Error retrieving extension details: ${chrome.runtime.lastError.message}. Please ensure the ID is correct and the extension is installed.`, extensionDetailsContainer);
                return;
            }
            if (!extension) {
                showError(`Extension with ID "${extensionId}" not found. It might have been uninstalled or the ID is incorrect.`, extensionDetailsContainer);
                return;
            }

            // --- Render the UI ---
            // Clear container before adding structured content
            extensionDetailsContainer.innerHTML = '';

            // 1. Create Top Bar (Sticky - requires CSS)
            createTopBar(extension, extensionDetailsContainer);

            // 2. Create Main Content Area (Scrollable content below top bar)
            createMainContent(extension, extensionDetailsContainer);

        });
    } catch (error) {
        console.error("Error calling chrome.management.get:", error);
         if(loadingElement.parentNode === extensionDetailsContainer) {
             extensionDetailsContainer.removeChild(loadingElement);
         }
        showError(`An unexpected error occurred while trying to fetch extension details: ${error.message}`, extensionDetailsContainer);
    }
};

/**
 * Creates the top bar containing icon, name, and action buttons.
 * Requires CSS for sticky positioning and styling.
 * @param {chrome.management.ExtensionInfo} extension - The extension data.
 * @param {HTMLElement} container - The main container to append the top bar to.
 */
const createTopBar = (extension, container) => {
    const topBar = createElement('div', { className: 'details-topbar' }); // Class for CSS targeting

    // Left side: Icon and Name
    const leftSide = createElement('div', { className: 'topbar-left' });
    if (extension.icons && extension.icons.length > 0) {
        // Find largest icon (simple heuristic: last one or check size property if available)
        const bestIcon = extension.icons.reduce((prev, current) => (current.size > prev.size ? current : prev), extension.icons[0]);
        leftSide.appendChild(createElement('img', {
            src: bestIcon.url,
            alt: '', // Decorative icon
            className: 'extension-icon-topbar' // Class for CSS sizing
        }));
    }
    leftSide.appendChild(createElement('h2', { className: 'extension-name-topbar', textContent: extension.name }));
    topBar.appendChild(leftSide);

    // Right side: Action Buttons (if not the manager extension itself)
    const currentExtensionId = chrome.runtime.id; // Get this manager's ID
    if (extension.id !== currentExtensionId) {
        const rightSide = createElement('div', { className: 'topbar-right button-container' });

        const enableDisableButton = createElement('button', {
            id: 'enable-disable-btn',
            className: extension.enabled ? 'primary disable-button' : 'primary enable-button', // Classes for state styling
            textContent: extension.enabled ? 'Disable' : 'Enable',
            'data-extension-id': extension.id, // Store ID for handler if needed
            onclick: () => toggleExtensionStatus(extension.id, !extension.enabled, container) // Pass main container for errors
        });
        rightSide.appendChild(enableDisableButton);

        const uninstallButton = createElement('button', {
            id: 'uninstall-btn',
            className: 'secondary danger-button', // Style as destructive action
            textContent: 'Uninstall',
            onclick: () => uninstallExtension(extension.id, extension.name)
        });
        rightSide.appendChild(uninstallButton);
        topBar.appendChild(rightSide);
    } else {
        // Optional: Indicate that this is the manager extension
         const rightSide = createElement('div', { className: 'topbar-right' });
         // Add a subtle indicator, styled via CSS
         rightSide.appendChild(createElement('span', { className: 'info-message-inline self-indicator' }, '(This Manager)'));
         topBar.appendChild(rightSide);
    }

    container.appendChild(topBar); // Add the completed top bar to the page
};

/**
 * Creates the main content area below the top bar.
 * @param {chrome.management.ExtensionInfo} extension - The extension data.
 * @param {HTMLElement} container - The main container to append the content area to.
 */
const createMainContent = (extension, container) => {
    const mainContentArea = createElement('div', { className: 'details-main-content' }); // Wrapper for scrollable content

    // --- Info Section (ID, Update URL, Version, Status, etc.) ---
    const infoSection = createElement('div', { className: 'details-section info-section' });

    // ID with Copy Button Inline
    const idLine = createElement('p', { className: 'detail-line detail-id' }); // Add classes for styling
    idLine.appendChild(createElement('img', { src: '../../public/icons/svg/id.svg', alt: '', className: 'icon' }));
    idLine.appendChild(document.createTextNode(' ID: '));
    const idCode = createElement('code', { className: 'extension-id', textContent: extension.id });
    idLine.appendChild(idCode);
    const copyButton = createElement('button', {
        className: 'copy-id-btn subtle-button',
        title: 'Copy Extension ID',
        textContent: 'Copy',
        'aria-label': 'Copy extension ID',
        onclick: (e) => copyToClipboard(extension.id, e.target)
    });
    idLine.appendChild(copyButton); // Append button right after code
    infoSection.appendChild(idLine);

    // Update URL (Formatted like ID)
    if (extension.updateUrl) {
        const updateUrlLine = createElement('p', { className: 'detail-line detail-update-url' });
        updateUrlLine.appendChild(createElement('img', { src: '../../public/icons/svg/update.svg', alt: '', className: 'icon' }));
        updateUrlLine.appendChild(document.createTextNode(' Update URL: '));
        // Truncate long URLs for display, show full in title
        const displayUrl = extension.updateUrl.length > 80 ? extension.updateUrl.substring(0, 77) + '...' : extension.updateUrl;
        updateUrlLine.appendChild(createElement('code', {
            className: 'extension-update-url',
            textContent: displayUrl,
            title: extension.updateUrl // Show full URL on hover
         }));
        infoSection.appendChild(updateUrlLine);
    }

    // Version, Type, Install Type, Manifest
    let typeInfo = extension.type ? capitalizeFirstLetter(extension.type) : 'N/A';
    let installInfo = extension.installType ? capitalizeFirstLetter(extension.installType) : 'N/A';
    const versionElement = createElement('p', { className: 'detail-line detail-version' });
    // Use text nodes and spans for better structure/styling than innerHTML if needed
    versionElement.appendChild(createElement('img', { src: '../../public/icons/svg/info.svg', alt: '', className: 'icon' }));
    versionElement.appendChild(document.createTextNode(` Version: ${extension.version || 'N/A'}${extension.manifestVersion ? ` (Manifest v${extension.manifestVersion})` : ''} | Type: ${typeInfo} | Install: ${installInfo}`));
    infoSection.appendChild(versionElement);

    // Enabled Status
    const statusElement = createElement('p', { id: 'enabled-status', className: 'detail-line detail-status' });
    statusElement.appendChild(createElement('img', { src: '../../public/icons/svg/status.svg', alt: '', className: 'icon' }));
    statusElement.appendChild(document.createTextNode(' Status: '));
    statusElement.appendChild(createElement('span', { className: 'status-text' }, extension.enabled ? 'Enabled' : 'Disabled'));
    infoSection.appendChild(statusElement); 
    

    mainContentArea.appendChild(infoSection);

    // --- Description Section ---
    if (extension.description) { // Only show if description exists
        const descSection = createElement('div', { className: 'details-section description-section' });
        descSection.appendChild(createElement('h3', {}, 'Description')); // Add heading
        const descElement = createElement('p', { className: 'description' });
        // Using textContent is safer than innerHTML if description could contain HTML
        descElement.textContent = extension.description;
        // Or keep innerHTML if you trust the source or need basic formatting from it
        // descElement.innerHTML = `<img src="icons/description.svg" alt="" class="icon"> ${extension.description}`;
        descSection.appendChild(descElement);
        mainContentArea.appendChild(descSection);
    }

    // --- Links Section (Homepage, Store, Options) ---
    const linksSection = createElement('div', { className: 'details-section links-section' });
    let hasLinks = false;
    const webStoreBaseUrl = 'https://chromewebstore.google.com/detail/';
    let webStoreLink = null;
    // Determine if it's likely a Web Store extension
    const isLikelyWebStoreExtension = extension.updateUrl?.includes('google.com/update') || /^[a-z]{32}$/.test(extension.id);
    if (isLikelyWebStoreExtension) webStoreLink = `${webStoreBaseUrl}${extension.id}`;

    // Homepage Link (Conditional: only if exists AND differs from store link)
    if (extension.homepageUrl && extension.homepageUrl !== webStoreLink) {
        const homepageElement = createElement('p', {className: 'detail-line detail-link'});
        homepageElement.innerHTML = `<img src="../../public/icons/svg/link.svg" alt="" class="icon"> Homepage: `;
        homepageElement.appendChild(createElement('a', { href: extension.homepageUrl, target: '_blank', rel: 'noopener noreferrer' }, extension.homepageUrl));
        linksSection.appendChild(homepageElement);
        hasLinks = true;
    }
    // Chrome Web Store Link
    if (webStoreLink) {
        const storeElement = createElement('p', {className: 'detail-line detail-link'});
        storeElement.innerHTML = `<img src="../../public/icons/svg/store.svg" alt="" class="icon"> Store: `;
        storeElement.appendChild(createElement('a', { href: webStoreLink, target: '_blank', rel: 'noopener noreferrer' }, 'View in Chrome Web Store'));
        linksSection.appendChild(storeElement);
        hasLinks = true;
    }
    // Options Link
    if (extension.optionsUrl) {
        const optionsElement = createElement('p', {className: 'detail-line detail-link'});
        optionsElement.innerHTML = `<img src="../../public/icons/svg/settings.svg" alt="" class="icon"> Options: `;
        optionsElement.appendChild(createElement('a', { href: extension.optionsUrl, target: '_blank' }, 'Open Options Page'));
        linksSection.appendChild(optionsElement);
        hasLinks = true;
    }
    // Only append links section if it contains any links
    if (hasLinks) {
         linksSection.insertBefore(createElement('h3', {}, 'Links'), linksSection.firstChild); // Add heading
        mainContentArea.appendChild(linksSection);
    }

    // --- Permissions Section ---
    const permissionsSection = createPermissionsSection(extension.permissions || [], extension.hostPermissions || []);
    mainContentArea.appendChild(permissionsSection);

    // --- Add the completed main content area to the page ---
    container.appendChild(mainContentArea);
};


// --- Permissions Section Logic ---

/**
 * Creates the permissions section with a "Show More/Less" toggle.
 * @param {string[]} permissions - Array of API permissions.
 * @param {string[]} hostPermissions - Array of host permissions.
 * @returns {HTMLElement} The permissions section element.
 */
const createPermissionsSection = (permissions, hostPermissions) => {
    const permissionsBox = createElement('div', { className: 'details-section permissions-box' });
    permissionsBox.appendChild(createElement('h3', {}, 'Permissions & Host Access'));

    const allPermissions = [...new Set([...permissions, ...hostPermissions])].sort((a, b) => a.localeCompare(b));
    const permissionCount = allPermissions.length;

    if (permissionCount === 0) {
        permissionsBox.appendChild(createElement('p', { className: 'info-message' }, 'This extension requests no special permissions.'));
        return permissionsBox;
    }

    // Container for the grid and toggle button
    const permissionsContent = createElement('div', { className: 'permissions-content' });

    // Add search box placeholder (if CSS allows it to be displayed)
    // Note: Search logic might need adjustment if interacting with Show More/Less
    addPermissionSearchBox(permissionsContent); // Pass the content container

    const permissionsGrid = createElement('div', { id: 'permissions-grid', className: 'permissions-grid', role: 'list' });
    const permissionDetailsMap = getPermissionDetails();

    allPermissions.forEach((permission, index) => {
        const details = permissionDetailsMap[permission] || {
            description: hostPermissions.includes(permission) ? 'Allows reading/changing data on specified websites.' : 'No specific description available.',
            risk: hostPermissions.includes(permission) ? 'Medium' : 'Unknown'
        };
        const riskLevel = details.risk.toLowerCase();

        const permissionItem = createElement('div', {
            className: `permission-item risk-${riskLevel}`,
            role: 'listitem',
            'data-permission-name': permission.toLowerCase(),
            'data-permission-desc': details.description.toLowerCase(),
            // Initially hide items beyond the limit using a class
            style: { display: index >= INITIAL_PERMISSIONS_LIMIT ? 'none' : '' }, // Inline style for initial state
        });
        // Add hidden class for easier toggling if needed:
        if (index >= INITIAL_PERMISSIONS_LIMIT) {
             permissionItem.classList.add('permission-item-hidden'); // Add class for toggle logic
        }


        const itemHeader = createElement('div', { className: 'permission-item-header' });
        itemHeader.appendChild(createElement('h4', { className: 'permission-name' }, permission));
        itemHeader.appendChild(createElement('span', { className: `permission-risk risk-${riskLevel}` }, riskLevel));
        permissionItem.appendChild(itemHeader);
        permissionItem.appendChild(createElement('p', { className: 'permission-description' }, details.description));

        permissionsGrid.appendChild(permissionItem);
    });

    permissionsContent.appendChild(permissionsGrid);

     // Add "Show More/Less" button only if needed
     if (permissionCount > INITIAL_PERMISSIONS_LIMIT) {
        const toggleButton = createElement('button', {
            id: 'permissions-toggle-btn',
            className: 'secondary permissions-toggle-button', // Use class for styling
            textContent: `Show All ${permissionCount} Permissions`,
            'aria-expanded': 'false', // Initially collapsed
            'aria-controls': 'permissions-grid', // Controls the grid
             onclick: togglePermissionsVisibility
        });
        permissionsContent.appendChild(toggleButton);
    }

    // "No results" message for search (initially hidden)
    const noResultsMessage = createElement('p', {
        id: 'no-permissions-found',
        style: { display: 'none' },
        className: 'info-message no-results'
    }, 'No permissions match your search.');
    permissionsContent.appendChild(noResultsMessage);


    permissionsBox.appendChild(permissionsContent);
    return permissionsBox;
};

/**
 * Event handler for the "Show More/Less" permissions button.
 * @param {Event} event - The click event.
 */
const togglePermissionsVisibility = (event) => {
    const button = event.target;
    const grid = document.getElementById('permissions-grid');
    if (!grid || !button) return;

    const isExpanded = button.getAttribute('aria-expanded') === 'true';
    const items = grid.querySelectorAll('.permission-item'); // Get all items

    items.forEach((item, index) => {
        if (index >= INITIAL_PERMISSIONS_LIMIT) {
            // Toggle display based on the NEW desired state (opposite of current isExpanded)
            item.style.display = isExpanded ? 'none' : ''; // If currently expanded, hide them; otherwise show them.
            // Optionally toggle a class as well
            if (isExpanded) {
                item.classList.add('permission-item-hidden');
            } else {
                item.classList.remove('permission-item-hidden');
            }
        }
    });

    // Update button text and ARIA state
    button.setAttribute('aria-expanded', !isExpanded);
    button.textContent = isExpanded ? `Show All ${items.length} Permissions` : 'Show Fewer Permissions';
};


/**
 * Adds a search input field to filter permissions.
 * Note: Currently hidden by provided CSS. Assumes CSS will show it if desired.
 * @param {HTMLElement} container - The container to add the search box to.
 */
const addPermissionSearchBox = (container) => {
    const searchContainer = createElement('div', { className: 'permission-search-container' });

    const searchInput = createElement('input', {
        type: 'search',
        placeholder: 'Search for permissions...',
        id: 'permission-search',
        className: 'permission-search-input', // Add class for styling
        oninput: filterPermissions, // Use oninput for immediate feedback
        'aria-controls': 'permissions-grid',
        'aria-label': 'Filter permissions'
    });

    const clearButton = createElement('button', {
        className: 'clear-search subtle-button', // Style as needed
        textContent: '×', // Clear symbol
        title: 'Clear search',
        style: { display: 'none' }, // Initially hidden
        'aria-label': 'Clear permission search',
        onclick: () => {
            searchInput.value = '';
            filterPermissions(); // Update list
            clearButton.style.display = 'none';
            searchInput.focus();
        }
    });

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearButton);

    // Insert before the grid (or handle placement with CSS)
    // If container doesn't have grid yet, this needs adjustment or call later.
    const grid = container.querySelector('#permissions-grid');
    if (grid) {
         container.insertBefore(searchContainer, grid);
    } else {
         container.appendChild(searchContainer); // Fallback append
    }


    // Show/hide clear button based on input value
    searchInput.addEventListener('input', () => {
        clearButton.style.display = searchInput.value ? 'inline-block' : 'none';
    });
};

/**
 * Filters the displayed permissions based on the search input.
 * Note: Interaction with Show More/Less needs careful consideration if search is enabled.
 * This version filters ALL items, overriding the show/less state for matches.
 */
const filterPermissions = () => {
    const input = document.getElementById('permission-search');
    const filter = input?.value?.toLowerCase() ?? '';
    const grid = document.getElementById('permissions-grid');
    const items = grid?.getElementsByClassName('permission-item');
    const noResults = document.getElementById('no-permissions-found');
    const toggleButton = document.getElementById('permissions-toggle-btn'); // Get toggle button


    if (!items || !noResults) {
         console.warn("Permissions grid/items or no-results message not found for filtering.");
         return;
    }

    let visibleCount = 0;
    let hasFilter = filter.length > 0;

    Array.from(items).forEach(item => {
        const permName = item.getAttribute('data-permission-name') ?? '';
        const permDesc = item.getAttribute('data-permission-desc') ?? '';
        const isMatch = !hasFilter || permName.includes(filter) || permDesc.includes(filter);

        if (isMatch) {
            item.style.display = ''; // Show if matches OR if no filter
            item.setAttribute('aria-hidden', 'false');
            visibleCount++;
        } else {
            item.style.display = 'none'; // Hide if doesn't match AND filter is active
            item.setAttribute('aria-hidden', 'true');
        }
    });

    // Show/hide "no results" message based ONLY on filter results
    noResults.style.display = visibleCount === 0 && hasFilter ? 'block' : 'none';

     // If filtering, potentially hide or disable the "Show More/Less" button
     // as the filter now dictates visibility. Or adjust its text.
     if (toggleButton) {
         toggleButton.style.display = hasFilter ? 'none' : ''; // Hide toggle when filtering
         // Reset toggle state if filter is cleared?
         if (!hasFilter) {
            // Re-apply initial hide logic if needed, or revert to saved state
            const isExpanded = toggleButton.getAttribute('aria-expanded') === 'true';
             Array.from(items).forEach((item, index) => {
                 if (index >= INITIAL_PERMISSIONS_LIMIT && !isExpanded) {
                     item.style.display = 'none';
                 }
             });
         }
     }
};


/**
 * Provides descriptions and risk levels for known Chrome extension permissions.
 * Keep this updated or consider fetching dynamically if possible.
 * @returns {Object} A map of permission names to { description, risk } objects.
 */
const getPermissionDetails = () => {
    // (Using the extensive list from the previous response - keeping it folded for brevity here)
    // Risk Levels: Low, Medium, High, Unknown
    return {
        // Low Risk
        "activeTab": { description: "Grants temporary access to the currently active tab when the user invokes the extension.", risk: "Low" },
        "alarms": { description: "Schedule code to run periodically or at a specific time.", risk: "Low" },
        "bookmarks": { description: "Read and modify bookmarks.", risk: "Low" },
        "clipboardRead": { description: "Read data from the system clipboard (requires user interaction for web pages).", risk: "Low" },
        "contextMenus": { description: "Add items to the browser's context menu.", risk: "Low" },
        "cookies": { description: "Read, modify, and delete browser cookies for allowed domains.", risk: "Low" },
        "declarativeContent": { description: "Show extension actions based on page content without reading the content.", risk: "Low" },
        "downloads.open": { description: "Open downloaded files.", risk: "Low" },
        "favicon": { description: "Access website favicons (often requires host permissions too).", risk: "Low" },
        "idle": { description: "Detect when the user's machine is idle.", risk: "Low" },
        "notifications": { description: "Create and display system notifications.", risk: "Low" },
        "offscreen": { description: "Run code in a hidden document to use DOM APIs otherwise unavailable.", risk: "Low" },
        "readingList": { description: "Read and modify the browser's reading list.", risk: "Low" },
        "sidePanel": { description: "Open and manage a side panel in the browser UI.", risk: "Low" },
        "storage": { description: "Store and retrieve extension data locally.", risk: "Low" },
        "tabGroups": { description: "Organize tabs into groups.", risk: "Low" },
        "topSites": { description: "Access the list of most visited sites.", risk: "Low" },
        "tts": { description: "Use the browser's text-to-speech engine.", risk: "Low" },
        "unlimitedStorage": { description: "Request unlimited local storage space (still subject to browser limits).", risk: "Low" },
        "wallpaper": { description: "Change the ChromeOS wallpaper.", risk: "Low" },

        // Medium Risk
        "accessibilityFeatures.read": { description: "Read accessibility settings.", risk: "Medium" },
        "accessibilityFeatures.modify": { description: "Modify accessibility settings.", risk: "Medium" },
        "BrowseData": { description: "Clear Browse data like history, cache, cookies.", risk: "Medium" },
        "clipboardWrite": { description: "Write data to the system clipboard.", risk: "Medium" },
        "contentSettings": { description: "Control website features like cookies, JavaScript, plugins.", risk: "Medium" },
        "debugger": { description: "Attach to browser tabs for debugging purposes, potentially observing network traffic and manipulating the page.", risk: "Medium" },
        "declarativeNetRequest": { description: "Block or modify network requests without intercepting content (using predefined rules).", risk: "Medium" },
        "downloads": { description: "Manage downloads (start, monitor, cancel, search).", risk: "Medium" },
        "fontSettings": { description: "Read and modify browser font settings.", risk: "Medium" },
        "geolocation": { description: "Access the user's physical location (requires user prompt per origin).", risk: "Medium" },
        "history": { description: "Read and modify Browse history.", risk: "Medium" },
        "identity": { description: "Access user identity information (e.g., login status, requires user consent).", risk: "Medium" },
        "identity.email": { description: "Access the user's email address (requires user consent).", risk: "Medium" },
        "management": { description: "Manage installed extensions and apps (enable, disable, uninstall, get info).", risk: "Medium" },
        "pageCapture": { description: "Save web pages as MHTML.", risk: "Medium" },
        "privacy": { description: "Read and modify privacy-related browser settings.", risk: "Medium" },
        "proxy": { description: "Configure and manage browser proxy settings.", risk: "Medium" },
        "scripting": { description: "Inject scripts and CSS into web pages (requires host permissions or activeTab).", risk: "Medium" },
        "sessions": { description: "Access and restore recently closed tabs and sessions.", risk: "Medium" },
        "system.cpu": { description: "Read CPU information.", risk: "Medium" },
        "system.display": { description: "Read display metadata.", risk: "Medium" },
        "system.memory": { description: "Read memory information.", risk: "Medium" },
        "system.storage": { description: "Read storage device information.", risk: "Medium" },
        "tabCapture": { description: "Capture audio and video streams from tabs.", risk: "Medium" },
        "tabs": { description: "Access and manipulate browser tabs (URL, title, create, close, query, etc.). Essential for many extensions but powerful.", risk: "Medium" },
        "webNavigation": { description: "Receive notifications about navigation events.", risk: "Medium" },

        // High Risk
        "background": { description: "Allows the extension to run a script persistently in the background (via Service Worker in MV3).", risk: "High" },
        "declarativeNetRequestWithHostAccess": { description: "Block or modify network requests, including access based on requested domain (requires host permissions).", risk: "High" },
        "declarativeNetRequestFeedback": { description: "Provides feedback on declarativeNetRequest rules matching (can potentially leak Browse info).", risk: "High" },
        "desktopCapture": { description: "Capture screen content, individual windows, or tabs (requires user prompt each time).", risk: "High" },
        "nativeMessaging": { description: "Exchange messages with native applications installed on the user's computer.", risk: "High" },
        "power": { description: "Override system power-saving settings.", risk: "High" },
        "webRequest": { description: "Observe and analyze network traffic; intercept, block, or modify requests in-flight (Limited availability in MV3, mainly for monitoring).", risk: "High" },
        "webRequestBlocking": { description: "Block or modify network requests synchronously (Deprecated in MV3, declarativeNetRequest preferred).", risk: "High" },
        "audio": { description: "Access audio input/output devices (requires user prompt).", risk: "High" },
        "bluetooth": { description: "Discover and communicate with Bluetooth devices (requires user interaction/prompt).", risk: "High" },
        "hid": { description: "Communicate with connected Human Interface Devices (keyboards, gamepads - requires user selection).", risk: "High" },
        "serial": { description: "Communicate with devices connected via serial port (requires user selection).", risk: "High" },
        "usb": { description: "Communicate with connected USB devices (requires user selection).", risk: "High" },
        "vpnProvider": { description: "Implement a VPN client (ChromeOS only).", risk: "High" },
        "certificateProvider": { description: "Expose certificates to the platform.", risk: "High" },
        "enterprise.deviceAttributes": { description: "Read device attributes in managed environments.", risk: "High" },
        "enterprise.hardwarePlatform": { description: "Read hardware platform info in managed environments.", risk: "High" },
        "enterprise.networkingAttributes": { description: "Read network details in managed environments.", risk: "High" },
        "enterprise.platformKeys": { description: "Access client certificates managed by the OS in managed environments.", risk: "High" },
        "platformKeys": { description: "Access client certificates managed by the OS.", risk: "High" },
        "printerProvider": { description: "Implement print drivers (ChromeOS only).", risk: "High" }
    };
};

// --- Action Handlers ---

/**
 * Toggles the enabled status of an extension.
 * @param {string} extensionId - The ID of the extension to toggle.
 * @param {boolean} enable - True to enable, false to disable.
 * @param {HTMLElement} container - The main container for displaying potential errors.
 */
const toggleExtensionStatus = (extensionId, enable, container) => {
    // Find button and status elements reliably, even if inside top bar / main content
    const button = document.getElementById('enable-disable-btn');
    const statusElement = document.getElementById('enabled-status');
    const statusTextSpan = statusElement?.querySelector('.status-text');

    // Disable button and show loading state
    if (button && document.body.contains(button)) {
        button.disabled = true;
        button.textContent = enable ? 'Enabling...' : 'Disabling...';
    }

    chrome.management.setEnabled(extensionId, enable, () => {
        // Check elements exist before updating after async call
        const buttonExists = button && document.body.contains(button);
        const statusTextSpanExists = statusTextSpan && document.body.contains(statusTextSpan);

        if (chrome.runtime.lastError) {
            showError(`Failed to ${enable ? 'enable' : 'disable'} extension: ${chrome.runtime.lastError.message}`, container); // Use main container context
            if (buttonExists) {
                button.disabled = false;
                button.textContent = enable ? 'Enable' : 'Disable'; // Revert text on error
            }
            return;
        }

        // Update status text
        if (statusTextSpanExists) {
            statusTextSpan.textContent = enable ? 'Enabled' : 'Disabled';
        }

        // Update button text, style (classes), and re-enable
        if (buttonExists) {
            button.textContent = enable ? 'Disable' : 'Enable';
            button.classList.remove(enable ? 'enable-button' : 'disable-button');
            button.classList.add(enable ? 'disable-button' : 'enable-button');
            button.disabled = false;
        }

        showToast(`Extension ${enable ? 'enabled' : 'disabled'} successfully.`, 'success');
        console.log(`Extension ${extensionId} ${enable ? 'enabled' : 'disabled'}.`);
    });
};

/**
 * Initiates the uninstall process for an extension using a confirmation modal.
 * @param {string} extensionId - The ID of the extension to uninstall.
 * @param {string} extensionName - The name of the extension for the confirmation message.
 */
const uninstallExtension = (extensionId, extensionName) => {
    // Prevent multiple modals
    if (document.getElementById('confirmation-modal-overlay')) return;

    const modalOverlay = createElement('div', {
        id: 'confirmation-modal-overlay',
        className: 'modal-overlay' // Style with CSS
    });

    const modalContent = createElement('div', {
        className: 'modal-content', // Style with CSS
        role: 'dialog',
        'aria-labelledby': 'modal-title',
        'aria-modal': 'true'
    });

    modalContent.appendChild(createElement('h3', { id: 'modal-title', textContent: 'Confirm Uninstall' }));
    modalContent.appendChild(createElement('p', { textContent:
        `Are you sure you want to uninstall "${extensionName || extensionId}"? This action cannot be undone.`
    }));

    const buttonContainer = createElement('div', { className: 'modal-actions' });

    // Cancel button
    const cancelBtn = createElement('button', {
        className: 'secondary cancel-button',
        textContent: 'Cancel',
        onclick: () => {
            // --- START: Graceful close transition ---
            modalOverlay.classList.remove('show'); // Remove show for fade-out
            modalOverlay.addEventListener('transitionend', () => {
                if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay);
            }, { once: true }); // Remove listener after transition
            // --- END: Graceful close transition ---
         }
    });
    buttonContainer.appendChild(cancelBtn);

    // Confirm button
    const confirmBtn = createElement('button', {
        className: 'primary danger-button confirm-button',
        textContent: 'Uninstall',
        onclick: () => {
            // Show loading state on confirm button
            confirmBtn.textContent = 'Uninstalling...';
            confirmBtn.disabled = true;
            cancelBtn.disabled = true; // Disable cancel too [cite: 201]

            // Use showConfirmDialog: false as we have our own modal
            chrome.management.uninstall(extensionId, { showConfirmDialog: false }, () => {
                 // Always try to remove overlay (gracefully)
                 modalOverlay.classList.remove('show'); // Start fade-out
                 modalOverlay.addEventListener('transitionend', () => {
                     if (document.body.contains(modalOverlay)) document.body.removeChild(modalOverlay);
                 }, { once: true });


                 if (chrome.runtime.lastError) {
                    const detailsContainer = document.getElementById('extension-details'); // Try to show error in main area
                    showError(`Failed to uninstall extension: ${chrome.runtime.lastError.message}`, detailsContainer);
                    // Note: Modal removal is handled above even on error.
                    return; 
                 }

                showToast(`"${extensionName || extensionId}" uninstalled successfully.`, 'success');
                // Redirect back to the main list page after a short delay
                setTimeout(() => {
                     window.location.href = '/popup.html'; // Adjust to your main extension list page [cite: 206]
                }, 1500); 
            }); 
        }
    });
    buttonContainer.appendChild(confirmBtn);

    modalContent.appendChild(buttonContainer);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);

    // --- FIX: Add the 'show' class after a short delay ---
    // Use setTimeout to allow the element to be added to the DOM first,
    // then add the class to trigger the CSS transition.
    setTimeout(() => {
        modalOverlay.classList.add('show');
    }, 10); // Small delay (10ms) is usually sufficient

    // Focus the confirm button for accessibility
    confirmBtn.focus();
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    try {
        showExtensionDetails();
    } catch (error) {
         console.error("Fatal error during initialization:", error);
         const body = document.body;
         if (body) { // Ensure body exists
            // Simple fallback error display
            body.innerHTML = `<p style="color: red; padding: 20px; font-family: sans-serif;">A critical error occurred while loading the page: ${error.message}</p>`;
         }
    }
});
