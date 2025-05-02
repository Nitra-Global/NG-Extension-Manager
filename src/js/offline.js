// Inject Custom CSS Styles
function injectOfflineDetectorCSS() {
    // Prevent injecting multiple times
    if (document.getElementById('offline-detector-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'offline-detector-styles';
    style.textContent = `
        /* Base Styles */
        :root {
            --offline-banner-bg: #fff3cd; /* Softer warning yellow */
            --offline-banner-color: #664d03;
            --offline-banner-border: #ffecb5;

            --offline-modal-overlay-bg: rgba(0, 0, 0, 0.6);
            --offline-modal-content-bg: #ffffff;
            --offline-modal-content-color: #333;
            --offline-modal-content-border: #cccccc;
            --offline-modal-shadow: 0 8px 30px rgba(0, 0, 0, 0.2); /* More pronounced shadow */

            --button-default-bg: #e9ecef;
            --button-default-color: #333;
            --button-default-border: #ced4da;
            --button-default-hover-bg: #d3d7da;

            --button-primary-bg: #007bff;
            --button-primary-color: white;
            --button-primary-border: #007bff;
            --button-primary-hover-bg: #0056b3;
             --button-primary-hover-border: #0056b3;

            --temporary-message-bg: rgba(50, 50, 50, 0.98); /* Darker, more opaque */
            --temporary-message-color: white;
             --temporary-message-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);


            --debug-bg: #f8f9fa;
            --debug-border: #e9ecef;
            --debug-color: #212529;
             --debug-heading-color: #0056b3; /* Darker blue for debug headings */
        }

        /* Dark Mode Styles */
        @media (prefers-color-scheme: dark) {
            :root {
                --offline-banner-bg: #7a6000; /* Darker warning yellow */
                --offline-banner-color: #ffecb5;
                --offline-banner-border: #997d00;

                --offline-modal-overlay-bg: rgba(0, 0, 0, 0.85);
                --offline-modal-content-bg: #343a40; /* Dark background */
                --offline-modal-content-color: #dee2e6; /* Light text */
                --offline-modal-content-border: #495057;
                --offline-modal-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);

                --button-default-bg: #495057;
                --button-default-color: #dee2e6;
                --button-default-border: #6c757d;
                --button-default-hover-bg: #5a6268;

                --button-primary-bg: #0056b3;
                --button-primary-color: white;
                --button-primary-border: #004085;
                --button-primary-hover-bg: #003870;
                --button-primary-hover-border: #003870;

                --temporary-message-bg: rgba(220, 220, 220, 0.95);
                --temporary-message-color: #333;
                 --temporary-message-shadow: 0 2px 10px rgba(255, 255, 255, 0.2);

                --debug-bg: #2c3034;
                --debug-border: #495057;
                --debug-color: #dee2e6;
                 --debug-heading-color: #7cb5ec; /* Lighter blue for debug headings */
            }

            #offline-banner .offline-icon {
                 filter: invert(100%); /* Invert icon color in dark mode */
            }
             #offline-help-modal-content a {
                 color: #7cb5ec; /* Lighter link color in dark mode */
             }
             #offline-help-modal-content a:hover,
             #offline-help-modal-content a:focus {
                 color: #9acfe9;
             }
             #offline-help-modal-content .debug-info p {
                background-color: rgba(255,255,255,0.05); /* Slight background tint */
             }
        }

        /* Reduced Motion Preference */
         @media (prefers-reduced-motion: reduce) {
             #offline-banner,
             #offline-help-modal,
             #temporary-status-message {
                 transition: none !important;
             }
              #offline-banner.is-visible,
              #offline-help-modal.is-visible,
              #temporary-status-message.is-visible {
                   /* Ensure display is set immediately if no transition */
                   display: flex !important; /* or block */
                   opacity: 1 !important;
                   visibility: visible !important;
              }
         }


        /* Banner Styles */
        #offline-banner {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            box-sizing: border-box; /* Include padding/border in element's total width */
            padding: 12px 20px;
            text-align: center;
            z-index: 99999; /* Ensure it's on top */
            background-color: var(--offline-banner-bg);
            color: var(--offline-banner-color);
            border-bottom: 1px solid var(--offline-banner-border);
            font-family: sans-serif;
            font-size: 15px;
            line-height: 1.5;
            display: none; /* Hidden by default */
            align-items: center;
            justify-content: center;
            gap: 15px;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out;
        }

        #offline-banner.is-visible {
            opacity: 1;
            visibility: visible;
            display: flex; /* Show as flex when visible */
        }

        /* Ensure flex display is correctly set when element is added/removed, override potential conflicts */
         body #offline-banner[style*="display: flex"] {
             display: flex !important;
         }
         /* Also ensure it doesn't interfere with initial layout before transitions */
          #offline-banner:not(.is-visible) {
              display: none !important;
          }


        #offline-banner .offline-icon {
            width: 20px;
            height: 20px;
            cursor: pointer;
            flex-shrink: 0;
            transition: filter 0.3s ease-in-out;
             outline: none; /* Handled by focus-visible */
        }

         #offline-banner .offline-icon:hover {
             opacity: 0.8;
         }
          #offline-banner .offline-icon:focus-visible {
              outline: 2px solid var(--offline-banner-color); /* Focus indicator using text color */
              outline-offset: 2px;
              border-radius: 2px; /* Match button focus */
          }


        #offline-banner button {
            padding: 4px 12px;
            cursor: pointer;
            border: 1px solid var(--button-default-border);
            background: var(--button-default-bg);
            color: var(--button-default-color);
            border-radius: 4px;
            font-size: 14px;
            flex-shrink: 0;
            transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, color 0.2s ease-in-out;
             outline: none; /* Handled by focus-visible */
        }

         #offline-banner button:hover {
             background-color: var(--button-default-hover-bg);
             /* No darken function in pure CSS, rely on pre-defined hover var */
         }
          #offline-banner button:focus-visible {
              outline: 2px solid var(--button-default-color);
              outline-offset: 2px;
          }


        /* Modal Styles */
        #offline-help-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: var(--offline-modal-overlay-bg);
            z-index: 100000; /* Even higher than banner */
            display: none; /* Hidden by default */
            justify-content: center;
            align-items: flex-start; /* Align items to the start (top) to allow margin auto below */
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out;
             /* Allow modal overlay itself to scroll if content pushes it down */
            overflow-y: auto;
             -webkit-overflow-scrolling: touch;
        }

        #offline-help-modal.is-visible {
            opacity: 1;
            visibility: visible;
            display: flex; /* Show as flex when visible */
        }

         /* Ensure flex display is correctly set, override potential conflicts */
         body #offline-help-modal[style*="display: flex"] {
             display: flex !important;
         }
          /* Also ensure it doesn't interfere with initial layout before transitions */
          #offline-help-modal:not(.is-visible) {
              display: none !important;
          }


        #offline-help-modal-content {
            background-color: var(--offline-modal-content-bg);
            color: var(--offline-modal-content-color);
            margin: 40px 20px auto; /* Margin on sides, auto below pushes to top */
            padding: 30px;
            border: 1px solid var(--offline-modal-content-border);
            width: 95%; /* Use more width on smaller screens */
            max-width: 600px;
            border-radius: 8px;
            box-shadow: var(--offline-modal-shadow);
            position: relative;
            font-family: sans-serif;
            line-height: 1.6;
            box-sizing: border-box; /* Include padding in width/height */
             /* Removed max-height/overflow-y here as the modal overlay handles scrolling */
        }

         @media (min-width: 768px) {
             #offline-help-modal-content {
                 margin: 50px auto; /* Center horizontally and vertically with auto margins */
                 max-height: calc(100vh - 100px); /* Re-add max-height for larger screens for better containment */
                 overflow-y: auto; /* Add scrolling back for content on larger screens */
             }
         }


        #offline-help-modal-content h2 {
            margin-top: 0;
            margin-bottom: 20px;
            font-size: 1.6em;
             color: inherit;
        }

        #offline-help-modal-content p {
            margin-bottom: 15px;
            font-size: 1em;
        }

        #offline-help-modal-content ol {
            padding-left: 25px;
            margin-bottom: 20px;
        }

         #offline-help-modal-content li {
             margin-bottom: 10px;
         }

         #offline-help-modal-content strong {
             font-weight: bold;
         }

         #offline-help-modal-content kbd {
             background-color: var(--debug-bg);
             padding: 2px 5px;
             border-radius: 3px;
             border: 1px solid var(--debug-border);
             font-size: 0.9em;
             font-family: monospace;
         }
         @media (prefers-color-scheme: dark) {
              #offline-help-modal-content kbd {
                   /* Use slightly different colors in dark mode kbd */
                   background-color: #495057;
                   border-color: #6c757d;
                   color: #dee2e6;
              }
         }


         #offline-help-modal-content a {
             color: #007bff;
             text-decoration: underline;
             transition: color 0.2s ease-in-out;
             outline: none; /* Handled by focus-visible */
         }

         #offline-help-modal-content a:hover {
             color: #0056b3;
         }
          #offline-help-modal-content a:focus-visible {
              outline: 2px solid;
              outline-offset: 2px;
          }


        #offline-help-modal-content button {
            padding: 10px 25px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 16px;
            font-weight: bold;
            transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out, border-color 0.2s ease-in-out;
            outline: none; /* Handled by focus-visible */
             border: 1px solid transparent; /* Add base border for focus outline consistency */
        }

         #offline-help-modal-content button:focus-visible {
              outline: 2px solid var(--button-primary-color); /* Default focus outline color */
              outline-offset: 2px;
         }

        /* Primary Button */
        #offline-help-modal-content button.button-primary {
             display: block; /* Ensure it's a block element below content */
            margin-top: 30px;
             width: auto;
             margin-left: auto;
             margin-right: auto;

            background-color: var(--button-primary-bg);
            color: var(--button-primary-color);
            border-color: var(--button-primary-border);
        }

         #offline-help-modal-content button.button-primary:hover {
             background-color: var(--button-primary-hover-bg);
             border-color: var(--button-primary-hover-border);
         }
          #offline-help-modal-content button.button-primary:focus-visible {
              outline-color: var(--button-primary-color);
          }


         /* Debug Info Section */
         #offline-help-modal-content .debug-info {
             margin-top: 30px;
             padding-top: 20px;
             border-top: 1px solid var(--offline-modal-content-border);
             font-size: 0.95em;
             word-break: break-word; /* Ensure long lines break */
         }

         #offline-help-modal-content .debug-info h3 {
             margin-top: 0;
             margin-bottom: 15px;
             font-size: 1.2em;
             color: var(--debug-heading-color); /* Use specific debug heading color */
         }

         #offline-help-modal-content .debug-info p {
             font-family: monospace;
             white-space: pre-wrap;
             background-color: var(--debug-bg);
             color: var(--debug-color);
             padding: 15px;
             border-radius: 4px;
             font-size: 0.9em;
             margin-bottom: 15px;
             border: 1px solid var(--debug-border);
             line-height: 1.4; /* Slightly tighter line spacing for code */
         }

          #offline-help-modal-content .debug-info button {
              font-size: 0.95em;
              padding: 8px 15px;
              margin-top: 10px; /* Space above button */
              background-color: var(--button-default-bg);
              color: var(--button-default-color);
              border: 1px solid var(--button-default-border);
              font-weight: normal;
              display: inline-block;
               transition: opacity 0.2s ease-in-out; /* Add transition for disabled state */
          }
           #offline-help-modal-content .debug-info button:hover {
              background-color: var(--button-default-hover-bg);
           }
            #offline-help-modal-content .debug-info button:focus-visible {
                outline-color: var(--button-default-color);
            }
            #offline-help-modal-content .debug-info button:disabled {
                 opacity: 0.6;
                 cursor: not-allowed;
            }


        /* Temporary Message Styles (Toast) */
        #temporary-status-message {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 25px;
            background-color: var(--temporary-message-bg);
            color: var(--temporary-message-color);
            border-radius: 5px;
            z-index: 100001; /* Highest z-index */
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.4s ease-in-out, visibility 0.4s ease-in-out;
            font-family: sans-serif;
            font-size: 15px;
            box-shadow: var(--temporary-message-shadow);
             pointer-events: none; /* Allow clicks to pass through */
             white-space: nowrap; /* Prevent wrapping if message is short */
             text-overflow: ellipsis; /* Add ellipsis if message is long */
             overflow: hidden;
             max-width: 90%; /* Limit max width */
        }

        #temporary-status-message.is-visible {
            opacity: 1;
            visibility: visible;
        }
    `;

    if (document.head) {
        document.head.appendChild(style);
    } else {
        // Fallback if head is not available immediately
        document.addEventListener('DOMContentLoaded', () => {
            if (document.head && !document.getElementById('offline-detector-styles')) {
                 document.head.appendChild(style);
            }
        });
    }
}

// --- State and Helper Variables ---
let modalTriggerElement = null; // To store the element that opened the modal for focus return
let lastOnlineState = navigator.onLine; // Browser's reported state
let lastOfflineEventTime = null;
let lastOnlineEventTime = null;
let realConnectivityChecking = false; // State variable for async check

// Store last real connectivity check result for display
let lastConnectivityCheckResult = null;


// --- Helper Functions ---

/**
 * Checks if the browser reports being offline.
 * Note: navigator.onLine can be unreliable.
 */
function isOffline() {
    return !navigator.onLine;
}

/**
 * Formats a duration in milliseconds into a human-readable string.
 * @param {number} ms - Duration in milliseconds.
 * @returns {string}
 */
function formatDuration(ms) {
     if (ms === undefined || ms === null) return 'N/A';
     if (ms < 1000) return `${ms}ms`;
     return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Attempts a real network check by fetching a small, reliable resource.
 * Returns a result object {success: boolean, ..., duration: number}.
 */
async function checkRealConnectivity() {
    if (realConnectivityChecking) {
         console.log("Real connectivity check already in progress.");
         return null; // Indicate that a check is already running
    }

    realConnectivityChecking = true;
    console.log("Starting real connectivity check...");
    const startTime = Date.now();

    try {
        const testUrl = chrome.runtime.getURL("../../public/icons/svg/info.svg") + '?cachebust=' + Date.now(); // Add cache bust
        const timeoutDuration = 8000; // Increased timeout to 8 seconds
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

        const response = await fetch(testUrl, {
            method: 'HEAD',
            cache: 'no-store',
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        const endTime = Date.now();
        const duration = endTime - startTime;

        if (response.ok) {
             console.log("Real connectivity check successful.");
             lastConnectivityCheckResult = { success: true, duration: duration };
        } else {
             console.log(`Real connectivity check failed: Status ${response.status}`);
             lastConnectivityCheckResult = { success: false, status: response.status, duration: duration };
        }

    } catch (error) {
        const endTime = Date.now();
        const duration = endTime - startTime;
         console.error("Real connectivity check failed:", error);
          // Capture specific error name for clearer reporting
          lastConnectivityCheckResult = { success: false, error: error.name === 'TypeError' ? 'Network Error (TypeError)' : error.message, duration: duration };

    } finally {
        realConnectivityChecking = false;
         // Re-enable the button after the check completes
         const recheckButton = document.getElementById("offline-debug-recheck-btn");
         if (recheckButton) {
              recheckButton.disabled = false;
              recheckButton.textContent = "Run Test Again"; // Reset button text
         }
    }

     // Update UI if the modal is currently open
     const helpModal = document.getElementById("offline-help-modal");
     if (helpModal && helpModal.classList.contains('is-visible')) {
         updateDebugInfoDisplay(); // Update only the display part
     }

     return lastConnectivityCheckResult;
}


/**
 * Gets a list of focusable elements within a container.
 * @param {Element} container
 * @returns {NodeList}
 */
function getFocusableElements(container) {
    return container.querySelectorAll(
        'button:not([disabled]), [href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );
}

/**
 * Gets network information using the Network Information API if available.
 * @returns {string} Formatted network info or message.
 */
function getNetworkInfo() {
     // Check if Network Information API is supported
    if (navigator.connection) {
        const connection = navigator.connection;
        let info = 'Network Information API:\n';
        info += `  Effective Type: ${connection.effectiveType || 'N/A'}\n`; // e.g., '4g', '3g'
        info += `  RTT: ${connection.rtt !== undefined ? connection.rtt + 'ms' : 'N/A'}\n`; // Estimated round trip time
        info += `  Downlink: ${connection.downlink !== undefined ? connection.downlink + 'Mb/s' : 'N/A'}\n`; // Estimated downlink speed
        info += `  Save Data: ${connection.saveData !== undefined ? connection.saveData : 'N/A'}\n`; // Data saver mode
        // Add more properties if needed, check browser compatibility
        // info += ` Type: ${connection.type || 'N/A'}\n`; // e.g., 'wifi', 'cellular' - deprecated/less reliable
        return info;
    } else {
        return 'Network Information API: Not supported by this browser.';
    }
}


// --- Element Creation Functions ---

/**
 * Creates the offline banner element structure.
 * Styles are handled by CSS classes.
 * @returns {HTMLDivElement}
 */
function createOfflineBannerElement() {
    const offlineBanner = document.createElement("div");
    offlineBanner.id = "offline-banner";
    offlineBanner.setAttribute('role', 'alert');
    offlineBanner.setAttribute('aria-live', 'polite');
    offlineBanner.classList.add('offline-detector-ui');
    // Ensure box-sizing even if CSS isn't injected immediately
    offlineBanner.style.boxSizing = 'border-box';


    offlineBanner.innerHTML = `
        <span>You appear to be offline or experiencing connection issues.</span>
        <img id="offline-help-icon" class="offline-icon" src="${chrome.runtime.getURL("../../public/icons/svg/info.svg")}" alt="Information icon" title="More information about connection problems" aria-label="More information about connection problems" tabindex="0">
        <button id="dismiss-offline-banner">Dismiss</button>
    `;

    // Add listeners *after* elements are in innerHTML
    const helpIcon = offlineBanner.querySelector("#offline-help-icon");
    if (helpIcon) {
         helpIcon.addEventListener("click", (event) => {
             modalTriggerElement = helpIcon; // Store element that opened modal
             showHelpModal();
         });
          helpIcon.addEventListener("keydown", (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  modalTriggerElement = helpIcon;
                  showHelpModal();
              }
          });
         helpIcon.ondragstart = function() { return false; };
    }

    const dismissButton = offlineBanner.querySelector("#dismiss-offline-banner");
    if (dismissButton) {
        dismissButton.addEventListener("click", removeOfflineBanner);
    }

    return offlineBanner;
}

/**
 * Creates the help modal element structure.
 * Styles are handled by CSS classes.
 * @returns {HTMLDivElement}
 */
function createHelpModalElement() {
    const helpModal = document.createElement("div");
    helpModal.id = "offline-help-modal";
    helpModal.setAttribute('role', 'dialog');
    helpModal.setAttribute('aria-modal', 'true');
    helpModal.setAttribute('aria-labelledby', 'offline-modal-title');
    helpModal.classList.add('offline-detector-ui');

    const modalContent = document.createElement("div");
    modalContent.id = "offline-help-modal-content";
    // Ensure box-sizing even if CSS isn't injected immediately
     modalContent.style.boxSizing = 'border-box';


    modalContent.innerHTML = `
        <h2 id="offline-modal-title">Troubleshooting Connection Issues</h2>
        <p>This message indicates a potential problem with your internet connection that is preventing full access or functionality.</p>
        <p>Here are common steps to try:</p>
        <ol>
            <li><strong>Check Your Connection:</strong> Ensure you are connected to the correct Wi-Fi, or your Ethernet cable is securely plugged in.</li>
            <li><strong>Restart Equipment:</strong> Turn off your router and modem for 30 seconds, then turn them back on. Wait a few minutes for them to reconnect.</li>
            <li><strong>Reload Page:</strong> A simple refresh can sometimes fix temporary glitches. Press <kbd>F5</kbd> (or <kbd>Cmd+R</kbd> on Mac).</li>
            <li><strong>Test Other Sites:</strong> See if you can access other websites (e.g., <a href="https://www.google.com" target="_blank" rel="noopener noreferrer">google.com</a>, <a href="https://www.example.com" target="_blank" rel="noopener noreferrer">example.com</a>). If they also fail, the problem is likely with your internet connection itself.</li>
            <li><strong>Disable VPN/Proxy:</strong> Temporarily turn off any VPN or proxy services you're using.</li>
            <li><strong>Firewall/Antivirus:</strong> Check your computer's security software to ensure it's not blocking your browser's internet access.</li>
            <li><strong>Restart Computer:</strong> A full system restart can resolve many underlying issues.</li>
        </ol>
        <p>If these steps don't help, the problem might be with your Internet Service Provider (ISP) or network configuration. Consider contacting your ISP or IT support.</p>

        <div class="debug-info">
            <h3>Technical Information</h3>
            <p id="offline-debug-content">Gathering technical information...</p>
             <button id="offline-debug-recheck-btn">Run Test Again</button>
        </div>

        <button id="close-offline-help" class="button-primary">Got it!</button>
    `;

    helpModal.appendChild(modalContent);

    // Add close listeners
    modalContent.querySelector("#close-offline-help").addEventListener("click", hideHelpModal);

    // Add debug re-check listener
    modalContent.querySelector("#offline-debug-recheck-btn").addEventListener("click", updateDebugInfo);


    // Click outside the modal content to close
    helpModal.addEventListener("click", (event) => {
        if (event.target === helpModal) {
            hideHelpModal();
        }
    });

    return helpModal;
}

// --- Banner Functions ---

/**
 * Applies or shows the offline banner.
 */
function applyOfflineBanner() {
    let offlineBanner = document.getElementById("offline-banner");

    // If banner doesn't exist and body is available, create and append it
    if (!offlineBanner && document.body) {
        offlineBanner = createOfflineBannerElement();
        document.body.prepend(offlineBanner);
    }

    // If banner exists, show it
    if (offlineBanner) {
        // Ensure display is flex immediately so transitions can start
         offlineBanner.style.display = 'flex';
        // Use classes to manage visibility and transitions via CSS
        offlineBanner.classList.add('is-visible');
         // Force reflow
         void offlineBanner.offsetWidth;
    }
}

/**
 * Removes or hides the offline banner.
 */
function removeOfflineBanner() {
    const offlineBanner = document.getElementById("offline-banner");
    if (offlineBanner) {
        // Use classes to manage visibility and transitions via CSS
        offlineBanner.classList.remove('is-visible');
        // Add a listener for the end of the transition to set display: none
         offlineBanner.addEventListener('transitionend', function handler(event) {
             if (event.propertyName === 'opacity') {
                 offlineBanner.style.display = 'none';
                 offlineBanner.removeEventListener('transitionend', handler); // Clean up listener
             }
         }, { once: true }); // Use once: true for automatic listener cleanup

          // Fallback: if element isn't visible when remove is called, hide it immediately
          if (!offlineBanner.classList.contains('is-visible')) {
              offlineBanner.style.display = 'none';
          }
    }
}

// --- Modal Functions ---

/**
 * Shows the help modal. Creates it if it doesn't exist. Handles focus.
 */
async function showHelpModal() {
    let helpModal = document.getElementById("offline-help-modal");

    // If modal doesn't exist and body is available, create and append it
    if (!helpModal && document.body) {
        helpModal = createHelpModalElement();
        document.body.appendChild(helpModal);
         // Add keydown listener *once* when modal element is created
         // This handles Escape key and Tab trap
         helpModal.addEventListener('keydown', handleModalKeydown);
    }

    // If modal exists, show it and manage focus
    if (helpModal) {
        // Update debug info BEFORE showing the modal, and await the async check
        await updateDebugInfo();

        helpModal.classList.add('is-visible');
        helpModal.style.display = 'flex'; // Ensure display is set for flex centering before transition
         // Force reflow
         void helpModal.offsetWidth;

         // Use a timeout to ensure modal is displayed before attempting focus management
         setTimeout(() => {
            const focusableElements = getFocusableElements(helpModal);
            // Find a suitable element to focus first (e.g., close button or first interactive element)
            const firstFocusable = helpModal.querySelector('#close-offline-help') || focusableElements[0];
            if (firstFocusable) {
                firstFocusable.focus();
            }
         }, 50); // Small delay
    }
}

/**
 * Hides the help modal. Returns focus to the trigger element.
 */
function hideHelpModal() {
     const helpModal = document.getElementById("offline-help-modal");
     if (helpModal) {
        // Use classes to manage visibility and transitions via CSS
         helpModal.classList.remove('is-visible');
         helpModal.addEventListener('transitionend', function handler(event) {
              if (event.propertyName === 'opacity') {
                  helpModal.style.display = 'none';
                  helpModal.removeEventListener('transitionend', handler); // Clean up listener

                   // Return focus to the element that triggered the modal
                   if (modalTriggerElement && typeof modalTriggerElement.focus === 'function') {
                       modalTriggerElement.focus();
                   }
              }
         }, { once: true }); // Use once: true

          // Fallback: if element isn't visible when hide is called, hide it immediately
          if (!helpModal.classList.contains('is-visible')) {
              helpModal.style.display = 'none';
               if (modalTriggerElement && typeof modalTriggerElement.focus === 'function') {
                   modalTriggerElement.focus();
               }
          }
     }
}

/**
 * Handles keydown events on the modal for focus trap and escape key.
 * @param {KeyboardEvent} event
 */
function handleModalKeydown(event) {
    const helpModal = document.getElementById("offline-help-modal");
     if (!helpModal || !helpModal.classList.contains('is-visible')) {
         return; // Only run if modal is visible
     }

    // Handle Escape key
    if (event.key === 'Escape') {
        event.preventDefault(); // Prevent default browser behavior
        hideHelpModal();
        return; // Stop further processing
    }

    // Handle Tab key for focus trapping
     if (event.key === 'Tab') {
         const focusable = getFocusableElements(helpModal);
         if (focusable.length === 0) {
             event.preventDefault(); // No focusable elements, prevent tabbing out
             return;
         }

         const first = focusable[0];
         const last = focusable[focusable.length - 1];
         const activeElement = document.activeElement;

         if (event.shiftKey) { // Shift + Tab
             if (activeElement === first || !helpModal.contains(activeElement)) {
                 last.focus();
                 event.preventDefault();
             }
         } else { // Tab
             if (activeElement === last || !helpModal.contains(activeElement)) {
                 first.focus();
                 event.preventDefault();
             }
         }
     }
}


// --- Debugging Functions ---

/**
 * Updates the debug information display in the modal based on stored state and results.
 */
function updateDebugInfoDisplay() {
     const debugContentElement = document.getElementById("offline-debug-content");
     const recheckButton = document.getElementById("offline-debug-recheck-btn");

     if (!debugContentElement) {
         console.error("Debug info element not found during display update.");
         return;
     }

     let debugInfoText = '';

     debugInfoText += `Browser navigator.onLine: ${navigator.onLine}\n`;
     debugInfoText += `Last Known State: ${lastOnlineState ? 'Online' : 'Offline'}\n`;

     if (lastOfflineEventTime) {
        const timeSinceOffline = Date.now() - lastOfflineEventTime.getTime();
        debugInfoText += `Last Offline Event: ${lastOfflineEventTime.toLocaleString()} (${formatDuration(timeSinceOffline)} ago)\n`;
     }
      if (lastOnlineEventTime) {
         const timeSinceOnline = Date.now() - lastOnlineEventTime.getTime();
         debugInfoText += `Last Online Event: ${lastOnlineEventTime.toLocaleString()} (${formatDuration(timeSinceOnline)} ago)\n`;
     }

     debugInfoText += `User Agent: ${navigator.userAgent}\n`;
     debugInfoText += getNetworkInfo(); // Add Network Information API details

     debugInfoText += `\n--- Connectivity Test ---\n`; // Clear separator

     if (realConnectivityChecking) {
         debugInfoText += `Status: Test in progress...`;
         if (recheckButton) {
              recheckButton.disabled = true;
              recheckButton.textContent = "Testing...";
         }
     } else if (lastConnectivityCheckResult) {
         const result = lastConnectivityCheckResult;
         debugInfoText += `Status: ${result.success ? 'Successful' : 'Failed'}\n`;
         if (result.duration !== undefined) debugInfoText += `Duration: ${formatDuration(result.duration)}\n`;

         if (!result.success) {
             if (result.error === 'Timeout') {
                  debugInfoText += `Reason: Test timed out after ${formatDuration(8000)}.\n`; // Reference timeout duration
             } else if (result.error === 'Network Error (TypeError)') {
                  debugInfoText += `Reason: Fundamental Network Error (TypeError).\n`;
                  debugInfoText += `  Possible Causes: No network connection, firewall blocking, incorrect proxy.\n`;
             } else if (result.error) {
                  debugInfoText += `Error: ${result.error}\n`;
             }
             if (result.status) debugInfoText += `HTTP Status: ${result.status}\n`;
         }

          if (recheckButton) {
               recheckButton.disabled = false;
               recheckButton.textContent = "Run Test Again";
          }

     } else {
         debugInfoText += `Status: No test run yet.\n`;
          if (recheckButton) recheckButton.disabled = false;
     }

     debugContentElement.textContent = debugInfoText; // Update the UI element
}


/**
 * Initiates a real connectivity test and updates the debug info display.
 * Can be called initially or by clicking the re-check button.
 */
async function updateDebugInfo() {
     updateDebugInfoDisplay(); // Update display immediately with 'In progress...'
     await checkRealConnectivity(); // Run the async check
     // updateDebugInfoDisplay() is also called in the finally block of checkRealConnectivity
}


// --- Temporary Message / Toast Function ---
/**
 * Shows a small temporary message (like a toast).
 * @param {string} message - The message to display.
 * @param {number} duration - How long to display the message in milliseconds.
 */
function showTemporaryMessage(message, duration = 4000) {
    let messageElement = document.getElementById("temporary-status-message");

    if (!messageElement && document.body) {
        messageElement = document.createElement("div");
        messageElement.id = "temporary-status-message";
        messageElement.classList.add('offline-detector-ui'); // Add base class
        document.body.appendChild(messageElement);
         // Add transitionend listener *once* to manage display
         messageElement.addEventListener('transitionend', function handler(event) {
             if (event.propertyName === 'opacity' && !messageElement.classList.contains('is-visible')) {
                 messageElement.style.display = 'none';
             }
         });
    }

    if (messageElement) {
        // Clear any existing timer
        if (messageElement._currentTimer) {
             clearTimeout(messageElement._currentTimer);
        }

        messageElement.textContent = message;

        // Ensure display is block before making visible
         messageElement.style.display = 'block';

        // Use classes for transition
        // Force reflow
        void messageElement.offsetWidth;

        messageElement.classList.add('is-visible');

        // Set a timeout to start the fade-out
        messageElement._currentTimer = setTimeout(() => {
            messageElement.classList.remove('is-visible');
            // The transitionend listener added once will handle setting display: none
        }, duration);

        // Fallback if transitions are disabled or don't fire quickly
        if (window.getComputedStyle(messageElement).transitionProperty === 'none' ||
            window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
             setTimeout(() => {
                 messageElement.style.display = 'none';
             }, duration + 50); // A little extra delay
        }
    }
}


// --- Initialization and Event Listeners ---

document.addEventListener("DOMContentLoaded", () => {
    // 1. Inject CSS styles first
    injectOfflineDetectorCSS();

    // 2. Check initial state
    if (isOffline()) {
        applyOfflineBanner();
        lastOnlineState = false;
        lastOfflineEventTime = new Date();
    } else {
        lastOnlineState = true;
        lastOnlineEventTime = new Date();
    }

    // 3. Listen for online/offline events
    window.addEventListener("online", () => {
        console.log("Navigator reports online.");
        // Use a slight delay before checking our state and removing banner
         setTimeout(() => {
             if (!isOffline() && !lastOnlineState) { // Check real state and our state
                 lastOnlineState = true;
                 lastOnlineEventTime = new Date();
                 removeOfflineBanner();
                  // Give the banner a moment to start fading before showing the toast
                  setTimeout(() => {
                      showTemporaryMessage("You're back online!");
                  }, 100);
             }
         }, 500); // Small delay
    });

    window.addEventListener("offline", () => {
        console.log("Navigator reports offline.");
         // Use a slight delay before checking our state and applying banner
         setTimeout(() => {
             if (isOffline() && lastOnlineState) { // Check real state and our state
                lastOnlineState = false;
                lastOfflineEventTime = new Date();
                applyOfflineBanner();
             }
         }, 500); // Small delay
    });

});

// Note on the "extra html element" instruction: As explained, elements need to be
// attached to the document (like document.body) to be visible and interactive.
// The code creates the necessary banner, modal, and toast elements and attaches them
// to the body when they are needed, managing their visibility via CSS classes and display property.
