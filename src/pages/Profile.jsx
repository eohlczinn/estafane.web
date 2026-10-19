import React from "react";
import {
  MapPin,
  BriefcaseBusiness,
  UserRound,
  ShieldCheck,
} from "lucide-react";
export default function Profile() {
  return (
    <>
      <div className="page-heading">
        <span className="heading-icon">
          <UserRound />
        </span>
        <div>
          <h1>Meu perfil</h1>
          <p>Suas informações no espaço de trabalho.</p>
        </div>
      </div>
      <section className="panel profile-page">
        <div className="profile-banner" />
        <img src="/estefane.jpg" alt="Estefane" />
        <h1>Estefane</h1>
        <span className="profile-role">Operadora de caixa</span>
        <dl>
          <div>
            <dt>
              <UserRound size={18} /> Idade
            </dt>
            <dd>22 anos</dd>
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
            <dd>Operadora de caixa</dd>
          </div>
        </dl>
        <p className="privacy-hint">
          <ShieldCheck size={16} /> Perfil local e informativo. Sem conta ou
          autenticação.
        </p>
      </section>
    </>
  );
}
