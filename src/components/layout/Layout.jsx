import React, { useState } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  ShoppingCart,
  House,
  FileText,
  ChartNoAxesColumnIncreasing,
  Printer,
  Settings,
  Headphones,
  Sun,
  Moon,
  Bell,
  ChevronDown,
  UserRound,
  MapPin,
  BriefcaseBusiness,
  Menu,
  X,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  LogOut,
} from "lucide-react";
import { useClosing } from "../../context/ClosingContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const links = [
  ["/", "Início", House],
  ["/ler-pdf", "Ler PDF", FileText],
  ["/lote", "Fechamentos", ChartNoAxesColumnIncreasing],
  ["/relatorio", "Relatório", ChartNoAxesColumnIncreasing],
  ["/imprimir", "Imprimir", Printer],
  ["/configuracoes", "Configurações", Settings],
  ["/suporte", "Suporte", Headphones],
];

export default function Layout({ children }) {
  const location = useLocation();
  const { prefs, setPrefs, notice, busy, confirmed, backend, filename } =
      useClosing(),
    { logout, user } = useAuth(),
    [menu, setMenu] = useState(false),
    [profile, setProfile] = useState(false),
    [notifications, setNotifications] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <Link className="brand" to="/">
          <ShoppingCart />
          <span>
            estefane<span className="brand-web">-web/</span>
          </span>
        </Link>
        <button
          className="mobile-close icon-btn"
          onClick={() => setMenu(false)}
          aria-label="Fechar menu"
        >
          <X />
        </button>
        <div className="nav-label">ESPAÇO DE TRABALHO</div>
        <nav>
          {links.map(([to, label, Icon]) => (
            <NavLink
              end={to === "/"}
              key={to}
              to={to}
              onClick={() => setMenu(false)}
            >
              <Icon size={21} />
              <span>{label}</span>
              <span className="nav-dot" />
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <div className="cart-art">
            <ShoppingCart size={65} />
            <Sparkles className="spark" size={22} />
          </div>
          <h3>
            Seu caixa em dia.
            <br />
            Sua rotina mais leve.
          </h3>
          <p>
            Do PDF ao fechamento,
            <br />
            com clareza e confiança.
          </p>
          <div className="sidebar-flow">
            PDF <span>→</span> Conferência <span>→</span> Relatório
          </div>
        </div>
        <div className="local-tag">
          <ShieldCheck size={15} /> Sessão autenticada e protegida
        </div>
        <button
          className="sidebar-logout-btn"
          onClick={() => {
            setMenu(false);
            logout();
          }}
          title="Encerrar sessão"
        >
          <LogOut size={16} />
          <span>Sair da conta</span>
        </button>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-btn"
              onClick={() => setMenu(true)}
              aria-label="Abrir menu"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Seu espaço <span>/</span> <strong>Fechamento de caixa</strong>
            </span>
          </div>
          <div className="top-actions">
            <span
              title={
                backend === "online"
                  ? "Servidor respondendo"
                  : backend === "offline"
                    ? "Servidor sem resposta"
                    : "Verificando servidor"
              }
              className={`processing ${busy ? "working" : ""} ${backend === "offline" ? "backend-offline" : ""}`}
            >
              <i />
              {busy
                ? "Analisando PDF"
                : confirmed
                  ? "Fechamento confirmado"
                  : backend === "offline"
                    ? "Servidor indisponível"
                    : backend === "checking"
                      ? "Verificando servidor"
                      : filename
                        ? "PDF pronto para conferir"
                        : "Servidor conectado"}
            </span>
            <button
              className="theme-switch icon-btn"
              title="Alternar tema"
              aria-label="Alternar tema"
              onClick={() =>
                setPrefs({
                  ...prefs,
                  theme:
                    document.documentElement.dataset.theme === "dark"
                      ? "light"
                      : "dark",
                })
              }
            >
              <Sun size={18} />
              <span className="switch-track">
                <i />
              </span>
              <Moon size={17} />
            </button>
            <div className="popover-wrap">
              <button
                className="icon-btn notification-btn"
                aria-label="Notificações"
                onClick={() => {
                  setNotifications(!notifications);
                  setProfile(false);
                }}
              >
                <Bell size={21} />
                {notice && <i />}
              </button>
              {notifications && (
                <div className="popover notification-pop">
                  <h3>Notificações do sistema</h3>
                  <p>
                    {notice ||
                      "Nenhuma notificação. Seu próximo fechamento começa com um PDF."}
                  </p>
                </div>
              )}
            </div>
            <div className="popover-wrap">
              <button
                className="profile-trigger"
                onClick={() => {
                  setProfile(!profile);
                  setNotifications(false);
                }}
                aria-expanded={profile}
              >
                <img src="/estefane.jpg" alt="Estefane" />
                <strong>{user?.name || "Estefane"}</strong>
                <ChevronDown size={17} />
              </button>
              {profile && (
                <div className="popover profile-pop">
                  <div className="profile-summary">
                    <img src="/estefane.jpg" alt="Estefane" />
                    <div>
                      <h3>{user?.name || "Estefane"}</h3>
                      <p>22 anos</p>
                      <span>
                        <MapPin size={13} /> Águas Lindas de Goiás
                      </span>
                    </div>
                  </div>
                  {[
                    [
                      UserRound,
                      "Meu perfil",
                      "Informações pessoais",
                      "/perfil",
                    ],
                    [
                      BriefcaseBusiness,
                      "Perfil profissional",
                      "Operadora de caixa",
                      "/perfil",
                    ],
                    [
                      Settings,
                      "Configurações",
                      "Preferências do sistema",
                      "/configuracoes",
                    ],
                  ].map(([Icon, title, sub, to]) => (
                    <button
                      key={title}
                      onClick={() => {
                        navigate(to);
                        setProfile(false);
                      }}
                    >
                      <Icon size={20} />
                      <span>
                        <strong>{title}</strong>
                        <small>{sub}</small>
                      </span>
                    </button>
                  ))}
                  <button
                    className="logout-pop-btn"
                    onClick={() => {
                      setProfile(false);
                      logout();
                    }}
                  >
                    <LogOut size={18} />
                    <span>
                      <strong>Sair da conta</strong>
                      <small>Encerrar sessão no servidor</small>
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        {backend === "offline" && (
          <div className="backend-alert" role="alert">
            O servidor está indisponível. Verifique a conexão ou tente
            novamente. Você ainda pode revisar os dados desta sessão.
          </div>
        )}
        <main key={location.pathname}>{children}</main>
        <footer>
          <span>
            estefane-web <span className="footer-dot">•</span> Fechamento com
            confiança
          </span>
          <span>
            <ShieldCheck size={13} /> Processado no servidor desta instalação
          </span>
        </footer>
      </div>
    </div>
  );
}
