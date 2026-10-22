import fs from "node:fs/promises";
import XLSX from "xlsx";
import { inspectWorkbookArchive } from "./archiveGuard.js";
import { DocumentError } from "./documentDetector.js";

export function decodeText(bytes) {
  if (bytes.length > 2 * 1024 * 1024)
    throw new DocumentError("Texto excede o limite de 2 MB.");
  let encoding = "utf-8",
    text;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = "utf-16le";
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = "utf-16be";
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
  } catch {
    encoding = "windows-1252";
    text = new TextDecoder(encoding).decode(bytes);
  }
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(text) ||
    /^\s*(?:<!doctype|<html|<script|<\?xml)/i.test(text)
  )
    throw new DocumentError(
      "O arquivo de texto contém dados binários ou conteúdo não suportado.",
    );
  return { text: text.replace(/^\uFEFF/, ""), encoding };
}
export function splitDelimited(text, delimiter) {
  const rows = [];
  let row = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (!value || quoted)) {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && ch === delimiter) {
      row.push(value);
      value = "";
    } else if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else value += ch;
    if (rows.length > 5000 || row.length > 100 || value.length > 20000)
      throw new DocumentError(
        "O texto excede o limite de linhas, colunas ou tamanho de célula.",
      );
  }
  if (quoted) throw new DocumentError("CSV inválido: há aspas sem fechamento.");
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
export function detectDelimiter(text) {
  const candidates = [";", "\t", "|", ","]
    .map((delimiter) => {
      try {
        const rows = splitDelimited(text, delimiter)
          .filter((r) => r.some((c) => c.trim()))
          .slice(0, 40);
        const widths = rows.map((r) => r.length),
          common = widths.filter((n) => n > 1);
        // A decimal comma inside a plain-text amount is not a CSV column.
        if (delimiter === "," && rows.some(r => r.length > 1) && rows.filter(r => r.length > 1).every(r => r.length === 2 && /\d$/.test(r[0]) && /^\d{2}(?:\D.*)?$/.test(r[1])))
          return { delimiter, score:0 };
        const counts = new Map();
        common.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
        const frequency = Math.max(0, ...counts.values());
        return {
          delimiter,
          score:
            frequency >= Math.min(2, rows.length)
              ? frequency * 10 - new Set(common).size
              : 0,
        };
      } catch {
        return { delimiter, score: 0 };
      }
    })
    .sort((a, b) => b.score - a.score);
  return candidates[0].score ? candidates[0].delimiter : null;
}
const pageFromRows = (rows, page, sheet, extra = {}) => ({
  page,
  sheet,
  ocr: false,
  ...extra,
  lines: rows.map((cells, i) => ({
    line: i + 1,
    cells,
    sheet,
    hidden: false,
    text: cells.map((c) => c.text).join("\t"),
    bounds: null,
    segments: [],
  })),
  text: rows.map((cells) => cells.map((c) => c.text).join("\t")).join("\n"),
});
export async function readTabular(filePath, format) {
  if (["csv", "txt"].includes(format)) {
    const { text, encoding } = decodeText(await fs.readFile(filePath));
    const delimiter = detectDelimiter(text);
    const rows = delimiter
      ? splitDelimited(text, delimiter)
      : text.split(/\r?\n/).map((s) => [s]);
    const page = pageFromRows(
      rows.map((r, i) =>
        r.map((text, j) => ({
          text,
          original: text,
          cell: `${XLSX.utils.encode_col(j)}${i + 1}`,
        })),
      ),
      1,
      null,
      { encoding, delimiter },
    );
    enforceContentLimits([page]);
    return [page];
  }
  if (format !== "xls") await inspectWorkbookArchive(filePath, format);
  let book;
  try {
    book = XLSX.read(await fs.readFile(filePath), {
      type: "buffer",
      cellFormula: true,
      cellDates: false,
      cellStyles: true,
      bookVBA: true,
    });
  } catch {
    throw new DocumentError(
      "Planilha inválida, corrompida ou protegida por senha. Exporte uma cópia somente com valores.",
    );
  }
  if (
    book.vbaraw ||
    book.SheetNames.some((name) => book.Sheets[name]?.["!type"] === "macro")
  )
    throw new DocumentError(
      "Planilhas com macros não são suportadas. Exporte uma cópia somente com valores.",
    );
  if (!book.SheetNames.length || book.SheetNames.length > 20)
    throw new DocumentError("A planilha deve conter de 1 a 20 abas.");
  let cellCount = 0;
  const pages = book.SheetNames.map((name, index) => {
    const sheet = book.Sheets[name],
      range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    if (range.e.r >= 5000 || range.e.c >= 100)
      throw new DocumentError(
        "A planilha excede o limite de 5 mil linhas ou 100 colunas por aba.",
      );
    const rows = [],
      hiddenRows = [],
      sheetHidden = !!book.Workbook?.Sheets?.[index]?.Hidden;
    for (let r = 0; r <= range.e.r; r++) {
      const cells = [];
      for (let c = 0; c <= range.e.c; c++) {
        const address = XLSX.utils.encode_cell({ r, c }),
          v = sheet[address];
        if (v && ++cellCount > 50000)
          throw new DocumentError(
            "A planilha excede o limite de 50 mil células preenchidas.",
          );
        let text = v?.v == null ? "" : String(v.v),
          unsafe = null;
        if (v?.t === "n") {
          if (XLSX.SSF.is_date(v.z || "")) {
            const date = XLSX.SSF.parse_date_code(v.v, {
              date1904: !!book.Workbook?.WBProps?.date1904,
            });
            text = date
              ? `${String(date.d).padStart(2, "0")}/${String(date.m).padStart(2, "0")}/${date.y}`
              : text;
          } else if (
            !Number.isFinite(v.v) ||
            Math.abs(v.v) > 1e10 ||
            Math.abs(v.v * 100 - Math.round(v.v * 100)) > 0.0001
          ) {
            unsafe = "Valor numérico com precisão ou magnitude não suportada";
          } else text = v.v.toFixed(2).replace(".", ",");
        }
        if (v?.t === "e") unsafe = "Célula com erro de fórmula";
        if (v?.f)
          unsafe =
            v.v == null
              ? "Fórmula sem resultado armazenado"
              : "Resultado armazenado de fórmula: atualidade não verificada";
        cells.push({
          text,
          original: v?.w ?? (v?.v == null ? "" : String(v.v)),
          cell: address,
          formula: !!v?.f,
          unsafe,
          numeric: v?.t === "n",
          raw: v?.v,
        });
      }
      rows.push(cells);
      hiddenRows.push(!!sheet["!rows"]?.[r]?.hidden || sheetHidden);
    }
    const page = pageFromRows(rows, index + 1, name, {
      sheetHidden,
      merges: (sheet["!merges"] || []).map(XLSX.utils.encode_range),
    });
    page.lines.forEach((line, i) => {
      line.hidden = hiddenRows[i];
    });
    return page;
  });
  enforceContentLimits(pages);
  return pages;
}
export function enforceContentLimits(pages) {
  if (
    pages.reduce((n, p) => n + p.text.length, 0) > 250000 ||
    pages.reduce((n, p) => n + p.lines.length, 0) > 5000
  )
    throw new DocumentError(
      "O documento excede o limite de 250 mil caracteres ou 5 mil linhas.",
    );
}
