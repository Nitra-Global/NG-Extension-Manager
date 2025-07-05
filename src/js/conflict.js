document.addEventListener('DOMContentLoaded', () => {
            // --- Constants & State ---
            const API_URL = 'https://raw.githubusercontent.com/modcoretech/api/main/modcoreEM/extensions.json';
            const CACHE_TTL_MS = 24 * 3600 * 1000; // 24 hours
            const IGNORED_EXTENSIONS_KEY = 'ignored_extensions';
            // Using info.svg as a generic placeholder icon as per user's instruction
            const GENERIC_EXTENSION_ICON = '../../public/icons/svg/info.svg'; 
            let conflictConfig = null;
            let currentConfirmAction = null; // To store the pending action for the modal

            // --- DOM Elements ---
            const checkButton = document.getElementById('checkButton');
            const refreshCacheButton = document.getElementById('refreshCacheButton');
            const resultsDiv = document.getElementById('results');
            const loadingSpinner = document.getElementById('loading-spinner');
            const footer = document.getElementById('footer');
            const confirmationModal = document.getElementById('confirmationModal');
            const modalTitle = document.getElementById('modalTitle');
            const modalMessage = document.getElementById('modalMessage');
            const confirmButton = document.getElementById('confirmButton');
            const cancelButton = document.getElementById('cancelButton');
            let activeTooltip = null; // To keep track of the currently shown tooltip

            // --- UI Update Functions ---
            const showSpinner = () => {
                loadingSpinner.style.display = 'block';
                resultsDiv.classList.add('dimmed');
                // Announce loading for screen readers
                resultsDiv.setAttribute('aria-busy', 'true');
            };

            const hideSpinner = () => {
                loadingSpinner.style.display = 'none';
                resultsDiv.classList.remove('dimmed');
                resultsDiv.setAttribute('aria-busy', 'false');
            };

            const setButtonsDisabled = (disabled) => {
                checkButton.disabled = disabled;
                refreshCacheButton.disabled = disabled;
            };

            // --- Custom Confirmation Modal Logic ---
            const showConfirmationModal = (title, message) => {
                modalTitle.textContent = title;
                modalMessage.textContent = message;
                confirmationModal.classList.add('visible');
                // Set focus to the confirm button for accessibility
                confirmButton.focus();
                return new Promise((resolve) => {
                    const handleConfirm = () => {
                        confirmationModal.classList.remove('visible');
                        confirmButton.removeEventListener('click', handleConfirm);
                        cancelButton.removeEventListener('click', handleCancel);
                        resolve(true);
                    };
                    const handleCancel = () => {
                        confirmationModal.classList.remove('visible');
                        confirmButton.removeEventListener('click', handleConfirm);
                        cancelButton.removeEventListener('click', handleCancel);
                        resolve(false);
                    };
                    confirmButton.addEventListener('click', handleConfirm);
                    cancelButton.addEventListener('click', handleCancel);
                });
            };

            // --- Tooltip Positioning Logic ---
            const positionTooltip = (tooltipTrigger, tooltipContent) => {
                const triggerRect = tooltipTrigger.getBoundingClientRect();
                const contentRect = tooltipContent.getBoundingClientRect();
                const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
                const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

                let top = triggerRect.top - contentRect.height - 10; // Default: above trigger
                let left = triggerRect.left + (triggerRect.width / 2) - (contentRect.width / 2);

                // Check if tooltip goes off-screen to the left
                if (left < 10) {
                    left = 10;
                }
                // Check if tooltip goes off-screen to the right
                if (left + contentRect.width > viewportWidth - 10) {
                    left = viewportWidth - contentRect.width - 10;
                }
                // Check if tooltip goes off-screen to the top, then position below
                if (top < 10) {
                    top = triggerRect.bottom + 10;
                }

                tooltipContent.style.top = `${top}px`;
                tooltipContent.style.left = `${left}px`;
                tooltipContent.style.opacity = '1';
                tooltipContent.style.visibility = 'visible';
            };

            const hideTooltip = (tooltipContent) => {
                if (tooltipContent) {
                    tooltipContent.style.opacity = '0';
                    tooltipContent.style.visibility = 'hidden';
                }
            };

            // --- Data Fetching & Management ---
            const getConflictConfig = async (forceRefresh) => {
                const cachedData = await chrome.storage.local.get(['conflictConfig', 'cache_timestamp']);
                const cachedConfig = cachedData.conflictConfig;
                const cachedTime = cachedData.cache_timestamp;

                if (!forceRefresh && cachedConfig && (Date.now() - cachedTime < CACHE_TTL_MS)) {
                    console.log('Using valid cached API data.');
                    conflictConfig = cachedConfig;
                    return conflictConfig;
                }

                try {
                    console.log(forceRefresh ? 'Forcing refresh of API data.' : 'Fetching API data.');
                    const response = await fetch(API_URL);
                    if (!response.ok) {
                        // Check for network specific errors
                        if (response.status === 0 || response.type === 'opaque') { // Common indicators for network issues
                            throw new Error("Network error: Please check your internet connection.");
                        }
                        throw new Error(`API response error (${response.status}): Could not load data.`);
                    }
                    const config = await response.json();
                    await chrome.storage.local.set({ conflictConfig: config, cache_timestamp: Date.now() });
                    conflictConfig = config;
                    return config;
                } catch (error) {
                    console.error("Failed to fetch config:", error);
                    // Attempt to use stale cache as a fallback
                    if (cachedConfig) {
                        console.warn("Using stale cached data as fallback.");
                        conflictConfig = cachedConfig;
                        return cachedConfig;
                    }
                    throw error; // Re-throw the specific error for renderErrorPlaceholder
                }
            };

            const loadIgnoredExtensions = async () => new Set((await chrome.storage.local.get(IGNORED_EXTENSIONS_KEY))[IGNORED_EXTENSIONS_KEY] || []);
            const saveIgnoredExtension = async (id) => {
                const ignored = await loadIgnoredExtensions();
                ignored.add(id);
                await chrome.storage.local.set({ [IGNORED_EXTENSIONS_KEY]: Array.from(ignored) });
            };
            const removeIgnoredExtension = async (id) => {
                const ignored = await loadIgnoredExtensions();
                ignored.delete(id);
                await chrome.storage.local.set({ [IGNORED_EXTENSIONS_KEY]: Array.from(ignored) });
            };

            // --- Core Logic ---
            const findConflicts = (installed, categories, ignored) => {
                return categories.map(cat => {
                    const conflictingInstalled = installed.filter(ext => cat.extension_ids.includes(ext.id) && ext.enabled && !ignored.has(ext.id));
                    return conflictingInstalled.length >= 2 ? { ...cat, extensions: conflictingInstalled } : null;
                }).filter(Boolean);
            };

            const findDeprecated = (installed, deprecatedList, ignored) => {
                const deprecatedMap = new Map(deprecatedList.map(dep => [dep.id, dep]));
                return installed.map(ext => {
                    if (deprecatedMap.has(ext.id) && !ignored.has(ext.id)) {
                        return { extension: ext, ...deprecatedMap.get(ext.id) };
                    }
                    return null;
                }).filter(Boolean);
            };

            /** Main function to orchestrate the scan */
            const runScan = async (forceRefresh = false) => {
                showSpinner();
                setButtonsDisabled(true);
                try {
                    const [config, installedExtensions, ignoredExtensions] = await Promise.all([
                        getConflictConfig(forceRefresh),
                        chrome.management.getAll(),
                        loadIgnoredExtensions()
                    ]);

                    const conflicts = findConflicts(installedExtensions, config.conflict_categories, ignoredExtensions);
                    const deprecated = findDeprecated(installedExtensions, config.deprecated_extensions, ignoredExtensions);

                    renderResults(conflicts, deprecated, installedExtensions, ignoredExtensions);
                    displayDataVersionInfo(config);
                } catch (error) {
                    console.error("Error during scan:", error);
                    let errorMessage = `An unexpected error occurred: ${error.message}.`;
                    if (error.message.includes("Network error")) {
                        errorMessage = "Network error: Please check your internet connection and try again.";
                    } else if (error.message.includes("API response error")) {
                        errorMessage = `Failed to load data from the server: ${error.message}. Please try again later.`;
                    } else if (error.message.includes("no cache is available")) {
                        errorMessage = "Could not connect to the data server and no cached data is available. Please ensure you are online and try refreshing.";
                    }
                    renderErrorPlaceholder(errorMessage);
                } finally {
                    hideSpinner();
                    setButtonsDisabled(false);
                }
            };

            // --- Rendering Functions ---
            const renderResults = (conflicts, deprecated, allInstalled, ignoredSet) => {
                resultsDiv.innerHTML = ''; 
                const hasIssues = conflicts.length > 0 || deprecated.length > 0;
                const hasIgnored = ignoredSet.size > 0;

                if (!hasIssues && !hasIgnored) {
                    resultsDiv.appendChild(createPlaceholder(
                        'icon-check', 'All Clear!',
                        'Fantastic! Your extensions look great. No conflicts or deprecated items were found. Your browser is running smoothly.'
                    ));
                    return;
                }
                
                const wrapper = document.createElement('div');
                wrapper.className = 'results-wrapper';
                if (conflicts.length > 0) wrapper.appendChild(createCollapsibleSection('Conflicting Extensions', conflicts.map(createConflictCard), true,
                    'Conflicting extensions can interfere with each other, leading to unexpected behavior, website malfunctions, or browser instability. It\'s recommended to review and disable or remove conflicting extensions.'
                ));
                if (deprecated.length > 0) wrapper.appendChild(createCollapsibleSection('Deprecated Extensions', deprecated.map(createDeprecatedCard), true,
                    'Deprecated extensions are no longer actively maintained, may have security vulnerabilities, or have been removed from the Chrome Web Store. Consider replacing them with actively supported alternatives for better security and performance.'
                ));
                if (hasIgnored) {
                    const installedMap = new Map(allInstalled.map(ext => [ext.id, ext]));
                    const ignoredItems = Array.from(ignoredSet).map(id => {
                        const extInfo = installedMap.get(id) || { id, name: `Unknown (ID: ${id})`, icons: [], version: '?.?' };
                        return createExtensionItem(extInfo, 'ignored');
                    });
                    wrapper.appendChild(createCollapsibleSection('Ignored Extensions', [createResultsGroup(ignoredItems)], false,
                        'These are extensions you have chosen to ignore. They will not appear in the "Conflicting" or "Deprecated" lists unless unignored. Use this list to manage your ignored extensions.'
                    ));
                }
                resultsDiv.appendChild(wrapper);
            };

            const createCollapsibleSection = (title, contentElements, startOpen = true, tooltipText = '') => {
                const section = document.createElement('div');
                section.className = 'collapsible-section';
                const header = document.createElement('button');
                header.className = 'collapsible-header';
                header.setAttribute('aria-expanded', startOpen);
                if (startOpen) header.classList.add('active');
                
                header.innerHTML = `<span class="arrow icon icon-arrow-right" aria-hidden="true"></span><span class="header-title">${title} (${contentElements.length})</span> ${createTooltip(tooltipText, 'icon-info')}`;
                
                const content = document.createElement('div');
                content.className = 'collapsible-content';
                content.setAttribute('role', 'region');
                content.setAttribute('aria-labelledby', header.id || `header-${title.replace(/\s/g, '-')}`); // Add unique ID if not present
                contentElements.forEach(el => content.appendChild(el));
                
                section.append(header, content);
                header.addEventListener('click', () => {
                    const isActive = header.classList.toggle('active');
                    header.setAttribute('aria-expanded', isActive);
                });
                return section;
            };

            const createConflictCard = (conflict) => {
                const card = createResultsGroup();
                const header = document.createElement('div');
                header.className = `issue-card-header ${conflict.conflict_level}`;
                const riskTooltip = `A '${conflict.conflict_level}' conflict indicates a high likelihood of browser issues. It's strongly advised to address these conflicts.`;
                const iconClass = conflict.conflict_level === 'critical' ? 'icon-warning' : 'icon-info'; // Use warning icon for critical
                header.innerHTML = `
                    <div class="issue-title">
                        <span class="icon ${iconClass}" aria-hidden="true"></span>
                        ${conflict.name}
                        <span class="risk-badge ${conflict.conflict_level}">${conflict.conflict_level} ${createTooltip(riskTooltip, 'icon-help')}</span>
                    </div>
                    <p class="issue-description">${conflict.description}</p>`;
                card.prepend(header);
                conflict.extensions.forEach(ext => card.appendChild(createExtensionItem(ext, 'conflict')));
                return card;
            };

            const createDeprecatedCard = (dep) => {
                const card = createResultsGroup();
                const header = document.createElement('div');
                header.className = 'issue-card-header info'; // Deprecated items are info level
                const alternativesHTML = dep.alternatives?.length > 0
                    ? `<div class="alternatives-list"><strong>Suggested Alternatives:</strong> ${dep.alternatives.map(alt => `<a href="${alt.url}" target="_blank" rel="noopener noreferrer">${alt.name}</a>`).join(', ')}</div>`
                    : '';
                header.innerHTML = `
                    <div class="issue-title">
                        <span class="icon icon-info" aria-hidden="true"></span>
                        Deprecated: ${dep.extension.name}
                    </div>
                    <p class="issue-description"><strong>Reason:</strong> ${dep.reason}</p>
                    ${alternativesHTML}`;
                card.append(header, createExtensionItem(dep.extension, 'deprecated'));
                return card;
            };
            
            const createResultsGroup = (items = []) => {
                const group = document.createElement('div');
                group.className = 'results-group';
                items.forEach(item => group.appendChild(item));
                return group;
            };

            const createExtensionItem = (ext, type) => {
                const item = document.createElement('div');
                item.className = 'extension-item';
                const iconUrl = ext.icons?.sort((a, b) => b.size - a.size)[0]?.url || GENERIC_EXTENSION_ICON;

                let actionButtonsHTML = '';
                if (type === 'conflict' || type === 'deprecated') {
                    const toggleText = ext.enabled ? 'Disable' : 'Enable';
                    actionButtonsHTML += `<button class="btn tertiary" data-action="toggle" data-id="${ext.id}" data-enabled="${ext.enabled}" aria-label="${toggleText} ${ext.name}">${toggleText}</button>`;
                    actionButtonsHTML += `<button class="btn tertiary" data-action="ignore" data-id="${ext.id}" data-name="${ext.name}" aria-label="Ignore ${ext.name}">Ignore</button>`;
                } else if (type === 'ignored') {
                    actionButtonsHTML = `<button class="btn tertiary" data-action="unignore" data-id="${ext.id}" data-name="${ext.name}" aria-label="Unignore ${ext.name}">Unignore</button>`;
                }
                
                item.innerHTML = `
                    <img src="${iconUrl}" alt="Icon for ${ext.name}" class="extension-icon">
                    <div class="extension-info">
                        <div class="extension-name">${ext.name}</div>
                        <div class="extension-meta">
                            <span class="version" aria-label="Version ${ext.version}">${ext.version}</span> &bull; <span class="id" aria-label="Extension ID">${ext.id}</span>
                        </div>
                    </div>
                    <div class="extension-actions">
                        <button class="btn" data-action="details" data-id="${ext.id}" aria-label="View details for ${ext.name}">Details</button>
                        ${actionButtonsHTML}
                    </div>`;
                return item;
            };

            const createPlaceholder = (iconClass, title, text) => {
                const el = document.createElement('div');
                el.className = 'placeholder';
                el.innerHTML = `
                    <span class="icon ${iconClass}" aria-hidden="true"></span>
                    <div class="placeholder-title">${title}</div>
                    <p class="placeholder-text">${text}</p>`;
                return el;
            };

            const renderErrorPlaceholder = (text) => {
                resultsDiv.innerHTML = '';
                resultsDiv.appendChild(createPlaceholder('icon-error', 'An Error Occurred', text));
            };
            
            const createTooltip = (text, iconClass = 'icon-help') => {
                // Return the HTML structure for the tooltip trigger and content
                return `<span class="tooltip-trigger" role="tooltip" aria-describedby="tooltip-${text.replace(/\s/g, '-').substring(0, 20)}">
                            <span class="icon ${iconClass}" aria-hidden="true"></span>
                            <span id="tooltip-${text.replace(/\s/g, '-').substring(0, 20)}" class="tooltip-content">${text}</span>
                        </span>`;
            };
            
            const displayDataVersionInfo = (config) => {
                if (!config) { footer.classList.remove('visible'); return; }
                const parts = [];
                if (config.version) parts.push(`Data v${config.version}`);
                if (config.last_updated) parts.push(`Updated: ${new Date(config.last_updated).toLocaleDateString()}`);
                const reportLink = `<a href="https://github.com/modcoretech/api/issues" target="_blank" rel="noopener noreferrer">Report Issue</a>`;
                footer.innerHTML = `${parts.join(' | ')} &bull; ${reportLink}`;
                footer.classList.add('visible');
            };

            // --- Event Handling ---
            const handleActionClick = async (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const { action, id, name, enabled } = button.dataset;

                setButtonsDisabled(true);

                try {
                    if (action === 'ignore') {
                        const confirmed = await showConfirmationModal('Confirm Ignore', `Are you sure you want to ignore "${name}"? This extension will no longer appear in conflict or deprecated lists.`);
                        if (!confirmed) {
                            setButtonsDisabled(false);
                            return;
                        }
                    }

                    switch(action) {
                        case 'toggle':
                            await chrome.management.setEnabled(id, enabled !== 'true');
                            await runScan(); // Rescan to reflect the change
                            break;
                        case 'ignore':
                            await saveIgnoredExtension(id);
                            await runScan();
                            break;
                        case 'unignore':
                            await removeIgnoredExtension(id);
                            await runScan();
                            break;
                        case 'details':
                            chrome.tabs.create({ url: `src/html/details.html?id=${id}` });
                            break;
                    }
                } catch (error) {
                    console.error(`Failed to perform action '${action}':`, error);
                    // In a real app, you might show a user-friendly error message here
                } finally {
                    setButtonsDisabled(false);
                }
            };

            // --- Tooltip Event Listeners ---
            document.addEventListener('mouseover', (e) => {
                const trigger = e.target.closest('.tooltip-trigger');
                if (trigger) {
                    const tooltipContent = trigger.querySelector('.tooltip-content');
                    if (tooltipContent) {
                        activeTooltip = tooltipContent; // Set the active tooltip
                        positionTooltip(trigger, tooltipContent);
                    }
                } else if (activeTooltip) {
                    // If mouse moves off a trigger and there was an active tooltip, hide it
                    hideTooltip(activeTooltip);
                    activeTooltip = null;
                }
            });

            document.addEventListener('mouseout', (e) => {
                // This handles cases where the mouse leaves the trigger area
                // but doesn't immediately enter another trigger.
                if (!e.relatedTarget || !e.relatedTarget.closest('.tooltip-trigger')) {
                    if (activeTooltip) {
                        hideTooltip(activeTooltip);
                        activeTooltip = null;
                    }
                }
            });

            // Re-position tooltips on scroll or resize
            window.addEventListener('scroll', () => {
                if (activeTooltip) {
                    const trigger = activeTooltip.closest('.tooltip-trigger');
                    if (trigger) {
                        positionTooltip(trigger, activeTooltip);
                    } else {
                        hideTooltip(activeTooltip);
                        activeTooltip = null;
                    }
                }
            });

            window.addEventListener('resize', () => {
                if (activeTooltip) {
                    const trigger = activeTooltip.closest('.tooltip-trigger');
                    if (trigger) {
                        positionTooltip(trigger, activeTooltip);
                    } else {
                        hideTooltip(activeTooltip);
                        activeTooltip = null;
                    }
                }
            });

            // --- Initialization ---
            checkButton.addEventListener('click', () => runScan(false));
            refreshCacheButton.addEventListener('click', () => runScan(true));
            resultsDiv.addEventListener('click', handleActionClick);
            
            // Initial scan on load, but only if cache is expired or no cache exists
            // The getConflictConfig function handles the cache logic, so we just call runScan(false)
            runScan(false);
        });