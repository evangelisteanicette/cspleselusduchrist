/** Les six classes du complexe (§5, §23). Ordre pédagogique, utilisé pour
 * proposer automatiquement la classe suivante lors d'une réinscription. */
export const CLASSES = ["CI", "CP", "CE1", "CE2", "CM1", "CM2"];

export function nextClass(currentClass) {
  const idx = CLASSES.indexOf(currentClass);
  if (idx === -1 || idx === CLASSES.length - 1) return currentClass; // CM2 = fin de cycle
  return CLASSES[idx + 1];
}
