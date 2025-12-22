import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import Sidebar from '../components/Sidebar';

export default function AdminLayout() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const navigate = useNavigate();
  const { shopId } = useParams(); // Captura 'renovosbbs' ou 'teambts' da URL
  
  // SEU E-MAIL MESTRE (GOD MODE)
  const MASTER_EMAIL = 'gutoabduch@gmail.com';

  useEffect(() => {
    // Se tentarem acessar sem um ID de loja na URL, joga pro login
    if (!shopId) { navigate('/'); return; }

    const unsubscribe = onAuthStateChanged(auth, async (currUser) => {
      if (currUser) {
        setUser(currUser);

        // --- LÓGICA DO LOGIN MESTRE ---
        // Se o email for o seu, você vira Admin automaticamente, ignorando o banco de dados.
        if (currUser.email === MASTER_EMAIL) {
            setRole('Admin');
            setLoading(false);
            return; 
        }

        // --- LÓGICA PARA OUTROS USUÁRIOS ---
        try {
          // Verifica permissões DENTRO da loja específica (shopId)
          const snap = await getDoc(doc(db, `artifacts/${shopId}/public/data/users/${currUser.uid}`));
          setRole(snap.exists() ? snap.data().role : 'Guest');
        } catch (e) { 
            console.error("Erro ao verificar permissão:", e);
            setRole('User'); 
        }
        setLoading(false);

      } else {
        // Redireciona para o login DAQUELA loja específica
        navigate(`/${shopId}/login`);
      }
    });
    return () => unsubscribe();
  }, [navigate, shopId]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-[#D4AF37]">Carregando {shopId?.toUpperCase()}...</div>;

  return (
    <div className="flex min-h-screen bg-[#050505] font-sans text-[#F3E5AB]">
      
      {/* Passamos o shopId para o menu saber construir os links certos */}
      <Sidebar userRole={role} shopId={shopId} />

      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        
        {/* HEADER SUPERIOR */}
        <header className="bg-[#0a0a0a] h-20 border-b border-[#222] sticky top-0 z-30 px-8 flex items-center justify-between shadow-lg">
          <div>
            <h2 className="text-xl font-bold text-[#D4AF37] font-egyptian tracking-wide">PAINEL ADMINISTRATIVO</h2>
            {/* Mostra em qual loja estamos conectados */}
            <p className="text-xs text-[#666] tracking-wider uppercase">Loja: <span className="text-[#eee] font-bold">{shopId}</span></p>
          </div>

          <div className="flex items-center gap-4">
             <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-[#eee]">{user?.displayName || user?.email}</p>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded text-black ${role === 'Admin' ? 'bg-red-500' : 'bg-[#D4AF37]'}`}>
                    {user?.email === MASTER_EMAIL ? 'MASTER' : role}
                </span>
             </div>
             <div className="h-10 w-10 bg-[#222] rounded-full flex items-center justify-center text-[#D4AF37] border border-[#333] shadow-sm">
                <i className="fas fa-user"></i>
             </div>
          </div>
        </header>

        {/* ÁREA DE CONTEÚDO */}
        <main className="flex-1 p-8 overflow-x-hidden">
          <div className="fade-in max-w-6xl mx-auto">
             {/* Enviamos o shopId para todas as páginas filhas via Contexto */}
             <Outlet context={{ user, role, shopId }} />
          </div>
        </main>

      </div>
    </div>
  );
}