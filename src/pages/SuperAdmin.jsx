import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function SuperAdmin() {
  const { user, shopId } = useOutletContext();
  
  // SEU E-MAIL MESTRE (Segurança Extra)
  const MASTER_EMAIL = 'gutoabduch@gmail.com';

  // Define 'abduch' como a loja principal (Holding)
  const isHolding = shopId === 'abduch'; 
  const isMasterUser = user?.email === MASTER_EMAIL;

  if (!isHolding || !isMasterUser) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <h2 className="text-2xl font-bold text-red-500">Acesso Restrito</h2>
        <p className="text-[#666]">Esta área é exclusiva da Diretoria (Holding).</p>
    </div>
  );

  // Estados
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'active'
  const [requests, setRequests] = useState([]);
  const [activeShops, setActiveShops] = useState([]);
  
  // Modal de Aprovação
  const [approving, setApproving] = useState(null);
  const [newSlug, setNewSlug] = useState('');

  useEffect(() => {
    // 1. Buscar Solicitações Pendentes
    const qReq = query(collection(db, "registration_requests"));
    const unsubReq = onSnapshot(qReq, (snap) => {
        setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Buscar Lojas Ativas (Aprovadas)
    // Listamos as solicitações que já foram aprovadas como referência de lojas ativas
    const qActive = query(collection(db, "registration_requests"), orderBy('approvedAt', 'desc'));
    const unsubActive = onSnapshot(qActive, (snap) => {
        const approved = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(r => r.status === 'approved');
        setActiveShops(approved);
    });

    return () => { unsubReq(); unsubActive(); };
  }, []);

  const handleApproveClick = (req) => {
      setApproving(req);
      // Sugere um slug baseado no nome fantasia
      const suggested = req.fantasyName
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, "") // Tira acentos
          .replace(/[^a-z0-9]/g, "-"); // Substitui espaços e símbolos por hifen
      setNewSlug(suggested);
  };

  const confirmApproval = async (e) => {
      e.preventDefault();
      if(!approving || !newSlug) return;

      try {
          const shopSlug = newSlug.trim().toLowerCase();

          // 1. Criar estrutura básica da nova loja em 'artifacts'
          // Cria o documento base da loja
          await setDoc(doc(db, `artifacts/${shopSlug}/public/data`), {
              createdAt: serverTimestamp(),
              plan: 'Basic',
              active: true,
              ownerEmail: approving.email
          });

          // 2. Adicionar o Usuário Dono na coleção de users da loja
          await addDoc(collection(db, `artifacts/${shopSlug}/public/data/users`), {
              email: approving.email,
              name: approving.ownerName,
              role: 'Admin',
              createdAt: serverTimestamp()
          });

          // 3. Atualizar o status da solicitação
          await updateDoc(doc(db, "registration_requests", approving.id), {
              status: 'approved',
              shopSlug: shopSlug,
              approvedAt: serverTimestamp()
          });

          alert(`Loja '${shopSlug}' criada com sucesso!`);
          setApproving(null);
          setNewSlug('');

      } catch (error) {
          console.error("Erro ao aprovar:", error);
          alert("Erro ao criar loja. Verifique o console.");
      }
  };

  const handleReject = async (id) => {
      if(!window.confirm("Rejeitar solicitação?")) return;
      await deleteDoc(doc(db, "registration_requests", id));
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex items-center justify-between mb-8">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">HOLDING</h2>
            <p className="text-[#666] text-sm">Painel Mestre - Gerenciamento de Franquias</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#222] mb-8">
          <button onClick={() => setActiveTab('requests')} className={`pb-3 px-4 text-sm font-bold transition ${activeTab === 'requests' ? 'text-gold border-b-2 border-gold' : 'text-[#666]'}`}>
              Solicitações ({requests.filter(r => r.status === 'pending').length})
          </button>
          <button onClick={() => setActiveTab('active')} className={`pb-3 px-4 text-sm font-bold transition ${activeTab === 'active' ? 'text-gold border-b-2 border-gold' : 'text-[#666]'}`}>
              Lojas Ativas
          </button>
      </div>

      {activeTab === 'requests' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.filter(r => r.status === 'pending').length === 0 && <p className="text-[#444] col-span-full">Nenhuma solicitação pendente.</p>}
              
              {requests.filter(r => r.status === 'pending').map(req => (
                  <div key={req.id} className="bg-[#111] border border-[#333] p-5 rounded-xl">
                      <div className="flex justify-between items-start mb-3">
                        <span className="text-[10px] font-bold bg-blue-900/20 text-blue-400 px-2 py-1 rounded">NOVA SOLICITAÇÃO</span>
                        <span className="text-xs text-[#555]">{new Date(req.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-xl font-bold text-[#eee] mb-1">{req.fantasyName}</h3>
                      <p className="text-xs text-[#888] mb-4">{req.companyName} (CNPJ: {req.cnpj})</p>
                      
                      <div className="bg-[#0a0a0a] p-3 rounded mb-4 text-xs space-y-1 border border-[#222]">
                          <p><strong className="text-[#666]">Dono:</strong> {req.ownerName}</p>
                          <p><strong className="text-[#666]">Email:</strong> {req.email}</p>
                          <p><strong className="text-[#666]">Tel:</strong> {req.phone}</p>
                      </div>

                      <div className="flex gap-2">
                          <button onClick={() => handleApproveClick(req)} className="btn-primary py-2 text-xs">APROVAR</button>
                          <button onClick={() => handleReject(req.id)} className="w-10 bg-red-900/20 text-red-500 rounded hover:bg-red-900/50"><i className="fas fa-times"></i></button>
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
                          <th className="p-4">Loja / Slug</th>
                          <th className="p-4">Responsável</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-right">Ações</th>
                      </tr>
                  </thead>
                  <tbody>
                      {activeShops.map(shop => (
                          <tr key={shop.id} className="border-b border-[#222] hover:bg-[#1a1a1a]">
                              <td className="p-4">
                                  <div className="font-bold text-[#eee]">{shop.fantasyName}</div>
                                  <div className="text-xs text-gold">/{shop.shopSlug}</div>
                              </td>
                              <td className="p-4 text-[#888]">{shop.email}</td>
                              <td className="p-4"><span className="text-green-500 text-xs font-bold px-2 py-1 bg-green-900/20 rounded">ATIVO</span></td>
                              <td className="p-4 text-right">
                                  <button onClick={() => window.open(`/${shop.shopSlug}/login`, '_blank')} className="text-[#666] hover:text-white">
                                      <i className="fas fa-external-link-alt"></i>
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* MODAL DE APROVAÇÃO */}
      {approving && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] p-6 rounded-xl border border-[#333] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-gold mb-4">Aprovar "{approving.fantasyName}"</h3>
                
                <form onSubmit={confirmApproval}>
                    <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Defina a URL da Loja (Slug)</label>
                    <div className="flex items-center gap-2 bg-[#000] border border-[#333] rounded-lg p-3 mb-2">
                        <span className="text-[#666] text-sm">curly.com/</span>
                        <input 
                            className="bg-transparent text-[#eee] outline-none w-full font-bold" 
                            value={newSlug} 
                            onChange={e => setNewSlug(e.target.value.toLowerCase())} 
                            placeholder="ex: barbearia-ze"
                            autoFocus
                        />
                    </div>
                    <p className="text-[10px] text-[#444] mb-6">* Use apenas letras minúsculas e números. Sem espaços.</p>

                    <div className="flex gap-2">
                        <button type="submit" className="btn-primary flex-1">CONFIRMAR E CRIAR</button>
                        <button type="button" onClick={() => setApproving(null)} className="px-4 py-3 rounded-lg border border-[#333] text-[#666] hover:text-white hover:bg-[#222]">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}