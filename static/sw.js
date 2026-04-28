// A simple service worker to allow PWA installation
self.addEventListener('install', (e) => {
    console.log('[Service Worker] Install');
});

self.addEventListener('fetch', (e) => {
    // Allows the app to work offline by caching (we will leave this basic for now)
});