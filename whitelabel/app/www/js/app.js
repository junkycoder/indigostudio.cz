/* Capacitor app entry point — feature-guarded by window.__BRAND_CAPABILITIES__ */
(function () {
  'use strict';

  var CAPABILITIES = window.__BRAND_CAPABILITIES__ || {};
  var BRAND = window.__BRAND__ || {};
  var isNative = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();

  // Populate static UI
  var titleEl = document.getElementById('app-title');
  if (titleEl && BRAND.name) titleEl.textContent = BRAND.name;

  var versionEl = document.getElementById('app-version');
  if (versionEl && BRAND.version) versionEl.textContent = 'v' + BRAND.version;

  var platformEl = document.getElementById('platform-info');
  if (platformEl) {
    platformEl.textContent = isNative
      ? 'Running on ' + window.Capacitor.getPlatform()
      : 'Running in browser (web mode)';
  }

  // Show feature cards based on capabilities
  function showFeature(id) {
    var el = document.getElementById('feature-' + id);
    if (el) el.style.display = '';
  }

  if (CAPABILITIES.camera) showFeature('camera');
  if (CAPABILITIES.location) showFeature('location');
  if (CAPABILITIES.notifications) showFeature('notifications');
  if (CAPABILITIES.storage) showFeature('storage');

  // --- Camera ---
  if (CAPABILITIES.camera) {
    document.getElementById('btn-camera').addEventListener('click', function () {
      var result = document.getElementById('camera-result');
      if (!isNative) {
        result.textContent = '[web mode] Camera not available in browser.';
        return;
      }
      window.Capacitor.Plugins.Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: 'uri'
      }).then(function (photo) {
        result.textContent = 'Photo saved: ' + photo.path;
      }).catch(function (err) {
        result.textContent = 'Error: ' + err.message;
      });
    });
  }

  // --- Location ---
  if (CAPABILITIES.location) {
    document.getElementById('btn-location').addEventListener('click', function () {
      var result = document.getElementById('location-result');
      if (!isNative) {
        result.textContent = '[web mode] Attempting browser geolocation...';
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function (pos) {
            result.textContent = 'Lat: ' + pos.coords.latitude.toFixed(5) + ', Lon: ' + pos.coords.longitude.toFixed(5);
          }, function (err) {
            result.textContent = 'Error: ' + err.message;
          });
        }
        return;
      }
      window.Capacitor.Plugins.Geolocation.getCurrentPosition().then(function (pos) {
        result.textContent = 'Lat: ' + pos.coords.latitude.toFixed(5) + ', Lon: ' + pos.coords.longitude.toFixed(5);
      }).catch(function (err) {
        result.textContent = 'Error: ' + err.message;
      });
    });
  }

  // --- Notifications ---
  if (CAPABILITIES.notifications) {
    document.getElementById('btn-notify').addEventListener('click', function () {
      if (!isNative) {
        if (window.Notification && Notification.permission !== 'denied') {
          Notification.requestPermission().then(function (perm) {
            if (perm === 'granted') {
              new Notification(BRAND.name || 'WhiteApp', { body: 'Hello from web mode!' });
            }
          });
        }
        return;
      }
      window.Capacitor.Plugins.LocalNotifications.schedule({
        notifications: [{
          title: BRAND.name || 'WhiteApp',
          body: 'Hello from the app!',
          id: 1,
          schedule: { at: new Date(Date.now() + 1000) }
        }]
      }).catch(function (err) {
        console.error('Notification error:', err);
      });
    });
  }

  // --- Storage ---
  if (CAPABILITIES.storage) {
    document.getElementById('btn-save').addEventListener('click', function () {
      var key = document.getElementById('storage-key').value.trim();
      var value = document.getElementById('storage-value').value.trim();
      var result = document.getElementById('storage-result');
      if (!key) { result.textContent = 'Key is required.'; return; }
      if (!isNative) {
        localStorage.setItem(key, value);
        result.textContent = 'Saved (localStorage): ' + key + ' = ' + value;
        return;
      }
      window.Capacitor.Plugins.Preferences.set({ key: key, value: value }).then(function () {
        result.textContent = 'Saved: ' + key;
      }).catch(function (err) {
        result.textContent = 'Error: ' + err.message;
      });
    });

    document.getElementById('btn-load').addEventListener('click', function () {
      var key = document.getElementById('storage-key').value.trim();
      var result = document.getElementById('storage-result');
      if (!key) { result.textContent = 'Key is required.'; return; }
      if (!isNative) {
        var val = localStorage.getItem(key);
        result.textContent = val !== null ? key + ' = ' + val : key + ' not found.';
        return;
      }
      window.Capacitor.Plugins.Preferences.get({ key: key }).then(function (res) {
        result.textContent = res.value !== null ? key + ' = ' + res.value : key + ' not found.';
      }).catch(function (err) {
        result.textContent = 'Error: ' + err.message;
      });
    });
  }
})();
