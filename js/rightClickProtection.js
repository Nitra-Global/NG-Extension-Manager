(function() {
    // Dynamically load Inter font and Material Icons
    const loadResources = () => {
        const interLink = document.createElement('link');
        interLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
        interLink.rel = 'stylesheet';
        document.head.appendChild(interLink);

        const materialIconsLink = document.createElement('link');
        materialIconsLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
        materialIconsLink.rel = 'stylesheet';
        document.head.appendChild(materialIconsLink);
    };

    // Dynamically inject CSS styles
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Context Menu Overlay */
.custom-context-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9998;
    display: none;
}

/* Context Menu Container */
.custom-context-menu {
    position: absolute;
    background-color: #2c2c2c;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    padding: 8px 0;
    min-width: 200px;
    max-width: 300px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    color: #ddd;
    display: none;
    flex-direction: column;
    transition: opacity 0.3s ease, transform 0.3s ease;
    opacity: 0;
    transform: scale(0.95);
    z-index: 9999;
}

.custom-context-menu.visible {
    display: flex;
    opacity: 1;
    transform: scale(1);
}

/* Menu Sections */
.custom-context-menu .menu-section {
    padding: 8px 0;
    border-bottom: 1px solid #444;
}

.custom-context-menu .menu-section:last-child {
    border-bottom: none;
}

.custom-context-menu .menu-section-title {
    padding: 0 16px 4px 16px;
    font-weight: 600;
    font-size: 12px;
    color: #bbb;
    text-transform: uppercase;
}

/* Menu Items */
.custom-context-menu .menu-item {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    cursor: pointer;
    transition: background-color 0.2s ease, transform 0.2s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    position: relative;
}

.custom-context-menu .menu-item:hover {
    background-color: #444;
    transform: translateX(2px);
}

.custom-context-menu .menu-item .material-icons {
    margin-right: 12px;
    color: #bbb;
    font-size: 18px;
}

/* Notifications */
.custom-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #333;
    color: #fff;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    z-index: 10001;
}

.custom-notification.visible {
    opacity: 1;
    transform: translateY(0);
}

/* Find on Page Highlights */
.custom-find-highlight {
    background-color: #ffcc00;
    padding: 2px;
    border-radius: 2px;
}

/* Responsive Design */
@media (max-width: 400px) {
    .custom-context-menu {
        min-width: 150px;
        max-width: 250px;
    }

    .custom-context-menu .menu-item {
        padding: 8px 12px;
        font-size: 13px;
    }

    .custom-context-menu .menu-section-title {
        padding: 0 12px 4px 12px;
    }
}

/* Find on Page Modal */
.custom-find-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #2c2c2c;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    z-index: 10002;
    display: none;
    flex-direction: column;
    width: 300px;
}

.custom-find-modal.visible {
    display: flex;
}

.custom-find-modal input {
    padding: 8px;
    font-size: 14px;
    margin-bottom: 10px;
    border: 1px solid #444;
    border-radius: 4px;
    width: 100%;
    background-color: #333;
    color: #ddd;
}

.custom-find-modal input:focus {
    border-color: #ffcc00;
    outline: none;
}

.custom-find-modal .find-buttons {
    display: flex;
    justify-content: space-between;
}

.custom-find-modal button {
    padding: 8px 12px;
    font-size: 14px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    background-color: #007bff;
    color: #fff;
    transition: background-color 0.2s ease;
}

.custom-find-modal button:hover {
    background-color: #0056b3;
}

.custom-find-modal .close-button {
    background-color: #6c757d;
}

.custom-find-modal .close-button:hover {
    background-color: #5a6268;
}
        `;
        document.head.appendChild(style);
    };

    // Utility function to escape HTML
    const escapeHTML = (str) => {
        return String(str).replace(/[&<>"'`=\/]/g, function (s) {
            return ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
                '/': '&#x2F;',
                '`': '&#x60;',
                '=': '&#x3D;'
            })[s];
        });
    };

    // Function to create the custom context menu
    const createCustomContextMenu = () => {
        try {
            // Create overlay
            const overlay = document.createElement('div');
            overlay.classList.add('custom-context-overlay');
            document.body.appendChild(overlay);

            // Create context menu container
            const contextMenu = document.createElement('div');
            contextMenu.classList.add('custom-context-menu');

            // Define menu sections and options
            const menuSections = [
                {
                    title: 'Navigation',
                    options: [
                        { text: 'Reload', action: () => window.location.reload(), icon: 'refresh' },
                        { text: 'Save Page As', action: savePageAs, icon: 'save' }
                    ]
                },
                {
                    title: 'Actions',
                    options: [
                        { text: 'Print Page', action: printPage, icon: 'print' },
                        { text: 'Find on Page', action: openFindModal, icon: 'search' }
                    ]
                },
                {
                    title: 'Utilities',
                    options: [
                        { text: 'Copy URL', action: copyPageURL, icon: 'link' }
                    ]
                }
            ];

            // Create menu sections
            menuSections.forEach(section => {
                const sectionDiv = document.createElement('div');
                sectionDiv.classList.add('menu-section');

                // Section title
                const sectionTitle = document.createElement('div');
                sectionTitle.classList.add('menu-section-title');
                sectionTitle.textContent = section.title;
                sectionDiv.appendChild(sectionTitle);

                // Menu items
                section.options.forEach(option => {
                    const menuItem = document.createElement('div');
                    menuItem.classList.add('menu-item');
                    menuItem.innerHTML = `
                        <span class="material-icons">${option.icon}</span>
                        <span>${escapeHTML(option.text)}</span>
                    `;

                    menuItem.addEventListener('click', () => {
                        try {
                            option.action();
                        } catch (error) {
                            console.error(`Error executing action "${option.text}":`, error);
                            showNotification(`Failed to execute "${option.text}".`);
                        }
                        hideContextMenu();
                    });

                    // Hover effects for better UX
                    menuItem.addEventListener('mouseover', () => {
                        menuItem.style.backgroundColor = '#000';
                    });
                    menuItem.addEventListener('mouseout', () => {
                        menuItem.style.backgroundColor = 'transparent';
                    });

                    sectionDiv.appendChild(menuItem);
                });

                contextMenu.appendChild(sectionDiv);
            });

            document.body.appendChild(contextMenu);

            // Open context menu on single right-click
            document.addEventListener('contextmenu', (e) => {
                e.preventDefault();

                // Calculate menu position to avoid overflow
                const menuWidth = contextMenu.offsetWidth || 200; // Estimated or actual menu width
                const menuHeight = contextMenu.offsetHeight || (menuSections.length * 100); // Estimated or actual menu height
                let posX = e.pageX;
                let posY = e.pageY;

                if (window.innerWidth - e.pageX < menuWidth) {
                    posX = e.pageX - menuWidth;
                }
                if (window.innerHeight - e.pageY < menuHeight) {
                    posY = e.pageY - menuHeight;
                }

                contextMenu.style.left = `${posX}px`;
                contextMenu.style.top = `${posY}px`;
                contextMenu.classList.add('visible');
                overlay.style.display = 'block';
            });

            // Close context menu and overlay
            overlay.addEventListener('click', hideContextMenu);
            document.addEventListener('click', hideContextMenu);
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    hideContextMenu();
                }
            });

            // Function to hide the context menu
            function hideContextMenu() {
                contextMenu.classList.remove('visible');
                overlay.style.display = 'none';
            }
        } catch (error) {
            console.error('Error creating custom context menu:', error);
            showNotification('Failed to create context menu.');
        }
    };

    // Function to copy the current page URL
    const copyPageURL = () => {
        try {
            navigator.clipboard.writeText(window.location.href)
                .then(() => {
                    showNotification('Page URL copied to clipboard!');
                })
                .catch(err => {
                    console.error('Failed to copy URL: ', err);
                    showNotification('Failed to copy URL.');
                });
        } catch (error) {
            console.error('Error copying URL:', error);
            showNotification('Failed to copy URL.');
        }
    };

    // Function to print the page
    const printPage = () => {
        try {
            window.print();
            showNotification('Print dialog opened.');
        } catch (error) {
            console.error('Error opening print dialog:', error);
            showNotification('Failed to print the page.');
        }
    };

    // Function to save the page as
    const savePageAs = () => {
        try {
            const link = document.createElement('a');
            link.href = window.location.href;
            link.download = document.title || 'page';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showNotification('Save Page As dialog opened.');
        } catch (error) {
            console.error('Error saving the page:', error);
            showNotification('Failed to save the page.');
        }
    };

    // Function to show notifications
    const showNotification = (message) => {
        try {
            const notification = document.createElement('div');
            notification.classList.add('custom-notification');
            notification.textContent = message;
            document.body.appendChild(notification);

            // Trigger reflow for CSS transition
            window.getComputedStyle(notification).opacity;
            notification.classList.add('visible');

            // Remove after 3 seconds
            setTimeout(() => {
                notification.classList.remove('visible');
                notification.addEventListener('transitionend', () => {
                    notification.remove();
                });
            }, 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    };

    // Function to open the Find on Page modal
    const openFindModal = () => {
        try {
            // If modal already exists, do not create another
            if (document.querySelector('.custom-find-modal')) return;

            // Create modal
            const modal = document.createElement('div');
            modal.classList.add('custom-find-modal');

            modal.innerHTML = `
                <input type="text" id="custom-find-input" placeholder="Enter text to find..." />
                <div class="find-buttons">
                    <button id="custom-find-prev">Previous</button>
                    <button id="custom-find-next">Next</button>
                    <button id="custom-find-clear" class="close-button">Clear</button>
                </div>
            `;

            document.body.appendChild(modal);
            modal.classList.add('visible');

            const input = modal.querySelector('#custom-find-input');
            const prevButton = modal.querySelector('#custom-find-prev');
            const nextButton = modal.querySelector('#custom-find-next');
            const clearButton = modal.querySelector('#custom-find-clear');

            let currentMatchIndex = -1;
            let matches = [];

            // Function to highlight matches
            const highlightMatches = (query) => {
                removeHighlights();
                if (!query) return;

                const regex = new RegExp(escapeRegExp(query), 'gi');
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                const textNodes = [];

                while (walker.nextNode()) {
                    textNodes.push(walker.currentNode);
                }

                textNodes.forEach(node => {
                    const matchesInNode = node.textContent.match(regex);
                    if (matchesInNode) {
                        const span = document.createElement('span');
                        span.innerHTML = node.textContent.replace(regex, (match) => `<span class="custom-find-highlight">${match}</span>`);
                        node.replaceWith(span);
                    }
                });

                matches = document.querySelectorAll('.custom-find-highlight');
                currentMatchIndex = -1;
            };

            // Function to remove all highlights
            const removeHighlights = () => {
                const highlights = document.querySelectorAll('.custom-find-highlight');
                highlights.forEach(span => {
                    const parent = span.parentNode;
                    parent.replaceChild(document.createTextNode(span.textContent), span);
                    parent.normalize(); // Merge adjacent text nodes
                });
                matches = [];
                currentMatchIndex = -1;
            };

            // Function to navigate to the next match
            const goToNextMatch = () => {
                if (matches.length === 0) return;
                currentMatchIndex = (currentMatchIndex + 1) % matches.length;
                scrollToMatch();
            };

            // Function to navigate to the previous match
            const goToPrevMatch = () => {
                if (matches.length === 0) return;
                currentMatchIndex = (currentMatchIndex - 1 + matches.length) % matches.length;
                scrollToMatch();
            };

            // Function to scroll to the current match
            const scrollToMatch = () => {
                if (currentMatchIndex >= 0 && currentMatchIndex < matches.length) {
                    matches[currentMatchIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Optional: Add a temporary animation or highlight to indicate the current match
                    matches.forEach((match, index) => {
                        match.style.backgroundColor = index === currentMatchIndex ? 'orange' : 'yellow';
                    });
                }
            };

            // Event listeners
            input.addEventListener('input', (e) => {
                highlightMatches(e.target.value);
            });

            nextButton.addEventListener('click', () => {
                goToNextMatch();
            });

            prevButton.addEventListener('click', () => {
                goToPrevMatch();
            });

            clearButton.addEventListener('click', () => {
                removeHighlights();
                modal.classList.remove('visible');
                modal.remove();
                showNotification('Highlights cleared.');
            });

            // Close modal on Escape key
            const onKeyDown = (e) => {
                if (e.key === 'Escape') {
                    removeHighlights();
                    modal.classList.remove('visible');
                    modal.remove();
                    showNotification('Find on Page closed.');
                    document.removeEventListener('keydown', onKeyDown);
                }
            };
            document.addEventListener('keydown', onKeyDown);

        } catch (error) {
            console.error('Error opening Find on Page modal:', error);
            showNotification('Failed to open Find on Page.');
        }
    };

    // Utility function to escape RegExp special characters
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    // Initial setup
    const initialize = () => {
        loadResources();
        injectStyles();
        createCustomContextMenu();
    };

    // Execute on DOMContentLoaded or immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

})();
