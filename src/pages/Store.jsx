import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function Store() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId;
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState('visual'); // 'visual', 'infos', 'hours', 'danger'
  
  // Estados de Dados
  const [schedule, setSchedule] = useState(Array(7).fill({ open: '09:00', close: '18:00', closed: false }));
  const [info, setInfo] = useState({ 
    name: '', phone: '', address: '', instagram: '', mapUrl: '' 
  });
  const [branding, setBranding] = useState({ 
    logoUrl: '', bannerUrl: '', primaryColor: '#D4AF37', secondaryColor: '#000000', slogan: '' 
  });
  const [emergencyDate, setEmergencyDate] = useState('');
  const [loading, setLoading] = useState(true);

  // Segurança
  if (!['Admin', 'Gerente'].includes(role)) return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
          <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
          <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Negado</h2>
      </div>
  );

  useEffect(() => {
    if(!APP_ID) return;
    const loadData = async () => {
        setLoading(true);
        try {
            // 1. Horários
            const sSnap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings`, 'hours')); 
            if(sSnap.exists()) setSchedule(sSnap.data().schedule);

            // 2. Informações Gerais & Branding
            const iSnap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings`, 'info'));
            if(iSnap.exists()) {
                const data = iSnap.data();
                setInfo({ ...info, ...data.contact });
                setBranding({ ...branding, ...data.branding });
            }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    loadData();
  }, [APP_ID]);

  // Salvar Horários
  const saveSchedule = async (e) => { 
      e.preventDefault(); 
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings`, 'hours'), { schedule }); 
      alert("Horários atualizados!"); 
  };
  
  // Salvar Infos e Branding
  const saveSettings = async (e) => {
      e.preventDefault();
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings`, 'info'), { 
          contact: info, 
          branding: branding 
      });
      alert("Configurações do Site atualizadas!");
  };

  const updSchedule = (i, f, v) => { const n = [...schedule]; n[i] = { ...n[i], [f]: v }; setSchedule(n); };
  
  const handleEmergency = async () => {
      const q = query(collection(db, `artifacts/${APP_ID}/public/data/appointments`), where('dateString', '==', emergencyDate));
      const s = await getDocs(q); const emails = new Set(); 
      s.forEach(d => { if(d.data().clientEmail) emails.add(d.data().clientEmail); });
      if(emails.size === 0) return alert("Sem e-mails para esta data.");
      window.open(`mailto:?bcc=${Array.from(emails).join(',')}&subject=Aviso Importante - ${shopId}&body=Prezados clientes,\n\nInformamos que não haverá atendimento no dia ${emergencyDate.split('-').reverse().join('/')}.\n\nAtenciosamente,\nEquipe.`);
  };

  if(loading) return <div className="text-center text-[#666] py-10">Carregando configurações...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-[#F3E5AB]">
      
      {/* HEADER E NAVEGAÇÃO DE ABAS */}
      <div className="bg-[#0a0a0a] p-4 rounded-2xl border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-gold font-egyptian tracking-wide">CONFIGURAÇÃO DA LOJA</h2>
            <p className="text-xs text-[#666]">Personalize o site do cliente e funcionamento.</p>
        </div>
        <div className="flex bg-[#111] p-1 rounded-xl">
            {[
                {id: 'visual', icon: 'fas fa-paint-brush', label: 'Visual'},
                {id: 'infos', icon: 'fas fa-info-circle', label: 'Infos'},
                {id: 'hours', icon: 'fas fa-clock', label: 'Horários'},
                {id: 'danger', icon: 'fas fa-exclamation-triangle', label: 'Emergência'}
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${activeTab === tab.id ? 'bg-gold text-black shadow-lg' : 'text-[#666] hover:text-[#eee]'}`}
                >
                    <i className={tab.icon}></i> {tab.label}
                </button>
            ))}
        </div>
      </div>

      {/* CONTEÚDO DAS ABAS */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        
        {/* ABA 1: VISUAL (BRANDING) */}
        {activeTab === 'visual' && (
            <form onSubmit={saveSettings} className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-[#eee] uppercase border-b border-[#222] pb-2">Identidade Visual</h3>
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">URL do Logo (Transparente)</label>
                            <input className="input-field" value={branding.logoUrl} onChange={e => setBranding({...branding, logoUrl: e.target.value})} placeholder="https://..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">URL do Banner (Capa do Site)</label>
                            <input className="input-field" value={branding.bannerUrl} onChange={e => setBranding({...branding, bannerUrl: e.target.value})} placeholder="https://..." />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Slogan / Frase de Efeito</label>
                            <input className="input-field" value={branding.slogan} onChange={e => setBranding({...branding, slogan: e.target.value})} placeholder="Ex: Estilo e tradição..." />
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-[#eee] uppercase border-b border-[#222] pb-2">Paleta de Cores</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Cor Primária (Destaque)</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={branding.primaryColor} onChange={e => setBranding({...branding, primaryColor: e.target.value})} className="h-10 w-10 rounded border border-[#333] bg-transparent cursor-pointer" />
                                    <input className="input-field" value={branding.primaryColor} onChange={e => setBranding({...branding, primaryColor: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Cor Secundária (Fundo)</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={branding.secondaryColor} onChange={e => setBranding({...branding, secondaryColor: e.target.value})} className="h-10 w-10 rounded border border-[#333] bg-transparent cursor-pointer" />
                                    <input className="input-field" value={branding.secondaryColor} onChange={e => setBranding({...branding, secondaryColor: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        
                        {/* Preview Simples */}
                        <div className="mt-4 p-4 rounded-xl border border-[#333] flex flex-col items-center justify-center text-center gap-2" style={{ backgroundColor: branding.secondaryColor }}>
                            <span className="text-xs text-gray-400 uppercase tracking-widest">Preview Botão</span>
                            <button className="px-6 py-2 rounded-lg font-bold shadow-lg" style={{ backgroundColor: branding.primaryColor, color: branding.secondaryColor === '#000000' ? '#000' : '#fff' }}>Agendar Agora</button>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-[#222]">
                    <button className="btn-primary w-auto px-8">Salvar Aparência</button>
                </div>
            </form>
        )}

        {/* ABA 2: INFOS DE CONTATO */}
        {activeTab === 'infos' && (
            <form onSubmit={saveSettings} className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Nome da Barbearia (Público)</label>
                        <input className="input-field" value={info.name} onChange={e => setInfo({...info, name: e.target.value})} placeholder="Ex: Renovos Barbershop" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Telefone / WhatsApp</label>
                        <input className="input-field" value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} placeholder="(00) 00000-0000" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Endereço Completo</label>
                        <input className="input-field" value={info.address} onChange={e => setInfo({...info, address: e.target.value})} placeholder="Rua, Número, Bairro, Cidade..." />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Link do Instagram</label>
                        <input className="input-field" value={info.instagram} onChange={e => setInfo({...info, instagram: e.target.value})} placeholder="https://instagram.com/..." />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Link do Google Maps</label>
                        <input className="input-field" value={info.mapUrl} onChange={e => setInfo({...info, mapUrl: e.target.value})} placeholder="https://maps.google..." />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-[#222]">
                    <button className="btn-primary w-auto px-8">Salvar Informações</button>
                </div>
            </form>
        )}

        {/* ABA 3: HORÁRIOS */}
        {activeTab === 'hours' && (
            <form onSubmit={saveSchedule} className="animate-fade-in">
                <div className="grid gap-3 mb-6">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d, i) => (
                        <div key={d} className={`flex flex-col sm:flex-row gap-4 items-center p-3 rounded-xl border ${schedule[i].closed ? 'bg-[#111] border-[#222] opacity-50' : 'bg-[#0a0a0a] border-gold/30'}`}>
                            <span className="w-12 font-bold text-lg text-center text-gold">{d}</span>
                            <div className="flex items-center gap-2 flex-1">
                                <div className="flex flex-col"><label className="text-[9px] uppercase font-bold text-[#666]">Abertura</label><input type="time" disabled={schedule[i].closed} value={schedule[i].open} onChange={e=>updSchedule(i,'open',e.target.value)} className="border border-[#333] p-2 rounded-lg bg-[#000] text-[#eee]" /></div>
                                <span className="text-[#666]">-</span>
                                <div className="flex flex-col"><label className="text-[9px] uppercase font-bold text-[#666]">Fechamento</label><input type="time" disabled={schedule[i].closed} value={schedule[i].close} onChange={e=>updSchedule(i,'close',e.target.value)} className="border border-[#333] p-2 rounded-lg bg-[#000] text-[#eee]" /></div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer bg-[#111] px-3 py-2 rounded-lg border border-[#333] hover:border-gold">
                                <input type="checkbox" checked={schedule[i].closed} onChange={e=>updSchedule(i,'closed',e.target.checked)} className="w-5 h-5 text-gold rounded focus:ring-gold" />
                                <span className={`text-sm font-bold ${schedule[i].closed ? 'text-red-500' : 'text-[#eee]'}`}>{schedule[i].closed ? 'FECHADO' : 'ABERTO'}</span>
                            </label>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end pt-4 border-t border-[#222]">
                    <button className="btn-primary w-auto px-8">Salvar Horários</button>
                </div>
            </form>
        )}

        {/* ABA 4: EMERGÊNCIA */}
        {activeTab === 'danger' && (
            <div className="animate-fade-in space-y-6">
                <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2"><i className="fas fa-bullhorn"></i> COMUNICADO URGENTE</h3>
                    <p className="text-sm text-red-300/80 mb-4">Utilize esta ferramenta para notificar todos os clientes de um dia específico sobre imprevistos (falta de luz, luto, manutenção).</p>
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-red-400 uppercase mb-1">Data Afetada</label>
                            <input type="date" value={emergencyDate} onChange={e => setEmergencyDate(e.target.value)} className="w-full border border-red-900/50 rounded-lg p-3 bg-[#000] text-red-200 outline-none" />
                        </div>
                        <button onClick={handleEmergency} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition">GERAR E-MAIL EM MASSA</button>
                    </div>
                </div>
            </div>
        )}

      </div>
    </div>
  );
}