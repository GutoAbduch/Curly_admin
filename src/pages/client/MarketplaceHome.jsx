import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, ArrowRight, Tag, Moon, Sun } from 'lucide-react';
import { BUSINESS_CATEGORIES, getCategoryLabel } from '../../config/categories';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Link } from 'react-router-dom';

export default function MarketplaceHome() {
  // ESTADO DO TEMA (Padrão: Light)
  const [theme, setTheme] = useState('light');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Alternar Tema
  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // BUSCAR LOJAS
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

  // DEFINIÇÃO DE CORES BASEADA NO TEMA
  const isLight = theme === 'light';
  
  // Cores dinâmicas
  const bgColor = isLight ? 'bg-[#f2e4bf]' : 'bg-[#050505]';
  const textColor = isLight ? 'text-[#1a1a1a]' : 'text-[#f2e4bf]'; // Texto principal
  const cardBg = isLight ? 'bg-white' : 'bg-[#111]';
  const cardBorder = isLight ? 'border-[#e5e5e5]' : 'border-[#333]';
  const inputBg = isLight ? 'bg-transparent' : 'bg-transparent';
  const inputText = isLight ? 'text-[#1a1a1a]' : 'text-white';
  
  // Logo Dinâmico (Substitua pelos caminhos reais dos seus arquivos)
  const logoSrc = isLight 
    ? "/logo-escuro.png"  // No fundo claro, usa logo escuro
    : "/logo-claro.png";  // No fundo escuro, usa logo claro

  return (
    <div className={`min-h-screen ${bgColor} ${textColor} font-sans transition-colors duration-500 selection:bg-[#D4AF37] selection:text-white animate-fade-in`}>
      
      {/* BOTÃO FLUTUANTE DE TEMA */}
      <button 
        onClick={toggleTheme}
        className="fixed top-5 right-5 z-50 p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg hover:scale-110 transition-transform group"
        title="Alternar Tema"
      >
        {isLight ? (
            <Moon className="w-5 h-5 text-[#1a1a1a]" />
        ) : (
            <Sun className="w-5 h-5 text-[#D4AF37]" />
        )}
      </button>

      {/* HERO SECTION */}
      <div className="relative h-[55vh] flex flex-col items-center justify-center px-4 text-center overflow-hidden">
          
          {/* Fundo com imagem + Overlay Gradiente Dinâmico */}
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10"></div>
          
          {/* Gradiente de transição para o fundo da página */}
          <div className={`absolute inset-0 bg-gradient-to-t ${isLight ? 'from-[#f2e4bf]' : 'from-[#050505]'} via-transparent to-transparent`}></div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>

          <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
             <div className="mb-6 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#D4AF37]/30 bg-white/50 backdrop-blur-sm text-[#D4AF37] text-[10px] font-bold tracking-[0.2em] uppercase shadow-sm">
                <Star className="w-3 h-3 fill-[#D4AF37]" /> Excellence in Beauty
             </div>

             {/* LOGOTIPO DINÂMICO */}
             {/* Se a imagem não carregar, ele mostra o texto como fallback */}
             <div className="mb-6">
                 <img 
                    src={logoSrc} 
                    alt="Curly Clients" 
                    className="h-24 md:h-32 object-contain drop-shadow-md transition-all duration-500"
                    onError={(e) => {
                        e.target.style.display = 'none'; // Esconde img quebrada
                        document.getElementById('fallback-title').style.display = 'block'; // Mostra texto
                    }}
                 />
                 {/* Fallback de Texto (caso não ache a imagem) */}
                 <h1 id="fallback-title" className="hidden text-4xl md:text-7xl font-black font-egyptian tracking-wider text-[#1a1a1a] drop-shadow-sm">
                    CURLY <span className="text-[#D4AF37]">CLIENTS</span>
                 </h1>
             </div>

             <p className={`text-sm md:text-lg mb-8 max-w-lg mx-auto font-light leading-relaxed ${isLight ? 'text-[#666]' : 'text-[#aaa]'}`}>
                Agende com os melhores profissionais de barbearia, estética e bem-estar perto de você.
             </p>

             {/* BARRA DE BUSCA DINÂMICA */}
             <div className={`w-full ${isLight ? 'bg-white border-[#e5e5e5]' : 'bg-[#111] border-[#333]'} border rounded-full p-2 flex items-center shadow-[0_10px_40px_rgba(212,175,55,0.15)] focus-within:border-[#D4AF37] transition-all transform hover:-translate-y-1 group`}>
                  <div className={`pl-4 pr-3 ${isLight ? 'text-[#999]' : 'text-[#666]'} group-focus-within:text-[#D4AF37] transition-colors`}>
                      <Search className="w-5 h-5" />
                  </div>
                  <input 
                      type="text" 
                      className={`flex-1 border-none outline-none ${inputBg} ${inputText} placeholder-[#888] h-12 text-base`}
                      placeholder="Busque por serviços ou nome da loja..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button className="bg-[#D4AF37] hover:bg-[#cda631] text-white font-bold px-8 py-3 rounded-full transition-all hover:scale-105 shadow-md hidden sm:block tracking-widest text-xs">
                      BUSCAR
                  </button>
             </div>
          </div>
      </div>

      {/* CATEGORIAS VISUAIS */}
      <div className="max-w-7xl mx-auto px-6 -mt-16 relative z-20 pb-12">
          <div className="flex items-center justify-between mb-4 px-2">
              <h2 className={`text-sm font-bold uppercase tracking-widest pl-2 ${isLight ? 'text-[#888]' : 'text-[#666]'}`}>
                 Navegar por Categorias
              </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {BUSINESS_CATEGORIES.map((cat) => (
                  <button 
                    key={cat.id} 
                    onClick={() => setSearchTerm(cat.label)}
                    className={`relative h-48 rounded-xl overflow-hidden group border ${isLight ? 'border-white' : 'border-[#333]'} shadow-lg hover:shadow-2xl transition-all duration-500`}
                  >
                      {/* Imagem */}
                      <img src={cat.image} alt={cat.label} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                      
                      {/* Texto */}
                      <div className="absolute bottom-0 left-0 w-full p-4 text-left">
                          <h3 className="text-white font-bold text-sm md:text-base leading-tight group-hover:text-[#D4AF37] transition-colors font-egyptian tracking-wide">{cat.label}</h3>
                          <p className="text-[10px] text-gray-300 mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-2 group-hover:translate-y-0 duration-300">
                             Explorar <ArrowRight className="w-3 h-3" />
                          </p>
                      </div>
                  </button>
              ))}
          </div>
      </div>

      {/* RESULTADOS / LOJAS */}
      <div className={`${isLight ? 'bg-white' : 'bg-[#0a0a0a]'} py-16 min-h-[400px] transition-colors duration-500`}>
          <div className="max-w-7xl mx-auto px-6">
              <div className={`flex items-center justify-between mb-10 border-b ${isLight ? 'border-[#f0f0f0]' : 'border-[#222]'} pb-4`}>
                  <h2 className={`text-2xl font-bold font-egyptian flex items-center gap-2 ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>
                      <MapPin className="w-5 h-5 text-[#D4AF37]" />
                      {searchTerm ? `Resultados: "${searchTerm}"` : 'Espaços Recomendados'}
                  </h2>
                  <span className={`text-xs ${isLight ? 'text-[#888] bg-[#f5f5f5]' : 'text-[#aaa] bg-[#222]'} px-3 py-1 rounded-full`}>{filteredShops.length} locais</span>
              </div>

              {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[1,2,3].map(i => <div key={i} className={`h-80 ${isLight ? 'bg-[#f5f5f5]' : 'bg-[#111]'} rounded-xl animate-pulse`}></div>)}
                  </div>
              ) : filteredShops.length === 0 ? (
                  <div className={`text-center py-20 ${cardBg} rounded-xl border ${cardBorder}`}>
                      <p className="text-gray-400 mb-4">Nenhuma loja encontrada com este termo.</p>
                      <button onClick={() => setSearchTerm('')} className="text-[#D4AF37] text-xs font-bold border border-[#D4AF37] px-6 py-2 rounded-full hover:bg-[#D4AF37] hover:text-white transition">Limpar filtros</button>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8">
                      {filteredShops.map((shop) => (
                          <Link to={`/${shop.slug || shop.shopId}`} key={shop.shopId} className={`group block ${cardBg} rounded-xl overflow-hidden hover:shadow-[0_20px_40px_rgba(0,0,0,0.2)] transition-all duration-300 border ${cardBorder} hover:border-[#D4AF37]/30 h-full flex flex-col`}>
                              {/* Capa */}
                              <div className={`h-48 relative overflow-hidden ${isLight ? 'bg-[#f0f0f0]' : 'bg-[#1a1a1a]'}`}>
                                   {shop.bannerUrl ? (
                                      <img src={shop.bannerUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt="Banner" />
                                   ) : (
                                      <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                          <MapPin className="w-8 h-8 text-[#888]" />
                                      </div>
                                   )}
                                   <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                   
                                   {/* Nota (Badge) */}
                                   <div className="absolute top-3 right-3 bg-black/80 backdrop-blur px-2 py-1 rounded-md shadow-sm flex items-center gap-1 border border-white/10">
                                      <Star className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]" />
                                      <span className="text-xs font-bold text-white">{shop.rating || '5.0'}</span>
                                   </div>
                              </div>
                              
                              {/* Conteúdo */}
                              <div className="p-5 pt-12 relative flex-1 flex flex-col">
                                  {/* Logo Flutuante */}
                                  <div className={`absolute -top-8 left-5 w-16 h-16 rounded-full border-[3px] ${isLight ? 'border-white bg-white' : 'border-[#222] bg-[#111]'} shadow-md overflow-hidden flex items-center justify-center z-10`}>
                                      {shop.logoUrl ? (
                                          <img src={shop.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                                      ) : (
                                          <span className="text-[#D4AF37] font-bold text-xl">{shop.name?.charAt(0)}</span>
                                      )}
                                  </div>
                                  
                                  <div className="mb-4">
                                      <h3 className={`font-bold text-lg group-hover:text-[#D4AF37] transition-colors truncate ${isLight ? 'text-[#1a1a1a]' : 'text-white'}`}>{shop.name}</h3>
                                      <p className="text-xs text-[#888] flex items-center gap-1 mt-1">
                                         <Tag className="w-3 h-3" /> {getCategoryLabel(shop.mainCategory)}
                                      </p>
                                  </div>

                                  {/* Tags */}
                                  <div className="flex flex-wrap gap-1.5 mb-4">
                                      {shop.subcategories?.slice(0, 2).map((sub, idx) => (
                                          <span key={idx} className={`text-[10px] px-2 py-1 rounded ${isLight ? 'bg-[#f5f5f5] text-[#666] border border-[#e5e5e5]' : 'bg-[#1a1a1a] text-[#aaa] border border-[#333]'}`}>
                                              {sub}
                                          </span>
                                      ))}
                                  </div>

                                  <div className={`mt-auto pt-4 border-t flex items-center justify-between ${isLight ? 'border-[#f5f5f5]' : 'border-[#222]'}`}>
                                      <p className="text-[10px] text-[#888] font-bold uppercase tracking-wider">
                                          {shop.city || 'São Paulo'}
                                      </p>
                                      <span className="text-xs font-bold text-[#D4AF37] flex items-center gap-1 group-hover:translate-x-1 transition-transform">
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
      <footer className={`py-12 text-center border-t transition-colors duration-500 ${isLight ? 'bg-white border-[#eee] text-[#1a1a1a]' : 'bg-[#080808] border-[#222] text-[#ccc]'}`}>
          <p className="text-xs font-bold tracking-[0.2em] text-[#888] uppercase mb-2">Powered by</p>
          <p className="font-egyptian font-black text-lg">CURLY</p>
      </footer>
    </div>
  );
}