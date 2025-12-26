import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../config/firebase';
import { 
  collection, query, where, getDocs, addDoc, doc, updateDoc, getDoc,
  serverTimestamp, orderBy, increment, runTransaction 
} from 'firebase/firestore';
import { useOutletContext, Link } from 'react-router-dom';

const getLocalToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

const minutesToTime = (mins) => {
    const h = Math.floor(mins / 60).toString().padStart(2, '0');
    const m = (mins % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};

export default function Appointments() {
  const { role, shopId } = useOutletContext();
  
  if (role === 'Financeiro') {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
            <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
            <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Restrito</h2>
            <p className="text-[#666]">O financeiro não gerencia a agenda operacional.</p>
        </div>
    );
  }

  const APP_ID = shopId;
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  
  // Checkout
  const [finishingAppt, setFinishingAppt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [tip, setTip] = useState(0); 
  const [changeFor, setChangeFor] = useState(''); 
  const [consumedSupplies, setConsumedSupplies] = useState([]); 
  
  // Listas de Dados
  const [servicesList, setServicesList] = useState([]);
  const [barbersList, setBarbersList] = useState([]);
  const [stockList, setStockList] = useState([]);
  
  // Configuração da Loja (Schedule)
  const [storeSchedule, setStoreSchedule] = useState(null);

  const [form, setForm] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '', 
    serviceId: '',
    serviceName: '',
    price: 0,
    barberId: '',
    barberName: '',
    date: getLocalToday(), 
    time: '', 
    duration: 30
  });

  useEffect(() => {
    if(!APP_ID) return;
    loadData();
  }, [selectedDate, APP_ID]);

  const loadData = async () => {
    setLoading(true);
    try {
        // 1. Agendamentos
        const qAppt = query(
            collection(db, `artifacts/${APP_ID}/public/data/appointments`),
            where('date', '==', selectedDate),
            orderBy('time')
        );
        const snapAppt = await getDocs(qAppt);
        setAppointments(snapAppt.docs.map(d => ({ id: d.id, ...d.data() })));

        // 2. Serviços
        const qServ = query(collection(db, `artifacts/${APP_ID}/public/data/services`));
        const snapServ = await getDocs(qServ);
        setServicesList(snapServ.docs.map(d => ({ id: d.id, ...d.data() })));

        // 3. Barbeiros
        const qUsers = query(collection(db, `artifacts/${APP_ID}/public/data/users`), where('role', 'in', ['Admin', 'Gerente', 'Barbeiro'])); 
        const snapUsers = await getDocs(qUsers);
        setBarbersList(snapUsers.docs.map(d => ({ id: d.id, ...d.data() })));

        // 4. Estoque
        const qStock = query(collection(db, `artifacts/${APP_ID}/public/data/products`));
        const snapStock = await getDocs(qStock);
        setStockList(snapStock.docs.map(d => ({ id: d.id, ...d.data() })));

        // 5. Configuração da Loja (CORRIGIDO: Lendo de store_settings/full_config)
        try {
            const docStore = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings/full_config`));
            if (docStore.exists() && docStore.data().schedule) {
                setStoreSchedule(docStore.data().schedule);
            } else {
                setStoreSchedule(null); // Sem config = Modo Manual
            }
        } catch (err) {
            console.log("Erro ao buscar config, ativando modo manual.", err);
            setStoreSchedule(null);
        }

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    } finally {
        setLoading(false);
    }
  };

  // --- GERAÇÃO INTELIGENTE DE HORÁRIOS ---
  const generatedTimeSlots = useMemo(() => {
      // Se não tiver schedule, retorna vazio (UI mostra input manual)
      if (!storeSchedule || storeSchedule.length === 0) return [];
      
      // Converte a data do form para o dia da semana correto
      const [y, m, d] = form.date.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d); 
      const dayIndex = dateObj.getDay(); // 0 = Dom, 6 = Sáb
      
      // Busca a regra onde o 'day' no banco seja igual ao dia da semana atual
      // (Isso funciona mesmo se o array estiver fora de ordem)
      const dayRule = storeSchedule.find(d => d.day === dayIndex);

      // Se não achar a regra ou a loja estiver fechada
      if (!dayRule || dayRule.closed) return [];

      const startMins = timeToMinutes(dayRule.open);
      const endMins = timeToMinutes(dayRule.close);
      
      const slots = [];
      // Gera de 30 em 30 min
      for (let m = startMins; m < endMins; m += 30) {
          slots.push(minutesToTime(m));
      }
      return slots;

  }, [form.date, storeSchedule]);


  // --- HANDLERS ---
  const handleOpenAddModal = () => {
      setForm(prev => ({ ...prev, date: selectedDate, time: '', clientName: '', clientPhone: '', clientEmail: '' }));
      setShowAddModal(true);
  };

  const handleServiceSelect = (e) => {
      const sId = e.target.value;
      if(!sId) {
          setForm(prev => ({ ...prev, serviceId: '', serviceName: '', price: 0 }));
          return;
      }
      const service = servicesList.find(s => s.id === sId);
      if(service) {
          setForm(prev => ({ 
              ...prev, 
              serviceId: sId, 
              serviceName: service.name, 
              price: service.price, 
              duration: service.duration 
          }));
      }
  };

  const handleBarberSelect = (e) => {
      const bId = e.target.value;
      if(!bId) {
          setForm(prev => ({ ...prev, barberId: '', barberName: '' }));
          return;
      }
      const barber = barbersList.find(b => b.id === bId);
      if(barber) {
          setForm(prev => ({ ...prev, barberId: bId, barberName: barber.name || barber.email }));
      }
  };

  const checkConflict = (newDate, newStart, newDuration, barberId) => {
      if (newDate !== selectedDate) return null; 

      const startA = timeToMinutes(newStart);
      const endA = startA + parseInt(newDuration);

      const conflict = appointments.find(appt => {
          if (appt.barberId !== barberId) return false;
          if (appt.status === 'canceled') return false; 
          const startB = timeToMinutes(appt.time);
          const endB = startB + parseInt(appt.duration);
          return (startA < endB && endA > startB);
      });
      return conflict;
  };

  const handleCreateAppointment = async (e) => {
      e.preventDefault();
      
      if(!form.clientName || !form.clientPhone || !form.serviceId || !form.barberId || !form.time || !form.date) {
          alert("Preencha todos os campos obrigatórios e selecione um horário.");
          return;
      }

      const conflict = checkConflict(form.date, form.time, form.duration, form.barberId);
      if (conflict) {
          const canForceFit = ['Admin', 'Gerente', 'Barbeiro'].includes(role);
          if (!canForceFit) {
              alert("⚠️ Horário Indisponível. Escolha outro horário.");
              return; 
          }
          const confirmEncaixe = window.confirm(`⚠️ ${form.barberName} já tem cliente às ${conflict.time}. Fazer ENCAIXE?`);
          if (!confirmEncaixe) return; 
      }

      try {
          await addDoc(collection(db, `artifacts/${APP_ID}/public/data/appointments`), {
              ...form,
              status: 'scheduled',
              isFitIn: !!conflict, 
              createdAt: serverTimestamp()
          });
          setShowAddModal(false);
          
          if(form.date === selectedDate) {
              loadData();
          } else {
              alert(`Agendado com sucesso para o dia ${form.date.split('-').reverse().join('/')}!`);
          }
          
          setForm({ 
            clientName: '', clientPhone: '', clientEmail: '', 
            serviceId: '', serviceName: '', price: 0, 
            barberId: '', barberName: '', date: selectedDate, time: '', duration: 30 
          });

      } catch (error) {
          alert('Erro ao agendar: ' + error.message);
      }
  };

  const handleStatusChange = async (appt, newStatus) => {
      if(!window.confirm(`Mudar status para ${newStatus}?`)) return;
      try {
          await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/appointments`, appt.id), { status: newStatus });
          loadData();
      } catch (error) {
          alert('Erro ao atualizar status.');
      }
  };

  // --- CHECKOUT ---
  const initiateFinish = (appt) => {
      setFinishingAppt(appt);
      setPaymentMethod(''); 
      setTip(0); 
      setChangeFor(''); 
      setConsumedSupplies([]); 
      setShowFinishModal(true);
  };

  const handleAddSupplyManual = (productId) => {
      if(!productId) return;
      const product = stockList.find(p => p.id === productId);
      const existing = consumedSupplies.find(i => i.productId === productId);
      if(existing) return;
      setConsumedSupplies([...consumedSupplies, { productId: product.id, name: product.name, unit: product.unit, qty: '' }]);
  };
  const handleSupplyChange = (index, value) => {
      const updated = [...consumedSupplies];
      updated[index].qty = value;
      setConsumedSupplies(updated);
  };
  const removeSupply = (index) => {
      const updated = [...consumedSupplies];
      updated.splice(index, 1);
      setConsumedSupplies(updated);
  };

  const confirmFinish = async () => {
      if(!finishingAppt || !paymentMethod) {
          alert("Selecione a forma de pagamento.");
          return;
      }
      
      try {
        await runTransaction(db, async (transaction) => {
            const finalTotal = parseFloat(finishingAppt.price) + parseFloat(tip || 0);

            // Update Agendamento
            const apptRef = doc(db, `artifacts/${APP_ID}/public/data/appointments`, finishingAppt.id);
            transaction.update(apptRef, {
                status: 'completed',
                paymentMethod,
                paidAmount: finalTotal,
                tip: parseFloat(tip || 0), 
                finishedAt: serverTimestamp(),
                suppliesCost: consumedSupplies 
            });

            // Financeiro
            const financeRef = doc(collection(db, `artifacts/${APP_ID}/public/data/financial`));
            transaction.set(financeRef, {
                type: 'income',
                category: 'Serviço',
                description: `Corte: ${finishingAppt.clientName}`,
                amount: finalTotal,
                date: selectedDate,
                barberId: finishingAppt.barberId,
                paymentMethod,
                createdAt: serverTimestamp()
            });

            // Estoque
            consumedSupplies.forEach(item => {
                if(item.productId && item.qty > 0) {
                    const productRef = doc(db, `artifacts/${APP_ID}/public/data/products`, item.productId);
                    transaction.update(productRef, { qty: increment(-parseFloat(item.qty)) });
                    
                    const moveRef = doc(collection(db, `artifacts/${APP_ID}/public/data/movements`));
                    transaction.set(moveRef, {
                        productId: item.productId,
                        productName: item.name,
                        type: 'usage',
                        qty: parseFloat(item.qty),
                        date: new Date().toISOString().split('T')[0],
                        obs: `Serviço #${finishingAppt.id.slice(0,4)}`,
                        createdAt: serverTimestamp()
                    });
                }
            });
        });
        setShowFinishModal(false);
        setFinishingAppt(null);
        loadData();
        alert('Serviço finalizado!');
      } catch (error) {
          console.error(error);
          alert('Erro ao finalizar: ' + error.message);
      }
  };

  const totalToPay = finishingAppt ? (parseFloat(finishingAppt.price) + parseFloat(tip || 0)) : 0;
  const changeValue = (parseFloat(changeFor || 0) - totalToPay);

  return (
    <div className="animate-fade-in pb-20">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">AGENDA</h2>
            <p className="text-[#666] text-sm">Gerencie os horários da barbearia</p>
        </div>
        <div className="flex items-center gap-4 bg-[#111] p-2 rounded-xl border border-[#222]">
            <input 
                type="date" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white outline-none text-sm font-bold uppercase cursor-pointer"
            />
            <button 
                type="button"
                onClick={handleOpenAddModal} 
                className="relative z-10 bg-gold text-black px-4 py-2 rounded-lg font-bold text-sm hover:bg-white transition shadow-[0_0_10px_rgba(212,175,55,0.2)]"
            >
                <i className="fas fa-plus mr-2"></i> NOVO
            </button>
        </div>
      </div>

      {loading ? (
          <div className="text-center py-20 text-[#666] animate-pulse">Carregando agenda...</div>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appointments.length === 0 && (
                  <div className="col-span-full text-center py-20 bg-[#0a0a0a] rounded-2xl border border-[#222] border-dashed">
                      <p className="text-[#444]">Nenhum agendamento para este dia.</p>
                  </div>
              )}
              {appointments.map(appt => (
                  <div key={appt.id} className={`relative p-5 rounded-2xl border ${appt.status === 'completed' ? 'bg-[#0a0a0a] border-[#222] opacity-70' : 'bg-[#111] border-[#333] hover:border-gold transition-colors group'}`}>
                      {appt.isFitIn && (
                          <div className="absolute top-0 left-0 bg-yellow-600/20 text-yellow-500 text-[9px] font-bold px-2 py-0.5 rounded-br-lg border-b border-r border-yellow-600/30">
                              <i className="fas fa-compress-arrows-alt mr-1"></i> ENCAIXE
                          </div>
                      )}
                      <div className={`absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider
                          ${appt.status === 'scheduled' ? 'bg-blue-900/30 text-blue-400' : ''}
                          ${appt.status === 'completed' ? 'bg-green-900/30 text-green-400' : ''}
                          ${appt.status === 'canceled' ? 'bg-red-900/30 text-red-400' : ''}
                      `}>
                          {appt.status === 'scheduled' ? 'Agendado' : appt.status === 'completed' ? 'Concluído' : 'Cancelado'}
                      </div>
                      <div className="flex items-start gap-4 mb-4 mt-2">
                          <div className="text-center bg-[#000] p-3 rounded-xl border border-[#222]">
                              <p className="text-xl font-black text-white leading-none">{appt.time}</p>
                              <p className="text-[10px] text-[#666] mt-1">{appt.duration} min</p>
                          </div>
                          <div>
                              <h3 className="text-lg font-bold text-[#eee]">{appt.clientName}</h3>
                              <p className="text-xs text-[#888]">{appt.serviceName}</p>
                              <p className="text-xs text-gold mt-1 font-bold">{formatCurrency(appt.price)}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[#555] mb-4 bg-[#050505] p-2 rounded-lg">
                          <i className="fas fa-cut"></i> Barbeiro: <span className="text-[#ccc]">{appt.barberName}</span>
                      </div>
                      {appt.status === 'scheduled' && (
                        <div className="flex gap-2 mt-auto">
                            <button onClick={() => initiateFinish(appt)} className="flex-1 bg-green-900/20 text-green-500 hover:bg-green-600 hover:text-white py-2 rounded-lg text-xs font-bold transition border border-green-900/30">
                                <i className="fas fa-check mr-1"></i> CONCLUIR
                            </button>
                            <button onClick={() => handleStatusChange(appt, 'canceled')} className="w-10 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white rounded-lg transition flex items-center justify-center border border-red-900/30">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                      )}
                  </div>
              ))}
          </div>
      )}

      {/* MODAL NOVO AGENDAMENTO */}
      {showAddModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] w-full max-w-lg rounded-2xl border border-[#333] p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
                  <h3 className="text-xl font-bold text-gold mb-6 font-egyptian">Novo Agendamento</h3>
                  <form onSubmit={handleCreateAppointment} className="space-y-4">
                      
                      <div className="p-4 bg-[#0a0a0a] rounded-xl border border-[#222]">
                          <p className="text-[10px] text-[#666] font-bold uppercase mb-2">Cliente</p>
                          <div className="space-y-2">
                             <input required placeholder="Nome (Obrigatório)" className="input-field" value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} />
                             <div className="grid grid-cols-2 gap-2">
                                <input required placeholder="Tel (Obrigatório)" className="input-field" value={form.clientPhone} onChange={e => setForm({...form, clientPhone: e.target.value})} />
                                <input placeholder="E-mail (Opcional)" type="email" className="input-field" value={form.clientEmail} onChange={e => setForm({...form, clientEmail: e.target.value})} />
                             </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] text-[#666] font-bold uppercase block mb-1">Serviço</label>
                            <select required className="input-field" onChange={handleServiceSelect} value={form.serviceId}>
                                <option value="">Selecione...</option>
                                {servicesList.length === 0 && <option disabled>Carregando...</option>}
                                {servicesList.map(s => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)}</option>)}
                            </select>
                          </div>
                          <div>
                             <label className="text-[10px] text-[#666] font-bold uppercase block mb-1">Barbeiro</label>
                             <select required className="input-field" onChange={handleBarberSelect} value={form.barberId}>
                                <option value="">Selecione...</option>
                                {barbersList.length === 0 && <option disabled>Carregando...</option>}
                                {barbersList.map(b => <option key={b.id} value={b.id}>{b.name || b.email}</option>)}
                            </select>
                          </div>
                      </div>

                      {/* SELEÇÃO DE DATA E GRADE DE HORÁRIOS */}
                      <div>
                          <label className="text-[10px] text-[#666] font-bold uppercase block mb-2">Data do Serviço</label>
                          <input 
                              type="date" 
                              required 
                              className="input-field text-center font-bold mb-4" 
                              value={form.date} 
                              onChange={e => setForm({...form, date: e.target.value, time: ''})} 
                          />
                          
                          <label className="text-[10px] text-[#666] font-bold uppercase block mb-2">
                              Horário 
                              <span className="text-gold ml-2">({form.date.split('-').reverse().join('/')})</span>
                          </label>
                          
                          {/* LÓGICA HÍBRIDA: Grade Automática OU Input Manual */}
                          {storeSchedule ? (
                              generatedTimeSlots.length > 0 ? (
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1 border border-[#222] rounded-xl bg-[#050505]">
                                      {generatedTimeSlots.map(slot => (
                                          <button 
                                            key={slot}
                                            type="button"
                                            onClick={() => setForm({...form, time: slot})}
                                            className={`py-2 rounded text-xs font-bold border transition-all 
                                                ${form.time === slot 
                                                    ? 'bg-gold text-black border-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]' 
                                                    : 'bg-[#1a1a1a] text-[#888] border-[#333] hover:border-[#666] hover:text-[#ccc]'
                                                }`}
                                          >
                                              {slot}
                                          </button>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="p-4 text-center bg-[#1a0505] border border-red-900/30 rounded-xl text-red-400 text-xs">
                                      <i className="fas fa-ban mr-2"></i> Fechado neste dia.
                                  </div>
                              )
                          ) : (
                              // FALLBACK MANUAL (Caso a configuração falhe)
                              <div className="space-y-2">
                                  <input 
                                      type="time" 
                                      required 
                                      className="input-field text-center font-bold text-lg" 
                                      value={form.time} 
                                      onChange={e => setForm({...form, time: e.target.value})} 
                                  />
                                  <div className="flex items-center gap-2 p-2 bg-yellow-900/10 border border-yellow-900/30 rounded text-[10px] text-yellow-500">
                                      <i className="fas fa-exclamation-triangle"></i>
                                      <span>Modo Manual Ativo (Configuração não detectada). 
                                          <Link to={`/${shopId}/admin/store`} className="underline font-bold ml-1 hover:text-white">Configurar agora</Link>
                                      </span>
                                  </div>
                              </div>
                          )}
                          
                          {form.time && <p className="text-center text-gold text-sm font-bold mt-2 animate-fade-in">Horário Selecionado: {form.time}</p>}
                      </div>

                      <div className="flex gap-2 pt-4">
                          <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-[#222] text-[#888] rounded-lg font-bold hover:text-white transition">CANCELAR</button>
                          <button type="submit" className="btn-primary flex-1">CONFIRMAR</button>
                      </div>
                  </form>
              </div>
          </div>
      )}

      {/* MODAL CHECKOUT */}
      {showFinishModal && finishingAppt && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] w-full max-w-lg rounded-2xl border border-[#333] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="text-center mb-6 border-b border-[#222] pb-6">
                    <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Finalizando</p>
                    <h3 className="text-2xl font-bold text-white">{finishingAppt.clientName}</h3>
                    <p className="text-[#888] text-sm">{finishingAppt.serviceName}</p>
                </div>

                <div className="mb-6">
                    <label className="block text-xs font-bold text-[#888] uppercase mb-2">Forma de Pagamento</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {['Dinheiro', 'PIX', 'Débito', 'Crédito'].map(method => (
                            <button 
                                key={method} 
                                onClick={() => setPaymentMethod(method)}
                                className={`py-3 rounded text-xs font-bold border transition-all ${paymentMethod === method ? 'bg-gold text-black border-gold' : 'bg-[#1a1a1a] text-[#666] border-[#333] hover:border-[#666]'}`}
                            >
                                {method}
                            </button>
                        ))}
                    </div>

                    {paymentMethod === 'Dinheiro' && (
                        <div className="bg-[#1a1a1a] p-3 rounded border border-[#333] mt-2">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="text-[10px] text-[#666] font-bold uppercase">Troco para</label>
                                    <input type="number" placeholder="R$ 0,00" className="w-full bg-[#000] border border-[#333] rounded p-2 text-white outline-none focus:border-gold" value={changeFor} onChange={e => setChangeFor(e.target.value)} />
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-[#666] font-bold uppercase">Troco</p>
                                    <p className={`font-bold text-lg ${changeValue < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(changeValue > 0 ? changeValue : 0)}</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {paymentMethod && (
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-[#888] uppercase mb-2">Gorjeta (100% Profissional)</label>
                        <div className="flex items-center bg-[#1a1a1a] border border-[#333] rounded-lg p-3">
                            <span className="text-gold font-bold mr-2">R$</span>
                            <input type="number" step="0.50" className="bg-transparent text-white font-bold w-full outline-none" placeholder="0,00" value={tip || ''} onChange={e => setTip(e.target.value)} />
                        </div>
                    </div>
                )}

                <div className="bg-[#050505] p-4 rounded-xl border border-[#222] mb-6">
                    <div className="flex justify-between text-sm mb-1"><span className="text-[#666]">Serviço</span><span className="text-[#eee]">{formatCurrency(finishingAppt.price)}</span></div>
                    {tip > 0 && (<div className="flex justify-between text-sm mb-1 text-green-500"><span>+ Gorjeta</span><span>{formatCurrency(tip)}</span></div>)}
                    <div className="flex justify-between text-lg font-black text-gold border-t border-[#222] pt-2 mt-2"><span>TOTAL</span><span>{formatCurrency(totalToPay)}</span></div>
                </div>

                <div className="mb-6 border-t border-[#222] pt-4">
                     <div className="flex justify-between items-end mb-2">
                        <h4 className="text-xs font-bold text-[#666] uppercase">Insumos Gastos</h4>
                        <select className="bg-[#000] text-xs text-white border border-[#333] rounded p-1 w-36" onChange={(e) => handleAddSupplyManual(e.target.value)} value=""><option value="">+ Add Manual</option>{stockList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                    </div>
                    {consumedSupplies.length > 0 && (
                        <div className="bg-[#0a0a0a] p-2 rounded-xl border border-[#333] max-h-32 overflow-y-auto">
                            {consumedSupplies.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center mb-1 pb-1 border-b border-[#222] last:border-0 last:pb-0"><span className="text-xs text-[#ccc]">{item.name}</span><div className="flex items-center gap-1"><input type="number" step="0.0001" className="w-14 text-center border border-[#333] rounded p-0.5 text-xs bg-black text-white" value={item.qty} onChange={(e) => handleSupplyChange(idx, e.target.value)} /><span className="text-[10px] text-[#555]">{item.unit}</span><i onClick={() => removeSupply(idx)} className="fas fa-times text-red-500 text-xs cursor-pointer ml-1"></i></div></div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={() => setShowFinishModal(false)} className="py-3 px-6 rounded-lg bg-[#222] text-[#888] font-bold hover:text-white hover:bg-[#333] transition">VOLTAR</button>
                    <button onClick={confirmFinish} disabled={!paymentMethod} className="btn-primary flex-1">CONFIRMAR</button>
                </div>
            </div>
          </div>
      )}
    </div>
  );
}