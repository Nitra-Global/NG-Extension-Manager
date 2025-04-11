// Function to check if the user is offline
function isOffline() {
    return !navigator.onLine;
}

// Function to apply offline banner
function applyOfflineBanner() {
    const offlineBanner = document.createElement("div");
    offlineBanner.id = "offline-banner";
    offlineBanner.textContent = "You might be experiencing internet connection problems.";
    offlineBanner.style.backgroundColor = "#ffcccc";
    offlineBanner.style.padding = "10px";
    offlineBanner.style.textAlign = "center";
    offlineBanner.style.position = "fixed";
    offlineBanner.style.top = "0";
    offlineBanner.style.width = "100%";
    offlineBanner.style.zIndex = "9999";
    offlineBanner.style.transition = "opacity 0.3s ease-in-out";
    offlineBanner.style.opacity = "1";

    document.body.prepend(offlineBanner);

    // Create the help icon
    const helpIcon = document.createElement("img");
    helpIcon.src = chrome.runtime.getURL("icons/info.svg");
    helpIcon.style.width = "20px";
    helpIcon.style.height = "20px";
    helpIcon.style.marginLeft = "10px";
    helpIcon.style.verticalAlign = "middle";
    helpIcon.style.cursor = "pointer";
    helpIcon.style.transition = "filter 0.3s ease-in-out";

    // Add click listener to the help icon
    helpIcon.addEventListener("click", showHelpModal);

    // Append the icon to the banner
    offlineBanner.appendChild(helpIcon);

    // Dark mode support
    updateBannerColors();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateBannerColors);
}

// Function to remove offline banner
function removeOfflineBanner() {
    const offlineBanner = document.getElementById("offline-banner");
    if (offlineBanner) {
        offlineBanner.style.opacity = "0";
        setTimeout(() => {
            offlineBanner.remove();
        }, 300);
    }
}

// Function to show help modal
function showHelpModal() {
    const helpModal = document.createElement("div");
    helpModal.id = "offline-help-modal";
    helpModal.style.display = "block";
    helpModal.style.position = "fixed";
    helpModal.style.zIndex = "10000";
    helpModal.style.left = "0";
    helpModal.style.top = "0";
    helpModal.style.width = "100%";
    helpModal.style.height = "100%";
    helpModal.style.overflow = "auto";
    helpModal.style.backgroundColor = "rgba(0, 0, 0, 0.4)";

    const modalContent = document.createElement("div");
    modalContent.style.backgroundColor = "#fefefe";
    modalContent.style.margin = "15% auto";
    modalContent.style.padding = "20px";
    modalContent.style.border = "1px solid #888";
    modalContent.style.width = "80%";
    modalContent.style.borderRadius = "8px";
    modalContent.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";

    modalContent.innerHTML = `
        <h2>Connection Problems? Let's Fix That!</h2>
        <p>This message means your internet might be having a little trouble.</p>
        <p>Here's how to get back online:</p>
        <ol>
            <li><strong>Check Your Connection:</strong> Make sure your Wi-Fi or internet cable is plugged in.</li>
            <li><strong>Reload the Page:</strong> Sometimes, a simple refresh can fix things.</li>
            <li><strong>Turn Off VPN:</strong> If you're using a VPN, try turning it off.</li>
            <li><strong>Firewall Check:</strong> Make sure your computer's firewall isn't blocking this page.</li>
        </ol>
        <p>Still having trouble? Don't worry, we're here to help! Contact support for more assistance.</p>
        <button id="close-offline-help">Got it!</button>
    `;

    helpModal.appendChild(modalContent);
    document.body.appendChild(helpModal);

    document.getElementById("close-offline-help").addEventListener("click", () => {
        helpModal.style.display = "none";
    });

    window.addEventListener("click", (event) => {
        if (event.target === helpModal) {
            helpModal.style.display = "none";
        }
    });

    // Dark mode support
    updateModalColors();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', updateModalColors);
}

// Function to update colors for dark/light mode
function updateBannerColors() {
    const banner = document.getElementById("offline-banner");
    const icon = banner.querySelector("img");

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        banner.style.backgroundColor = "#333";
        banner.style.color = "#eee";
        icon.style.filter = "invert(1)";
    } else {
        banner.style.backgroundColor = "#ffcccc";
        banner.style.color = "#000";
        icon.style.filter = "none";
    }
}

// Function to update modal colors for dark/light mode
function updateModalColors() {
    const modalContent = document.getElementById("offline-help-modal").querySelector("div");

    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        modalContent.style.backgroundColor = "#333";
        modalContent.style.color = "#eee";
        modalContent.style.border = "1px solid #555";
    } else {
        modalContent.style.backgroundColor = "#fefefe";
        modalContent.style.color = "#000";
        modalContent.style.border = "1px solid #888";
    }
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (isOffline()) {
        applyOfflineBanner();
    } else {
        removeOfflineBanner();
    }

    // Listen for online/offline events
    window.addEventListener("online", () => {
        removeOfflineBanner();
        showToast("You're back online! Reloading page...", 3000);
        setTimeout(() => {
            location.reload();
        }, 3000);
    });

    window.addEventListener("offline", applyOfflineBanner);
});
