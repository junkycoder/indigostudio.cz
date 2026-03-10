/* Popup script — cross-browser via API shim */
'use strict';

var API = (typeof browser !== 'undefined') ? browser : chrome;

(function () {
  var manifest = API.runtime.getManifest();

  var titleEl = document.getElementById('popup-title');
  var versionEl = document.getElementById('popup-version');
  var statusDot = document.getElementById('status-dot');
  var statusText = document.getElementById('status-text');
  var pageInfo = document.getElementById('page-info');
  var pageTitleEl = document.getElementById('page-title');
  var pageUrlEl = document.getElementById('page-url');
  var btnAction = document.getElementById('btn-action');

  if (titleEl) titleEl.textContent = manifest.name;
  if (versionEl) versionEl.textContent = 'v' + manifest.version;

  // Ping background to confirm it's alive
  API.runtime.sendMessage({ type: 'ping' }, function (response) {
    if (API.runtime.lastError || !response) {
      statusText.textContent = 'Background not responding';
      return;
    }
    statusDot.classList.add('connected');
    statusText.textContent = 'Connected';
  });

  // Get current tab info and relay to content script
  API.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs[0]) return;
    var tab = tabs[0];
    API.tabs.sendMessage(tab.id, { type: 'getPageInfo' }, function (response) {
      if (API.runtime.lastError || !response) return;
      pageInfo.style.display = '';
      pageTitleEl.textContent = response.title || '(no title)';
      pageUrlEl.textContent = response.url || '';
    });
  });

  // Action button
  btnAction.addEventListener('click', function () {
    API.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (!tabs || !tabs[0]) return;
      API.tabs.sendMessage(tabs[0].id, { type: 'activate' });
    });
  });
})();
