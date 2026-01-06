import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, query, getDoc, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';
import { Globe, CheckCircle, XCircle, ExternalLink, Store, DollarSign, MessageCircle } from 'lucide-react';

export default function SuperAdmin() {
  const { user, shopId } = useOutletContext();
  const MASTER_EMAIL = 'gutoabduch@gmail.com';
  const isHolding = shopId?.toLowerCase() === 'abduch'; 
  const isMasterUser = user?.email === MASTER_EMAIL;

  if (!isHolding || !isMasterUser) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] border border-[#222] rounded-xl">
        <Globe className="w-16 h-16 text-[#333] mb-4" />
        <h2 className="text-2xl font-bold text-[#eee]">Acesso Restrito</h2>
    </div>
  );

  const [activeTab, setActiveTab] = useState('requests'); 
  const [requests, setRequests] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [approving, setApproving] = useState(null);
  const [newSlug, setNewSlug] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Configurações Globais (Salvas no QG)
  const [globalConfig, setGlobalConfig] = useState({ whatsapp: '', pixKey: '', bankInfo: '' });

  useEffect(() => {
    // 1. Monitora pedidos de franquia
    const qReq = query(collection(db, "company_requests"));
    const unsubReq = onSnapshot(qReq, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Monitora Tickets de Suporte
    const qTickets = query(collection(db, "support_tickets"), orderBy('createdAt', 'desc'));
    const unsubTickets = onSnapshot(qTickets, (snap) => {
        setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Carrega Configurações Globais
    loadGlobalConfig();

    return () => { unsubReq(); unsubTickets(); };
  }, []);

  const loadGlobalConfig = async () => {
      try {
          const docRef = doc(db, 'artifacts/abduch/public/data/store_settings/global_config');
          const docSnap = await getDoc(docRef);
          if(docSnap.exists()) setGlobalConfig(docSnap.data());
      } catch(err) { console.error(err); }
  };

  const saveGlobalConfig = async (e) => {
      e.preventDefault();
      try {
          await setDoc(doc(db, 'artifacts/abduch/public/data/store_settings/global_config'), globalConfig);
          alert("Configurações Globais Salvas!");
      } catch(err) { alert("Erro ao salvar."); }
  };

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
          
          // CÁLCULO DOS 15 DIAS GRÁTIS
          const trialDate = new Date();
          trialDate.setDate(trialDate.getDate() + 15);

          // 1. Cria Ambiente da Loja
          await setDoc(doc(db, `artifacts/${shopSlug}/public/data`), {
              createdAt: serverTimestamp(),
              plan: 'Starter', // Plano base
              trialEndsAt: trialDate, // PULO DO GATO (Libera Black por 15 dias)
              active: true,
              storeName: approving.fantasyName || approving.storeName,
              ownerEmail: approving.email || approving.ownerEmail
          });

          // 2. Cria Admin da Loja
          const tempUserId = approving.ownerId || `master_created_${Date.now()}`;
          await setDoc(doc(db, `artifacts/${shopSlug}/public/data/users/${tempUserId}`), {
              email: approving.email || approving.ownerEmail,
              name: approving.ownerName,
              role: 'Admin',
              createdAt: serverTimestamp()
          });

          // 3. Atualiza Pedido
          await updateDoc(doc(db, "company_requests", approving.id), {
              status: 'approved',
              shopSlug: shopSlug,
              approvedAt: serverTimestamp()
          });

          alert(`Loja criada com sucesso!\nURL: /${shopSlug}/login\nTeste Grátis (Black) até: ${trialDate.toLocaleDateString()}`);
          setApproving(null);
          setNewSlug('');
      } catch (error) {
          alert("Erro: " + error.message);
      } finally { setLoading(false); }
  };

  const handleReject = async (id) => {
      if(!window.confirm("Rejeitar?")) return;
      await deleteDoc(doc(db, "company_requests", id));
  };

  const handlePlanChange = async (shopSlug, newPlan) => {
      if(!window.confirm(`Alterar plano para ${newPlan}?`)) return;
      try {
          await updateDoc(doc(db, `artifacts/${shopSlug}/public/data`), { plan: newPlan });
          alert("Plano atualizado!");
      } catch (err) { alert("Erro."); }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8">
          <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">HOLDING</h2>
          <p className="text-[#666] text-sm">Painel Mestre</p>
      </div>

      <div className="flex gap-4 border-b border-[#222] mb-8 overflow-x-auto">
          {['requests', 'active', 'tickets', 'settings'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)} 
                className={`pb-3 px-4 text-sm font-bold capitalize whitespace-nowrap ${activeTab === tab ? 'text-gold border-b-2 border-gold' : 'text-[#666]'}`}
              >
                  {tab === 'requests' ? 'Solicitações' : tab === 'active' ? 'Lojas Ativas' : tab === 'tickets' ? 'Chamados' : 'Configurações'}
              </button>
          ))}
      </div>

      {/* ABA 1: SOLICITAÇÕES */}
      {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingList.length === 0 && <p className="text-[#666]">Nenhuma solicitação pendente.</p>}
              {pendingList.map(req => (
                  <div key={req.id} className="bg-[#111] border border-[#333] p-5 rounded-xl">
                      <span className="text-[10px] font-bold bg-blue-900/20 text-blue-400 px-2 py-1 rounded mb-2 inline-block">PENDENTE</span>
                      <h3 className="text-xl font-bold text-[#eee]">{req.fantasyName || req.storeName}</h3>
                      <p className="text-xs text-[#888] mb-4">Doc: {req.docOwner}</p>
                      <div className="flex gap-2">
                          <button onClick={() => handleApproveClick(req)} className="btn-primary py-2 text-xs w-full">APROVAR (15 DIAS GRÁTIS)</button>
                          <button onClick={() => handleReject(req.id)} className="w-10 bg-red-900/20 text-red-500 rounded flex items-center justify-center"><XCircle className="w-4 h-4"/></button>
                      </div>
                  </div>
              ))}
          </div>
      )}

      {/* ABA 2: LOJAS ATIVAS */}
      {activeTab === 'active' && (
          <div className="bg-[#111] rounded-xl border border-[#333] overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-[#050505] text-[#666] uppercase text-xs">
                      <tr>
                          <th className="p-4">Loja</th>
                          <th className="p-4">Slug</th>
                          <th className="p-4">Plano</th>
                          <th className="p-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222]">
                      {approvedList.map(shop => (
                          <tr key={shop.id} className="hover:bg-[#161616]">
                              <td className="p-4 font-bold text-[#eee]">{shop.fantasyName || shop.storeName}</td>
                              <td className="p-4 text-gold text-xs">/{shop.shopSlug}</td>
                              <td className="p-4">
                                  <select 
                                    className="bg-[#222] text-white text-xs p-2 rounded border border-[#333] outline-none focus:border-gold"
                                    onChange={(e) => handlePlanChange(shop.shopSlug, e.target.value)}
                                    defaultValue="Starter"
                                  >
                                      <option value="Starter">Starter</option>
                                      <option value="Pro">Pro</option>
                                      <option value="Black">Black</option>
                                  </select>
                              </td>
                              <td className="p-4 text-right">
                                  <button onClick={() => window.open(`/${shop.shopSlug}/login`, '_blank')} className="text-[#666] hover:text-white text-xs flex items-center gap-1 ml-auto">
                                      Acessar <ExternalLink className="w-3 h-3"/>
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* ABA 3: TICKETS (CHAMADOS) */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
            {tickets.length === 0 && <p className="text-[#666]">Nenhum chamado aberto.</p>}
            {tickets.map(ticket => (
                <div key={ticket.id} className="bg-[#111] border border-[#333] p-5 rounded-xl hover:border-gold transition">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-gold font-bold text-sm uppercase">{ticket.storeName}</span>
                        <span className="text-[10px] text-[#666]">{ticket.createdAt?.toDate().toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-2 mb-3">
                        <span className="bg-[#222] text-[#888] text-[10px] px-2 py-1 rounded uppercase">{ticket.plan}</span>
                        <span className="bg-blue-900/20 text-blue-400 text-[10px] px-2 py-1 rounded uppercase font-bold">{ticket.subject}</span>
                    </div>
                    <p className="text-[#eee] text-sm bg-[#0a0a0a] p-3 rounded mb-3 border border-[#222]">"{ticket.message}"</p>
                    <div className="flex items-center gap-4 text-xs text-[#666]">
                        <span><i className="fas fa-user mr-1"></i> {ticket.ownerEmail}</span>
                        <span><i className="fas fa-phone mr-1"></i> {ticket.phone || 'Sem telefone'}</span>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* ABA 4: CONFIGURAÇÕES GLOBAIS */}
      {activeTab === 'settings' && (
          <form onSubmit={saveGlobalConfig} className="max-w-2xl bg-[#111] p-6 rounded-xl border border-[#333] space-y-6">
              
              <div className="space-y-4">
                  <h3 className="text-gold font-bold flex items-center gap-2 border-b border-[#222] pb-2">
                      <MessageCircle className="w-5 h-5" /> Contato de Suporte
                  </h3>
                  <div>
                      <label className="text-xs text-[#666] font-bold uppercase mb-1 block">WhatsApp (Número Completo)</label>
                      <input 
                        className="input-field w-full bg-[#222] text-white p-2 rounded border border-[#444]" 
                        placeholder="Ex: 5511999999999"
                        value={globalConfig.whatsapp}
                        onChange={e => setGlobalConfig({...globalConfig, whatsapp: e.target.value})}
                      />
                      <p className="text-[10px] text-[#444] mt-1">Este número será acionado pelos clientes BLACK.</p>
                  </div>
              </div>

              <div className="space-y-4 pt-4">
                  <h3 className="text-gold font-bold flex items-center gap-2 border-b border-[#222] pb-2">
                      <DollarSign className="w-5 h-5" /> Recebimento de Planos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs text-[#666] font-bold uppercase mb-1 block">Chave PIX</label>
                          <input 
                            className="input-field w-full bg-[#222] text-white p-2 rounded border border-[#444]" 
                            placeholder="CNPJ ou E-mail"
                            value={globalConfig.pixKey}
                            onChange={e => setGlobalConfig({...globalConfig, pixKey: e.target.value})}
                          />
                      </div>
                      <div>
                          <label className="text-xs text-[#666] font-bold uppercase mb-1 block">Banco / Instituição</label>
                          <input 
                            className="input-field w-full bg-[#222] text-white p-2 rounded border border-[#444]" 
                            placeholder="Ex: Nubank"
                            value={globalConfig.bankInfo}
                            onChange={e => setGlobalConfig({...globalConfig, bankInfo: e.target.value})}
                          />
                      </div>
                  </div>
              </div>

              <button className="btn-primary w-full py-3 mt-4 bg-gold text-black font-bold rounded">SALVAR CONFIGURAÇÕES GLOBAIS</button>
          </form>
      )}

      {/* MODAL (APROVAÇÃO) */}
      {approving && (
         <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
             <div className="bg-[#111] p-6 rounded-xl border border-[#333] w-full max-w-md">
                 <h3 className="font-bold text-white mb-4">Criar Loja (15 Dias Grátis)</h3>
                 <form onSubmit={confirmApproval}>
                     <input className="input-field w-full bg-[#222] text-white p-2 rounded mb-4" value={newSlug} onChange={e=>setNewSlug(e.target.value)} placeholder="slug-da-loja" />
                     <button className="btn-primary w-full bg-gold text-black font-bold py-2 rounded">{loading ? 'CRIANDO...' : 'CONFIRMAR E CRIAR'}</button>
                     <button type="button" onClick={()=>setApproving(null)} className="w-full mt-2 text-[#666] text-xs">Cancelar</button>
                 </form>
             </div>
         </div>
      )}
    </div>
  );
}