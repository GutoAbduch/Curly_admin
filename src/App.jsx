import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- CONTEXTO ---
import { ClientAuthProvider } from './context/ClientAuthContext'; // <--- NOVO

// --- LAYOUTS ---
import AdminLayout from './layouts/AdminLayout';
import ClientLayout from './layouts/ClientLayout';

// --- PÁGINAS ADMIN ---
import Login from './pages/Login';
import Stock from './pages/Stock';
import Services from './pages/Services';
import Store from './pages/Store';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Appointments from './pages/Appointments';
import SuperAdmin from './pages/SuperAdmin';

// --- PÁGINAS CLIENTE ---
import ClientHome from './pages/client/ClientHome';
import MarketplaceHome from './pages/client/MarketplaceHome';
import BookingWizard from './pages/client/BookingWizard'; 
import ClientLogin from './pages/client/ClientLogin'; // <--- NOVO

const isAdminDomain = () => {
  const hostname = window.location.hostname;
  return hostname.includes('admin') || hostname.includes('curlyadmin');
};

function App() {
  const isAdmin = isAdminDomain();

  return (
    <Router>
       {/* Envolvemos tudo no Provider do Cliente para o login funcionar globalmente */}
       <ClientAuthProvider> 
        <Routes>
          
          {/* --- AMBIENTE ADMIN --- */}
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
            
          /* --- AMBIENTE CLIENTE --- */
            <>
               {/* Home Principal */}
               <Route path="/" element={<MarketplaceHome />} />
               
               {/* Página de Login do Cliente */}
               <Route path="/entrar" element={<ClientLogin />} /> 

               {/* Área da Loja */}
               <Route path="/:shopId" element={<ClientLayout />}>
                  <Route index element={<ClientHome />} />
                  <Route path="agendar" element={<BookingWizard />} />
               </Route>
            </>
          )}

          <Route path="*" element={<Navigate to="/" />} />

        </Routes>
      </ClientAuthProvider>
    </Router>
  );
}

export default App;