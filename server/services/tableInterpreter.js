import { moneyRules, infoRules, normalize } from "./parserRules.js";
import { allFields } from "../../shared/fields.js";
const metadataHeaders = {data:"date",operador:"operator",operadora:"operator",caixa:"register",pdv:"register",turno:"shift",horario:"shift",estabelecimento:"market",empresa:"market",vendas:"sales",total:"sales"};
const exactHeaders = { ...Object.fromEntries(Object.entries(allFields).map(([key,label]) => [normalize(label),key])), ...metadataHeaders,
  dinheiro:"cash",especie:"cash",numerario:"cash","vendas em dinheiro":"cash","vendas liquidas":"sales",debito:"debit",credito:"credit",sangria:"withdrawals",sangrias:"withdrawals",suprimento:"supplies",suprimentos:"supplies",devolucoes:"refunds","forma de pagamento":null };
const fieldFor = (text) =>
  (Object.hasOwn(exactHeaders,normalize(text)) ? exactHeaders[normalize(text)] : null) || Object.entries({ ...infoRules, ...moneyRules }).find(([, rule]) =>
    rule.test(normalize(text)),
  )?.[0];
const exactValueHeader =
  /^(?:valor(?: total| liquido)?|total|montante|saldo|recebido|r\$)$/;
const exactLabelHeader =
  /^(?:descricao|movimento|movimentacao|historico|forma(?: de pagamento)?|pagamento|tipo|modalidade)$/;
const captions = allFields;
// Convert table columns to labelled observations, retaining the original cell coordinates.
// This adapter never sums money and never guesses an unknown financial column.
export function interpretTables(pages) {
  return pages.map((page) => {
    let header = null,
      mode = null;
    const lines = [];
    for (const row of page.lines || page.text.split(/\r?\n/).map((text,i) => ({text,line:i+1}))) {
      if (!row.cells || row.cells.length < 2) {
        lines.push(row);
        continue;
      }
      const nonempty = row.cells
        .map((c, i) => ({ ...c, index: i }))
        .filter((c) => c.text.trim() || c.unsafe);
      const norms = row.cells.map((c) => normalize(c.text));
      const valueColumn = norms.findIndex((n) => exactValueHeader.test(n));
      const labelColumn = norms.findIndex((n) => exactLabelHeader.test(n));
      const known = nonempty.filter((c) => Object.hasOwn(exactHeaders,normalize(c.text)) && exactHeaders[normalize(c.text)]);
      const hasValue = nonempty.some(
        (c) => c.numeric || /\d[,\.]\d{2}\b/.test(c.text),
      );
      if (!hasValue && valueColumn >= 0 && labelColumn >= 0) {
        header = { valueColumn, labelColumn, ignored: norms.flatMap((n,i) => /^(?:quantidade|qtd\.?|qtdade|numero|n[ºo])$/.test(n) ? [i] : []) };
        mode = "records";
        continue;
      }
      if (!hasValue && known.length >= 2 && known.length === nonempty.length) {
        header = row.cells;
        mode = "columns";
        continue;
      }
      const emit = (text, cells, extra = {}) =>
        lines.push({
          ...row,
          ...extra,
          text,
          originalText: row.text,
          cells,
          sheet: page.sheet,
        });
      if (mode === "columns" && hasValue) {
        row.cells.forEach((cell, i) => {
          const label = header[i]?.text,
            field = label && fieldFor(label);
          if (!cell.text.trim() && !cell.unsafe) return;
          if (!field) {
            emit(cell.text, [cell], { column: i + 1 });
            return;
          }
          const value =
            ["register", "shift"].includes(field) && cell.numeric
              ? String(cell.raw)
              : cell.text;
          emit(`${captions[field] || label}: ${value}`, [cell], {
            column: i + 1,
          });
        });
      } else if (
        mode === "records" &&
        hasValue &&
        row.cells[header.labelColumn]?.text.trim()
      ) {
        const label = row.cells[header.labelColumn],
          cell = row.cells[header.valueColumn];
        emit(
          `${label.text}: ${cell?.text || ""}`,
          [label, cell].filter(Boolean),
          { column: header.valueColumn + 1 },
        );
        // Additional nonempty financial columns are not silently discarded.
        row.cells.forEach((c, i) => {
          if (
            ![header.labelColumn, header.valueColumn].includes(i) &&
            !/^(?:quantidade|qtd\.?|qtdade|numero|n[ºo])$/.test(norms[i] || "") &&
            !header.ignored?.includes(i) && /\d,\d{2}\b/.test(c.text)
          )
            emit(c.text, [c], { column: i + 1 });
        });
      } else {
        // Label/value metadata, including numeric register identifiers.
        const first = nonempty[0],
          field = first && fieldFor(first.text);
        if (
          field &&
          nonempty.length === 2 &&
          ["register", "shift"].includes(field) &&
          nonempty[1].numeric
        )
          emit(`${first.text}: ${nonempty[1].raw}`, row.cells);
        else lines.push({ ...row, sheet: page.sheet });
      }
    }
    return { ...page, lines };
  });
}
