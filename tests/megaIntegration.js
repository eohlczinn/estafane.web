import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { app } from "../server/app.js";
import { stopBatches } from "../server/services/batchAnalyzer.js";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
} from "../server/services/authService.js";
import { workbookBytes, fixtureRows } from "./fixtures/documents.js";

const expected = JSON.parse(
  await fs.readFile(
    new URL("./fixtures/mega/expected.json", import.meta.url),
    "utf8",
  ),
).closings;
const bytes = await fs.readFile(
  new URL("./fixtures/mega/mega-19-pages.pdf", import.meta.url),
);
const remote = process.env.DOCUMENT_TEST_URL;
const server = remote ? null : app.listen(0, "127.0.0.1");
if (server) await new Promise((resolve) => server.once("listening", resolve));
const url = remote || `http://127.0.0.1:${server.address().port}`;
let cookie = `${SESSION_COOKIE_NAME}=${createSessionToken({ username: "fixture" })}`;
if (remote) {
  const env = Object.fromEntries(
    (await fs.readFile(".env.railway", "utf8"))
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => [
        line.slice(0, line.indexOf("=")),
        line.slice(line.indexOf("=") + 1),
      ]),
  );
  const login = await fetch(url + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: url },
    body: JSON.stringify({
      username: "estefane",
      password: env.ESTEFANE_LOGIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  cookie = login.headers.get("set-cookie").split(";")[0];
}
const headers = { Cookie: cookie, Origin: url };
const single = async (name, content) => {
  const form = new FormData();
  form.append("pdf", new Blob([content]), name);
  const response = await fetch(url + "/api/fechamento/analisar", {
    method: "POST",
    headers,
    body: form,
    signal: AbortSignal.timeout(150000),
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
};
const batch = async (files) => {
  const form = new FormData();
  for (const [name, content] of files)
    form.append("pdfs", new Blob([content]), name);
  const started = await fetch(url + "/api/fechamento/analisar-lote", {
    method: "POST",
    headers,
    body: form,
  });
  assert.equal(started.status, 202);
  let data = await started.json();
  const deadline = Date.now() + 150000;
  while (data.status === "processing") {
    assert.ok(Date.now() < deadline, "Lote excedeu o tempo de análise");
    await new Promise((resolve) => setTimeout(resolve, 300));
    const response = await fetch(url + "/api/fechamento/lotes/" + data.id, {
      headers,
    });
    assert.equal(response.status, 200);
    data = await response.json();
  }
  return data;
};
function checkClosings(closings) {
  assert.equal(closings.length, 17);
  for (const reference of expected) {
    const closing = closings.find((item) =>
      item.pages.some((page) => page.page === reference.page),
    );
    assert.ok(closing, "Turno ausente: " + reference.reference);
    for (const [key, value] of Object.entries(reference.fields))
      assert.equal(
        closing.fields[key].value,
        value,
        reference.reference + ":" + key,
      );
    assert.equal(closing.calculation.expected, reference.expected);
    assert.equal(closing.calculation.difference, reference.difference);
    assert.equal(closing.unparsedLines.length, 0);
    assert.equal(
      closing.audit.canConfirm,
      reference.fields.counted != null && !reference.ocr,
    );
  }
  assert.equal(
    closings.reduce(
      (sum, closing) =>
        sum +
        closing.transactions.filter((transaction) => !transaction.duplicateOf)
          .length,
      0,
    ),
    357,
  );
  assert.equal(
    closings.reduce(
      (sum, closing) =>
        sum +
        closing.transactions.filter((transaction) => transaction.duplicateOf)
          .length,
      0,
    ),
    1,
  );
}
const stockRows = [
  ["ESTOQUE"],
  [
    "Produto",
    "Estoque inicial",
    "Entradas",
    "Saidas",
    "Estoque contado",
    "Unidade",
  ],
  ["Arroz", 10, 5, 3, 11, "un"],
];
try {
  const direct = await single("mega-19-paginas-ficticio.pdf", bytes);
  assert.equal(direct.container, true);
  assert.equal(direct.calculation.expected, null);
  assert.equal(direct.audit.canConfirm, false);
  assert.deepEqual(
    direct.contextPages.map((page) => page.page),
    [1, 19],
  );
  checkClosings(direct.parts);
  console.log(
    "OK: upload único do PDF de 19 páginas mantém 17 turnos, 357 cupons únicos, uma duplicata, duas contagens ausentes e revisão OCR.",
  );
  const grouped = await batch([["mega-19-paginas-ficticio.pdf", bytes]]);
  checkClosings(grouped.closings);
  assert.equal(grouped.documents.length, 17);
  assert.equal(grouped.sourceDocuments.length, 1);
  assert.equal(grouped.sourceDocuments[0].partCount, 17);
  assert.deepEqual(
    grouped.sourceDocuments[0].contextPages.map((page) => page.page),
    [1, 19],
  );
  assert.equal(grouped.suggestions.length, 0);
  console.log(
    "OK: API de lote conserva uma fonte e 17 fechamentos, sem duplicar o pai nem sugerir associação de turnos independentes.",
  );
  const stock = await single(
    "estoque-ficticio.xlsx",
    workbookBytes("xlsx", [{ name: "Estoque", rows: stockRows }]),
  );
  assert.equal(stock.documentKind, "inventory");
  assert.equal(stock.calculation.expected, null);
  assert.equal(stock.inventory.items[0].expected, 12);
  assert.equal(stock.inventory.items[0].difference, -1);
  const mixed = await batch([
    [
      "caixas-e-estoque-ficticio.xlsx",
      workbookBytes("xlsx", [
        { name: "Caixa03", rows: fixtureRows },
        {
          name: "Caixa04",
          rows: fixtureRows.map((row) =>
            row[0] === "Caixa" ? ["Caixa", "04"] : row,
          ),
        },
        { name: "Estoque", rows: stockRows },
      ]),
    ],
  ]);
  assert.equal(mixed.closings.length, 2);
  assert.ok(
    mixed.closings.every((closing) => closing.calculation.difference === -1350),
  );
  assert.equal(mixed.sourceDocuments[0].inventory.items.length, 1);
  assert.equal(mixed.sourceDocuments[0].inventory.items[0].difference, -1);
  assert.equal(
    mixed.sourceDocuments[0].contextPages[0].contextKind,
    "inventory",
  );
  console.log(
    "OK: estoque separado do dinheiro; planilha com dois caixas e estoque conserva duas conferências e falta de uma unidade.",
  );
  await fs.mkdir("tests/output", { recursive: true });
  await fs.writeFile(
    `tests/output/mega-${remote ? "render" : "local"}-proof.json`,
    JSON.stringify(
      {
        url,
        checkedAt: new Date().toISOString(),
        closings: grouped.closings.map((closing) => ({
          reference: closing.documents[0].identity.closingReference,
          expected: closing.calculation.expected,
          difference: closing.calculation.difference,
          canConfirm: closing.audit.canConfirm,
        })),
        uniqueReceipts: 357,
        duplicates: 1,
        missingCounts: 2,
        inventory: { expected: 12, difference: -1 },
        mixedWorkbookClosings: mixed.closings.length,
      },
      null,
      2,
    ),
  );
} finally {
  if (server) {
    await stopBatches();
    server.close();
  }
}
