/* Background service worker (MV3) — also valid as MV2 background page script */
'use strict';

var API = (typeof browser !== 'undefined') ? browser : chrome;

API.runtime.onInstalled.addListener(function (details) {
  if (details.reason === 'install') {
    console.log('[background] Extension installed.');
  } else if (details.reason === 'update') {
    console.log('[background] Extension updated to', API.runtime.getManifest().version);
  }
});

API.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.type === 'ping') {
    sendResponse({ type: 'pong', version: API.runtime.getManifest().version });
    return true;
  }
  if (message.type === 'getConfig') {
    API.storage.local.get('brandConfig', function (result) {
      sendResponse({ config: result.brandConfig || null });
    });
    return true;
  }
});
