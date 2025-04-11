// Utility function to create elements with attributes and content
const createElement = (tag, attributes = {}, content = null) => {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(attr => {
        if (attr === 'style' && typeof attributes[attr] === 'object') {
            Object.assign(element.style, attributes[attr]);
        } else if (attr.startsWith('on') && typeof attributes[attr] === 'function') {
            element.addEventListener(attr.substring(2).toLowerCase(), attributes[attr]);
        } else if (attr === 'className' || attr === 'id' || attr === 'src' || attr === 'alt' || attr === 'href' || attr === 'target' || attr === 'type' || attr === 'placeholder' || attr.startsWith('data-')) {
            element.setAttribute(attr, attributes[attr]);
        } else {
            element[attr] = attributes[attr]; // For properties like textContent, innerHTML
        }
    });
    if (content) {
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        } else if (Array.isArray(content)) {
            content.forEach(child => {
                if (child instanceof Node) {
                    element.appendChild(child);
                } else if (typeof child === 'string') {
                    // Handle string in array by creating a text node
                    element.appendChild(document.createTextNode(child));
                }
            });
        }
    }
    return element;
};

// Function to copy text to clipboard
const copyToClipboard = (text, buttonElement) => {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = buttonElement.textContent;
        buttonElement.textContent = 'Copied!';
        buttonElement.disabled = true;
        setTimeout(() => {
            buttonElement.textContent = originalText;
            buttonElement.disabled = false;
        }, 1500); // Reset after 1.5 seconds
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy text to clipboard');
    });
};

// New: Toast notification system
const showToast = (message, type = 'info', duration = 3000) => {
    // Remove existing toast if present
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = createElement('div', {
        id: 'toast-notification',
        className: `toast-notification ${type}`,
        style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px 20px',
            borderRadius: '4px',
            backgroundColor: type === 'error' ? '#f44336' : '#4CAF50',
            color: 'white',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            zIndex: '9999',
            transition: 'opacity 0.3s'
        }
    }, message);

    document.body.appendChild(toast);

    // Fade out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, duration);
};

// Function to display extension details in the HTML container
const showExtensionDetails = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const extensionId = urlParams.get('id');
    const extensionDetailsContainer = document.getElementById('extension-details');

    if (!extensionDetailsContainer) {
        console.error('Fatal Error: The #extension-details container is missing in the HTML.');
        // Display a critical error message directly in the body if the container is missing
        document.body.innerHTML = '<p style="color: red; padding: 20px;">Error: Cannot display details. HTML structure is broken.</p>';
        return;
    }

    // Clear placeholder/previous content
    extensionDetailsContainer.innerHTML = '';

    if (!extensionId) {
        showError('No extension ID provided in the URL.', extensionDetailsContainer);
        return;
    }

    // Show loading indicator
    const loadingElement = createElement('div', { className: 'loading-indicator' });
    loadingElement.innerHTML = '<div class="spinner"></div><p>Loading extension details...</p>';
    extensionDetailsContainer.appendChild(loadingElement);

    chrome.management.get(extensionId, (extension) => {
        // Remove loading indicator
        extensionDetailsContainer.removeChild(loadingElement);

        if (chrome.runtime.lastError) {
            showError(`Error retrieving extension details: ${chrome.runtime.lastError.message}`, extensionDetailsContainer);
            return;
        }

        if (!extension) {
            showError('Extension not found. It might be uninstalled or the ID is incorrect.', extensionDetailsContainer);
            return;
        }

        // Create details content
        displayExtensionContent(extension, extensionDetailsContainer);
    });
};

// Separated function to display extension content (better separation of concerns)
const displayExtensionContent = (extension, container) => {
    // --- Basic Info ---
    container.appendChild(createElement('h2', {}, extension.name));
    if (extension.icons && extension.icons.length > 0) {
        const iconUrl = extension.icons.pop().url; // Get the last (usually largest) icon
        const iconElement = createElement('img', { src: iconUrl, alt: 'Extension Icon', style: { width: '48px', height: '48px', marginRight: '10px' } });
        container.insertBefore(iconElement, container.firstChild); // Add icon at the start
    }

    // ID with Copy Button
    const idLine = createElement('p');
    idLine.innerHTML = `<img src="icons/id.svg" alt="ID Icon" class="icon"> ID: <code style="padding: 0px 2px; border-radius: 3px;">${extension.id}</code>`;
    const copyButton = createElement('button', {
        className: 'copy-id-btn',
        title: 'Copy Extension ID',
        onclick: (e) => copyToClipboard(extension.id, e.target)
    }, 'Copy');
    idLine.appendChild(copyButton);
    container.appendChild(idLine);

    // Version, Type, Install Type, Manifest
    let typeInfo = capitalizeFirstLetter(extension.type);
    let installInfo = capitalizeFirstLetter(extension.installType);
    const infoElement = createElement('p');
    infoElement.innerHTML = `<img src="icons/info.svg" alt="Info Icon" class="icon"> Version: ${extension.version}${extension.manifestVersion ? ` (Manifest v${extension.manifestVersion})` : ''} | Type: ${typeInfo} | Install: ${installInfo}`;
    container.appendChild(infoElement);

    // Description
    const descElement = createElement('p');
    descElement.innerHTML = `<img src="icons/description.svg" alt="Description Icon" class="icon"> ${extension.description || 'No description provided.'}`;
    container.appendChild(descElement);

    // Homepage Link
    if (extension.homepageUrl) {
        const homepageElement = createElement('p');
        homepageElement.innerHTML = `<img src="icons/link.svg" alt="Link Icon" class="icon"> Homepage: `;
        homepageElement.appendChild(createElement('a', { href: extension.homepageUrl, target: '_blank' }, extension.homepageUrl));
        container.appendChild(homepageElement);
    }

    // Chrome Web Store Link
    if (extension.updateUrl && extension.updateUrl.includes('google.com')) { // Basic check for CWS extension
       const webStoreLink = `https://chromewebstore.google.com/detail/${extension.id}`;
       const storeElement = createElement('p');
       storeElement.innerHTML = `<img src="icons/store.svg" alt="Store Icon" class="icon"> Store: `;
       storeElement.appendChild(createElement('a', { href: webStoreLink, target: '_blank' }, 'View in Chrome Web Store'));
       container.appendChild(storeElement);
    }

    // Options Link
    if (extension.optionsUrl) {
        const optionsElement = createElement('p');
        optionsElement.innerHTML = `<img src="icons/settings.svg" alt="Settings Icon" class="icon"> Options: `;
        optionsElement.appendChild(createElement('a', { href: extension.optionsUrl, target: '_blank' }, 'Open Options Page'));
        container.appendChild(optionsElement);
    }

    // Enabled Status
    const statusElement = createElement('p', { id: 'enabled-status' });
    statusElement.innerHTML = `<img src="icons/status.svg" alt="Status Icon" class="icon"> Status: ${extension.enabled ? 'Enabled' : 'Disabled'}`;
    container.appendChild(statusElement);

    // --- Action Buttons ---
    const currentExtensionId = chrome.runtime.id; // Get the ID of this manager extension
    if (extension.id !== currentExtensionId) {
        const buttonContainer = createElement('div', { className: 'button-container' });

        const enableDisableButton = createElement('button', {
            id: 'enable-disable-btn',
            className: 'primary',
            textContent: extension.enabled ? 'Disable' : 'Enable',
            'data-action': extension.enabled ? 'disable' : 'enable', // Add data attribute for styling
            onclick: () => toggleExtensionStatus(extension.id, !extension.enabled, container)
        });
        buttonContainer.appendChild(enableDisableButton);

        const uninstallButton = createElement('button', {
            id: 'uninstall-btn',
            className: 'secondary', // Use secondary style for destructive action
            textContent: 'Uninstall',
            onclick: () => uninstallExtension(extension.id, extension.name)
        });
        buttonContainer.appendChild(uninstallButton);

        container.appendChild(buttonContainer);
    } else {
        container.appendChild(createElement('p', { className: 'info-message' }, 'This is the NG Extension Manager itself and cannot be disabled or uninstalled from here.'));
    }

    // --- Permissions Section ---
    const permissionsSection = createPermissionsSection(extension.permissions || [], extension.hostPermissions || []);
    container.appendChild(permissionsSection);

    // New: Add search functionality for permissions
    addPermissionSearchBox(container);
};

// New: Helper function to capitalize first letter (DRY principle)
const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// New: Add search box for permissions
const addPermissionSearchBox = (container) => {
    // Only add search if there are permissions
    const permissionsGrid = document.getElementById('permissions-grid');
    if (!permissionsGrid || permissionsGrid.children.length === 0) return;

    // Create search container
    const searchContainer = createElement('div', { className: 'permission-search-container' });
    
    // Create and append search input
    const searchInput = createElement('input', {
        type: 'text',
        placeholder: 'Search permissions...',
        id: 'permission-search',
        onkeyup: filterPermissions
    });
    
    // Add clear button
    const clearButton = createElement('button', {
        className: 'clear-search',
        textContent: '×',
        style: { display: 'none' },
        onclick: () => {
            searchInput.value = '';
            filterPermissions();
            clearButton.style.display = 'none';
        }
    });
    
    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearButton);
    
    // Insert before permissions grid
    container.insertBefore(searchContainer, permissionsGrid.parentNode);
    
    // Add listener to show/hide clear button
    searchInput.addEventListener('input', () => {
        clearButton.style.display = searchInput.value ? 'block' : 'none';
    });
};

// New: Filter permissions based on search
const filterPermissions = () => {
    const input = document.getElementById('permission-search');
    const filter = input?.value.toLowerCase();
    const grid = document.getElementById('permissions-grid');
    const items = grid?.getElementsByClassName('permission-item');
    const noResults = document.getElementById('no-permissions-found');
    
    if (!items || !noResults) return;
    
    let visibleCount = 0;
    
    for (let i = 0; i < items.length; i++) {
        const permName = items[i].getAttribute('data-permission-name');
        const permDesc = items[i].getAttribute('data-permission-desc');
        
        if (!filter || permName.includes(filter) || permDesc.includes(filter)) {
            items[i].style.display = '';
            visibleCount++;
        } else {
            items[i].style.display = 'none';
        }
    }
    
    // Show/hide no results message
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
};

// Function to create the permissions section - FIXED
const createPermissionsSection = (permissions, hostPermissions) => {
    const permissionsBox = createElement('div', { className: 'permissions-box' });
    permissionsBox.appendChild(createElement('h3', {}, 'Permissions & Host Access'));

    const allPermissions = [...new Set([...permissions, ...hostPermissions])]; // Combine and deduplicate
    const permissionCount = allPermissions.length;

    if (permissionCount === 0) {
        permissionsBox.appendChild(createElement('p', { className: 'info-message' }, 'This extension requests no special permissions.'));
        return permissionsBox; // FIXED: Return the element properly
    }

    const permissionsGrid = createElement('div', { id: 'permissions-grid', className: 'permissions-grid' });
    const noResultsMessage = createElement('p', { 
        id: 'no-permissions-found', 
        style: { 
            display: 'none', 
            textAlign: 'center', 
            color: 'var(--text-secondary)', 
            marginTop: '1em'
        } 
    }, 'No permissions match your search.');

    const permissionDetails = getPermissionDetails(); // Get descriptions and risks

    allPermissions.sort().forEach(permission => { // Sort permissions alphabetically
        const details = permissionDetails[permission] || {
            description: hostPermissions.includes(permission) ? 
                'Allows the extension to read and change data on this specific website or group of websites.' : 
                'No specific description available.',
            risk: hostPermissions.includes(permission) ? 'Medium' : 'Unknown' // Host permissions are generally medium risk
        };
        const riskLevel = details.risk.toLowerCase(); // 'low', 'medium', 'high', 'unknown'

        const permissionItem = createElement('div', {
            className: 'permission-item',
            'data-permission-name': permission.toLowerCase(), // For search
            'data-permission-desc': details.description.toLowerCase() // For search
        });

        const itemHeader = createElement('div', { className: 'permission-item-header' });
        itemHeader.appendChild(createElement('h4', {}, permission));
        itemHeader.appendChild(createElement('span', {
            className: `permission-risk ${riskLevel}`
        }, riskLevel));

        permissionItem.appendChild(itemHeader);
        permissionItem.appendChild(createElement('p', {}, details.description));

        permissionsGrid.appendChild(permissionItem);
    });

    permissionsBox.appendChild(permissionsGrid);
    permissionsBox.appendChild(noResultsMessage); // Add the "no results" message element
    
    return permissionsBox; // FIXED: Return the element properly
};

// Function to provide descriptions AND risk levels 
// (Kept unchanged for compatibility with existing code)
const getPermissionDetails = () => {
    // Risk Levels: Low, Medium, High, Unknown
    return {
        // Low Risk (Generally safe or limited scope)
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
        "unlimitedStorage": { description: "Request unlimited local storage space.", risk: "Low" },
        "wallpaper": { description: "Change the browser wallpaper.", risk: "Low" },


        // Medium Risk (Can access potentially sensitive info or modify browser behavior more significantly)
        "accessibilityFeatures.read": { description: "Read accessibility settings.", risk: "Medium" },
        "accessibilityFeatures.modify": { description: "Modify accessibility settings.", risk: "Medium" },
        "BrowseData": { description: "Clear Browse data like history, cache, cookies.", risk: "Medium" },
        "clipboardWrite": { description: "Write data to the system clipboard.", risk: "Medium" },
        "contentSettings": { description: "Control website features like cookies, JavaScript, plugins.", risk: "Medium" },
        "debugger": { description: "Attach to browser tabs for debugging purposes, potentially observing network traffic and manipulating the page.", risk: "Medium" },
        "declarativeNetRequest": { description: "Block or modify network requests without intercepting content (limited rules).", risk: "Medium" },
        "downloads": { description: "Manage downloads (start, monitor, cancel).", risk: "Medium" },
        "fontSettings": { description: "Read and modify browser font settings.", risk: "Medium" },
        "geolocation": { description: "Access the user's physical location (requires user prompt).", risk: "Medium" },
        "history": { description: "Read and modify Browse history.", risk: "Medium" },
        "identity": { description: "Access user identity information (e.g., login status, requires user consent).", risk: "Medium" },
        "identity.email": { description: "Access the user's email address (requires user consent).", risk: "Medium" },
        "management": { description: "Manage installed extensions and apps (enable, disable, uninstall).", risk: "Medium" },
        "pageCapture": { description: "Save web pages as MHTML.", risk: "Medium" },
        "privacy": { description: "Read and modify privacy-related browser settings.", risk: "Medium" },
        "proxy": { description: "Configure and manage browser proxy settings.", risk: "Medium" },
        "scripting": { description: "Inject scripts into web pages (requires host permissions or activeTab).", risk: "Medium" },
        "sessions": { description: "Access and restore recently closed tabs and sessions.", risk: "Medium" },
        "system.cpu": { description: "Read CPU information.", risk: "Medium" },
        "system.display": { description: "Read display metadata.", risk: "Medium" },
        "system.memory": { description: "Read memory information.", risk: "Medium" },
        "system.storage": { description: "Read storage device information.", risk: "Medium" },
        "tabCapture": { description: "Capture audio and video streams from tabs.", risk: "Medium" },
        "tabs": { description: "Access and manipulate browser tabs (URL, title, create, close, etc.). Essential for many extensions but powerful.", risk: "Medium" },
        "webNavigation": { description: "Receive notifications about navigation events.", risk: "Medium" },

        // High Risk (Broad access to sensitive data, system resources, or fundamental browser functions)
        "background": { description: "Allows the extension to run a script persistently in the background.", risk: "High" },
        "declarativeNetRequestWithHostAccess": { description: "Block or modify network requests, including access based on requested domain (requires host permissions).", risk: "High" },
        "desktopCapture": { description: "Capture screen content, individual windows, or tabs (requires user prompt).", risk: "High" },
        "nativeMessaging": { description: "Exchange messages with native applications installed on the user's computer.", risk: "High" },
        "power": { description: "Override system power-saving settings.", risk: "High" },
        "webRequest": { description: "Observe and analyze network traffic; intercept, block, or modify requests in-flight (being deprecated for non-force-installed extensions).", risk: "High" },
        "webRequestBlocking": { description: "Block or modify network requests synchronously (being deprecated).", risk: "High" },
        // Hardware/OS Access Permissions are generally High Risk
        "audio": { description: "Access audio input/output devices.", risk: "High" },
        "bluetooth": { description: "Discover and communicate with Bluetooth devices.", risk: "High" },
        "hid": { description: "Communicate with connected Human Interface Devices (keyboards, gamepads).", risk: "High" },
        "serial": { description: "Communicate with devices connected via serial port.", risk: "High" },
        "usb": { description: "Communicate with connected USB devices.", risk: "High" },
        "vpnProvider": { description: "Implement a VPN client.", risk: "High" },
        // Enterprise-specific - often High risk if exposed outside managed environment
        "certificateProvider": { description: "Expose certificates to the platform.", risk: "High" },
        "enterprise.deviceAttributes": { description: "Read device attributes in managed environments.", risk: "High" },
        "enterprise.hardwarePlatform": { description: "Read hardware platform info in managed environments.", risk: "High" },
        "enterprise.networkingAttributes": { description: "Read network details in managed environments.", risk: "High" },
        "enterprise.platformKeys": { description: "Access client certificates managed by the OS.", risk: "High" },
        "platformKeys": { description: "Access client certificates managed by the OS (non-enterprise).", risk: "High" },
        "printerProvider": { description: "Implement print drivers.", risk: "High" },
    };
};

// Function to toggle the extension's enabled status
const toggleExtensionStatus = (extensionId, enable, container) => {
    const button = document.getElementById('enable-disable-btn');
    const statusElement = document.getElementById('enabled-status');

    // Disable button during operation
    if (button) button.disabled = true;

    chrome.management.setEnabled(extensionId, enable, () => {
        if (chrome.runtime.lastError) {
            showError(`Failed to ${enable ? 'enable' : 'disable'} extension: ${chrome.runtime.lastError.message}`, container);
             // Re-enable button on error
             if (button) button.disabled = false;
             return;
        }

        // Update status text
        if (statusElement) {
             statusElement.innerHTML = `<img src="icons/status.svg" alt="Status Icon" class="icon"> Status: ${enable ? 'Enabled' : 'Disabled'}`;
        }

        // Update button text, style, and re-enable
        if (button) {
            button.textContent = enable ? 'Disable' : 'Enable';
            button.setAttribute('data-action', enable ? 'disable' : 'enable'); // Update data-action for CSS
            button.disabled = false;
        }

        // Show success notification
        showToast(`Extension ${enable ? 'enabled' : 'disabled'} successfully`, 'success');
        console.log(`Extension ${extensionId} ${enable ? 'enabled' : 'disabled'}.`);
    });
};

// Function to uninstall the extension with improved UX
const uninstallExtension = (extensionId, extensionName) => {
    // Create modal dialog instead of using browser's confirm
    const modalOverlay = createElement('div', {
        id: 'confirmation-modal-overlay',
        style: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999
        }
    });
    
    const modalContent = createElement('div', {
        style: {
            backgroundColor: 'var(--surface)',
            padding: '20px',
            borderRadius: '20px',
            maxWidth: '400px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
        }
    });
    
    modalContent.appendChild(createElement('h3', {}, 'Confirm Uninstall'));
    modalContent.appendChild(createElement('p', {}, 
        `Are you sure you want to uninstall "${extensionName || extensionId}"? This action cannot be undone.`));
    
    const buttonContainer = createElement('div', {
        style: {
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px'
        }
    });
    
    // Cancel button
    buttonContainer.appendChild(createElement('button', {
        className: 'secondary',
        onclick: () => document.body.removeChild(modalOverlay)
    }, 'Cancel'));
    
    // Confirm button
    buttonContainer.appendChild(createElement('button', {
        className: 'primary',
        onclick: () => {
            // Show loading state
            const confirmBtn = buttonContainer.lastChild;
            confirmBtn.textContent = 'Uninstalling...';
            confirmBtn.disabled = true;
            
            chrome.management.uninstall(extensionId, { showConfirmDialog: false }, () => {
                document.body.removeChild(modalOverlay);
                
                if (chrome.runtime.lastError) {
                    showToast(`Failed to uninstall extension: ${chrome.runtime.lastError.message}`, 'error');
                    return;
                }
                
                showToast(`"${extensionName || extensionId}" has been uninstalled successfully`, 'success');
                // Redirect after a short delay so the toast is visible
                setTimeout(() => {
                    window.location.href = '/popup.html';
                }, 1500);
            });
        }
    }, 'Uninstall'));
    
    modalContent.appendChild(buttonContainer);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
};

// Function to show error messages within a specific container or the body
const showError = (message, container) => {
    const targetContainer = container || document.body; // Default to body if container not specified
    // Remove existing error messages in the target container first
    const existingError = targetContainer.querySelector('.error-box');
    if (existingError) {
        existingError.remove();
    }

    const errorBox = createElement('div', { className: 'error-box' });
    const errorElement = createElement('p');
    errorElement.innerHTML = `<img src="icons/error.svg" alt="Error Icon" class="icon" style="filter: invert(20%) sepia(80%) saturate(5000%) hue-rotate(350deg);"> ${message}`;
    errorBox.appendChild(errorElement);

    // Prepend error to the container for visibility
    if (targetContainer.firstChild) {
        targetContainer.insertBefore(errorBox, targetContainer.firstChild);
    } else {
        targetContainer.appendChild(errorBox);
    }
    
    // Also show toast for better visibility
    showToast(message, 'error');
    console.error(message); // Also log to console
};


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    showExtensionDetails();
});
