#!/usr/bin/env node
import { hashPassword } from "../services/authService.js";

const password = process.argv[2];

if (!password) {
  console.log("Uso: node server/scripts/hashPassword.js <senha>");
  console.log("Exemplo: node server/scripts/hashPassword.js MinhaSenhaSuperSegura2026");
  process.exit(1);
}

const hash = hashPassword(password);
console.log("\n=======================================================");
console.log("Hash gerado com sucesso para uso no Railway:");
console.log("=======================================================");
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
console.log("=======================================================\n");

