import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, ArrowRight, Tag } from 'lucide-react';
import { BUSINESS_CATEGORIES, getCategoryLabel } from '../../config/categories';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';

export default function MarketplaceHome() {
  const [searchTerm, setSearchTerm] = useState('');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // BUSCAR LOJAS REAIS NO FIREBASE
  useEffect(() => {
    const fetchShops = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "shops"));
        const shopsList = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        setShops(shopsList);
      } catch (error) {
        console.error("Erro ao buscar lojas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, []);

  const filteredShops = shops.filter(shop => {
      const term = searchTerm.toLowerCase();
      const nameMatch = shop.name?.toLowerCase().includes(term);
      const categoryMatch = getCategoryLabel(shop.mainCategory)?.toLowerCase().includes(term);
      const subMatch = shop.subcategories?.some(sub => sub.toLowerCase().includes(term));
      return nameMatch || categoryMatch || subMatch;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-gold selection:text-black animate-fade-in">
      
      {/* HERO SECTION */}
      <div className="relative h-[55vh] flex flex-col items-center justify-center px-4 text-center overflow-hidden">
          {/* Fundo do Hero */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent"></div>

          <div className="relative z-10 max-w-3xl mx-auto">
             <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gold/30 bg-gold/10 text-gold text-[10px] font-bold tracking-widest uppercase">
                <Star className="w-3 h-3 fill-gold" /> A plataforma Premium da Beleza
             </div>
             <h1 className="text-4xl md:text-6xl font-black font-egyptian tracking-wider mb-4 text-white drop-shadow-2xl">
                CURLY <span className="text-gold">CLIENTS</span>
             </h1>
             <p className="text-gray-300 text-sm md:text-lg mb-8 max-w-lg mx-auto font-light">
                Agende com os melhores profissionais de barbearia, estética e bem-estar perto de você.
             </p>

             {/* BARRA DE BUSCA */}
             <div className="w-full bg-[#111]/90 backdrop-blur-md border border-[#333] rounded-full p-2 flex items-center shadow-[0_0_40px_rgba(212,175,55,0.15)] focus-within:border-gold transition-all group">
                  <div className="pl-4 pr-3 text-gray-500 group-focus-within:text-gold transition-colors">
                      <Search className="w-6 h-6" />
                  </div>
                  <input 
                      type="text" 
                      className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 h-12 text-base"
                      placeholder="Busque por serviços ou nome da loja..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="bg-gold hover:bg-[#cda631] text-black font-bold px-8 py-3 rounded-full transition-all hover:scale-105 shadow-lg hidden sm:block">
                      BUSCAR
                  </button>
             </div>
          </div>
      </div>

      {/* CATEGORIAS VISUAIS */}
      <div className="max-w-7xl mx-auto px-6 -mt-16 relative z-20 pb-12">
          <div className="flex items-center justify-between mb-6 px-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                 Categorias Populares
              </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {BUSINESS_CATEGORIES.map((cat) => (
                  <button 
                    key={cat.id} 
                    onClick={() => setSearchTerm(cat.label)}
                    className="relative h-40 rounded-2xl overflow-hidden group border border-[#222] hover:border-gold/50 transition-all shadow-xl"
                  >
                      {/* Imagem de Fundo */}
                      <img src={cat.image} alt={cat.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      
                      {/* Overlay Escuro */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                      
                      {/* Texto */}
                      <div className="absolute bottom-0 left-0 w-full p-4 text-left">
                          <h3 className="text-white font-bold text-sm md:text-base leading-tight group-hover:text-gold transition-colors">{cat.label}</h3>
                          <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                             Explorar <ArrowRight className="w-3 h-3" />
                          </p>
                      </div>
                  </button>
              ))}
          </div>
      </div>

      {/* RESULTADOS / LOJAS */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] py-12 min-h-[400px]">
          <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gold" />
                      {searchTerm ? `Resultados para "${searchTerm}"` : 'Recomendados para você'}
                  </h2>
                  <span className="text-xs text-[#666] bg-[#111] px-3 py-1 rounded-full border border-[#222]">{filteredShops.length} lojas</span>
              </div>

              {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[1,2,3].map(i => <div key={i} className="h-64 bg-[#111] rounded-2xl animate-pulse"></div>)}
                  </div>
              ) : filteredShops.length === 0 ? (
                  <div className="text-center py-20 bg-[#111] rounded-2xl border border-[#222]">
                      <p className="text-gray-400 mb-4">Nenhuma loja encontrada com este termo.</p>
                      <button onClick={() => setSearchTerm('')} className="text-gold text-xs font-bold border border-gold px-6 py-2 rounded-full hover:bg-gold hover:text-black transition">Limpar Filtros</button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {filteredShops.map((shop) => (
                          <Link to={`/${shop.slug || shop.shopId}`} key={shop.shopId} className="group block bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-gold/30 transition-all hover:-translate-y-1 shadow-lg h-full flex flex-col">
                              {/* Capa */}
                              <div className="h-40 bg-[#1a1a1a] relative overflow-hidden">
                                   {shop.bannerUrl ? (
                                      <img src={shop.bannerUrl} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" alt="Banner" />
                                   ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-[#333]">
                                          <MapPin className="w-10 h-10 opacity-20" />
                                      </div>
                                   )}
                                   <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent"></div>
                                   
                                   {/* Nota (Badge) */}
                                   <div className="absolute top-3 right-3 bg-black/80 backdrop-blur border border-[#333] px-2 py-1 rounded-lg flex items-center gap-1">
                                      <Star className="w-3 h-3 fill-gold text-gold" />
                                      <span className="text-xs font-bold text-white">{shop.rating || '5.0'}</span>
                                   </div>
                              </div>
                              
                              {/* Conteúdo */}
                              <div className="p-5 relative flex-1 flex flex-col">
                                  {/* Logo */}
                                  <div className="absolute -top-10 left-4 w-16 h-16 rounded-xl bg-black border-2 border-[#1a1a1a] flex items-center justify-center overflow-hidden shadow-2xl group-hover:border-gold/50 transition-colors z-10">
                                      {shop.logoUrl ? (
                                          <img src={shop.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                                      ) : (
                                          <span className="text-gold font-bold text-xl">{shop.name?.charAt(0)}</span>
                                      )}
                                  </div>
                                  
                                  <div className="mt-8 mb-2">
                                      <h3 className="font-bold text-white truncate text-lg group-hover:text-gold transition-colors">{shop.name}</h3>
                                      <p className="text-xs text-[#888] flex items-center gap-1 mt-1">
                                         <Tag className="w-3 h-3" /> {getCategoryLabel(shop.mainCategory)}
                                      </p>
                                  </div>

                                  {/* Tags */}
                                  <div className="flex flex-wrap gap-1.5 mb-4">
                                      {shop.subcategories?.slice(0, 2).map((sub, idx) => (
                                          <span key={idx} className="text-[10px] px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded text-[#aaa]">
                                              {sub}
                                          </span>
                                      ))}
                                  </div>

                                  <div className="mt-auto pt-4 border-t border-[#222] flex items-center justify-between">
                                      <p className="text-[10px] text-[#555]">
                                          {shop.city || 'Localização não inf.'}
                                      </p>
                                      <span className="text-xs text-[#eee] bg-[#222] px-3 py-1.5 rounded-lg group-hover:bg-gold group-hover:text-black transition-colors font-bold flex items-center gap-1">
                                          Agendar
                                      </span>
                                  </div>
                              </div>
                          </Link>
                      ))}
                  </div>
              )}
          </div>
      </div>

      {/* FOOTER */}
      <footer className="py-10 text-center border-t border-[#222] text-[#444] text-xs bg-[#080808]">
          <p className="mb-2 font-bold text-[#666]">CURLY PLATFORM</p>
          <p>© 2026 Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}