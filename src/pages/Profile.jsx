import React, { useState } from "react";
import {
  MapPin,
  BriefcaseBusiness,
  UserRound,
  Instagram,
  Facebook,
  MessageCircle,
  Heart,
  Sparkles,
  Store,
  Settings,
  Save,
  Pencil,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useClosing } from "../context/ClosingContext.jsx";
import { useWorkspace } from "../context/workspace.js";
import Encouragement from "../components/profile/Encouragement.jsx";
import DepthCard from "../components/profile/DepthCard.jsx";
export default function Profile() {
  const { prefs } = useClosing(),
    { profile, saveProfile } = useWorkspace();
  const [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(profile);
  const socials = [
    [Instagram, "Instagram", "instagram"],
    [Facebook, "Facebook", "facebook"],
    [MessageCircle, "WhatsApp", "whatsapp"],
  ];
  const change = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <UserRound />
        </span>
        <div>
          <div className="eyebrow">UM ESPAÇO COM A SUA ESSÊNCIA</div>
          <h1>Meu perfil</h1>
          <p>Sua rotina, seus links e aquilo que inspira o seu dia.</p>
        </div>
      </div>
      <div className="personal-profile-grid">
        <section className="panel profile-page personal-profile">
          <DepthCard className="profile-banner living-card">
            <Sparkles size={24} />
            <span>Fé no coração. Leveza na rotina.</span>
            <Heart size={23} />
            <div className="depth-orbit" aria-hidden="true" />
          </DepthCard>
          <img
            className="living-avatar"
            src="/estefane.jpg"
            alt={profile.name}
          />
          <div className="profile-name-row">
            <h2>{profile.name}</h2>
            <span className="profile-age">{profile.age} anos</span>
          </div>
          <span className="profile-role">{profile.role}</span>
          <p className="profile-intro">{profile.bio}</p>
          <div className="profile-socials" aria-label="Redes sociais">
            {socials.map(
              ([Icon, label, key]) =>
                profile[key] && (
                  <a
                    key={key}
                    className={`social-decoration ${key}`}
                    href={profile[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon size={19} />
                    {label}
                  </a>
                ),
            )}
          </div>
          {!socials.some(([, , key]) => profile[key]) && (
            <p className="social-caption">
              Adicione seus links em Editar perfil para ativar as redes sociais.
            </p>
          )}
          <dl>
            {[
              [MapPin, "Cidade", profile.city],
              [Store, "Trabalho", profile.workplace],
              [BriefcaseBusiness, "Função", profile.role],
            ].map(([Icon, label, value]) => (
              <div key={label}>
                <dt>
                  <Icon size={18} />
                  {label}
                </dt>
                <dd>{value || "Não informado"}</dd>
              </div>
            ))}
          </dl>
          <div className="profile-actions-bar">
            <button
              className="primary"
              onClick={() => {
                setDraft(profile);
                setEditing(!editing);
              }}
              aria-expanded={editing}
            >
              <Pencil size={17} />
              {editing ? "Fechar edição" : "Editar perfil"}
            </button>
            <Link to="/configuracoes#efeitos" className="secondary">
              <Settings size={17} />
              Personalizar efeitos
            </Link>
          </div>
          {editing && (
            <form
              className="profile-editor"
              onSubmit={(e) => {
                e.preventDefault();
                if (saveProfile(draft)) setEditing(false);
              }}
            >
              <h2>Seu perfil e seus links</h2>
              <div className="field-grid">
                {[
                  ["name", "Nome"],
                  ["age", "Idade"],
                  ["city", "Cidade"],
                  ["workplace", "Local de trabalho"],
                  ["role", "Função"],
                ].map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      required={key === "name" || key === "age"}
                      type={key === "age" ? "number" : "text"}
                      min={key === "age" ? 16 : undefined}
                      max={key === "age" ? 120 : undefined}
                      maxLength={100}
                      value={draft[key]}
                      onChange={(e) => change(key, e.target.value)}
                    />
                  </label>
                ))}
              </div>
              <label>
                Minha frase
                <textarea
                  rows={3}
                  maxLength={280}
                  value={draft.bio}
                  onChange={(e) => change("bio", e.target.value)}
                />
              </label>
              {socials.map(([, label, key]) => (
                <label key={key}>
                  {label}
                  <input
                    value={draft[key]}
                    maxLength={500}
                    placeholder={
                      key === "instagram"
                        ? "@seuperfil ou link do Instagram"
                        : key === "whatsapp"
                          ? "+55 DDD e número, ou link wa.me"
                          : "https://www.facebook.com/seuperfil"
                    }
                    onChange={(e) => change(key, e.target.value)}
                  />
                </label>
              ))}
              <p className="muted">
                Links opcionais. WhatsApp precisa de DDI e DDD. O perfil é salvo
                neste navegador; os dados do documento continuam independentes.
              </p>
              <div className="review-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditing(false)}
                >
                  Cancelar
                </button>
                <button className="primary" type="submit">
                  <Save size={17} />
                  Salvar perfil
                </button>
              </div>
            </form>
          )}
        </section>
        <aside className="profile-inspiration">
          <Encouragement prefs={prefs} />
          <DepthCard className="panel profile-routine">
            <span className="eyebrow">SEU ESPAÇO ACOMPANHA VOCÊ</span>
            <h2>Menos repetição. Mais tranquilidade.</h2>
            <p>
              Guarde fechamentos, retome sua conferência e personalize sua
              experiência.
            </p>
            <Link to="/historico">Abrir meu histórico →</Link>
            <div className="depth-orbit" aria-hidden="true" />
          </DepthCard>
          <section className="panel">
            <h2>Conhecimento do seu mercado</h2>
            <p>
              As classificações que você confirma podem virar sugestões para o
              próximo documento do mesmo layout.
            </p>
            <Link to="/suporte">Explorar a central de conhecimento →</Link>
          </section>
        </aside>
      </div>
    </>
  );
}
