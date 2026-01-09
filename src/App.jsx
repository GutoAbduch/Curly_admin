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

// Função para detectar se estamos no ambiente ADMIN
const isAdminDomain = () => {
  const hostname = window.location.hostname;
  // Retorna TRUE se a URL tiver 'admin' (ex: admin.localhost ou curlyadmin.com)
  return hostname.includes('admin') || hostname.includes('curlyadmin');
};

function App() {
  const isAdmin = isAdminDomain();

  return (
    <Router>
      <Routes>
        
        {/* =======================================================
            CENÁRIO 1: AMBIENTE ADMIN (curlyadmin.com)
           ======================================================= */}
        {isAdmin ? (
          <>
            {/* Raiz do Admin: Manda para o Login da loja Mestra (Temporário) */}
            <Route path="/" element={<Navigate to="/abduch/login" replace />} />

            {/* Rota de Login */}
            <Route path="/:shopId/login" element={<Login />} />

            {/* Painel Administrativo */}
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
            CENÁRIO 2: AMBIENTE CLIENTE / MARKETPLACE (curlyclients.com)
           ======================================================= */
          <>
             {/* ROTA RAIZ (Marketplace Home): 
                Na Fase 2, aqui entrará a busca e categorias.
                Por enquanto, redireciona para a loja 'abduch' para testarmos o layout do cliente.
             */}
             <Route path="/" element={<Navigate to="/abduch" replace />} />
             
             {/* Futura rota de Categorias */}
             <Route path="/categorias" element={<div className="p-10 text-white">Listagem de Categorias (Em Breve)</div>} />

             {/* Rota da Loja Específica (Site Personalizado) */}
             <Route path="/:shopId" element={<ClientLayout />}>
                <Route index element={<ClientHome />} />
                
                {/* Wizard de Agendamento */}
                <Route path="agendar" element={<div className="h-screen flex items-center justify-center text-white font-bold">Assistente de Agendamento (Em Breve)</div>} />
             </Route>
          </>
        )}

        {/* Fallback Global (404) */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
}

export default App;