import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import { reconcile } from "../shared/reconciliation.js";
const context =
  "Mercado: Exemplo\nOperador(a): Ana Caixa: 07 Data: 24/10/2026\nTurno: Manhã\n";
const table = (rows) =>
  "01 | CUPONS DE VENDA LIQUIDOS (CANCELAMENTOS JA DESCONTADOS)\nHORA\tOPERACAO\tFORMA\tVALOR\n" +
  rows.join("\n");
const parse = (text) => parsePages([{ page: 1, text }], { documentId: "test" });
it("extrai IDs e soma cupons sem tratar cada operação como um total contraditório", () => {
  const p = parse(
    context +
      table([
        "08:00\tA-1\tPIX\t500",
        "08:01\tA-2\tCREDITO\t600",
        "08:02\tA-3\tDEBITO\t100",
      ]),
  );
  expect(p.transactions).toHaveLength(3);
  expect(p.unparsedLines).toEqual([]);
  expect(p.fields.pix.value).toBe(50000);
  expect(p.fields.credit.value).toBe(60000);
  expect(p.fields.debit.value).toBe(10000);
  expect(p.fields.sales.value).toBe(120000);
  expect(p.fields.cash.value).toBeNull();
  expect(reconcile(p).canConfirm).toBe(false);
});
it("deduplica somente o ID idêntico com mesma forma e valor, preservando ambas as origens", () => {
  const p = parse(
    context +
      table([
        "08:00\tA-1\tPIX\t500,00",
        "08:01\tA-2\tPIX\t600,00",
        "08:00\tA-1\tPIX\t500,00",
      ]) +
      "\n02 | RESUMO POR FORMA DE PAGAMENTO\nPIX: 1.100,00\nTOTAL LIQUIDO DE VENDAS: 1.100,00",
  );
  expect(p.transactions).toHaveLength(3);
  expect(p.transactions.filter((t) => t.duplicateOf)).toHaveLength(1);
  expect(p.fields.pix.value).toBe(110000);
  expect(p.fields.sales.value).toBe(110000);
  const note = p.normalizationNotes.find((n) => n.code === "duplicate_receipt");
  expect(note.message).toContain("A-1");
  expect(note.source.line).not.toBe(note.originalSource.line);
});
it("não escolhe arbitrariamente um cupom contraditório ou uma forma desconhecida", () => {
  const conflict = parse(
    context + table(["08:00\tA-1\tPIX\t500", "08:01\tA-1\tPIX\t600"]),
  );
  expect(conflict.fields.pix.value).toBeNull();
  expect(
    conflict.extractionIssues.some((i) =>
      i.id.includes("transaction-conflict"),
    ),
  ).toBe(true);
  const unknown = parse(
    context + table(["08:00\tA-1\tMETODO INDEFINIDO\t500"]),
  );
  expect(unknown.fields.sales.value).toBeNull();
  expect(
    unknown.extractionIssues.some((i) => i.id.includes("transaction-unknown")),
  ).toBe(true);
});
it("compara resumo e detalhes; não altera um valor para fazer a soma fechar", () => {
  const p = parse(
    context +
      table(["08:00\tA-1\tPIX\t500"]) +
      "\n02 | RESUMO POR FORMA DE PAGAMENTO\nPIX 600\nTOTAL LIQUIDO DE VENDAS 600",
  );
  expect(p.fields.pix.value).toBe(60000);
  expect(p.fields.sales.value).toBe(60000);
  expect(reconcile(p).canConfirm).toBe(false);
  expect(
    p.extractionIssues.some((i) => i.id.includes("transaction-total")),
  ).toBe(true);
});
it("lê os três valores citados pelo usuário e informa soma parcial sem inventar dinheiro físico", () => {
  const p = parse("PIX foi 500, crédito 600; débito 100");
  expect(p.fields.pix.value).toBe(50000);
  expect(p.fields.credit.value).toBe(60000);
  expect(p.fields.debit.value).toBe(10000);
  expect(p.unparsedLines).toEqual([]);
  expect(reconcile(p).calculation).toMatchObject({
    knownPaymentsTotal: 120000,
    expected: null,
    difference: null,
  });
});
it("não perde silenciosamente um rótulo financeiro com número ambíguo", () => {
  const p = parse("PIX foi 500 ou 600");
  expect(p.fields.pix.value).toBeNull();
  expect(p.unparsedLines).toHaveLength(1);
});
it.each([
  "PIX foi 500 ou 600,00",
  "PIX foi 500,00 ou 600",
  "PIX previsto: 500,00",
  "Sangria estimada: 10,00",
])("mantém previsão ou alternativas pendentes: %s", (text) => {
  const p = parse(text);
  expect(p.fields.pix.value).toBeNull();
  expect(p.fields.withdrawals.value).toBeNull();
  expect(p.unparsedLines).toHaveLength(1);
  expect(p.unparsedLines[0].value).toBeNull();
  expect(reconcile(p).canConfirm).toBe(false);
});
it("mantém o resumo quando faltam cupons identificáveis, sem comparar uma soma parcial como total", () => {
  const p = parse(
    context +
      table(["08:00\tA-1\tPIX\t500", "08:01\tA-2\tMETODO INDEFINIDO\t600"]) +
      "\n02 | RESUMO POR FORMA DE PAGAMENTO\nPIX 1.100,00\nTOTAL LIQUIDO DE VENDAS 1.100,00",
  );
  expect(p.fields.pix.value).toBe(110000);
  expect(p.fields.sales.value).toBe(110000);
  expect(
    p.extractionIssues.some((i) => i.id.includes("transaction-unknown")),
  ).toBe(true);
  expect(
    p.extractionIssues.some((i) => i.id.includes("transaction-total")),
  ).toBe(false);
  expect(reconcile(p).canConfirm).toBe(false);
});
it("não atribui uma forma combinada inteira à primeira categoria reconhecida", () => {
  const p = parse(context + table(["08:00\tA-1\tPIX / DÉBITO\t500"]));
  expect(p.fields.pix.value).toBeNull();
  expect(p.fields.debit.value).toBeNull();
  expect(
    p.extractionIssues.some((i) => i.id.includes("transaction-unknown")),
  ).toBe(true);
});
it("não considera completa uma seção de pagamentos com valor inteiro sem forma conhecida", () => {
  const p = parse(
    context +
      "02 | RESUMO POR FORMA DE PAGAMENTO\nPIX 500\nMétodo XPTO 30\nTOTAL LIQUIDO DE VENDAS 500",
  );
  expect(p.fields.pix.value).toBe(50000);
  expect(p.fields.other.value).toBeNull();
  expect(p.extractionIssues.some((i) => i.id.includes("payment-unknown"))).toBe(
    true,
  );
  expect(reconcile(p).canConfirm).toBe(false);
});
it("encaminha linha de cupom malformada com inteiro à revisão em vez de completar uma soma parcial", () => {
  const p = parse(context + table(["08:00\tA-1\tPIX\t500", "??? PIX 600"]));
  expect(p.fields.pix.value).toBeNull();
  expect(p.fields.sales.value).toBeNull();
  expect(
    p.extractionIssues.some((i) => i.id.includes("transaction-unknown")),
  ).toBe(true);
});
