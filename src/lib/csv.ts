/**
 * Minimal RFC 4180 CSV parser for the source-evidence files in data/source.
 * Handles quoted fields, doubled quotes and commas/newlines inside quotes.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (quoted) {
    throw new SyntaxError("Unterminated quoted field");
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parse CSV with a header row into records. Rejects rows whose width differs from the header. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  return rows.map((row, index) => {
    if (row.length !== header.length) {
      throw new SyntaxError(`Row ${index + 2} has ${row.length} fields, expected ${header.length}`);
    }
    return Object.fromEntries(header.map((key, i) => [key, row[i]]));
  });
}
