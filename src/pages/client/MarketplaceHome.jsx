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
        // Acessa a coleção pública 'shops' que criamos no passo anterior
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

  // Lógica de Filtragem (Busca Local)
  const filteredShops = shops.filter(shop => {
      const term = searchTerm.toLowerCase();
      const nameMatch = shop.name?.toLowerCase().includes(term);
      const categoryMatch = getCategoryLabel(shop.mainCategory)?.toLowerCase().includes(term);
      const subMatch = shop.subcategories?.some(sub => sub.toLowerCase().includes(term));
      
      return nameMatch || categoryMatch || subMatch;
  });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-gold selection:text-black animate-fade-in">
      
      {/* HERO SECTION (BUSCA) */}
      <div className="relative h-[60vh] flex flex-col items-center justify-center px-4 text-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1a1500] via-[#050505] to-[#000000] border-b border-[#222]">
          
          <h1 className="text-4xl md:text-6xl font-black font-egyptian tracking-wider mb-2 text-white drop-shadow-2xl">
              CURLY <span className="text-gold">CLIENTS</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base mb-10 max-w-lg">
              Encontre os melhores profissionais de beleza e estética e agende em segundos.
          </p>

          {/* BARRA DE BUSCA */}
          <div className="w-full max-w-2xl bg-[#111] border border-[#333] rounded-full p-2 flex items-center shadow-[0_0_30px_rgba(212,175,55,0.1)] focus-within:border-gold focus-within:shadow-[0_0_30px_rgba(212,175,55,0.3)] transition-all transform hover:scale-[1.01]">
              <div className="pl-4 pr-2 text-gray-500">
                  <Search className="w-5 h-5" />
              </div>
              <input 
                  type="text" 
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 h-10"
                  placeholder="Busque por nome, barbearia, unhas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button className="bg-gold hover:bg-[#b5952f] text-black font-bold px-8 py-2.5 rounded-full transition-colors hidden md:block">
                  BUSCAR
              </button>
          </div>

          {/* FILTRO RÁPIDO (TAGS) */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
              {['Barbearia', 'Cabelo', 'Manicure', 'Maquiagem', 'Estética'].map(tag => (
                  <button 
                    key={tag} 
                    onClick={() => setSearchTerm(tag)}
                    className="px-3 py-1 rounded-full border border-[#222] bg-[#0a0a0a] text-xs text-[#888] hover:border-gold hover:text-gold cursor-pointer transition"
                  >
                      {tag}
                  </button>
              ))}
          </div>
      </div>

      {/* LISTAGEM DE CATEGORIAS */}
      <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">Navegar por Categorias</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {BUSINESS_CATEGORIES.map((cat) => (
                  <button 
                    key={cat.id} 
                    onClick={() => setSearchTerm(cat.label)}
                    className="bg-[#111] border border-[#222] p-6 rounded-xl hover:border-gold/50 hover:bg-[#161616] transition cursor-pointer group flex flex-col items-center text-center gap-3"
                  >
                      <div className="w-12 h-12 rounded-full bg-[#0a0a0a] border border-[#333] flex items-center justify-center group-hover:scale-110 transition-transform text-gold">
                          <Tag className="w-5 h-5" />
                      </div>
                      <div>
                          <h3 className="text-sm font-bold text-gray-200 group-hover:text-gold transition-colors">{cat.label}</h3>
                          <p className="text-[10px] text-[#555] mt-1">{cat.subcategories.length} tipos</p>
                      </div>
                  </button>
              ))}
          </div>
      </div>

      {/* RESULTADOS DA BUSCA / LOJAS EM DESTAQUE */}
      <div className="bg-[#0a0a0a] border-t border-[#1a1a1a] py-16 min-h-[400px]">
          <div className="max-w-6xl mx-auto px-6">
              <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold text-white">
                      {searchTerm ? `Resultados para "${searchTerm}"` : 'Recomendados para você'}
                  </h2>
                  <span className="text-xs text-[#666]">{filteredShops.length} lojas encontradas</span>
              </div>

              {loading ? (
                  <div className="text-center py-20 text-[#666]">Carregando estabelecimentos...</div>
              ) : filteredShops.length === 0 ? (
                  <div className="text-center py-20 bg-[#111] rounded-2xl border border-[#222]">
                      <p className="text-gray-400 mb-2">Nenhuma loja encontrada com este termo.</p>
                      <button onClick={() => setSearchTerm('')} className="text-gold text-xs font-bold hover:underline">Limpar filtros</button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {filteredShops.map((shop) => (
                          <Link to={`/${shop.slug || shop.shopId}`} key={shop.shopId} className="group block bg-[#111] border border-[#222] rounded-2xl overflow-hidden hover:border-gold/30 transition-all hover:-translate-y-1 shadow-lg">
                              {/* Capa do Card */}
                              <div className="h-32 bg-[#1a1a1a] relative overflow-hidden">
                                   {shop.bannerUrl ? (
                                      <img src={shop.bannerUrl} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" alt="Banner" />
                                   ) : (
                                      <div className="absolute inset-0 flex items-center justify-center text-[#333]">
                                          <MapPin className="w-8 h-8 opacity-20" />
                                      </div>
                                   )}
                                   {/* Overlay gradiente */}
                                   <div className="absolute inset-0 bg-gradient-to-t from-[#111] to-transparent"></div>
                              </div>
                              
                              {/* Conteúdo do Card */}
                              <div className="p-4 relative">
                                  {/* Logo Flutuante */}
                                  <div className="absolute -top-8 left-4 w-16 h-16 rounded-xl bg-black border-2 border-[#222] flex items-center justify-center overflow-hidden shadow-2xl group-hover:border-gold/50 transition-colors">
                                      {shop.logoUrl ? (
                                          <img src={shop.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                                      ) : (
                                          <span className="text-gold font-bold text-xl">{shop.name?.charAt(0)}</span>
                                      )}
                                  </div>
                                  
                                  <div className="ml-20 min-h-[3.5rem]">
                                      <h3 className="font-bold text-white truncate text-lg">{shop.name}</h3>
                                      <p className="text-xs text-gold">{getCategoryLabel(shop.mainCategory)}</p>
                                  </div>

                                  {/* Subcategorias (Tags) */}
                                  <div className="mt-3 flex flex-wrap gap-1 h-12 overflow-hidden content-start">
                                      {shop.subcategories?.slice(0, 3).map((sub, idx) => (
                                          <span key={idx} className="text-[9px] px-2 py-0.5 bg-[#1a1a1a] border border-[#333] rounded text-[#888]">
                                              {sub}
                                          </span>
                                      ))}
                                      {shop.subcategories?.length > 3 && (
                                          <span className="text-[9px] px-2 py-0.5 text-[#666]">+ {shop.subcategories.length - 3}</span>
                                      )}
                                  </div>

                                  <div className="mt-4 pt-4 border-t border-[#222] flex items-center justify-between">
                                      <div className="flex items-center gap-1 text-gold text-xs font-bold">
                                          <Star className="w-3 h-3 fill-gold" /> {shop.rating || '5.0'}
                                          <span className="text-[#444] font-normal ml-1">({shop.reviewCount || 0})</span>
                                      </div>
                                      <span className="text-xs text-[#444] group-hover:text-white transition-colors flex items-center gap-1 font-bold">
                                          AGENDAR <ArrowRight className="w-3 h-3" />
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