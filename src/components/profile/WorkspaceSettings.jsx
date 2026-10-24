import React from "react";
import { Archive, Bell, Box } from "lucide-react";
import { Link } from "react-router-dom";
import { useClosing } from "../../context/ClosingContext.jsx";
import DepthCard from "./DepthCard.jsx";
function Option({ label, checked, onChange, description }) {
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
export default function WorkspaceSettings() {
  const { prefs, setPrefs } = useClosing();
  const set = (key, value) => setPrefs((old) => ({ ...old, [key]: value }));
  return (
    <>
      <section id="profundidade" className="panel settings-panel">
        <h2>
          <Box size={22} />
          Profundidade e movimento 3D
        </h2>
        <DepthCard className="depth-preview">
          <div className="depth-cube" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <strong>Seu espaço ganha outra dimensão</strong>
          <span>Mova o mouse para experimentar</span>
          <div className="depth-orbit" aria-hidden="true" />
        </DepthCard>
        <Option
          label="Inclinação 3D interativa"
          description="Responde ao mouse no perfil e nas ilustrações. Desativada no modo econômico e com movimento reduzido."
          checked={prefs.tilt3d}
          onChange={(v) => set("tilt3d", v)}
        />
        <Option
          label="Órbitas e formas em movimento"
          checked={prefs.orbitEffects}
          onChange={(v) => set("orbitEffects", v)}
        />
        <label>
          Intensidade da profundidade · {prefs.tiltStrength}
          <input
            type="range"
            min={2}
            max={10}
            step={1}
            value={prefs.tiltStrength}
            onChange={(e) => set("tiltStrength", Number(e.target.value))}
          />
        </label>
        <label>
          Ritmo das órbitas
          <select
            value={prefs.effectSpeed}
            onChange={(e) => set("effectSpeed", Number(e.target.value))}
          >
            <option value={8}>Dinâmico</option>
            <option value={14}>Equilibrado</option>
            <option value={24}>Sereno</option>
          </select>
        </label>
        <p className="muted">
          O controle geral de animações e a preferência do dispositivo têm
          prioridade sobre estes efeitos.
        </p>
      </section>
      <section id="historico-local" className="panel settings-panel">
        <h2>
          <Archive size={22} />
          Histórico e armazenamento
        </h2>
        <Option
          label="Salvar caixas confirmados automaticamente"
          description="Guarda valores, observações e texto extraído neste navegador, sem os arquivos originais. Rascunhos só são salvos quando você pede."
          checked={prefs.autoHistory}
          onChange={(v) => set("autoHistory", v)}
        />
        <label>
          Limite de registros
          <select
            value={prefs.historyLimit}
            onChange={(e) => set("historyLimit", Number(e.target.value))}
          >
            {[10, 30, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n} fechamentos
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Até 20 MB no total e 2 MB por registro. Reduzir o limite preserva os
          registros existentes. Ao atingir o limite, você escolhe o que excluir.
        </p>
        <Link to="/historico" className="secondary">
          Gerenciar histórico e seleção
        </Link>
      </section>
      <section id="notificacoes-local" className="panel settings-panel">
        <h2>
          <Bell size={22} />
          Notificações
        </h2>
        <Option
          label="Receber avisos na central"
          checked={prefs.notificationsEnabled}
          onChange={(v) => set("notificationsEnabled", v)}
          description="Importação, confirmação, alterações e erros reais do sistema. Sem notificações externas."
        />
        <Option
          label="Avisos de salvamento e exclusão"
          checked={prefs.notifyHistory}
          onChange={(v) => set("notifyHistory", v)}
        />
        <Link to="/notificacoes" className="secondary">
          Abrir central de notificações
        </Link>
      </section>
    </>
  );
}
