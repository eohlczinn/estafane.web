import React from "react";
import {
  MapPin,
  BriefcaseBusiness,
  UserRound,
  ShieldCheck,
  LogOut,
  Instagram,
  Facebook,
  MessageCircle,
  Heart,
  Sparkles,
  Store,
  Settings,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useClosing } from "../context/ClosingContext.jsx";
import { estefaneProfile as profile } from "../services/profile.js";
import Encouragement from "../components/profile/Encouragement.jsx";

export default function Profile() {
  const { user, logout } = useAuth();
  const { prefs } = useClosing();
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <UserRound />
        </span>
        <div>
          <div className="eyebrow">UM ESPAÇO COM A SUA ESSÊNCIA</div>
          <h1>Meu perfil</h1>
          <p>Um pouco de você, da sua rotina e do que inspira seu dia.</p>
        </div>
      </div>
      <div className="personal-profile-grid">
        <section className="panel profile-page personal-profile">
          <div className="profile-banner living-card">
            <Sparkles size={24} aria-hidden="true" />
            <span>Fé no coração. Leveza na rotina.</span>
            <Heart size={23} aria-hidden="true" />
          </div>
          <img className="living-avatar" src="/estefane.jpg" alt="Estefane" />
          <div className="profile-name-row">
            <h2>{user?.name || profile.name}</h2>
            <span className="profile-age">{profile.age} anos</span>
          </div>
          <span className="profile-role">{profile.role}</span>
          <p className="profile-intro">
            Com fé, dedicação e gratidão, um dia de cada vez.
          </p>
          <div
            className="profile-socials"
            role="group"
            aria-label="Redes sociais decorativas"
          >
            {[
              [Instagram, "Instagram", "instagram"],
              [Facebook, "Facebook", "facebook"],
              [MessageCircle, "WhatsApp", "whatsapp"],
            ].map(([Icon, label, name]) => (
              <span
                key={name}
                className={`social-decoration ${name}`}
                title={`${label} · decorativo`}
              >
                <Icon size={19} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
          <p className="social-caption">
            Ícones decorativos · sem contas vinculadas
          </p>
          <dl>
            <div>
              <dt>
                <MapPin size={18} /> Cidade
              </dt>
              <dd>{profile.city}</dd>
            </div>
            <div>
              <dt>
                <Store size={18} /> Trabalho
              </dt>
              <dd>{profile.workplace}</dd>
            </div>
            <div>
              <dt>
                <BriefcaseBusiness size={18} /> Função
              </dt>
              <dd>{profile.role}</dd>
            </div>
          </dl>
          <div className="profile-actions-bar">
            <Link to="/configuracoes#efeitos" className="secondary">
              <Settings size={17} /> Personalizar meu espaço
            </Link>
          </div>
        </section>
        <aside className="profile-inspiration">
          <Encouragement prefs={prefs} />
          <section className="panel profile-routine">
            <span className="eyebrow">
              PEQUENAS COISAS, GRANDES SIGNIFICADOS
            </span>
            <h2>Seu dia também merece cuidado.</h2>
            <ul>
              <li>
                <Heart size={18} /> Uma pausa para respirar.
              </li>
              <li>
                <Sparkles size={18} /> Gratidão por cada conquista.
              </li>
              <li>
                <ShieldCheck size={18} /> Tranquilidade no fim do expediente.
              </li>
            </ul>
            <Link to="/">
              Ir para meu fechamento <span aria-hidden="true">→</span>
            </Link>
          </section>
          <div className="profile-session">
            <span>
              <ShieldCheck size={16} /> Sua conta está conectada.
            </span>
            <button
              type="button"
              className="profile-logout-btn"
              onClick={logout}
            >
              <LogOut size={16} /> Sair da conta
            </button>
          </div>
        </aside>
      </div>
    </>
  );
}
