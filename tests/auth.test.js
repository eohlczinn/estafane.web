import { describe, it, expect, beforeEach } from "vitest";
import {
  hashPassword,
  verifyPassword,
  checkCredentials,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  buildSessionCookie,
  buildClearCookie,
  checkRateLimit,
  registerFailedAttempt,
  clearRateLimit,
  SESSION_COOKIE_NAME,
} from "../server/services/authService.js";
import { isAllowedOrigin } from "../server/services/originValidator.js";
import { app } from "../server/app.js";
import http from "node:http";
import { jsPDF } from "jspdf";

describe("Serviço de Autenticação e Segurança (authService)", () => {
  it("gera hash scrypt e valida senha corretamente", () => {
    const raw = "EstefaneSegura2026";
    const hash = hashPassword(raw);
    expect(hash).toMatch(/^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(verifyPassword(raw, hash)).toBe(true);
    expect(verifyPassword("senhaErrada", hash)).toBe(false);
  });

  it("rejeita senha vazia ou inválida de forma segura", () => {
    expect(verifyPassword("", "scrypt:abc:def")).toBe(false);
    expect(verifyPassword(null, "scrypt:abc:def")).toBe(false);
    expect(verifyPassword("123", "")).toBe(false);
    expect(verifyPassword("123", "scrypt:invalido")).toBe(false);
  });

  it("valida credenciais com hash de ambiente (ADMIN_PASSWORD_HASH)", () => {
    const originalHash = process.env.ADMIN_PASSWORD_HASH;
    try {
      process.env.ADMIN_PASSWORD_HASH = hashPassword("CaixaForte99");
      const valid = checkCredentials("estefane", "CaixaForte99");
      expect(valid.ok).toBe(true);
      expect(valid.user.username).toBe("estefane");

      const invalid = checkCredentials("estefane", "senhaIncorreta");
      expect(invalid.ok).toBe(false);
      expect(invalid.error).toContain("incorretos");

      const wrongUser = checkCredentials("outro_usuario", "CaixaForte99");
      expect(wrongUser.ok).toBe(false);
    } finally {
      if (originalHash === undefined) delete process.env.ADMIN_PASSWORD_HASH;
      else process.env.ADMIN_PASSWORD_HASH = originalHash;
    }
  });

  it("cria e valida token de sessão com HMAC-SHA256", () => {
    const user = { username: "estefane", name: "Estefane", role: "Operadora de caixa" };
    const token = createSessionToken(user);
    expect(typeof token).toBe("string");
    expect(token).toContain(".");

    const session = verifySessionToken(token);
    expect(session).not.toBeNull();
    expect(session.sub).toBe("estefane");
    expect(session.name).toBe("Estefane");
    expect(session.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("rejeita token adulterado ou com assinatura corrompida", () => {
    const user = { username: "estefane", name: "Estefane" };
    const token = createSessionToken(user);
    const parts = token.split(".");
    const tampered = parts[0] + ".assinatura_falsa_1234567890abcdef";
    expect(verifySessionToken(tampered)).toBeNull();
    expect(verifySessionToken("invalido")).toBeNull();
    expect(verifySessionToken("")).toBeNull();
  });

  it("analisa cookies e monta cabeçalhos Set-Cookie seguros", () => {
    const cookieHeader = "outra_coisa=123; estefane_session=meu-token-aqui; tema=dark";
    const cookies = parseCookies(cookieHeader);
    expect(cookies.estefane_session).toBe("meu-token-aqui");
    expect(cookies.tema).toBe("dark");

    const sessionCookie = buildSessionCookie("token123", true);
    expect(sessionCookie).toContain("estefane_session=token123");
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Secure");
    expect(sessionCookie).toContain("Path=/");

    const clearCookie = buildClearCookie(false);
    expect(clearCookie).toContain("Max-Age=0");
    expect(clearCookie).toContain("HttpOnly");
  });

  it("bloqueia tentativas repetidas de login após 5 falhas (Rate Limiting)", () => {
    const testIp = "192.168.10.50";
    clearRateLimit(testIp);

    for (let i = 0; i < 4; i++) {
      registerFailedAttempt(testIp);
      expect(checkRateLimit(testIp).blocked).toBe(false);
    }

    // 5ª tentativa bloqueia
    registerFailedAttempt(testIp);
    const limitResult = checkRateLimit(testIp);
    expect(limitResult.blocked).toBe(true);
    expect(limitResult.waitMinutes).toBeGreaterThan(0);
    expect(limitResult.message).toContain("Muitas tentativas");

    // Limpeza por sucesso
    clearRateLimit(testIp);
    expect(checkRateLimit(testIp).blocked).toBe(false);
  });
});

describe("Validador de Origem e Domínio Railway (originValidator)", () => {
  it("permite requisições sem header de origem", () => {
    const req = { get: () => undefined };
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it("permite domínio público do Railway configurado", () => {
    const original = process.env.RAILWAY_PUBLIC_DOMAIN;
    try {
      process.env.RAILWAY_PUBLIC_DOMAIN = "estefane-web.up.railway.app";
      const reqHttps = { get: (h) => (h === "origin" ? "https://estefane-web.up.railway.app" : undefined) };
      expect(isAllowedOrigin(reqHttps)).toBe(true);
    } finally {
      if (original === undefined) delete process.env.RAILWAY_PUBLIC_DOMAIN;
      else process.env.RAILWAY_PUBLIC_DOMAIN = original;
    }
  });

  it("permite mesma origem do Host da requisição", () => {
    const req = {
      protocol: "https",
      get: (h) => (h === "origin" ? "https://caixa.meudominio.com" : h === "host" ? "caixa.meudominio.com" : undefined),
    };
    expect(isAllowedOrigin(req)).toBe(true);
  });

  it("rejeita origens externas maliciosas não autorizadas", () => {
    const req = {
      protocol: "https",
      get: (h) => (h === "origin" ? "https://site-malicioso.com" : h === "host" ? "app.railway.app" : undefined),
    };
    expect(isAllowedOrigin(req)).toBe(false);
  });
});

describe("Endpoints de Autenticação e Proteção da API (/api/auth e /api/fechamento)", () => {
  let server;
  let baseUrl;

  beforeEach(async () => {
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    return () => new Promise((resolve) => server.close(resolve));
  });

  it("login com senha errada retorna 401", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "estefane", password: "senhaErrada123" }),
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toContain("incorretos");
  });

  it("probe do Railway funciona sem sessão e não libera a API protegida", async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const probe = await fetch(`${baseUrl}/healthz`);
      expect(probe.status).toBe(200);
      expect(await probe.json()).toEqual({ status: "ok" });
      const api = await fetch(`${baseUrl}/api/health`);
      expect(api.status).toBe(401);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it("login correto emite cookie HttpOnly e permite acesso a /api/auth/me", async () => {
    const prevPlain = process.env.ADMIN_PASSWORD;
    process.env.ADMIN_PASSWORD = "SenhaTesteVitest2026";
    try {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "estefane", password: "SenhaTesteVitest2026" }),
      });
      expect(loginRes.status).toBe(200);
      const setCookie = loginRes.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain(SESSION_COOKIE_NAME);
      expect(setCookie).toContain("HttpOnly");

      // Extrai cookie para testar sessão
      const cookieVal = setCookie.split(";")[0];

      // Requisição sem cookie em /api/auth/me retorna 401
      const meUnauth = await fetch(`${baseUrl}/api/auth/me`);
      expect(meUnauth.status).toBe(401);

      // Requisição COM cookie em /api/auth/me retorna 200
      const meAuth = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: cookieVal },
      });
      expect(meAuth.status).toBe(200);
      const meData = await meAuth.json();
      expect(meData.authenticated).toBe(true);
      expect(meData.user.name).toBe("Estefane");

      // Logout encerra a sessão
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Cookie: cookieVal },
      });
      expect(logoutRes.status).toBe(200);
      const clearCookie = logoutRes.headers.get("set-cookie");
      expect(clearCookie).toContain("Max-Age=0");
    } finally {
      if (prevPlain === undefined) delete process.env.ADMIN_PASSWORD;
      else process.env.ADMIN_PASSWORD = prevPlain;
    }
  });

  it("com REQUIRE_AUTH=true, upload sem sessão é bloqueado (401) e com sessão é aceito (200)", async () => {
    const prevAuth = process.env.REQUIRE_AUTH;
    process.env.REQUIRE_AUTH = "true";

    try {
      const doc = new jsPDF();
      doc.text(["Mercado: TESTE", "Total de vendas: 100,00", "Dinheiro: 100,00"], 10, 10);
      const pdfBytes = doc.output("arraybuffer");

      const makeUpload = (cookie) => {
        const form = new FormData();
        form.append("pdf", new Blob([pdfBytes], { type: "application/pdf" }), "teste.pdf");
        const headers = {};
        if (cookie) headers.Cookie = cookie;
        return fetch(`${baseUrl}/api/fechamento/analisar`, {
          method: "POST",
          headers,
          body: form,
        });
      };

      // 1. Sem cookie -> 401
      const unauthRes = await makeUpload();
      expect(unauthRes.status).toBe(401);
      const unauthData = await unauthRes.json();
      expect(unauthData.error).toContain("Acesso não autorizado");

      // 2. Com sessão válida gerada
      const token = createSessionToken({ username: "estefane", name: "Estefane" });
      const authRes = await makeUpload(`${SESSION_COOKIE_NAME}=${token}`);
      expect(authRes.status).toBe(200);
      const authData = await authRes.json();
      expect(["completed", "review_required"]).toContain(authData.status);
      expect(authData.id).toMatch(/^doc-/);
    } finally {
      if (prevAuth === undefined) delete process.env.REQUIRE_AUTH;
      else process.env.REQUIRE_AUTH = prevAuth;
    }
  });
});
