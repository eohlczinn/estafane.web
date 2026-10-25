import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import { groupDocuments } from "../shared/grouping.js";
import { closingReport } from "../src/services/report.js";

const context = (reference) =>
  `Mercado: Exemplo\nOperador(a): Ana Caixa: 07 Data: 24/10/2026\nTurno: Manha\nDocumento: ${reference}\n`;
const summary =
  "\n02 | RESUMO POR FORMA DE PAGAMENTO\nDinheiro: 0\nPIX: 600\nDebito: 0\nCredito: 0\nVale: 0\nOutros: 0\nTotal liquido de vendas: 600\nFundo inicial: 0\nSangrias: 0\nSuprimentos: 0\nDevolucoes em dinheiro: 0\nDinheiro contado: 0";
function document(
  id,
  amounts = [500, 100],
  reference = "TESTE-1",
  repeat = false,
) {
  const rows = amounts.map(
    (amount, i) => `08:0${i}\tA-${i + 1}\tPIX\t${amount}`,
  );
  if (repeat) rows.push(rows[0]);
  const text =
    context(reference) +
    "01 | CUPONS DE VENDA LIQUIDOS (CANCELAMENTOS JA DESCONTADOS)\nHORA\tOPERACAO\tFORMA\tVALOR\n" +
    rows.join("\n") +
    summary;
  const pages = [{ page: 1, text }];
  return {
    id,
    hash: id.repeat(64),
    filename: id === "a" ? "caixa.pdf" : "caixa.xlsx",
    status: "completed",
    pages,
    ...parsePages(pages, { documentId: id }),
  };
}
const valid = (closing) =>
  closing.transactions.filter((t) => !t.duplicateOf && t.status !== "conflict");

it("concilia a mesma venda em exportações de formatos diferentes sem dobrar cupons ou valores", () => {
  const docs = [document("a"), document("b")];
  const before = JSON.stringify(docs);
  const { closings, suggestions } = groupDocuments(docs);
  expect(closings).toHaveLength(1);
  expect(suggestions).toEqual([]);
  const closing = closings[0];
  expect(closing.audit.canConfirm).toBe(true);
  expect(valid(closing)).toHaveLength(2);
  expect(closing.transactions.filter((t) => t.duplicateOf)).toHaveLength(2);
  expect(closing.fields.pix.value).toBe(60000);
  expect(closing.fields.sales.value).toBe(60000);
  for (const t of closing.transactions.filter((t) => t.duplicateOf)) {
    const original = closing.transactions.find(
      (item) => item.id === t.duplicateOf,
    );
    expect(original.source.documentId).toBe("a");
    expect(t.source.documentId).toBe("b");
  }
  expect(
    closing.normalizationNotes.filter((n) => n.code === "duplicate_receipt"),
  ).toHaveLength(2);
  expect(closingReport(closing, {}).rows).toContainEqual([
    "Cupons",
    "2 válidos; 2 repetidos excluídos da soma",
  ]);
  expect(JSON.stringify(docs)).toBe(before);
});

it("bloqueia IDs de cupons contraditórios entre documentos mesmo quando os totais financeiros são iguais", () => {
  const { closings } = groupDocuments([
    document("a"),
    document("b", [400, 200]),
  ]);
  const closing = closings[0];
  expect(closing.fields.pix.value).toBe(60000);
  expect(closing.fields.sales.value).toBe(60000);
  expect(closing.audit.canConfirm).toBe(false);
  expect(closing.audit.status).toBe("conflict");
  expect(closing.mergeIssues).toHaveLength(2);
  expect(
    closing.mergeIssues.every(
      (i) => i.resolvable === false && i.sources.length === 2,
    ),
  ).toBe(true);
  expect(
    closing.transactions.every(
      (t) => t.status === "conflict" && !t.duplicateOf,
    ),
  ).toBe(true);
  expect(valid(closing)).toEqual([]);
});

it("restringe a identidade dos cupons ao fechamento, preservando o mesmo número em turnos diferentes", () => {
  const { closings, suggestions } = groupDocuments([
    document("a"),
    document("b", [400, 200], "TESTE-2"),
  ]);
  expect(closings).toHaveLength(2);
  expect(suggestions).toEqual([]);
  expect(
    closings.every((c) => c.audit.canConfirm && valid(c).length === 2),
  ).toBe(true);
  expect(closings.flatMap((c) => c.mergeIssues)).toEqual([]);
});

it("preserva repetições internas e a origem ao combinar uma cópia de outro documento", () => {
  const { closings } = groupDocuments([
    document("a", [500, 100], "TESTE-1", true),
    document("b"),
  ]);
  const closing = closings[0];
  expect(closing.transactions).toHaveLength(5);
  expect(valid(closing)).toHaveLength(2);
  expect(closing.transactions.filter((t) => t.duplicateOf)).toHaveLength(3);
  expect(closing.audit.canConfirm).toBe(true);
  expect(
    closing.normalizationNotes.filter((n) => n.code === "duplicate_receipt"),
  ).toHaveLength(3);
});
