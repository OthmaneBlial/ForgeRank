type CsvScalar = string | number | boolean | null | Date;

const protectSpreadsheetValue = (value: string): string =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

export function encodeCsv(rows: Array<Record<string, CsvScalar>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  const escape = (value: CsvScalar): string => {
    const raw = value instanceof Date ? value.toISOString() : value === null ? "" : String(value);
    const safe = protectSpreadsheetValue(raw);
    return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => escape(row[header] ?? null)).join(",")).join("\n")}\n`;
}
