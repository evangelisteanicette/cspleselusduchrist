/**
 * =============================================================
 *  GESTION DES UTILISATEURS — Élus School Pro (§18-19)
 * =============================================================
 *  Le SDK Firebase côté navigateur ne permet pas à un compte de créer
 *  un autre compte Auth sans perdre sa propre session. La solution
 *  standard sans backend dédié : ouvrir une application Firebase
 *  secondaire et temporaire, y créer le nouveau compte, puis la
 *  détruire — la session de l'Administrateur Général n'est jamais
 *  affectée. Le nouvel utilisateur reçoit un e-mail pour définir
 *  lui-même son mot de passe (aucun mot de passe temporaire à
 *  communiquer à l'oral ou par écrit).
 * =============================================================
 */
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { db } from "./firebase-init.js";
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { logActivity } from "./logger.js";

function randomTempPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createUserAccount(data) {
  const secondaryApp = initializeApp(firebaseConfig, `user-creation-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    const credential = await createUserWithEmailAndPassword(secondaryAuth, data.email.trim(), randomTempPassword());
    await setDoc(doc(db, "users", credential.user.uid), {
      email: data.email.trim(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      sex: data.sex,
      phone: data.phone || "",
      role: data.role,
      schoolId: data.role === "adminGeneral" ? null : data.schoolId,
      status: "active",
      createdAt: serverTimestamp(),
      lastLogin: null
    });
    await sendPasswordResetEmail(secondaryAuth, data.email.trim());
    await signOut(secondaryAuth);
  } finally {
    await deleteApp(secondaryApp);
  }
  logActivity("create_user", `Création du compte ${data.firstName} ${data.lastName} (${data.email}) — rôle ${data.role}`, {
    schoolId: data.schoolId || null
  });
}

export function subscribeToUsers(callback) {
  const q = query(collection(db, "users"), orderBy("lastName"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function updateUser(uid, data, description) {
  await updateDoc(doc(db, "users", uid), data);
  logActivity("update_user", description || `Modification du compte ${uid}`);
}

export async function setUserStatus(uid, status, name) {
  await updateDoc(doc(db, "users", uid), { status });
  logActivity(
    status === "disabled" ? "disable_user" : "enable_user",
    `${status === "disabled" ? "Désactivation" : "Réactivation"} du compte ${name}`
  );
}

export async function sendPasswordReset(email) {
  const secondaryApp = initializeApp(firebaseConfig, `password-reset-${Date.now()}`);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    await sendPasswordResetEmail(secondaryAuth, email);
  } finally {
    await deleteApp(secondaryApp);
  }
  logActivity("password_reset_sent", `E-mail de réinitialisation envoyé à ${email}`);
}

/** Supprime uniquement le profil applicatif (le compte Firebase Auth doit être supprimé depuis la console Firebase si nécessaire). */
export async function deleteUserProfile(uid, name) {
  await deleteDoc(doc(db, "users", uid));
  logActivity("delete_user_profile", `Suppression du profil applicatif de ${name}`);
}
