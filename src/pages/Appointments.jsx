import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../config/firebase';
import { 
  collection, query, where, onSnapshot, addDoc, doc, updateDoc, getDoc, deleteDoc,
  serverTimestamp, increment, getDocs, writeBatch, orderBy
} from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

// --- UTILS ---
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
  const APP_ID = shopId;
  const userEmail = auth.currentUser?.email; // Para filtrar agenda individual

  // Bloqueio Financeiro (Regra de Negócio)
  if (role === 'Financeiro') {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
            <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
            <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Restrito</h2>
            <p className="text-[#666]">O financeiro não gerencia a agenda operacional.</p>
        </div>
    );
  }

  // --- ESTADOS ---
  const [selectedDate, setSelectedDate] = useState(getLocalToday());
  const [appointments, setAppointments] = useState([]);
  const [servicesList, setServicesList] = useState([]);
  const [barbersList, setBarbersList] = useState([]);
  const [stockList, setStockList] = useState([]); // Estoque completo para referência
  const [storeSchedule, setStoreSchedule] = useState(null); 
  const [loading, setLoading] = useState(true);

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Estado Checkout
  const [finishingAppt, setFinishingAppt] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [tip, setTip] = useState(0);
  const [changeFor, setChangeFor] = useState('');
  const [suppliesToDeduct, setSuppliesToDeduct] = useState([]); // Insumos a baixar
  const [saving, setSaving] = useState(false);

  // Formulário de Agendamento
  const [form, setForm] = useState({
    clientName: '', 
    clientPhone: '', 
    clientEmail: '', 
    serviceId: '', serviceName: '', 
    price: 0, barberId: '', barberName: '', date: getLocalToday(), time: '', duration: 30
  });

  // --- LEITURA DE DADOS ---
  useEffect(() => {
    if(!APP_ID) return;

    // 1. Agendamentos
    const qAppt = query(
        collection(db, `artifacts/${APP_ID}/public/data/appointments`),
        where('date', '==', selectedDate)
    );
    const unsubAppt = onSnapshot(qAppt, (snap) => {
        setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    });

    // 2. Serviços
    const unsubServ = onSnapshot(query(collection(db, `artifacts/${APP_ID}/public/data/services`)), (snap) => {
        setServicesList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 3. Barbeiros (Com Lógica de Visualização Individual)
    const qUsers = query(collection(db, `artifacts/${APP_ID}/public/data/users`));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
        let users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Filtra quem é da operação
        users = users.filter(u => ['Admin', 'Gerente', 'Barbeiro'].includes(u.role));
        
        // REGRA DE VISUALIZAÇÃO: Se não for Admin/Gerente, vê apenas a si mesmo
        if (!['Admin', 'Gerente'].includes(role)) {
             users = users.filter(u => u.email === userEmail);
        }

        setBarbersList(users);
    });

    // 4. Estoque (Busca única para referência no modal)
    const loadStock = async () => {
        const snap = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/products`)));
        setStockList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    };
    loadStock();

    // 5. Config da Loja
    const loadConfig = async () => {
        try {
            const docStore = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings/full_config`));
            if (docStore.exists() && docStore.data().schedule) {
                setStoreSchedule(docStore.data().schedule);
            }
        } catch (e) { console.error("Erro config loja", e); }
    };
    loadConfig();

    return () => { unsubAppt(); unsubServ(); unsubUsers(); };
  }, [selectedDate, APP_ID, role, userEmail]); // Adicionado dependências


  // --- GERAÇÃO DA GRADE ---
  const timeSlots = useMemo(() => {
      if (storeSchedule && storeSchedule.length > 0) {
          const [y, m, d] = selectedDate.split('-').map(Number);
          const dayIndex = new Date(y, m - 1, d).getDay();
          const rule = storeSchedule.find(s => s.day === dayIndex);
          
          if (!rule || rule.closed) return []; 
          
          const slots = [];
          const start = timeToMinutes(rule.open);
          const end = timeToMinutes(rule.close);
          for (let m = start; m < end; m += 30) slots.push(minutesToTime(m));
          return slots;
      }
      // Fallback
      const slots = [];
      for (let i = 9; i <= 20; i++) {
          slots.push(`${i.toString().padStart(2,'0')}:00`);
          slots.push(`${i.toString().padStart(2,'0')}:30`);
      }
      return slots;
  }, [selectedDate, storeSchedule]);


  // --- STATUS DA CÉLULA ---
  const getSlotStatus = (barberId, time) => {
      const apps = appointments.filter(a => 
          a.barberId === barberId && 
          a.time === time && 
          a.status !== 'canceled'
      );
      
      if (apps.length === 0) return { status: 'free', css: 'hover:bg-[#222]', count: 0, apps: [] };
      if (apps.length === 1) return { status: 'occupied', css: 'bg-yellow-900/20 border-yellow-600/30', count: 1, apps };
      return { status: 'full', css: 'bg-red-900/20 border-red-600/30', count: 2, apps };
  };

  // --- HANDLERS ---
  const handleSlotClick = (barber, time) => {
      const { status } = getSlotStatus(barber.id, time);
      if (status === 'full') {
          alert("Horário LOTADO! (Máximo 2 clientes: 1 Normal + 1 Encaixe)");
          return;
      }
      setForm({
          clientName: '', clientPhone: '', clientEmail: '',
          serviceId: '', serviceName: '', price: 0,
          barberId: barber.id, barberName: barber.name || barber.email,
          date: selectedDate, time: time, duration: 30
      });
      setShowAddModal(true);
  };

  const handleSave = async (e) => {
      e.preventDefault();
      setSaving(true);
      
      if(!form.clientName || !form.serviceId || !form.clientPhone || !form.clientEmail) {
          alert("Todos os campos são obrigatórios (Nome, Telefone e E-mail)."); 
          setSaving(false); return;
      }

      const { count } = getSlotStatus(form.barberId, form.time);
      if (count >= 2) {
          alert("Ops! Alguém acabou de ocupar este horário.");
          setSaving(false); setShowAddModal(false); return;
      }
      
      const isEncaixe = count === 1; 

      try {
          await addDoc(collection(db, `artifacts/${APP_ID}/public/data/appointments`), {
              ...form,
              isFitIn: isEncaixe,
              status: 'scheduled',
              createdAt: serverTimestamp()
          });
          setShowAddModal(false);
      } catch (err) {
          console.error(err); alert("Erro ao agendar.");
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async (id) => {
      if(confirm("Deseja realmente CANCELAR este agendamento?")) {
          await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/appointments`, id));
      }
  };

  // --- CHECKOUT (LÓGICA DE BAIXA DE ESTOQUE ATUALIZADA) ---
  const initiateFinish = (e, appt) => {
      e.stopPropagation(); 
      setFinishingAppt(appt);
      setPaymentMethod(''); setTip(0); setChangeFor(''); setSuppliesToDeduct([]);
      
      // Carrega os insumos automaticamente do serviço cadastrado
      const service = servicesList.find(s => s.id === appt.serviceId);
      if (service && service.supplies) {
          const itemsToDeduct = [];
          service.supplies.forEach(item => {
              // Verifica se o produto ainda existe na lista geral
              const prod = stockList.find(p => p.id === item.productId);
              if (prod) {
                  itemsToDeduct.push({
                      productId: prod.id,
                      name: prod.name,
                      unit: prod.measureUnit,
                      qty: item.qty || '' // Já traz preenchido a quantidade padrão do serviço
                  });
              }
          });
          setSuppliesToDeduct(itemsToDeduct);
      }
      setShowFinishModal(true);
  };

  const confirmFinish = async () => {
      if(!finishingAppt || !paymentMethod) { alert("Selecione a forma de pagamento."); return; }
      
      setSaving(true);
      try {
        const batch = writeBatch(db);
        const finalTotal = parseFloat(finishingAppt.price) + parseFloat(tip || 0);

        // 1. Atualizar Agendamento
        const apptRef = doc(db, `artifacts/${APP_ID}/public/data/appointments`, finishingAppt.id);
        batch.update(apptRef, {
            status: 'completed', paymentMethod, paidAmount: finalTotal, tip: parseFloat(tip || 0),
            finishedAt: serverTimestamp(), suppliesUsed: suppliesToDeduct // Salva histórico do que foi gasto
        });

        // 2. Financeiro (Entrada)
        const financeRef = doc(collection(db, `artifacts/${APP_ID}/public/data/financial`));
        batch.set(financeRef, {
            type: 'income', category: 'Serviço', description: `Corte: ${finishingAppt.clientName}`,
            amount: finalTotal, date: selectedDate, barberId: finishingAppt.barberId,
            paymentMethod, createdAt: serverTimestamp(), user: 'Sistema'
        });

        // 3. BAIXA DE ESTOQUE PEPS (FIFO) - COM 3 CASAS DECIMAIS
        for (const item of suppliesToDeduct) {
            const qtyToRemove = parseFloat(item.qty);
            if (item.productId && qtyToRemove > 0) {
                
                // Busca Lotes Ativos
                const batchesRef = collection(db, `artifacts/${APP_ID}/public/data/products/${item.productId}/batches`);
                const qBatches = query(batchesRef, where('isActive', '==', true), orderBy('entryDate', 'asc'));
                const snapshot = await getDocs(qBatches);

                let remaining = qtyToRemove;
                let costOfGoodsSold = 0;

                snapshot.docs.forEach((docSnap) => {
                    if (remaining <= 0) return;
                    
                    const batchData = docSnap.data();
                    const take = Math.min(batchData.currentQuantity, remaining);
                    const newQtd = Number((batchData.currentQuantity - take).toFixed(3)); // Força 3 casas
                    
                    // Atualiza Lote
                    const updateData = { currentQuantity: newQtd };
                    if (newQtd <= 0) updateData.isActive = false;
                    batch.update(docSnap.ref, updateData);
                    
                    remaining = Number((remaining - take).toFixed(3));
                    costOfGoodsSold += (take * batchData.unitCost);
                });

                // Atualiza Produto Principal
                const productRef = doc(db, `artifacts/${APP_ID}/public/data/products`, item.productId);
                batch.update(productRef, { currentStock: increment(-qtyToRemove) });

                // Movimento de Saída
                const moveRef = doc(collection(db, `artifacts/${APP_ID}/public/data/movements`));
                batch.set(moveRef, {
                    productId: item.productId, 
                    productName: item.name, 
                    type: 'OUT', 
                    reason: 'internal', 
                    quantity: qtyToRemove, 
                    date: serverTimestamp(), 
                    user: 'Sistema (Baixa Serviço)',
                    costValue: costOfGoodsSold, 
                    saleValue: 0
                });
            }
        }

        await batch.commit();
        setShowFinishModal(false); alert('Serviço finalizado e estoque atualizado!');
      } catch (err) {
          console.error(err); alert('Erro no checkout: ' + err.message);
      } finally {
          setSaving(false);
      }
  };

  // Render Cell Helper
  const renderCell = (slotInfo) => {
      if (slotInfo.count === 0) return <div className="w-full h-full"></div>;
      
      return (
          <div className="flex flex-col gap-1 w-full h-full justify-center p-1">
              {slotInfo.apps.map(app => (
                  <div key={app.id} className={`relative p-2 rounded-lg border flex justify-between items-center shadow-md 
                      ${app.isFitIn ? 'bg-red-900/40 border-red-500 text-red-200' : 'bg-yellow-900/40 border-yellow-500 text-yellow-200'}
                      ${app.status === 'completed' ? 'opacity-50 grayscale' : ''}
                  `}>
                      <div className="truncate w-full pr-16 leading-tight">
                          <span className="font-bold text-xs block truncate">{app.clientName}</span>
                          <span className="text-[10px] opacity-70 truncate block">{app.serviceName}</span>
                      </div>
                      
                      {app.status === 'scheduled' && (
                          <div className="flex items-center gap-2 absolute right-2 bg-black/50 p-1 rounded-lg backdrop-blur-sm">
                              <button 
                                onClick={(e) => initiateFinish(e, app)} 
                                className="w-7 h-7 flex items-center justify-center bg-green-600 hover:bg-green-500 text-white rounded shadow transition-all transform hover:scale-110" 
                                title="Finalizar e Pagar"
                              >
                                  <i className="fas fa-check text-xs"></i>
                              </button>
                              
                              <button 
                                onClick={(e) => {e.stopPropagation(); handleDelete(app.id)}} 
                                className="w-7 h-7 flex items-center justify-center bg-red-600 hover:bg-red-500 text-white rounded shadow transition-all transform hover:scale-110" 
                                title="Cancelar Agendamento"
                              >
                                  <i className="fas fa-times text-xs"></i>
                              </button>
                          </div>
                      )}
                      
                      {app.status === 'completed' && (
                          <div className="absolute right-2 bg-green-900/80 px-2 py-1 rounded text-[10px] text-green-300 font-bold border border-green-700">
                             <i className="fas fa-check-double mr-1"></i> PAGO
                          </div>
                      )}
                  </div>
              ))}
          </div>
      );
  };

  // --- RENDER ---
  const totalToPay = finishingAppt ? (parseFloat(finishingAppt.price) + parseFloat(tip || 0)) : 0;
  const changeValue = (parseFloat(changeFor || 0) - totalToPay);

  return (
    <div className="h-screen flex flex-col p-4 md:p-6 animate-fade-in text-[#eee] pb-20">
      
      {/* HEADER */}
      <div className="flex justify-between items-center mb-4 flex-none">
        <div>
            <h1 className="text-2xl font-bold text-[#D4AF37] font-egyptian">Agenda</h1>
            <p className="text-gray-400 text-xs hidden md:block">Clique no horário para agendar. Célula amarela aceita encaixe.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#111] p-1.5 rounded border border-[#333]">
            <button onClick={() => {const d=new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toISOString().split('T')[0])}} className="px-3 hover:text-gold"><i className="fas fa-chevron-left"></i></button>
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="bg-transparent text-white font-bold text-sm text-center outline-none"/>
            <button onClick={() => {const d=new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toISOString().split('T')[0])}} className="px-3 hover:text-gold"><i className="fas fa-chevron-right"></i></button>
        </div>
      </div>

      {/* GRID VISUAL */}
      <div className="flex-1 overflow-auto border border-[#222] rounded-xl bg-[#050505] relative custom-scrollbar">
          {loading ? <div className="flex h-full items-center justify-center text-gray-500">Carregando...</div> : (
              <div className="min-w-[600px]">
                  {/* Header Barbeiros */}
                  <div className="flex sticky top-0 z-20 bg-[#111] border-b border-[#333]">
                      <div className="w-14 flex-none border-r border-[#333] p-2 text-xs text-gray-500 text-center font-bold">Hora</div>
                      {barbersList.map(barber => (
                          <div key={barber.id} className="flex-1 p-2 text-center border-r border-[#333] min-w-[140px]">
                              <span className="text-gold font-bold text-sm block truncate">{barber.name}</span>
                          </div>
                      ))}
                  </div>

                  {/* Linhas de Horário */}
                  {timeSlots.length === 0 ? (
                      <div className="p-10 text-center text-gray-500">Loja fechada neste dia.</div>
                  ) : timeSlots.map(time => (
                      <div key={time} className="flex border-b border-[#222] min-h-[60px]">
                          <div className="w-14 flex-none border-r border-[#333] bg-[#0a0a0a] text-[10px] text-gray-500 flex items-center justify-center font-mono">
                              {time}
                          </div>
                          {barbersList.map(barber => {
                              const slotInfo = getSlotStatus(barber.id, time);
                              return (
                                  <div 
                                    key={barber.id+time} 
                                    onClick={() => handleSlotClick(barber, time)}
                                    className={`flex-1 border-r border-[#222] cursor-pointer transition-colors relative min-w-[140px] ${slotInfo.css}`}
                                  >
                                      {renderCell(slotInfo)}
                                  </div>
                              );
                          })}
                      </div>
                  ))}
              </div>
          )}
      </div>

      {/* MODAL ADD (COM CAMPOS OBRIGATÓRIOS) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0a0a0a] w-full max-w-sm rounded-2xl border border-[#333] shadow-2xl p-6">
                <h2 className="text-lg font-bold text-gold mb-4">Novo Agendamento</h2>
                <div className="mb-4 p-3 bg-[#111] rounded border border-[#222]">
                    <p className="text-xs text-gray-400">Barbeiro: <span className="text-white">{form.barberName}</span></p>
                    <p className="text-xs text-gray-400">Horário: <span className="text-white">{form.time}</span></p>
                </div>
                <form onSubmit={handleSave} className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Nome Cliente *</label>
                        <input className="input-field" placeholder="Ex: João Silva" value={form.clientName} onChange={e => setForm({...form, clientName: e.target.value})} autoFocus required />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Telefone *</label>
                            <input className="input-field" placeholder="(00) 00000-0000" value={form.clientPhone} onChange={e => setForm({...form, clientPhone: e.target.value})} required />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 uppercase font-bold block mb-1">E-mail *</label>
                            <input type="email" className="input-field" placeholder="joao@email.com" value={form.clientEmail} onChange={e => setForm({...form, clientEmail: e.target.value})} required />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 uppercase font-bold block mb-1">Serviço *</label>
                        <select className="input-field" value={form.serviceId} onChange={e => {
                            const s = servicesList.find(srv => srv.id === e.target.value);
                            setForm({...form, serviceId: s.id, serviceName: s.name, price: s.price})
                        }} required>
                            <option value="">Selecione Serviço...</option>
                            {servicesList.map(s => <option key={s.id} value={s.id}>{s.name} - {formatCurrency(s.price)}</option>)}
                        </select>
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 text-gray-500 hover:text-white bg-[#111] rounded font-bold">Cancelar</button>
                        <button disabled={saving} className="flex-1 btn-primary">{saving ? '...' : 'Confirmar'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL CHECKOUT */}
      {showFinishModal && finishingAppt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="bg-[#111] w-full max-w-md rounded-2xl border border-[#333] shadow-2xl p-6 overflow-y-auto max-h-[90vh]">
                  <div className="text-center border-b border-[#222] pb-4 mb-4">
                      <h3 className="text-xl font-bold text-white">{finishingAppt.clientName}</h3>
                      <p className="text-gold">{finishingAppt.serviceName}</p>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Forma de Pagamento</label>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                              {['Dinheiro', 'PIX', 'Débito', 'Crédito'].map(m => (
                                  <button key={m} onClick={() => setPaymentMethod(m)} className={`py-2 text-xs font-bold rounded border ${paymentMethod === m ? 'bg-gold text-black border-gold' : 'bg-[#222] border-[#333] text-gray-400'}`}>{m}</button>
                              ))}
                          </div>
                      </div>
                      
                      {paymentMethod === 'Dinheiro' && (
                          <div className="flex gap-2 items-center bg-[#1a1a1a] p-2 rounded">
                              <input type="number" placeholder="Recebido R$" className="bg-black text-white p-1 rounded border border-[#333] w-full" value={changeFor} onChange={e => setChangeFor(e.target.value)} />
                              <div className="text-right w-24">
                                  <p className="text-[10px] text-gray-500">TROCO</p>
                                  <p className={`font-bold ${changeValue < 0 ? 'text-red-500' : 'text-green-500'}`}>{formatCurrency(changeValue > 0 ? changeValue : 0)}</p>
                              </div>
                          </div>
                      )}

                      <div>
                          <label className="text-xs font-bold text-gray-500 uppercase">Gorjeta (Opcional)</label>
                          <input type="number" className="input-field mt-1" placeholder="R$ 0,00" value={tip || ''} onChange={e => setTip(e.target.value)} />
                      </div>

                      {/* CONFERÊNCIA DE INSUMOS (3 CASAS DECIMAIS) */}
                      <div className="bg-[#0a0a0a] p-3 rounded border border-[#222]">
                          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Conferir Insumos (Baixa Estoque)</p>
                          {suppliesToDeduct.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs mb-1 border-b border-[#222] pb-1 last:border-0">
                                  <span className="text-gray-300 w-1/2 truncate">{item.name}</span>
                                  <div className="flex items-center gap-1">
                                      <input 
                                        type="number" 
                                        step="0.001" 
                                        className="w-20 bg-black border border-[#333] text-center text-white p-1 rounded" 
                                        value={item.qty} 
                                        onChange={(e) => {
                                            const newArr = [...suppliesToDeduct]; 
                                            newArr[idx].qty = e.target.value; 
                                            setSuppliesToDeduct(newArr);
                                        }} 
                                        placeholder="0.000" 
                                      />
                                      <span className="text-[9px] text-gray-600 w-6">{item.unit}</span>
                                  </div>
                              </div>
                          ))}
                          {suppliesToDeduct.length === 0 && <p className="text-[10px] text-gray-700 italic">Nenhum insumo vinculado.</p>}
                      </div>
                      
                      <div className="bg-[#1a1a1a] p-4 rounded text-center border border-[#333]">
                          <p className="text-xs text-gray-500">TOTAL A RECEBER</p>
                          <p className="text-2xl font-black text-gold">{formatCurrency(totalToPay)}</p>
                      </div>

                      <div className="flex gap-2">
                          <button onClick={() => setShowFinishModal(false)} className="flex-1 py-3 text-gray-500 font-bold hover:text-white">VOLTAR</button>
                          <button onClick={confirmFinish} className="flex-1 btn-primary">FINALIZAR</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}