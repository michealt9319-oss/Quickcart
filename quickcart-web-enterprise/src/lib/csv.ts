/// Split into a pure builder (testable without a DOM) and a thin
/// DOM-triggering wrapper, rather than one function that mixes string
/// building with browser download side effects.
export function buildCsvContent(headers: string[], rows: (string | number)[][]): string {
  const escape = (value: string | number) => {
    const str = String(value ?? "");
    // Quote any field containing a comma, quote, or newline, and escape
    // embedded quotes by doubling them — standard CSV escaping.
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
  return lines.join("\n");
}

/// Builds a CSV file in the browser and triggers a download — no backend
/// export endpoint needed, since everything being exported here is already
/// loaded into the page (one page of orders/audit logs at a time). If you
/// later want "export everything, not just this page," that's better done
/// as a real backend endpoint that streams the full result set rather than
/// paginating through the UI to build one client-side.
export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const content = buildCsvContent(headers, rows);
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
