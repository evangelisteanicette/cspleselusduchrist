/**
 * =============================================================
 *  MODULE FINANCIER — Élus School Pro (§51 à §68)
 * =============================================================
 *  Toutes les collections sont "plates" (comme grades/students) et
 *  portent systématiquement schoolId + schoolYear, ce qui permet de
 *  calculer le tableau de bord financier ou la liste des retards en
 *  quelques requêtes seulement, quel que soit le nombre d'élèves
 *  (§48 : performance même avec plusieurs milliers d'élèves).
 * =============================================================
 */
import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { logActivity } from "./logger.js";
import { getCurrentUserProfile } from "./auth.js";

export const TUITION_COMPONENTS = [
  { key: "inscription", label: "Inscription" },
  { key: "tranche1", label: "1ère tranche" },
  { key: "tranche2", label: "2ème tranche" },
  { key: "tranche3", label: "3ème tranche" }
];

export const PAYMENT_MODES = [
  { key: "especes", label: "Espèces" },
  { key: "mobile_money", label: "Mobile Money" },
  { key: "virement", label: "Virement" }
];

// ============================================================= FRAIS DE SCOLARITÉ =

export async function seedFeeSettingsIfEmpty(schoolYear) {
  const ref = doc(db, "feeSettings", schoolYear);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  await setDoc(ref, {
    inscription: 0, tranche1: 0, tranche2: 0, tranche3: 0,
    deadlineInscription: "", deadlineTranche1: "", deadlineTranche2: "", deadlineTranche3: ""
  });
}

export function subscribeToFeeSettings(schoolYear, callback) {
  return onSnapshot(doc(db, "feeSettings", schoolYear), (snap) => {
    callback(snap.exists() ? snap.data() : {});
  });
}

export async function saveFeeSettings(schoolYear, data) {
  await setDoc(doc(db, "feeSettings", schoolYear), {
    inscription: Number(data.inscription) || 0,
    tranche1: Number(data.tranche1) || 0,
    tranche2: Number(data.tranche2) || 0,
    tranche3: Number(data.tranche3) || 0,
    deadlineInscription: data.deadlineInscription || "",
    deadlineTranche1: data.deadlineTranche1 || "",
    deadlineTranche2: data.deadlineTranche2 || "",
    deadlineTranche3: data.deadlineTranche3 || ""
  }, { merge: true });
  logActivity("update_fee_settings", `Mise à jour des frais de scolarité ${schoolYear}`);
}

// ============================================================= AUTRES FRAIS (catalogue) =

const feeTypesCol = collection(db, "feeTypes");

export function subscribeToFeeTypes(callback) {
  return onSnapshot(query(feeTypesCol, orderBy("name")), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function addFeeType({ name, defaultAmount }) {
  await addDoc(feeTypesCol, { name: name.trim(), defaultAmount: Number(defaultAmount) || 0, createdAt: serverTimestamp() });
  logActivity("create_fee_type", `Création du frais "${name}"`);
}

export async function deleteFeeType(id, name) {
  await deleteDoc(doc(db, "feeTypes", id));
  logActivity("delete_fee_type", `Suppression du frais "${name}"`);
}

// ---- Frais assignés à un élève (studentFees) ------------------------------

const studentFeesCol = collection(db, "studentFees");

export function subscribeToStudentFees(studentId, schoolYear, callback) {
  const q = query(studentFeesCol, where("studentId", "==", studentId), where("schoolYear", "==", schoolYear));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export async function assignFeeToStudent(student, feeType, schoolYear) {
  await addDoc(studentFeesCol, {
    studentId: student.id,
    schoolId: student.schoolId,
    schoolYear,
    feeTypeId: feeType.id,
    feeTypeName: feeType.name,
    amount: Number(feeType.defaultAmount) || 0,
    createdAt: serverTimestamp()
  });
  logActivity("assign_fee", `Ajout du frais "${feeType.name}" à ${student.firstName} ${student.lastName}`, {
    schoolId: student.schoolId, studentId: student.id
  });
}

// ============================================================= RÉDUCTIONS =

const reductionsCol = collection(db, "reductions");

export function subscribeToReductions(studentId, schoolYear, callback) {
  const q = query(reductionsCol, where("studentId", "==", studentId), where("schoolYear", "==", schoolYear));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Réservé à l'Administrateur Général (§56 : décision discrétionnaire tracée). */
export async function addReduction(student, { component, componentLabel, type, value, reason }, schoolYear) {
  const profile = getCurrentUserProfile();
  await addDoc(reductionsCol, {
    studentId: student.id,
    schoolId: student.schoolId,
    schoolYear,
    component, componentLabel,
    type, // 'fixed' | 'percent'
    value: Number(value),
    reason: reason || "",
    authorizedByName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
    authorizedByEmail: profile?.email || null,
    date: new Date().toISOString().slice(0, 10),
    createdAt: serverTimestamp()
  });
  logActivity("grant_reduction", `Réduction accordée à ${student.firstName} ${student.lastName} sur ${componentLabel}`, {
    schoolId: student.schoolId, studentId: student.id
  });
}

// ============================================================= PAIEMENTS =

const paymentsCol = collection(db, "payments");

function receiptCounterKey(schoolId) {
  return doc(db, "schools", schoolId);
}

async function generateReceiptNumber(schoolId, schoolCode) {
  const yearShort = new Date().getFullYear();
  return runTransaction(db, async (tx) => {
    const schoolRef = receiptCounterKey(schoolId);
    const snap = await tx.get(schoolRef);
    const current = snap.exists() ? snap.data().receiptCounter || 0 : 0;
    const next = current + 1;
    tx.update(schoolRef, { receiptCounter: next });
    return `RCP-${schoolCode}-${yearShort}-${String(next).padStart(5, "0")}`;
  });
}

/**
 * Enregistre un paiement (§57). Le montant ne doit jamais dépasser le solde
 * restant dû pour la composante choisie — vérifié par l'appelant (UI) via
 * computeStudentBalance() avant l'appel, et revérifié ici pour sécurité.
 */
export async function recordPayment({ student, schoolCode, schoolYear, component, componentLabel, amount, mode, remainingForComponent }) {
  const numAmount = Number(amount);
  if (Number.isNaN(numAmount) || numAmount <= 0) throw new Error("Le montant doit être supérieur à zéro.");
  if (remainingForComponent != null && numAmount > remainingForComponent + 0.001) {
    throw new Error(`Le montant dépasse le solde restant dû (${remainingForComponent} FCFA).`);
  }

  const receiptNumber = await generateReceiptNumber(student.schoolId, schoolCode);
  const profile = getCurrentUserProfile();

  const ref = await addDoc(paymentsCol, {
    studentId: student.id,
    schoolId: student.schoolId,
    classe: student.currentClass,
    schoolYear,
    component, componentLabel,
    amount: numAmount,
    mode,
    date: new Date().toISOString().slice(0, 10),
    comptableId: profile?.uid || null,
    comptableName: profile ? `${profile.firstName || ""} ${profile.lastName || ""}`.trim() : null,
    receiptNumber,
    voided: false,
    createdAt: serverTimestamp()
  });

  logActivity("record_payment", `Paiement de ${numAmount} FCFA (${componentLabel}) — ${student.firstName} ${student.lastName} — reçu ${receiptNumber}`, {
    schoolId: student.schoolId, studentId: student.id
  });

  return { id: ref.id, receiptNumber, amount: numAmount };
}

/**
 * Annulation d'un paiement erroné (§60/§67) : jamais de suppression pure,
 * toujours un "void" tracé — réservé à l'Administrateur Général.
 */
export async function voidPayment(paymentId, reason, description) {
  const profile = getCurrentUserProfile();
  await updateDoc(doc(db, "payments", paymentId), {
    voided: true,
    voidReason: reason || "",
    voidedBy: profile?.email || null,
    voidedAt: serverTimestamp()
  });
  logActivity("void_payment", `Annulation de paiement : ${description}${reason ? ` — motif : ${reason}` : ""}`);
}

export function subscribeToStudentPayments(studentId, schoolYear, callback) {
  const q = query(paymentsCol, where("studentId", "==", studentId), where("schoolYear", "==", schoolYear));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

/** Utilisé par le tableau de bord et la liste des retards : une seule requête pour toute l'école. */
export function subscribeToSchoolPayments(schoolId, schoolYear, callback) {
  const base = schoolId
    ? query(paymentsCol, where("schoolId", "==", schoolId), where("schoolYear", "==", schoolYear))
    : query(paymentsCol, where("schoolYear", "==", schoolYear));
  return onSnapshot(base, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeToSchoolReductions(schoolId, schoolYear, callback) {
  const base = schoolId
    ? query(reductionsCol, where("schoolId", "==", schoolId), where("schoolYear", "==", schoolYear))
    : query(reductionsCol, where("schoolYear", "==", schoolYear));
  return onSnapshot(base, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

export function subscribeToSchoolStudentFees(schoolId, schoolYear, callback) {
  const base = schoolId
    ? query(studentFeesCol, where("schoolId", "==", schoolId), where("schoolYear", "==", schoolYear))
    : query(studentFeesCol, where("schoolYear", "==", schoolYear));
  return onSnapshot(base, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
}

// ============================================================= CALCULS ===

/**
 * Calcule le détail complet du compte financier d'un élève : ce qui est dû,
 * payé, restant, et en retard, composante par composante (§52, §55).
 */
export function computeStudentBalance(student, feeSettings, otherFees, reductions, payments) {
  const today = new Date().toISOString().slice(0, 10);
  const validPayments = payments.filter((p) => !p.voided);

  function reductionAmount(component, base) {
    const applicable = reductions.filter((r) => r.component === component);
    let total = 0;
    applicable.forEach((r) => {
      total += r.type === "percent" ? (base * r.value) / 100 : r.value;
    });
    return Math.min(total, base);
  }

  const components = TUITION_COMPONENTS.map(({ key, label }) => {
    const base = Number(feeSettings?.[key]) || 0;
    const reduction = reductionAmount(key, base);
    const required = Math.max(0, base - reduction);
    const paid = validPayments.filter((p) => p.component === key).reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, required - paid);
    const deadline = feeSettings?.[`deadline${key.charAt(0).toUpperCase()}${key.slice(1)}`] || "";
    const late = remaining > 0 && deadline && today > deadline;
    return { key, label, base, reduction, required, paid, remaining, deadline, late };
  });

  const otherComponents = otherFees.map((fee) => {
    const reduction = reductionAmount(fee.id, fee.amount);
    const required = Math.max(0, fee.amount - reduction);
    const paid = validPayments.filter((p) => p.component === fee.id).reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, required - paid);
    return { key: fee.id, label: fee.feeTypeName, base: fee.amount, reduction, required, paid, remaining, deadline: "", late: false };
  });

  const all = [...components, ...otherComponents];
  const totalDue = all.reduce((s, c) => s + c.required, 0);
  const totalPaid = all.reduce((s, c) => s + c.paid, 0);
  const totalRemaining = all.reduce((s, c) => s + c.remaining, 0);
  const isLate = components.some((c) => c.late);

  return { components, otherComponents, all, totalDue, totalPaid, totalRemaining, isLate };
}

export function formatFCFA(amount) {
  return `${Math.round(amount || 0).toLocaleString("fr-FR")} FCFA`;
}
