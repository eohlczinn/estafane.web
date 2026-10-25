import { allFields, moneyFields } from "../../shared/fields.js";
import { normalize } from "./parserRules.js";
import { rowCells } from "./documentStructure.js";
import { tableHeaders } from "./tableInterpreter.js";

const identityFields = ["market", "operator", "register", "date"];
const referenceHeader = /^(?:documento|referencia(?: do fechamento)?|id (?:do )?fechamento|identificador do fechamento)$/;
const headerField = (cell) =>
  referenceHeader.test(normalize(cell.text))
    ? "closingReference"
    : Object.hasOwn(tableHeaders, normalize(cell.text))
      ? tableHeaders[normalize(cell.text)]
      : null;
const displayedValue = (field, cell) =>
  ["register", "shift"].includes(field) && cell.numeric
    ? String(cell.raw)
    : cell.text.trim();

/**
 * A row becomes a closing only in an explicit, complete closing table. Product
 * and receipt rows do not establish a date/operator/register/market identity.
 * Unclaimed trailing content makes the split ineligible rather than dropping it.
 */
export function splitTabularScopes(pages) {
  if (pages.length !== 1) return { scopes: [] };
  const page = pages[0];
  const rows = (page.lines || []).filter((row) =>
    rowCells(row).some((cell) => cell.text.trim() || cell.unsafe),
  );
  const headerIndex = rows.findIndex((row) => {
    const cells = rowCells(row),
      populated = cells.filter((cell) => cell.text.trim()),
      fields = populated.map(headerField);
    return (
      populated.length === fields.filter(Boolean).length &&
      identityFields.every((field) => fields.includes(field)) &&
      new Set(fields.filter((field) => Object.hasOwn(moneyFields, field))).size >= 2
    );
  });
  if (headerIndex < 0) return { scopes: [] };
  // Accept a short plain title before the table, without assigning a shared
  // monetary declaration to several independent closings.
  if (
    rows.slice(0, headerIndex).some((row) => {
      const nonempty = rowCells(row).filter((cell) => cell.text.trim());
      return nonempty.length !== 1 || /\d|R\$/i.test(nonempty[0].text);
    })
  ) return { scopes: [] };

  const header = rowCells(rows[headerIndex]);
  const fields = header.map(headerField);
  if (fields.filter(Boolean).length !== new Set(fields.filter(Boolean)).size)
    return { scopes: [] };
  const candidates = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = rowCells(row);
    if (
      cells.every((cell, index) =>
        normalize(cell.text) === normalize(header[index]?.text || ""),
      )
    ) continue;
    if (
      cells.some((cell, index) =>
        (cell.text.trim() || cell.unsafe) && !fields[index],
      ) ||
      identityFields.some((field) => {
        const cell = cells[fields.indexOf(field)];
        return !cell?.text.trim() || cell.unsafe;
      })
    ) return { scopes: [] };
    const identity = Object.fromEntries(
      identityFields.map((field) => [
        field,
        displayedValue(field, cells[fields.indexOf(field)]),
      ]),
    );
    if (!/^\d{1,2}\/\d{1,2}\/\d{4}$|^\d{4}-\d{2}-\d{2}$/.test(identity.date))
      return { scopes: [] };
    const referenceCell = cells[fields.indexOf("closingReference")];
    const reference = referenceCell?.text.trim() || null;
    if (reference && (referenceCell.unsafe || !/^[\w./-]{1,100}$/.test(reference)))
      return { scopes: [] };
    const lines = cells.flatMap((cell, column) => {
      if (!cell.text.trim() && !cell.unsafe) return [];
      const field = fields[column];
      const label = field === "closingReference" ? "Documento" : allFields[field];
      const text = `${label}: ${displayedValue(field, cell)}`;
      return [{
        ...row,
        text,
        cells: [cell],
        column: column + 1,
        originalText: row.originalText || row.text,
      }];
    });
    candidates.push({
      identity,
      reference,
      issues: [],
      label: `${page.sheet ? `aba ${page.sheet}, ` : ""}linha ${row.line}`,
      pages: [{ ...page, lines, text: lines.map((line) => line.text).join("\n") }],
    });
  }
  const distinct = new Set(candidates.map((scope) =>
    JSON.stringify([
      ...identityFields.map((field) => normalize(scope.identity[field])),
      normalize(scope.reference || ""),
    ]),
  ));
  return { scopes: candidates.length >= 2 && distinct.size >= 2 ? candidates : [] };
}
