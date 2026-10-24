import React, { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Settings as SettingsIcon,
  Palette,
  SlidersHorizontal,
  Sun,
  Moon,
  Monitor,
  Store,
  Calculator,
  Printer,
  FileText,
  UserRound,
  Upload,
  X,
} from "lucide-react";
import PaperFormats from "../components/printing/PaperFormats.jsx";
import { useClosing } from "../context/ClosingContext.jsx";
import { useWorkspace } from "../context/workspace.js";
import WorkspaceSettings from "../components/profile/WorkspaceSettings.jsx";
import ImportProfiles from "../components/upload/ImportProfiles.jsx";
import ExperienceSettings from "../components/profile/ExperienceSettings.jsx";
import { useExperience } from "../context/experience.js";
function Toggle({ label, checked, onChange, description }) {
  return (
    <label className="settings-toggle">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function Section({ id, title, Icon, children }) {
  return (
    <section id={id} className="panel settings-panel">
      <h2>
        <Icon size={22} />
        {title}
      </h2>
      {children}
    </section>
  );
}
function MarginInput({ label, min, max, value, onChange }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label>
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const parsed = Number(draft),
            next =
              Number.isFinite(parsed) && draft !== ""
                ? Math.min(max, Math.max(min, parsed))
                : value;
          setDraft(String(next));
          onChange(next);
        }}
      />
    </label>
  );
}
export default function Settings() {
  const location = useLocation();
  const grid = useRef(null),
    [search, setSearch] = useState("");
  const [matches, setMatches] = useState(1);
  const { profile } = useWorkspace();
  useLayoutEffect(() => {
    const term = search
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    let count = 0;
    for (const section of grid.current?.children || []) {
      if (section.tagName !== "SECTION") continue;
      const match = term
        ? section.textContent
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .includes(term)
        : !location.hash || section.id === location.hash.slice(1);
      section.hidden = !match;
      if (match) count++;
    }
    setMatches(count);
  }, [location.hash, search]);
  const { record } = useExperience();
  const { prefs, setPrefs, serverLimits } = useClosing(),
    [error, setError] = useState("");
  const set = (key, value) => {
    setPrefs((old) => ({ ...old, [key]: value }));
    if (key === "accent") record("accent", value);
    if (key === "quoteCategory") record("quotes", value);
  };
  async function logo(event) {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      setError("Use um logotipo PNG ou JPEG de até 2 MB.");
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 16000000)
        throw Error("Imagem muito grande. Use uma versão menor do logotipo.");
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height)),
        canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      const data = canvas.toDataURL("image/jpeg", 0.8);
      if (data.length >= 260000)
        throw Error(
          "Não foi possível reduzir o logotipo. Use uma imagem menor.",
        );
      set("logo", data);
    } catch (e) {
      setError(e.message || "Não foi possível abrir essa imagem.");
    }
  }
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <SettingsIcon />
        </span>
        <div>
          <div className="eyebrow">SEU ESPAÇO DE TRABALHO</div>
          <h1>Configurações</h1>
          <p>Personalize o mercado, o fechamento e seus relatórios.</p>
        </div>
      </div>
      <label className="settings-search">
        Encontrar uma configuração
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Busque por efeito, histórico, papel, mercado…"
        />
      </label>
      <nav
        className="settings-navigation"
        aria-label="Seções das configurações"
      >
        <Link
          to="/configuracoes"
          onClick={() => setSearch("")}
          aria-current={!location.hash ? "page" : undefined}
        >
          Todas
        </Link>
        {[
          ["profundidade", "Efeitos 3D"],
          ["historico-local", "Histórico"],
          ["notificacoes-local", "Notificações"],
          ["aparencia", "Aparência"],
          ["efeitos", "Movimento e frases"],
          ["estilos", "Estilos"],
          ["otimizacao", "Otimização"],
          ["personalizacao", "Personalização"],
          ["mercado", "Mercado"],
          ["fechamento", "Fechamento"],
          ["processamento", "Documentos e lotes"],
          ["perfis-importacao", "Perfis de importação"],
          ["impressao", "Impressão"],
          ["relatorios", "Relatórios"],
          ["perfil-local", "Perfil"],
        ].map(([id, label]) => (
          <Link
            key={id}
            to={"/configuracoes#" + id}
            onClick={() => setSearch("")}
            aria-current={location.hash === "#" + id ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {!matches && (
        <p className="empty-workspace" role="status">
          Nenhuma configuração encontrada. Tente outra palavra ou escolha
          “Todas”.
        </p>
      )}
      <div
        ref={grid}
        className={`settings-grid settings-complete ${matches === 1 ? "single-section" : ""}`}
      >
        <WorkspaceSettings />
        <Section id="aparencia" title="Aparência" Icon={Palette}>
          <p className="setting-label">Tema</p>
          <div className="theme-options" role="group" aria-label="Tema">
            {[
              ["light", "Claro", Sun],
              ["dark", "Escuro", Moon],
              ["system", "Automático", Monitor],
            ].map(([key, label, Icon]) => (
              <button
                type="button"
                key={key}
                className={`theme-card ${prefs.theme === key ? "selected" : ""}`}
                aria-pressed={prefs.theme === key}
                onClick={() => set("theme", key)}
              >
                <Icon size={23} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <p className="setting-label">Cor principal</p>
          <div
            className="accent-options"
            role="group"
            aria-label="Cor principal"
          >
            {[
              ["purple", "Roxo"],
              ["blue", "Azul"],
              ["pink", "Rosa"],
              ["emerald", "Esmeralda"],
              ["teal", "Turquesa"],
              ["amber", "Âmbar"],
              ["coral", "Coral"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`accent-choice accent-${key} ${prefs.accent === key ? "selected" : ""}`}
                aria-pressed={prefs.accent === key}
                onClick={() => set("accent", key)}
              >
                <i />
                {label}
              </button>
            ))}
          </div>
          <label>
            Intensidade das animações
            <select
              value={prefs.animation}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  animation: e.target.value,
                  reduceMotion: e.target.value === "off",
                })
              }
            >
              <option value="off">Sem animações</option>
              <option value="subtle">Suaves</option>
              <option value="normal">Normais</option>
            </select>
          </label>
        </Section>
        <Section
          id="efeitos"
          title="Movimento e frases"
          Icon={SlidersHorizontal}
        >
          <p className="muted">
            Efeitos leves para dar vida ao seu espaço. A preferência de
            movimento reduzido do dispositivo é respeitada.
          </p>
          <Toggle
            label="Foto em movimento"
            checked={prefs.floatingPhoto}
            onChange={(v) => set("floatingPhoto", v)}
            description="Flutuação suave na foto da Estefane e na ilustração do menu."
          />
          <Toggle
            label="Brilho suave no fundo"
            checked={prefs.ambientGlow}
            onChange={(v) => set("ambientGlow", v)}
            description="Luz discreta no perfil, sem vídeos ou partículas pesadas."
          />
          <Toggle
            label="Efeitos ao passar o mouse"
            checked={prefs.hoverEffects}
            onChange={(v) => set("hoverEffects", v)}
          />
          <Toggle
            label="Transição entre páginas"
            checked={prefs.pageTransitions}
            onChange={(v) => set("pageTransitions", v)}
          />
          <Toggle
            label="Mostrar frases de inspiração"
            checked={prefs.showQuotes}
            onChange={(v) => set("showQuotes", v)}
          />
          <Toggle
            label="Alternar frases automaticamente"
            checked={prefs.autoRotateQuotes}
            onChange={(v) => set("autoRotateQuotes", v)}
            description="Você também pode pausar ou avançar as frases manualmente."
          />
          <label>
            Estilo das frases
            <select
              value={prefs.quoteCategory}
              onChange={(e) => set("quoteCategory", e.target.value)}
            >
              <option value="mixed">Fé e motivação</option>
              <option value="faith">Religiosas: fé e gratidão</option>
              <option value="motivation">
                Motivacionais: carinho e incentivo
              </option>
            </select>
          </label>
          <label>
            Tempo de cada frase
            <select
              value={prefs.quoteInterval}
              onChange={(e) => set("quoteInterval", Number(e.target.value))}
            >
              {[8, 12, 20, 30, 60].map((v) => (
                <option key={v} value={v}>
                  {v} segundos
                </option>
              ))}
            </select>
          </label>
          {(prefs.animation === "off" || prefs.reduceMotion) && (
            <p className="muted">
              As animações estão desativadas em Aparência. As frases continuam
              disponíveis pelo botão de avançar.
            </p>
          )}
        </Section>
        <ExperienceSettings />
        <Section id="mercado" title="Mercado" Icon={Store}>
          <label>
            Nome do estabelecimento
            <input
              value={prefs.market}
              maxLength={180}
              onChange={(e) => set("market", e.target.value)}
            />
          </label>
          <label>
            Operadora padrão
            <input
              value={prefs.operator}
              maxLength={180}
              onChange={(e) => set("operator", e.target.value)}
            />
          </label>
          <label>
            Identificação padrão do caixa
            <input
              value={prefs.register}
              placeholder="Ex.: Caixa 01"
              maxLength={40}
              onChange={(e) => set("register", e.target.value)}
            />
          </label>
          <div className="logo-setting">
            <div>
              {prefs.logo ? (
                <img src={prefs.logo} alt="Logotipo do estabelecimento" />
              ) : (
                <Store size={27} />
              )}
            </div>
            <label className="secondary">
              <Upload size={16} /> Escolher logotipo
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg"
                onChange={logo}
              />
            </label>
            {prefs.logo && (
              <button
                className="icon-btn"
                onClick={() => set("logo", "")}
                aria-label="Remover logotipo"
              >
                <X size={18} />
              </button>
            )}
          </div>
          <p className="muted">
            Opcional. PNG ou JPEG até 2 MB, armazenado somente neste navegador.
            Dados identificados no documento prevalecem sobre os padrões.
          </p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
        </Section>
        <Section id="fechamento" title="Fechamento" Icon={Calculator}>
          <Toggle
            label="Explicar o resultado em palavras simples"
            checked={prefs.simpleResult}
            onChange={(v) => set("simpleResult", v)}
            description="Mostra quanto deveria estar no caixa, quanto foi contado e o próximo passo."
          />
          <Toggle
            label="Solicitar confirmação antes de finalizar"
            checked={prefs.confirmBeforeFinish}
            onChange={(v) => set("confirmBeforeFinish", v)}
            description="Exibe a confirmação de revisão dos dados."
          />
          <Toggle
            label="Mostrar detalhes do cálculo"
            checked={prefs.showCalculation}
            onChange={(v) => set("showCalculation", v)}
          />
          <Toggle
            label="Permitir observações"
            checked={prefs.allowNotes}
            onChange={(v) => set("allowNotes", v)}
            description="Observações ficam na sessão e podem constar no relatório."
          />
          <Toggle
            label="Destacar informações opcionais não reconhecidas"
            checked={prefs.requireUnrecognized}
            onChange={(v) => set("requireUnrecognized", v)}
            description="Mostra detalhes dos campos opcionais ausentes. Pendências essenciais e divergências sempre impedem finalizar."
          />
        </Section>
        <Section id="impressao" title="Impressão" Icon={Printer}>
          <p className="setting-label">Papel padrão</p>
          <PaperFormats
            compact
            value={prefs.paper}
            onChange={(v) => set("paper", v)}
          />
          <Toggle
            label="Mostrar prévia antes de imprimir"
            checked={prefs.preview}
            onChange={(v) => set("preview", v)}
          />
          <Toggle
            label="Incluir assinatura"
            checked={prefs.signature}
            onChange={(v) => set("signature", v)}
          />
          <Toggle
            label="Incluir horário de geração"
            checked={prefs.includeGenerationTime}
            onChange={(v) => set("includeGenerationTime", v)}
          />
          <div className="margin-fields">
            <MarginInput
              label="Margem A4 (8–25 mm)"
              min={8}
              max={25}
              value={prefs.marginA4}
              onChange={(v) => set("marginA4", v)}
            />
            <MarginInput
              label="Margem térmica (2–6 mm)"
              min={2}
              max={6}
              value={prefs.marginThermal}
              onChange={(v) => set("marginThermal", v)}
            />
          </div>
        </Section>
        <Section
          id="processamento"
          title="Importação de documentos"
          Icon={FileText}
        >
          <MarginInput
            label={`Arquivos por lote (máximo do servidor: ${serverLimits.maxFiles})`}
            min={1}
            max={serverLimits.maxFiles}
            value={Math.min(prefs.maxBatchFiles, serverLimits.maxFiles)}
            onChange={(v) => set("maxBatchFiles", v)}
          />
          <Toggle
            label="Avisar sobre arquivos duplicados"
            checked={prefs.warnDuplicates}
            onChange={(v) => set("warnDuplicates", v)}
            description="Arquivos idênticos são sempre excluídos da soma, mesmo sem o aviso."
          />
          <Toggle
            label="Exibir detalhes da extração"
            checked={prefs.showExtraction}
            onChange={(v) => set("showExtraction", v)}
          />
          <Toggle
            label="Agrupar documentos compatíveis automaticamente"
            checked={prefs.autoGroup}
            onChange={(v) => set("autoGroup", v)}
            description="Exige identidade e período ou referência confiáveis. Casos incertos pedem confirmação."
          />
          <p className="muted">
            Divergências e dados essenciais ausentes sempre impedem a
            confirmação. A operadora não altera regras financeiras por uma
            preferência geral.
          </p>
        </Section>
        <Section id="relatorios" title="Relatórios" Icon={FileText}>
          <label>
            Nome padrão dos arquivos
            <input
              value={prefs.filename}
              maxLength={64}
              onChange={(e) => set("filename", e.target.value)}
              placeholder="fechamento-caixa"
            />
          </label>
          <Toggle
            label="Incluir dados do estabelecimento"
            checked={prefs.includeMarket}
            onChange={(v) => set("includeMarket", v)}
          />
          <Toggle
            label="Incluir resumo financeiro"
            checked={prefs.includeSummary}
            onChange={(v) => set("includeSummary", v)}
          />
          <Toggle
            label="Incluir movimentações de caixa"
            checked={prefs.includeMovements}
            onChange={(v) => set("includeMovements", v)}
          />
          <Toggle
            label="Incluir movimentações detalhadas"
            checked={prefs.includeMovementDetails}
            onChange={(v) => set("includeMovementDetails", v)}
          />
          <Toggle
            label="Disponibilizar resumo consolidado"
            checked={prefs.includeConsolidated}
            onChange={(v) => set("includeConsolidated", v)}
          />
          <p className="muted">
            Dinheiro esperado, contado, diferença e resultado permanecem no
            relatório para permitir a conferência.
          </p>
        </Section>
        <ImportProfiles />
        <Section id="perfil-local" title="Meu perfil" Icon={UserRound}>
          <div className="settings-profile">
            <img src="/estefane.jpg" alt="Estefane" />
            <div>
              <h3>{profile.name}</h3>
              <p>
                {profile.age} anos · {profile.city}
              </p>
              <span>{profile.role}</span>
            </div>
          </div>
          <p className="muted">
            Edite seu nome, cidade, função e links de Instagram, Facebook e
            WhatsApp na página de perfil.
          </p>
          <Link to="/perfil" className="secondary">
            Editar meu perfil e links
          </Link>
        </Section>
      </div>
      <p className="muted">
        Preferências e perfil salvos neste navegador. O histórico guarda os
        fechamentos em um armazenamento separado, que você pode gerenciar e
        excluir. Os arquivos originais não são guardados.
      </p>
    </>
  );
}
