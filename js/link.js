(function() { 
    // Dynamically load Inter font
    const loadInterFont = () => {
        const link = document.createElement('link');
        link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
        link.rel = 'stylesheet';
        document.head.appendChild(link);
    };

    // Dynamically inject CSS styles
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
                        /* Overlay Styles */
            .custom-popup-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0, 0, 0, 0.6); /* Dunklere Überlagerung */
                z-index: 9999;
                opacity: 0;
                transition: opacity 0.3s ease;
            }

            .custom-popup-overlay.visible {
                opacity: 1;
            }

            /* Popup Styles */
            .custom-popup-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.8);
                background-color: #222; /* Dunkler Hintergrund */
                border-radius: 12px;
                padding: 25px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5); /* Stärkerer Schatten für dunklen Modus */
                z-index: 10000;
                max-width: 500px;
                width: 90%;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
                font-size: 16px;
                transition: transform 0.3s ease, opacity 0.3s ease;
                opacity: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                color: #f1f1f1; /* Heller Text */
                word-break: break-word;
                overflow-wrap: break-word;
            }

            .custom-popup-container.visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }

            .custom-popup-header {
                font-size: 24px;
                color: #f1f1f1; /* Heller Header-Text */
                margin-bottom: 20px;
                font-weight: 600;
            }

            .custom-popup-message {
                font-size: 16px;
                color: #cccccc; /* Grauerer Text für Lesbarkeit */
                margin-bottom: 15px;
            }

            .custom-popup-url {
                font-size: 16px;
                color: #1a73e8; /* Blaue Links */
                margin-bottom: 15px;
                word-break: break-word;
                overflow-wrap: break-word;
            }

            .custom-popup-safe {
                font-size: 14px;
                color: #28a745; /* Grün für sichere Hinweise */
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                gap: 5px;
            }

            .custom-popup-warning {
                font-size: 14px;
                color: #ff4d4d; /* Hellere Warnfarbe */
                margin-bottom: 20px;
            }

            .custom-popup-buttons {
                display: flex;
                gap: 10px;
                width: 100%;
                justify-content: center;
            }

            .custom-popup-buttons button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.3s ease;
                flex: 1;
                max-width: 150px;
            }

            .confirm-button {
                background-color: #1a73e8; /* Dunklerer Blau-Ton */
                color: #fff;
            }

            .confirm-button:hover {
                background-color: #0f5cb5; /* Dunklerer Hover-Effekt */
            }

            .cancel-button {
                background-color: #444; /* Dunklerer Hintergrund */
                color: #fff; /* Weißer Text */
            }

            .cancel-button:hover {
                background-color: #666; /* Hellerer Hover-Effekt */
            }

            .remember-button {
                background-color: #28a745; /* Grün */
                color: #fff;
            }

            .remember-button:hover {
                background-color: #218838; /* Dunklerer Grünton */
            }

            /* Error Popup Styles */
            .custom-error-popup-container {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0.8);
                background-color: #222; /* Dunkler Hintergrund */
                border-radius: 12px;
                padding: 25px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
                z-index: 10000;
                max-width: 500px;
                width: 90%;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
                font-size: 16px;
                transition: transform 0.3s ease, opacity 0.3s ease;
                opacity: 0;
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                color: #f1f1f1;
                word-break: break-word;
                overflow-wrap: break-word;
            }

            .custom-error-popup-container.visible {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1);
            }

            .custom-error-header {
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 15px;
            }

            .custom-error-header .custom-material-icons {
                font-size: 24px;
                color: #ff4d4d; /* Rote Warnfarbe */
                margin-right: 10px;
            }

            .custom-error-header h1 {
                font-size: 24px;
                color: #f1f1f1;
                margin: 0;
            }

            .custom-error-message {
                font-size: 16px;
                color: #cccccc;
                margin-bottom: 20px;
            }

            .custom-error-close-button {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                background-color: #ff4d4d; /* Rote Schließen-Schaltfläche */
                color: #fff;
                cursor: pointer;
                font-size: 16px;
                transition: background-color 0.3s ease;
            }

            .custom-error-close-button:hover {
                background-color: #d73838; /* Dunklerer Rot-Ton */
            }

            /* Responsive Design */
            @media (max-width: 500px) {
                .custom-popup-container, .custom-error-popup-container {
                    width: 90%;
                }

                .custom-popup-buttons button {
                    flex: none;
                    width: 100%;
                    max-width: none;
                }
            }

            /* Material Icons */
            .custom-material-icons {
                font-family: 'Material Icons';
                font-weight: normal;
                font-style: normal;
                font-size: 24px;
                line-height: 1;
                display: inline-block;
                white-space: nowrap;
                word-wrap: normal;
                direction: ltr;
                -webkit-font-feature-settings: 'liga';
                -webkit-font-smoothing: antialiased;
                color: #f1f1f1; /* Farbe für Icons */
            }
        `;
        document.head.appendChild(style);

        // Material Icons
        const materialIconsLink = document.createElement('link');
        materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        materialIconsLink.rel = 'stylesheet';
        document.head.appendChild(materialIconsLink);
    };

    // Utility function to escape HTML to prevent XSS
    const escapeHTML = (str) => {
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
                '/': '&#x2F;',
                '`': '&#x60;',
                '=': '&#x3D;'
            })[s];
        });
    };

    // Create Overlay
    const createOverlay = () => {
        const overlay = document.createElement('div');
        overlay.classList.add('custom-popup-overlay');
        return overlay;
    };

    // Create Popup
    const createPopup = (url, isSafe) => {
        const isHttps = url.startsWith('https://');
        const linkColor = isHttps ? '#1a73e8' : '#dc3545';

        const popup = document.createElement('div');
        popup.classList.add('custom-popup-container');

        popup.innerHTML = `
            <div class="custom-popup-header">Leaving NG Extension Manager</div>
            <div class="custom-popup-message">You are about to navigate to an external site. Do you wish to continue?</div>
            <div class="custom-popup-url">${escapeHTML(url)}</div>
            ${isSafe ? '<div class="custom-popup-safe"><span class="custom-material-icons">check_circle</span> This domain is verified as safe.</div>' : ''}
            ${!isSafe && !isHttps ? '<div class="custom-popup-warning">Warning: This link is not secure (no HTTPS). Proceed with caution.</div>' : ''}
            <div class="custom-popup-buttons">
                <button id="confirm-leave" class="confirm-button">Yes, Continue</button>
                <button id="cancel-leave" class="cancel-button">No, Cancel</button>
                ${isSafe ? '<button id="remember-domain" class="remember-button">Remember Domain</button>' : ''}
            </div>
        `;

        return popup;
    };

    // Create Error Popup
    const createErrorPopup = (message) => {
        const errorPopup = document.createElement('div');
        errorPopup.classList.add('custom-error-popup-container');

        errorPopup.innerHTML = `
            <div class="custom-error-header">
                <span class="custom-material-icons">error</span>
                <h1>Error</h1>
            </div>
            <div class="custom-error-message">${escapeHTML(message)}</div>
            <button id="error-close" class="custom-error-close-button">Close</button>
        `;

        return errorPopup;
    };

    // Show Popup
    const showPopup = async (url, isSafe) => {
        try {
            const overlay = createOverlay();
            const popup = createPopup(url, isSafe);

            document.body.appendChild(overlay);
            document.body.appendChild(popup);

            // Trigger reflow to enable transition
            window.getComputedStyle(overlay).opacity;
            window.getComputedStyle(popup).opacity;

            overlay.classList.add('visible');
            popup.classList.add('visible');

            const confirmButton = popup.querySelector('#confirm-leave');
            const cancelButton = popup.querySelector('#cancel-leave');
            const rememberButton = popup.querySelector('#remember-domain');

            // Confirm Button Event
            confirmButton.addEventListener('click', () => {
                try {
                    window.open(url, '_blank');
                    closePopup(popup, overlay);
                } catch (error) {
                    console.error('Error opening URL:', error);
                    closePopup(popup, overlay);
                    showErrorPopup('An error occurred while trying to open the URL.');
                }
            });

            // Cancel Button Event
            cancelButton.addEventListener('click', () => closePopup(popup, overlay));

            // Remember Domain Button Event
            if (isSafe && rememberButton) {
                rememberButton.addEventListener('click', () => {
                    try {
                        const domain = new URL(url).hostname;
                        addDomainToLocalStorage(domain);
                        closePopup(popup, overlay);
                        window.open(url, '_blank');
                    } catch (error) {
                        console.error('Error remembering domain:', error);
                        showErrorPopup('Failed to remember the domain.');
                    }
                });
            }

            const escapeListener = (event) => {
                if (event.key === 'Escape') closePopup(popup, overlay);
            };
            document.addEventListener('keydown', escapeListener);

            // Cleanup event listener when popup is closed
            popup.addEventListener('transitionend', () => {
                if (!popup.classList.contains('visible')) {
                    document.removeEventListener('keydown', escapeListener);
                }
            });
        } catch (error) {
            console.error('Error showing popup:', error);
            showErrorPopup('Failed to display the popup.');
        }
    };

    // Close Popup
    const closePopup = (popup, overlay) => {
        try {
            popup.classList.remove('visible');
            overlay.classList.remove('visible');

            // Wait for transition to end before removing elements
            popup.addEventListener('transitionend', () => {
                if (popup.parentElement) popup.remove();
            }, { once: true });

            overlay.addEventListener('transitionend', () => {
                if (overlay.parentElement) overlay.remove();
            }, { once: true });
        } catch (error) {
            console.error('Error closing popup:', error);
        }
    };

    // Show Error Popup
    const showErrorPopup = (message) => {
        try {
            const overlay = createOverlay();
            const errorPopup = createErrorPopup(message);

            document.body.appendChild(overlay);
            document.body.appendChild(errorPopup);

            // Trigger reflow to enable transition
            window.getComputedStyle(overlay).opacity;
            window.getComputedStyle(errorPopup).opacity;

            overlay.classList.add('visible');
            errorPopup.classList.add('visible');

            const closeButton = errorPopup.querySelector('#error-close');

            closeButton.addEventListener('click', () => closePopup(errorPopup, overlay));

            const escapeListener = (event) => {
                if (event.key === 'Escape') closePopup(errorPopup, overlay);
            };
            document.addEventListener('keydown', escapeListener);

            // Cleanup event listener when popup is closed
            errorPopup.addEventListener('transitionend', () => {
                if (!errorPopup.classList.contains('visible')) {
                    document.removeEventListener('keydown', escapeListener);
                }
            });
        } catch (error) {
            console.error('Error showing error popup:', error);
            alert('An unexpected error occurred.');
        }
    };

    // Sanitize URL
    const sanitizeURL = (url) => {
        try {
            const decodedURL = decodeURI(url);
            const sanitizedURL = encodeURI(decodedURL);
            return sanitizedURL;
        } catch (e) {
            console.warn('URL sanitization failed:', e);
            return '';
        }
    };

    // Check if URL is safe based on protocol
    const isSafeURLProtocol = (url) => {
        const unsafeProtocols = /^(chrome|chrome-extension|chrome-devtools|about|javascript|data|file|ftp|mailto|view-source|ws|wss|smb|sftp|telnet|gopher|nntp|news|irc|ircs):/i;
        return !unsafeProtocols.test(url);
    };

    // Fetch Safe Domains from Link.json
    const fetchSafeDomains = async () => {
        try {
            const response = await fetch(chrome.runtime.getURL('js/json/link.json'));
            if (!response.ok) {
                throw new Error('Failed to load Link.json');
            }
            const data = await response.json();
            // Assume Link.json contains an array of domains
            return data.domains || [];
        } catch (error) {
            console.error('Error fetching safe domains:', error);
            return [];
        }
    };

    // Get User-Saved Safe Domains from Local Storage
    const getUserSafeDomains = () => {
        const domains = localStorage.getItem('userSafeDomains');
        return domains ? JSON.parse(domains) : [];
    };

    // Add Domain to Local Storage Safe List
    const addDomainToLocalStorage = (domain) => {
        try {
            const domains = getUserSafeDomains();
            if (!domains.includes(domain)) {
                domains.push(domain);
                localStorage.setItem('userSafeDomains', JSON.stringify(domains));
            }
        } catch (error) {
            console.error('Error adding domain to local storage:', error);
        }
    };

    // Check if Domain is in User-Safe Domains
    const isDomainUserSafe = (domain) => {
        const domains = getUserSafeDomains();
        return domains.includes(domain);
    };

    // Initialize the script
    const initialize = () => {
        loadInterFont();
        injectStyles();

        // Event Listener for link clicks
        document.body.addEventListener('click', async (event) => {
            try {
                const link = event.target.closest('a');
                if (link && link.href && link.hostname !== window.location.hostname) {
                    event.preventDefault();
                    const sanitizedUrl = sanitizeURL(link.href);
                    if (!sanitizedUrl) {
                        showErrorPopup('Invalid URL detected.');
                        return;
                    }

                    // Parse hostname
                    let linkHostname;
                    try {
                        linkHostname = new URL(sanitizedUrl).hostname;
                    } catch (e) {
                        console.warn('Invalid URL format:', e);
                        showErrorPopup('The URL format is invalid.');
                        return;
                    }

                    // Check if domain is in user-safe domains
                    if (isDomainUserSafe(linkHostname)) {
                        // Redirect immediately without popup
                        window.open(sanitizedUrl, '_blank');
                        return;
                    }

                    // Fetch safe domains from Link.json only when popup is opened
                    const safeDomainsFromFile = await fetchSafeDomains();
                    const isSafe = safeDomainsFromFile.includes(linkHostname);

                    // Check protocol safety
                    if (!isSafeURLProtocol(sanitizedUrl)) {
                        showErrorPopup('The URL you are trying to access uses an unsafe protocol.');
                        return;
                    }

                    // Show popup if protocol is safe or domain is safe
                    showPopup(sanitizedUrl, isSafe);
                }
            } catch (error) {
                console.error('Error handling link click:', error);
                showErrorPopup('An unexpected error occurred.');
            }
        });
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
