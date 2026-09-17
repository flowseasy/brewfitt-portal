/** Real browser download of generated text content, e.g. a CSV export (decision 9). */
export function downloadText(filename: string, content: string, mimeType = "text/csv") {
  // Excel opens UTF-8 CSV correctly when it starts with a byte order mark.
  const blob = new Blob([mimeType === "text/csv" ? "﻿" + content : content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
