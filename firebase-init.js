/**
 * =============================================================
 *  INITIALISATION FIREBASE — Élus School Pro
 * =============================================================
 *  Charge le SDK Firebase directement depuis le CDN officiel
 *  (aucune installation, aucun outil de build nécessaire).
 * =============================================================
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// La session reste ouverte même après fermeture du navigateur (utile sur
// les tablettes/postes partagés du secrétariat, avec déconnexion automatique
// gérée séparément après une période d'inactivité — voir js/app.js).
setPersistence(auth, browserLocalPersistence).catch(() => {
  /* Persistance non disponible (mode navigation privée) — l'app continue de
     fonctionner, la session ne survivra simplement pas à la fermeture. */
});

// Cache local persistant : l'application continue de fonctionner hors ligne
// (lecture des dernières données synchronisées) et resynchronise
// automatiquement dès le retour de la connexion Internet (exigence §92).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const storage = getStorage(app);

export const isFirebaseConfigured = () =>
  firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("COLLEZ_ICI");
