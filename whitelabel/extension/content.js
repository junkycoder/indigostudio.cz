/* Content script — cross-browser compatibility shim */
'use strict';

var API = (typeof browser !== 'undefined') ? browser : chrome;

(function () {
  // Notify background that content script is active
  API.runtime.sendMessage({ type: 'ping' }, function (response) {
    if (API.runtime.lastError) return; // Extension context may be invalidated
    if (response && response.type === 'pong') {
      console.log('[content] Connected to background, version:', response.version);
    }
  });

  // Listen for messages from the popup or background
  API.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'getPageInfo') {
      sendResponse({
        url: window.location.href,
        title: document.title
      });
      return true;
    }
  });
})();
