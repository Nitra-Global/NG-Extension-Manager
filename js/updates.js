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
let statusMessage, statusIcon;

// Global variables
let latestVersion = null;
let allReleases = [];

// Initialize the page
document.addEventListener("DOMContentLoaded", () => {
    initElements();
    checkVersionAndUpdateStatus();

    // Display extension title and installed version
    document.getElementById("extension-title").textContent = extensionTitle;
    document.getElementById("installed-version").textContent = installedVersion;
});

// Check for updates and update status message
async function checkVersionAndUpdateStatus() {
    updateStatus("loading", "Checking for updates...");

    try {
        if (!navigator.onLine) {
            throw new Error("You are offline");
        }

        // Fetch latest version
        const versionData = await fetchWithCache(versionAPI, VERSION_CACHE_KEY);
        if (versionData === null) return;

        latestVersion = versionData.version;

        // Update latest version display
        document.getElementById("latest-version").textContent = latestVersion;

        // Compare versions and update status
        if (isNewVersionAvailable(installedVersion, latestVersion)) {
            updateStatus("outdated", `Update available! Version ${latestVersion} can be installed.`);
            document.getElementById("download").style.display = "inline-block"; // Show download button
            await fetchReleases();
            displayLatestChangelog(allReleases[0]);
            document.getElementById("latest-changelog").style.display = "block"; // Show changelog
        } else {
            updateStatus("up-to-date", `${extensionTitle} is up to date`);
            document.getElementById("download").style.display = "none"; // Hide download button
            document.getElementById("latest-changelog").style.display = "none"; // Hide changelog
        }

    } catch (error) {
        console.error("Error checking version:", error);
        updateStatus("error", `Error checking for updates: ${error.message}`);
    }
}


async function fetchReleases() {
    try {
        if (!navigator.onLine) {
            throw new Error("You are offline");
        }

        // Fetch releases data
        allReleases = await fetchWithCache(changelogAPI, RELEASES_CACHE_KEY);
        if (allReleases === null) return;

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

function displayLatestChangelog(release) {
    const changelogContainer = document.getElementById("latest-changelog");
    if(!release){
        changelogContainer.innerHTML = "<p>Could not load latest Changelog</p>";
        return;
    }

    changelogContainer.innerHTML = `
        <h2>Latest Changelog (${release.tag_name})</h2>
        ${markdownToHTML(release.body || 'No release notes available')}
    `;
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

// Global variable to hold the toast element
let toastElement = null;

function showToast(message, duration = 3000) {
    // Create the toast element if it doesn't exist
    if (!toastElement) {
        toastElement = document.createElement("div");
        toastElement.className = "toast";
        document.body.appendChild(toastElement);
    }

    // Update the toast message
    toastElement.textContent = message;

    // Show toast
    toastElement.classList.add("show");

    // Hide toast after duration
    setTimeout(() => {
        toastElement.classList.remove("show");
        setTimeout(() => {
            // No need to remove the element, just hide it
        }, 300);
    }, duration);
}

async function fetchWithCache(url, cacheKey) {
    try {
        // Check cache first
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            return cachedData;
        }

        // Fetch fresh data
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();

        // Cache the data
        cacheData(cacheKey, data, CACHE_TTL);

        return data;
    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        showToast(`Error fetching data: ${error.message}`);
        return null; // Return null to indicate an error
    }
}

// Store data in cache
function cacheData(key, data, ttl) {
    const cache = {
        data: data,
        expiry: Date.now() + (ttl * 1000)
    };

    localStorage.setItem(key, JSON.stringify(cache));
}

function getCachedData(key) {
    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;

        const cache = JSON.parse(cachedData);

        // Check if cache has expired
        if (Date.now() > cache.expiry) {
            localStorage.removeItem(key);
            return null;
        }

        return cache.data;
    } catch (error) {
        console.warn(`Failed to parse cached data for ${key}:`, error);
        showToast(`Error with cached data: ${error.message}`);
        localStorage.removeItem(key);
        return null;
    }
}

// Initialize DOM element references
function initElements() {
    statusMessage = document.getElementById("status-message");
    statusIcon = document.getElementById("status-icon");
}
