/**
 * Journal des activités (§20, §74).
 * Chaque action importante appelle logActivity() pour laisser une trace
 * horodatée, consultable ensuite par l'Administrateur Général.
 */
import { db } from "./firebase-init.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { getCurrentUserProfile } from "./auth.js";

/**
 * @param {string} action      Type d'action, ex: "login", "create_user", "payment"
 * @param {string} description Description lisible par un humain
 * @param {object} [extra]     Champs additionnels (studentId, schoolId, amount, ...)
 */
export async function logActivity(action, description, extra = {}) {
  const profile = getCurrentUserProfile();
  try {
    await addDoc(collection(db, "activityLogs"), {
      action,
      description,
      userId: profile?.uid || null,
      userEmail: profile?.email || null,
      userName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
      userRole: profile?.role || null,
      schoolId: extra.schoolId || profile?.schoolId || null,
      studentId: extra.studentId || null,
      timestamp: serverTimestamp(),
      ...extra
    });
  } catch (err) {
    // Le journal ne doit jamais bloquer l'action principale de l'utilisateur.
    console.warn("Journal des activités : échec de l'enregistrement", err);
  }
}
