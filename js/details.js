// Function to display extension details in the HTML container
const showExtensionDetails = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const extensionId = urlParams.get('id');

    if (!extensionId) {
        showError('No extension ID was provided in the URL. Please ensure the URL contains a valid extension ID.');
        return;
    }

    chrome.management.get(extensionId, (extension) => {
        const extensionDetails = document.getElementById('extension-details');
        if (!extensionDetails) {
            showError('The extension details container is missing in the HTML.');
            return;
        }
        extensionDetails.innerHTML = '';

        if (chrome.runtime.lastError) {
            showError(`An error occurred while retrieving extension details. Error: ${chrome.runtime.lastError.message}`);
            return;
        }

        if (!extension) {
            showError('No extension found with the provided ID. The extension might be uninstalled or the ID may be incorrect.');
            return;
        }

        // Add extension info to the page
        extensionDetails.appendChild(createElement('h2', { textContent: extension.name, className: 'gradient-text' }));
        extensionDetails.appendChild(createElement('p', {
            innerHTML: `<img src="icons/info.svg" alt="Info Icon" class="icon"> Version: ${extension.version} (ID: ${extension.id})${extension.manifestVersion ? ` - Manifest v${extension.manifestVersion}` : ''}`
        }));
        extensionDetails.appendChild(createElement('p', { innerHTML: `<img src="icons/description.svg" alt="Description Icon" class="icon"> Description: ${extension.description}` }));

        if (extension.homepageUrl) {
            extensionDetails.appendChild(createElement('p', {
                innerHTML: `<img src="icons/link.svg" alt="Link Icon" class="icon"> Homepage: <a href="${extension.homepageUrl}" target="_blank">${extension.homepageUrl}</a>`
            }));
        }

        if (extension.optionsUrl) {
            extensionDetails.appendChild(createElement('p', {
                innerHTML: `<img src="icons/settings.svg" alt="Settings Icon" class="icon"> Options: <a href="${extension.optionsUrl}" target="_blank">Open Options</a>`
            }));
        }

        extensionDetails.appendChild(createElement('p', {
            id: 'enabled-status',
            innerHTML: `<img src="icons/status.svg" alt="Status Icon" class="icon"> Status: ${extension.enabled ? 'Enabled' : 'Disabled'}`
        }));

        // Action buttons
        const currentExtensionId = 'gmfglkagfdjokdehkagemdgapolfalid'; // Current extension manager's ID

        if (extension.id !== currentExtensionId) {
            const buttonContainer = createElement('div', { className: 'button-container' });

            const enableDisableButton = createElement('button', {
                id: 'enable-disable-btn',
                textContent: extension.enabled ? 'Disable' : 'Enable',
                onclick: () => toggleExtensionStatus(extensionId, !extension.enabled)
            });
            buttonContainer.appendChild(enableDisableButton);

            const uninstallButton = createElement('button', {
                id: 'uninstall-btn',
                textContent: 'Uninstall',
                onclick: () => uninstallExtension(extensionId)
            });
            buttonContainer.appendChild(uninstallButton);

            extensionDetails.appendChild(buttonContainer);
        }

        // Permissions Section
        const permissionsBox = createPermissionsSection(extension.permissions || []);
        extensionDetails.appendChild(permissionsBox);
    });
};

// Utility function to create elements with attributes
const createElement = (tag, attributes = {}) => {
    const element = document.createElement(tag);
    Object.keys(attributes).forEach(attr => {
        if (attr === 'style') {
            Object.assign(element.style, attributes[attr]);
        } else if (attr.startsWith('on') && typeof attributes[attr] === 'function') {
            element.addEventListener(attr.substring(2), attributes[attr]);
        } else {
            element[attr] = attributes[attr];
        }
    });
    return element;
};

// Function to create the permissions section with explanations
const createPermissionsSection = (extensionPermissions) => {
    const permissionsBox = createElement('div', { className: 'permissions-box' });
    permissionsBox.appendChild(createElement('h3', { innerHTML: 'Extension Permissions' }));

    const permissionsGrid = createElement('div', { className: 'permissions-grid' });

    const permissionDescriptions = getPermissionDescriptions();

    const uniquePermissions = [...new Set(extensionPermissions)];

    if (uniquePermissions.length === 0) {
        permissionsBox.appendChild(createElement('p', {
            className: 'info-message',
            innerHTML: '<img src="icons/info.svg" alt="Info Icon" class="icon"> Permissions not found for this extension. It might not need any, or there could be an issue with its permissions data.'
        }));
        return permissionsBox;
    }

    uniquePermissions.forEach(permission => {
        const description = permissionDescriptions[permission] || 'No description available for this permission.';
        const permissionItem = createElement('div', { className: 'permission-item' });
        permissionItem.appendChild(createElement('h4', { textContent: permission }));
        permissionItem.appendChild(createElement('p', { textContent: description }));
        permissionsGrid.appendChild(permissionItem);
    });

    permissionsBox.appendChild(permissionsGrid);
    return permissionsBox;
};

// Function to provide descriptions for each permission
const getPermissionDescriptions = () => {
    return {
        activeTab: 'Allows the extension to access the currently active tab when the user interacts with the extension.',
        alarms: 'Enables the extension to schedule code to run at specific times or intervals.',
        bookmarks: 'Allows the extension to create, organize, and modify the user\'s bookmarks.',
        browsingData: 'Grants the ability to remove browsing data such as history, cache, and cookies from the user\'s browser.',
        clipboardRead: 'Allows the extension to read data from the clipboard.',
        clipboardWrite: 'Grants the ability to write data to the clipboard.',
        contentSettings: 'Enables the extension to modify or query settings for websites, such as cookies, JavaScript, and images.',
        cookies: 'Provides access to the browser\'s cookies, allowing the extension to read and modify them.',
        contextMenus: 'Enables the extension to add items to the browser\'s context menu.',
        devtools: 'Grants the extension access to the Chrome DevTools panels and sidebars, enhancing developer tools functionality.',
        declarativeContent: 'Allows the extension to define rules for modifying web pages based on specific conditions.',
        declarativeNetRequest: 'Grants the ability to block or modify network requests based on declarative rules.',
        debugging: 'Grants the ability to debug other extensions or web pages.',
        desktopCapture: 'Enables the extension to capture the contents of the user\'s screen or specific windows.',
        downloads: 'Allows the extension to download files to the user\'s computer.',
        fileSystem: 'Grants the ability to access and interact with the user\'s file system.',
        geolocation: 'Allows the extension to access the user\'s geographical location.',
        history: 'Provides access to the user\'s browsing history.',
        identity: 'Grants the ability to manage user identity and authentication.',
        idle: 'Enables the extension to detect when the user is idle.',
        management: 'Allows the extension to manage other extensions, including installing, uninstalling, and disabling them.',
        nativeMessaging: 'Enables communication between the extension and native applications installed on the user\'s computer.',
        notifications: 'Grants the ability to create and manage desktop notifications.',
        omnibox: 'Allows the extension to add functionality to the browser\'s address bar.',
        pageCapture: 'Enables the extension to save web pages as HTML files.',
        permissions: 'Allows the extension to request additional permissions at runtime.',
        privacy: 'Grants the ability to control aspects of user privacy settings.',
        proxy: 'Enables the extension to control the browser\'s proxy settings.',
        scripting: 'Provides the ability to inject and execute scripts in web pages.',
        sessions: 'Allows the extension to retrieve information about the user\'s browsing sessions.',
        storage: 'Provides access to the browser\'s storage system, allowing the extension to store and retrieve data.',
        tabCapture: 'Enables the extension to capture the visible area of a tab as a media stream.',
        tabGroups: 'Allows the extension to manage tab groups within the browser.',
        tabs: 'Grants access to the browser\'s tab system, allowing the extension to interact with browser tabs.',
        topSites: 'Provides access to the user\'s most visited sites.',
        unlimitedStorage: 'Grants the extension unlimited storage space beyond the typical quota limits.',
        vpnProvider: 'Allows the extension to provide a VPN service by controlling network traffic.',
        webNavigation: 'Enables the extension to observe and analyze navigation events in the browser.',
        webRequest: 'Allows the extension to observe and analyze network requests in real-time.',
        webRequestBlocking: 'Grants the ability to block or modify network requests before they are sent.',
        webSocket: 'Enables the extension to use WebSockets for real-time communication.',
        webSocketSecure: 'Allows the extension to establish secure WebSocket connections.',
        system_cpu: 'Provides access to detailed information about the system\'s CPU.',
        system_memory: 'Grants access to information about the system\'s memory usage.',
        system_storage: 'Enables the extension to access detailed information about the system\'s storage devices.',
        dns: 'Allows the extension to manage DNS settings and perform DNS queries.',
        'udp-send': 'Grants the ability to send UDP packets over the network.',
        'udp-receive': 'Enables the extension to receive UDP packets from the network.'
    };
};

// Function to toggle the extension's enabled status
const toggleExtensionStatus = (extensionId, isEnabled) => {
    chrome.management.setEnabled(extensionId, isEnabled, () => {
        if (chrome.runtime.lastError) {
            showError(`Error: ${chrome.runtime.lastError.message}`);
            return;
        }
        document.getElementById('enabled-status').textContent = `Status: ${isEnabled ? 'Enabled' : 'Disabled'}`;
    });
};

// Function to uninstall the extension
const uninstallExtension = (extensionId) => {
    if (confirm('Are you sure you want to uninstall this extension?')) {
        chrome.management.uninstall(extensionId, () => {
            if (chrome.runtime.lastError) {
                showError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }
            window.location.href = '/';
        });
    }
};

// Function to show error messages
const showError = (message) => {
    const errorBox = createElement('div', { className: 'error-box' });
    errorBox.appendChild(createElement('p', { textContent: message }));
    document.getElementById('extension-details').appendChild(errorBox);
};

// Initialize the extension details page
showExtensionDetails();
