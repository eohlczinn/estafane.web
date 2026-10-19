import { spawn } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { jsPDF } from "jspdf";
const child = spawn(process.execPath, ["--watch", "server/index.js"], {
  cwd: process.cwd(),
  env: { ...process.env, PORT: "0" },
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"],
});
let output = "";
child.stdout.on("data", (data) => {
  output += data;
});
child.stderr.on("data", () => {});
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Backend não iniciou no prazo.")),
      15000,
    );
    function check() {
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0]);
      }
    }
    child.stdout.on("data", check);
    child.once("exit", () => {
      clearTimeout(timeout);
      reject(new Error("Backend encerrou antes de iniciar."));
    });
    check();
  });
  const doc = new jsPDF();
  doc.text(
    [
      "Mercado: TESTE FICTICIO",
      "Dinheiro: 100,00",
      "PIX: 20,00",
      "Total de vendas: 120,00",
    ],
    15,
    20,
  );
  for (let i = 0; i < 3; i++) {
    const form = new FormData();
    form.append(
      "pdf",
      new Blob([doc.output("arraybuffer")], { type: "application/pdf" }),
      "teste.pdf",
    );
    const res = await fetch(endpoint + "/api/fechamento/analisar", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.fields.cash.value, 10000);
    assert.equal(data.calculation.sales, 12000);
    assert.equal((await fetch(endpoint + "/api/health")).status, 200);
  }
  assert.equal(child.exitCode, null);
  console.log(
    "OK: backend node --watch permaneceu ativo após três uploads reais e health checks.",
  );
} finally {
  child.kill();
  await once(child, "exit");
}
