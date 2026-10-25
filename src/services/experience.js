// Only aggregate, allowlisted interface choices are stored. No document text,
// financial amounts, filenames, account identifiers or external browsing data.
export const experienceKey = "estefane.experience.v1";
export const behaviorOptions = {
  route: [
    "/",
    "/ler-pdf",
    "/resultado",
    "/lote",
    "/imprimir",
    "/relatorio",
    "/configuracoes",
    "/perfil",
    "/suporte",
  ],
  paper: ["a4", "80", "58"],
  accent: ["purple", "blue", "pink", "emerald", "teal", "amber", "coral"],
  quotes: ["faith", "motivation", "mixed"],
  workflow: ["import", "confirm", "export", "calculation", "learn"],
};
export const recommendationIds = [
  "import",
  "review",
  "print",
  "layout",
  "effects",
  "focus",
  "learn",
  "faith",
  "motivation",
];
export function emptyExperience() {
  return { version: 1, signals: {}, feedback: {} };
}
export function normalizeExperience(input, days = 30, now = Date.now()) {
  const safe = emptyExperience();
  if (input?.version !== 1) return safe;
  const cutoff = now - days * 86400000;
  for (const [key, entry] of Object.entries(input.signals || {}).slice(0, 80)) {
    const [type, value] = key.split(":");
    if (
      !Object.hasOwn(behaviorOptions, type) ||
      !behaviorOptions[type].includes(value) ||
      !Number.isFinite(entry?.at) ||
      entry.at < cutoff ||
      entry.at > now
    )
      continue;
    safe.signals[key] = {
      count: Math.max(0, Math.min(1000, Number(entry.count) || 0)),
      at: entry.at,
    };
  }
  for (const id of recommendationIds) {
    const item = input.feedback?.[id];
    if (
      ["useful", "hide"].includes(item?.value) &&
      Number.isFinite(item.at) &&
      item.at >= cutoff &&
      item.at <= now
    )
      safe.feedback[id] = { value: item.value, at: item.at };
  }
  return safe;
}
export function readExperience(storage, days = 30) {
  try {
    return normalizeExperience(
      JSON.parse(storage.getItem(experienceKey) || "{}"),
      days,
    );
  } catch {
    return emptyExperience();
  }
}
export function addSignal(state, type, value, now = Date.now(), days = 30) {
  const safe = normalizeExperience(state, days, now);
  if (
    !Object.hasOwn(behaviorOptions, type) ||
    !behaviorOptions[type].includes(value)
  )
    return safe;
  const key = `${type}:${value}`,
    old = safe.signals[key];
  const decay = old ? Math.pow(0.5, (now - old.at) / (14 * 86400000)) : 0;
  safe.signals[key] = {
    count: Math.min(1000, (old?.count || 0) * decay + 1),
    at: now,
  };
  return safe;
}
export function recommendations(
  state,
  { prefs, hasDocument = false, confirmed = false, pending = 0 },
  now = Date.now(),
) {
  if (!prefs.personalRecommendations) return [];
  const safe = normalizeExperience(state, prefs.memoryDays, now);
  const score = (key) => {
    const s = safe.signals[key];
    return s ? s.count * Math.pow(0.5, (now - s.at) / (14 * 86400000)) : 0;
  };
  const favorite = (type) =>
    (behaviorOptions[type] || [])
      .map((value) => ({ value, score: score(`${type}:${value}`) }))
      .sort((a, b) => b.score - a.score)[0];
  const favoriteAccent = favorite("accent"),
    favoritePaper = favorite("paper");
  const colorNames = {
    purple: "roxo",
    blue: "azul",
    pink: "rosa",
    emerald: "esmeralda",
    teal: "turquesa",
    amber: "âmbar",
    coral: "coral",
  };
  const items = [
    {
      id: "import",
      title: "Comece pelo documento",
      description:
        "Envie um relatório ou planilha. O site organiza os valores para você conferir.",
      reason: "Próximo passo para começar um fechamento.",
      to: "/ler-pdf",
      score: hasDocument ? -1 : 30,
    },
    {
      id: "review",
      title: pending ? "Resolva o que falta" : "Seu resultado, sem complicação",
      description: pending
        ? `${pending} ponto(s) precisam de conferência antes de finalizar.`
        : "Veja o que entrou, o que saiu e quanto sobrou ou faltou.",
      reason: "Você tem um documento nesta sessão.",
      to: "/resultado",
      score: hasDocument && !confirmed ? 100 : -1,
    },
    {
      id: "print",
      title: "Pronto para salvar ou imprimir",
      description: "Escolha A4 ou bobina e emita o fechamento conferido.",
      reason: "O fechamento atual foi confirmado.",
      to: "/imprimir",
      score: hasDocument && confirmed ? 100 : -1,
    },
    {
      id: "layout",
      title: "Seu papel favorito, à mão",
      description:
        favoritePaper.score >= 2
          ? `Você escolhe mais ${favoritePaper.value === "a4" ? "A4" : favoritePaper.value + " mm"}. Defina esse formato como padrão, se quiser.`
          : "Defina o formato padrão para não escolher toda vez.",
      reason:
        favoritePaper.score >= 2
          ? "Baseado nas suas escolhas de papel."
          : "Você costuma abrir relatórios e impressão.",
      to: "/configuracoes#impressao",
      score:
        favoritePaper.score >= 2 ||
        score("route:/imprimir") + score("route:/relatorio") >= 2
          ? 25 + score("route:/imprimir")
          : -1,
    },
    {
      id: "effects",
      title: "Um espaço com a sua cor",
      description:
        favoriteAccent.score >= 2
          ? `O tom ${colorNames[favoriteAccent.value]} aparece mais nas suas escolhas. Combine-o com um fundo e movimento do seu jeito.`
          : "Experimente novas paletas, fundos e movimento na intensidade que você prefere.",
      reason:
        favoriteAccent.score >= 2
          ? "Baseado nas cores que você escolheu no site."
          : "Uma sugestão inicial; o site ainda está conhecendo seu estilo.",
      to: "/configuracoes#aparencia",
      score: favoriteAccent.score >= 2 ? 23 : 15,
    },
    {
      id: "focus",
      title: "Mais foco, menos consumo",
      description:
        "O modo econômico reduz movimento e verificações em segundo plano.",
      reason: "Você usa bastante a conferência ou as configurações.",
      to: "/configuracoes#otimizacao",
      score:
        score("route:/resultado") + score("route:/configuracoes") >= 3 &&
        prefs.performance !== "eco"
          ? 24
          : 8,
    },
    {
      id: "learn",
      title: "Ensine um rótulo ao sistema",
      description:
        "Confirme uma classificação e salve o perfil. O próximo documento do mesmo layout recebe a sugestão.",
      reason: "Atalho para lidar com layouts diferentes do mercado.",
      to: "/configuracoes#perfis-importacao",
      score: score("workflow:learn") ? 26 : 12,
    },
  ];
  for (const category of ["faith", "motivation"])
    if (score(`quotes:${category}`) >= 2)
      items.push({
        id: category,
        title:
          category === "faith"
            ? "Sua pausa de fé"
            : "Um incentivo para a rotina",
        description:
          "Ajuste as frases de inspiração e escolha o ritmo de alternância.",
        reason: "Você escolheu esse estilo nas configurações.",
        to: "/configuracoes#efeitos",
        score: 22 + score(`quotes:${category}`),
      });
  return items
    .filter((i) => i.score >= 0 && safe.feedback[i.id]?.value !== "hide")
    .map((i) => ({
      ...i,
      score: i.score + (safe.feedback[i.id]?.value === "useful" ? 8 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, 3);
}
export const appearancePresets = {
  serene: {
    label: "Sereno",
    description: "Verde, leve e acolhedor",
    prefs: {
      accent: "emerald",
      surface: "aurora",
      colorDepth: "soft",
      animation: "subtle",
      performance: "balanced",
    },
  },
  vibrant: {
    label: "Vibrante",
    description: "Roxo, cor e movimento",
    prefs: {
      accent: "purple",
      surface: "mesh",
      colorDepth: "vivid",
      animation: "normal",
      performance: "quality",
    },
  },
  focus: {
    label: "Foco",
    description: "Azul, compacto e econômico",
    prefs: {
      accent: "blue",
      surface: "minimal",
      colorDepth: "soft",
      animation: "off",
      performance: "eco",
      density: "compact",
    },
  },
};
