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

  // AJUSTE AQUI: Verifica se é a Loja Mestra (abduch)
  const isMasterStore = shopId === 'abduch';

  return (
    <aside className="w-64 bg-[#050505] border-r border-[#222] flex flex-col h-screen fixed left-0 top-0 z-40">
      {/* LOGO */}
      <div className="p-8 flex items-center justify-center border-b border-[#222]">
        <h1 className="text-3xl font-black text-[#D4AF37] font-egyptian tracking-widest drop-shadow-[0_0_10px_rgba(212,175,55,0.5)]">
            CURLY
        </h1>
      </div>

      {/* MENU */}
      <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <p className="px-4 text-[10px] font-bold text-[#555] uppercase mb-3 tracking-[0.15em]">Principal</p>
        
        {/* Agendamentos: Todos veem */}
        <div onClick={() => navTo('/admin/appointments')} className={getItemClass('/admin/appointments')}>
           <i className="fas fa-calendar-alt w-5 text-center"></i>
           <span>Agenda</span>
        </div>

        {/* Serviços: Todos veem (Barbeiros apenas visualizam na lógica interna) */}
        <div onClick={() => navTo('/admin/services')} className={getItemClass('/admin/services')}>
           <i className="fas fa-cut w-5 text-center"></i>
           <span>Serviços</span>
        </div>

        {/* ADMINISTRAÇÃO: Admin e Gerente */}
        {['Admin', 'Gerente', 'Financeiro'].includes(userRole) && (
            <>
                <p className="px-4 text-[10px] font-bold text-[#555] uppercase mt-8 mb-3 tracking-[0.15em]">Gestão</p>

                <div onClick={() => navTo('/admin/stock')} className={getItemClass('/admin/stock')}>
                    <i className="fas fa-box-open w-5 text-center"></i>
                    <span>Estoque</span>
                </div>
            </>
        )}

        {/* FINANCEIRO: Admin e Financeiro */}
        {['Admin', 'Financeiro'].includes(userRole) && (
            <div onClick={() => navTo('/admin/finance')} className={getItemClass('/admin/finance')}>
            <i className="fas fa-chart-line w-5 text-center"></i>
            <span>Financeiro</span>
            </div>
        )}

        {/* CONFIGURAÇÕES: Admin e Gerente */}
        {['Admin', 'Gerente'].includes(userRole) && (
            <>
                <p className="px-4 text-[10px] font-bold text-[#555] uppercase mt-8 mb-3 tracking-[0.15em]">Configuração</p>

                <div onClick={() => navTo('/admin/users')} className={getItemClass('/admin/users')}>
                    <i className="fas fa-users-cog w-5 text-center"></i>
                    <span>Equipe</span>
                </div>

                <div onClick={() => navTo('/admin/store')} className={getItemClass('/admin/store')}>
                <i className="fas fa-store w-5 text-center"></i>
                <span>Loja</span>
                </div>
            </>
        )}

        {/* SUPER ADMIN: Apenas para a loja abduch e usuário Master */}
        {isMasterStore && userRole === 'Admin' && (
             <>
                <p className="px-4 text-[10px] font-bold text-gold uppercase mt-8 mb-3 tracking-[0.15em]">HOLDING</p>
                <div onClick={() => navTo('/admin/superadmin')} className={getItemClass('/admin/superadmin')}>
                    <i className="fas fa-globe text-gold w-5 text-center"></i>
                    <span className="text-gold">Franquias</span>
                </div>
             </>
        )}

      </nav>

      <div className="p-4 border-t border-[#222]">
        <button onClick={handleLogout} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-[#666] hover:text-red-400 hover:bg-[#1a0505] transition-all duration-300 text-sm font-bold border border-transparent hover:border-red-900/30">
          <i className="fas fa-sign-out-alt w-5 text-center"></i>
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}