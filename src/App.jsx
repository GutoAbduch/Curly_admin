import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Stock from './pages/Stock';
import Services from './pages/Services';
import Store from './pages/Store';
import Finance from './pages/Finance';
import Users from './pages/Users';
import Appointments from './pages/Appointments';
import SuperAdmin from './pages/SuperAdmin'; // <--- Import Novo
import AdminLayout from './layouts/AdminLayout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/renovosbbs/login" />} />
        
        <Route path="/:shopId/login" element={<Login />} />
        
        <Route path="/:shopId/admin" element={<AdminLayout />}>
          <Route path="services" element={<Services />} />
          <Route path="stock" element={<Stock />} />
          <Route path="finance" element={<Finance />} />
          <Route path="users" element={<Users />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="store" element={<Store />} />
          
          {/* NOVA ROTA MASTER */}
          <Route path="superadmin" element={<SuperAdmin />} />
          
          <Route index element={<Navigate to="services" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;