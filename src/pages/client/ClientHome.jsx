import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Calendar, Clock, Star, MapPin } from 'lucide-react';

export default function ClientHome() {
  const { storeConfig, shopId } = useOutletContext();
  const primaryColor = storeConfig.primaryColor || '#D4AF37';

  // Horários formatados para exibição (Simples)
  const today = new Date().getDay();
  const isOpenToday = storeConfig.schedule?.find(s => s.day === today && !s.closed);

  return (
    <div className="animate-fade-in">
      
      {/* HERO SECTION */}
      <div className="relative h-[50vh] md:h-[60vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0 bg-[#111]">
             {storeConfig.bannerUrl && (
                 <img src={storeConfig.bannerUrl} className="w-full h-full object-cover opacity-50" alt="Banner" />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-black/30" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-lg mt-10">
            {storeConfig.logoUrl && (
                <img src={storeConfig.logoUrl} className="w-20 h-20 rounded-full border-4 border-[#050505] shadow-2xl mx-auto mb-4 object-cover" alt="Logo" />
            )}
            <h1 className="text-3xl md:text-5xl font-black text-white mb-2 font-egyptian tracking-wider drop-shadow-lg">
                {storeConfig.name}
            </h1>
            <p className="text-gray-300 text-xs md:text-sm mb-6 font-light">
                {storeConfig.description || "Agende seu horário com facilidade."}
            </p>
            
            <Link 
                to={`/${shopId}/agendar`}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-bold text-xs tracking-widest shadow-[0_0_20px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform"
                style={{ backgroundColor: primaryColor, color: '#000' }}
            >
                <Calendar className="w-4 h-4" /> AGENDAR AGORA
            </Link>
        </div>
      </div>

      {/* STATUS BAR */}
      <div className="max-w-2xl mx-auto -mt-6 relative z-20 px-6">
          <div className="bg-[#111] border border-[#222] rounded-xl p-4 flex justify-between items-center shadow-2xl">
              <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${isOpenToday ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <div>
                      <p className="text-[10px] text-[#888] font-bold uppercase">Status</p>
                      <p className="text-xs font-bold text-white">{isOpenToday ? 'ABERTO' : 'FECHADO'}</p>
                  </div>
              </div>
              <div className="text-right">
                  <p className="text-[10px] text-[#888] font-bold uppercase">Hoje</p>
                  <p className="text-xs font-bold text-white">
                      {isOpenToday ? `${isOpenToday.open} - ${isOpenToday.close}` : 'Fechado'}
                  </p>
              </div>
          </div>
      </div>

      {/* INFO RÁPIDA */}
      <div className="max-w-xl mx-auto px-6 py-12 text-center space-y-6">
          <div className="grid grid-cols-2 gap-4">
               <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                   <Clock className="w-5 h-5 mx-auto mb-2 text-[#666]" />
                   <h3 className="text-white font-bold text-xs">Sem Espera</h3>
                   <p className="text-[10px] text-[#666]">Horário marcado.</p>
               </div>
               <div className="bg-[#111] p-4 rounded-xl border border-[#222]">
                   <MapPin className="w-5 h-5 mx-auto mb-2 text-[#666]" />
                   <h3 className="text-white font-bold text-xs">Localização</h3>
                   <p className="text-[10px] text-[#666] truncate">{storeConfig.address || 'Ver no mapa'}</p>
               </div>
          </div>
      </div>
    </div>
  );
}