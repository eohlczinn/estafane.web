import { randomBytes, createHmac, scryptSync, timingSafeEqual, createHash } from "node:crypto";

export const SESSION_COOKIE_NAME = "estefane_session";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 dias

// Segredo da sessão: persistente via env ou gerado em memória para o ciclo do processo
const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");


/**
 * Cria hash seguro scrypt para uma senha.
 */
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  if (typeof password !== "string" || !password) {
    throw new Error("Senha inválida para geração de hash.");
  }
  const key = scryptSync(password, salt, 64);
  return `scrypt:${salt}:${key.toString("hex")}`;
}

/**
 * Verifica uma senha contra um hash scrypt ou string de ambiente.
 */
export function verifyPassword(password, storedHashOrPlain) {
  if (typeof password !== "string" || !password || !storedHashOrPlain) {
    return false;
  }

  if (typeof storedHashOrPlain === "string" && storedHashOrPlain.startsWith("scrypt:")) {
    const parts = storedHashOrPlain.split(":");
    if (parts.length !== 3) return false;
    const [, salt, expectedHex] = parts;
    const derived = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, "hex");
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  }

  // Comparação segura de senha plana (quando definida diretamente via ADMIN_PASSWORD)
  const passBuf = createHash("sha256").update(password).digest();
  const expBuf = createHash("sha256").update(storedHashOrPlain).digest();
  return timingSafeEqual(passBuf, expBuf);
}

/**
 * Valida credenciais do usuário.
 */
export function checkCredentials(username, password) {
  if (!username || !password || typeof username !== "string" || typeof password !== "string") {
    return { ok: false, error: "Preencha usuário e senha." };
  }

  const expectedUser = (
    process.env.ADMIN_USERNAME ||
    process.env.AUTH_USERNAME ||
    "estefane"
  ).trim().toLowerCase();

  const suppliedUser = username.trim().toLowerCase();
  if (suppliedUser !== expectedUser) {
    return { ok: false, error: "Usuário ou senha incorretos." };
  }

  const configuredHash = process.env.ADMIN_PASSWORD_HASH || process.env.AUTH_PASSWORD_HASH;
  const configuredPlain = process.env.ADMIN_PASSWORD || process.env.AUTH_PASSWORD;

  if (configuredHash) {
    if (!verifyPassword(password, configuredHash.trim())) {
      return { ok: false, error: "Usuário ou senha incorretos." };
    }
  } else if (configuredPlain) {
    if (!verifyPassword(password, configuredPlain.trim())) {
      return { ok: false, error: "Usuário ou senha incorretos." };
    }
  } else {
    // Ambiente local de desenvolvimento: senha padrão com aviso no terminal
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[Segurança] Nenhuma senha de administrador configurada! Defina ADMIN_PASSWORD ou ADMIN_PASSWORD_HASH no Railway.",
      );
      return { ok: false, error: "Autenticação não configurada no servidor de produção." };
    }
    // Senha padrão apenas para desenvolvimento local
    if (password !== "estefane123") {
      return { ok: false, error: "Usuário ou senha incorretos." };
    }
  }

  return {
    ok: true,
    user: {
      username: "estefane",
      name: "Estefane",
      role: "Operadora de caixa",
    },
  };
}

/**
 * Gera token assinado com HMAC-SHA256 para sessão por cookie.
 */
export function createSessionToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.username,
    name: user.name || "Estefane",
    role: user.role || "Operadora de caixa",
    iat: now,
    exp: now + SESSION_DURATION_SECONDS,
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", sessionSecret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Valida token de sessão e retorna dados do usuário ou null.
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== "string") return null;

  const dotIdx = token.indexOf(".");
  if (dotIdx === -1) return null;

  const payloadB64 = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const expectedSig = createHmac("sha256", sessionSecret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

/**
 * Analisa cabeçalho Cookie em objeto chave-valor.
 */
export function parseCookies(header = "") {
  const cookies = {};
  if (!header || typeof header !== "string") return cookies;

  const parts = header.split(";");
  for (const part of parts) {
    const equalIdx = part.indexOf("=");
    if (equalIdx > 0) {
      const key = part.slice(0, equalIdx).trim();
      const val = part.slice(equalIdx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(val);
      } catch {
        cookies[key] = val;
      }
    }
  }
  return cookies;
}

/**
 * Cria cabeçalho Set-Cookie para sessão segura.
 */
export function buildSessionCookie(token, isSecure = false) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_DURATION_SECONDS}`,
  ];
  if (isSecure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Cria cabeçalho Set-Cookie para expirar a sessão (logout).
 */
export function buildClearCookie(isSecure = false) {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (isSecure) parts.push("Secure");
  return parts.join("; ");
}
