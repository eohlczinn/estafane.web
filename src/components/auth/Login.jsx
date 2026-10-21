import React, { useState } from "react";
import {
  ShoppingCart,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  LogIn,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Login() {
  const { login, authError, sessionExpired } = useAuth();
  const [username, setUsername] = useState("estefane");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!username.trim()) {
      setLocalError("Informe o nome de usuário.");
      return;
    }
    if (!password) {
      setLocalError("Digite sua senha de acesso.");
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setLocalError(err.message || "Erro ao entrar.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeError = localError || authError;

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <div className="login-avatar-wrap">
              <img
                src="/estefane.jpg"
                alt="Estefane"
                className="login-avatar"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <span className="login-badge-dot" title="Acesso Seguro" />
            </div>

            <div className="login-brand">
              <ShoppingCart size={22} className="login-brand-icon" />
              <span>
                estefane<span className="brand-web">-web/</span>
              </span>
            </div>

            <h1>Acesso ao Fechamento de Caixa</h1>
            <p>
              Olá, Estefane! Digite suas credenciais para acessar o painel de conferência.
            </p>
          </div>

          {sessionExpired && (
            <div className="login-alert warning" role="alert">
              <AlertCircle size={18} />
              <span>Sua sessão expirou por segurança. Faça login novamente para continuar.</span>
            </div>
          )}

          {activeError && (
            <div className="login-alert error" role="alert">
              <AlertCircle size={18} />
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="login-field">
              <label htmlFor="login-username">Usuário</label>
              <div className="login-input-wrap">
                <User size={18} className="field-icon" />
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Seu usuário"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  disabled={submitting}
                  required
                />
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Senha de acesso</label>
              <div className="login-input-wrap">
                <Lock size={18} className="field-icon" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  disabled={submitting}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <span className="login-spinner" />
                  <span>Verificando credenciais...</span>
                </>
              ) : (
                <>
                  <span>Entrar no Caixa</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="login-security-footer">
            <div className="security-item">
              <ShieldCheck size={16} />
              <span>Sessão segura por Cookie HttpOnly</span>
            </div>
            <div className="security-item">
              <Sparkles size={16} />
              <span>Criptografia scrypt &amp; proteção contra força bruta</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

