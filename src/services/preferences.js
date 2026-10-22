export const preferenceKey = "estefane.preferences";
export const defaultPreferences = {
  theme: "system",
  accent: "purple",
  animation: "normal",
  reduceMotion: false,
  floatingPhoto: true,
  ambientGlow: true,
  hoverEffects: true,
  pageTransitions: true,
  showQuotes: true,
  autoRotateQuotes: true,
  quoteCategory: "mixed",
  quoteInterval: 12,
  paper: "a4",
  market: "Pingo De Ouro",
  operator: "Estefane",
  register: "",
  logo: "",
  establishmentVersion: 2,
  confirmBeforeFinish: true,
  showCalculation: true,
  allowNotes: true,
  requireUnrecognized: true,
  signature: true,
  preview: true,
  includeGenerationTime: true,
  marginA4: 15,
  marginThermal: 4,
  filename: "fechamento-caixa",
  includeMarket: true,
  includeSummary: true,
  includeMovements: true,
  includeMovementDetails: true,
  includeConsolidated: true,
  maxBatchFiles: 10,
  warnDuplicates: true,
  showExtraction: true,
  autoGroup: true,
};
const enums = {
  theme: ["light", "dark", "system"],
  accent: ["purple", "blue", "pink"],
  animation: ["off", "subtle", "normal"],
  paper: ["a4", "80", "58"],
  quoteCategory: ["mixed", "faith", "motivation"],
};
const booleans = [
  "reduceMotion",
  "floatingPhoto",
  "ambientGlow",
  "hoverEffects",
  "pageTransitions",
  "showQuotes",
  "autoRotateQuotes",
  "confirmBeforeFinish",
  "showCalculation",
  "allowNotes",
  "requireUnrecognized",
  "signature",
  "preview",
  "includeGenerationTime",
  "includeMarket",
  "includeSummary",
  "includeMovements",
  "includeMovementDetails",
  "includeConsolidated",
  "warnDuplicates",
  "showExtraction",
  "autoGroup",
];
export function normalizePreferences(value = {}) {
  const result = { ...defaultPreferences };
  if (!value || typeof value !== "object" || Array.isArray(value))
    return result;
  for (const [key, options] of Object.entries(enums))
    if (options.includes(value[key])) result[key] = value[key];
  for (const key of booleans)
    if (typeof value[key] === "boolean") result[key] = value[key];
  for (const key of ["market", "operator", "register", "filename"])
    if (typeof value[key] === "string")
      result[key] = value[key].slice(0, key === "filename" ? 64 : 180);
  for (const [key, min, max] of [
    ["marginA4", 8, 25],
    ["marginThermal", 2, 6],
    ["maxBatchFiles", 1, 10],
    ["quoteInterval", 8, 60],
  ])
    if (Number.isFinite(Number(value[key])))
      result[key] = Math.min(
        max,
        Math.max(
          min,
          key === "maxBatchFiles"
            ? Math.trunc(Number(value[key]))
            : Number(value[key]),
        ),
      );
  if (
    typeof value.logo === "string" &&
    value.logo.length < 260000 &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value.logo)
  )
    result.logo = value.logo;
  if (value.establishmentVersion !== 2) {
    result.market = "Pingo De Ouro";
    result.establishmentVersion = 2;
  }
  if (result.reduceMotion) result.animation = "off";
  return result;
}
export function readPreferences(storage) {
  try {
    return normalizePreferences(
      JSON.parse(storage.getItem(preferenceKey) || "{}"),
    );
  } catch {
    return { ...defaultPreferences };
  }
}
export function writePreferences(storage, value) {
  const safe = normalizePreferences(value);
  try {
    storage.setItem(preferenceKey, JSON.stringify(safe));
    return true;
  } catch {
    return false;
  }
}
export function reportFilename(prefs, date = new Date(), paper = "a4") {
  const prefix =
    (prefs.filename || "fechamento-caixa")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/^[.\s]+|[.\s]+$/g, "")
      .slice(0, 64) || "fechamento-caixa";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" ", "_")
    .replace(":", "-");
  return `${prefix}-${paper}-${parts}.pdf`;
}
