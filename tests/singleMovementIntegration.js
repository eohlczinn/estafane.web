import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { jsPDF } from "jspdf";
import { app } from "../server/app.js";
const server = app.listen(0, "127.0.0.1");
await new Promise((r) => server.once("listening", r));
try {
  const doc = new jsPDF();
  doc.setFontSize(11);
  doc.text(
    [
      "DOCUMENTO FICTICIO PARA TESTE",
      "Mercado: TESTE FICTICIO",
      "Operadora: Estefane",
      "Caixa: 03",
      "Data: 19/10/2026",
      "Fundo inicial: 200,00",
      "Vendas em dinheiro: 1.280,75",
      "Total de vendas: 1.280,75",
      "Suprimento: 150,00",
      "Sangria 01: - R$ 400,00",
      "Sangria 02: R$ 500,00",
      "Total de sangrias: 900,00",
      "Devolucoes: 0,00",
      "Dinheiro contado: 717,25",
    ],
    15,
    20,
  );
  await fs.mkdir("tests/output", { recursive: true });
  await fs.writeFile(
    "tests/output/sangrias-ficticio.pdf",
    Buffer.from(doc.output("arraybuffer")),
  );
  const form = new FormData();
  form.append(
    "pdf",
    new Blob([doc.output("arraybuffer")], { type: "application/pdf" }),
    "sangrias-ficticio.pdf",
  );
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/fechamento/analisar`,
    { method: "POST", body: form },
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  const actual = {
    opening: data.fields.opening.value,
    cash: data.fields.cash.value,
    supplies: data.fields.supplies.value,
    withdrawals: data.movements
      .filter((m) => m.type === "withdrawal")
      .map((m) => m.amountCents),
    total: data.fields.withdrawals.value,
    expected: data.calculation.expected,
    counted: data.fields.counted.value,
    difference: data.calculation.difference,
    result: data.calculation.result,
  };
  assert.deepEqual(actual, {
    opening: 20000,
    cash: 128075,
    supplies: 15000,
    withdrawals: [40000, 50000],
    total: 90000,
    expected: 73075,
    counted: 71725,
    difference: -1350,
    result: "short",
  });
  await fs.writeFile(
    "tests/output/sangrias-extraidas.json",
    JSON.stringify(actual, null, 2),
  );
  console.log(
    "OK: PDF fictício real → upload → extração de cada sangria → esperado 73075 → falta 1350 centavos.",
  );
} finally {
  server.close();
}
