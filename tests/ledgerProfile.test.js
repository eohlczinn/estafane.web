import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import { reconcile } from "../shared/reconciliation.js";
const fixture = readFileSync(new URL("./fixtures/extrato-ficticio.txt", import.meta.url), "utf8");
const parse = (text = fixture) => parsePages([{ page: 1, text }]);

it("lê as colunas sem dois-pontos e calcula a falta do extrato fictício enviado", () => {
  const p = parse(), audit = reconcile(p, { reviewed: true });
  expect(p.fields.market.value).toBe("Mercado Exemplo (fictício)");
  expect(p.fields.operator.value).toBe("Estefane");
  expect(p.fields.register.value).toBe("03");
  expect(p.fields.date.value).toBe("18/10/2026");
  expect(p.fields.shift.value).toBe("14:00 às 22:00");
  expect(p.fields.sales.value).toBe(699965);
  expect(p.fields.cash.sources).toHaveLength(2);
  expect(p.fields.withdrawals.value).toBe(90000);
  expect(p.fields.refunds.status).toBe("derived");
  expect(p.fields.refunds.source.text).toContain("MOVIMENTAÇÕES");
  expect(p.rules.cancellationTreatment).toBe("included");
  expect(p.unparsedLines).toEqual([]);
  expect(p.warnings).toEqual([]);
  expect(audit.status).toBe("validated");
  expect(audit.calculation).toMatchObject({ expected: 73075, difference: -1350, result: "short" });
});
it("calcula outros valores sem fixar o resultado do exemplo", () => {
  const p = parse(fixture.replace("R$ 717,25", "R$ 750,75").replace("R$ 500,00", "R$ 490,00"));
  expect(reconcile(p).calculation).toMatchObject({ expected: 74075, difference: 1000, result: "over" });
});
it("não presume devolução zero sem extrato delimitado ou com saída desconhecida", () => {
  for (const text of [fixture.replace("03 | CONFERÊNCIA INFORMADA PELA OPERADORA", "Conferência"),
    fixture.replace("Sangria 02 - recolhimento", "Saída especial"),
    fixture.replace("03 | CONFERÊNCIA", "Saída especial\tSaída\tR$ 40\n03 | CONFERÊNCIA")]) {
    expect(parse(text).fields.refunds.value).toBeNull();
  }
  expect(parse("Dinheiro: 1.000,00\nDinheiro contado: 900,00").fields.refunds.value).toBeNull();
});
it("não descarta venda bruta que diverge da conciliação líquida", () => {
  const p = parse(fixture.replace("R$ 7.179,65", "R$ 7.180,65"));
  expect(p.unparsedLines.some((l) => l.text.startsWith("Vendas brutas"))).toBe(true);
  expect(reconcile(p).canConfirm).toBe(false);
});
it("não assume cancelamento incluído sem evidência explícita", () => {
  const p = parse(fixture.replace("(cancelamentos já descontados)", "(resumo)"));
  expect(p.rules.cancellationTreatment).toBeNull();
  expect(reconcile(p).canConfirm).toBe(false);
});
it("preserva cabeçalhos em linha com separadores e não troca saída explícita por cancelamento incluído", () => {
  const metadata = parse("Operadora: Estefane Caixa:03 Data:18/10/2026");
  expect(metadata.fields.operator.value).toBe("Estefane");
  expect(metadata.fields.register.value).toBe("03");
  expect(metadata.fields.date.value).toBe("18/10/2026");
  expect(parse(fixture + "\nMercado: Outro estabelecimento").fields.market.status).toBe("ambiguous");
  const p = parse(fixture.replace("Cancelamentos (2 operações)", "Cancelamentos saída em dinheiro"));
  expect(p.rules.cancellationTreatment).toBe("cash_out");
  expect(reconcile(p).canConfirm).toBe(false);
});
