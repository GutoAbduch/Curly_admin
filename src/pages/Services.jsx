import React, { useState, useEffect } from 'react';
import { db, storage } from '../config/firebase'; 
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp, query, where, updateDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'; 
import { useOutletContext } from 'react-router-dom';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const formatDuration = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m} min`;
};

export default function Services() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId; 

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stockList, setStockList] = useState([]); 
  
  // Estado do formulário
  const [form, setForm] = useState({ 
    name: '', 
    price: '', 
    duration: '30', 
    category: 'Cabelo', 
    description: '', 
    imageUrl: '', 
    supplies: [] 
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tempSupply, setTempSupply] = useState({ productId: '', qty: '' });

  const canEdit = ['Admin', 'Gerente'].includes(role);

  useEffect(() => {
    if (!APP_ID) return;

    // 1. Busca Serviços
    const unsubServices = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/services`), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // 2. Busca Produtos (Apenas Uso Interno ou Ambos para vincular como insumo)
    const qProducts = query(
        collection(db, `artifacts/${APP_ID}/public/data/products`),
        where('useType', '!=', 'resale') // Traz 'internal' e outros que não sejam puramente revenda
    );

    const unsubStock = onSnapshot(qProducts, (snap) => {
        setStockList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubServices(); unsubStock(); };
  }, [APP_ID]);

  // --- LÓGICA DE UPLOAD ---
  const handleFileChange = (e) => {
      const file = e.target.files[0];
      if (file) {
          if (file.size > 5 * 1024 * 1024) {
              alert("A imagem é muito grande. O máximo permitido é 5MB.");
              return;
          }
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file)); 
      }
  };

  const removeImage = () => {
      setImageFile(null);
      setImagePreview(null);
      setForm({ ...form, imageUrl: '' });
  };

  // --- LÓGICA DE INSUMOS ---
  const addSupply = () => {
      if (!tempSupply.productId || !tempSupply.qty) return;
      const product = stockList.find(p => p.id === tempSupply.productId);
      
      setForm(prev => ({
          ...prev,
          supplies: [...prev.supplies, {
              productId: product.id,
              name: product.name,
              unit: product.measureUnit || 'UN',
              qty: tempSupply.qty
          }]
      }));
      setTempSupply({ productId: '', qty: '' });
  };

  const removeSupply = (index) => {
      const newSupplies = [...form.supplies];
      newSupplies.splice(index, 1);
      setForm({ ...form, supplies: newSupplies });
  };

  // --- SUBMIT ---
  const handleCreateService = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      let finalImageUrl = form.imageUrl;

      if (imageFile) {
          const fileRef = ref(storage, `artifacts/${APP_ID}/services/${Date.now()}_${imageFile.name}`);
          const uploadResult = await uploadBytes(fileRef, imageFile);
          finalImageUrl = await getDownloadURL(uploadResult.ref);
      }

      // Garante que números sejam salvos como números
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/services`), {
        ...form,
        imageUrl: finalImageUrl,
        price: parseFloat(form.price),
        duration: parseInt(form.duration),
        createdAt: serverTimestamp()
      });

      setForm({ name: '', price: '', duration: '30', category: 'Cabelo', description: '', imageUrl: '', supplies: [] });
      setImageFile(null);
      setImagePreview(null);
      alert('Serviço criado com sucesso!');

    } catch (error) {
      console.error(error);
      alert('Erro ao criar serviço.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Tem certeza que deseja excluir este serviço?")) return;
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/services`, id));
  };

  if (!canEdit) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <h2 className="text-2xl font-bold text-red-500">Acesso Restrito</h2>
        <p className="text-[#666]">Apenas Admin e Gerente podem configurar serviços.</p>
    </div>
  );

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">SERVIÇOS</h2>
        <p className="text-[#666] text-sm">Catálogo de serviços e preços</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULÁRIO */}
        <div className="lg:col-span-1">
          <div className="bg-[#111] p-6 rounded-2xl border border-[#333] sticky top-8">
            <h3 className="text-xl font-bold text-gold mb-6 font-egyptian">Novo Serviço</h3>
            
            <form onSubmit={handleCreateService} className="space-y-4">
              
              {/* UPLOAD IMAGEM */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[#666] uppercase">Foto de Capa</label>
                {!imagePreview ? (
                    <div className="relative border-2 border-dashed border-[#333] rounded-lg p-6 hover:border-gold transition-colors text-center cursor-pointer group">
                        <input 
                            type="file" 
                            accept="image/png, image/jpeg, image/jpg" 
                            onChange={handleFileChange}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                        />
                        <i className="fas fa-camera text-2xl text-[#444] group-hover:text-gold mb-2 transition-colors"></i>
                        <p className="text-xs text-[#666] group-hover:text-white transition-colors">Clique para enviar foto</p>
                    </div>
                ) : (
                    <div className="relative rounded-lg overflow-hidden border border-[#333] group">
                        <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover" />
                        <button 
                            type="button" 
                            onClick={removeImage}
                            className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <i className="fas fa-times text-xs"></i>
                        </button>
                    </div>
                )}
              </div>

              {/* CAMPOS BÁSICOS */}
              <div>
                <label className="text-xs font-bold text-[#666] uppercase">Nome do Serviço</label>
                <input required className="input-field" placeholder="Ex: Corte Degrade" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-xs font-bold text-[#666] uppercase">Preço (R$)</label>
                   <input required type="number" step="0.01" className="input-field" placeholder="0.00" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                </div>
                <div>
                   <label className="text-xs font-bold text-[#666] uppercase">Duração (min)</label>
                   <input required type="number" className="input-field" placeholder="30" value={form.duration} onChange={e => setForm({...form, duration: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#666] uppercase">Categoria</label>
                <select className="input-field" value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                    <option>Cabelo</option>
                    <option>Barba</option>
                    <option>Combo</option>
                    <option>Química/Outros</option>
                </select>
              </div>

              {/* INSUMOS (COM 3 CASAS DECIMAIS) */}
              <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#222]">
                  <label className="text-[10px] font-bold text-[#666] uppercase mb-2 block">Insumos Gastos (Ficha Técnica)</label>
                  
                  <div className="flex gap-2 mb-2">
                      <select className="input-field text-xs py-2" value={tempSupply.productId} onChange={e => setTempSupply({...tempSupply, productId: e.target.value})}>
                          <option value="">Selecione Insumo...</option>
                          {stockList.map(p => (
                              <option key={p.id} value={p.id}>
                                  {p.name} ({p.measureValue || ''}{p.measureUnit || 'UN'})
                              </option>
                          ))}
                      </select>
                      <input 
                        type="number" 
                        step="0.001" // Permite 3 casas decimais
                        className="input-field w-20 text-xs py-2" 
                        placeholder="Qtd" 
                        value={tempSupply.qty} 
                        onChange={e => setTempSupply({...tempSupply, qty: e.target.value})}
                      />
                      <button type="button" onClick={addSupply} className="bg-[#222] text-gold w-8 rounded border border-[#333] hover:bg-[#333]"><i className="fas fa-plus"></i></button>
                  </div>

                  {form.supplies.length > 0 && (
                      <div className="space-y-1 mt-2">
                          {form.supplies.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs bg-[#111] p-2 rounded border border-[#222]">
                                  <span className="text-gray-300">{item.name}</span>
                                  <div className="flex items-center gap-2">
                                      <span className="text-gold font-mono">{item.qty} {item.unit}</span>
                                      <button type="button" onClick={() => removeSupply(idx)} className="text-red-500 hover:text-red-400"><i className="fas fa-times"></i></button>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>

              <button disabled={submitting} className="btn-primary w-full py-4 mt-4 text-sm uppercase tracking-widest">
                {submitting ? 'Salvando...' : 'Cadastrar Serviço'}
              </button>
            </form>
          </div>
        </div>

        {/* LISTA DE SERVIÇOS (GRID) */}
        <div className="lg:col-span-2">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {loading ? <p className="text-[#666]">Carregando...</p> : services.map(service => (
                  <div key={service.id} className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden group hover:border-[#333] transition-all">
                      <div className="flex">
                          <div className="w-24 h-24 bg-[#000] flex-shrink-0 relative">
                              {service.imageUrl ? (
                                  <img src={service.imageUrl} className="w-full h-full object-cover" alt={service.name} />
                              ) : (
                                  <div className="w-full h-full flex items-center justify-center text-[#333]"><i className="fas fa-cut text-2xl"></i></div>
                              )}
                          </div>
                          <div className="p-4 flex-1 flex flex-col justify-center">
                              <div className="flex justify-between items-start mb-1">
                                  <h4 className="font-bold text-white leading-tight">{service.name}</h4>
                                  <button onClick={() => handleDelete(service.id)} className="text-[#333] hover:text-red-500 transition-colors"><i className="fas fa-trash"></i></button>
                              </div>
                              <p className="text-xs text-[#666] mb-2">{service.category} • {formatDuration(service.duration)}</p>
                              <p className="text-gold font-bold font-mono">{formatCurrency(service.price)}</p>
                              
                              {service.supplies && service.supplies.length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-[#222]">
                                      <p className="text-[9px] text-[#444] uppercase font-bold mb-1">Insumos:</p>
                                      <div className="flex flex-wrap gap-1">
                                          {service.supplies.map((s, i) => (
                                              <span key={i} className="text-[9px] bg-[#0a0a0a] px-1 rounded text-[#555] border border-[#222]">
                                                  {s.name}: {s.qty} {s.unit}
                                              </span>
                                          ))}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}