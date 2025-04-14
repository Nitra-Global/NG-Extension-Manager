// API endpoints
const versionAPI = "https://raw.githubusercontent.com/Nitra-Global/api/refs/heads/main/NG%20Extension%20Manager%20/version.json";
const changelogAPI = "https://api.github.com/repos/nitra-global/NG-Extension-Manager/releases";

// Cache keys
const VERSION_CACHE_KEY = "ngExtension_latestVersionCache";
const RELEASES_CACHE_KEY = "ngExtension_releasesCache";
const CACHE_TTL = 3600; // Cache time-to-live in seconds (1 hour)

// Get extension manifest data (use try-catch for safety)
let installedVersion = "0.0.0"; // Default value
let extensionTitle = "NG Extension Manager"; // Default value
try {
    const manifestData = chrome.runtime.getManifest();
    installedVersion = manifestData.version;
    extensionTitle = manifestData.name || extensionTitle;
} catch (error) {
    console.warn("Could not retrieve extension manifest data:", error);
    // Keep default values or handle appropriately
}


// DOM elements (initialize after DOMContentLoaded)
let statusMessage, statusIcon, statusCard, downloadButton, latestChangelogContainer, latestVersionSpan;

// Global variables
let latestVersionInfo = null; // Store { version: "x.y.z", downloadUrl: "...", tagName: "..." }
let allReleases = []; // Store full release data

// --- Initialization ---

document.addEventListener("DOMContentLoaded", () => {
    initElements();
    setupEventListeners();
    displayStaticInfo();
    checkVersionAndUpdateStatus(); // Initial check
});

function initElements() {
    statusMessage = document.getElementById("status-message");
    statusIcon = document.getElementById("status-icon");
    statusCard = document.querySelector(".status-card"); // Assuming .status-card exists
    downloadButton = document.getElementById("download");
    latestChangelogContainer = document.getElementById("latest-changelog");
    latestVersionSpan = document.getElementById("latest-version");

    // Accessibility: Add aria-live for status updates
    const statusArea = statusMessage.parentElement; // Or a dedicated container
    if (statusArea) {
        statusArea.setAttribute("aria-live", "polite");
        statusArea.setAttribute("aria-atomic", "true"); // Ensure the whole message is read
    }

    // Hide elements initially that depend on API data
    downloadButton.style.display = "none";
    latestChangelogContainer.style.display = "none";
    latestVersionSpan.textContent = "Loading...";
}

function setupEventListeners() {
    // Download button click handler
    downloadButton.addEventListener("click", (event) => {
        event.preventDefault(); // Prevent default link behavior if it's an <a>
        if (latestVersionInfo && latestVersionInfo.downloadUrl) {
            // Use chrome.downloads API for a better experience
            try {
                chrome.downloads.download({
                    url: latestVersionInfo.downloadUrl,
                    filename: `NG-Extension-Manager-${latestVersionInfo.tagName}.zip` // Suggest a filename
                }, (downloadId) => {
                    if (chrome.runtime.lastError) {
                        console.error("Download failed:", chrome.runtime.lastError.message);
                        showToast(`Download error: ${chrome.runtime.lastError.message}`, 5000);
                        // Fallback to simple redirect if API fails
                        // window.location.href = latestVersionInfo.downloadUrl;
                    } else {
                        showToast("Download started...", 3000);
                    }
                });
            } catch (e) {
                 console.error("chrome.downloads API not available or error:", e);
                 showToast("Cannot initiate download via extension API. Opening link.", 4000);
                 // Fallback for environments where chrome.downloads isn't available (e.g., regular web page)
                 window.open(latestVersionInfo.downloadUrl, '_blank');
            }

        } else {
            console.error("No download URL available for the latest version.");
            showToast("Error: Could not find download link.", 5000);
            // Optionally redirect to the main releases page as a fallback
            // window.open("https://github.com/nitra-global/NG-Extension-Manager/releases", "_blank");
        }
    });

    // Optional: Add a manual refresh button
    const refreshButton = document.getElementById("refresh-check"); // Add a button with this ID to your HTML
    if (refreshButton) {
        refreshButton.addEventListener("click", () => {
             // Clear cache before checking again for a true refresh
             localStorage.removeItem(VERSION_CACHE_KEY);
             localStorage.removeItem(RELEASES_CACHE_KEY);
             latestVersionInfo = null; // Reset state
             allReleases = [];
             checkVersionAndUpdateStatus();
        });
    }
}

function displayStaticInfo() {
    // Display extension title and installed version
    document.getElementById("extension-title").textContent = extensionTitle;
    document.getElementById("installed-version").textContent = installedVersion;
}


// --- Core Logic ---

async function checkVersionAndUpdateStatus() {
    updateStatus("loading", "Checking for updates...", "Checking for updates");

    try {
        if (!navigator.onLine) {
            throw new Error("You are offline. Please check your connection.");
        }

        // 1. Fetch latest version number
        // Using the simple version.json structure for now
        const versionData = await fetchWithCache(versionAPI, VERSION_CACHE_KEY, true); // true to force cache bypass if needed for refresh
        if (!versionData || !versionData.version) {
             throw new Error("Could not fetch or parse latest version information.");
        }
        const latestVersionString = versionData.version;
        latestVersionSpan.textContent = latestVersionString; // Update display immediately


        // 2. Fetch all releases data from GitHub
        allReleases = await fetchWithCache(changelogAPI, RELEASES_CACHE_KEY);
        if (!allReleases || allReleases.length === 0) {
            // Handle case where releases are fetched but empty
             throw new Error("No release information found.");
        }

         // 3. Sort releases (newest first) - Robust check for published_at
         allReleases.sort((a, b) => {
            const dateA = a.published_at ? new Date(a.published_at) : 0;
            const dateB = b.published_at ? new Date(b.published_at) : 0;
            return dateB - dateA;
        });

        // 4. Find the specific release matching the latestVersionString (or just use the latest if version.json is unreliable)
        // Let's primarily trust the version.json for the "latest" version number
        // and find the corresponding release details from the GitHub API data.
        const latestReleaseData = allReleases.find(release => release.tag_name === latestVersionString || release.tag_name === `v${latestVersionString}`);

        // Fallback: If version.json's version isn't found in releases (tag mismatch?), use the absolute latest release from GitHub.
        const definitiveLatestRelease = latestReleaseData || allReleases[0];

        if (!definitiveLatestRelease) {
             throw new Error("Could not determine the latest release details.");
        }


        // 5. Extract download URL from the definitive latest release
        const downloadUrl = findReleaseDownloadUrl(definitiveLatestRelease);
        if (!downloadUrl) {
             console.warn(`No suitable download asset or source code zip found for release ${definitiveLatestRelease.tag_name}`);
             // Decide fallback behavior: maybe disable download, maybe link to release page
        }

        // Store details globally
        latestVersionInfo = {
            version: definitiveLatestRelease.tag_name.replace(/^v/, ''), // Store clean version
            downloadUrl: downloadUrl,
            tagName: definitiveLatestRelease.tag_name // Keep original tag for filename
        };


        // 6. Compare versions and update UI
        const current = installedVersion;
        const latest = latestVersionInfo.version; // Use the version from the found release data

         // Update Latest Version display with the tag name found
        latestVersionSpan.textContent = latestVersionInfo.tagName;

        if (isNewVersionAvailable(current, latest)) {
            updateStatus("outdated", `Update available! Version ${latestVersionInfo.tagName} can be installed.`, `Update available: Version ${latestVersionInfo.tagName}`);
            if (latestVersionInfo.downloadUrl) {
                downloadButton.style.display = "inline-block";
                downloadButton.setAttribute("aria-label", `Download Version ${latestVersionInfo.tagName}`); // Accessibility
            } else {
                 downloadButton.style.display = "none"; // Hide if no URL found
                 showToast(`Download link not found for ${latestVersionInfo.tagName}.`, 4000);
            }
            displayLatestChangelog(definitiveLatestRelease);
            latestChangelogContainer.style.display = "block";
        } else {
            updateStatus("up-to-date", `${extensionTitle} is up to date. (v${installedVersion})`, `${extensionTitle} is up to date.`);
            downloadButton.style.display = "none";
            latestChangelogContainer.style.display = "none";
        }

    } catch (error) {
        console.error("Error during update check:", error);
        let userMessage = `Error checking for updates: ${error.message || 'Unknown error'}`;
        if (error.message.includes("offline")) {
           userMessage = "You are offline. Please check your connection.";
        } else if (error.message.includes("HTTP error") || error.message.includes("fetch")) {
            userMessage = "Could not connect to the update server.";
        }
        updateStatus("error", userMessage, "Error checking updates");
        // Ensure dependent UI is hidden on error
        latestVersionSpan.textContent = "Error";
        downloadButton.style.display = "none";
        latestChangelogContainer.style.display = "none";
    }
}

// --- Helper Functions ---

// Find the download URL within a GitHub release object
function findReleaseDownloadUrl(release) {
    if (!release) return null;

    // Priority 1: Find a .zip asset
    if (release.assets && release.assets.length > 0) {
        const zipAsset = release.assets.find(asset =>
            asset.content_type === 'application/zip' ||
            (asset.name && asset.name.toLowerCase().endsWith('.zip'))
        );
        if (zipAsset && zipAsset.browser_download_url) {
            console.log(`Found asset ZIP: ${zipAsset.browser_download_url}`);
            return zipAsset.browser_download_url;
        }
    }

    // Priority 2: Fallback to the source code zipball URL
    if (release.zipball_url) {
         console.log(`Using source code ZIP: ${release.zipball_url}`);
        // Note: GitHub's zipball_url might require authentication or redirect.
        // For public repos, it usually works directly. Test this!
        // A more robust solution might involve using the tag to construct the source code download URL:
        // `https://github.com/nitra-global/NG-Extension-Manager/archive/refs/tags/${release.tag_name}.zip`
        const sourceCodeUrl = `https://github.com/nitra-global/NG-Extension-Manager/archive/refs/tags/${release.tag_name}.zip`;
        console.log(`Constructed source code URL: ${sourceCodeUrl}`);
        return sourceCodeUrl; // Prefer constructed URL
        // return release.zipball_url;
    }

    console.warn(`No ZIP asset or zipball_url found for release ${release.tag_name}`);
    return null; // No suitable URL found
}


// Helper function to check if a new version is available (semantic version comparison)
function isNewVersionAvailable(currentVersion, latestVersion) {
     // Basic check: Ignore comparison if versions are identical strings
    if (currentVersion === latestVersion) return false;

    // Handle potential 'v' prefix in latestVersion
    const cleanLatestVersion = latestVersion.replace(/^v/, '');

    const currentParts = currentVersion.split('.').map(Number);
    const latestParts = cleanLatestVersion.split('.').map(Number);

    const maxLength = Math.max(currentParts.length, latestParts.length);

    for (let i = 0; i < maxLength; i++) {
        const current = currentParts[i] || 0; // Treat missing parts as 0
        const latest = latestParts[i] || 0;   // Treat missing parts as 0

        if (isNaN(current) || isNaN(latest)) {
            console.warn(`Invalid version number part encountered: current='${currentVersion}', latest='${latestVersion}' at index ${i}`);
            return false; // Treat invalid versions as not newer
        }

        if (latest > current) return true;
        if (latest < current) return false;
    }

    // If all parts are equal up to the length of the shorter version string, they are identical.
    return false;
}

// Update the status indicator and message
function updateStatus(status, message, ariaLabel = null) {
    if (!statusMessage || !statusIcon || !statusCard) {
        console.error("Status elements not initialized!");
        return;
    }

    statusMessage.textContent = message;

    // Use more descriptive ARIA labels if provided
    const effectiveAriaLabel = ariaLabel || message;
    statusCard.setAttribute("aria-label", effectiveAriaLabel); // Set label on the container

    // Reset classes
    const statuses = ["up-to-date", "outdated", "error", "loading"];
    statusIcon.classList.remove(...statuses);
    statusCard.classList.remove(...statuses);

    // Add the new status class
    if (statuses.includes(status)) {
        statusIcon.classList.add(status);
        statusCard.classList.add(status);
    } else {
         console.warn(`Unknown status type: ${status}`);
    }
}


function displayLatestChangelog(release) {
     if (!latestChangelogContainer) return;

    if (!release || !release.body) {
        latestChangelogContainer.innerHTML = `<h2>Latest Changelog (${release?.tag_name || 'N/A'})</h2><p>No release notes available for this version.</p>`;
        return;
    }

    // Basic check for HTML potentially already in the body
    const containsHtml = /<[a-z][\s\S]*>/i.test(release.body);

    latestChangelogContainer.innerHTML = `
        <h2>Latest Changelog (${release.tag_name})</h2>
        <div class="changelog-body">
          ${containsHtml ? release.body : markdownToHTML(release.body)}
        </div>
    `;
}

// Improved Markdown to HTML (basic) - Consider a library like 'marked' or 'showdown' for robust conversion
function markdownToHTML(markdown) {
    if (!markdown) return '';

    let html = markdown;

    // Escape HTML to prevent XSS if markdown source is untrusted
    // html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

    // **Headers (simplified)**
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // **Lists (more robust)**
    html = html.replace(/^\s*[*+-] (.*)/gm, '<li>$1</li>'); // Handle *, +, -
    html = html.replace(/<\/li>\s*<li>/g, '</li><li>'); // Combine adjacent items
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap groups in <ul>
    html = html.replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent lists


    // **Links**
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // **Bold**
    html = html.replace(/\*\*([^*]+)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/__([^_]+)__/gim, '<strong>$1</strong>'); // Handle __bold__

    // **Italic**
    html = html.replace(/\*([^*]+)\*/gim, '<em>$1</em>');
     html = html.replace(/_([^_]+)_/gim, '<em>$1</em>'); // Handle _italic_


    // **Code Blocks (basic)**
    html = html.replace(/```([^`]+)```/gim, (match, p1) => `<pre><code>${p1.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`);

    // **Inline Code**
    html = html.replace(/`([^`]+)`/gim, (match, p1) => `<code>${p1.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`);

    // **Line Breaks (convert newline to <br>, but be careful inside <pre>)**
    // This simple replace is often problematic. A better approach splits by \n then processes lines.
    // Avoid replacing inside <pre> tags if possible.
    html = html.split('\n').map(line => {
         // Basic check to avoid adding <br> inside likely preformatted blocks
         if (line.trim().startsWith('<pre') || line.trim().startsWith('<code') || line.trim().startsWith('<ul') || line.trim().startsWith('<li') || line.trim().startsWith('<h')) {
             return line;
         }
         // Don't add <br> for empty lines that might already be spacing blocks
         return line.trim() === '' ? '' : line + '<br>';
     }).join('');

     // Remove potentially double <br> tags from list/header processing etc.
     html = html.replace(/<br>\s*<br>/g, '<br>');
     html = html.replace(/(<\/(?:ul|h[1-6]|pre)>)\s*<br>/gi, '$1'); // Remove breaks after block elements

    return html;
}


// --- Caching ---

async function fetchWithCache(url, cacheKey, forceRefresh = false) {
    const cached = getCachedData(cacheKey);
    if (cached && !forceRefresh) {
        console.log(`Using cached data for ${cacheKey}`);
        return cached;
    }

    console.log(`Workspaceing fresh data for ${url}`);
    try {
        const response = await fetch(url, {
            headers: {
                 // Optional: Add headers if needed, e.g., for GitHub API rate limiting
                 // 'Accept': 'application/vnd.github.v3+json',
                 // 'Authorization': 'token YOUR_GITHUB_TOKEN' // If needed for private repos or higher rate limits
            }
        });

        if (!response.ok) {
             // Try to get more specific error info
             let errorText = response.statusText;
             try {
                const errorBody = await response.json();
                errorText = errorBody.message || errorText;
             } catch (e) { /* Ignore if body isn't JSON */ }

            throw new Error(`HTTP error! Status: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Basic validation
        if (url === changelogAPI && !Array.isArray(data)) {
             throw new Error("Invalid data format received from releases API.");
        }
         if (url === versionAPI && typeof data?.version !== 'string') {
             throw new Error("Invalid data format received from version API.");
         }


        cacheData(cacheKey, data, CACHE_TTL);
        return data;

    } catch (error) {
        console.error(`Error fetching ${url}:`, error);
        // Don't show toast here, let the caller handle UI feedback based on context
        // showToast(`Error fetching data: ${error.message}`);
        throw error; // Re-throw the error so the calling function knows it failed
    }
}

function cacheData(key, data, ttlSeconds) {
    if (!localStorage) return; // Handle environments without localStorage

    const cache = {
        data: data,
        expiry: Date.now() + (ttlSeconds * 1000)
    };

    try {
        localStorage.setItem(key, JSON.stringify(cache));
    } catch (error) {
         console.warn(`Failed to cache data for ${key}: ${error.message}`);
         // Handle potential quota exceeded errors
         showToast("Could not save data locally (cache full?).", 3000);
    }
}

function getCachedData(key) {
     if (!localStorage) return null;

    try {
        const cachedData = localStorage.getItem(key);
        if (!cachedData) return null;

        const cache = JSON.parse(cachedData);

        // Check expiry
        if (Date.now() > cache.expiry) {
            localStorage.removeItem(key);
            return null;
        }

        return cache.data;
    } catch (error) {
        console.warn(`Failed to parse or retrieve cached data for ${key}:`, error);
        // showToast(`Error reading cached data: ${error.message}`); // Maybe too noisy
        localStorage.removeItem(key); // Clear corrupted cache entry
        return null;
    }
}

// --- UI Feedback ---

// Global variable to hold the toast element
let toastElement = null;
let toastTimeout = null;

function showToast(message, duration = 3000) {
    // Create the toast element if it doesn't exist
    if (!toastElement) {
        toastElement = document.createElement("div");
        toastElement.className = "toast"; // Ensure you have CSS for .toast and .toast.show
        // Accessibility: Make toast noticeable by screen readers
        toastElement.setAttribute('role', 'alert');
        toastElement.setAttribute('aria-live', 'assertive'); // Use assertive for important messages like errors
        document.body.appendChild(toastElement);
    }

     // Clear any existing timeout to prevent overlaps or premature hiding
    if (toastTimeout) {
        clearTimeout(toastTimeout);
    }

    // Update the toast message
    toastElement.textContent = message;

    // Show toast (ensure CSS handles the transition/animation)
    toastElement.classList.add("show");

    // Hide toast after duration
    toastTimeout = setTimeout(() => {
        toastElement.classList.remove("show");
        // Optional: Reset timeout variable
        toastTimeout = null;
        // Consider removing the element after fade out if preferred, but reusing is often better
    }, duration);
}
