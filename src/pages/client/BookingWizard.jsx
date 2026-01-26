import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, getDocs, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore'; // ADICIONADO doc e getDoc
import { Calendar, Clock, User, Scissors, ChevronLeft, CheckCircle, AlertCircle, Phone, Mail, User as UserIcon } from 'lucide-react';
import { useClientAuth } from '../../context/ClientAuthContext'; // IMPORTAÇÃO DA AUTENTICAÇÃO

export default function BookingWizard() {
  const { storeConfig, shopId } = useOutletContext();
  const primaryColor = storeConfig?.primaryColor || '#D4AF37';

  // AUTENTICAÇÃO
  const { client } = useClientAuth();

  // ESTADOS DO FLUXO
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // DADOS DO BANCO
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);

  // SELEÇÕES DO CLIENTE
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // DADOS DO CLIENTE
  const [clientData, setClientData] = useState({ name: '', phone: '', email: '' });

  // 1. CARREGAR DADOS DA LOJA
  useEffect(() => {
    const fetchData = async () => {
      try {
        const servicesRef = collection(db, `artifacts/${shopId}/public/data/services`);
        const sSnap = await getDocs(servicesRef);
        setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const usersRef = collection(db, `artifacts/${shopId}/public/data/users`);
        const uSnap = await getDocs(usersRef);
        
        // Filtro de Profissionais (Remove recepcionistas/admin)
        const validPros = uSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(u => {
                const role = u.role || '';
                const ignoredRoles = ['Financeiro', 'Recepcionista', 'Admin']; 
                return u.name && !ignoredRoles.includes(role);
            });

        setProfessionals(validPros);
      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId]);

  // 2. AUTO-PREENCHIMENTO SE ESTIVER LOGADO
  useEffect(() => {
    const fillUserData = async () => {
        if (client) {
            try {
                // Tenta buscar o telefone salvo na coleção 'clients' global
                const clientDoc = await getDoc(doc(db, 'clients', client.uid));
                const savedPhone = clientDoc.exists() ? clientDoc.data().phone : '';

                setClientData({
                    name: client.displayName || '',
                    email: client.email || '',
                    phone: savedPhone || ''
                });
            } catch (error) {
                console.error("Erro ao buscar dados do cliente:", error);
            }
        }
    };
    fillUserData();
  }, [client]);

  // LÓGICA DE HORÁRIOS
  const generateTimeSlots = (dateString) => {
    if (!storeConfig || !storeConfig.schedule) return [];
    const date = new Date(dateString + 'T00:00:00'); 
    const dayIndex = date.getDay();
    const dayRule = storeConfig.schedule.find(s => s.day === dayIndex);

    if (!dayRule || dayRule.closed) return []; 

    const slots = [];
    const toMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };
    const toString = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    let current = toMinutes(dayRule.open);
    const end = toMinutes(dayRule.close);
    const interval = 30; 

    while (current < end) {
        slots.push(toString(current));
        current += interval;
    }
    return slots;
  };

  const availableSlots = selectedDate ? generateTimeSlots(selectedDate) : [];

  // SALVAR NO FIREBASE
  const handleFinishBooking = async (e) => {
      e.preventDefault();
      if(!clientData.name || !clientData.phone) return alert("Por favor, preencha nome e telefone.");

      setSaving(true);
      try {
          await addDoc(collection(db, `artifacts/${shopId}/public/data/appointments`), {
              serviceId: selectedService.id,
              serviceName: selectedService.name,
              servicePrice: selectedService.price,
              serviceDuration: selectedService.duration,
              professionalId: selectedProfessional === 'any' ? null : selectedProfessional.id,
              professionalName: selectedProfessional === 'any' ? 'Primeiro Disponível' : selectedProfessional.name,
              date: selectedDate,
              time: selectedTime,
              
              // Dados do Cliente
              clientName: clientData.name,
              clientPhone: clientData.phone,
              clientEmail: clientData.email,
              clientId: client ? client.uid : null, // Vincula o ID se estiver logado
              
              status: 'pending',
              createdAt: serverTimestamp()
          });
          setStep(6);
      } catch (error) {
          console.error("Erro ao agendar:", error);
          alert("Erro ao finalizar agendamento.");
      } finally {
          setSaving(false);
      }
  };

  // --- RENDERS ---

  const renderServices = () => (
    <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-6 font-egyptian">Selecione o Serviço</h2>
        <div className="grid grid-cols-1 gap-3">
            {services.length === 0 ? (
                <p className="text-gray-500">Nenhum serviço disponível.</p>
            ) : services.map(srv => (
                <div 
                    key={srv.id} 
                    onClick={() => { setSelectedService(srv); setStep(2); }}
                    className="bg-white border border-[#eee] p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-[--primary] hover:shadow-md transition group"
                    style={{ borderColor: selectedService?.id === srv.id ? primaryColor : '' }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#f9f9f9] flex items-center justify-center text-[#888] group-hover:text-[--primary] transition">
                            <Scissors className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-[#1a1a1a]">{srv.name}</h3>
                            <p className="text-xs text-[#666]">{srv.duration} min • R$ {srv.price}</p>
                        </div>
                    </div>
                    <div className="w-5 h-5 rounded-full border border-[#ddd] flex items-center justify-center">
                        {selectedService?.id === srv.id && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: primaryColor }} />}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  const renderProfessionals = () => (
    <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold text-[#1a1a1a] mb-6 font-egyptian">Escolha o Profissional</h2>
        <div className="grid grid-cols-2 gap-4">
            <div 
                onClick={() => { setSelectedProfessional('any'); setStep(3); }}
                className={`bg-white border p-6 rounded-xl flex flex-col items-center gap-3 cursor-pointer transition hover:shadow-lg ${selectedProfessional === 'any' ? 'border-[--primary] ring-1 ring-[--primary]' : 'border-[#eee] hover:border-[#ccc]'}`}
            >
                <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center text-[#888]">
                    <Clock className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#1a1a1a] text-sm text-center">Primeiro Disponível</h3>
            </div>

            {professionals.map(pro => (
                <div 
                    key={pro.id} 
                    onClick={() => { setSelectedProfessional(pro); setStep(3); }}
                    className={`bg-white border p-6 rounded-xl flex flex-col items-center gap-3 cursor-pointer transition hover:shadow-lg ${selectedProfessional?.id === pro.id ? 'border-[--primary] ring-1 ring-[--primary]' : 'border-[#eee] hover:border-[#ccc]'}`}
                >
                    <div className="w-14 h-14 rounded-full bg-[#f5f5f5] overflow-hidden border border-[#eee]">
                        {pro.photoUrl ? (
                            <img src={pro.photoUrl} className="w-full h-full object-cover" alt={pro.name} />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-[#ccc]" /></div>
                        )}
                    </div>
                    <h3 className="font-bold text-[#1a1a1a] text-sm text-center">{pro.name}</h3>
                </div>
            ))}
        </div>
    </div>
  );

  const renderDateTime = () => (
    <div className="space-y-6 animate-fade-in">
        <h2 className="text-xl font-bold text-[#1a1a1a] font-egyptian">Escolha o Horário</h2>
        <div>
            <label className="text-xs font-bold text-[#888] uppercase mb-2 block">Data</label>
            <input 
                type="date" 
                className="w-full bg-white border border-[#ddd] text-[#1a1a1a] p-3 rounded-xl outline-none focus:border-[--primary] appearance-none shadow-sm"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(''); }}
            />
        </div>
        {selectedDate && (
            <div>
                <label className="text-xs font-bold text-[#888] uppercase mb-2 block">
                    Horários para {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </label>
                {availableSlots.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                        {availableSlots.map(time => (
                            <button
                                key={time}
                                onClick={() => setSelectedTime(time)}
                                className={`py-2 rounded-lg text-xs font-bold border transition ${
                                    selectedTime === time 
                                    ? 'text-white shadow-md' 
                                    : 'bg-white text-[#555] border-[#eee] hover:border-[#ccc]'
                                }`}
                                style={selectedTime === time ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                            >
                                {time}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-500">
                        <AlertCircle className="w-5 h-5" />
                        <span className="text-sm font-bold">Fechado nesta data.</span>
                    </div>
                )}
            </div>
        )}
        {selectedDate && selectedTime && (
            <button 
                onClick={() => setStep(4)}
                className="w-full py-4 rounded-xl font-bold text-white mt-6 shadow-lg hover:-translate-y-1 transition uppercase tracking-widest"
                style={{ backgroundColor: primaryColor }}
            >
                Continuar
            </button>
        )}
    </div>
  );

  const renderSummary = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="text-center space-y-2">
             <h2 className="text-2xl font-bold text-[#1a1a1a] font-egyptian">Resumo</h2>
             <p className="text-[#666] text-sm">Confira os detalhes.</p>
          </div>

          <div className="bg-white border border-[#eee] rounded-xl p-6 space-y-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: primaryColor }}></div>
              
              <div className="flex justify-between items-center border-b border-[#f5f5f5] pb-3">
                  <div>
                      <p className="text-[10px] text-[#888] uppercase font-bold">Serviço</p>
                      <p className="text-[#1a1a1a] font-bold">{selectedService?.name}</p>
                  </div>
                  <p className="text-[#1a1a1a] font-bold">R$ {selectedService?.price}</p>
              </div>

              <div className="flex justify-between items-center border-b border-[#f5f5f5] pb-3">
                  <div>
                      <p className="text-[10px] text-[#888] uppercase font-bold">Profissional</p>
                      <p className="text-[#1a1a1a] font-bold">
                          {selectedProfessional === 'any' ? 'Primeiro Disponível' : selectedProfessional?.name}
                      </p>
                  </div>
              </div>

              <div className="flex justify-between items-center">
                  <div>
                      <p className="text-[10px] text-[#888] uppercase font-bold">Data & Hora</p>
                      <p className="text-[#1a1a1a] font-bold capitalize">
                          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })} • {selectedTime}
                      </p>
                  </div>
              </div>
          </div>

          <button 
              onClick={() => setStep(5)} 
              className="w-full py-4 rounded-xl font-bold text-white shadow-lg hover:-translate-y-1 transition uppercase tracking-widest mt-4"
              style={{ backgroundColor: primaryColor }}
          >
              Continuar para Identificação
          </button>
      </div>
  );

  const renderIdentification = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-[#1a1a1a] font-egyptian">Seus Dados</h2>
            <p className="text-[#666] text-sm">Informe seus dados para contato.</p>
        </div>

        {/* MENSAGEM SE ESTIVER LOGADO */}
        {client && (
            <div className="bg-[#fcfcfc] border border-[#eee] p-4 rounded-xl mb-4 flex items-center gap-3 shadow-sm">
                <div className="w-10 h-10 rounded-full bg-[#f0f0f0] flex items-center justify-center">
                   <UserIcon className="w-5 h-5 text-[#888]" />
                </div>
                <div>
                    <p className="text-sm font-bold text-[#1a1a1a]">Agendando como {client.displayName}</p>
                    <p className="text-xs text-[#666]">Seus dados foram preenchidos automaticamente.</p>
                </div>
                <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
            </div>
        )}

        <form onSubmit={handleFinishBooking} className="space-y-4">
            <div>
                <label className="text-xs font-bold text-[#888] uppercase mb-1 flex items-center gap-2"><UserIcon className="w-3 h-3"/> Nome Completo</label>
                <input 
                    required
                    className="input-field w-full bg-white border-[#ddd] text-[#1a1a1a] p-3 rounded-xl focus:border-[--primary] outline-none shadow-sm"
                    placeholder="Seu nome"
                    value={clientData.name}
                    onChange={e => setClientData({...clientData, name: e.target.value})}
                    // Se estiver logado, não bloqueamos, mas já vem preenchido
                />
            </div>
            <div>
                <label className="text-xs font-bold text-[#888] uppercase mb-1 flex items-center gap-2"><Phone className="w-3 h-3"/> WhatsApp / Telefone</label>
                <input 
                    required
                    type="tel"
                    className="input-field w-full bg-white border-[#ddd] text-[#1a1a1a] p-3 rounded-xl focus:border-[--primary] outline-none shadow-sm"
                    placeholder="(00) 00000-0000"
                    value={clientData.phone}
                    onChange={e => setClientData({...clientData, phone: e.target.value})}
                />
            </div>
            <div>
                <label className="text-xs font-bold text-[#888] uppercase mb-1 flex items-center gap-2"><Mail className="w-3 h-3"/> E-mail (Opcional)</label>
                <input 
                    type="email"
                    className="input-field w-full bg-white border-[#ddd] text-[#1a1a1a] p-3 rounded-xl focus:border-[--primary] outline-none shadow-sm"
                    placeholder="seu@email.com"
                    value={clientData.email}
                    onChange={e => setClientData({...clientData, email: e.target.value})}
                />
            </div>

            <button 
                type="submit"
                disabled={saving}
                className="w-full py-4 rounded-xl font-bold text-white shadow-lg hover:-translate-y-1 transition uppercase tracking-widest mt-2 flex items-center justify-center gap-2"
                style={{ backgroundColor: primaryColor }}
            >
                {saving ? 'Confirmando...' : 'FINALIZAR AGENDAMENTO'}
            </button>
        </form>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-6 animate-fade-in py-10">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto shadow-sm animate-bounce-slow">
            <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        
        <div>
            <h2 className="text-3xl font-black text-[#1a1a1a] mb-2 font-egyptian">Sucesso!</h2>
            <p className="text-[#666] max-w-xs mx-auto">
                Seu agendamento foi realizado. Te esperamos lá!
            </p>
        </div>

        <div className="bg-white border border-[#eee] p-4 rounded-xl inline-block text-left w-full shadow-sm">
            <p className="text-xs text-[#888] uppercase font-bold mb-1">Data</p>
            <p className="text-[#1a1a1a] font-bold text-lg mb-3">
                 {new Date(selectedDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })} às {selectedTime}
            </p>
            <p className="text-xs text-[#888] uppercase font-bold mb-1">Profissional</p>
            <p className="text-[#1a1a1a] font-bold">
                {selectedProfessional === 'any' ? 'Primeiro Disponível' : selectedProfessional?.name}
            </p>
        </div>

        <button 
            onClick={() => window.location.reload()}
            className="text-[--primary] font-bold text-sm hover:underline"
        >
            Fazer outro agendamento
        </button>
    </div>
  );

  if(loading) return <div className="p-10 text-center text-[#888] animate-pulse">Carregando agenda...</div>;

  return (
    <div className="max-w-xl mx-auto px-6 py-8 min-h-[60vh]">
        
        {/* BARRA DE PROGRESSO */}
        {step < 6 && (
            <div className="flex items-center gap-2 mb-8">
                {step > 1 && (
                    <button onClick={() => setStep(step - 1)} className="p-2 hover:bg-[#eee] rounded-full text-[#666] transition">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                <div className="flex-1 flex gap-1 h-1">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className={`flex-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[--primary]' : 'bg-[#e0e0e0]'}`} />
                    ))}
                </div>
                <span className="text-[10px] font-bold text-[#999]">PASSO {step}/5</span>
            </div>
        )}

        {/* CONTAINER FLUTUANTE */}
        <div className="bg-white/50 backdrop-blur-sm border border-white rounded-3xl shadow-xl p-4 md:p-8">
            {step === 1 && renderServices()}
            {step === 2 && renderProfessionals()}
            {step === 3 && renderDateTime()}
            {step === 4 && renderSummary()}
            {step === 5 && renderIdentification()}
            {step === 6 && renderSuccess()}
        </div>
    </div>
  );
}