import React from "react";
import {
  MapPin,
  BriefcaseBusiness,
  UserRound,
  ShieldCheck,
  LogOut,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function Profile() {
  const { user, logout } = useAuth();

  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <UserRound />
        </span>
        <div>
          <h1>Meu perfil</h1>
          <p>Suas informações e status da sessão autenticada.</p>
        </div>
      </div>
      <section className="panel profile-page">
        <div className="profile-banner" />
        <img src="/estefane.jpg" alt="Estefane" />
        <h1>{user?.name || "Estefane"}</h1>
        <span className="profile-role">{user?.role || "Operadora de caixa"}</span>
        <dl>
          <div>
            <dt>
              <UserRound size={18} /> Usuário
            </dt>
            <dd>{user?.username || "estefane"}</dd>
          </div>
          <div>
            <dt>
              <MapPin size={18} /> Cidade
            </dt>
            <dd>Águas Lindas de Goiás</dd>
          </div>
          <div>
            <dt>
              <BriefcaseBusiness size={18} /> Função
            </dt>
            <dd>{user?.role || "Operadora de caixa"}</dd>
          </div>
          <div>
            <dt>
              <Lock size={18} /> Segurança
            </dt>
            <dd>Sessão HttpOnly criptografada</dd>
          </div>
        </dl>
        <p className="privacy-hint">
          <ShieldCheck size={16} /> Sessão autenticada e protegida com segurança no servidor.
        </p>
        <div className="profile-actions-bar">
          <button
            type="button"
            className="profile-logout-btn"
            onClick={logout}
          >
            <LogOut size={16} />
            <span>Encerrar sessão (Logout)</span>
          </button>
        </div>
      </section>
    </>
  );
}
