// Function to check offline status and set the offline mode
function checkOfflineStatus() {
    try {
        if (!navigator.onLine) {
            enableOfflineMode();
            showOfflineWarning();
        } else {
            disableOfflineMode();
        }
    } catch (error) {
        console.error('Error checking offline status:', error);
    }
}

// Enable offline mode with restricted access
function enableOfflineMode() {
    try {
        // Hide elements that require internet connection
        const restrictedResources = document.querySelectorAll('img, script, link, iframe, video, audio');
        restrictedResources.forEach(element => {
            const src = element.src || element.href;
            if (src && !src.endsWith('offline.js')) {
                element.dataset.originalDisplay = element.style.display; // Store original display
                element.style.display = 'none'; // Hide restricted resources
            }
        });

        // Enable access to cached data or offline functionalities
        enableCachedAccess();
    } catch (error) {
        console.error('Error enabling offline mode:', error);
    }
}

// Disable offline mode and restore functionality
function disableOfflineMode() {
    try {
        const restrictedResources = document.querySelectorAll('img, script, link, iframe, video, audio');
        restrictedResources.forEach(element => {
            if (element.dataset.originalDisplay !== undefined) {
                element.style.display = element.dataset.originalDisplay; // Restore original display
                delete element.dataset.originalDisplay;
            } else {
                element.style.display = ''; // Show all elements
            }
        });

        // Disable offline functionalities
        disableCachedAccess();
        removeOfflineWarning();
    } catch (error) {
        console.error('Error disabling offline mode:', error);
    }
}

// Enable access to cached data (placeholder function)
function enableCachedAccess() {
    try {
        // Implement functionality to display cached data
        const cachedSection = document.getElementById('cached-data-section');
        if (cachedSection) {
            cachedSection.style.display = 'block';
        }
    } catch (error) {
        console.error('Error enabling cached access:', error);
    }
}

// Disable access to cached data (placeholder function)
function disableCachedAccess() {
    try {
        const cachedSection = document.getElementById('cached-data-section');
        if (cachedSection) {
            cachedSection.style.display = 'none';
        }
    } catch (error) {
        console.error('Error disabling cached access:', error);
    }
}

// Show an offline warning with additional options
function showOfflineWarning() {
    try {
        if (!document.getElementById('offline-warning-style')) {
            const style = document.createElement('style');
            style.id = 'offline-warning-style';
            style.textContent = `
                #offline-warning {
                    background-color: rgba(245, 124, 0, 0.95);
                    color: white;
                    padding: 15px 25px;
                    position: fixed;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10000;
                    font-family: 'Inter', sans-serif;
                    border-radius: 5px;
                    text-align: center;
                    width: auto;
                    max-width: 350px;
                    font-size: 14px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    animation: slideDown 0.5s ease;
                }

                @keyframes slideDown {
                    from { transform: translate(-50%, -20%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }

                #offline-warning a {
                    color: #1a73e8;
                    text-decoration: underline;
                    margin-top: 10px;
                    display: inline-block;
                    font-size: 13px;
                    cursor: pointer;
                }

                /* Reconnect Notification */
                #reconnect-notification {
                    background-color: #34a853;
                    color: white;
                    padding: 10px 20px;
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    z-index: 10001;
                    font-family: 'Inter', sans-serif;
                    border-radius: 5px;
                    text-align: center;
                    font-size: 14px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    animation: fadeIn 0.5s ease;
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                /* Help Modal Styles */
                #help-modal {
                    display: none; /* Hidden by default */
                    position: fixed;
                    z-index: 10002;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    background-color: rgba(0,0,0,0.4);
                    font-family: 'Inter', sans-serif;
                }

                #help-modal-content {
                    background-color: #fefefe;
                    margin: 5% auto;
                    padding: 20px;
                    border: 1px solid #888;
                    width: 80%;
                    max-width: 600px;
                    border-radius: 8px;
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                    animation: fadeInModal 0.3s ease;
                }

                @keyframes fadeInModal {
                    from { opacity: 0; transform: translateY(-20px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                #help-modal-content h2 {
                    margin-top: 0;
                    font-size: 20px;
                }

                #help-modal-content .close {
                    color: #aaa;
                    float: right;
                    font-size: 28px;
                    font-weight: bold;
                    cursor: pointer;
                }

                #help-modal-content .close:hover,
                #help-modal-content .close:focus {
                    color: black;
                    text-decoration: none;
                    cursor: pointer;
                }

                /* Skeleton Loader Styles */
                .skeleton {
                    background-color: #e2e2e2;
                    border-radius: 4px;
                    margin: 10px 0;
                    position: relative;
                    overflow: hidden;
                }

                .skeleton::after {
                    content: '';
                    display: block;
                    position: absolute;
                    top: 0;
                    left: -150px;
                    height: 100%;
                    width: 150px;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
                    animation: loading 1.5s infinite;
                }

                @keyframes loading {
                    0% {
                        left: -150px;
                    }
                    50% {
                        left: 100%;
                    }
                    100% {
                        left: 100%;
                    }
                }
            `;
            document.head.appendChild(style);
        }

        // Create warning div if it doesn't exist
        if (!document.getElementById('offline-warning')) {
            const warning = document.createElement('div');
            warning.id = 'offline-warning';
            warning.setAttribute('role', 'alert'); // Accessibility: alert role
            warning.innerHTML = `
                <strong>Offline Mode Active (Experimental)</strong><br>
                Some features are limited.<br>
                <span id="open-help" style="color: #1a73e8; text-decoration: underline; cursor: pointer;">Help</span>
            `;
            document.body.appendChild(warning);

            // Add event listener for help
            document.getElementById('open-help').addEventListener('click', showHelpModal);
        }
    } catch (error) {
        console.error('Error showing offline warning:', error);
    }
}

// Remove the offline warning and any reconnect notifications
function removeOfflineWarning() {
    try {
        const warning = document.getElementById('offline-warning');
        if (warning) {
            warning.remove(); // Remove warning from DOM
        }

        const reconnectNotification = document.getElementById('reconnect-notification');
        if (reconnectNotification) {
            reconnectNotification.remove(); // Remove reconnect notification
        }
    } catch (error) {
        console.error('Error removing offline warning:', error);
    }
}

// Show a reconnect notification when back online
function showReconnectNotification() {
    try {
        // Avoid duplicating the notification
        if (!document.getElementById('reconnect-notification')) {
            const notification = document.createElement('div');
            notification.id = 'reconnect-notification';
            notification.innerHTML = `
                <strong>Back Online!</strong><br>
                Offline mode is now disabled.
            `;
            document.body.appendChild(notification);

            // Automatically remove the notification after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }
    } catch (error) {
        console.error('Error showing reconnect notification:', error);
    }
}

// Show help modal with additional information
function showHelpModal() {
    const modal = document.createElement('div');
    modal.id = 'help-modal';

    const modalContent = document.createElement('div');
    modalContent.id = 'help-modal-content';
    modalContent.innerHTML = `
        <span class="close" id="close-modal">&times;</span>
        <h2>Help: Offline Mode</h2>
        <p>This is a temporary offline mode that limits certain features. To use the full functionality, please connect to the internet.</p>
        <p>For more assistance, please contact support or refer to our documentation.</p>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Show modal
    modal.style.display = 'block';

    // Close modal event listener
    document.getElementById('close-modal').addEventListener('click', closeHelpModal);
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeHelpModal();
        }
    });
}

// Close help modal
function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) {
        modal.remove();
    }
}

// Check online status on load
window.addEventListener('load', checkOfflineStatus);

// Check for online status changes
window.addEventListener('online', () => {
    disableOfflineMode();
    showReconnectNotification();
});

window.addEventListener('offline', checkOfflineStatus);
