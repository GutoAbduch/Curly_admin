import React from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Calendar, Clock, MapPin, Star, ArrowRight, Instagram, Phone } from 'lucide-react';

export default function ClientHome() {
  const { storeConfig, shopId } = useOutletContext();
  const primaryColor = storeConfig.primaryColor || '#D4AF37';

  // Verifica se está aberto hoje
  const today = new Date().getDay();
  const todaySchedule = storeConfig.schedule?.find(s => s.day === today);
  const isOpenToday = todaySchedule && !todaySchedule.closed;

  return (
    <div className="animate-fade-in pb-10">
      
      {/* --- HERO SECTION (CAPA + LOGO) --- */}
      <div className="relative mb-24"> {/* Margem grande embaixo para o card de info sobrepor */}
          
          {/* 1. Banner de Fundo (Full Width) */}
          <div className="h-[45vh] md:h-[50vh] relative overflow-hidden bg-[#1a1a1a]">
               {storeConfig.bannerUrl ? (
                   <img src={storeConfig.bannerUrl} className="w-full h-full object-cover opacity-90" alt="Banner" />
               ) : (
                   <div className="absolute inset-0 bg-gradient-to-r from-[#222] to-[#111]" /> // Fallback se não tiver banner
               )}
               {/* Gradiente para suavizar a transição pro fundo creme */}
               <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-[#F9F7F2] to-transparent"></div>
          </div>

          {/* 2. Logotipo Centralizado (Sobreposto) */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 flex flex-col items-center">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[4px] border-[#F9F7F2] bg-white shadow-2xl overflow-hidden flex items-center justify-center">
                  {storeConfig.logoUrl ? (
                      <img src={storeConfig.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  ) : (
                      <span className="text-4xl font-black text-[--primary]">{storeConfig.name?.charAt(0)}</span>
                  )}
              </div>
          </div>
      </div>

      {/* --- INFORMAÇÕES DA LOJA --- */}
      <div className="text-center px-6 mt-4 md:mt-0 relative z-10">
          
          {/* Nome e Slogan */}
          <h1 className="text-3xl md:text-5xl font-black text-[#1a1a1a] mb-2 font-egyptian tracking-wide drop-shadow-sm">
              {storeConfig.name}
          </h1>
          <p className="text-[#666] text-sm md:text-base mb-8 max-w-lg mx-auto italic font-serif">
              "{storeConfig.slogan || "Cuidando do seu estilo."}"
          </p>

          {/* Botão Principal */}
          <div className="mb-12">
            <Link 
                to={`/${shopId}/agendar`}
                className="inline-flex items-center gap-3 px-10 py-4 rounded-full font-bold text-sm tracking-widest shadow-[0_10px_30px_rgba(212,175,55,0.3)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.5)] hover:-translate-y-1 transition-all text-white"
                style={{ backgroundColor: primaryColor }}
            >
                <Calendar className="w-4 h-4" /> AGENDAR AGORA
            </Link>
          </div>

          {/* GRID DE INFORMAÇÕES (Minimalista) */}
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              
              {/* Card 1: Horários */}
              <div className="bg-white p-6 rounded-2xl border border-[#eee] shadow-sm hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-full bg-[#fafafa] flex items-center justify-center mb-4 group-hover:bg-[--primary] transition-colors">
                      <Clock className="w-5 h-5 text-[#888] group-hover:text-white" />
                  </div>
                  <h3 className="font-bold text-[#1a1a1a] mb-1">Horário de Hoje</h3>
                  <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isOpenToday ? 'bg-green-500' : 'bg-red-500'}`} />
                      <p className="text-sm text-[#555]">
                          {isOpenToday 
                            ? `${todaySchedule.open} às ${todaySchedule.close}` 
                            : 'Fechado Agora'
                          }
                      </p>
                  </div>
              </div>

              {/* Card 2: Endereço */}
              <div className="bg-white p-6 rounded-2xl border border-[#eee] shadow-sm hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-full bg-[#fafafa] flex items-center justify-center mb-4 group-hover:bg-[--primary] transition-colors">
                      <MapPin className="w-5 h-5 text-[#888] group-hover:text-white" />
                  </div>
                  <h3 className="font-bold text-[#1a1a1a] mb-1">Localização</h3>
                  <p className="text-sm text-[#555] truncate">{storeConfig.address || 'Endereço não informado'}</p>
                  {storeConfig.mapUrl && (
                      <a href={storeConfig.mapUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[--primary] mt-2 inline-flex items-center gap-1 hover:underline">
                          Ver no Mapa <ArrowRight className="w-3 h-3" />
                      </a>
                  )}
              </div>

              {/* Card 3: Contato */}
              <div className="bg-white p-6 rounded-2xl border border-[#eee] shadow-sm hover:shadow-md transition group">
                  <div className="w-10 h-10 rounded-full bg-[#fafafa] flex items-center justify-center mb-4 group-hover:bg-[--primary] transition-colors">
                      <Phone className="w-5 h-5 text-[#888] group-hover:text-white" />
                  </div>
                  <h3 className="font-bold text-[#1a1a1a] mb-1">Contato</h3>
                  <p className="text-sm text-[#555]">{storeConfig.phone || 'Sem telefone'}</p>
                  {storeConfig.instagram && (
                      <a href={`https://instagram.com/${storeConfig.instagram.replace('@', '')}`} target="_blank" rel="noreferrer" className="text-xs font-bold text-[--primary] mt-2 inline-flex items-center gap-1 hover:underline">
                          <Instagram className="w-3 h-3" /> Instagram
                      </a>
                  )}
              </div>

          </div>
      </div>
    </div>
  );
}