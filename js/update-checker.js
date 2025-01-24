// Enhanced Update Checker with Improved UX & More Functionality
const CHECK_INTERVAL = 1000 * 60 * 30; // Every 30 minutes
const UPDATE_URL = "https://raw.githubusercontent.com/Nitra-Global/api/refs/heads/main/NG%20Extension%20Manager%20/version.json";
const UPDATE_PAGE = "updates.html";
const LAST_CHECK_KEY = "lastUpdateCheck";
const LAST_VERSION_KEY = "lastKnownVersion";

async function checkForUpdate() {
    try {
        const lastCheck = localStorage.getItem(LAST_CHECK_KEY);
        const now = Date.now();
        if (lastCheck && now - lastCheck < CHECK_INTERVAL) return;
        localStorage.setItem(LAST_CHECK_KEY, now);

        const manifest = chrome.runtime.getManifest();
        const currentVersion = manifest.version;

        const response = await fetch(UPDATE_URL, { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to fetch update information.");
        
        const data = await response.json();
        const latestVersion = data.version;
        
        if (!latestVersion || !currentVersion) throw new Error("Invalid version format.");
        
        const lastKnownVersion = localStorage.getItem(LAST_VERSION_KEY);
        const versionDifference = getVersionDifference(currentVersion, latestVersion);
        
        if (versionDifference > 0 && latestVersion !== lastKnownVersion) {
            localStorage.setItem(LAST_VERSION_KEY, latestVersion);
            showUpdateNotification(currentVersion, latestVersion, versionDifference);
        }
    } catch (error) {
        console.error("Update Checker Error:", error.message);
    }
}

function getVersionDifference(current, latest) {
    const curParts = current.split('.').map(Number);
    const latParts = latest.split('.').map(Number);
    
    for (let i = 0; i < Math.max(curParts.length, latParts.length); i++) {
        const cur = curParts[i] || 0;
        const lat = latParts[i] || 0;
        if (lat > cur) return lat - cur;
    }
    return 0;
}

function showUpdateNotification(currentVersion, latestVersion, difference) {
    const forceUpdate = difference >= 2;
    const notification = document.createElement("div");
    notification.innerHTML = `
        <div id="update-popup" style="position:fixed;bottom:-100px;right:10px;padding:20px;background:${forceUpdate ? '#3a86ff' : '#282c34'};
                    color:#fff;border-radius:15px;box-shadow:0 0 20px rgba(0,0,0,0.3);
                    font-family:'Inter', sans-serif;z-index:1000;transition:bottom 0.5s ease-in-out;
                    width: 380px; text-align: center; line-height: 1.5;">
            <strong style="font-size:20px;">🚀 ${forceUpdate ? 'Critical Update Required!' : 'New Update Available'}</strong>
            <p style="font-size:14px;margin-top:10px;">Your version: <b>${currentVersion}</b> → Latest version: <b>${latestVersion}</b></p>
            <p style="font-size:13px;margin-top:5px;opacity:0.9;">${forceUpdate ? 'To maintain security and stability, updating is required.' : 'Enjoy new features and improvements!'}</p>
            <button id="update-btn" style="margin-top:15px;padding:12px 18px;border:none;background:#ffb703;
                    color:white;cursor:pointer;border-radius:8px;font-weight:bold;font-size:14px;
                    transition:background 0.3s ease-in-out;">${forceUpdate ? 'Update Now' : 'Get Update'}</button>
            <button id="changelog-btn" style="margin-top:10px;padding:8px 12px;border:none;background:#6c757d; color:white;cursor:pointer;border-radius:8px;font-size:12px;margin-left:10px;">View Changelog</button>
            ${forceUpdate ? '' : '<button id="close-btn" style="margin-top:10px;padding:8px 12px;border:none;background:#444; color:white;cursor:pointer;border-radius:8px;font-size:12px;margin-left:10px;">Dismiss</button>'}
        </div>`;
    document.body.appendChild(notification);
    setTimeout(() => document.getElementById("update-popup").style.bottom = "20px", 100);
    
    document.getElementById("update-btn").addEventListener("click", () => {
        window.location.href = UPDATE_PAGE;
    });
    
    document.getElementById("changelog-btn").addEventListener("click", () => {
        window.open(UPDATE_PAGE, "_blank");
    });
    
    if (!forceUpdate) {
        document.getElementById("close-btn").addEventListener("click", () => {
            document.getElementById("update-popup").style.bottom = "-100px";
            setTimeout(() => document.getElementById("update-popup").remove(), 500);
        });
    }
}

setInterval(checkForUpdate, CHECK_INTERVAL);
checkForUpdate();
