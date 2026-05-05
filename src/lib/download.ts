// Trigger a browser download for in-memory content. CSV files are emitted
// with a UTF-8 BOM so Excel correctly detects encoding (otherwise Thai text
// renders as mojibake on Windows).
export function downloadFile(content: string, filename: string, mime: string) {
  const isCsv = mime.startsWith("text/csv") || filename.toLowerCase().endsWith(".csv");
  const body = isCsv ? "\uFEFF" + content : content;
  const type = isCsv && !mime.includes("charset") ? "text/csv;charset=utf-8" : mime;
  const blob = new Blob([body], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
