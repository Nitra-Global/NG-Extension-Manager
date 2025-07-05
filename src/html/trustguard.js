// trustguard.js - Enhanced Script for TrustGuard Analysis Page

(function() {
    // Cache DOM elements
    const extensionIcon = document.getElementById('extension-icon');
    const extensionName = document.getElementById('extension-name');
    const trustScoreValue = document.getElementById('trust-score-value');
    const trustScoreCategory = document.getElementById('trust-score-category');
    const trustScoreExplanation = document.getElementById('score-explanation');
    const securityInsightsList = document.getElementById('security-insights-list');
    const privacyInsightsList = document.getElementById('privacy-insights-list');
    const toastContainer = document.getElementById('toast-container');
    const confirmModal = document.getElementById('custom-confirm-modal');
    const modalConfirmButton = document.getElementById('modal-confirm-button');
    const modalCancelButton = document.getElementById('modal-cancel-button');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');

    // --- Enhanced Permission Information with clearer descriptions ---
    const MOCK_PERMISSION_INFO = {
        // Critical Risk Permissions
        "<all_urls>": { level: "critical", base_risk_points: 60, type: "data_access", category: "Security/Privacy", description: "Allows the extension to read and change *all* your data on *every* website you visit. This is the highest potential for privacy invasion and malicious activity." },
        "scripting": { level: "critical", base_risk_points: 55, type: "code_injection", category: "Security", description: "Allows the extension to inject and run arbitrary JavaScript on web pages. This is extremely dangerous, as it can be used to steal passwords, data, or hijack your sessions." },
        "debugger": { level: "critical", base_risk_points: 70, type: "development_tools", category: "Security", description: "Grants access to the browser's powerful debugger tools. If misused, it can inspect, manipulate, and intercept network traffic on a profound level, posing a critical security risk." },
        "nativeMessaging": { level: "critical", base_risk_points: 80, type: "system_interaction", category: "Security", description: "Permits communication with native applications installed on your computer. This creates a bridge from the browser to your local system, which can be a major security vulnerability." },
        "proxy": { level: "critical", base_risk_points: 50, type: "network_control", category: "Security", description: "Allows the extension to control your browser's proxy settings. It can re-route all your internet traffic through a potentially malicious server, capturing all your data." },
        "webRequest": { level: "high", base_risk_points: 35, type: "network_control", category: "Security/Privacy", description: "Enables the extension to observe and analyze network traffic. It can be used for tracking or surveillance, even if it doesn't modify the content." },
        "webRequestBlocking": { level: "high", base_risk_points: 40, type: "network_control", category: "Security/Privacy", description: "Allows the extension to block and modify network requests. While essential for ad blockers, it can also be used to censor content or redirect to malicious sites." },

        // High Risk Permissions
        "history": { level: "high", base_risk_points: 30, type: "data_access", category: "Privacy", description: "Enables reading and modifying your browser's navigation history. This can reveal sensitive information about your Browse habits and interests." },
        "cookies": { level: "high", base_risk_points: 25, type: "data_access", category: "Privacy", description: "Grants access to your browser cookies. Cookies are used to store login sessions and track online activity, making this a significant privacy risk." },
        "clipboardRead": { level: "high", base_risk_points: 20, type: "system_interaction", category: "Privacy", description: "Allows the extension to read data directly from your system clipboard. This could capture sensitive information like passwords or personal messages that you copy." },
        "geolocation": { level: "high", base_risk_points: 22, type: "privacy_sensitive", category: "Privacy", description: "Allows access to your precise geographical location. This is highly sensitive personal data that should be shared with extreme caution." },
        "tabCapture": { level: "high", base_risk_points: 28, type: "data_access", category: "Privacy", description: "Enables capturing the visible content (video and audio) of a browser tab. This is a significant privacy concern as it allows 'screen-scraping' of your activity." },
        "webNavigation": { level: "high", base_risk_points: 32, type: "browser_control", category: "Privacy", description: "Allows the extension to receive detailed events about page navigation. This can be used to create a comprehensive map of your Browse behavior." },

        // Moderate Risk Permissions
        "tabs": { level: "moderate", base_risk_points: 15, type: "browser_control", category: "Functionality", description: "Enables access to the URLs and titles of your open tabs. While needed for tab management tools, it can be used to monitor your Browse activity." },
        "downloads": { level: "moderate", base_risk_points: 10, type: "browser_control", category: "Functionality", description: "Allows the extension to manage and initiate downloads. It could potentially track or interfere with files you download." },
        "bookmarks": { level: "moderate", base_risk_points: 8, type: "data_access", category: "Functionality", description: "Allows reading and modifying your browser bookmarks. Misuse could lead to data loss or manipulation of your saved links." },
        "management": { level: "moderate", base_risk_points: 12, type: "browser_control", category: "Security", description: "Grants the ability to manage other installed extensions. This could be used maliciously to disable your security extensions." },

        // Low Risk Permissions
        "activeTab": { level: "low", base_risk_points: 1, type: "data_access", category: "Functionality", description: "A safe alternative to `<all_urls>`, this grants temporary access to the currently active tab only when the user interacts with the extension." },
        "alarms": { level: "low", base_risk_points: 1, type: "system_interaction", category: "Functionality", description: "Enables scheduling of timed events. Poses a very low security risk." },
        "storage": { level: "low", base_risk_points: 3, type: "data_access", category: "Functionality", description: "Allows the extension to store its own data locally. This is a standard and low-risk permission required by most extensions." },
        "notifications": { level: "low", base_risk_points: 1, type: "ui_interaction", category: "Functionality", description: "Allows the extension to display desktop notifications. This is low risk." },
        "contextMenus": { level: "low", base_risk_points: 1, type: "ui_interaction", category: "Functionality", description: "Allows adding items to the browser's right-click context menu. This is low risk." },
        "clipboardWrite": { level: "low", base_risk_points: 2, type: "system_interaction", category: "Functionality", description: "Allows writing data to the system clipboard, typically for 'copy to clipboard' features. This is generally a low-risk action." },
        
        "unknown": { level: "moderate", base_risk_points: 15, type: "unknown", category: "Unclassified", description: "This permission was not recognized. Its potential impact is unknown and it should be reviewed carefully." }
    };
    
    // --- High-Level Insight Definitions ---
    const INSIGHT_DEFINITIONS = [
        {
            id: "system_control_risk", level: "critical", category: "Security",
            title: "Direct System Interaction",
            description: "This extension can interact with software on your computer via `nativeMessaging` or access low-level debugging tools with `debugger`. This creates a critical security vulnerability if exploited.",
            permissions: ["nativeMessaging", "debugger"],
            check: (perms) => perms.includes("nativeMessaging") || perms.includes("debugger")
        },
        {
            id: "all_website_data_manipulation", level: "critical", category: "Security/Privacy",
            title: "Full Access to All Websites",
            description: "With `<all_urls>` or `scripting`, this extension has sweeping access to read and modify your data on *every* website. This is the highest level of access and demands absolute trust in the developer.",
            permissions: ["<all_urls>", "scripting"],
            check: (perms) => perms.includes("<all_urls>") || perms.includes("scripting")
        },
        {
            id: "network_traffic_interception", level: "critical", category: "Security/Privacy",
            title: "Network Traffic Interception & Control",
            description: "Can intercept, block, or modify all network requests (`webRequest`, `webRequestBlocking`) or control your proxy settings (`proxy`). This allows for monitoring of all your internet traffic.",
            permissions: ["webRequest", "webRequestBlocking", "proxy"],
            check: (perms) => perms.includes("proxy") || perms.includes("webRequest") || perms.includes("webRequestBlocking")
        },
        {
            id: "privacy_surveillance", level: "high", category: "Privacy",
            title: "Detailed Browse Surveillance",
            description: "Can access your complete Browse history (`history`), monitor navigation events (`webNavigation`), read your session cookies (`cookies`), or capture tab content (`tabCapture`). This enables a detailed profile of your online life.",
            permissions: ["history", "webNavigation", "cookies", "tabCapture"],
            check: (perms) => perms.some(p => ["history", "webNavigation", "cookies", "tabCapture"].includes(p))
        },
        {
            id: "sensitive_data_access", level: "high", category: "Privacy",
            title: "Access to Sensitive Personal Data",
            description: "Can access your precise physical location (`geolocation`) or read content from your system clipboard (`clipboardRead`). This is highly sensitive data that could be easily misused.",
            permissions: ["geolocation", "clipboardRead"],
            check: (perms) => perms.includes("geolocation") || perms.includes("clipboardRead")
        },
        {
            id: "browser_management", level: "moderate", category: "Functionality/Security",
            title: "Browser Management Capabilities",
            description: "Can manage your tabs (`tabs`), downloads (`downloads`), and bookmarks (`bookmarks`), or even manage other extensions (`management`). This grants significant control over your browser environment.",
            permissions: ["tabs", "downloads", "management", "bookmarks"],
            check: (perms) => perms.some(p => ["tabs", "downloads", "management", "bookmarks"].includes(p))
        }
    ];

    const RISK_LEVELS = {
        "excellent": { scoreMin: 90, class: "risk-excellent", indicator: "✓", explanation: "Requests minimal to no permissions. Poses a negligible risk and demonstrates an exemplary approach to user privacy and security." },
        "low": { scoreMin: 70, class: "risk-low", indicator: "✓", explanation: "Requests common, low-impact permissions necessary for its features. Generally safe, but review to ensure the permissions align with the extension's purpose." },
        "moderate": { scoreMin: 50, class: "risk-moderate", indicator: "?", explanation: "Requests a notable set of permissions that could impact privacy or browser functionality if misused. Exercise caution and verify its necessity." },
        "high": { scoreMin: 20, class: "risk-high", indicator: "!", explanation: "Requests sensitive permissions that could compromise your privacy (e.g., access Browse history). This carries a high risk and requires careful consideration." },
        "critical": { scoreMin: 0, class: "risk-critical", indicator: "!", explanation: "Demands highly intrusive permissions (e.g., full web access, system interaction) that pose a critical threat. *Avoid* unless the source is absolutely trusted." },
        "unknown": { scoreMin: -1, class: "risk-unknown", indicator: "i", explanation: "The risk level could not be determined. Proceed with caution." }
    };

    /**
     * ENHANCED: Calculates a TrustGuard score with synergy penalties.
     * @param {string[]} permissions
     * @returns {{score: number, category: string}}
     */
    function calculateTrustGuardScore(permissions) {
        if (!permissions || permissions.length === 0) {
            return { score: 100, category: "excellent" };
        }

        let totalRiskPoints = 0;
        const permSet = new Set(permissions);

        // 1. Sum base risk points
        permissions.forEach(p => {
            const info = MOCK_PERMISSION_INFO[p] || MOCK_PERMISSION_INFO.unknown;
            totalRiskPoints += info.base_risk_points;
        });

        // 2. Add synergy risk points for dangerous combinations
        if (permSet.has("<all_urls>") && permSet.has("scripting")) totalRiskPoints += 50;
        if (permSet.has("<all_urls>") && permSet.has("nativeMessaging")) totalRiskPoints += 60;
        if (permSet.has("scripting") && permSet.has("webRequestBlocking")) totalRiskPoints += 40;
        if (permSet.has("debugger") && permSet.has("<all_urls>")) totalRiskPoints += 70;
        if (permSet.has("history") && permSet.has("cookies")) totalRiskPoints += 25;

        // 3. Calculate score
        const maxTheoreticalRiskPoints = 600; // Increased to account for synergy points
        const cappedRiskPoints = Math.min(totalRiskPoints, maxTheoreticalRiskPoints);
        let score = 100 - (cappedRiskPoints / maxTheoreticalRiskPoints) * 100;
        score = Math.max(0, Math.min(100, score));

        // 4. Determine category
        let category = "unknown";
        const sortedLevels = Object.keys(RISK_LEVELS).sort((a, b) => RISK_LEVELS[b].scoreMin - RISK_LEVELS[a].scoreMin);
        for (const level of sortedLevels) {
            if (RISK_LEVELS[level].scoreMin !== -1 && score >= RISK_LEVELS[level].scoreMin) {
                category = level;
                break;
            }
        }
        return { score: Math.round(score), category: category };
    }

    /**
     * Populates the TrustGuard score card.
     * @param {number} score
     * @param {string} category
     */
    function updateScoreCard(score, category) {
        const levelInfo = RISK_LEVELS[category];
        trustScoreValue.textContent = score;
        trustScoreCategory.textContent = `${category} Risk`;
        trustScoreCategory.className = `score-category ${levelInfo.class}`;
        trustScoreExplanation.textContent = levelInfo.explanation;
        
        // Add emphasis to the key sentence in critical explanations
        if (category === 'critical') {
            const explanationText = levelInfo.explanation;
            const match = explanationText.match(/\*([^*]+)\*/);
            if (match) {
                const strongPart = match[1];
                const parts = explanationText.split(`*${strongPart}*`);
                trustScoreExplanation.innerHTML = ''; // Clear previous
                trustScoreExplanation.appendChild(document.createTextNode(parts[0]));
                const strongEl = document.createElement('strong');
                strongEl.textContent = strongPart;
                trustScoreExplanation.appendChild(strongEl);
                trustScoreExplanation.appendChild(document.createTextNode(parts[1]));
            }
        }
    }
    
    /**
     * NEW: Securely formats text with `<strong>` and `<code>` tags.
     * Replaces *text* with <strong>text</strong> and `text` with <code>text</code>.
     * @param {string} text - The input string.
     * @returns {DocumentFragment}
     */
    function formatTextWithTags(text) {
        const fragment = document.createDocumentFragment();
        // Regex to find *...* or `...`
        const regex = /([*`])(.*?)\1/g;
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
            // Add preceding text
            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            // Create and add the styled element
            const tag = match[1] === '*' ? 'strong' : 'code';
            const element = document.createElement(tag);
            element.textContent = match[2];
            fragment.appendChild(element);
            lastIndex = regex.lastIndex;
        }

        // Add any remaining text
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
        return fragment;
    }

    /**
     * REFACTORED: Creates and renders an insight item securely without innerHTML.
     * @param {object} insight - The insight object to render.
     * @returns {HTMLLIElement}
     */
    function createInsightListItem(insight) {
        const listItem = document.createElement('li');
        listItem.className = 'risk-summary-item';

        const iconWrapper = document.createElement('span');
        const levelInfo = RISK_LEVELS[insight.level];
        iconWrapper.className = `risk-summary-icon-wrapper ${levelInfo.class}`;
        iconWrapper.textContent = levelInfo.indicator;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'risk-summary-content';

        const title = document.createElement('h4');
        title.className = 'risk-summary-title';
        title.textContent = insight.title;

        const description = document.createElement('p');
        description.className = 'risk-summary-text';
        // Securely append formatted description
        description.appendChild(formatTextWithTags(insight.description));

        contentDiv.appendChild(title);
        contentDiv.appendChild(description);
        listItem.appendChild(iconWrapper);
        listItem.appendChild(contentDiv);
        
        return listItem;
    }

    /**
     * NEW: Creates a generic message list item for info or empty states.
     * @param {{level: string, title: string, description: string}} messageData
     * @returns {HTMLLIElement}
     */
    function createMessageListItem({ level, title, description }) {
        const messageInsight = {
            level: level,
            title: title,
            description: description
        };
        return createInsightListItem(messageInsight);
    }

    /**
     * REFACTORED: Populates risk summaries securely.
     * @param {string[]} permissions
     */
    function updateRiskSummary(permissions) {
        securityInsightsList.innerHTML = '';
        privacyInsightsList.innerHTML = '';

        if (!permissions || permissions.length === 0) {
            const noPermsMsg = { level: 'excellent', title: 'No Special Permissions Required', description: 'This extension does not request any sensitive permissions, indicating an exemplary security and privacy posture. This is the ideal scenario for user trust.' };
            securityInsightsList.appendChild(createMessageListItem(noPermsMsg));
            privacyInsightsList.appendChild(createMessageListItem(noPermsMsg));
            return;
        }

        const triggeredInsights = INSIGHT_DEFINITIONS.filter(insight => insight.check(permissions));

        const securityInsights = triggeredInsights.filter(i => i.category.includes('Security'));
        const privacyInsights = triggeredInsights.filter(i => i.category.includes('Privacy'));

        const sortFn = (a, b) => {
            const order = ["critical", "high", "moderate", "low"];
            return order.indexOf(a.level) - order.indexOf(b.level);
        };

        securityInsights.sort(sortFn).forEach(insight => {
            securityInsightsList.appendChild(createInsightListItem(insight));
        });

        privacyInsights.sort(sortFn).forEach(insight => {
            privacyInsightsList.appendChild(createInsightListItem(insight));
        });
        
        if (securityInsights.length === 0) {
            securityInsightsList.appendChild(createMessageListItem({ level: 'low', title: 'No High-Level Security Concerns', description: 'Based on the permissions requested, no specific, high-level security threats were identified.' }));
        }
        if (privacyInsights.length === 0) {
            privacyInsightsList.appendChild(createMessageListItem({ level: 'low', title: 'No Major Privacy Concerns', description: 'Based on the permissions requested, no specific, high-level privacy threats were identified.' }));
        }
    }

    /**
     * Initializes the TrustGuard page.
     */
    async function initializeTrustGuardPage() {
        const urlParams = new URLSearchParams(window.location.search);
        const extensionId = urlParams.get('id');
        
        // Initial loading state
        securityInsightsList.appendChild(createMessageListItem({ level: 'unknown', title: 'Evaluating Security...', description: 'TrustGuard is assessing the extension\'s security permissions.' }));
        privacyInsightsList.appendChild(createMessageListItem({ level: 'unknown', title: 'Evaluating Privacy...', description: 'TrustGuard is assessing the extension\'s privacy permissions.' }));

        if (!extensionId) {
            updateForError("Extension ID missing from URL.");
            return;
        }

        try {
            const extensionInfo = await chrome.management.get(extensionId);
            if (!extensionInfo) {
                updateForError("Extension not found or is inaccessible.");
                return;
            }

            // Update header
            extensionIcon.src = extensionInfo.icons?.sort((a, b) => b.size - a.size)[0]?.url || '../../public/icons/svg/extension-placeholder.svg';
            extensionName.textContent = extensionInfo.name;

            const permissions = extensionInfo.permissions || [];
            
            // Calculate and display TrustGuard Score
            const { score, category } = calculateTrustGuardScore(permissions);
            updateScoreCard(score, category);

            // Update Risk Summary
            updateRiskSummary(permissions);

        } catch (error) {
            console.error("Error loading TrustGuard analysis:", error);
            updateForError(`Analysis failed: ${error.message}`);
        }
    }

    /**
     * Helper to display an error state across the UI.
     * @param {string} message - The error message to display.
     */
    function updateForError(message) {
        showToast(message);
        extensionName.textContent = "Error";
        updateScoreCard(0, "unknown");
        trustScoreValue.textContent = "!";
        trustScoreExplanation.textContent = message;

        const errorMsg = { level: 'critical', title: 'Analysis Failed', description: message };
        securityInsightsList.innerHTML = '';
        privacyInsightsList.innerHTML = '';
        securityInsightsList.appendChild(createMessageListItem(errorMsg));
        privacyInsightsList.appendChild(createMessageListItem(errorMsg));
    }
    
    /**
     * Displays a toast notification.
     */
    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        toastContainer.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));

        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        }, duration);
    }

    // Initialize when the DOM is fully loaded
    document.addEventListener('DOMContentLoaded', initializeTrustGuardPage);

})();