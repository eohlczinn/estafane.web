import { it, expect } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readTabular } from "../server/services/tabularReader.js";
import { splitTabularScopes } from "../server/services/tabularScopes.js";
import { parsePages } from "../server/services/pdfParser.js";
import { reconcile } from "../shared/reconciliation.js";
import { analyzePDF } from "../server/services/analyzeService.js";
import { workbookBytes, textBytes } from "./fixtures/documents.js";

const headers = ["Documento", "Estabelecimento", "Data", "Operadora", "Caixa", "Dinheiro", "PIX", "Fundo inicial", "Suprimentos", "Sangrias", "Devoluções em dinheiro", "Dinheiro contado"];
const records = [
  ["CX-001", "Mercado Fictício", "25/10/2026", "Estefane", 3, 500, 100, 100, 50, 200, 0, 440],
  ["CX-002", "Mercado Fictício", "25/10/2026", "Estefane", 3, 200, 120, 0, 0, 0, 0, 200],
];

async function pagesFor(rows, format = "xlsx", customize) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "estefane-wide-"));
  const target = path.join(directory, `input.${format}`);
  try {
    await fs.writeFile(target, format === "csv"
      ? Buffer.from(textBytes(";", rows))
      : workbookBytes(format, [{ name: "Fechamentos", rows }], customize));
    return await readTabular(target, format);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

it.each(["xlsx", "xls", "ods", "csv"])("separa duas linhas completas em %s, preserva referência e calcula sem somá-las", async (format) => {
  const pages = await pagesFor([headers, ...records], format);
  const { scopes } = splitTabularScopes(pages);
  expect(scopes).toHaveLength(2);
  const parsed = scopes.map((scope) => parsePages(scope.pages));
  expect(parsed.map((closing) => closing.identity.closingReference)).toEqual(["CX-001", "CX-002"]);
  expect(parsed.map((closing) => closing.fields.register.value)).toEqual(format === "csv" ? ["3,00", "3,00"] : ["3", "3"]);
  expect(parsed.map((closing) => closing.fields.cash.value)).toEqual([50000, 20000]);
  expect(parsed.map((closing) => reconcile(closing).calculation.difference)).toEqual([-1000, 0]);
  expect(parsed[0].fields.cash.source.cell).toBe("F2");
  expect(parsed[1].fields.cash.source.line).toBe(3);
  expect(scopes[0].label).toContain("linha 2");
});

it("aceita colunas reordenadas, repetição do cabeçalho e inteiros CSV apenas no campo financeiro", async () => {
  const order = [6, 4, 2, 10, 1, 0, 11, 3, 5, 9, 8, 7];
  const reorder = (row) => order.map((index) => String(row[index]));
  const rows = [reorder(headers), reorder(records[0]), reorder(headers), reorder(records[1])];
  const { scopes } = splitTabularScopes(await pagesFor(rows, "csv"));
  expect(scopes).toHaveLength(2);
  expect(scopes.map((scope) => parsePages(scope.pages).fields.pix.value)).toEqual([10000, 12000]);
  expect(scopes[1].pages[0].lines[0].line).toBe(4);
});

it("preserva os avisos de fórmula e linha oculta dentro da origem da linha separada", async () => {
  const pages = await pagesFor([headers, ...records], "xlsx", (book) => {
    book.Sheets.Fechamentos.F2 = { t: "n", v: 500, f: "SUM(300,200)" };
    book.Sheets.Fechamentos["!rows"] = [{}, { hidden: true }];
  });
  const { scopes } = splitTabularScopes(pages);
  const first = parsePages(scopes[0].pages);
  expect(first.fields.cash.value).toBe(50000);
  expect(first.fields.cash.source.hidden).toBe(true);
  expect(first.extractionIssues.some((issue) => /armazenado/.test(issue.message) && issue.source.cell === "F2")).toBe(true);
  expect(reconcile(first).canConfirm).toBe(false);
});

it("não promove cupons, itens de estoque ou registros parciais a fechamentos", async () => {
  const receipts = await pagesFor([["Hora", "Operação", "Forma", "Valor"], ["09:00", "C001", "PIX", 500], ["09:02", "C002", "PIX", 100]]);
  expect(splitTabularScopes(receipts).scopes).toEqual([]);
  const inventory = await pagesFor([["Produto", "Estoque inicial", "Entradas", "Saídas", "Contado"], ["Arroz", 20, 5, 8, 17], ["Feijão", 10, 2, 3, 9]]);
  expect(splitTabularScopes(inventory).scopes).toEqual([]);
  const incomplete = [headers, records[0], records[1].map((value, index) => index === 3 ? "" : value)];
  expect(splitTabularScopes(await pagesFor(incomplete)).scopes).toEqual([]);
});

it("não descarta rodapé financeiro, não separa identidade idêntica e mantém abas complementares intactas", async () => {
  expect(splitTabularScopes(await pagesFor([headers, ...records, ["Total geral", "", "", "", "", 700]])).scopes).toEqual([]);
  expect(splitTabularScopes(await pagesFor([headers, records[0], records[0]])).scopes).toEqual([]);
  const [page] = await pagesFor([headers, ...records]);
  expect(splitTabularScopes([page, { ...page, page: 2, sheet: "Complemento" }]).scopes).toEqual([]);
});

it("não transforma previsão financeira em recebimento realizado ao identificar um cabeçalho", async () => {
  const misleading = headers.map((header) => header === "PIX" ? "PIX previsto" : header);
  expect(splitTabularScopes(await pagesFor([misleading, ...records])).scopes).toEqual([]);
});

it.each(["xlsx", "csv"])("o processo real de análise separa %s sem criar um fechamento agregado extra", async (format) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "estefane-wide-worker-"));
  const target = path.join(directory, `input.${format}`);
  try {
    const rows = [headers, ...records];
    await fs.writeFile(target, format === "csv" ? Buffer.from(textBytes(";", rows)) : workbookBytes("xlsx", [{ name: "Fechamentos", rows }]));
    const result = await analyzePDF(target, { format, documentId: "wide-worker" });
    expect(result.parts).toHaveLength(2);
    expect(result.container).toBe(true);
    expect(result.fields.cash.value).toBeNull();
    expect(result.parts.map((part) => part.calculation.difference)).toEqual([-1000, 0]);
    expect(result.parts.map((part) => part.identity.closingReference)).toEqual(["CX-001", "CX-002"]);
    expect(result.parts.every((part) => part.partLabel.includes("linha"))).toBe(true);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}, 20000);
