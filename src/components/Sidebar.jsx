import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Scissors, 
  Package, 
  DollarSign, 
  LogOut, 
  Globe, 
  Lock 
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../config/firebase';
import { canAccess } from '../config/plans'; // Importamos a regra de negócio

export default function Sidebar({ userRole, shopId, storePlan }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) => {
    return location.pathname.includes(path) 
      ? "flex items-center gap-3 p-3 rounded-xl bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all" 
      : "flex items-center gap-3 p-3 rounded-xl text-[#888] hover:bg-[#222] hover:text-[#eee] transition-all";
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate(`/${shopId}/login`);
  };

  const isMasterStore = shopId?.toLowerCase() === 'abduch';

  return (
    <aside className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col h-screen fixed left-0 top-0 z-40">
      
      {/* LOGO E PLANO */}
      <div className="p-8 flex flex-col items-center border-b border-[#222]">
         <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Scissors className="text-[#D4AF37] w-8 h-8" />
         </div>
         <h1 className="text-xl font-black font-egyptian tracking-widest text-white">CURLY</h1>
         
         {/* Badge do Plano */}
         <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#666] uppercase tracking-widest">{shopId}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-opacity-20 ${
                storePlan === 'Black' ? 'bg-white text-black border-white' : 
                storePlan === 'Pro' ? 'bg-blue-900/30 text-blue-400 border-blue-500' : 
                'bg-[#222] text-[#888] border-[#444]'
            }`}>
                {storePlan}
            </span>
         </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        
        <p className="px-4 text-[10px] font-bold text-[#444] uppercase mb-2 mt-2">Gestão</p>

        {/* MÓDULOS BÁSICOS (SEMPRE ABERTOS) */}
        <Link to={`/${shopId}/admin/services`} className={isActive('services')}>
          <Scissors className="w-5 h-5" />
          <span>Serviços</span>
        </Link>

        <Link to={`/${shopId}/admin/appointments`} className={isActive('appointments')}>
          <Calendar className="w-5 h-5" />
          <span>Agenda</span>
        </Link>

        {/* ESTOQUE (CONDICIONAL) */}
        {canAccess(storePlan, 'stock') ? (
            <Link to={`/${shopId}/admin/stock`} className={isActive('stock')}>
              <Package className="w-5 h-5" />
              <span>Estoque</span>
            </Link>
        ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl text-[#444] cursor-not-allowed group relative">
              <Lock className="w-5 h-5 group-hover:text-red-500 transition-colors" />
              <span>Estoque</span>
              <span className="absolute right-2 text-[8px] border border-[#333] px-1 rounded text-[#444]">PRO</span>
            </div>
        )}

        {/* ÁREA ADMINISTRATIVA */}
        {['Gerente', 'Admin'].includes(userRole) && (
          <>
            <p className="px-4 text-[10px] font-bold text-[#444] uppercase mb-2 mt-6">Administrativo</p>
            
            {/* FINANCEIRO (CONDICIONAL - SÓ BLACK) */}
            {canAccess(storePlan, 'finance') ? (
                <Link to={`/${shopId}/admin/finance`} className={isActive('finance')}>
                  <DollarSign className="w-5 h-5" />
                  <span>Financeiro</span>
                </Link>
            ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl text-[#444] cursor-not-allowed group relative">
                   <Lock className="w-5 h-5 group-hover:text-red-500 transition-colors" />
                   <span>Financeiro</span>
                   <span className="absolute right-2 text-[8px] border border-[#333] px-1 rounded text-[#444]">BLACK</span>
                </div>
            )}

            <Link to={`/${shopId}/admin/users`} className={isActive('users')}>
              <Users className="w-5 h-5" />
              <span>Equipe</span>
            </Link>

            <Link to={`/${shopId}/admin/store`} className={isActive('store')}>
              <LayoutDashboard className="w-5 h-5" />
              <span>Minha Loja</span>
            </Link>
          </>
        )}

        {/* ÁREA HOLDING (SÓ GUTO) */}
        {isMasterStore && userRole === 'Admin' && (
           <div className="mt-8 pt-4 border-t border-[#222]">
              <p className="px-4 text-[10px] font-bold text-[#D4AF37] uppercase mb-3 tracking-[0.15em] flex items-center gap-2">
                 <Globe className="w-3 h-3" /> HOLDING
              </p>
              <Link to={`/${shopId}/admin/superadmin`} className={isActive('superadmin')}>
                  <Globe className="w-5 h-5" />
                  <span>Franquias</span>
              </Link>
           </div>
        )}

      </nav>

      <div className="p-4 border-t border-[#222]">
        <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full rounded-xl text-red-500 hover:bg-red-900/10 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-bold">Sair</span>
        </button>
      </div>
    </aside>
  );
}