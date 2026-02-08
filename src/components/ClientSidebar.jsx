import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useClientAuth } from '../context/ClientAuthContext';
import { Home, Calendar, User, LogOut, Menu, X } from 'lucide-react';

export default function ClientSidebar() {
  const { client, logout } = useClientAuth();
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Se não estiver logado, a sidebar nem é renderizada
  if (!client) return null;

  const toggleSidebar = () => setIsOpen(!isOpen);

  // Itens do Menu do Cliente
  const menuItems = [
    { icon: Home, label: 'Início', path: '/' },
    { icon: Calendar, label: 'Meus Agendamentos', path: '/meus-agendamentos' }, // Criaremos essa página em breve
    { icon: User, label: 'Meu Perfil', path: '/perfil' }, // Criaremos essa página em breve
  ];

  const handleLogout = async () => {
      await logout();
      navigate('/');
  };

  return (
    <>
      {/* --- MOBILE: BOTÃO HAMBÚRGUER (Só aparece em telas pequenas) --- */}
      <div className="md:hidden fixed top-4 left-4 z-[60]">
        <button 
            onClick={toggleSidebar}
            className="p-2.5 bg-white/90 backdrop-blur text-[#1a1a1a] rounded-full shadow-md border border-[#eee]"
        >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* --- OVERLAY ESCURO (Fundo escuro quando menu abre no mobile) --- */}
      {isOpen && (
        <div 
            className="md:hidden fixed inset-0 bg-black/60 z-[55] backdrop-blur-sm"
            onClick={toggleSidebar}
        />
      )}

      {/* --- SIDEBAR (CONTAINER PRINCIPAL) --- */}
      <aside className={`
        fixed top-0 left-0 h-full bg-white z-[60] shadow-2xl transition-transform duration-300 ease-in-out border-r border-[#f0f0f0]
        w-72 flex flex-col
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 md:w-64
      `}>
          
          {/* CABEÇALHO (Foto e Nome) */}
          <div className="p-8 border-b border-[#f5f5f5] flex flex-col items-center bg-[#fafafa]">
             <div className="w-20 h-20 rounded-full bg-white border-2 border-[#D4AF37] flex items-center justify-center mb-3 text-[#D4AF37] overflow-hidden shadow-sm">
                 {client.photoURL ? (
                    <img src={client.photoURL} alt="Perfil" className="w-full h-full object-cover" />
                 ) : (
                    <User className="w-8 h-8" />
                 )}
             </div>
             <h3 className="font-bold text-[#1a1a1a] text-lg text-center leading-tight">
                 {client.displayName || 'Cliente'}
             </h3>
             <p className="text-xs text-[#888] mt-1">Membro Curly</p>
          </div>

          {/* MENU DE NAVEGAÇÃO */}
          <nav className="flex-1 py-6 px-4 space-y-2">
              {menuItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                      <Link 
                        key={item.path} 
                        to={item.path}
                        onClick={() => setIsOpen(false)}
                        className={`
                            flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group font-medium
                            ${isActive 
                                ? 'bg-[#F9F7F2] text-[#D4AF37] border border-[#D4AF37]/20 shadow-sm' 
                                : 'text-[#666] hover:bg-[#f5f5f5] hover:text-[#1a1a1a]'
                            }
                        `}
                      >
                          <item.icon className={`w-5 h-5 ${isActive ? 'text-[#D4AF37]' : 'text-[#999] group-hover:text-[#1a1a1a]'}`} />
                          <span className="text-sm">{item.label}</span>
                      </Link>
                  );
              })}
          </nav>

          {/* RODAPÉ (Botão Sair) */}
          <div className="p-4 border-t border-[#f5f5f5]">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition font-bold text-sm justify-center"
              >
                  <LogOut className="w-5 h-5" />
                  Sair
              </button>
          </div>
      </aside>
    </>
  );
}