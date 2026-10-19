import React from "react";
import { Routes, Route } from "react-router-dom";
import { ClosingProvider } from "./context/ClosingContext.jsx";
import Layout from "./components/layout/Layout.jsx";
import Home from "./pages/Home.jsx";
import Report from "./pages/Report.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Support from "./pages/Support.jsx";
import Results from "./pages/Results.jsx";
import BatchResults from "./pages/BatchResults.jsx";
export default function App() {
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
