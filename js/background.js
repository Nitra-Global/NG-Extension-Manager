// background.js

// Listener für Nachrichten
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === 'leave') {
    // Beispiel: Schließt das aktuelle Tab oder führt eine spezifische Aktion aus
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.remove(tabs[0].id);
    });
  }
});


chrome.runtime.onInstalled.addListener(() => {
  console.log('NG Extension Manager installed.');
  createContextMenu();
});

// Erstellen des Kontextmenüs
function createContextMenu() {
  chrome.contextMenus.create({
    id: 'ng-extension-manager',
    title: 'NG Extension Manager',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'reload_current_tab',
    title: 'Reload Current Tab',
    parentId: 'ng-extension-manager',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'copy_page_url',
    title: 'Copy Page URL',
    parentId: 'ng-extension-manager',
    contexts: ['all']
  });

  chrome.contextMenus.create({
    id: 'open_history_manager',
    title: 'Open History Manager',
    parentId: 'ng-extension-manager',
    contexts: ['all']
  });
}

// Listener für Kontextmenüaktionen
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case 'reload_current_tab':
      chrome.tabs.reload(tab.id);
      break;
    case 'copy_page_url':
      // Sende Nachricht an Content-Skript zum Kopieren der URL
      chrome.tabs.sendMessage(tab.id, {action: 'copy_url', url: tab.url}, (response) => {
        if (response && response.status === 'success') {
          showNotification('Page URL copied to clipboard!');
        } else {
          showNotification('Failed to copy URL.');
        }
      });
      break;
    case 'open_history_manager':
      chrome.tabs.create({ url: 'history.html' });
      break;
  }
});

// Funktion zum Anzeigen von Benachrichtigungen
function showNotification(message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/ng.png',
    title: 'NG Extension Manager',
    message: message
  });
}