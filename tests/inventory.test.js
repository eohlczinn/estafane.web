import { it, expect } from "vitest";
import {
  parseInventory,
  inventorySourceKey,
} from "../server/services/inventoryParser.js";
const page = (rows, extra = {}) => ({
  page: 1,
  ...extra,
  text: rows.map((row) => row.join("\t")).join("\n"),
  lines: rows.map((row, i) => ({
    line: i + 1,
    text: row.join("\t"),
    cells: row.map((text, j) => ({
      text: String(text),
      cell: String.fromCharCode(65 + j) + (i + 1),
    })),
  })),
});

it("calcula estoque e falta como quantidades, separado dos valores financeiros", () => {
  const input = page([
    ["ESTOQUE"],
    [
      "Produto",
      "Estoque inicial",
      "Entradas",
      "Saídas",
      "Estoque contado",
      "Unidade",
    ],
    ["Arroz", 10, 5, 3, 11, "un"],
    ["Feijão", 20, 0, 5, 15, "un"],
    ["FORMAS DE PAGAMENTO"],
    ["PIX", 500],
    ["CRÉDITO", 600],
  ]);
  const inventory = parseInventory([input], { documentId: "mixed" });
  expect(inventory.detected).toBe(true);
  expect(inventory.items).toHaveLength(2);
  expect(inventory.items[0]).toMatchObject({
    product: "Arroz",
    opening: 10,
    entries: 5,
    exits: 3,
    expected: 12,
    counted: 11,
    difference: -1,
    status: "short",
    unit: "un",
    source: { documentId: "mixed", page: 1, line: 3, cell: "A3" },
  });
  expect(inventory.items[1]).toMatchObject({
    expected: 15,
    difference: 0,
    status: "balanced",
  });
  expect(
    inventory.excludedSources.some((s) => s.line === 7 || s.line === 8),
  ).toBe(false);
  expect(inventorySourceKey(inventory.items[0].source)).toBe(":1:3");
});
it("reconhece colunas em outra ordem e conserva células de planilha como origem", () => {
  const result = parseInventory([
    page(
      [
        [
          "Unidade",
          "Saídas",
          "Produto",
          "Contagem",
          "Entradas",
          "Estoque inicial",
        ],
        ["kg", "2,125", "Farinha", "8,625", "0,250", "10,500"],
      ],
      { sheet: "Estoque" },
    ),
  ]);
  expect(result.items[0]).toMatchObject({
    product: "Farinha",
    unit: "kg",
    expected: 8.625,
    counted: 8.625,
    difference: 0,
    source: { sheet: "Estoque", cell: "C2" },
  });
  expect(result.items[0].sources.exits.cell).toBe("B2");
});
it("não inventa zero para entradas, saídas ou contagem ausentes", () => {
  const result = parseInventory([
    {
      page: 1,
      text: "ESTOQUE\nProduto\tEstoque inicial\tEntradas\tSaídas\tContagem\nArroz\t10\t\t3\t",
    },
  ]);
  expect(result.items[0]).toMatchObject({
    opening: 10,
    entries: null,
    exits: 3,
    expected: null,
    counted: null,
    difference: null,
    status: "review_required",
  });
  expect(result.items[0].issues).toHaveLength(2);
});
it("recusa moeda na contagem e não lê tabela de vendas como estoque", () => {
  const inventory = parseInventory([
    page([
      ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
      ["Arroz", 10, "R$ 5,00", 3, 11],
    ]),
  ]);
  expect(inventory.items[0].entries).toBeNull();
  expect(inventory.items[0].expected).toBeNull();
  expect(inventory.items[0].issues.join(" ")).toContain("monetário");
  const payments = parseInventory([
    page([
      ["Forma de pagamento", "Quantidade", "Valor"],
      ["PIX", 3, 500],
      ["Crédito", 2, 600],
    ]),
  ]);
  expect(payments).toMatchObject({
    detected: false,
    items: [],
    excludedSources: [],
  });
  const valuation = parseInventory([
    page([
      ["Produto", "Entradas (R$)", "Saídas (R$)"],
      ["Arroz", "500,00", "200,00"],
    ]),
  ]);
  expect(valuation.items).toEqual([]);
});
it("lê bloco com rótulos explícitos e compara esperado declarado com a fórmula", () => {
  const result = parseInventory([
    {
      page: 2,
      text: "CONTROLE DE ESTOQUE\nProduto: Arroz\nEstoque inicial: 10 un\nEntradas: 5 un\nSaídas: 3 un\nEstoque esperado: 13 un\nContagem: 11 un",
    },
  ]);
  expect(result.items[0]).toMatchObject({
    product: "Arroz",
    expected: 12,
    declaredExpected: 13,
    difference: -1,
    status: "review_required",
  });
  expect(result.items[0].issues.join(" ")).toContain("difere do cálculo");
});
it("continua tabela PDF entre páginas e interrompe em seção financeira ou aba distinta", () => {
  const p1 = page([
    ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
    ["Arroz", 10, 5, 3, 12],
  ]);
  const p2 = page([["Feijão", 10, 0, 1, 8]], { page: 2 });
  expect(parseInventory([p1, p2]).items).toHaveLength(2);
  expect(
    parseInventory([
      { ...p1, sheet: "Estoque1" },
      { ...p2, sheet: "Estoque2" },
    ]).items,
  ).toHaveLength(1);
});
it("mantém frações exatas e alerta sobre unidades incompatíveis ou fórmula insegura", () => {
  const data = page([
    ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
    ["Óleo", "0,100 l", "0,200 l", "0,100 l", "0,200 l"],
    ["Açúcar", "1 kg", "200 g", "0 kg", "1 kg"],
  ]);
  data.lines.push({
    line: 4,
    text: "Café\t10\t5\t3\t12",
    cells: [
      { text: "Café" },
      { text: "10" },
      { text: "5", unsafe: true },
      { text: "3" },
      { text: "12" },
    ],
  });
  const { items } = parseInventory([data]);
  expect(items[0]).toMatchObject({
    expected: 0.2,
    difference: 0,
    status: "balanced",
  });
  expect(items[1].issues.join(" ")).toContain("Unidades diferentes");
  expect(items[1]).toMatchObject({
    expected: null,
    difference: null,
    unit: null,
    incompatibleUnits: true,
  });
  expect(items[2].entries).toBeNull();
  expect(items[2].issues.join(" ")).toContain("fórmula");
});
it("separa totais e linhas sem produto, sem devolvê-los para a interpretação financeira", () => {
  const result = parseInventory([
    page([
      ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
      ["Arroz", 10, 5, 3, 12],
      ["TOTAL", 10, 5, 3, 12],
      ["", 20, 0, 2, 18],
    ]),
  ]);
  expect(result.items).toHaveLength(1);
  expect(result.totals).toHaveLength(1);
  expect(result.totals[0].values.counted).toBe(12);
  expect(result.excludedSources.map((s) => s.line)).toEqual([1, 2, 3, 4]);
  expect(result.issues[0].code).toBe("inventory:product");
});
it("preserva valor armazenado de fórmula e OCR como leitura pendente de conferência", () => {
  const p = page(
    [
      ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
      ["Arroz", 10, 5, 3, 12],
    ],
    { ocr: true },
  );
  p.lines[1].cells[2] = {
    text: "5",
    numeric: true,
    raw: 5,
    formula: true,
    cell: "C2",
  };
  const item = parseInventory([p]).items[0];
  expect(item).toMatchObject({
    entries: 5,
    expected: 12,
    difference: 0,
    status: "review_required",
  });
  expect(item.issues.join(" ")).toContain("fórmula armazenado");
  expect(item.issues.join(" ")).toContain("OCR");
  expect(item.sources.entries.formula).toBe(true);
});
it("interrompe tabela larga quando começam pares monetários sem um novo título", () => {
  const inventory = parseInventory([
    page([
      ["ESTOQUE"],
      ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
      ["Arroz", 10, 5, 3, 12],
      ["PIX", 500],
      ["Crédito", 600],
    ]),
  ]);
  expect(inventory.items.map((item) => item.product)).toEqual(["Arroz"]);
  expect(inventory.excludedSources.some((source) => source.line >= 4)).toBe(
    false,
  );
  // A complete stock row can legitimately have a product whose name is PIX.
  const full = parseInventory([
    page([
      ["Produto", "Estoque inicial", "Entradas", "Saídas", "Contagem"],
      ["PIX", 10, 5, 3, 12],
    ]),
  ]);
  expect(full.items[0]).toMatchObject({ product: "PIX", expected: 12 });
});
