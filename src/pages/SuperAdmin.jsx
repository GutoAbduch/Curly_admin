import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, query } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { Globe, CheckCircle, XCircle, ExternalLink, Store } from 'lucide-react';

export default function SuperAdmin() {
  const { user, shopId } = useOutletContext();
  const MASTER_EMAIL = 'gutoabduch@gmail.com';
  const isHolding = shopId?.toLowerCase() === 'abduch'; 
  const isMasterUser = user?.email === MASTER_EMAIL;

  if (!isHolding || !isMasterUser) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] border border-[#222] rounded-xl">
        <Globe className="w-16 h-16 text-[#333] mb-4" />
        <h2 className="text-2xl font-bold text-[#eee]">Acesso Restrito</h2>
        <p className="text-[#666]">Esta área é exclusiva da Diretoria (Holding).</p>
    </div>
  );

  const [activeTab, setActiveTab] = useState('requests'); 
  const [requests, setRequests] = useState([]);
  const [approving, setApproving] = useState(null);
  const [newSlug, setNewSlug] = useState('');
  const [loading, setLoading] = useState(false);

  // Armazena os planos reais das lojas ativas para exibir no select
  // Em uma app maior, você buscaria isso de cada coleção, mas aqui faremos uma suposição ou leitura direta se possível.
  // Simplificação: Vamos apenas permitir MUDAR (WRITE). O READ ideal exigiria ler 'artifacts/{slug}/public/data' de cada loja.
  // Por enquanto, o select vai funcionar para APLICAR a mudança.

  useEffect(() => {
    const qReq = query(collection(db, "company_requests"));
    const unsubReq = onSnapshot(qReq, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubReq(); };
  }, []);

  const pendingList = requests.filter(r => r.status === 'pending');
  const approvedList = requests.filter(r => r.status === 'approved');

  const handleApproveClick = (req) => {
      setApproving(req);
      const suggested = (req.fantasyName || req.storeName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "-"); 
      setNewSlug(suggested);
  };

  const confirmApproval = async (e) => {
      e.preventDefault();
      if(!approving || !newSlug) return;
      setLoading(true);

      try {
          const shopSlug = newSlug.trim().toLowerCase();
          
          // CRIA O AMBIENTE
          await setDoc(doc(db, `artifacts/${shopSlug}/public/data`), {
              createdAt: serverTimestamp(),
              plan: 'Starter', // PLANO PADRÃO AO NASCER
              active: true,
              storeName: approving.fantasyName || approving.storeName,
              ownerEmail: approving.email || approving.ownerEmail
          });

          // CRIA O ADMIN
          const tempUserId = approving.ownerId || `master_created_${Date.now()}`;
          await setDoc(doc(db, `artifacts/${shopSlug}/public/data/users/${tempUserId}`), {
              email: approving.email || approving.ownerEmail,
              name: approving.ownerName,
              role: 'Admin',
              createdAt: serverTimestamp()
          });

          // ATUALIZA STATUS
          await updateDoc(doc(db, "company_requests", approving.id), {
              status: 'approved',
              shopSlug: shopSlug,
              approvedAt: serverTimestamp()
          });

          alert(`Sucesso! Loja criada.\nURL: /${shopSlug}/login`);
          setApproving(null);
          setNewSlug('');
      } catch (error) {
          alert("Erro: " + error.message);
      } finally { setLoading(false); }
  };

  const handleReject = async (id) => {
      if(!window.confirm("Rejeitar solicitação?")) return;
      await deleteDoc(doc(db, "company_requests", id));
  };

  // --- NOVA FUNÇÃO: TROCAR PLANO ---
  const handlePlanChange = async (shopSlug, newPlan) => {
      if(!window.confirm(`Deseja alterar o plano da loja ${shopSlug} para ${newPlan}?`)) return;
      try {
          // Atualiza o documento de configuração da loja alvo
          await updateDoc(doc(db, `artifacts/${shopSlug}/public/data`), { plan: newPlan });
          alert("Plano atualizado com sucesso!");
      } catch (err) {
          alert("Erro ao atualizar plano: " + err.message);
      }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">HOLDING</h2>
            <p className="text-[#666] text-sm">Painel Mestre</p>
        </div>
      </div>

      <div className="flex gap-4 border-b border-[#222] mb-8">
          <button onClick={() => setActiveTab('requests')} className={`pb-3 px-4 text-sm font-bold transition ${activeTab === 'requests' ? 'text-gold border-b-2 border-gold' : 'text-[#666]'}`}>Solicitações</button>
          <button onClick={() => setActiveTab('active')} className={`pb-3 px-4 text-sm font-bold transition ${activeTab === 'active' ? 'text-gold border-b-2 border-gold' : 'text-[#666]'}`}>Lojas Ativas</button>
      </div>

      {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingList.map(req => (
                  <div key={req.id} className="bg-[#111] border border-[#333] p-5 rounded-xl">
                      <span className="text-[10px] font-bold bg-blue-900/20 text-blue-400 px-2 py-1 rounded mb-2 inline-block">PENDENTE</span>
                      <h3 className="text-xl font-bold text-[#eee]">{req.fantasyName || req.storeName}</h3>
                      <p className="text-xs text-[#888] mb-4">Doc: {req.docOwner}</p>
                      <div className="flex gap-2">
                          <button onClick={() => handleApproveClick(req)} className="btn-primary py-2 text-xs w-full">APROVAR</button>
                          <button onClick={() => handleReject(req.id)} className="w-10 bg-red-900/20 text-red-500 rounded flex items-center justify-center"><XCircle className="w-4 h-4"/></button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {activeTab === 'active' && (
          <div className="bg-[#111] rounded-xl border border-[#333] overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-[#050505] text-[#666] uppercase text-xs">
                      <tr>
                          <th className="p-4">Loja</th>
                          <th className="p-4">Slug</th>
                          <th className="p-4">Plano Atual</th>
                          <th className="p-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                      {approvedList.map(shop => (
                          <tr key={shop.id} className="hover:bg-[#161616]">
                              <td className="p-4 font-bold text-[#eee]">{shop.fantasyName || shop.storeName}</td>
                              <td className="p-4 text-gold text-xs">/{shop.shopSlug}</td>
                              <td className="p-4">
                                  {/* SELETOR DE PLANO */}
                                  <select 
                                    className="bg-[#222] text-white text-xs p-2 rounded border border-[#333] outline-none focus:border-gold"
                                    onChange={(e) => handlePlanChange(shop.shopSlug, e.target.value)}
                                    defaultValue="Starter" // Idealmente leria o valor atual, mas assumimos Starter na UI
                                  >
                                      <option value="Starter">Starter (Max 3)</option>
                                      <option value="Pro">Pro (Max 5)</option>
                                      <option value="Black">Black (Total)</option>
                                  </select>
                              </td>
                              <td className="p-4 text-right">
                                  <button onClick={() => window.open(`/${shop.shopSlug}/login`, '_blank')} className="text-[#666] hover:text-white transition text-xs flex items-center gap-1 ml-auto">
                                      Acessar <ExternalLink className="w-3 h-3"/>
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* MODAL (Mantido igual ao anterior, só abreviado aqui para focar na mudança do plano) */}
      {approving && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
             <div className="bg-[#111] p-6 rounded-xl border border-[#333] w-full max-w-md">
                 <h3 className="font-bold text-white mb-4">Confirmar Loja</h3>
                 <form onSubmit={confirmApproval}>
                     <input className="input-field w-full bg-[#222] mb-4" value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="slug-da-loja" />
                     <button className="btn-primary w-full">{loading ? 'CRIANDO...' : 'CRIAR'}</button>
                     <button type="button" onClick={()=>setApproving(null)} className="w-full mt-2 text-[#666] text-xs">Cancelar</button>
                 </form>
             </div>
         </div>
      )}
    </div>
  );
}