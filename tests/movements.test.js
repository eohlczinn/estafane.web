import { it, expect } from "vitest";
import { parsePages } from "../server/services/pdfParser.js";
import { calculate } from "../shared/calculation.js";
import { reconcile } from "../shared/reconciliation.js";
const parse = (text) => parsePages([{ page: 1, text }]);
const identity =
  "Mercado: TESTE FICTICIO\nOperadora: Estefane\nCaixa: 03\nData: 19/10/2026\n";
it("separa itens de sangria e subtotal e calcula o exemplo obrigatório", () => {
  const p = parse(
    identity +
      "Total de vendas: 1.280,75\nFundo inicial: 200,00\nVendas em dinheiro: 1.280,75\nSuprimento: 150,00\nSangria 01: 400,00\nSangria 02: 500,00\nTotal de sangrias: 900,00\nDevoluções: 0,00\nDinheiro contado: 717,25",
  );
  expect(
    p.movements
      .filter((m) => m.type === "withdrawal")
      .map((m) => m.amountCents),
  ).toEqual([40000, 50000]);
  expect(p.fields.withdrawals.value).toBe(90000);
  const c = calculate(p.fields, p.rules);
  expect(c.expected).toBe(73075);
  expect(c.difference).toBe(-1350);
  expect(c.result).toBe("short");
  expect(reconcile(p, { reviewed: true }).status).toBe("validated");
});
it("normaliza sinal negativo de sangria sem inverter a saída", () => {
  const p = parse("Sangria 01: - R$ 100,00\nSangria 02: R$ -200,00");
  expect(p.fields.withdrawals.value).toBe(30000);
  expect(
    p.movements.every((m) => m.direction === "out" && m.amountCents > 0),
  ).toBe(true);
});
it("não considera saída genérica uma sangria e bloqueia linha desconhecida", () => {
  const p = parse("Saída: R$ 100,00");
  expect(p.movements).toHaveLength(0);
  expect(p.unparsedLines).toHaveLength(1);
});
it("não soma subtotal e identifica divergência real", () => {
  const p = parse(
    identity + "Sangria 01: 100,00\nSangria 02: 200,00\nTotal: 310,00",
  );
  expect(p.fields.withdrawals.value).toBe(30000);
  expect(reconcile(p).issues.some((i) => i.code.startsWith("subtotal:"))).toBe(
    true,
  );
});
it("colunas de cabeçalho mantêm associações e posições", () => {
  const p = parsePages([
    {
      page: 1,
      text: "",
      lines: [
        {
          line: 1,
          text: "Operadora: Estefane\tCaixa: 03",
          bounds: { x: 1, y: 2, width: 3, height: 4 },
        },
      ],
    },
  ]);
  expect(p.fields.operator.value).toBe("Estefane");
  expect(p.fields.register.value).toBe("03");
  expect(p.fields.register.source.bounds.x).toBe(1);
});
it("saldo líquido em dinheiro não sofre novo desconto de sangria", () => {
  const p = parse(
    identity +
      "Total de vendas: 1.000,00\nSaldo líquido em dinheiro: 800,00\nSangria: 200,00\nDinheiro contado: 800,00",
  );
  expect(calculate(p.fields, p.rules).expected).toBe(80000);
  expect(calculate(p.fields, p.rules).result).toBe("balanced");
});
it("cancelamentos incluídos não são descontados e regra desconhecida exige esclarecimento", () => {
  let p = parse("Cancelamentos já descontados no total líquido: 50,00");
  expect(p.rules.cancellationTreatment).toBe("included");
  p = parse("Cancelamentos: 50,00");
  expect(
    calculate(p.fields, p.rules).warnings.some((w) => w.includes("Esclareça")),
  ).toBe(true);
});
it("pagamentos parciais já maiores que as vendas impedem validar", () => {
  const p = parse("Dinheiro: 200,00\nTotal de vendas: 100,00");
  expect(
    calculate(p.fields, p.rules).warnings.some((w) => w.includes("excedem")),
  ).toBe(true);
});
