// Function to create and style a custom alert popup
function createCustomAlert(message) {
    // Create the overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10000';

    // Create the alert box
    const alertBox = document.createElement('div');
    alertBox.style.backgroundColor = '#fff';
    alertBox.style.padding = '20px';
    alertBox.style.borderRadius = '16px';
    alertBox.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
    alertBox.style.maxWidth = '400px';
    alertBox.style.width = '80%';
    alertBox.style.fontFamily = 'Inter, sans-serif';
    alertBox.style.fontSize = '18px';

    // Create the message element
    const messageElement = document.createElement('p');
    messageElement.textContent = message;
    messageElement.style.marginBottom = '20px';
    messageElement.style.color = '#333';

    // Create the close button
    const closeButton = document.createElement('button');
    closeButton.textContent = 'OK';
    closeButton.style.backgroundColor = '#007bff';
    closeButton.style.color = '#fff';
    closeButton.style.border = 'none';
    closeButton.style.padding = '10px 20px';
    closeButton.style.borderRadius = '8px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '16px';
    closeButton.style.transition = 'background-color 0.3s ease';
    closeButton.addEventListener('mouseover', function() {
        closeButton.style.backgroundColor = '#0056b3';
    });
    closeButton.addEventListener('mouseout', function() {
        closeButton.style.backgroundColor = '#007bff';
    });
    closeButton.addEventListener('click', function() {
        document.body.removeChild(overlay);
    });

    // Append elements
    alertBox.appendChild(messageElement);
    alertBox.appendChild(closeButton);
    overlay.appendChild(alertBox);
    document.body.appendChild(overlay);
}

// Prevent CTRL+C (copying)
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        createCustomAlert('Copying content is against our policy.');
    }
    // Prevent F12 (Developer Tools) and F5 (Refresh)
    if (e.key === 'F12' || e.key === 'F5') {
        e.preventDefault();
    }
});

// Prevent drag-and-drop of images and text
document.addEventListener('dragstart', function(e) {
    e.preventDefault();
});

// Prevent text selection via mouse and keyboard
document.addEventListener('mousedown', function(e) {
    e.preventDefault();
});
document.addEventListener('mouseup', function(e) {
    e.preventDefault();
});
document.addEventListener('copy', function(e) {
    e.preventDefault();
});

// Additional security against screenshots
document.addEventListener('keydown', function(e) {
    if (e.key === 'PrintScreen') {
        e.preventDefault();
        createCustomAlert('Screenshots are against our policy.');
    }
});

// Prevent text selection using CSS
document.body.style.userSelect = 'none';

// Detect and notify if developer tools are opened
(function() {
    const devtools = /./;
    devtools.toString = function() {
        createCustomAlert('Developer tools are detected.');
    };
})();
