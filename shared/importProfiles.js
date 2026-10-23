import { moneyFields } from "./fields.js";
export const profileStorageKey = "estefane.import-profiles.v1";
export function validateImportProfiles(profiles) {
  if (!Array.isArray(profiles) || profiles.length > 20)
    throw Error("Perfis de importação inválidos (máximo de 20).");
  return profiles.map((p) => {
    if (
      p.version !== 1 ||
      !/^[a-f0-9]{64}$/.test(p.layoutKey || "") ||
      !Array.isArray(p.rules) ||
      p.rules.length > 30
    )
      throw Error("Perfil de importação inválido.");
    return {
      version: 1,
      layoutKey: p.layoutKey,
      name: String(p.name || "Layout conferido").slice(0, 80),
      rules: p.rules.map((r) => {
        if (
          !Object.hasOwn(moneyFields, r.field) ||
          typeof r.label !== "string" ||
          !r.label.trim() ||
          r.label.length > 180
        )
          throw Error("Regra de importação inválida.");
        return { label: r.label, field: r.field };
      }),
    };
  });
}
export function readImportProfiles(storage) {
  try {
    return validateImportProfiles(
      JSON.parse(storage.getItem(profileStorageKey) || "[]"),
    );
  } catch {
    return [];
  }
}
