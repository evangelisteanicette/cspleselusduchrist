/**
 * =============================================================
 *  CONFIGURATION FIREBASE — Élus School Pro
 * =============================================================
 *  C'est le SEUL fichier que vous devez modifier pour connecter
 *  l'application à votre propre projet Firebase.
 *
 *  Comment obtenir ces valeurs :
 *  1. Allez sur https://console.firebase.google.com
 *  2. Créez un projet (ou ouvrez-en un existant)
 *  3. Cliquez sur l'icône </> "Ajouter une application Web"
 *  4. Copiez l'objet "firebaseConfig" qui s'affiche et collez ses
 *     valeurs ci-dessous, à la place des exemples.
 *
 *  Voir le fichier README.md pour le guide complet, étape par étape.
 * =============================================================
 */

export const firebaseConfig = {
  apiKey: "AIzaSyD0qZZAlhafLtwz0fLrC5nKXFnvAMMgZE0",
  authDomain: "csp-leselusduchrist.firebaseapp.com",
  projectId: "csp-leselusduchrist",
  storageBucket: "csp-leselusduchrist.firebasestorage.app",
  messagingSenderId: "24575745275",
  appId: "1:24575745275:web:83d712580f19fddb9e245e"
};

/**
 * Adresse e-mail du tout premier Administrateur Général.
 * Lors de sa toute première connexion, si ce compte existe dans
 * Firebase Authentication, l'application lui attribue automatiquement
 * le rôle "Administrateur Général". Ensuite, c'est lui qui crée
 * tous les autres utilisateurs depuis l'application.
 */
export const SUPER_ADMIN_EMAIL = "evangelisteanicette@gmail.com";

/**
 * Nom officiel de l'établissement — utilisé sur l'écran de connexion,
 * le tableau de bord, les reçus, les bulletins et les rapports.
 */
export const INSTITUTION_NAME = "Complexe Scolaire Privé Bilingue Les Élus du Christ";

/** Nom commercial de l'application. */
export const APP_NAME = "Élus School Pro";

/**
 * Écoles créées automatiquement au tout premier démarrage
 * (uniquement si la collection "schools" est vide).
 * De nouvelles écoles pourront ensuite être ajoutées depuis
 * l'application, sans toucher au code.
 */
export const DEFAULT_SCHOOLS = [
  { name: "Agouna", commune: "Djidja", code: "AGO" },
  { name: "Avogbana", commune: "Bohicon", code: "AVO" }
];

/**
 * Année scolaire active par défaut au premier démarrage.
 * Modifiable ensuite dans Paramètres > Années scolaires.
 */
export const DEFAULT_SCHOOL_YEAR = "2026-2027";
