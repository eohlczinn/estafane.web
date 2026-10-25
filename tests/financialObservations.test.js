import { it, expect } from "vitest";
import {
  extractFinanceValue,
  financialAmountTokens,
  splitFinancialPairs,
  monetaryCell,
} from "../server/services/financialObservations.js";
import {
  moneyRules,
  infoRules,
  normalize,
} from "../server/services/parserRules.js";
import {
  extractMovements,
  moneyTokens,
} from "../server/services/movementExtractor.js";
import { interpretTables } from "../server/services/tableInterpreter.js";
import { reconcilePaymentSection } from "../server/services/paymentProfile.js";
import { emptyFields } from "../shared/fields.js";

it.each([
  ["PIX foi 500", "pix", 50000],
  ["PIX deu 1.500", "pix", 150000],
  ["Crédito totalizou 600", "credit", 60000],
  ["Débito: 100", "debit", 10000],
  ["  Cartão   de crédito foi R$ 500", "credit", 50000],
  ["Contagem física: 452,05", "counted", 45205],
  ["Contagem: 500", "counted", 50000],
  ["DINHEIRO CONTADO PELA OPERADORA 1.218,85", "counted", 121885],
  ["TOTAL LIQUIDO DE VENDAS 2.891,10", "sales", 289110],
  ["VALE 463,30", "voucher", 46330],
  ["Vendas liquidas em dinheiro 983,85", "cash", 98385],
  ["Fundo de troco inicial 280", "opening", 28000],
])("lê montante contextual em %s", (text, field, value) => {
  expect(moneyRules[field].test(normalize(text))).toBe(true);
  expect(
    financialAmountTokens(text, { labelPattern: moneyRules[field] }),
  ).toHaveLength(1);
  expect(
    financialAmountTokens(text, { labelPattern: moneyRules[field] })[0].value,
  ).toBe(value);
  if (field === "cash")
    expect(moneyRules.sales.test(normalize(text))).toBe(false);
});

it("mantém offsets originais mesmo com acentos e espaços repetidos", () => {
  const text = "  Cartão   de crédito foi R$ 500";
  const [token] = financialAmountTokens(text, {
    labelPattern: moneyRules.credit,
  });
  expect(text.slice(token.index, token.index + token.text.length)).toBe(
    "R$ 500",
  );
  expect(infoRules.operator.exec(normalize("OPERADOR(A): ESTEFANE"))[1]).toBe(
    "estefane",
  );
});

it("separa pares financeiros na mesma linha sem perder texto anterior ou IDs", () => {
  expect(
    splitFinancialPairs(
      "DINHEIRO: R$ 983,85 PIX: R$ 147,00 DEBITO:R$751,15",
    ).map((s) => s.text),
  ).toEqual(["DINHEIRO: R$ 983,85", "PIX: R$ 147,00", "DEBITO:R$751,15"]);
  expect(
    splitFinancialPairs("PIX foi 500, crédito 600; débito 100").map(
      (s) => s.text,
    ),
  ).toEqual(["PIX foi 500", "crédito 600", "débito 100"]);
  expect(
    splitFinancialPairs("CREDITO: R$ 545,80 VALE: R$ 463,30").map(
      (s) => s.text,
    ),
  ).toEqual(["CREDITO: R$ 545,80", "VALE: R$ 463,30"]);
  const prefix = splitFinancialPairs("Operadora: Ana | PIX 500 Débito 100");
  expect(prefix.map((s) => s.text)).toEqual([
    "Operadora: Ana",
    "PIX 500",
    "Débito 100",
  ]);
  const transaction = "07:00 CX01-001 PIX R$ 500,00";
  expect(splitFinancialPairs(transaction)).toEqual([
    { text: transaction, start: 0, end: transaction.length },
  ]);
  expect(
    splitFinancialPairs(
      "DINHEIRO:\tR$759,00 PIX:\tR$910,30 —DEBITO:\tR$ 576,35",
    ).map((s) => s.text),
  ).toEqual(["DINHEIRO:\tR$759,00", "PIX:\tR$910,30", "DEBITO:\tR$ 576,35"]);
});

it("não transforma números ambíguos, unidades de estoque, datas ou IDs em montantes", () => {
  for (const text of [
    "500 600",
    "500 unidades",
    "22/10/2026",
    "CX01-001",
    "Quantidade 500",
    "1.234.56",
    "1.000.000.000.000",
  ])
    expect(extractFinanceValue(text), text).toEqual([]);
  expect(moneyTokens("Operacao 21, quantidade 500, estoque 600")).toEqual([]);
  expect(monetaryCell("500")).toBe(true);
  expect(monetaryCell("500 unidades")).toBe(false);
  expect(extractFinanceValue("foi de 500")[0].value).toBe(50000);
});

it("usa a coluna de valor em tabelas textuais com inteiros, sem pegar a quantidade", () => {
  const page = {
    page: 1,
    text: "Forma de pagamento\tQuantidade\tValor\nPIX\t3\t500\nCrédito\t99\t600\nDébito\t100\t100",
  };
  const [result] = interpretTables([page]);
  expect(result.lines.map((l) => l.text)).toEqual([
    "PIX: 500",
    "Crédito: 600",
    "Débito: 100",
  ]);
  const values = result.lines.map((line) => {
    const pattern = Object.values(moneyRules).find((r) =>
      r.test(normalize(line.text)),
    );
    return financialAmountTokens(line.text, { labelPattern: pattern })[0].value;
  });
  expect(values).toEqual([50000, 60000, 10000]);
});

it("preserva cupons com horário, operação e forma para reconciliação por identificador", () => {
  const raw = "07:00\tCX01-001\tPIX\t500";
  const [result] = interpretTables([
    { page: 1, text: "HORA\tOPERACAO\tFORMA\tVALOR\n" + raw },
  ]);
  expect(result.lines[0].transactionHeader).toBe(true);
  expect(result.lines[1].text).toBe(raw);
  expect(result.lines[1].section).toBe("transactions");
  expect(result.lines[1].text).not.toBe("PIX: 500");
});

it("reconhece movimentos inteiros mantendo ID, direção e origem", () => {
  const lines = [
    "Fundo de troco inicial 280",
    "Suprimento 01 - Entrada 90",
    "Sangria 01 - Saida - 15",
    "Sangria 02: 1.500",
  ].map((text, i) => ({ id: String(i), line: i + 1, page: 1, text }));
  const p = extractMovements(lines, "fixture");
  expect(p.declarations[0]).toMatchObject({ field: "opening", value: 28000 });
  expect(
    p.movements.map((m) => [m.type, m.amountCents, m.operationId, m.direction]),
  ).toEqual([
    ["supply", 9000, "01", "in"],
    ["withdrawal", 1500, "01", "out"],
    ["withdrawal", 150000, "02", "out"],
  ]);
  expect(p.movements[2].source.text).toBe("Sangria 02: 1.500");
});

it("a conciliação da tabela de pagamentos também considera valores inteiros", () => {
  const fields = emptyFields();
  for (const [k, v] of Object.entries({
    cash: 50000,
    pix: 60000,
    debit: 10000,
    sales: 120000,
  }))
    fields[k].value = v;
  const lines = [
    "Dinheiro: 500",
    "PIX: 600",
    "Débito: 100",
    "Total de vendas: 1.200",
  ].map((text, i) => ({ text, line: i + 1, page: 1, section: "payments" }));
  const issues = [];
  reconcilePaymentSection({
    lines,
    fields,
    extractionIssues: issues,
    documentId: "fixture",
    assign: (k, value, source) => {
      fields[k] = { value, source };
    },
  });
  expect(issues).toEqual([]);
  expect(fields.other.value).toBe(0);
});
