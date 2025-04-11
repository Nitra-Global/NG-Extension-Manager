/**
 * Nitra Plugin Manager
 * Handles fetching, displaying, and installing plugins from GitHub repository
 */

// Configuration constants
const CONFIG = {
    repoUrl: 'https://api.github.com/repos/Nitra-Global/plugins/contents/pluginsNGEM',
    rawUrlBase: 'https://raw.githubusercontent.com/Nitra-Global/plugins/main/pluginsNGEM/',
    pluginsPerPage: 10,
    storageKeys: {
      pluginList: 'pluginList',
      lastFetched: 'lastFetchedTimestamp'
    },
    cacheTTL: 3600000, // 1 hour in milliseconds
    fetchTimeout: 10000 // 10 seconds timeout for fetch operations
  };
  
  // State management
  const state = {
    currentPage: 1,
    allPlugins: [],
    isLoading: false,
    hasError: false,
    errorMessage: ''
  };
  
  /**
   * Fetches plugins from GitHub repository with timeout and retry functionality
   * @param {number} retries - Number of retries on failure
   * @returns {Promise<Array>} Array of plugin directory objects
   */
  async function fetchPlugins(retries = 2) {
    state.isLoading = true;
    updateUIState();
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.fetchTimeout);
      
      const response = await fetch(CONFIG.repoUrl, { 
        signal: controller.signal,
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`GitHub API responded with status ${response.status}: ${errorData.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid response format from GitHub API');
      }
      
      const plugins = data.filter(item => item.type === 'dir');
      
      if (plugins.length === 0) {
        console.warn('No plugins found in repository');
      }
      
      await cachePluginList(plugins);
      
      state.hasError = false;
      state.errorMessage = '';
      state.allPlugins = plugins;
      state.isLoading = false;
      
      return plugins;
    } catch (error) {
      // Handle abort/timeout specifically
      if (error.name === 'AbortError') {
        console.error("Request timed out when fetching plugins");
        
        // Retry logic
        if (retries > 0) {
          console.log(`Retrying fetchPlugins (${retries} retries left)...`);
          return fetchPlugins(retries - 1);
        }
      }
      
      console.error("Error fetching plugins:", error);
      
      state.hasError = true;
      state.errorMessage = `Could not load plugins: ${error.message}`;
      state.isLoading = false;
      
      // Fall back to cached data if available
      const cachedPlugins = await getCachedPluginList();
      if (cachedPlugins.length > 0) {
        console.log("Using cached plugin list due to fetch failure");
        state.allPlugins = cachedPlugins;
        return cachedPlugins;
      }
      
      return [];
    } finally {
      updateUIState();
    }
  }
  
  /**
   * Caches the plugin list and sets a timestamp
   * @param {Array} plugins - Array of plugin objects to cache
   */
  async function cachePluginList(plugins) {
    try {
      await chrome.storage.local.set({ 
        [CONFIG.storageKeys.pluginList]: plugins,
        [CONFIG.storageKeys.lastFetched]: Date.now()
      });
    } catch (error) {
      console.error("Error caching plugin list:", error);
      // Continue execution even if caching fails
    }
  }
  
  /**
   * Retrieves cached plugin list if not expired
   * @returns {Promise<Array>} Cached plugins or empty array
   */
  async function getCachedPluginList() {
    try {
      const data = await chrome.storage.local.get([
        CONFIG.storageKeys.pluginList, 
        CONFIG.storageKeys.lastFetched
      ]);
      
      const pluginList = data[CONFIG.storageKeys.pluginList] || [];
      const lastFetched = data[CONFIG.storageKeys.lastFetched] || 0;
      
      // Check if cache is expired
      if (Date.now() - lastFetched > CONFIG.cacheTTL) {
        console.log("Cached plugin list expired");
        return [];
      }
      
      return pluginList;
    } catch (error) {
      console.error("Error retrieving cached plugin list:", error);
      return [];
    }
  }
  
  /**
   * Fetches plugin data from cache or GitHub
   * @param {string} pluginName - Name of the plugin to fetch
   * @returns {Promise<Object|null>} Plugin data or null if not found
   */
  async function getPluginData(pluginName) {
    if (!pluginName) {
      console.error("Invalid plugin name requested");
      return null;
    }
    
    try {
      // Try to get from cache first
      const cachedData = await chrome.storage.local.get(pluginName);
      if (cachedData[pluginName]) {
        return cachedData[pluginName];
      }
      
      // Fetch from GitHub if not in cache
      const rawUrl = `${CONFIG.rawUrlBase}${encodeURIComponent(pluginName)}/plugin.json`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.fetchTimeout);
      
      const response = await fetch(rawUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch plugin data: ${response.status} ${response.statusText}`);
      }
      
      const pluginData = await response.json();
      
      // Validate minimum required plugin data
      if (!pluginData.name || !pluginData.description) {
        throw new Error("Invalid plugin data: missing required fields");
      }
      
      // Cache the data
      await chrome.storage.local.set({ [pluginName]: pluginData });
      
      return pluginData;
    } catch (error) {
      console.error(`Error loading plugin ${pluginName}:`, error);
      return null;
    }
  }
  
  /**
   * Displays filtered plugins based on search input and current page
   */
  async function displayPlugins() {
    const searchInput = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
    const pluginList = document.getElementById('plugin-list');
    
    if (!pluginList) {
      console.error("Plugin list element not found");
      return;
    }
    
    // Clear existing content
    pluginList.innerHTML = '';
    
    // Show loading state
    if (state.isLoading) {
      const loadingElement = document.createElement('div');
      loadingElement.className = 'loading-indicator';
      loadingElement.textContent = 'Loading plugins...';
      pluginList.appendChild(loadingElement);
      return;
    }
    
    // Show error state
    if (state.hasError && state.allPlugins.length === 0) {
      const errorElement = document.createElement('div');
      errorElement.className = 'error-message';
      errorElement.textContent = state.errorMessage || 'Failed to load plugins.';
      pluginList.appendChild(errorElement);
      return;
    }
    
    // Filter plugins by search term
    let filteredPlugins = state.allPlugins;
    if (searchInput) {
      filteredPlugins = filteredPlugins.filter(plugin => 
        plugin.name.toLowerCase().includes(searchInput)
      );
      
      if (filteredPlugins.length === 0) {
        const noResultsElement = document.createElement('div');
        noResultsElement.className = 'no-results';
        noResultsElement.textContent = `No plugins found matching "${searchInput}"`;
        pluginList.appendChild(noResultsElement);
        // Hide pagination when no results
        document.getElementById('pagination').innerHTML = '';
        return;
      }
    }
    
    // Calculate pagination
    const start = (state.currentPage - 1) * CONFIG.pluginsPerPage;
    const end = start + CONFIG.pluginsPerPage;
    const currentPlugins = filteredPlugins.slice(start, end);
    
    // Create plugin elements
    const pluginPromises = currentPlugins.map(async plugin => {
      const pluginElement = document.createElement('div');
      pluginElement.className = 'plugin-card';
      pluginElement.setAttribute('data-plugin-name', plugin.name);
      
      try {
        const pluginData = await getPluginData(plugin.name);
        
        if (pluginData) {
          // Format plugin version if available
          const versionText = pluginData.version ? `<span class="plugin-version">v${pluginData.version}</span>` : '';
          
          pluginElement.innerHTML = `
            <h3>${sanitizeHTML(pluginData.name)} ${versionText}</h3>
            <p>${sanitizeHTML(pluginData.description)}</p>
            <div class="plugin-actions">
              <button class="install-plugin-button" data-plugin-name="${plugin.name}">
                Install
              </button>
            </div>
          `;
        } else {
          pluginElement.innerHTML = `
            <h3>${sanitizeHTML(plugin.name)}</h3>
            <p class="error-text">Error loading plugin data.</p>
            <div class="plugin-actions">
              <button class="retry-button" data-plugin-name="${plugin.name}">
                Retry
              </button>
            </div>
          `;
        }
      } catch (error) {
        console.error(`Error creating element for plugin ${plugin.name}:`, error);
        pluginElement.innerHTML = `
          <h3>${sanitizeHTML(plugin.name)}</h3>
          <p class="error-text">Failed to load plugin information.</p>
        `;
      }
      
      return pluginElement;
    });
    
    // Wait for all plugin elements to be created
    const pluginElements = await Promise.all(pluginPromises);
    
    // Append all elements to DOM at once (more efficient)
    pluginElements.forEach(element => {
      pluginList.appendChild(element);
    });
    
    // Update event listeners and pagination
    addPluginButtonListeners();
    displayPagination(filteredPlugins.length);
  }
  
  /**
   * Sanitizes HTML to prevent XSS attacks
   * @param {string} unsafe - Potentially unsafe HTML string
   * @returns {string} Sanitized string
   */
  function sanitizeHTML(unsafe) {
    if (!unsafe) return '';
    
    return unsafe
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
  
  /**
   * Updates UI based on current state
   */
  function updateUIState() {
    // Update loading indicator
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.disabled = state.isLoading;
      refreshButton.textContent = state.isLoading ? 'Loading...' : 'Refresh';
    }
    
    // Show error notification if needed
    if (state.hasError) {
      const errorBar = document.getElementById('error-notification') || createErrorNotification();
      errorBar.textContent = state.errorMessage;
      errorBar.style.display = 'block';
    } else {
      const errorBar = document.getElementById('error-notification');
      if (errorBar) {
        errorBar.style.display = 'none';
      }
    }
    
    // Update the plugins display
    displayPlugins();
  }
  
  /**
   * Creates an error notification element
   * @returns {HTMLElement} Error notification element
   */
  function createErrorNotification() {
    const errorBar = document.createElement('div');
    errorBar.id = 'error-notification';
    errorBar.className = 'error-notification';
    
    const closeButton = document.createElement('button');
    closeButton.className = 'error-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.addEventListener('click', () => {
      errorBar.style.display = 'none';
    });
    
    errorBar.appendChild(closeButton);
    document.body.insertBefore(errorBar, document.body.firstChild);
    
    return errorBar;
  }
  
  /**
   * Displays pagination controls
   * @param {number} totalItems - Total number of items to paginate
   */
  function displayPagination(totalItems) {
    const totalPages = Math.ceil(totalItems / CONFIG.pluginsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (!pagination) {
      console.error("Pagination element not found");
      return;
    }
    
    pagination.innerHTML = '';
    
    // Don't show pagination if only one page
    if (totalPages <= 1) {
      return;
    }
    
    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '← Previous';
    prevButton.className = 'pagination-prev';
    prevButton.disabled = state.currentPage === 1;
    prevButton.setAttribute('aria-label', 'Previous page');
    prevButton.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        displayPlugins();
        // Scroll to top of results
        document.getElementById('plugin-list').scrollIntoView({ behavior: 'smooth' });
      }
    });
    pagination.appendChild(prevButton);
    
    // Page numbers - show limited range for many pages
    let startPage = Math.max(1, state.currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Adjust start if end is maxed out
    if (endPage === totalPages) {
      startPage = Math.max(1, endPage - 4);
    }
    
    // First page
    if (startPage > 1) {
      const firstButton = document.createElement('button');
      firstButton.textContent = '1';
      firstButton.addEventListener('click', () => {
        state.currentPage = 1;
        displayPlugins();
        document.getElementById('plugin-list').scrollIntoView({ behavior: 'smooth' });
      });
      pagination.appendChild(firstButton);
      
      if (startPage > 2) {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '...';
        ellipsis.className = 'pagination-ellipsis';
        pagination.appendChild(ellipsis);
      }
    }
    
    // Page buttons
    for (let i = startPage; i <= endPage; i++) {
      const pageButton = document.createElement('button');
      pageButton.textContent = i;
      pageButton.className = i === state.currentPage ? 'pagination-current' : '';
      pageButton.setAttribute('aria-label', `Page ${i} of ${totalPages}`);
      pageButton.setAttribute('aria-current', i === state.currentPage ? 'page' : 'false');
      
      pageButton.addEventListener('click', () => {
        state.currentPage = i;
        displayPlugins();
        document.getElementById('plugin-list').scrollIntoView({ behavior: 'smooth' });
      });
      
      pagination.appendChild(pageButton);
    }
    
    // Last page ellipsis
    if (endPage < totalPages - 1) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      ellipsis.className = 'pagination-ellipsis';
      pagination.appendChild(ellipsis);
    }
    
    // Last page button
    if (endPage < totalPages) {
      const lastButton = document.createElement('button');
      lastButton.textContent = totalPages;
      lastButton.addEventListener('click', () => {
        state.currentPage = totalPages;
        displayPlugins();
        document.getElementById('plugin-list').scrollIntoView({ behavior: 'smooth' });
      });
      pagination.appendChild(lastButton);
    }
    
    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next →';
    nextButton.className = 'pagination-next';
    nextButton.disabled = state.currentPage === totalPages;
    nextButton.setAttribute('aria-label', 'Next page');
    nextButton.addEventListener('click', () => {
      if (state.currentPage < totalPages) {
        state.currentPage++;
        displayPlugins();
        document.getElementById('plugin-list').scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    pagination.appendChild(nextButton);
  }
  
  /**
   * Adds event listeners to plugin buttons
   */
  function addPluginButtonListeners() {
    // Install buttons
    document.querySelectorAll('.install-plugin-button').forEach(button => {
      button.addEventListener('click', () => {
        const pluginName = button.dataset.pluginName;
        openInstallModal(pluginName);
      });
    });
    
    // Retry buttons
    document.querySelectorAll('.retry-button').forEach(button => {
      button.addEventListener('click', async () => {
        const pluginName = button.dataset.pluginName;
        const parentElement = button.closest('.plugin-card');
        
        if (parentElement) {
          parentElement.innerHTML = '<p>Loading plugin data...</p>';
          
          // Clear cache for this plugin
          try {
            await chrome.storage.local.remove(pluginName);
          } catch (error) {
            console.error(`Error clearing cache for plugin ${pluginName}:`, error);
          }
          
          // Reload all plugins to update the specific one
          displayPlugins();
        }
      });
    });
  }
  
  /**
   * Opens the installation modal for a plugin
   * @param {string} pluginName - Name of plugin to install
   */
  function openInstallModal(pluginName) {
    const modal = document.getElementById('instruction-modal');
    if (!modal) {
      console.error("Modal element not found");
      return;
    }
    
    // Set plugin name in modal
    const pluginNameElement = document.getElementById('modal-plugin-name');
    if (pluginNameElement) {
      pluginNameElement.textContent = pluginName;
    }
    
    // Set up GitHub link button
    const goToPluginButton = document.getElementById('go-to-plugin-button');
    if (goToPluginButton) {
      goToPluginButton.onclick = function() {
        window.open(`https://github.com/Nitra-Global/plugins/tree/main/pluginsNGEM/${encodeURIComponent(pluginName)}`);
      };
    }
    
    // Set up close button
    const closeButton = modal.querySelector('.close-button');
    if (closeButton) {
      closeButton.onclick = function() {
        modal.style.display = "none";
      };
    }
    
    // Set up click outside to close
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    };
    
    // Show the modal
    modal.style.display = "block";
  }
  
  /**
   * Clears cache and refreshes plugin list
   */
  async function clearCacheAndRefresh() {
    if (state.isLoading) {
      return; // Prevent multiple simultaneous refreshes
    }
    
    try {
      // Get all plugin names from state
      const pluginKeys = state.allPlugins.map(plugin => plugin.name);
      
      // Add config storage keys
      const keysToRemove = [
        ...pluginKeys, 
        CONFIG.storageKeys.pluginList,
        CONFIG.storageKeys.lastFetched
      ];
      
      await chrome.storage.local.remove(keysToRemove);
      
      // Reset state
      state.allPlugins = [];
      state.currentPage = 1;
      state.hasError = false;
      state.errorMessage = '';
      
      // Fetch fresh data
      await fetchPlugins();
    } catch (error) {
      console.error("Error clearing cache:", error);
      state.hasError = true;
      state.errorMessage = `Failed to clear cache: ${error.message}`;
      updateUIState();
    }
  }
  
  /**
   * Debounces a function call
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
  
  /**
   * Initializes the application
   */
  async function initialize() {
    try {
      // Check for existing DOM elements
      if (!document.getElementById('plugin-list') || 
          !document.getElementById('pagination')) {
        console.error("Required DOM elements are missing");
        return;
      }
      
      // Get extension version from manifest
      try {
        const manifest = chrome.runtime.getManifest();
        const versionElement = document.getElementById('extension-version');
        if (versionElement && manifest.version) {
          versionElement.textContent = manifest.version;
        }
      } catch (error) {
        console.error("Error getting extension version:", error);
      }
      
      // Try to load from cache first
      const cachedPlugins = await getCachedPluginList();
      if (cachedPlugins.length > 0) {
        console.log("Using cached plugin list");
        state.allPlugins = cachedPlugins;
        updateUIState();
      }
      
      // Always fetch fresh data (but we showed cached data first for better UX)
      await fetchPlugins();
    } catch (error) {
      console.error("Error during initialization:", error);
      state.hasError = true;
      state.errorMessage = `Initialization failed: ${error.message}`;
      updateUIState();
    }
  }
  
  // Set up event listeners
  document.addEventListener('DOMContentLoaded', () => {
    // Search input with debounce
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        state.currentPage = 1;
        displayPlugins();
      }, 300));
    }
    
    // Refresh button
    const refreshButton = document.getElementById('refresh-button');
    if (refreshButton) {
      refreshButton.addEventListener('click', clearCacheAndRefresh);
    }
    
    // Initialize the application
    initialize();
  });
  
  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      fetchPlugins,
      getPluginData,
      displayPlugins
    };
  }
