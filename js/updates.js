// API endpoints
const versionAPI = "https://raw.githubusercontent.com/Nitra-Global/api/refs/heads/main/NG%20Extension%20Manager%20/version.json";
const changelogAPI = "https://api.github.com/repos/nitra-global/NG-Extension-Manager/releases";

// Cache keys
const VERSION_CACHE_KEY = "ngExtension_latestVersionCache";
const RELEASES_CACHE_KEY = "ngExtension_releasesCache";
const CACHE_TTL = 3600; // Cache time-to-live in seconds (1 hour)

// Get extension manifest data
const manifestData = chrome.runtime.getManifest();
const installedVersion = manifestData.version;
const extensionTitle = manifestData.name || "NG Extension Manager";

// DOM elements
let modal, statusMessage, statusIcon;
let releasesContainer, searchInput, sortOptions;
let releaseNotesBtn, clearCacheBtn, closeModalBtn;

// Global variables
let latestVersion = null;
let allReleases = [];

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    initElements();
    initEventListeners();
    
    // Display extension title and installed version
    document.getElementById("extension-title").textContent = extensionTitle;
    document.getElementById("installed-version").textContent = installedVersion;
    
    // Check status and fetch releases data
    checkVersionAndUpdateStatus();
});

// Check version and update status
async function checkVersionAndUpdateStatus() {
    updateStatus("loading", "Checking for updates...");
    
    try {
        if (!navigator.onLine) {
            throw new Error("You are offline");
        }
        
        // Fetch latest version
        const versionData = await fetchWithCache(versionAPI, VERSION_CACHE_KEY);
        latestVersion = versionData.version;
        
        // Update latest version display
        document.getElementById("latest-version").textContent = latestVersion;
        
        // Compare versions and update status
        if (isNewVersionAvailable(installedVersion, latestVersion)) {
            updateStatus("outdated", `Update available! Version ${latestVersion} can be installed.`);
        } else {
            updateStatus("up-to-date", `${extensionTitle} is up to date`);
        }
        
        // Pre-fetch releases for later use
        fetchReleases();
    } catch (error) {
        console.error("Error checking version:", error);
        updateStatus("error", `Error checking for updates: ${error.message}`);
    }
}

// Fetch releases for the modal
async function fetchReleases() {
    try {
        if (!navigator.onLine) {
            throw new Error("You are offline");
        }
        
        // Fetch releases data
        allReleases = await fetchWithCache(changelogAPI, RELEASES_CACHE_KEY);
        
        // Pre-sort releases by date (newest first)
        allReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    } catch (error) {
        console.error("Error fetching releases:", error);
        showToast(`Error loading releases: ${error.message}`);
    }
}

// Helper function to check if a new version is available
function isNewVersionAvailable(currentVersion, latestVersion) {
    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const current = currentParts[i] || 0;
        const latest = latestParts[i] || 0;
        
        if (latest > current) return true;
        if (latest < current) return false;
    }
    
    return false; // Versions are identical
}

// Update the status indicator and message
function updateStatus(status, message) {
    statusMessage.textContent = message;
    
    // Remove all status classes
    statusIcon.classList.remove("up-to-date", "outdated", "error", "loading");
    
    // Add appropriate class
    statusIcon.classList.add(status);
    
    // Update the card status as well
    const statusCard = document.querySelector(".status-card");
    statusCard.classList.remove("up-to-date", "outdated", "error", "loading");
    statusCard.classList.add(status);
}

// Open the release notes modal
function openReleaseModal() {
    if (allReleases.length === 0) {
        showToast("Loading releases data...");
        fetchReleases().then(() => {
            if (allReleases.length > 0) {
                displayReleases(allReleases);
                modal.style.display = "block";
                document.body.classList.add("modal-open");
            } else {
                showToast("No releases available");
            }
        });
    } else {
        displayReleases(allReleases);
        modal.style.display = "block";
        document.body.classList.add("modal-open");
    }
}

// Close the release notes modal
function closeReleaseModal() {
    modal.style.display = "none";
    document.body.classList.remove("modal-open");
}

// Display releases in the modal
function displayReleases(releases) {
    releasesContainer.innerHTML = "";
    
    if (releases.length === 0) {
        releasesContainer.innerHTML = "<p class='no-results'>No releases found</p>";
        return;
    }
    
    releases.forEach(release => {
        const releaseItem = document.createElement("div");
        releaseItem.className = "release-item";
        
        const publishDate = new Date(release.published_at).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        releaseItem.innerHTML = `
            <div class="release-header">
                <span class="release-title">${release.name || release.tag_name}</span>
                <span class="release-date">${publishDate}</span>
            </div>
            <span class="release-tag ${release.prerelease ? 'pre-release' : 'stable'}">
                ${release.prerelease ? 'Pre-Release' : 'Stable'}
            </span>
            <div class="release-content">
                ${markdownToHTML(release.body || 'No release notes available')}
            </div>
        `;
        
        releasesContainer.appendChild(releaseItem);
    });
}

// Convert markdown to HTML
function markdownToHTML(markdown) {
    if (!markdown) return '';
    
    // Replace markdown headers
    let html = markdown
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Replace markdown lists
    html = html
        .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
        .replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>');
    
    // Fix consecutive list items
    html = html
        .replace(/<\/ul>\s*<ul>/g, '');
    
    // Replace markdown links
    html = html
        .replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    
    // Replace markdown code blocks
    html = html
        .replace(/```([^`]+)```/gim, '<pre><code>$1</code></pre>');
    
    // Replace markdown inline code
    html = html
        .replace(/`([^`]+)`/gim, '<code>$1</code>');
    
    // Replace markdown bold
    html = html
        .replace(/\*\*([^*]+)\*\*/gim, '<strong>$1</strong>')
        .replace(/__([^_]+)__/gim, '<strong>$1</strong>');
    
    // Replace markdown italic
    html = html
        .replace(/\*([^*]+)\*/gim, '<em>$1</em>')
        .replace(/_([^_]+)_/gim, '<em>$1</em>');
    
    // Replace line breaks
    html = html
        .replace(/\n/gim, '<br>');
    
    return html;
}

// Filter releases based on search input
function filterReleases() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!allReleases || allReleases.length === 0) return;
    
    const filteredReleases = allReleases.filter(release => {
        const nameMatch = (release.name || '').toLowerCase().includes(searchTerm);
        const bodyMatch = (release.body || '').toLowerCase().includes(searchTerm);
        const tagMatch = (release.tag_name || '').toLowerCase().includes(searchTerm);
        
        return nameMatch || bodyMatch || tagMatch;
    });
    
    displayReleases(filteredReleases);
}

// Sort releases and update display
function sortReleasesAndUpdate() {
    const sortBy = sortOptions.value;
    
    if (!allReleases || allReleases.length === 0) return;
    
    // Create a copy of allReleases to avoid modifying the original array
    const sortedReleases = [...allReleases];
    
    switch (sortBy) {
        case "date":
            sortedReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
            break;
        case "name":
            sortedReleases.sort((a, b) => (a.name || a.tag_name).localeCompare(b.name || b.tag_name));
            break;
        case "type":
            sortedReleases.sort((a, b) => {
                if (a.prerelease === b.prerelease) {
                    return new Date(b.published_at) - new Date(a.published_at);
                }
                return a.prerelease ? 1 : -1;
            });
            break;
        case "version":
            sortedReleases.sort((a, b) => compareVersions(b.tag_name || '', a.tag_name || ''));
            break;
        default:
            break;
    }
    
    displayReleases(sortedReleases);
}

// Compare version strings
function compareVersions(a, b) {
    const aParts = a.replace(/^v/, '').split('.').map(Number);
    const bParts = b.replace(/^v/, '').split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] || 0;
        const bPart = bParts[i] || 0;
        
        if (aPart > bPart) return 1;
        if (aPart < bPart) return -1;
    }
    
    return 0;
}

// Clear cache and reload the page
function clearCacheAndReload() {
    // Clear local storage
    localStorage.clear();
    
    // Show confirmation toast
    showToast("Cache cleared successfully!");
    
    // Reload the page after a short delay
    setTimeout(() => {
        location.reload();
    }, 1000);
}

// Show a toast notification
function showToast(message, duration = 3000) {
    // Remove any existing toast
    const existingToast = document.querySelector(".toast");
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
        toast.classList.add("show");
    }, 10);
    
    // Hide toast after duration
    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

// Debounce function to limit rate of function calls
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Fetch data with caching
async function fetchWithCache(url, cacheKey) {
    // Check cache first
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
        return cachedData;
    }
    
    // Fetch fresh data
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Cache the data
    cacheData(cacheKey, data, CACHE_TTL);
    
    return data;
}

// Store data in cache
function cacheData(key, data, ttl) {
    const cache = {
        data: data,
        expiry: Date.now() + (ttl * 1000)
    };
    
    localStorage.setItem(key, JSON.stringify(cache));
}

// Get data from cache
function getCachedData(key) {
    const cachedData = localStorage.getItem(key);
    if (!cachedData) return null;
    
    try {
        const cache = JSON.parse(cachedData);
        
        // Check if cache has expired
        if (Date.now() > cache.expiry) {
            localStorage.removeItem(key);
            return null;
        }
        
        return cache.data;
    } catch (error) {
        console.warn(`Failed to parse cached data for ${key}:`, error);
        localStorage.removeItem(key);
        return null;
    }
}

// Initialize DOM element references
function initElements() {
    modal = document.getElementById("release-modal");
    statusMessage = document.getElementById("status-message");
    statusIcon = document.getElementById("status-icon");
    releasesContainer = document.getElementById("releases-container");
    searchInput = document.getElementById("search-input");
    sortOptions = document.getElementById("sort-options");
    releaseNotesBtn = document.getElementById("release-notes-btn");
    clearCacheBtn = document.getElementById("clear-cache-btn");
    closeModalBtn = document.getElementById("close-modal");
}

// Set up event listeners
function initEventListeners() {
    // Modal controls
    releaseNotesBtn.addEventListener("click", openReleaseModal);
    closeModalBtn.addEventListener("click", closeReleaseModal);
    
    // Close modal when clicking outside of it
    window.addEventListener("click", (event) => {
        if (event.target === modal) {
            closeReleaseModal();
        }
    });
    
    // Close modal with escape key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && modal.style.display === "block") {
            closeReleaseModal();
        }
    });
    
    // Clear cache button
    clearCacheBtn.addEventListener("click", clearCacheAndReload);
    
    // Search and sort in modal
    searchInput.addEventListener("input", debounce(filterReleases, 300));
    sortOptions.addEventListener("change", sortReleasesAndUpdate);
}
