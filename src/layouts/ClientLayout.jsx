import React, { useState, useEffect } from 'react';
import { Outlet, useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Instagram, MapPin, Phone, Calendar } from 'lucide-react';

export default function ClientLayout() {
  const { shopId } = useParams();
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

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-[#D4AF37] font-bold">Carregando...</div>;

  if (!storeConfig) return <div className="min-h-screen flex items-center justify-center bg-[#050505] text-white">Loja não encontrada.</div>;

  const primaryColor = storeConfig.primaryColor || '#D4AF37'; 

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#050505] text-white" style={{ '--primary': primaryColor }}>
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-md border-b border-[#222] shadow-sm">
         <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
             <div className="flex items-center gap-3">
                {storeConfig.logoUrl ? (
                    <img src={storeConfig.logoUrl} className="h-10 w-10 rounded-full object-cover border border-[#333]" alt="Logo" />
                ) : (
                    <div className="h-10 w-10 rounded-full bg-[#222] flex items-center justify-center font-bold text-[--primary]">
                        {storeConfig.name?.charAt(0)}
                    </div>
                )}
                <h1 className="font-bold text-sm tracking-wide truncate max-w-[150px] text-white">{storeConfig.name}</h1>
             </div>
             
             <Link 
                to={`/${shopId}/agendar`} 
                className="px-5 py-2 text-[10px] font-bold rounded-full shadow-[0_0_10px_rgba(212,175,55,0.2)] hover:shadow-[0_0_15px_rgba(212,175,55,0.4)] transition uppercase tracking-widest text-black"
                style={{ backgroundColor: primaryColor }}
             >
                Agendar
             </Link>
         </div>
      </header>

      <main className="flex-1 pt-16">
        <Outlet context={{ storeConfig, shopId }} />
      </main>

      {/* FOOTER */}
      <footer className="bg-[#0a0a0a] border-t border-[#222] pb-10 pt-8 mt-auto">
          <div className="max-w-md mx-auto px-6 text-center space-y-6">
              <h2 className="text-xl font-black font-egyptian tracking-wider text-[#eee]">{storeConfig.name}</h2>
              <div className="space-y-3 text-sm text-[#888]">
                  {storeConfig.address && <p className="flex items-center justify-center gap-2"><MapPin className="w-4 h-4"/> {storeConfig.address}</p>}
                  {storeConfig.phone && <p className="flex items-center justify-center gap-2"><Phone className="w-4 h-4"/> {storeConfig.phone}</p>}
              </div>
              <div className="flex justify-center gap-4 pt-2">
                  {storeConfig.instagram && (
                      <a href={`https://instagram.com/${storeConfig.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#111] border border-[#222] hover:border-[--primary] hover:text-[--primary] transition">
                          <Instagram className="w-5 h-5" />
                      </a>
                  )}
                  <Link to={`/${shopId}/agendar`} className="w-10 h-10 flex items-center justify-center rounded-full bg-[#111] border border-[#222] hover:border-[--primary] hover:text-[--primary] transition">
                      <Calendar className="w-5 h-5" />
                  </Link>
              </div>
              <div className="pt-6 mt-4 border-t border-[#1a1a1a]">
                  <p className="text-[10px] text-[#333] uppercase tracking-widest">Powered by Curly SaaS</p>
              </div>
          </div>
      </footer>
    </div>
  );
}