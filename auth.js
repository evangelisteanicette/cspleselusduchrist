/**
 * =============================================================
 *  AUTHENTIFICATION ET GESTION DES RÔLES — Élus School Pro
 * =============================================================
 *  §18 : lors de sa toute première connexion, l'adresse e-mail
 *  définie dans SUPER_ADMIN_EMAIL reçoit automatiquement le rôle
 *  Administrateur Général. Tous les autres comptes doivent être
 *  créés par un Administrateur Général depuis l'application
 *  (module Utilisateurs, Phase 2) : un compte Firebase Auth qui
 *  n'a pas encore de document dans "users" est refusé.
 * =============================================================
 */
import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { SUPER_ADMIN_EMAIL } from "./firebase-config.js";
import { ROLES } from "./roles.js";

let currentUserProfile = null;
const listeners = [];

/** Permet à d'autres modules (ui.js, app.js) de réagir aux changements de session. */
export function onAuthReady(callback) {
  listeners.push(callback);
}

function notify(profile) {
  listeners.forEach((cb) => cb(profile));
}

export function getCurrentUserProfile() {
  return currentUserProfile;
}

/**
 * Connexion par e-mail / mot de passe.
 * Retourne { success, error } — l'appelant (écran de connexion)
 * affiche le message d'erreur, jamais cette fonction.
 */
export async function login(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email.trim(), password);
    return { success: true };
  } catch (err) {
    return { success: false, error: mapAuthError(err.code) };
  }
}

export async function logout() {
  const profile = currentUserProfile;
  await firebaseSignOut(auth);
  if (profile) {
    const { logActivity } = await import("./logger.js");
    logActivity("logout", `Déconnexion de ${profile.email}`);
  }
}

export async function resetPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err) {
    return { success: false, error: mapAuthError(err.code) };
  }
}

/**
 * Cœur de la logique de rôle. Appelé automatiquement à chaque connexion.
 * - Si un document users/{uid} existe déjà -> on l'utilise (et on vérifie
 *   qu'il n'est pas désactivé).
 * - S'il n'existe pas et que l'e-mail correspond au Super Admin -> on crée
 *   automatiquement son profil Administrateur Général.
 * - S'il n'existe pas pour n'importe quel autre e-mail -> accès refusé,
 *   car seul un Administrateur Général peut créer un utilisateur.
 */
async function resolveUserProfile(firebaseUser) {
  const ref = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    if (data.status === "disabled") {
      await firebaseSignOut(auth);
      return { error: "Ce compte a été désactivé. Contactez l'Administrateur Général." };
    }
    await updateDoc(ref, { lastLogin: serverTimestamp() });
    return { profile: { uid: firebaseUser.uid, email: firebaseUser.email, ...data } };
  }

  if (firebaseUser.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
    const newProfile = {
      email: firebaseUser.email,
      firstName: "Administrateur",
      lastName: "Général",
      role: ROLES.ADMIN_GENERAL,
      schoolId: null, // accès à toutes les écoles
      status: "active",
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    await setDoc(ref, newProfile);
    return { profile: { uid: firebaseUser.uid, ...newProfile } };
  }

  await firebaseSignOut(auth);
  return {
    error:
      "Ce compte n'est pas encore enregistré dans l'application. Demandez à votre Administrateur Général de créer votre accès."
  };
}

function mapAuthError(code) {
  const messages = {
    "auth/invalid-email": "Adresse e-mail invalide.",
    "auth/user-disabled": "Ce compte a été désactivé.",
    "auth/user-not-found": "Aucun compte ne correspond à cet e-mail.",
    "auth/wrong-password": "Mot de passe incorrect.",
    "auth/invalid-credential": "E-mail ou mot de passe incorrect.",
    "auth/too-many-requests": "Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/network-request-failed": "Problème de connexion Internet."
  };
  return messages[code] || "Une erreur est survenue. Veuillez réessayer.";
}

// Écoute l'état de connexion Firebase en continu.
let resolvingAuthError = null;
onAuthStateChanged(auth, async (firebaseUser) => {
  resolvingAuthError = null;
  if (!firebaseUser) {
    currentUserProfile = null;
    notify(null);
    return;
  }

  const result = await resolveUserProfile(firebaseUser);
  if (result.error) {
    resolvingAuthError = result.error;
    currentUserProfile = null;
    notify({ error: result.error });
    return;
  }

  currentUserProfile = result.profile;
  notify(currentUserProfile);

  const { logActivity } = await import("./logger.js");
  logActivity("login", `Connexion de ${currentUserProfile.email}`);
});

export function getResolvingAuthError() {
  return resolvingAuthError;
}
