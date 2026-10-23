import { describe, it, expect } from "vitest";
import { emptyFields } from "../shared/fields.js";
import { parseMoney } from "../shared/money.js";
import { calculate } from "../shared/calculation.js";
import { parsePages } from "../server/services/pdfParser.js";
const fields = (data) => {
  const f = emptyFields();
  for (const [k, v] of Object.entries(data)) f[k].value = v;
  return f;
};
const base = {
  cash: 10000,
  opening: 2000,
  withdrawals: 1000,
  supplies: 500,
  refunds: 200,
  counted: 11300,
  sales: 20000,
};
describe("Valores exatos em centavos", () => {
  it.each([
    ["1.234,56", 123456],
    ["-5,02", -502],
    ["0,01", 1],
    ["12,3", 1230],
    ["R$ 10,00", 1000],
    ["0", 0],
  ])("%s", (input, value) => expect(parseMoney(input)).toBe(value));
  it.each(["1.23", "1,234", "1e3", "NaN", "1.2.3,00", ""])(
    "rejeita formato %s sem arredondar",
    (v) => expect(() => parseMoney(v)).toThrow(),
  );
  it("soma centavos sem aproximação", () =>
    expect(parseMoney("0,10") + parseMoney("0,20")).toBe(30));
});
describe("Fechamento", () => {
  it.each([
    [11300, "balanced", 0],
    [11200, "short", -100],
    [11400, "over", 100],
  ])("contado %s", (counted, result, difference) => {
    const calc = calculate(fields({ ...base, counted }), { confirmed: true });
    expect(calc.expected).toBe(11300);
    expect(calc.result).toBe(result);
    expect(calc.difference).toBe(difference);
  });
  it("ausência não é zero", () =>
    expect(
      calculate(fields({ cash: 10000 }), { confirmed: true }).expected,
    ).toBeNull());
  it("regras devem ser confirmadas", () =>
    expect(calculate(fields(base)).result).toBe("pending"));
  it("cancelamentos e estornos são descontados só quando aplicável", () => {
    const f = fields({ ...base, cancellations: 100, reversals: 200 });
    expect(calculate(f, { confirmed: true }).expected).toBe(11300);
    expect(
      calculate(f, {
        confirmed: true,
        deductCancellations: true,
        deductReversals: true,
      }).expected,
    ).toBe(11000);
  });
  it("não desconta cancelamento duas vezes por padrão", () =>
    expect(
      calculate(fields({ ...base, cash: 9900, cancellations: 100 }), {
        confirmed: true,
      }).expected,
    ).toBe(11200));
  it("não soma cartões consolidados com detalhes", () => {
    const calc = calculate(
      fields({
        ...base,
        cash: 10000,
        pix: 2000,
        debit: 3000,
        credit: 4000,
        cards: 7000,
        other: 1000,
        voucher: 0,
      }),
      { confirmed: true },
    );
    expect(calc.paymentTotal).toBe(20000);
    expect(calc.sales).toBe(20000);
  });
  it("divergência bloqueia confirmação", () =>
    expect(
      calculate(
        fields({ ...base, pix: 0, debit: 0, credit: 0, other: 0, voucher: 0 }),
        { confirmed: true },
      ).result,
    ).toBe("pending"));
  it("não presume vale ausente como zero para derivar vendas e mantém cálculo do dinheiro independente", () => {
    const f = fields({
      ...base,
      sales: null,
      pix: 2000,
      debit: 3000,
      credit: 4000,
      other: 1000,
    });
    const incomplete = calculate(f, { confirmed: true });
    expect(incomplete.sales).toBeNull();
    expect(incomplete.pending).toContain("voucher");
    expect(incomplete.expected).toBe(11300);
    f.voucher.value = 0;
    expect(calculate(f, { confirmed: true }).sales).toBe(20000);
  });
  it("agregado negativo de movimentação exige correção", () =>
    expect(
      calculate(fields({ ...base, supplies: -500 }), { confirmed: true })
        .expected,
    ).toBeNull());
  it("inclui vale separado sem duplicar quando já está em Outros", () => {
    const f = fields({
      ...base,
      sales: 21000,
      pix: 2000,
      debit: 3000,
      credit: 4000,
      other: 1000,
      voucher: 1000,
    });
    expect(calculate(f, { confirmed: true }).paymentTotal).toBe(21000);
    f.other.value = 2000;
    expect(
      calculate(f, { confirmed: true, voucherIncludedInOther: true })
        .paymentTotal,
    ).toBe(21000);
  });
});
describe("Parser conservador", () => {
  it("lê rótulos brasileiros com origem e não soma subtotais", () => {
    const { fields: f } = parsePages([
      {
        page: 1,
        text: "Operadora: Estefane\nTotal de vendas: R$ 1.234,56\nDinheiro: 200,00\nSubtotal seção: 900,00\nPIX: 1.034,56",
      },
    ]);
    expect(f.sales.value).toBe(123456);
    expect(f.cash.value).toBe(20000);
    expect(f.cash.source.line).toBe(3);
    expect(f.operator.value).toBe("Estefane");
    expect(f.opening.value).toBeNull();
  });
  it("valores conflitantes ficam ambíguos", () => {
    const { fields: f } = parsePages([
      { page: 1, text: "Dinheiro: 10,00\nDinheiro: 20,00" },
    ]);
    expect(f.cash.value).toBeNull();
    expect(f.cash.status).toBe("ambiguous");
  });
  it("não escolhe valor em linha com várias colunas", () =>
    expect(
      parsePages([{ page: 1, text: "Dinheiro: 10,00 20,00" }]).fields.cash
        .value,
    ).toBeNull());
  it("reconhece sinônimos e contado separadamente", () => {
    const f = parsePages([
      {
        page: 1,
        text: "Espécie: 100,00\nRetirada: 5,00\nEntrada: 2,00\nDinheiro contado: 97,00",
      },
    ]).fields;
    expect(f.cash.value).toBe(10000);
    expect(f.counted.value).toBe(9700);
    expect(f.withdrawals.value).toBe(500);
    expect(f.supplies.value).toBe(200);
  });
  it("reconhece tabela numerada e vale-alimentação", () => {
    const { fields: f } = parsePages([
      {
        page: 1,
        text: "01 - DINHEIRO | 1.000,00\n02 PIX | 200,00\n03 - VALE-ALIMENTAÇÃO | 50,00",
      },
    ]);
    expect(f.cash.value).toBe(100000);
    expect(f.pix.value).toBe(20000);
    expect(f.voucher.value).toBe(5000);
    expect(f.voucher.source.profile).toBe("tabela-numerada");
  });
  it("extrai data ISO com horário e rejeita data inválida", () => {
    let f = parsePages([{ page: 1, text: "Data: 2026-10-19 14:30" }]).fields;
    expect(f.date.value).toBe("19/10/2026");
    expect(f.shift.value).toBe("14:30");
    f = parsePages([{ page: 1, text: "Data: 31/02/2026" }]).fields;
    expect(f.date.value).toBeNull();
  });
  it("preserva nomes compostos sem separador e com espaços repetidos", () => {
    const f = parsePages([
      {
        page: 1,
        text: "Supermercado Pingo De Ouro\nNome da operadora: Ana  Maria",
      },
    ]).fields;
    expect(f.market.value).toBe("Supermercado Pingo De Ouro");
    expect(f.operator.value).toBe("Ana  Maria");
  });
});
