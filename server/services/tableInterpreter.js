import { moneyRules, infoRules, normalize } from "./parserRules.js";
import { allFields } from "../../shared/fields.js";
import { metadataHeaders, rowCells, sectionKind } from "./documentStructure.js";
import { monetaryCell } from "./financialObservations.js";
const exactHeaders = {
  ...Object.fromEntries(
    Object.entries(allFields).map(([k, v]) => [normalize(v), k]),
  ),
  ...metadataHeaders,
  vendas: "sales",
  total: "sales",
  dinheiro: "cash",
  especie: "cash",
  numerario: "cash",
  "vendas em dinheiro": "cash",
  "vendas liquidas": "sales",
  debito: "debit",
  credito: "credit",
  sangria: "withdrawals",
  sangrias: "withdrawals",
  suprimento: "supplies",
  suprimentos: "supplies",
  devolucoes: "refunds",
};
const fieldFor = (text) =>
  (Object.hasOwn(exactHeaders, normalize(text))
    ? exactHeaders[normalize(text)]
    : null) ||
  Object.entries({ ...infoRules, ...moneyRules }).find(([, r]) =>
    r.test(normalize(text)),
  )?.[0];
// The row-scope reader uses the same column vocabulary as the interpreter.
export { fieldFor as tableFieldFor, exactHeaders as tableHeaders };
const valueHeader =
  /^(?:valor(?: total| liquido| recebido)?(?:\s*\(r\$\))?|total|montante|saldo|recebido|r\$)$/;
const labelHeader =
  /^(?:descricao|movimento|movimentacao|historico|forma(?: de pagamento)?|pagamento|modalidade|informacao)$/;
const quantityHeader = /^(?:quantidade|qtd\.?|qtdade|numero|n[ºo])$/;
const hasAmount = (c) => c.numeric || monetaryCell(c.text);
const valueFor = (field, c) =>
  ["register", "shift"].includes(field) && c.numeric
    ? String(c.raw)
    : c.text.trim();

// Normalize observations, not amounts. Keep direction, section and original
// evidence together for reconciliation across summaries and detailed ledgers.
export function interpretTables(pages) {
  let continuation = null;
  return pages.map((page) => {
    // Continue a physical PDF table on the next page. Sheet boundaries and new
    // explicit metadata never inherit a previous table's column meaning.
    const prior =
      !page.sheet && continuation?.page === page.page - 1 ? continuation : null;
    let header = prior?.header || null,
      mode = prior?.mode || null,
      section = prior?.section || null;
    const lines = [],
      rows =
        page.lines ||
        page.text.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }));
    const emit = (row, text, cells, extra = {}) =>
      lines.push({
        ...row,
        text,
        originalText: row.originalText || row.text,
        cells,
        sheet: page.sheet,
        section,
        ...extra,
      });
    const metadata = (row, field, cell, column) => {
      const value = valueFor(field, cell);
      if (field === "operatorRegister") {
        const m = value.match(
          /^(.+?)\s*[|/]\s*(?:caixa|pdv)\s*[:=]?\s*(\S+)$/i,
        );
        if (!m) {
          emit(row, value, [cell], { column });
          return;
        }
        emit(row, `Operadora: ${m[1].trim()}`, [cell], { column });
        emit(row, `Caixa: ${m[2]}`, [cell], { column: column + 100 });
        return;
      }
      emit(
        row,
        `${field === "shift" ? "Turno" : allFields[field]}: ${value}`,
        [cell],
        { column },
      );
    };
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index],
        cells = rowCells(row),
        nonempty = cells
          .map((c, i) => ({ ...c, index: i }))
          .filter((c) => c.text.trim() || c.unsafe),
        norms = cells.map((c) => normalize(c.text));
      const kind = sectionKind(row.text.replace(/\t/g, " "));
      if (kind) {
        section = kind;
        mode = null;
        header = null;
        emit(row, row.text, cells);
        continue;
      }
      const metadataOnly =
        nonempty.length &&
        nonempty.every((c) => metadataHeaders[normalize(c.text)]);
      const next = rows[index + 1],
        nextCells = next && rowCells(next);
      if (
        metadataOnly &&
        nextCells &&
        nonempty.every(
          (c) =>
            nextCells[c.index]?.text.trim() &&
            !metadataHeaders[normalize(nextCells[c.index].text)],
        )
      ) {
        for (const c of nonempty)
          metadata(
            next,
            metadataHeaders[normalize(c.text)],
            nextCells[c.index],
            c.index + 1,
          );
        index++;
        continue;
      }
      if (metadataOnly) {
        emit(row, row.text, cells, { metadataHeader: true });
        continue;
      }
      const transactionHeader =
        norms.some((n) =>
          /^(?:operacao|cupom|transacao|identificador|id)$/.test(n),
        ) &&
        norms.some((n) =>
          /^(?:forma(?: de pagamento)?|pagamento|modalidade)$/.test(n),
        ) &&
        norms.some((n) => valueHeader.test(n));
      if (transactionHeader) {
        mode = "transactions";
        section = "transactions";
        header = null;
        emit(row, row.text, cells, { transactionHeader: true });
        continue;
      }
      if (mode === "transactions") {
        emit(row, row.text, cells);
        continue;
      }
      const valueColumn = norms.findIndex((n) => valueHeader.test(n)),
        labelColumn = norms.findIndex((n) => labelHeader.test(n));
      const hasValue = nonempty.some(hasAmount);
      if (!hasValue && valueColumn >= 0 && labelColumn >= 0) {
        header = {
          valueColumn,
          labelColumn,
          type: norms.indexOf("tipo"),
          section: norms.findIndex((n) => n === "secao"),
          ignored: norms.flatMap((n, i) => (quantityHeader.test(n) ? [i] : [])),
          metadata: norms.flatMap((n, i) =>
            metadataHeaders[n] ? [{ field: metadataHeaders[n], index: i }] : [],
          ),
        };
        mode = "records";
        continue;
      }
      const known = nonempty.filter(
        (c) =>
          Object.hasOwn(exactHeaders, normalize(c.text)) &&
          exactHeaders[normalize(c.text)],
      );
      if (!hasValue && known.length >= 2 && known.length === nonempty.length) {
        header = cells;
        mode = "columns";
        continue;
      }
      if (
        mode === "columns" &&
        nonempty.length === 2 &&
        fieldFor(nonempty[0].text) &&
        hasAmount(nonempty[1])
      )
        mode = null;
      if (mode === "columns" && hasValue) {
        cells.forEach((c, i) => {
          if (!c.text.trim() && !c.unsafe) return;
          const field = fieldFor(header[i]?.text || "");
          if (field) metadata(row, field, c, i + 1);
          else emit(row, c.text, [c], { column: i + 1 });
        });
        continue;
      }
      if (
        mode === "records" &&
        hasValue &&
        cells[header.labelColumn]?.text.trim()
      ) {
        const label = cells[header.labelColumn],
          value = cells[header.valueColumn],
          type = cells[header.type];
        const recordSection =
          header.section >= 0
            ? sectionKind(cells[header.section]?.text || "")
            : section;
        if (value?.text.trim() || value?.unsafe) {
          emit(
            row,
            `${label.text}: ${type?.text ? type.text + " | " : ""}${value.text}`,
            [label, type, value].filter(Boolean),
            { column: header.valueColumn + 1, section: recordSection },
          );
          for (const m of header.metadata)
            if (cells[m.index]?.text.trim())
              metadata(row, m.field, cells[m.index], m.index + 1);
          const consumed = new Set([
            header.labelColumn,
            header.valueColumn,
            header.type,
            header.section,
            ...header.ignored,
            ...header.metadata.map((m) => m.index),
          ]);
          cells.forEach((c, i) => {
            if (!consumed.has(i) && hasAmount(c))
              emit(row, c.text, [c], { column: i + 1, section: recordSection });
          });
          continue;
        }
      }
      const first = nonempty[0],
        field = first && metadataHeaders[normalize(first.text)];
      if (field && nonempty.length === 2) {
        mode = null;
        header = null;
        metadata(row, field, nonempty[1], nonempty[1].index + 1);
      } else emit(row, row.text, cells);
    }
    continuation =
      !page.sheet && mode === "records"
        ? { page: page.page, header, mode, section }
        : null;
    return { ...page, lines };
  });
}
