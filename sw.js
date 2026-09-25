const CACHE_NAME = 'vacation-app-v7';
const ASSETS = [
    './',
    './index.html',
    './style.css',
    './api.js',
    './script.js',
    './manifest.json',
    './logo.png',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/themes/material_blue.css',
    'https://cdn.jsdelivr.net/npm/flatpickr',
    'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/ar.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/i18next/23.11.5/i18next.min.js',
    'https://cdn.jsdelivr.net/npm/hijri-date@0.2.2/cdn/hijri-date-latest.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME)
            .then(c => c.addAll(ASSETS).catch(() => {}))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // لا نُخزّن أي طلبات من Google (API)
    if (url.hostname.includes('script.google.com') ||
        url.hostname.includes('googleusercontent.com') ||
        url.hostname.includes('script.googleusercontent.com') ||
        url.hostname.includes('googleapis.com')) {
        return;
    }

    e.respondWith(
        caches.match(e.request).then(cached => {
            const fetchPromise = fetch(e.request).then(res => {
                if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
                }
                return res;
            }).catch(() => cached);
            return cached || fetchPromise;
        })
    );
});
