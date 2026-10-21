import React from "react";
import { Routes, Route } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import { ClosingProvider } from "./context/ClosingContext.jsx";
import Layout from "./components/layout/Layout.jsx";
import Login from "./components/auth/Login.jsx";
import Home from "./pages/Home.jsx";
import Report from "./pages/Report.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Support from "./pages/Support.jsx";
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
      <Layout>
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
      </Layout>
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
