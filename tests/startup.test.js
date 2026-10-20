import { it, expect } from "vitest";
import { spawn } from "node:child_process";
import http from "node:http";
it("porta ocupada encerra com mensagem clara sem acessar address nulo", async () => {
  const occupied = http.createServer();
  await new Promise((resolve) => occupied.listen(0, "127.0.0.1", resolve));
  try {
    const child = spawn(process.execPath, ["server/index.js"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(occupied.address().port),
        HOST: "127.0.0.1",
      },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (b) => (output += b));
    child.stderr.on("data", (b) => (output += b));
    const code = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill();
        reject(Error("Servidor não encerrou após conflito de porta."));
      }, 15000);
      child.once("exit", (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      child.once("error", reject);
    });
    expect(code).toBe(1);
    expect(output).toContain("já está em uso");
    expect(output).not.toContain("TypeError");
  } finally {
    await new Promise((resolve) => occupied.close(resolve));
  }
}, 20000);
