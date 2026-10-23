import React, {lazy, Suspense} from "react";
import { Routes, Route } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ClosingProvider } from "./context/ClosingContext.jsx";
import Layout from "./components/layout/Layout.jsx";
import Login from "./components/auth/Login.jsx";
import Home from "./pages/Home.jsx";
import { ExperienceProvider } from './context/ExperienceContext.jsx';
const Report=lazy(()=>import('./pages/Report.jsx'));
const Settings=lazy(()=>import('./pages/Settings.jsx'));
const Profile=lazy(()=>import('./pages/Profile.jsx'));
const Support=lazy(()=>import('./pages/Support.jsx'));
import Results from "./pages/Results.jsx";
import BatchResults from "./pages/BatchResults.jsx";

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="app-loading-card">
          <div className="app-loading-logo">
            <ShoppingCart size={32} />
          </div>
          <h2>estefane-web/</h2>
          <p>Conectando ao servidor seguro...</p>
          <div className="login-spinner large" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ClosingProvider>
      <ExperienceProvider>
      <Layout>
        <Suspense fallback={<div className="route-loading" role="status">Preparando seu espaço…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ler-pdf" element={<Home reader />} />
          <Route path="/relatorio" element={<Report />} />
          <Route path="/resultado" element={<Results />} />
          <Route path="/lote" element={<BatchResults />} />
          <Route path="/imprimir" element={<Report printPage />} />
          <Route path="/configuracoes" element={<Settings />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="/suporte" element={<Support />} />
          <Route path="*" element={<Home />} />
        </Routes>
        </Suspense>
      </Layout>
      </ExperienceProvider>
    </ClosingProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
