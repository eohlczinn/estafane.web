import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import { groupDocuments, mergeDocuments } from "../shared/grouping.js";
import { summarizeBatch } from "../shared/batch.js";
import { reconcile } from "../shared/reconciliation.js";
import { ExecutionQueue } from "../server/services/executionQueue.js";
const header = (
  register = "01",
  operator = "Estefane",
  date = "19/10/2026",
  ref = "A",
) =>
  `Mercado: TESTE FICTICIO\nOperadora: ${operator}\nCaixa: ${register}\nData: ${date}\nID do fechamento: ${ref}\n`;
const money =
  "Total de vendas: 1.000,00\nDinheiro: 1.000,00\nFundo: 100,00\nSuprimento: 50,00\nSangria: 100,00\nDevoluções: 0,00\nDinheiro contado: 1.050,00";
const doc = (id, text) => ({
  id,
  filename: id + ".pdf",
  hash: id.repeat(64).slice(0, 64),
  status: "completed",
  ...parsePages([{ page: 1, text }], { documentId: id }),
  pages: [{ page: 1, text }],
});
it("três caixas permanecem separados e sem mistura de sangrias", () => {
  const ds = ["01", "02", "03"].map((r, i) => doc("abc"[i], header(r) + money));
  const { closings } = groupDocuments(ds);
  expect(closings).toHaveLength(3);
  expect(closings.every((c) => c.fields.withdrawals.value === 10000)).toBe(
    true,
  );
});
it("documentos complementares com referência confiável formam um fechamento", () => {
  const ds = [
    doc("a", header() + "Dinheiro: 1.000,00\nTotal de vendas: 1.000,00"),
    doc(
      "b",
      header() +
        "Fundo: 100,00\nSuprimento: 50,00\nSangria 01: 100,00\nDevoluções: 0,00",
    ),
    doc("c", header() + "Dinheiro contado: 1.050,00"),
  ];
  const { closings } = groupDocuments(ds);
  expect(closings).toHaveLength(1);
  expect(closings[0].calculation.difference).toBe(0);
  expect(closings[0].audit.canConfirm).toBe(true);
  expect(closings[0].fields.counted.source.documentId).toBe("c");
});
it.each([
  ["02", "Estefane", "19/10/2026"],
  ["01", "Ana", "19/10/2026"],
  ["01", "Estefane", "20/10/2026"],
])("separa caixa/operador/data incompatíveis %s %s %s", (r, o, d) => {
  expect(
    groupDocuments([
      doc("a", header() + money),
      doc("b", header(r, o, d) + money),
    ]).closings,
  ).toHaveLength(2);
});
it("nome de operadora sozinho não autoriza agrupamento ou consolidado", () => {
  const { closings, suggestions } = groupDocuments([
    doc("a", "Operadora: Estefane\n" + money),
    doc("b", "Operadora: Estefane\n" + money),
  ]);
  expect(closings).toHaveLength(2);
  expect(suggestions).toHaveLength(1);
  expect(closings.every((c) => !c.audit.canConfirm)).toBe(true);
});
it("sobreposição de operações identificadas não duplica itens nem totais", () => {
  const ds = [
    doc(
      "a",
      header() +
        "Sangria 01: 100,00\nSangria 02: 200,00\nTotal de sangrias: 300,00",
    ),
    doc(
      "b",
      header() +
        "Sangria 01: 100,00\nSangria 02: 200,00\nTotal de sangrias: 300,00",
    ),
  ];
  const c = groupDocuments(ds).closings[0];
  expect(c.fields.withdrawals.value).toBe(30000);
  expect(c.movements.filter((m) => m.duplicateOf)).toHaveLength(2);
});
it("mesma operação com valores diferentes bloqueia confirmação", () => {
  const c = mergeDocuments(
    [
      doc("a", header() + "Sangria 01: 100,00"),
      doc("b", header() + "Sangria 01: 200,00"),
    ],
    "c",
  );
  expect(c.audit.status).toBe("conflict");
});
it("itens sem IDs em documentos sobrepostos não são somados como validados", () => {
  const c = mergeDocuments(
    [doc("a", header() + money), doc("b", header() + money)],
    "c",
  );
  expect(c.mergeIssues.some((i) => i.id === "overlap:withdrawal")).toBe(true);
  expect(c.audit.canConfirm).toBe(false);
});
it("subtotais de subconjuntos de documentos conferem seu próprio escopo", () => {
  const c = mergeDocuments(
    [
      doc("a", header() + "Sangria 01: 100,00\nTotal de sangrias: 100,00"),
      doc("b", header() + "Sangria 02: 200,00\nTotal de sangrias: 200,00"),
    ],
    "c",
  );
  expect(c.fields.withdrawals.value).toBe(30000);
  expect(c.audit.issues.some((i) => i.id.startsWith("subtotal:"))).toBe(false);
});
it("falta e sobra são separadas e líquido só existe com todos validados", () => {
  const cs = groupDocuments([
    doc("a", header("01") + money.replace("1.050,00", "1.030,00")),
    doc("b", header("02") + money.replace("1.050,00", "1.060,00")),
  ]).closings;
  cs.forEach((c) => {
    c.confirmed = true;
    c.reviewed = true;
  });
  const s = summarizeBatch(cs);
  expect(s.totalShortCents).toBe(2000);
  expect(s.totalOverCents).toBe(1000);
  expect(s.netDifferenceCents).toBe(-1000);
  expect(s.balancedCount).toBe(0);
  cs[0].confirmed = false;
  const partial = summarizeBatch(cs);
  expect(partial.partial).toBe(true);
  expect(partial.netDifferenceCents).toBeNull();
  expect(partial.excludedClosingIds).toEqual([cs[0].id]);
});
it("ausência de contado continua pendente; preenchimento explícito reaudita", () => {
  const c = mergeDocuments(
    [doc("a", header() + money.replace("Dinheiro contado: 1.050,00", ""))],
    "c",
  );
  expect(c.calculation.difference).toBeNull();
  c.fields.counted = { value: 105000, status: "manual" };
  expect(reconcile(c, { reviewed: true }).status).toBe("validated");
});
it("fila limita concorrência e cancela tarefas que ainda aguardam", async () => {
  const q = new ExecutionQueue(1);
  const controller = new AbortController();
  let release,
    active = 0,
    peak = 0;
  const first = q.run(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => (release = r));
    active--;
    return 1;
  });
  await Promise.resolve();
  const second = q.run(() => 2, controller.signal);
  controller.abort();
  await expect(second).rejects.toMatchObject({ name: "AbortError" });
  release();
  expect(await first).toBe(1);
  expect(peak).toBe(1);
});
