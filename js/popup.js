// Constants
const EXTENSIONS_PER_PAGE = 10; // Anzahl der Erweiterungen pro Seite

// Utility Functions

/**
 * Truncate text to a specified length, adding ellipsis if necessary.
 * @param {string} text - The text to truncate.
 * @param {number} maxLength - Maximum allowed length.
 * @returns {string} - Truncated text.
 */
function truncate(text, maxLength) {
  return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
}

/**
 * Save settings to localStorage.
 * @param {string} key - The key of the setting.
 * @param {*} value - The value to save.
 */
function saveSetting(key, value) {
  let settings = JSON.parse(localStorage.getItem('extensionManagerSettings')) || {};
  settings[key] = value;
  localStorage.setItem('extensionManagerSettings', JSON.stringify(settings));
}

/**
 * Get settings from localStorage.
 * @returns {Object} - The settings object.
 */
function getSettings() {
  return JSON.parse(localStorage.getItem('extensionManagerSettings')) || {
      redirectToDetails: false,
      hideViewAllButton: false,
      sortOrder: []
  };
}

/**
 * Save extension preferences (like sort order).
 * @param {Object} prefs - The preferences to save.
 */
function savePreferences(prefs) {
  localStorage.setItem('extensionManagerPreferences', JSON.stringify(prefs));
}

/**
 * Get extension preferences from localStorage.
 * @returns {Object} - The preferences object.
 */
function getPreferences() {
  return JSON.parse(localStorage.getItem('extensionManagerPreferences')) || {
      sortOrder: []
  };
}

/**
 * Show loading indicator.
 */
function showLoading() {
  document.getElementById('loading-indicator').style.display = 'flex';
}

/**
 * Hide loading indicator.
 */
function hideLoading() {
  document.getElementById('loading-indicator').style.display = 'none';
}

/**
 * Show error message.
 * @param {string} message - The error message to display.
 */
function showError(message) {
  const errorMessage = document.getElementById('error-message');
  errorMessage.textContent = message;
  errorMessage.style.display = 'flex';
}

/**
 * Hide error message.
 */
function hideError() {
  const errorMessage = document.getElementById('error-message');
  errorMessage.textContent = '';
  errorMessage.style.display = 'none';
}

// Core Functions

/**
 * Display all installed extensions with pagination and filters.
 * @param {number} page - The page number to display.
 */
function displayExtensions(page = 1) {
  showLoading();
  hideError();
  chrome.management.getAll(function(extensions) {
      if (chrome.runtime.lastError) {
          hideLoading();
          showError(`Error fetching extensions: ${chrome.runtime.lastError.message}`);
          return;
      }

      const extensionList = document.getElementById('extension-list');
      extensionList.innerHTML = ''; // Clear previous list

      const preferences = getPreferences();
      const sortOrder = preferences.sortOrder;

      // Sort extensions based on sortOrder
      if (sortOrder.length > 0) {
          extensions.sort((a, b) => {
              const indexA = sortOrder.indexOf(a.id);
              const indexB = sortOrder.indexOf(b.id);
              if (indexA === -1 && indexB === -1) return 0;
              if (indexA === -1) return 1;
              if (indexB === -1) return -1;
              return indexA - indexB;
          });
      }

      // Apply filters
      const typeFilter = document.getElementById('type-filter').value;
      const statusFilter = document.getElementById('status-filter').value;

      let filteredExtensions = extensions.filter(ext => {
          let typeMatch = true;
          let statusMatch = true;

          if (typeFilter !== 'all') {
              if (typeFilter === 'extension') typeMatch = !ext.isApp && !ext.isTheme;
              if (typeFilter === 'theme') typeMatch = ext.isTheme;
              if (typeFilter === 'app') typeMatch = ext.isApp;
          }

          if (statusFilter !== 'all') {
              if (statusFilter === 'enabled') statusMatch = ext.enabled;
              if (statusFilter === 'disabled') statusMatch = !ext.enabled;
          }

          return typeMatch && statusMatch;
      });

      // Search Filter
      const searchTerm = document.getElementById('search-input').value.toLowerCase();
      if (searchTerm) {
          filteredExtensions = filteredExtensions.filter(ext => ext.name.toLowerCase().includes(searchTerm));
      }

      // Pagination
      const totalExtensions = filteredExtensions.length;
      const totalPages = Math.ceil(totalExtensions / EXTENSIONS_PER_PAGE);
      const currentPage = Math.min(Math.max(page, 1), totalPages || 1);
      const startIndex = (currentPage - 1) * EXTENSIONS_PER_PAGE;
      const endIndex = startIndex + EXTENSIONS_PER_PAGE;
      const extensionsToDisplay = filteredExtensions.slice(startIndex, endIndex);

      // Update pagination controls
      document.getElementById('current-page').textContent = currentPage;
      document.getElementById('total-pages').textContent = totalPages || 1;
      document.getElementById('prev-page').disabled = currentPage === 1;
      document.getElementById('next-page').disabled = currentPage === totalPages || totalPages === 0;

      // Create a Document Fragment to improve performance
      const fragment = document.createDocumentFragment();

      extensionsToDisplay.forEach(function(extension) {
          // Create container for each extension
          const extensionItem = document.createElement('div');
          extensionItem.classList.add('extension-item');

          // Extension icon with higher resolution
          const icon = document.createElement('img');
          if (extension.icons && extension.icons.length > 0) {
              // Use the highest resolution icon available
              const sortedIcons = extension.icons.sort((a, b) => b.size - a.size);
              icon.src = sortedIcons[0].url;
          } else {
              icon.src = 'icons/128x128.png'; // Default icon if none available
          }
          icon.alt = sanitizeHTML(extension.name);
          icon.classList.add('extension-icon');
          extensionItem.appendChild(icon);

          // Actions Container
          const actions = document.createElement('div');
          actions.classList.add('extension-actions');

          // Enable/Disable Button
          const toggleButton = document.createElement('button');
          toggleButton.textContent = extension.enabled ? 'Disable' : 'Enable';
          toggleButton.classList.add('toggle-button');
          toggleButton.setAttribute('aria-label', extension.enabled ? 'Disable Extension' : 'Enable Extension');
          toggleButton.addEventListener('click', function() {
              toggleExtension(extension.id, !extension.enabled);
          });
          actions.appendChild(toggleButton);

          // Details Button
          const detailsButton = document.createElement('button');
          detailsButton.textContent = 'Details';
          detailsButton.classList.add('details-button');
          detailsButton.setAttribute('aria-label', 'View Details');
          detailsButton.addEventListener('click', function() {
              openDetails(extension.id);
          });
          actions.appendChild(detailsButton);

          // Delete Button
          const deleteButton = document.createElement('button');
          deleteButton.textContent = 'Delete';
          deleteButton.classList.add('delete-button');
          deleteButton.setAttribute('aria-label', 'Delete Extension');
          deleteButton.addEventListener('click', function() {
              confirmDeletion(extension.id, extension.name);
          });
          actions.appendChild(deleteButton);

          extensionItem.appendChild(actions);
          fragment.appendChild(extensionItem);
      });

      // Append all extensions to the list
      extensionList.appendChild(fragment);

      // Show a message if no extensions found
      if (filteredExtensions.length === 0) {
          const noExtensionsMessage = document.createElement('p');
          noExtensionsMessage.textContent = 'No extensions found.';
          noExtensionsMessage.classList.add('no-extensions-message');
          extensionList.appendChild(noExtensionsMessage);
      }

      hideLoading();
  });
}

/**
 * Toggle an extension's enabled status.
 * @param {string} extensionId - The ID of the extension to toggle.
 * @param {boolean} enable - Whether to enable or disable the extension.
 */
function toggleExtension(extensionId, enable) {
  showLoading();
  hideError();
  chrome.management.setEnabled(extensionId, enable, function() {
      if (chrome.runtime.lastError) {
          hideLoading();
          showError(`Error: ${chrome.runtime.lastError.message}`);
          return;
      }
      displayExtensions(getCurrentPage());
      hideLoading();
  });
}

/**
 * Open extension details in a new tab.
 * @param {string} extensionId - The ID of the extension.
 */
function openDetails(extensionId) {
    showLoading();
    hideError();
    chrome.management.get(extensionId, function(extension) {
        hideLoading();
        if (chrome.runtime.lastError) {
            showError(`Error: ${chrome.runtime.lastError.message}`);
            return;
        }
        // Ändere die URL auf die lokale Details-Seite der Erweiterung
        const url = `chrome-extension://${chrome.runtime.id}/details.html?id=${extension.id}`;
        chrome.tabs.create({ url: url }, function(tab) {
            if (chrome.runtime.lastError) {
                showError(`Error opening details: ${chrome.runtime.lastError.message}`);
            }
        });
    });
}


/**
 * Confirm and delete an extension.
 * @param {string} extensionId - The ID of the extension to delete.
 * @param {string} extensionName - The name of the extension.
 */
function confirmDeletion(extensionId, extensionName) {
  const confirmation = confirm(`Are you sure you want to delete the extension "${extensionName}"?`);
  if (confirmation) {
      showLoading();
      hideError();
      chrome.management.uninstall(extensionId, { showConfirmDialog: false }, function() {
          if (chrome.runtime.lastError) {
              hideLoading();
              showError(`Error: ${chrome.runtime.lastError.message}`);
              return;
          }
          displayExtensions(getCurrentPage());
          hideLoading();
      });
  }
}

/**
 * Toggle all extensions between enabled and disabled.
 */
function toggleAllExtensions() {
  showLoading();
  hideError();
  chrome.management.getAll(function(extensions) {
      if (chrome.runtime.lastError) {
          hideLoading();
          showError(`Error fetching extensions: ${chrome.runtime.lastError.message}`);
          return;
      }

      const allEnabled = extensions.every(extension => extension.enabled);
      let processed = 0;
      const total = extensions.length;

      extensions.forEach(function(extension) {
          // Toggle only if nicht eine Systemerweiterung
          if (!extension.isApp && !extension.isTheme) {
              chrome.management.setEnabled(extension.id, !allEnabled, function() {
                  if (chrome.runtime.lastError) {
                      console.error(`Failed to toggle ${extension.name}: ${chrome.runtime.lastError.message}`);
                  }
                  processed++;
                  if (processed === total) {
                      displayExtensions(getCurrentPage());
                      hideLoading();
                  }
              });
          } else {
              processed++;
              if (processed === total) {
                  displayExtensions(getCurrentPage());
                  hideLoading();
              }
          }
      });

      // Update toggle button text
      const toggleButton = document.getElementById('toggle-button');
      toggleButton.textContent = allEnabled ? 'Enable All' : 'Disable All';
  });
}

/**
 * Hide or show disabled extensions based on button state.
 */
function toggleHideShowDisabled() {
  showLoading();
  hideError();
  const hideShowButton = document.getElementById('hide-show-button');
  let hidden = hideShowButton.dataset.hidden === 'true';
  hidden = !hidden;
  hideShowButton.dataset.hidden = hidden;
  hideShowButton.textContent = hidden ? 'Show Disabled' : 'Hide Disabled';

  // Update display
  displayExtensions(getCurrentPage());
}

/**
 * Sort extensions and save the order in preferences.
 */
function sortExtensions() {
  showLoading();
  hideError();
  chrome.management.getAll(function(extensions) {
      if (chrome.runtime.lastError) {
          hideLoading();
          showError(`Error fetching extensions: ${chrome.runtime.lastError.message}`);
          return;
      }

      const preferences = getPreferences();
      const currentOrder = preferences.sortOrder;
      const extensionIds = extensions.map(ext => ext.id);

      // Toggle sort order
      if (currentOrder.length > 0) {
          preferences.sortOrder = [];
      } else {
          // Set a new order based on extension names
          extensions.sort((a, b) => a.name.localeCompare(b.name));
          preferences.sortOrder = extensions.map(ext => ext.id);
      }

      savePreferences(preferences);
      displayExtensions(getCurrentPage());
      hideLoading();
  });
}

/**
 * Get the current page number from the pagination display.
 * @returns {number} - The current page number.
 */
function getCurrentPage() {
  const currentPage = parseInt(document.getElementById('current-page').textContent, 10);
  return isNaN(currentPage) ? 1 : currentPage;
}

/**
 * Handle pagination controls.
 */
function setupPagination() {
  document.getElementById('prev-page').addEventListener('click', function() {
      let currentPage = getCurrentPage();
      if (currentPage > 1) {
          currentPage--;
          displayExtensions(currentPage);
      }
  });

  document.getElementById('next-page').addEventListener('click', function() {
      let currentPage = getCurrentPage();
      const totalPages = parseInt(document.getElementById('total-pages').textContent, 10);
      if (currentPage < totalPages) {
          currentPage++;
          displayExtensions(currentPage);
      }
  });
}

/**
 * Initialize filter options.
 */
function setupFilters() {
  const typeFilter = document.getElementById('type-filter');
  const statusFilter = document.getElementById('status-filter');

  typeFilter.addEventListener('change', function() {
      displayExtensions(1);
  });

  statusFilter.addEventListener('change', function() {
      displayExtensions(1);
  });
}

/**
 * Initialize search functionality with debounce and additional features.
 */
function setupSearch() {
  const searchInput = document.getElementById('search-input');
  let debounceTimeout;
  searchInput.addEventListener('input', function() {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(function() {
          displayExtensions(1);
      }, 300);
  });

  // Optional: Add clear search button functionality
  // Could be implemented with an additional button in the HTML
}

/**
 * Sanitize HTML to prevent XSS
 * @param {string} str - The string to sanitize.
 * @returns {string} - The sanitized string.
 */
function sanitizeHTML(str) {
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

// Initialization Function

/**
 * Initialize the popup by setting up event listeners and displaying extensions.
 */
function initializePopup() {
  setupPagination();
  setupFilters();
  setupSearch();
  displayExtensions();
}

/**
 * Handle errors globally if needed.
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.type === 'error') {
      showError(request.message);
  }
});

// Initialize the popup when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initializePopup);
