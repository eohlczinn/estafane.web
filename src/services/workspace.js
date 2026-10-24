import { estefaneProfile } from "./profile.js";
export const profileKey = "estefane.profile.v1";
export const notificationsKey = "estefane.notifications.v1";
export const defaultProfile = {
  ...estefaneProfile,
  bio: "Com fé, dedicação e gratidão, um dia de cada vez.",
  instagram: "",
  facebook: "",
  whatsapp: "",
};
const socialHosts = {
  instagram: ["instagram.com", "www.instagram.com"],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.com"],
  whatsapp: ["wa.me", "api.whatsapp.com", "www.whatsapp.com"],
};
export function socialLink(type, input) {
  const value = String(input || "").trim();
  if (!value) return "";
  let raw = value;
  if (type === "whatsapp" && /^[+\d\s()-]+$/.test(value)) {
    const phone = value.replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15)
      throw Error("WhatsApp: informe o número com DDI e DDD.");
    raw = "https://wa.me/" + phone;
  }
  if (type === "instagram" && /^@?[\w.]+$/.test(value))
    raw = "https://www.instagram.com/" + value.replace(/^@/, "") + "/";
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw Error("Confira o link de " + type + ".");
  }
  if (
    !socialHosts[type]?.includes(url.hostname.toLowerCase()) ||
    url.username ||
    url.password ||
    url.port ||
    !["https:", "http:"].includes(url.protocol)
  )
    throw Error("Use um endereço oficial de " + type + ".");
  url.protocol = "https:";
  return url.href;
}
export function normalizeProfile(value = {}) {
  const result = { ...defaultProfile };
  for (const key of ["name", "city", "role", "workplace", "bio"])
    if (typeof value[key] === "string")
      result[key] = value[key].trim().slice(0, key === "bio" ? 280 : 100);
  if (!result.name) throw Error("Informe o nome do perfil.");
  if (
    !Number.isInteger(Number(value.age ?? result.age)) ||
    Number(value.age ?? result.age) < 16 ||
    Number(value.age ?? result.age) > 120
  )
    throw Error("Confira a idade informada.");
  result.age = Number(value.age ?? result.age);
  for (const type of Object.keys(socialHosts))
    result[type] = socialLink(type, value[type]);
  return result;
}
export function readProfile(storage) {
  try {
    return normalizeProfile(JSON.parse(storage.getItem(profileKey) || "{}"));
  } catch {
    return { ...defaultProfile };
  }
}
export function readNotifications(storage) {
  try {
    const value = JSON.parse(storage.getItem(notificationsKey) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (n) =>
              typeof n.id === "string" &&
              typeof n.text === "string" &&
              typeof n.at === "string",
          )
          .slice(0, 60)
      : [];
  } catch {
    return [];
  }
}
export function appendNotification(
  items,
  text,
  category = "system",
  now = new Date().toISOString(),
) {
  if (
    !text ||
    (items[0]?.text === text &&
      Date.parse(now) - Date.parse(items[0].at) < 60000)
  )
    return items;
  return [
    {
      id: crypto.randomUUID(),
      text: String(text).slice(0, 500),
      category,
      at: now,
      read: false,
    },
    ...items,
  ].slice(0, 60);
}
