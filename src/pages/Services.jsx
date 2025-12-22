import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { 
  collection, addDoc, onSnapshot, deleteDoc, doc, serverTimestamp 
} from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function Services() {
  // 1. CAPTURA O ID DA LOJA DO CONTEXTO
  const { shopId } = useOutletContext();
  const APP_ID = shopId; 

  const [services, setServices] = useState([]);
  const [internalProducts, setInternalProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
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

  const [tempSupply, setTempSupply] = useState({ productId: '', qty: '' });

  useEffect(() => {
    if (!APP_ID) return;

    // Busca Serviços da Loja Atual
    const unsubServices = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/services`), (snap) => {
      setServices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    // Busca Produtos da Loja Atual
    const unsubProducts = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/products`), (snap) => {
      const allProds = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const internals = allProds.filter(p => !p.sell);
      setInternalProducts(internals);
    });

    return () => { unsubServices(); unsubProducts(); };
  }, [APP_ID]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAddSupply = () => {
    if (!tempSupply.productId || !tempSupply.qty) return alert("Selecione o produto e a quantidade.");
    
    const product = internalProducts.find(p => p.id === tempSupply.productId);
    if (!product) return;

    const newSupply = {
      id: product.id,
      name: product.name,
      unit: product.unit,
      qty: parseFloat(tempSupply.qty)
    };

    setForm(prev => ({ ...prev, supplies: [...prev.supplies, newSupply] }));
    setTempSupply({ productId: '', qty: '' });
  };

  const handleRemoveSupply = (index) => {
    setForm(prev => ({ ...prev, supplies: prev.supplies.filter((_, i) => i !== index) }));
  };

  const handleDelete = async (id) => {
    if(confirm("Tem certeza que deseja remover este serviço?")) {
      await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/services`, id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/services`), {
        name: form.name,
        price: parseFloat(form.price),
        duration: parseInt(form.duration),
        category: form.category,
        description: form.description,
        imageUrl: form.imageUrl,
        supplies: form.supplies,
        createdAt: serverTimestamp()
      });

      setForm({ name: '', price: '', duration: '30', category: 'Cabelo', description: '', imageUrl: '', supplies: [] });
      alert("Serviço cadastrado com sucesso!");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  
  const formatDuration = (mins) => {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${h}h${m > 0 ? ` ${m}min` : ''}`;
    }
    return `${mins} min`;
  };

  return (
    <div className="space-y-6 pb-10 text-[#F3E5AB]">
      
      {/* FORMULÁRIO */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-[0_0_15px_rgba(0,0,0,0.5)] border border-[#222]">
        <div className="flex items-center gap-2 mb-6 border-b border-[#222] pb-4">
          <i className="fas fa-plus-circle text-gold text-xl"></i>
          <h2 className="text-xl font-bold font-egyptian text-gold tracking-wide">NOVO SERVIÇO</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-4">
            <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">Nome do Serviço</label>
            <input name="name" value={form.name} onChange={handleChange} placeholder="Ex: Corte Platinado" className="input-field" required />
          </div>
          
          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">Categoria</label>
            <select name="category" value={form.category} onChange={handleChange} className="input-field" required>
              <option value="Cabelo">Cabelo</option>
              <option value="Barba">Barba</option>
              <option value="Combo">Combo</option>
              <option value="Química">Química/Outros</option>
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">Preço (R$)</label>
            <input type="number" step="0.01" name="price" value={form.price} onChange={handleChange} className="input-field" required />
          </div>

          <div className="md:col-span-2">
            <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">Duração</label>
            <select name="duration" value={form.duration} onChange={handleChange} className="input-field" required>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hora</option>
              <option value="90">1h 30m</option>
              <option value="120">2 horas</option>
            </select>
          </div>
          
          <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">Descrição Comercial (Site)</label>
                <input name="description" value={form.description} onChange={handleChange} placeholder="Ex: Degrade navalhado..." className="input-field" />
             </div>
             <div>
                <label className="text-[10px] font-bold text-[#888] uppercase mb-1 block tracking-wider">URL da Foto (Capa)</label>
                <input name="imageUrl" value={form.imageUrl} onChange={handleChange} placeholder="https://..." className="input-field" />
             </div>
          </div>

          <div className="md:col-span-12 bg-[#111] p-4 rounded-xl border border-[#222] mt-2">
            <h3 className="text-[10px] font-bold text-gold uppercase mb-3 flex items-center gap-2">
                <i className="fas fa-flask"></i> Insumos (Consumo Padrão)
            </h3>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <select className="input-field flex-grow text-sm" value={tempSupply.productId} onChange={e => setTempSupply({...tempSupply, productId: e.target.value})}>
                <option value="">Selecione um produto interno...</option>
                {internalProducts.map(p => (<option key={p.id} value={p.id}>{p.name} ({p.unit})</option>))}
              </select>
              <div className="flex gap-2">
                <input type="number" step="0.001" className="input-field w-24 text-center" placeholder="Qtd" value={tempSupply.qty} onChange={e => setTempSupply({...tempSupply, qty: e.target.value})} />
                <button type="button" onClick={handleAddSupply} className="bg-gold text-black px-4 rounded-lg font-bold hover:bg-white transition">+</button>
              </div>
            </div>
            
            {form.supplies.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {form.supplies.map((item, idx) => (
                        <div key={idx} className="bg-[#222] border border-[#333] rounded-lg px-3 py-1.5 flex items-center gap-2 text-sm shadow-sm">
                            <span className="font-bold text-[#eee]">{item.name}</span>
                            <span className="text-gold text-xs bg-[#1a1500] px-1.5 py-0.5 rounded border border-gold/30 font-bold">{item.qty} {item.unit}</span>
                            <button type="button" onClick={() => handleRemoveSupply(idx)} className="text-red-400 hover:text-red-600 ml-1"><i className="fas fa-times"></i></button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-[10px] text-[#444] italic text-center py-2 border border-dashed border-[#333] rounded-lg">Nenhum insumo vinculado (Opcional)</p>
            )}
          </div>

          <div className="md:col-span-12 mt-2">
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Salvando...' : 'CADASTRAR SERVIÇO'}</button>
          </div>
        </form>
      </div>

      {/* LISTA */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        <h2 className="text-lg font-bold text-gold font-egyptian mb-4 tracking-wide">CATÁLOGO DE SERVIÇOS ({services.length})</h2>
        {loading ? (
            <p className="text-gray-500 text-sm animate-pulse text-center">Carregando serviços...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map(s => (
              <div key={s.id} className="border border-[#222] p-4 rounded-xl bg-[#111] hover:border-gold hover:shadow-[0_0_15px_rgba(212,175,55,0.1)] transition relative group flex flex-col justify-between h-full">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[9px] font-bold px-2 py-1 rounded uppercase tracking-wider text-black ${s.category === 'Cabelo' ? 'bg-[#F3E5AB]' : s.category === 'Barba' ? 'bg-[#D4AF37]' : 'bg-gray-400'}`}>
                        {s.category}
                    </span>
                    <button onClick={() => handleDelete(s.id)} className="text-[#444] hover:text-red-500 transition" title="Excluir Serviço"><i className="fas fa-trash"></i></button>
                  </div>
                  <h3 className="font-bold text-[#F3E5AB] text-lg">{s.name}</h3>
                  {s.description && <p className="text-xs text-[#666] mb-2 line-clamp-2">{s.description}</p>}
                  
                  <div className="flex items-center gap-2 text-[#888] text-sm mt-1 mb-3 pb-3 border-b border-[#222]">
                    <i className="fas fa-clock text-xs text-gold"></i> {formatDuration(s.duration)}
                    <span className="mx-1 text-[#333]">|</span>
                    <span className="font-black text-gold text-base">{formatCurrency(s.price)}</span>
                  </div>
                  
                  {s.supplies && s.supplies.length > 0 ? (
                    <div className="mb-2">
                        <p className="text-[9px] font-bold text-[#555] uppercase mb-1">Insumos:</p>
                        <div className="flex flex-wrap gap-1">
                            {s.supplies.map((sup, i) => (
                                <span key={i} className="text-[9px] bg-[#1a1a1a] border border-[#333] px-1.5 py-0.5 rounded text-[#aaa]">
                                    {sup.name}: <strong className="text-gold">{sup.qty} {sup.unit}</strong>
                                </span>
                            ))}
                        </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-[#333] italic mb-2">Sem insumos vinculados</p>
                  )}
                </div>
              </div>
            ))}
            {services.length === 0 && (
                <div className="col-span-full text-center py-8 text-[#444] border-2 border-dashed border-[#222] rounded-xl">Nenhum serviço cadastrado. Utilize o formulário acima.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}