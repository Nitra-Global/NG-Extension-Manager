// Enhanced Extension Verification Modal

class ExtensionVerificationModal {
    constructor() {
        // Configuration
        this.COOLDOWN_TIME = 10000; // 10-second cooldown between API requests
        this.VERIFIED_API_URL = 'https://api.jsonsilo.com/public/9739f42d-9634-4592-8251-e5c989a46310';
        
        // State tracking
        this.lastApiRequestTime = 0;
        
        // Bind methods to maintain correct context
        this.init = this.init.bind(this);
        this.createModal = this.createModal.bind(this);
        this.openModal = this.openModal.bind(this);
        this.closeModal = this.closeModal.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        this.verifyExtension = this.verifyExtension.bind(this);
    }

    // Initialize the entire extension verification system
    init() {
        this.createModal();
        this.createMeatballsMenuButton();
        this.addGlobalStyles();
        this.setupMobileResponsiveness();
    }

    // Add global styles to improve performance and consistency
    addGlobalStyles() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
            
            #extensionModal {
                --bg-dark: #1b1b1b;
                --bg-darker: #131314;
                --accent-color: #004a77;
                --text-light: #ffffff;
                --error-color: #d9534f;
                --success-color: #28a745;
            }

            #extensionModal * {
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
                transition: all 0.3s ease;
            }

            #extensionModal .modal-content {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }

            #extensionModal .loading-bar {
                width: 100%;
                height: 4px;
                background-color: var(--bg-darker);
                border-radius: 20px;
                overflow: hidden;
            }

            #extensionModal .loading-progress {
                width: 0%;
                height: 100%;
                background-color: var(--accent-color);
                transition: width 0.3s ease;
            }

            #extensionModal .btn {
                padding: 10px 16px;
                border-radius: 8px;
                border: none;
                cursor: pointer;
                font-weight: 600;
                text-align: center;
                width: 100%;
            }

            #extensionModal .btn-primary {
                background-color: var(--accent-color);
                color: var(--text-light);
            }

            #extensionModal .btn-secondary {
                background-color: #6c757d;
                color: var(--text-light);
                margin-top: 8px;
            }

            #extensionModal .status-message {
                text-align: center;
                font-weight: 500;
            }

            #extensionModal .help-text {
                font-size: 0.8em;
                color: #aaa;
                text-align: center;
                margin-top: 16px;
            }

            #extensionModal .info-section {
                background-color: var(--bg-darker);
                border-radius: 10px;
                padding: 16px;
                margin-top: 16px;
            }

            /* Mobile Responsiveness */
            @media (max-width: 480px) {
                #extensionModal {
                    width: 95%;
                    max-width: 95%;
                    margin: 0 auto;
                    top: 50%;
                    transform: translate(-50%, -50%);
                    padding: 16px;
                }
            }
        `;
        document.head.appendChild(styleElement);
    }

    // Setup additional mobile responsiveness
    setupMobileResponsiveness() {
        // Adjust for mobile devices
        window.addEventListener('resize', () => {
            if (this.modal) {
                const width = window.innerWidth;
                if (width <= 480) {
                    this.modal.style.width = '95%';
                    this.modal.style.maxWidth = '95%';
                } else {
                    this.modal.style.width = '90%';
                    this.modal.style.maxWidth = '420px';
                }
            }
        });
    }

    // Create the modal with improved structure and accessibility
    createModal() {
        // Create modal container
        this.modal = document.createElement('div');
        this.modal.id = 'extensionModal';
        this.modal.setAttribute('role', 'dialog');
        this.modal.setAttribute('aria-modal', 'true');
        this.modal.setAttribute('aria-labelledby', 'modal-title');
        
        // Improved modal structure with more comprehensive information
        this.modal.innerHTML = `
            <div class="modal-content">
                <h2 id="modal-title">Extension Verification</h2>
                
                <div id="verificationStatus" 
                     class="status-message" 
                     aria-live="polite">
                    Waiting for verification...
                </div>
                
                <div id="loadingBar" class="loading-bar" style="display: none;">
                    <div id="loadingProgress" class="loading-progress"></div>
                </div>
                
                <div id="actionContainer" class="action-container">
                    <button id="confirmButton" class="btn btn-primary" style="display: none;">Verify Extension</button>
                    <button id="closeModalBtn" class="btn btn-secondary">Close</button>
                </div>
                
                <div class="info-section">
                    <h3>What is Extension Verification?</h3>
                    <p>This tool helps you verify the authenticity and safety of browser extensions.</p>
                    
                    <h3>Troubleshooting</h3>
                    <ul>
                        <li>Ensure you have a stable internet connection</li>
                        <li>Check that the extension ID is correct</li>
                        <li>Wait 10 seconds between verification attempts</li>
                    </ul>
                </div>

                <p class="help-text">
                    If verification fails, check your connection or try again later.
                </p>
            </div>
        `;

        // Add styles directly to improve performance
        this.modal.style.cssText = `
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90%;
            max-width: 420px;
            background-color: var(--bg-dark);
            border-radius: 20px;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
            padding: 24px;
            z-index: 1000;
            color: var(--text-light);
            max-height: 90vh;
            overflow-y: auto;
        `;

        // Attach to document
        document.body.appendChild(this.modal);

        // Event Listeners
        this.modal.querySelector('#closeModalBtn')
            .addEventListener('click', this.closeModal);
        
        this.modal.querySelector('#confirmButton')
            .addEventListener('click', () => {
                const extensionId = this.getExtensionIdFromUrl();
                if (extensionId) {
                    this.verifyExtension(extensionId);
                }
            });

        // Close modal when clicking outside
        document.addEventListener('click', this.handleOutsideClick);
    }

    // Handle clicks outside the modal
    handleOutsideClick(event) {
        const modal = document.getElementById('extensionModal');
        const meatballButton = document.getElementById('meatballsMenuButton');
        
        if (modal && 
            modal.style.display === 'block' && 
            !modal.contains(event.target) && 
            (!meatballButton || !meatballButton.contains(event.target))) {
            this.closeModal();
        }
    }

    // Create the meatballs menu button with improved accessibility
    createMeatballsMenuButton() {
        const button = document.createElement('button');
        button.id = 'meatballsMenuButton';
        button.setAttribute('aria-label', 'Open Extension Verification Menu');
        
        button.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            background: none;
            border: none;
            cursor: pointer;
            z-index: 1001;
            outline: none;
            transition: transform 0.2s ease;
        `;
        
        const icon = document.createElement('img');
        icon.src = 'icons/meatball.svg';
        icon.alt = 'Menu';
        icon.style.cssText = 'width: 32px; height: 32px;';
        
        button.appendChild(icon);
        document.body.appendChild(button);

        // Ensure multiple event listeners aren't added
        button.removeEventListener('click', this.handleMeatballClick);
        button.addEventListener('click', this.handleMeatballClick.bind(this));

        // Add hover and click animations
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
        });
    }

    // Centralized method to handle meatball button click
    handleMeatballClick() {
        const extensionId = this.getExtensionIdFromUrl();
        if (extensionId) {
            this.openModal(extensionId);
        } else {
            // Fallback if no extension ID is found
            this.showErrorMessage('No extension ID found in the URL.');
        }
    }

    // Open the modal with improved error handling
    openModal(extensionId) {
        const statusElement = this.modal.querySelector('#verificationStatus');
        const loadingBar = this.modal.querySelector('#loadingBar');
        const loadingProgress = this.modal.querySelector('#loadingProgress');
        const confirmButton = this.modal.querySelector('#confirmButton');

        // Reset modal state
        this.modal.style.display = 'block';
        loadingBar.style.display = 'block';
        loadingProgress.style.width = '0%';
        confirmButton.style.display = 'none';
        statusElement.style.color = '';
        statusElement.textContent = 'Preparing verification...';

        // Cooldown check
        const currentTime = Date.now();
        if (currentTime - this.lastApiRequestTime < this.COOLDOWN_TIME) {
            this.handleCooldown(currentTime);
            return;
        }

        // Prepare for verification
        this.lastApiRequestTime = currentTime;
        this.prepareForVerification(extensionId);
    }

    // Prepare for verification with better UX
    prepareForVerification(extensionId) {
        const statusElement = this.modal.querySelector('#verificationStatus');
        const loadingBar = this.modal.querySelector('#loadingBar');
        const loadingProgress = this.modal.querySelector('#loadingProgress');
        const confirmButton = this.modal.querySelector('#confirmButton');

        // Check online status
        if (!navigator.onLine) {
            this.showErrorMessage('You are offline. Check your internet connection.');
            return;
        }

        // Simulate initial loading
        loadingProgress.style.width = '30%';
        statusElement.textContent = 'Initializing verification...';

        // Start verification after a short delay to show loading state
        setTimeout(() => {
            this.verifyExtension(extensionId);
        }, 500);
    }

    // Handle cooldown period with countdown
    handleCooldown(currentTime) {
        const statusElement = this.modal.querySelector('#verificationStatus');
        const loadingBar = this.modal.querySelector('#loadingBar');
        const loadingProgress = this.modal.querySelector('#loadingProgress');
        const confirmButton = this.modal.querySelector('#confirmButton');

        let remainingTime = Math.ceil((this.COOLDOWN_TIME - (currentTime - this.lastApiRequestTime)) / 1000);
        
        statusElement.textContent = `Please wait ${remainingTime} seconds before sending another request.`;
        statusElement.style.color = 'var(--error-color)';
        loadingProgress.style.width = '100%';
        confirmButton.style.display = 'block';

        const countdownInterval = setInterval(() => {
            remainingTime--;
            statusElement.textContent = remainingTime > 0 
                ? `Please wait ${remainingTime} seconds before sending another request.`
                : 'Click "Verify Extension" to continue.';
            
            if (remainingTime <= 0) {
                clearInterval(countdownInterval);
                loadingBar.style.display = 'none';
            }
        }, 1000);
    }

    // Verify extension with improved error handling and UX
    async verifyExtension(extensionId) {
        const statusElement = this.modal.querySelector('#verificationStatus');
        const loadingBar = this.modal.querySelector('#loadingBar');
        const loadingProgress = this.modal.querySelector('#loadingProgress');
        const confirmButton = this.modal.querySelector('#confirmButton');

        try {
            // Show loading progress
            loadingBar.style.display = 'block';
            loadingProgress.style.width = '50%';
            statusElement.textContent = 'Verifying extension...';
            confirmButton.style.display = 'none';

            // Simulate some loading time
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch verification data
            const response = await fetch(this.VERIFIED_API_URL);
            loadingProgress.style.width = '100%';

            if (!response.ok) {
                throw new Error('Error retrieving verification data');
            }

            const data = await response.json();

            // Check verification status
            if (Array.isArray(data.verifiedExtensions) && 
                data.verifiedExtensions.includes(extensionId)) {
                statusElement.innerHTML = `
                    <span style="color: var(--success-color);">✓ Verified</span> 
                    This extension is confirmed as safe.
                `;
                statusElement.style.color = 'var(--text-light)';
            } else {
                statusElement.textContent = 'This extension is not verified.';
                statusElement.style.color = 'var(--error-color)';
            }
        } catch (error) {
            // Comprehensive error handling
            this.showErrorMessage(error.message);
        } finally {
            loadingBar.style.display = 'none';
        }
    }

    // Centralized error message display
    showErrorMessage(message) {
        const statusElement = this.modal.querySelector('#verificationStatus');
        const loadingBar = this.modal.querySelector('#loadingBar');
        const confirmButton = this.modal.querySelector('#confirmButton');

        statusElement.textContent = `Error: ${message}`;
        statusElement.style.color = 'var(--error-color)';
        loadingBar.style.display = 'none';
        confirmButton.style.display = 'block';
    }

    // Close modal and reset state
    closeModal() {
        this.modal.style.display = 'none';
              this.modal.style.pointerEvents = 'auto';
    }

    // Extract extension ID from URL
    getExtensionIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }
}

// Initialize the extension verification modal
document.addEventListener('DOMContentLoaded', () => {
    const extensionVerification = new ExtensionVerificationModal();
    extensionVerification.init();
});