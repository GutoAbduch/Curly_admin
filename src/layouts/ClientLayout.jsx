import React, { useState, useEffect } from 'react';
import { Outlet, useParams, Link, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Instagram, MapPin, Phone, Calendar, Home, User } from 'lucide-react';

export default function ClientLayout() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  const [storeConfig, setStoreConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const docRef = doc(db, `artifacts/${shopId}/public/data/store_settings/full_config`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setStoreConfig(docSnap.data());
      } catch (error) { console.error("Erro config:", error); } 
      finally { setLoading(false); }
    };
    loadConfig();
  }, [shopId]);

  // Loading com fundo claro
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2] text-[#D4AF37] font-bold">Carregando experiência...</div>;

  // Erro com fundo claro
  if (!storeConfig) return <div className="min-h-screen flex items-center justify-center bg-[#F9F7F2] text-black">Loja não encontrada.</div>;

  const primaryColor = storeConfig.primaryColor || '#D4AF37'; 

  return (
    // MUDANÇA AQUI: bg-[#050505] -> bg-[#F9F7F2] e text-white -> text-[#1a1a1a]
    <div className="min-h-screen flex flex-col font-sans bg-[#F9F7F2] text-[#1a1a1a]" 
         style={{ 
             '--primary': primaryColor,
             backgroundImage: 'radial-gradient(circle at 50% 0%, #ffffff 0%, #F9F7F2 80%)' // Efeito de luz suave
         }}>
      
      {/* HEADER FLUTUANTE */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-3 pointer-events-none">
         <div className="max-w-5xl mx-auto flex justify-between items-center">
             
             {/* Botão Voltar para Marketplace */}
             <button 
                onClick={() => navigate('/')}
                className="pointer-events-auto bg-white/80 backdrop-blur-md border border-[#eee] text-[#333] hover:text-[--primary] hover:border-[--primary] px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-all transform hover:scale-105"
             >
                <Home className="w-4 h-4" /> 
                <span className="hidden sm:inline">Início</span>
             </button>

             {/* Botão Login */}
             <button 
                onClick={() => alert("O Login Unificado será implementado na próxima etapa!")}
                className="pointer-events-auto bg-black/90 text-white hover:bg-[--primary] px-5 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-bold transition-all transform hover:scale-105"
             >
                <User className="w-4 h-4" /> 
                <span>Entrar</span>
             </button>

         </div>
      </header>

      {/* CONTEÚDO */}
      <main className="flex-1 relative">
        <Outlet context={{ storeConfig, shopId }} />
      </main>

      {/* FOOTER CLARO */}
      <footer className="bg-[#fff] border-t border-[#eee] pb-12 pt-16 mt-auto relative overflow-hidden">
          <div className="max-w-md mx-auto px-6 text-center space-y-8 relative z-10">
              
              <div className="space-y-4">
                  <h2 className="text-2xl font-black font-egyptian tracking-widest text-[#1a1a1a]">
                      {storeConfig.name}
                  </h2>
                  
                  <div className="space-y-2 text-sm text-[#555]">
                      {storeConfig.address && (
                          <p className="flex items-center justify-center gap-2">
                              <MapPin className="w-3 h-3 text-[--primary]" /> {storeConfig.address}
                          </p>
                      )}
                      {storeConfig.phone && (
                          <p className="flex items-center justify-center gap-2">
                              <Phone className="w-3 h-3 text-[--primary]" /> {storeConfig.phone}
                          </p>
                      )}
                  </div>
              </div>

              <div className="flex justify-center gap-6">
                  {storeConfig.instagram && (
                      <a href={`https://instagram.com/${storeConfig.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="group">
                          <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[#fcfcfc] border border-[#ddd] shadow-sm group-hover:border-[--primary] group-hover:text-[--primary] transition-all duration-300">
                              <Instagram className="w-5 h-5 text-[#888] group-hover:text-[--primary] transition-colors" />
                          </div>
                      </a>
                  )}
                  <Link to={`/${shopId}/agendar`} className="group">
                      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[#fcfcfc] border border-[#ddd] shadow-sm group-hover:border-[--primary] group-hover:text-[--primary] transition-all duration-300">
                          <Calendar className="w-5 h-5 text-[#888] group-hover:text-[--primary] transition-colors" />
                      </div>
                  </Link>
              </div>
              
              <div className="pt-10 mt-8 border-t border-[#f0f0f0] flex flex-col items-center justify-center gap-2">
                  <p className="text-[10px] text-[#999] uppercase tracking-[0.3em]">
                      Powered by Curly
                  </p>
              </div>
          </div>
      </footer>
    </div>
  );
}