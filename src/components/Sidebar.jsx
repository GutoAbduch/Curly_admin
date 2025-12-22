import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function Sidebar({ userRole, shopId }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await signOut(auth);
    navigate(`/${shopId}/login`);
  };

  const getItemClass = (path) => {
    const isActive = location.pathname.includes(path);
    return isActive 
      ? "flex items-center gap-3 px-4 py-3 rounded-xl bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all duration-300 cursor-pointer mb-2 text-sm font-bold"
      : "flex items-center gap-3 px-4 py-3 rounded-xl text-[#888] hover:text-[#D4AF37] hover:bg-[#1a1a1a] transition-all duration-300 cursor-pointer mb-2 text-sm font-medium";
  };

  const navTo = (path) => { navigate(`/${shopId}${path}`); };

  // Verifica se é a Loja Mestra
  const isMasterStore = shopId === 'testeloja';

  return (
    <aside className="w-64 bg-[#0a0a0a] h-screen flex flex-col fixed left-0 top-0 border-r border-[#222] shadow-2xl z-50">
      
      <div className="h-24 flex items-center px-6 border-b border-[#222]">
        <div className="flex items-center gap-3 text-[#D4AF37]">
            <div className="w-10 h-10 border border-[#D4AF37] rounded flex items-center justify-center shadow-[0_0_10px_rgba(212,175,55,0.2)]">
                <i className="fas fa-cut text-lg"></i>
            </div>
            <div className="leading-none">
                <h1 className="text-2xl font-black font-egyptian tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-[#D4AF37] to-[#F3E5AB]">
                    CURLY
                </h1>
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#888] font-bold block mt-1">
                    Management Store
                </span>
            </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-8 px-4 space-y-1">
        
        {/* BOTÃO EXCLUSIVO SUPER ADMIN (HOLDING) */}
        {isMasterStore && (
            <div className="mb-6 pb-6 border-b border-[#222]">
                <p className="px-4 text-[10px] font-bold text-red-500 uppercase mb-3 tracking-[0.15em]">HOLDING</p>
                <div onClick={() => navTo('/admin/superadmin')} className={getItemClass('/admin/superadmin')}>
                    <i className="fas fa-globe w-5 text-center"></i>
                    <span>Gestão de Franquias</span>
                </div>
            </div>
        )}

        <p className="px-4 text-[10px] font-bold text-[#555] uppercase mb-3 tracking-[0.15em]">Gestão</p>

        <div onClick={() => navTo('/admin/appointments')} className={getItemClass('/admin/appointments')}>
            <i className="fas fa-calendar-check w-5 text-center"></i>
            <span>Agendamentos</span>
        </div>

        <div onClick={() => navTo('/admin/services')} className={getItemClass('/admin/services')}>
          <i className="fas fa-cut w-5 text-center"></i>
          <span>Serviços</span>
        </div>
        
        <div onClick={() => navTo('/admin/stock')} className={getItemClass('/admin/stock')}>
          <i className="fas fa-boxes w-5 text-center"></i>
          <span>Estoque</span>
        </div>

        <div onClick={() => navTo('/admin/finance')} className={getItemClass('/admin/finance')}>
          <i className="fas fa-chart-line w-5 text-center"></i>
          <span>Financeiro</span>
        </div>

        <p className="px-4 text-[10px] font-bold text-[#555] uppercase mt-8 mb-3 tracking-[0.15em]">Configuração</p>

        <div onClick={() => navTo('/admin/users')} className={getItemClass('/admin/users')}>
            <i className="fas fa-users-cog w-5 text-center"></i>
            <span>Equipe</span>
        </div>

        <div onClick={() => navTo('/admin/store')} className={getItemClass('/admin/store')}>
          <i className="fas fa-store w-5 text-center"></i>
          <span>Loja</span>
        </div>
      </nav>

      <div className="p-4 border-t border-[#222]">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#666] hover:text-red-400 hover:bg-[#1a0505] transition-all duration-300 text-sm font-bold border border-transparent hover:border-red-900/30">
            <i className="fas fa-sign-out-alt"></i>
            <span>Encerrar Sessão</span>
        </button>
      </div>

    </aside>
  );
}