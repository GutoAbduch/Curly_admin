import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- LAYOUTS ---
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';

// --- PÁGINAS ADMIN (Gestão) ---
import Login from './pages/Login';
import Stock from './pages/Stock';
import Services from './pages/Services';
import Store from './pages/Store';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Appointments from './pages/Appointments';
import SuperAdmin from './pages/SuperAdmin';

// --- PÁGINAS CLIENTE (Público) ---
import ClientHome from './pages/client/ClientHome';
import MarketplaceHome from './pages/client/MarketplaceHome';
import BookingWizard from './pages/client/BookingWizard'; // <--- IMPORTANTE: IMPORTAR O WIZARD

// Função para detectar se estamos no ambiente ADMIN
const isAdminDomain = () => {
  const hostname = window.location.hostname;
  return hostname.includes('admin') || hostname.includes('curlyadmin');
};

function App() {
  const isAdmin = isAdminDomain();

  return (
    <Router>
      <Routes>
        
        {/* =======================================================
            CENÁRIO 1: AMBIENTE ADMIN
           ======================================================= */}
        {isAdmin ? (
          <>
            <Route path="/" element={<Navigate to="/abduch/login" replace />} />
            <Route path="/:shopId/login" element={<Login />} />

            <Route path="/:shopId/admin" element={<AdminLayout />}>
              <Route index element={<Navigate to="appointments" replace />} />
              <Route path="services" element={<Services />} />
              <Route path="stock" element={<Stock />} />
              <Route path="finance" element={<Finance />} />
              <Route path="users" element={<Users />} />
              <Route path="appointments" element={<Appointments />} />
              <Route path="store" element={<Store />} />
              <Route path="superadmin" element={<SuperAdmin />} />
            </Route>
          </>
        ) : (
          
        /* =======================================================
            CENÁRIO 2: AMBIENTE CLIENTE / MARKETPLACE
           ======================================================= */
          <>
             <Route path="/" element={<MarketplaceHome />} />
             <Route path="/categorias" element={<div className="p-10 text-white">Listagem de Categorias</div>} />

             <Route path="/:shopId" element={<ClientLayout />}>
                <Route index element={<ClientHome />} />
                
                {/* AQUI ESTAVA O ERRO: Agora chamamos o BookingWizard */}
                <Route path="agendar" element={<BookingWizard />} />
             </Route>
          </>
        )}

        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
}

export default App;