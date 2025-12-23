import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, doc, updateDoc, setDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function SuperAdmin() {
  const { user, shopId } = useOutletContext();
  
  // SEU E-MAIL MESTRE (Segurança Extra)
  const MASTER_EMAIL = 'gutoabduch@gmail.com';

  // Verifica se está na Loja Principal (Holding) E se é você
  // Caso mude o nome da loja principal, altere 'testeloja' aqui
  const isHolding = shopId === 'testeloja' || shopId === 'curlymain'; 
  const isMasterUser = user?.email === MASTER_EMAIL;

  if (!isHolding || !isMasterUser) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <h2 className="text-2xl font-bold text-red-500">Acesso Restrito</h2>
        <p className="text-[#666]">Esta área é exclusiva da Diretoria (Holding).</p>
    </div>
  );

  // Estados
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'active' | 'admins'
  const [requests, setRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para Aprovação
  const [approving, setApproving] = useState(null); // Objeto da solicitação sendo aprovada
  const [newSlug, setNewSlug] = useState(''); // O ID da URL (ex: barbearia-ze)

  // Busca Dados em Tempo Real
  useEffect(() => {
    // 1. Busca Solicitações Pendentes
    const unsubReq = onSnapshot(query(collection(db, 'company_requests'), orderBy('requestDate', 'desc')), (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 2. Busca Empresas Ativas
    const unsubComp = onSnapshot(query(collection(db, 'companies'), orderBy('createdAt', 'desc')), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubReq(); unsubComp(); };
  }, []);

  // --- FUNÇÕES DE APROVAÇÃO ---
  
  const initiateApproval = (req) => {
    setApproving(req);
    // Sugere um slug baseado no nome fantasia (remove espaços e caracteres especiais)
    const suggested = req.fantasyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    setNewSlug(suggested);
  };

  const confirmApproval = async (e) => {
    e.preventDefault();
    if (!newSlug) return alert("Defina a URL da loja.");
    
    // Verifica se slug é válido (apenas letras minúsculas e números)
    if (!/^[a-z0-9]+$/.test(newSlug)) return alert("A URL deve conter apenas letras minúsculas e números.");

    try {
        // 1. Cria o registro oficial da empresa na coleção 'companies'
        await setDoc(doc(db, 'companies', newSlug), {
            name: approving.fantasyName,
            slug: newSlug,
            ownerName: approving.ownerName,
            docOwner: approving.docOwner,
            email: approving.email,
            phone: approving.phone,
            address: approving.address,
            status: 'active', // active, blocked
            contractStatus: 'pending', // pending, sent, signed
            contractUrl: '',
            createdAt: serverTimestamp(),
            subscriptionStart: serverTimestamp()
        });

        // 2. Cria a estrutura inicial do Banco de Dados da Loja (artifacts)
        // Isso garante que a loja já nasça com configurações básicas
        const shopPath = `artifacts/${newSlug}/public/data`;
        
        // 2.1 Configurações de Loja (Infos)
        await setDoc(doc(db, `${shopPath}/store_settings/info`), {
            contact: {
                name: approving.fantasyName,
                phone: approving.phone,
                address: approving.address,
                instagram: '',
                mapUrl: ''
            },
            branding: {
                logoUrl: '',
                bannerUrl: '',
                primaryColor: '#D4AF37',
                secondaryColor: '#000000',
                slogan: 'Bem-vindo à nossa barbearia'
            }
        });

        // 2.2 Horários Padrão
        await setDoc(doc(db, `${shopPath}/store_settings/hours`), {
            schedule: Array(7).fill({ open: '09:00', close: '18:00', closed: false })
        });

        // 3. Remove da lista de solicitações
        await deleteDoc(doc(db, 'company_requests', approving.id));

        alert(`Sucesso! A loja "${approving.fantasyName}" foi criada.\nURL: curly.com/${newSlug}`);
        setApproving(null);
        setNewSlug('');
        setActiveTab('active');

    } catch (err) {
        console.error(err);
        alert("Erro ao criar loja: " + err.message);
    }
  };

  const handleReject = async (id) => {
      if (confirm("Tem certeza que deseja rejeitar e excluir esta solicitação?")) {
          await deleteDoc(doc(db, 'company_requests', id));
      }
  };

  // --- FUNÇÕES DE GESTÃO ---

  const toggleStatus = async (comp) => {
      const newStatus = comp.status === 'active' ? 'blocked' : 'active';
      const reason = newStatus === 'blocked' ? prompt("Motivo do bloqueio (opcional):") : '';
      
      await updateDoc(doc(db, 'companies', comp.id), { 
          status: newStatus,
          blockedReason: reason || ''
      });
  };

  // Placeholder para Upload de Contrato (Fase 3)
  const handleUploadContract = (comp) => {
      alert("Na próxima fase (Fase 3), abriremos a seleção de arquivos aqui.\n\nPor enquanto, o status mudará para 'Enviado'.");
      updateDoc(doc(db, 'companies', comp.id), { contractStatus: 'sent' });
  };

  return (
    <div className="space-y-8 pb-10 text-[#F3E5AB]">
      
      {/* HEADER */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-gold font-egyptian tracking-wide">HOLDING CURLY</h2>
            <p className="text-xs text-[#666]">Painel Mestre de Controle de Franquias.</p>
        </div>
        
        {/* Navegação de Abas */}
        <div className="flex bg-[#111] p-1 rounded-xl">
            <button onClick={()=>setActiveTab('requests')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-gold text-black' : 'text-[#666] hover:text-[#eee]'}`}>
                <i className="fas fa-inbox"></i> Solicitações {requests.length > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 rounded-full">{requests.length}</span>}
            </button>
            <button onClick={()=>setActiveTab('active')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeTab === 'active' ? 'bg-gold text-black' : 'text-[#666] hover:text-[#eee]'}`}>
                <i className="fas fa-store"></i> Franquias Ativas
            </button>
        </div>
      </div>

      {/* CONTEÚDO: SOLICITAÇÕES */}
      {activeTab === 'requests' && (
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-[#222] animate-fade-in">
              <h3 className="font-bold text-[#eee] mb-4 border-b border-[#222] pb-2">Pedidos de Abertura ({requests.length})</h3>
              
              {requests.length === 0 ? (
                  <p className="text-center text-[#444] py-8 italic">Nenhuma solicitação pendente.</p>
              ) : (
                  <div className="grid gap-4">
                      {requests.map(req => (
                          <div key={req.id} className="border border-[#222] p-4 rounded-xl bg-[#111] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                              <div>
                                  <h4 className="text-lg font-bold text-gold">{req.fantasyName}</h4>
                                  <div className="text-xs text-[#888] mt-1 space-y-1">
                                      <p><i className="fas fa-user w-4"></i> {req.ownerName} ({req.docOwner})</p>
                                      <p><i className="fas fa-envelope w-4"></i> {req.email} • {req.phone}</p>
                                      <p><i className="fas fa-map-marker-alt w-4"></i> {req.address}</p>
                                  </div>
                              </div>
                              <div className="flex gap-2">
                                  <button onClick={() => handleReject(req.id)} className="px-4 py-2 border border-red-900/50 text-red-500 rounded hover:bg-red-900/20 text-xs font-bold transition">REJEITAR</button>
                                  <button onClick={() => initiateApproval(req)} className="btn-primary w-auto px-6 py-2 text-xs">APROVAR & CRIAR</button>
                              </div>
                          </div>
                      ))}
                  </div>
              )}
          </div>
      )}

      {/* CONTEÚDO: FRANQUIAS ATIVAS */}
      {activeTab === 'active' && (
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-[#222] animate-fade-in">
              <h3 className="font-bold text-[#eee] mb-4 border-b border-[#222] pb-2">Rede de Franquias ({companies.length})</h3>
              
              <div className="space-y-3">
                  {companies.map(c => (
                      <div key={c.id} className={`border p-4 rounded-xl flex flex-col lg:flex-row justify-between items-center gap-4 transition ${c.status === 'blocked' ? 'border-red-900/30 bg-red-900/10 opacity-75' : 'border-[#222] bg-[#111]'}`}>
                          
                          {/* Info da Loja */}
                          <div className="flex-1 w-full">
                              <div className="flex items-center gap-3">
                                  <h4 className="font-bold text-[#F3E5AB] text-lg">{c.name}</h4>
                                  <span className="text-[10px] bg-[#222] border border-[#333] px-2 py-0.5 rounded text-[#888] font-mono">ID: {c.slug}</span>
                                  {c.status === 'blocked' && <span className="text-[9px] bg-red-900 text-red-200 px-2 py-0.5 rounded font-bold uppercase">BLOQUEADO</span>}
                              </div>
                              <div className="flex flex-wrap gap-4 mt-2 text-xs text-[#666]">
                                  <span><i className="fas fa-user text-gold"></i> {c.ownerName}</span>
                                  <span><i className="fas fa-calendar text-gold"></i> Início: {c.createdAt?.toDate().toLocaleDateString()}</span>
                                  
                                  {/* Status do Contrato */}
                                  <span className={`flex items-center gap-1 ${c.contractStatus === 'signed' ? 'text-green-500' : 'text-yellow-500'}`}>
                                      <i className="fas fa-file-signature"></i> 
                                      {c.contractStatus === 'pending' ? 'Contrato Pendente' : c.contractStatus === 'sent' ? 'Contrato Enviado' : 'Contrato Assinado'}
                                  </span>
                              </div>
                          </div>
                          
                          {/* Ações */}
                          <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
                              <a href={`/${c.slug}/login`} target="_blank" rel="noreferrer" className="p-2 text-xs text-blue-400 hover:text-blue-300 border border-[#333] rounded hover:bg-[#222]" title="Acessar Painel">
                                  <i className="fas fa-external-link-alt"></i> Acessar
                              </a>
                              
                              <button onClick={() => handleUploadContract(c)} className="p-2 text-xs text-gold hover:text-white border border-[#333] rounded hover:bg-[#222]" title="Enviar/Gerenciar Contrato">
                                  <i className="fas fa-file-upload"></i> Contrato
                              </button>

                              <button onClick={() => toggleStatus(c)} className={`p-2 text-xs rounded border border-[#333] hover:bg-[#222] ${c.status === 'active' ? 'text-green-500 hover:text-green-400' : 'text-gray-500'}`} title={c.status === 'active' ? 'Bloquear Acesso' : 'Desbloquear'}>
                                  <i className={`fas ${c.status === 'active' ? 'fa-unlock' : 'fa-lock'}`}></i> {c.status === 'active' ? 'Bloquear' : 'Liberar'}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* MODAL DE APROVAÇÃO */}
      {approving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
            <div className="bg-[#111] border border-[#333] p-6 rounded-2xl w-full max-w-md shadow-2xl">
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