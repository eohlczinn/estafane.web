/**
 * Validação de origem (CORS / CSRF) para o Estefane Web.
 * Suporta Railway (domínio público), variáveis de ambiente e desenvolvimento local.
 */

function normalizeOrigin(origin) {
  if (!origin || typeof origin !== "string") return "";
  return origin.trim().replace(/\/+$/, "").toLowerCase();
}

export function isAllowedOrigin(req) {
  const origin = req.get("origin");
  // Requisições sem header Origin (ex.: navegação direta, GETs locais, CLI scripts) são permitidas
  if (!origin) return true;

  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  // 1. Origens configuradas explicitamente via ALLOWED_ORIGINS
  const customOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => normalizeOrigin(o))
    .filter(Boolean);
  if (customOrigins.includes(normalized)) return true;

  // 2. Domínio público do Railway (RAILWAY_PUBLIC_DOMAIN / RAILWAY_STATIC_URL)
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (normalized === `https://${railwayDomain}`.toLowerCase() || normalized === `http://${railwayDomain}`.toLowerCase()) {
      return true;
    }
  }

  if (process.env.RAILWAY_STATIC_URL) {
    const staticUrl = process.env.RAILWAY_STATIC_URL.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
    if (normalized === `https://${staticUrl}`.toLowerCase() || normalized === `http://${staticUrl}`.toLowerCase()) {
      return true;
    }
  }

  // 3. URLs públicas de aplicação (APP_URL / FRONTEND_URL)
  if (process.env.APP_URL && normalizeOrigin(process.env.APP_URL) === normalized) {
    return true;
  }
  if (process.env.FRONTEND_URL && normalizeOrigin(process.env.FRONTEND_URL) === normalized) {
    return true;
  }

  // 4. Verificação de mesmo Host (produção Railway / proxy reverso / domínio personalizado)
  const host = req.get("host");
  if (host) {
    const hostOnly = host.trim().toLowerCase();
    if (normalized === `https://${hostOnly}` || normalized === `http://${hostOnly}`) {
      return true;
    }
  }

  const forwardedHost = req.get("x-forwarded-host");
  if (forwardedHost) {
    const fHost = forwardedHost.split(",")[0].trim().toLowerCase();
    if (normalized === `https://${fHost}` || normalized === `http://${fHost}`) {
      return true;
    }
  }

  // 5. Origens locais de desenvolvimento padrão (localhost / 127.0.0.1 em qualquer porta)
  const isLocalOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(normalized);
  if (isLocalOrigin) {
    return true;
  }

  return false;
}

