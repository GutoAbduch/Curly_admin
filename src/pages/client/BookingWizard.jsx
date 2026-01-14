import React, { useState, useEffect } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { db } from '../../config/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Calendar, Clock, User, Scissors, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';

export default function BookingWizard() {
  const { storeConfig, shopId } = useOutletContext();
  const navigate = useNavigate();
  const primaryColor = storeConfig?.primaryColor || '#D4AF37';

  // ESTADOS DO AGENDAMENTO
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  
  // DADOS DO BANCO
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);

  // SELEÇÕES DO CLIENTE
  const [selectedService, setSelectedService] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');

  // CARREGAR DADOS DA LOJA
  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Buscar Serviços
        const servicesRef = collection(db, `artifacts/${shopId}/public/data/services`);
        const sSnap = await getDocs(servicesRef);
        setServices(sSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Buscar Profissionais (Apenas 'Barber' ou 'Gerente' que atendem)
        const usersRef = collection(db, `artifacts/${shopId}/public/data/users`);
        // Idealmente filtraríamos por role, mas vamos pegar todos por enquanto
        const uSnap = await getDocs(usersRef);
        setProfessionals(uSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      } catch (error) {
        console.error("Erro ao carregar dados:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [shopId]);

  // GERAÇÃO DE HORÁRIOS (SIMPLES POR ENQUANTO)
  const generateTimeSlots = () => {
    const slots = [];
    let start = 9; // 09:00
    const end = 19; // 19:00
    for (let i = start; i < end; i++) {
        slots.push(`${i < 10 ? '0'+i : i}:00`);
        slots.push(`${i < 10 ? '0'+i : i}:30`);
    }
    return slots;
  };

  // --- RENDERIZAÇÃO DOS PASSOS ---

  // PASSO 1: ESCOLHER SERVIÇO
  const renderServices = () => (
    <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold text-white mb-6">O que vamos fazer hoje?</h2>
        <div className="grid grid-cols-1 gap-3">
            {services.length === 0 ? (
                <p className="text-gray-500">Nenhum serviço cadastrado nesta loja.</p>
            ) : services.map(srv => (
                <div 
                    key={srv.id} 
                    onClick={() => { setSelectedService(srv); setStep(2); }}
                    className="bg-[#111] border border-[#222] p-4 rounded-xl flex justify-between items-center cursor-pointer hover:border-[#D4AF37] hover:bg-[#161616] transition group"
                    style={{ borderColor: selectedService?.id === srv.id ? primaryColor : '' }}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-[#0a0a0a] flex items-center justify-center text-[#666] group-hover:text-white transition">
                            <Scissors className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white">{srv.name}</h3>
                            <p className="text-xs text-[#666]">{srv.duration} min • {srv.description || 'Sem descrição'}</p>
                        </div>
                    </div>
                    <span className="font-bold text-white">R$ {srv.price}</span>
                </div>
            ))}
        </div>
    </div>
  );

  // PASSO 2: ESCOLHER PROFISSIONAL
  const renderProfessionals = () => (
    <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold text-white mb-6">Quem vai te atender?</h2>
        <div className="grid grid-cols-2 gap-4">
            <div 
                onClick={() => { setSelectedProfessional('any'); setStep(3); }}
                className="bg-[#111] border border-[#222] p-6 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#D4AF37] transition text-center"
            >
                <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center border border-[#333]">
                    <Clock className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-white text-sm">Primeiro Disponível</h3>
            </div>

            {professionals.map(pro => (
                <div 
                    key={pro.id} 
                    onClick={() => { setSelectedProfessional(pro); setStep(3); }}
                    className="bg-[#111] border border-[#222] p-6 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#D4AF37] transition text-center"
                >
                    <div className="w-16 h-16 rounded-full bg-[#222] flex items-center justify-center border border-[#333] overflow-hidden">
                        {pro.photoUrl ? (
                            <img src={pro.photoUrl} className="w-full h-full object-cover" alt={pro.name} />
                        ) : (
                            <User className="w-6 h-6 text-[#666]" />
                        )}
                    </div>
                    <div>
                        <h3 className="font-bold text-white text-sm">{pro.name}</h3>
                        <p className="text-[10px] text-[#666]">Profissional</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
  );

  // PASSO 3: DATA E HORA
  const renderDateTime = () => (
    <div className="space-y-6 animate-fade-in">
        <h2 className="text-xl font-bold text-white">Quando seria melhor?</h2>
        
        {/* DATA */}
        <div>
            <label className="text-xs font-bold text-[#666] uppercase mb-2 block">Data</label>
            <input 
                type="date" 
                className="w-full bg-[#111] border border-[#333] text-white p-3 rounded-xl outline-none focus:border-[#D4AF37]"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
            />
        </div>

        {/* HORÁRIOS (Grid) */}
        {selectedDate && (
            <div>
                <label className="text-xs font-bold text-[#666] uppercase mb-2 block">Horários Disponíveis</label>
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {generateTimeSlots().map(time => (
                        <button
                            key={time}
                            onClick={() => setSelectedTime(time)}
                            className={`py-2 rounded-lg text-xs font-bold border transition ${
                                selectedTime === time 
                                ? 'bg-white text-black border-white' 
                                : 'bg-[#111] text-[#ccc] border-[#222] hover:border-[#666]'
                            }`}
                        >
                            {time}
                        </button>
                    ))}
                </div>
            </div>
        )}
        
        {selectedDate && selectedTime && (
            <button 
                onClick={() => setStep(4)}
                className="w-full py-4 rounded-xl font-bold text-black mt-4 shadow-lg hover:brightness-110 transition"
                style={{ backgroundColor: primaryColor }}
            >
                CONTINUAR
            </button>
        )}
    </div>
  );

  // PASSO 4: RESUMO (LOGIN VEM DEPOIS)
  const renderSummary = () => (
      <div className="space-y-6 animate-fade-in text-center">
          <div className="w-20 h-20 bg-green-900/20 rounded-full flex items-center justify-center mx-auto border border-green-900/50">
              <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <div>
              <h2 className="text-2xl font-bold text-white">Quase lá!</h2>
              <p className="text-gray-400 text-sm">Confira os detalhes do agendamento.</p>
          </div>

          <div className="bg-[#111] border border-[#222] rounded-xl p-6 text-left space-y-4">
              <div className="flex justify-between border-b border-[#222] pb-2">
                  <span className="text-gray-500 text-xs uppercase font-bold">Serviço</span>
                  <span className="text-white font-bold text-sm">{selectedService?.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#222] pb-2">
                  <span className="text-gray-500 text-xs uppercase font-bold">Profissional</span>
                  <span className="text-white font-bold text-sm">
                      {selectedProfessional === 'any' ? 'Primeiro Disponível' : selectedProfessional?.name}
                  </span>
              </div>
              <div className="flex justify-between border-b border-[#222] pb-2">
                  <span className="text-gray-500 text-xs uppercase font-bold">Data & Hora</span>
                  <span className="text-white font-bold text-sm">{selectedDate.split('-').reverse().join('/')} às {selectedTime}</span>
              </div>
              <div className="flex justify-between pt-2">
                  <span className="text-gray-500 text-xs uppercase font-bold">Valor Total</span>
                  <span className="text-[#D4AF37] font-bold text-lg">R$ {selectedService?.price}</span>
              </div>
          </div>

          <button 
              onClick={() => alert("AQUI ENTRARÁ O LOGIN/CADASTRO DO CLIENTE (PRÓXIMO PASSO DO ROADMAP)")}
              className="w-full py-4 rounded-xl font-bold text-black shadow-lg hover:brightness-110 transition"
              style={{ backgroundColor: primaryColor }}
          >
              CONFIRMAR AGENDAMENTO
          </button>
      </div>
  );

  if(loading) return <div className="p-10 text-center text-white">Carregando opções...</div>;

  return (
    <div className="max-w-xl mx-auto px-6 py-8 min-h-[80vh]">
        
        {/* BARRA DE PROGRESSO */}
        <div className="flex items-center justify-between mb-8 px-2">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1 flex-1 mx-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-[#D4AF37]' : 'bg-[#222]'}`} />
            ))}
        </div>

        {/* NAVEGAÇÃO TOPO */}
        {step > 1 && (
            <button 
                onClick={() => setStep(step - 1)} 
                className="flex items-center gap-2 text-[#666] hover:text-white text-xs font-bold mb-4"
            >
                <ChevronLeft className="w-4 h-4" /> VOLTAR
            </button>
        )}

        {/* CONTEÚDO DINÂMICO */}
        <div className="bg-[#0a0a0a] rounded-2xl">
            {step === 1 && renderServices()}
            {step === 2 && renderProfessionals()}
            {step === 3 && renderDateTime()}
            {step === 4 && renderSummary()}
        </div>
    </div>
  );
}