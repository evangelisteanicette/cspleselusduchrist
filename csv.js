/**
 * Génère et télécharge un fichier CSV (compatible Microsoft Excel,
 * LibreOffice et Google Sheets — §77). Pas de dépendance externe.
 * Pour un export PDF, la fonction équivalente est window.print() déjà
 * utilisée sur les bulletins, reçus et listes (impression navigateur
 * > "Enregistrer au format PDF").
 */
export function exportToCSV(filename, headers, rows) {
  const escapeCell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escapeCell).join(";"), ...rows.map((row) => row.map(escapeCell).join(";"))];
  // Point d'exclamation UTF-8 (BOM) pour qu'Excel affiche correctement les accents.
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
