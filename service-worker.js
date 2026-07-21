/**
 * Service Worker — Élus School Pro
 * Met en cache la coquille de l'application (HTML/CSS/JS/icônes) afin
 * qu'elle continue de fonctionner hors ligne (§92). Les données Firebase
 * ne sont jamais interceptées ici : Firestore gère lui-même son propre
 * cache local persistant (voir js/firebase-init.js).
 *
 * IMPORTANT : à chaque nouvelle mise en production, changez CACHE_VERSION
 * pour que les utilisateurs reçoivent automatiquement la dernière version.
 */
const CACHE_VERSION = "esp-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/firebase-config.js",
  "./js/firebase-init.js",
  "./js/roles.js",
  "./js/schools.js",
  "./js/theme.js",
  "./js/icons.js",
  "./js/logger.js",
  "./js/classes.js",
  "./js/academicYears.js",
  "./js/students.js",
  "./js/academic.js",
  "./js/finance.js",
  "./js/users.js",
  "./js/institution.js",
  "./js/csv.js",
  "./js/ui.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/favicon-32.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // On ne touche jamais aux requêtes Firebase/Google (Auth, Firestore, Storage) :
  // elles gèrent leur propre logique réseau/hors-ligne.
  if (
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("firebasestorage.app") ||
    url.hostname.includes("gstatic.com") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
