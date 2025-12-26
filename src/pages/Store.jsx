import React, { useState, useEffect } from 'react';
import { db, storage } from '../config/firebase'; 
import { doc, getDoc, setDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useOutletContext } from 'react-router-dom';

export default function Store() {
  const { role, shopId } = useOutletContext();
  
  const [activeTab, setActiveTab] = useState('visual'); 
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [emergencyDate, setEmergencyDate] = useState('');

  // ESTADO INICIAL (Visual enquanto carrega)
  const [schedule, setSchedule] = useState([
      { day: 0, label: 'Domingo', open: '09:00', close: '14:00', closed: true },
      { day: 1, label: 'Segunda', open: '09:00', close: '20:00', closed: false },
      { day: 2, label: 'Terça',   open: '09:00', close: '20:00', closed: false },
      { day: 3, label: 'Quarta',  open: '09:00', close: '20:00', closed: false },
      { day: 4, label: 'Quinta',  open: '09:00', close: '20:00', closed: false },
      { day: 5, label: 'Sexta',   open: '09:00', close: '20:00', closed: false },
      { day: 6, label: 'Sábado',  open: '09:00', close: '19:00', closed: false },
  ]);

  const [info, setInfo] = useState({ 
    name: '', phone: '', address: '', instagram: '', mapUrl: '' 
  });
  
  const [branding, setBranding] = useState({ 
    logoUrl: '', bannerUrl: '', primaryColor: '#D4AF37', secondaryColor: '#000000', slogan: '' 
  });

  // Validação de Acesso
  if (!['Admin', 'Gerente'].includes(role)) return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
          <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
          <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Negado</h2>
      </div>
  );

  useEffect(() => {
    if(!shopId) return;
    loadData();
  }, [shopId]);

  const loadData = async () => {
    setLoading(true);
    try {
        // Caminho corrigido para evitar o erro de segmentos ímpares
        const docRef = doc(db, `artifacts/${shopId}/public/data/store_settings/full_config`);
        const docSnap = await getDoc(docRef);
        
        if(docSnap.exists()) {
            const data = docSnap.data();
            
            // Carrega Horários (com proteção para o índice 'day')
            if(data.schedule && Array.isArray(data.schedule)) {
                const dbSchedule = data.schedule.map((item, index) => ({
                    ...item,
                    day: item.day !== undefined ? item.day : index 
                }));
                setSchedule(dbSchedule);
            }

            if(data.info) setInfo(data.info);
            if(data.branding) setBranding(data.branding);
        }
    } catch (err) { 
        console.error("Erro ao carregar:", err); 
    } finally { 
        setLoading(false); 
    }
  };

  // Upload de Imagem (Logo ou Banner)
  const handleImageUpload = async (e, type) => {
      const file = e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) return alert("Apenas imagens (PNG, JPG).");
      if (file.size > 5 * 1024 * 1024) return alert("Máximo 5MB."); 

      setUploading(true);
      try {
          const fileRef = ref(storage, `logos/${shopId}/${type}_${Date.now()}`);
          await uploadBytes(fileRef, file);
          const url = await getDownloadURL(fileRef);
          
          setBranding(prev => ({ ...prev, [type]: url }));
          alert("Imagem carregada! Clique em 'Salvar Configurações' para confirmar.");
      } catch (err) {
          console.error(err);
          alert("Erro no upload: " + err.message);
      } finally {
          setUploading(false);
      }
  };

  // Salvar TUDO em um único lugar
  const saveAllSettings = async (e) => {
      e.preventDefault();
      try {
          const docRef = doc(db, `artifacts/${shopId}/public/data/store_settings/full_config`);
          
          await setDoc(docRef, { 
              schedule,
              info,
              branding,
              updatedAt: new Date()
          }, { merge: true });

          alert("Configurações e Horários salvos com sucesso!");
      } catch (error) {
          console.error(error);
          alert("Erro ao salvar: " + error.message);
      }
  };

  const updateScheduleDay = (index, field, value) => {
      const newSchedule = [...schedule];
      newSchedule[index] = { ...newSchedule[index], [field]: value };
      setSchedule(newSchedule);
  };

  const handleEmergency = async () => {
      if(!emergencyDate) return alert("Selecione uma data.");
      
      const q = query(
          collection(db, `artifacts/${shopId}/public/data/appointments`), 
          where('date', '==', emergencyDate)
      );
      
      const s = await getDocs(q); 
      const emails = new Set(); 
      
      s.forEach(d => { 
          const data = d.data();
          if(data.clientEmail) emails.add(data.clientEmail); 
      });
      
      if(emails.size === 0) return alert("Nenhum cliente com e-mail agendado para esta data.");
      
      window.open(`mailto:?bcc=${Array.from(emails).join(',')}&subject=Aviso Importante&body=Prezados clientes...`);
  };

  if(loading) return <div className="text-center text-[#666] py-10">Carregando loja...</div>;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-[#F3E5AB] pb-20">
      
      {/* HEADER E NAVEGAÇÃO */}
      <div className="bg-[#0a0a0a] p-4 rounded-2xl border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-gold font-egyptian tracking-wide">CONFIGURAÇÃO DA LOJA</h2>
            <p className="text-xs text-[#666]">Gerencie aparência, horários e informações.</p>
        </div>
        <div className="flex bg-[#111] p-1 rounded-xl overflow-x-auto">
            {[
                {id: 'visual', icon: 'fas fa-paint-brush', label: 'Visual'},
                {id: 'infos', icon: 'fas fa-info-circle', label: 'Infos'},
                {id: 'hours', icon: 'fas fa-clock', label: 'Horários'},
                {id: 'danger', icon: 'fas fa-exclamation-triangle', label: 'Emergência'}
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-gold text-black shadow-lg' : 'text-[#666] hover:text-[#eee]'}`}
                >
                    <i className={tab.icon}></i> {tab.label}
                </button>
            ))}
        </div>
      </div>

      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        
        {/* === ABA 1: VISUAL (Com Banner e Preview) === */}
        {activeTab === 'visual' && (
            <div className="space-y-8 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    
                    {/* COLUNA ESQUERDA: IMAGENS */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-[#eee] uppercase border-b border-[#222] pb-2">Imagens</h3>
                        
                        {/* Upload Logo */}
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-2">Logo (PNG Transparente)</label>
                            <div className="flex items-center gap-4">
                                <div className="w-24 h-24 bg-[#111] border border-[#333] rounded-xl flex items-center justify-center overflow-hidden p-2 relative group">
                                    {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <i className="fas fa-image text-[#333] text-2xl"></i>}
                                </div>
                                <div className="flex-1">
                                    <label className={`btn-primary py-2 px-4 text-xs inline-flex items-center gap-2 w-full justify-center ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
                                        <i className="fas fa-cloud-upload-alt"></i> {uploading && !branding.logoUrl ? 'Enviando...' : 'Carregar Logo'}
                                        <input type="file" onChange={(e) => handleImageUpload(e, 'logoUrl')} className="hidden" accept="image/*" disabled={uploading} />
                                    </label>
                                    <p className="text-[9px] text-[#666] mt-2 text-center">Recomendado: 500x500px.</p>
                                </div>
                            </div>
                        </div>

                        {/* Upload Banner */}
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-2">Banner / Capa</label>
                            <div className="w-full h-32 bg-[#111] border border-[#333] rounded-xl flex items-center justify-center overflow-hidden relative group mb-2">
                                {branding.bannerUrl ? <img src={branding.bannerUrl} alt="Banner" className="w-full h-full object-cover" /> : <span className="text-[#333] text-sm font-bold">SEM BANNER</span>}
                            </div>
                            <label className={`cursor-pointer w-full border border-[#333] text-[#888] hover:text-white hover:border-[#666] py-2 px-4 rounded text-xs font-bold inline-flex items-center justify-center gap-2 transition ${uploading ? 'opacity-50' : ''}`}>
                                <i className="fas fa-camera"></i> {uploading ? 'Enviando...' : 'Alterar Capa'}
                                <input type="file" onChange={(e) => handleImageUpload(e, 'bannerUrl')} className="hidden" accept="image/*" disabled={uploading} />
                            </label>
                        </div>

                        {/* Slogan */}
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Frase de Efeito</label>
                            <input className="input-field" value={branding.slogan} onChange={e => setBranding({...branding, slogan: e.target.value})} placeholder="Ex: Estilo e tradição." />
                        </div>
                    </div>
                    
                    {/* COLUNA DIREITA: CORES E PREVIEW */}
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-[#eee] uppercase border-b border-[#222] pb-2">Cores & Preview</h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-[#666] uppercase block mb-1">Cor Principal</label>
                                <div className="flex items-center gap-2 p-1 bg-[#111] border border-[#333] rounded-lg">
                                    <input type="color" value={branding.primaryColor} onChange={e => setBranding({...branding, primaryColor: e.target.value})} className="h-8 w-10 rounded border-none cursor-pointer bg-transparent" />
                                    <span className="text-xs font-bold text-[#eee]">{branding.primaryColor}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-[#666] uppercase block mb-1">Cor Fundo</label>
                                <div className="flex items-center gap-2 p-1 bg-[#111] border border-[#333] rounded-lg">
                                    <input type="color" value={branding.secondaryColor} onChange={e => setBranding({...branding, secondaryColor: e.target.value})} className="h-8 w-10 rounded border-none cursor-pointer bg-transparent" />
                                    <span className="text-xs font-bold text-[#eee]">{branding.secondaryColor}</span>
                                </div>
                            </div>
                        </div>

                        {/* PRÉVIA DO SITE */}
                        <div>
                            <label className="text-[10px] font-bold text-[#666] uppercase block mb-2">Simulação do Site do Cliente</label>
                            <div className="border border-[#333] rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: branding.secondaryColor }}>
                                <div className="h-24 relative flex items-center justify-center overflow-hidden">
                                    {branding.bannerUrl && <img src={branding.bannerUrl} className="absolute inset-0 w-full h-full object-cover opacity-40" alt="" />}
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60"></div>
                                    {branding.logoUrl && <img src={branding.logoUrl} className="h-16 w-auto relative z-10 drop-shadow-xl" alt="Logo" />}
                                </div>
                                <div className="p-4 text-center space-y-3">
                                    <h4 className="font-bold text-lg" style={{ color: branding.primaryColor }}>Bem-vindo!</h4>
                                    <p className="text-xs opacity-70" style={{ color: branding.primaryColor }}>{branding.slogan || 'Sua barbearia.'}</p>
                                    <div className="pt-2">
                                        <button className="px-6 py-2 rounded-lg font-bold text-xs shadow-lg" style={{ backgroundColor: branding.primaryColor, color: branding.secondaryColor === '#000000' ? '#000' : '#fff' }}>
                                            AGENDAR
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[9px] text-[#666] mt-2 text-center italic">Prévia apenas ilustrativa.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* === ABA 2: INFOS === */}
        {activeTab === 'infos' && (
            <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="lbl">Nome da Barbearia</label><input className="input-field" value={info.name} onChange={e => setInfo({...info, name: e.target.value})} /></div>
                    <div><label className="lbl">Telefone / WhatsApp</label><input className="input-field" value={info.phone} onChange={e => setInfo({...info, phone: e.target.value})} /></div>
                    <div className="md:col-span-2"><label className="lbl">Endereço</label><input className="input-field" value={info.address} onChange={e => setInfo({...info, address: e.target.value})} /></div>
                    <div><label className="lbl">Instagram (URL)</label><input className="input-field" value={info.instagram} onChange={e => setInfo({...info, instagram: e.target.value})} /></div>
                    <div><label className="lbl">Google Maps (URL)</label><input className="input-field" value={info.mapUrl} onChange={e => setInfo({...info, mapUrl: e.target.value})} /></div>
                </div>
            </div>
        )}

        {/* === ABA 3: HORÁRIOS === */}
        {activeTab === 'hours' && (
            <div className="animate-fade-in">
                <p className="text-xs text-[#666] mb-4 bg-[#111] p-2 rounded border border-[#222]">
                    <i className="fas fa-info-circle mr-2"></i> 
                    Configure os horários de Abertura e Fechamento. Desmarque "Fechado" para o dia aparecer na agenda.
                </p>
                <div className="grid gap-2">
                    {schedule.map((day, i) => (
                        <div key={i} className={`flex flex-col sm:flex-row gap-4 items-center p-3 rounded-xl border ${day.closed ? 'bg-[#111] border-[#222] opacity-50' : 'bg-[#0a0a0a] border-gold/30'}`}>
                            <span className="w-24 font-bold text-sm text-gold uppercase tracking-wider text-center sm:text-left">{day.label}</span>
                            
                            <div className="flex items-center gap-2 flex-1 justify-center sm:justify-start">
                                <input type="time" disabled={day.closed} value={day.open} onChange={e => updateScheduleDay(i, 'open', e.target.value)} className="bg-[#000] border border-[#333] text-[#eee] rounded p-2 text-sm outline-none focus:border-gold" />
                                <span className="text-[#666]">-</span>
                                <input type="time" disabled={day.closed} value={day.close} onChange={e => updateScheduleDay(i, 'close', e.target.value)} className="bg-[#000] border border-[#333] text-[#eee] rounded p-2 text-sm outline-none focus:border-gold" />
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer bg-[#111] px-3 py-2 rounded-lg border border-[#333] hover:border-gold">
                                <input type="checkbox" checked={day.closed} onChange={e => updateScheduleDay(i, 'closed', e.target.checked)} className="accent-red-500 w-4 h-4" />
                                <span className={`text-xs font-bold ${day.closed ? 'text-red-500' : 'text-[#888]'}`}>{day.closed ? 'FECHADO' : 'ABERTO'}</span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === ABA 4: EMERGÊNCIA === */}
        {activeTab === 'danger' && (
            <div className="animate-fade-in space-y-6">
                <div className="bg-red-900/10 border border-red-900/30 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-red-500 mb-2 flex items-center gap-2"><i className="fas fa-bullhorn"></i> COMUNICADO URGENTE</h3>
                    <p className="text-sm text-red-300/80 mb-4">Utilize esta ferramenta para notificar todos os clientes de um dia específico sobre imprevistos.</p>
                    <div className="flex items-end gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-red-400 uppercase mb-1">Data Afetada</label>
                            <input type="date" value={emergencyDate} onChange={e => setEmergencyDate(e.target.value)} className="w-full border border-red-900/50 rounded-lg p-3 bg-[#000] text-red-200 outline-none" />
                        </div>
                        <button onClick={handleEmergency} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition">GERAR E-MAIL</button>
                    </div>
                </div>
            </div>
        )}

        {/* BOTÃO FLUTUANTE DE SALVAR */}
        <div className="mt-8 pt-6 border-t border-[#222] flex justify-end sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur p-4 -mx-6 -mb-6 rounded-b-2xl z-20 border-t border-gold/10">
            <button onClick={saveAllSettings} disabled={uploading} className="btn-primary w-full md:w-auto px-10 py-3 text-sm shadow-[0_0_20px_rgba(212,175,55,0.2)] hover:shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all">
                {uploading ? 'SALVANDO DADOS...' : 'SALVAR TODAS AS CONFIGURAÇÕES'}
            </button>
        </div>

      </div>
      <style>{` .lbl { font-size: 10px; font-weight: bold; color: #666; text-transform: uppercase; display: block; margin-bottom: 4px; } `}</style>
    </div>
  );
}