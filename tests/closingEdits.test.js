import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import {
  mergeDocuments,
  groupDocuments,
  resolveGroupingDecision,
} from "../shared/grouping.js";
import { editField, editMovement } from "../shared/closingEdits.js";
import { reconcile } from "../shared/reconciliation.js";
import { summarizeBatch } from "../shared/batch.js";
const text =
  "Mercado: TESTE\nOperadora: Estefane\nCaixa: 01\nData: 19/10/2026\nDinheiro: 100,00\nTotal de vendas: 100,00\nFundo: 0,00\nSangria 01: 10,00\nSuprimento: 0,00\nDevoluções: 0,00\nContado: 90,00";
const doc = (id) => ({
  id,
  filename: id + ".pdf",
  status: "completed",
  hash: id.repeat(64),
  ...parsePages(
    [{ page: 1, text: text.replace("Contado:", "Dinheiro contado:") }],
    { documentId: id },
  ),
  pages: [{ page: 1, text }],
});
it("correção preserva valor anterior, reaudita e invalida confirmação e consolidado", () => {
  let c = mergeDocuments([doc("a")], "c");
  c.confirmed = true;
  c.reviewed = true;
  expect(summarizeBatch([c]).validatedCount).toBe(1);
  c = editField(c, "counted", 8800);
  expect(c.fields.counted.history[0].previous).toBe(9000);
  expect(c.confirmed).toBe(false);
  expect(reconcile(c).calculation.difference).toBe(-200);
  expect(summarizeBatch([c]).netDifferenceCents).toBeNull();
});
it("editar/excluir item recalcula agregado com histórico sem editar origem", () => {
  let c = mergeDocuments([doc("a")], "c");
  const m = c.movements.find((m) => m.type === "withdrawal");
  c = editMovement(c, m.id, 2000);
  expect(c.fields.withdrawals.value).toBe(2000);
  expect(reconcile(c).calculation.expected).toBe(8000);
  expect(c.movements.find((x) => x.id === m.id).source.text).toContain("10,00");
  c = editMovement(c, m.id, 2000, true);
  expect(c.fields.withdrawals.value).toBe(0);
  expect(reconcile(c).calculation.expected).toBe(10000);
});
it("decisões de agrupamento em três documentos não deixam associações órfãs", () => {
  let batch = {
    documents: ["a", "b", "c"].map(doc),
    ...groupDocuments(["a", "b", "c"].map(doc)),
  };
  expect(batch.suggestions).toHaveLength(3);
  batch = resolveGroupingDecision(batch, batch.suggestions[0], true);
  expect(batch.closings).toHaveLength(2);
  expect(batch.suggestions).toHaveLength(1);
  batch = resolveGroupingDecision(batch, batch.suggestions[0], true);
  expect(batch.closings).toHaveLength(1);
  expect(batch.suggestions).toHaveLength(0);
  expect(
    batch.closings[0].mergeIssues.some((i) => i.id.startsWith("group:")),
  ).toBe(false);
});
it("não descarta correção quando usuário tenta reagrupar", () => {
  const ds = ["a", "b"].map(doc),
    b = { documents: ds, ...groupDocuments(ds) };
  b.closings[0] = editField(b.closings[0], "counted", 8800);
  expect(() => resolveGroupingDecision(b, b.suggestions[0], true)).toThrow(
    "antes das correções",
  );
});
