import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function SuperAdmin() {
  const { shopId } = useOutletContext();
  
  // TRAVA DE SEGURANÇA: Só funciona na loja mestre
  if (shopId !== 'testeloja') return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <h2 className="text-2xl font-bold text-red-500">Acesso Restrito</h2>
        <p className="text-[#666]">Esta área é exclusiva da Holding.</p>
    </div>
  );

  const [companies, setCompanies] = useState([]);
  const [form, setForm] = useState({ name: '', slug: '', owner: '', status: 'active' });
  const [loading, setLoading] = useState(true);

  // Busca lista de empresas
  useEffect(() => {
    const q = query(collection(db, 'companies'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.slug.match(/^[a-z0-9]+$/)) return alert("A URL deve conter apenas letras minúsculas e números (sem espaços).");
    
    try {
      await addDoc(collection(db, 'companies'), {
        ...form,
        createdAt: serverTimestamp()
      });
      setForm({ name: '', slug: '', owner: '', status: 'active' });
      alert("Empresa cadastrada com sucesso!");
    } catch (err) { alert("Erro: " + err.message); }
  };

  const toggleStatus = async (comp) => {
      const newStatus = comp.status === 'active' ? 'blocked' : 'active';
      await updateDoc(doc(db, 'companies', comp.id), { status: newStatus });
  };

  const handleDelete = async (id) => {
      if (confirm("ATENÇÃO: Isso apagará o registro da empresa (mas não os dados dela). Continuar?")) {
          await deleteDoc(doc(db, 'companies', id));
      }
  };

  return (
    <div className="space-y-8 pb-10 text-[#F3E5AB]">
      
      {/* HEADER */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222] flex justify-between items-center">
        <div>
            <h2 className="text-xl font-bold text-gold font-egyptian tracking-wide">GESTÃO DE FRANQUIAS</h2>
            <p className="text-xs text-[#666]">Cadastre e gerencie as barbearias parceiras.</p>
        </div>
        <div className="text-right">
            <span className="text-3xl font-black text-[#eee]">{companies.length}</span>
            <span className="text-xs text-gold block uppercase tracking-widest">Ativas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* FORMULÁRIO DE CADASTRO */}
        <div className="lg:col-span-1 bg-[#0a0a0a] p-6 rounded-2xl border border-[#222] h-fit sticky top-24">
            <h3 className="text-lg font-bold text-gold mb-4 border-b border-[#222] pb-2">NOVA PARCERIA</h3>
            <form onSubmit={handleRegister} className="space-y-4">
                <div>
                    <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Nome Fantasia</label>
                    <input className="input-field" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Ex: Barbearia do Zé" required />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">URL de Acesso (ID)</label>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-[#444]">curly.com/</span>
                        <input className="input-field" value={form.slug} onChange={e=>setForm({...form, slug: e.target.value.toLowerCase()})} placeholder="ze123" required />
                    </div>
                    <p className="text-[9px] text-[#444] mt-1">* Apenas letras minúsculas e números.</p>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Responsável</label>
                    <input className="input-field" value={form.owner} onChange={e=>setForm({...form, owner: e.target.value})} placeholder="Nome do Dono" />
                </div>
                <button className="btn-primary mt-2">CRIAR SISTEMA</button>
            </form>
        </div>

        {/* LISTA DE EMPRESAS */}
        <div className="lg:col-span-2 bg-[#0a0a0a] p-6 rounded-2xl border border-[#222]">
            <h3 className="font-bold text-[#eee] mb-4">Empresas Cadastradas</h3>
            {loading ? <p className="text-[#666]">Carregando...</p> : (
                <div className="space-y-3">
                    {companies.map(c => (
                        <div key={c.id} className={`border p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4 transition ${c.status === 'blocked' ? 'border-red-900/30 bg-red-900/10 opacity-75' : 'border-[#222] bg-[#111] hover:border-gold/30'}`}>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-[#F3E5AB] text-lg">{c.name}</h4>
                                    {c.status === 'blocked' && <span className="text-[9px] bg-red-900 text-red-200 px-2 py-0.5 rounded font-bold uppercase">BLOQUEADO</span>}
                                </div>
                                <div className="text-xs text-[#666] flex gap-3 mt-1">
                                    <span><i className="fas fa-link text-gold"></i> /{c.slug}</span>
                                    <span><i className="fas fa-user text-gold"></i> {c.owner}</span>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <a href={`/${c.slug}/login`} target="_blank" className="p-2 text-xs text-blue-400 hover:text-blue-300 border border-[#333] rounded hover:bg-[#222]" title="Abrir Login">
                                    <i className="fas fa-external-link-alt"></i>
                                </a>
                                <button onClick={() => toggleStatus(c)} className={`p-2 text-xs rounded border border-[#333] hover:bg-[#222] ${c.status === 'active' ? 'text-green-500 hover:text-green-400' : 'text-gray-500'}`} title={c.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear'}>
                                    <i className={`fas ${c.status === 'active' ? 'fa-unlock' : 'fa-lock'}`}></i>
                                </button>
                                <button onClick={() => handleDelete(c.id)} className="p-2 text-xs text-red-500 hover:text-red-400 border border-[#333] rounded hover:bg-[#222]" title="Excluir Registro">
                                    <i className="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                    {companies.length === 0 && <p className="text-[#444] text-center italic py-10">Nenhuma empresa cadastrada.</p>}
                </div>
            )}
        </div>

      </div>
    </div>
  );
}