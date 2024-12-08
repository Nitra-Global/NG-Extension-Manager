const versionAPI = "https://api.jsonsilo.com/public/9739f42d-9634-4592-8251-e5c989a46310";
const changelogAPI = "https://api.github.com/repos/nitra-global/NG-Extension-Manager/releases";
const manifestData = chrome.runtime.getManifest();
const installedVersion = manifestData.version;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("installed-version").textContent = installedVersion;
    document.getElementById("close-sheet").addEventListener("click", closeBottomSheet);
    document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
    document.getElementById("search-input").addEventListener("input", filterReleases);
    document.getElementById("pre-release-filter").addEventListener("change", filterReleases);
    document.addEventListener("keydown", handleKeyEvents);
    fetchData();
});

async function fetchData() {
    await fetchVersion();
    await fetchReleases();
}

async function fetchVersion() {
    try {
        const response = await fetch(versionAPI);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        document.getElementById("latest-version").textContent = data.version;

        // Inform the user about the new version
        showNewVersionMessage(data.version);
    } catch (error) {
        handleError("latest-version", "Error loading latest version.", error);
    }
}

async function fetchReleases() {
    try {
        const response = await fetch(changelogAPI);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const releases = await response.json();
        updateReleasesGrid(releases);
    } catch (error) {
        handleError("releases-grid", "Error loading releases.", error);
    }
}

function openBottomSheet(release) {
    setReleaseDetails(release);
    document.getElementById("bottom-sheet").classList.add("open");

    // Mark the active release
    document.querySelectorAll(".release-card").forEach(card => card.classList.remove("active"));
    const activeCard = Array.from(document.querySelectorAll(".release-card"))
        .find(card => card.dataset.release === JSON.stringify(release));
    if (activeCard) activeCard.classList.add("active");
}

function closeBottomSheet() {
    document.getElementById("bottom-sheet").classList.remove("open");
}

function toggleTheme() {
    document.body.classList.toggle('dark-mode');
}

function filterReleases() {
    const query = document.getElementById("search-input").value.toLowerCase();
    const preReleaseFilter = document.getElementById("pre-release-filter").checked;
    const releaseCards = document.querySelectorAll(".release-card");
    
    releaseCards.forEach(card => {
        const release = JSON.parse(card.dataset.release);
        const text = card.textContent.toLowerCase();
        const matchesSearch = text.includes(query);
        const matchesPreReleaseFilter = !preReleaseFilter || release.prerelease;
        
        card.style.display = (matchesSearch && matchesPreReleaseFilter) ? "block" : "none";
    });
}

// Handle keyboard shortcuts
function handleKeyEvents(event) {
    const bottomSheet = document.getElementById("bottom-sheet");
    const open = bottomSheet.classList.contains("open");

    if (event.key === "Escape" && open) {
        closeBottomSheet();
    } else if (open && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        navigateReleases(event.key);
    }
}

// Navigate releases with arrow keys
function navigateReleases(direction) {
    const releaseCards = Array.from(document.querySelectorAll(".release-card"));
    const currentIndex = releaseCards.findIndex(card => card.classList.contains("active"));
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === "ArrowLeft") {
        newIndex = (currentIndex - 1 + releaseCards.length) % releaseCards.length;
    } else if (direction === "ArrowRight") {
        newIndex = (currentIndex + 1) % releaseCards.length;
    }

    releaseCards[currentIndex].classList.remove("active");
    releaseCards[newIndex].classList.add("active");
    openBottomSheet(JSON.parse(releaseCards[newIndex].dataset.release));
}

function isNewVersion(current, latest) {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
        const currentPart = currentParts[i] || 0;
        const latestPart = latestParts[i] || 0;
        if (latestPart > currentPart) return true;
        if (latestPart < currentPart) return false;
    }
    return false;
}

function showNewVersionMessage(latestVersion) {
    const statusMessage = document.getElementById("status-message");
    if (isNewVersion(installedVersion, latestVersion)) {
        statusMessage.textContent = `A new version (${latestVersion}) is available!`;
        statusMessage.style.color = "green";
    } else {
        statusMessage.textContent = "You are using the latest version.";
        statusMessage.style.color = "blue";
    }
}

function handleError(elementId, message, error) {
    document.getElementById(elementId).textContent = message;
    console.error(message, error);
}

function updateReleasesGrid(releases) {
    const releasesGrid = document.getElementById("releases-grid");
    releasesGrid.innerHTML = '';
    releases.forEach(release => {
        const releaseCard = document.createElement("div");
        releaseCard.className = "release-card";
        releaseCard.dataset.release = JSON.stringify(release);
        
        // Add pre-release tag
        const preReleaseTag = release.prerelease 
            ? '<span class="pre-release-tag">Pre-Release</span>' 
            : '<span class="stable-release-tag">Stable</span>';
        
        releaseCard.innerHTML = `
            <div class="release-card-header">
                <h3>${release.name}</h3>
                ${preReleaseTag}
            </div>
            <p>${new Date(release.published_at).toLocaleDateString()}</p>
            <a href="${release.html_url}" target="_blank">View on GitHub</a>
        `;
        releaseCard.onclick = () => openBottomSheet(release);
        releasesGrid.appendChild(releaseCard);
    });

    if (releases.length === 0) {
        releasesGrid.textContent = "No releases found.";
    }
}