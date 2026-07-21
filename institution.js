import { db } from "./firebase-init.js";
import { doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { INSTITUTION_NAME } from "./firebase-config.js";
import { logActivity } from "./logger.js";

const ref = doc(db, "settings", "institution");

export async function seedInstitutionSettingsIfEmpty() {
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, { name: INSTITUTION_NAME, phone: "", email: "", address: "" });
}

export function subscribeToInstitutionSettings(callback) {
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? snap.data() : { name: INSTITUTION_NAME, phone: "", email: "", address: "" });
  });
}

export async function saveInstitutionSettings(data) {
  await setDoc(ref, data, { merge: true });
  logActivity("update_institution_settings", "Mise à jour des informations de l'établissement");
}
