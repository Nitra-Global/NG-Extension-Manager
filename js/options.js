document.addEventListener('DOMContentLoaded', () => {
    const extensionGrid = document.getElementById('extensionGrid');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportTxtBtn = document.getElementById('exportTxtBtn');
    const viewNgDataBtn = document.getElementById('viewNgDataBtn');
    const downloadNgDataBtn = document.getElementById('downloadNgDataBtn');
    const ngDataContainer = document.getElementById('ngDataContainer');
    const errorContainer = document.getElementById('errorContainer');

    // Local storage keys for custom names and icons
    const CUSTOM_NAMES_KEY = 'ngExtensionManagerCustomNames';
    const CUSTOM_ICONS_KEY = 'ngExtensionManagerCustomIcons';

    let customNames = {};
    let customIcons = {};

    /**
     * Initialize custom names and icons from local storage.
     */
    function initializeCustomData() {
        const names = localStorage.getItem(CUSTOM_NAMES_KEY);
        const icons = localStorage.getItem(CUSTOM_ICONS_KEY);
        customNames = names ? JSON.parse(names) : {};
        customIcons = icons ? JSON.parse(icons) : {};
    }

    /**
     * Save custom names and icons to local storage.
     */
    function saveCustomData() {
        localStorage.setItem(CUSTOM_NAMES_KEY, JSON.stringify(customNames));
        localStorage.setItem(CUSTOM_ICONS_KEY, JSON.stringify(customIcons));
    }

    /**
     * Display error messages to the user.
     * @param {string} message - The error message to display.
     */
    function displayError(message) {
        errorContainer.textContent = message;
        errorContainer.hidden = false;
        setTimeout(() => {
            errorContainer.hidden = true;
            errorContainer.textContent = '';
        }, 5000);
    }

    /**
     * Create and display the edit modal.
     * @param {object} extension - The extension object.
     */
    function showEditModal(extension) {
        const modal = document.createElement('div');
        modal.classList.add('edit-modal');

        modal.innerHTML = `
            <div class="modal-content">
                <button class="close-btn">&times;</button>
                <h3>Edit Extension</h3>
                <label for="customName">Custom Name:</label>
                <input type="text" id="customName" value="${customNames[extension.id] || extension.name}">
                <label for="customIcon">Custom Icon URL:</label>
                <input type="text" id="customIcon" value="${customIcons[extension.id] || extension.icons[0]?.url || ''}">
                <div class="modal-actions">
                    <button id="saveEditBtn" class="btn primary">Save</button>
                    <button class="btn secondary close-btn">Cancel</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal functionality
        modal.querySelectorAll('.close-btn').forEach(btn => {
            btn.addEventListener('click', () => modal.remove());
        });

        // Save changes
        modal.querySelector('#saveEditBtn').addEventListener('click', () => {
            const customName = modal.querySelector('#customName').value.trim();
            const customIcon = modal.querySelector('#customIcon').value.trim();

            if (customName) {
                customNames[extension.id] = customName;
            } else {
                delete customNames[extension.id];
            }

            if (customIcon) {
                customIcons[extension.id] = customIcon;
            } else {
                delete customIcons[extension.id];
            }

            saveCustomData();
            modal.remove();
            loadExtensions();
        });
    }

    /**
     * Loads and displays all installed extensions in a grid layout.
     */
    async function loadExtensions() {
        try {
            extensionGrid.innerHTML = ''; // Clear existing content
            const extensions = await getAllExtensions();

            extensions.forEach(extension => {
                const extCard = document.createElement('div');
                extCard.classList.add('extension-card');

                // Apply custom name if exists
                const displayName = customNames[extension.id] || extension.name;

                // Apply custom icon if exists
                const iconUrl = customIcons[extension.id] || (extension.icons && extension.icons.length > 0 ? extension.icons[0].url : '');

                extCard.innerHTML = `
                    <img src="${iconUrl || 'default-icon.png'}" alt="${displayName} Icon" class="extension-icon">
                    <h3>${displayName} <img src="icons/edit-icon.svg" class="edit-icon" title="Edit" alt="Edit"></h3>
                    <p><strong>ID:</strong> ${extension.id}</p>
                    <p><strong>Status:</strong> ${extension.enabled ? 'Enabled' : 'Disabled'}</p>
                    <p><strong>Version:</strong> ${extension.version}</p>
                    <p><strong>Type:</strong> ${extension.type}</p>
                    <p><strong>Homepage:</strong> ${extension.homepageUrl ? `<a href="${extension.homepageUrl}" target="_blank">${extension.homepageUrl}</a>` : 'N/A'}</p>
                    <p><strong>Permissions:</strong> ${extension.permissions ? extension.permissions.join(', ') : 'None'}</p>
                    <div class="actions">
                        <button class="btn secondary toggle-btn">${extension.enabled ? 'Disable' : 'Enable'}</button>
                        <button class="btn secondary remove-btn">Remove</button>
                    </div>
                `;

                // Highlight NG Extension Manager
                if (extension.id === chrome.runtime.id) {
                    extCard.style.border = '2px solid #1a73e8';
                }

                // Edit functionality
                extCard.querySelector('.edit-icon').addEventListener('click', () => showEditModal(extension));

                // Toggle enable/disable
                extCard.querySelector('.toggle-btn').addEventListener('click', () => toggleExtension(extension.id));

                // Remove extension
                extCard.querySelector('.remove-btn').addEventListener('click', () => removeExtension(extension.id));

                extensionGrid.appendChild(extCard);
            });
        } catch (error) {
            console.error('Error loading extensions:', error);
            displayError('Failed to load extensions. Please try again.');
        }
    }

    /**
     * Fetch all extensions using chrome.management API with Promises.
     * @returns {Promise<Array>} - Array of extension objects.
     */
    function getAllExtensions() {
        return new Promise((resolve, reject) => {
            chrome.management.getAll(extensions => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(extensions);
                }
            });
        });
    }

    /**
     * Toggle the enabled state of an extension.
     * @param {string} extensionId - The ID of the extension to toggle.
     */
    function toggleExtension(extensionId) {
        chrome.management.get(extensionId, extension => {
            if (chrome.runtime.lastError) {
                displayError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            const action = extension.enabled ? chrome.management.setEnabled : chrome.management.setEnabled;
            action(extensionId, !extension.enabled, () => {
                if (chrome.runtime.lastError) {
                    displayError(`Error: ${chrome.runtime.lastError.message}`);
                } else {
                    loadExtensions();
                }
            });
        });
    }

    /**
     * Remove an extension after user confirmation.
     * @param {string} extensionId - The ID of the extension to remove.
     */
    function removeExtension(extensionId) {
        if (confirm('Are you sure you want to remove this extension?')) {
            chrome.management.uninstall(extensionId, { showConfirmDialog: false }, () => {
                if (chrome.runtime.lastError) {
                    displayError(`Error: ${chrome.runtime.lastError.message}`);
                } else {
                    loadExtensions();
                }
            });
        }
    }

    /**
     * Export all extensions data as JSON.
     */
    async function exportAsJSON() {
        try {
            const extensions = await getAllExtensions();
            const data = JSON.stringify(extensions, null, 2);
            downloadFile(data, 'extensions_data.json', 'application/json');
        } catch (error) {
            console.error('Error exporting JSON:', error);
            displayError('Failed to export JSON data. Please try again.');
        }
    }

    /**
     * Export all extensions data as TXT.
     */
    async function exportAsTXT() {
        try {
            const extensions = await getAllExtensions();
            let txtContent = 'NG Extension Manager Export\n\n';

            extensions.forEach(ext => {
                const name = customNames[ext.id] || ext.name;
                const version = ext.version || 'N/A';
                const homepage = ext.homepageUrl || 'N/A';
                const status = ext.enabled ? 'Enabled' : 'Disabled';
                txtContent += `Name: ${name}\nVersion: ${version}\nHomepage: ${homepage}\nStatus: ${status}\n\n`;
            });

            downloadFile(txtContent, 'extensions_data.txt', 'text/plain');
        } catch (error) {
            console.error('Error exporting TXT:', error);
            displayError('Failed to export TXT data. Please try again.');
        }
    }

    /**
     * Download a file with the given content, filename, and MIME type.
     * @param {string} content - The content of the file.
     * @param {string} filename - The name of the file.
     * @param {string} mimeType - The MIME type of the file.
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /**
     * View all data of the NG Extension Manager in the UI.
     */
    function viewNgData() {
        chrome.management.getSelf(extension => {
            if (chrome.runtime.lastError) {
                ngDataContainer.innerHTML = `<p>Error: ${chrome.runtime.lastError.message}</p>`;
                return;
            }

            const formattedData = JSON.stringify(extension, null, 2);
            ngDataContainer.innerHTML = `<pre>${formattedData}</pre>`;
        });
    }

    /**
     * Download the NG Extension Manager data as a JSON file.
     */
    function downloadNgData() {
        chrome.management.getSelf(extension => {
            if (chrome.runtime.lastError) {
                displayError(`Error: ${chrome.runtime.lastError.message}`);
                return;
            }

            const data = JSON.stringify(extension, null, 2);
            downloadFile(data, 'ng_extension_data.json', 'application/json');
        });
    }

    /**
     * Event Listeners
     */
    exportJsonBtn.addEventListener('click', exportAsJSON);
    exportTxtBtn.addEventListener('click', exportAsTXT);
    viewNgDataBtn.addEventListener('click', viewNgData);
    downloadNgDataBtn.addEventListener('click', downloadNgData);

    /**
     * Initialize the extension manager.
     */
    function init() {
        initializeCustomData();
        loadExtensions();
    }

    // Initialize on load
    init();
});
