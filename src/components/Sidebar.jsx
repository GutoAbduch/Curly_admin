import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, Scissors, Package, DollarSign, LogOut, Globe, Lock, LayoutDashboard, Headphones, Send, AlertCircle
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { canAccess } from '../config/plans';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';

export default function Sidebar({ userRole, shopId, storePlan, supportWhatsapp }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Estados do Modal de Suporte
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [ticket, setTicket] = useState({ subject: '', message: '' });
  const [sendingTicket, setSendingTicket] = useState(false);

  const isActive = (path) => {
    return location.pathname.includes(path) 
      ? "flex items-center gap-3 p-3 rounded-xl bg-[#D4AF37] text-black font-bold shadow-[0_0_15px_rgba(212,175,55,0.4)] transition-all" 
      : "flex items-center gap-3 p-3 rounded-xl text-[#888] hover:bg-[#222] hover:text-[#eee] transition-all";
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate(`/${shopId}/login`);
  };

  const isMasterStore = shopId?.toLowerCase() === 'abduch';

  const handleSupportClick = () => {
      // Se for Black e tiver WhatsApp, mantém o redirecionamento VIP
      if (storePlan === 'Black' && supportWhatsapp) {
          window.open(`https://wa.me/${supportWhatsapp.replace(/\D/g, '')}`, '_blank');
      } else {
          setShowSupportModal(true);
      }
  };

  // --- FUNÇÃO: ENVIAR TICKET DINÂMICO ---
  const handleSubmitTicket = async (e) => {
      e.preventDefault();
      if(!ticket.subject || !ticket.message) return alert("Preencha todos os campos.");
      
      setSendingTicket(true);
      try {
          // 1. Busca dados da loja para identificação
          const storeDoc = await getDoc(doc(db, `artifacts/${shopId}/public/data`));
          const storeData = storeDoc.exists() ? storeDoc.data() : {};

          // 2. Salva o Ticket na coleção Global do Admin
          await addDoc(collection(db, "support_tickets"), {
              shopId: shopId,
              storeName: storeData.storeName || shopId,
              ownerEmail: storeData.ownerEmail || auth.currentUser?.email || 'Não identificado',
              phone: storeData.phone || '', // Tenta pegar o telefone da loja
              plan: storePlan,
              subject: ticket.subject,
              message: ticket.message,
              status: 'pending',
              createdAt: serverTimestamp(),
          });

          alert("Solicitação enviada! Aguarde nosso retorno diretamente pelo e-mail ou Telefone.");
          setShowSupportModal(false);
          setTicket({ subject: '', message: '' });

      } catch (error) {
          console.error(error);
          alert("Erro ao enviar solicitação. Tente novamente.");
      } finally {
          setSendingTicket(false);
      }
  };

  return (
    <>
    <aside className="w-64 bg-[#0a0a0a] border-r border-[#222] flex flex-col h-screen fixed left-0 top-0 z-40">
      
      <div className="p-8 flex flex-col items-center border-b border-[#222]">
         <div className="w-16 h-16 rounded-full border-2 border-[#D4AF37] flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(212,175,55,0.1)]">
            <Scissors className="text-[#D4AF37] w-8 h-8" />
         </div>
         <h1 className="text-xl font-black font-egyptian tracking-widest text-white">CURLY</h1>
         
         <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] text-[#666] uppercase tracking-widest">{shopId}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border border-opacity-20 ${
                storePlan === 'Black' ? 'bg-white text-black border-white' : 
                storePlan === 'Pro' ? 'bg-blue-900/30 text-blue-400 border-blue-500' : 
                'bg-[#222] text-[#888] border-[#444]'
            }`}>
                {storePlan}
            </span>
         </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        <p className="px-4 text-[10px] font-bold text-[#444] uppercase mb-2 mt-2">Gestão</p>

        <Link to={`/${shopId}/admin/services`} className={isActive('services')}>
          <Scissors className="w-5 h-5" /> <span>Serviços</span>
        </Link>

        <Link to={`/${shopId}/admin/appointments`} className={isActive('appointments')}>
          <Calendar className="w-5 h-5" /> <span>Agenda</span>
        </Link>

        {canAccess(storePlan, 'stock') ? (
            <Link to={`/${shopId}/admin/stock`} className={isActive('stock')}>
              <Package className="w-5 h-5" /> <span>Estoque</span>
            </Link>
        ) : (
            <div className="flex items-center gap-3 p-3 rounded-xl text-[#444] cursor-not-allowed group relative">
              <Lock className="w-5 h-5 group-hover:text-red-500 transition-colors" />
              <span>Estoque</span>
            </div>
        )}

        {['Gerente', 'Admin'].includes(userRole) && (
          <>
            <p className="px-4 text-[10px] font-bold text-[#444] uppercase mb-2 mt-6">Administrativo</p>
            
            {canAccess(storePlan, 'finance') ? (
                <Link to={`/${shopId}/admin/finance`} className={isActive('finance')}>
                  <DollarSign className="w-5 h-5" /> <span>Financeiro</span>
                </Link>
            ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl text-[#444] cursor-not-allowed group relative">
                   <Lock className="w-5 h-5 group-hover:text-red-500 transition-colors" />
                   <span>Financeiro</span>
                </div>
            )}

            <Link to={`/${shopId}/admin/users`} className={isActive('users')}>
              <Users className="w-5 h-5" /> <span>Equipe</span>
            </Link>

            <Link to={`/${shopId}/admin/store`} className={isActive('store')}>
              <LayoutDashboard className="w-5 h-5" /> <span>Minha Loja</span>
            </Link>
          </>
        )}

        {/* BOTÃO FALE CONOSCO */}
        <div className="mt-6 pt-4 border-t border-[#222]">
            <button onClick={handleSupportClick} className="flex items-center gap-3 p-3 w-full rounded-xl text-[#eee] hover:bg-[#222] transition-colors">
                <Headphones className="w-5 h-5 text-gold" />
                <span className="font-bold text-sm">Fale Conosco</span>
            </button>
        </div>

        {isMasterStore && userRole === 'Admin' && (
           <div className="mt-2">
              <Link to={`/${shopId}/admin/superadmin`} className={isActive('superadmin')}>
                  <Globe className="w-5 h-5" /> <span>Holding (QG)</span>
              </Link>
           </div>
        )}

      </nav>

      <div className="p-4 border-t border-[#222]">
        <button onClick={handleLogout} className="flex items-center gap-3 p-3 w-full rounded-xl text-red-500 hover:bg-red-900/10 transition-colors">
          <LogOut className="w-5 h-5" /> <span className="font-bold">Sair</span>
        </button>
      </div>
    </aside>

    {/* MODAL DE SUPORTE DINÂMICO */}
    {showSupportModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-[#111] p-6 rounded-xl border border-[#333] w-full max-w-md shadow-2xl animate-fade-in">
                <div className="text-center mb-6">
                    <Headphones className="w-10 h-10 text-gold mx-auto mb-3" />
                    <h3 className="text-xl font-bold text-white">Central de Ajuda</h3>
                    <p className="text-[#666] text-xs">Descreva seu problema abaixo.</p>
                </div>
                
                <form onSubmit={handleSubmitTicket} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Assunto</label>
                        <select 
                            className="input-field w-full mt-1 bg-[#222] text-white border border-[#444] rounded p-2 outline-none focus:border-gold"
                            value={ticket.subject}
                            onChange={e => setTicket({...ticket, subject: e.target.value})}
                            required
                        >
                            <option value="">Selecione...</option>
                            <option value="Dúvida Financeira">Dúvida Financeira</option>
                            <option value="Problema Técnico">Problema Técnico</option>
                            <option value="Upgrade de Plano">Quero mudar de Plano</option>
                            <option value="Outros">Outros</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Mensagem</label>
                        <textarea 
                            className="input-field w-full h-32 mt-1 resize-none bg-[#222] text-white border border-[#444] rounded p-2 outline-none focus:border-gold" 
                            placeholder="Descreva o que aconteceu..."
                            value={ticket.message}
                            onChange={e => setTicket({...ticket, message: e.target.value})}
                            required
                        />
                    </div>

                    <div className="bg-blue-900/10 border border-blue-900/30 p-3 rounded text-[10px] text-blue-400 flex gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <div>
                            Nossa equipe receberá seus dados de contato automaticamente para retorno.
                        </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setShowSupportModal(false)} className="flex-1 py-3 rounded-lg border border-[#333] text-[#666] hover:text-white text-xs font-bold">CANCELAR</button>
                        <button type="submit" disabled={sendingTicket} className="flex-1 btn-primary py-3 flex items-center justify-center gap-2 bg-[#D4AF37] text-black font-bold rounded-lg hover:bg-[#b5952f]">
                            {sendingTicket ? 'ENVIANDO...' : <><Send className="w-4 h-4" /> ENVIAR</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )}
    </>
  );
}