import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, addDoc, doc, updateDoc, serverTimestamp, orderBy, increment, getDoc } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

const getLocalToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

export default function Appointments() {
  const { user, role, shopId } = useOutletContext();
  const APP_ID = shopId;

  // --- TRAVA FINANCEIRO ---
  if (role === 'Financeiro') {
    return (
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
            <div className="bg-red-500/10 p-6 rounded-full mb-6">
                <i className="fas fa-lock text-red-500 text-4xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Negado</h2>
            <p className="text-[#666] max-w-md text-center">
                O perfil Financeiro não possui permissão para gerenciar a agenda operacional.
            </p>
        </div>
    );
  }

  const [appointments, setAppointments] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [storeHours, setStoreHours] = useState(Array(7).fill({ open: '09:00', close: '18:00', closed: false }));
  
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(getLocalToday());
  const [filterBarber, setFilterBarber] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  
  const [newAppt, setNewAppt] = useState({ clientName: '', clientPhone: '', clientEmail: '', serviceId: '', barberId: '', date: getLocalToday(), time: '' });
  
  const [availableSlots, setAvailableSlots] = useState([]); 
  const [busySlots, setBusySlots] = useState([]); 
  const [isStoreClosed, setIsStoreClosed] = useState(false);

  const [finishingAppt, setFinishingAppt] = useState(null);
  const [consumedSupplies, setConsumedSupplies] = useState([]); 
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [isPaymentConfirmed, setIsPaymentConfirmed] = useState(false);

  useEffect(() => {
    if(!APP_ID) return;
    const loadResources = async () => {
      try {
        const usersSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/users`));
        const barbersList = [];
        usersSnap.forEach(d => { 
            const u = d.data(); 
            // IMPORTANTE: Só carrega quem tem cargo válido
            if (['Barbeiro', 'Admin', 'Gerente'].includes(u.role)) {
                barbersList.push({ id: d.id, ...u }); 
            }
        });
        setBarbers(barbersList);
        
        const servicesSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/services`));
        setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const storeSnap = await getDoc(doc(db, `artifacts/${APP_ID}/public/data/store_settings`, 'hours'));
        if (storeSnap.exists()) {
            setStoreHours(storeSnap.data().schedule || Array(7).fill({ open: '09:00', close: '18:00', closed: false }));
        }
      } catch (err) { console.error(err); }
    };
    loadResources();
  }, [APP_ID]);

  useEffect(() => { fetchAppointments(); }, [filterDate, filterBarber, user, APP_ID]);

  useEffect(() => {
      if (showCreateModal && newAppt.date) {
          calculateDailySlots(newAppt.date);
          if (newAppt.barberId) fetchBusySlots(newAppt.barberId, newAppt.date);
      }
  }, [newAppt.date, newAppt.barberId, showCreateModal, storeHours]);

  const fetchAppointments = async () => {
    if(!APP_ID) return;
    setLoading(true);
    try {
      const colRef = collection(db, `artifacts/${APP_ID}/public/data/appointments`);
      let q;
      if (['Admin', 'Gerente'].includes(role)) {
        if (filterBarber) {
             q = query(colRef, where('dateString', '==', filterDate), where('barberId', '==', filterBarber), orderBy('time', 'asc'));
        } else {
             q = query(colRef, where('dateString', '==', filterDate), orderBy('time', 'asc'));
        }
      } else {
        q = query(colRef, where('dateString', '==', filterDate), where('barberId', '==', user.uid), orderBy('time', 'asc'));
      }

      const snap = await getDocs(q);
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(appt => appt.clientName !== 'Admin Teste'));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const calculateDailySlots = (dateStr) => {
      if (!storeHours) return setAvailableSlots([]);
      const dt = new Date(dateStr + 'T12:00:00'); 
      const dayIndex = dt.getDay() === 0 ? 6 : dt.getDay() - 1; 
      const rules = storeHours[dayIndex];

      if (!rules || rules.closed) { setIsStoreClosed(true); setAvailableSlots([]); return; }
      setIsStoreClosed(false);
      
      const startMin = timeToMinutes(rules.open); 
      const endMin = timeToMinutes(rules.close);
      const slots = []; 
      let current = startMin;
      
      while (current < endMin) { 
          const h = Math.floor(current / 60).toString().padStart(2, '0'); 
          const m = (current % 60).toString().padStart(2, '0'); 
          slots.push(`${h}:${m}`); 
          current += 30; 
      }
      setAvailableSlots(slots);
  };

  const fetchBusySlots = async (barberId, dateStr) => {
      const q = query(collection(db, `artifacts/${APP_ID}/public/data/appointments`), where('dateString', '==', dateStr), where('barberId', '==', barberId), where('status', '!=', 'cancelled'));
      const snap = await getDocs(q);
      const busy = [];
      snap.forEach(doc => {
          const d = doc.data(); 
          const start = timeToMinutes(d.time); 
          const slotsCount = Math.ceil((d.duration || 30) / 30);
          for(let i=0; i < slotsCount; i++) { 
              const t = start + (i * 30); 
              busy.push(`${Math.floor(t / 60).toString().padStart(2,'0')}:${(t % 60).toString().padStart(2,'0')}`); 
          }
      });
      setBusySlots(busy);
  };

  // --- CORREÇÃO PRINCIPAL AQUI ---
  const handleCreate = async (e) => {
    e.preventDefault(); 
    
    // 1. Validações de Campo
    if (!newAppt.barberId) return alert("Por favor, selecione um Barbeiro.");
    if (!newAppt.time) return alert("Selecione um horário.");
    
    try {
      const svc = services.find(s => s.id === newAppt.serviceId); 
      const barber = barbers.find(b => b.id === newAppt.barberId);
      
      // 2. Segurança: Garante que achamos o barbeiro na lista
      if (!barber) return alert("Erro: O barbeiro selecionado não foi encontrado no sistema.");

      const q = query(collection(db, `artifacts/${APP_ID}/public/data/appointments`), where('dateString', '==', newAppt.date), where('barberId', '==', newAppt.barberId), where('status', '!=', 'cancelled'));
      const snap = await getDocs(q);
      
      const newStart = timeToMinutes(newAppt.time); 
      const newEnd = newStart + (svc?.duration || 30);
      let conflict = false;
      
      snap.forEach(doc => { 
          const a = doc.data(); 
          const s = timeToMinutes(a.time); 
          if (newStart < (s + (a.duration||30)) && newEnd > s) conflict = true; 
      });

      if (conflict) {
          if (!['Admin', 'Gerente', 'Barbeiro'].includes(role)) return alert("Horário indisponível.");
          if (!confirm("⚠️ CONFLITO! Encaixar mesmo assim?")) return;
      }

      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/appointments`), { 
          ...newAppt, 
          serviceCategory: svc?.category || 'Geral', 
          serviceName: svc?.name || 'Serviço Personalizado', 
          price: svc?.price || 0, 
          barberName: barber.name || 'Barbeiro', // Fallback de segurança para não enviar undefined
          duration: svc?.duration || 30, 
          dateString: newAppt.date, 
          date: new Date(`${newAppt.date}T${newAppt.time}`), 
          status: 'pending', paymentStatus: 'pending', createdAt: serverTimestamp() 
      });
      
      alert("Agendado!"); setShowCreateModal(false); fetchAppointments(); 
      setNewAppt({ clientName: '', clientPhone: '', clientEmail: '', serviceId: '', barberId: '', date: getLocalToday(), time: '' });
    } catch (err) { 
        console.error(err);
        alert("Erro ao agendar: " + err.message); 
    }
  };

  const handleStatusChange = async (appt, newStatus) => {
    if (!confirm(`Mudar para ${newStatus}?`)) return;
    await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/appointments`, appt.id), { status: newStatus });
    fetchAppointments();
  };

  const openFinishModal = (appt) => { 
      setFinishingAppt(appt); 
      setIsPaymentConfirmed(appt.paymentStatus === 'paid'); 
      setPaymentMethod('Dinheiro'); 
      const svc = services.find(s => s.id === appt.serviceId); 
      setConsumedSupplies(svc && svc.supplies ? svc.supplies.map(s => ({ ...s })) : []); 
      setShowFinishModal(true); 
  };

  const handleConfirmPayment = () => { setIsPaymentConfirmed(true); };
  
  const handleSupplyChange = (index, newVal) => { const updated = [...consumedSupplies]; updated[index].qty = parseFloat(newVal); setConsumedSupplies(updated); };

  const confirmFinish = async () => {
    if (!finishingAppt || !isPaymentConfirmed) return alert("Pagamento pendente.");
    
    const batch = consumedSupplies.map(async (item) => { 
        if (item.qty > 0) { 
            await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/products`, item.id), { qty: increment(-item.qty) }); 
            await addDoc(collection(db, `artifacts/${APP_ID}/public/data/movements`), { userId: user.uid, userName: user.displayName, productId: item.id, productName: item.name, type: 'exit', delta: -item.qty, unit: item.unit, reason: `Serviço: ${finishingAppt.clientName}`, isExternal: false, createdAt: serverTimestamp() }); 
        }
    });
    
    await Promise.all(batch);
    await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/appointments`, finishingAppt.id), { status: 'finished', paymentStatus: 'paid', paymentMethod, finishedAt: serverTimestamp() });
    alert("Finalizado!"); setShowFinishModal(false); fetchAppointments();
  };

  return (
    <div className="space-y-6 text-[#F3E5AB]">
      
      {/* HEADER DA AGENDA */}
      <div className="bg-[#0a0a0a] p-4 rounded-2xl shadow-sm border border-[#222] flex justify-between items-center">
        <div><h2 className="text-xl font-bold text-gold font-egyptian">AGENDA DIÁRIA</h2></div>
        <div className="flex gap-2">
            <input type="date" className="input-field w-auto" value={filterDate} onChange={e => setFilterDate(e.target.value)} />
            <button onClick={() => setShowCreateModal(true)} className="btn-primary w-auto px-4 text-sm">NOVO</button>
        </div>
      </div>

      {/* LISTA DE AGENDAMENTOS */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222] min-h-[400px]">
        {loading ? (
            <p className="text-center text-[#666]">Carregando...</p>
        ) : (
            <div className="space-y-3">
                {appointments.length === 0 ? (
                    <div className="text-center py-10 text-[#444] border-2 border-dashed border-[#222] rounded-xl">Sem agendamentos.</div>
                ) : (
                    appointments.map(appt => (
                        <div key={appt.id} className="border border-[#222] p-4 rounded-xl flex justify-between bg-[#111]">
                            <div className="flex items-center gap-4">
                                <div className="text-2xl font-black text-gold bg-[#0a0a0a] px-3 py-2 rounded-lg border border-[#333]">{appt.time}</div>
                                <div>
                                    <h4 className="font-bold text-[#eee]">{appt.clientName}</h4>
                                    <div className="text-xs text-[#666]">{appt.serviceName} • {appt.barberName}</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className={`px-2 py-1 rounded text-[9px] font-bold uppercase ${appt.status === 'finished' ? 'bg-green-900 text-green-300' : 'bg-gold text-black'}`}>
                                    {appt.status}
                                </span>
                                <div className="mt-2 text-xs font-bold text-gold">R$ {appt.price}</div>
                            </div>
                            <div className="flex flex-col gap-1 ml-4 justify-center">
                                {appt.status === 'pending' && <button onClick={()=>handleStatusChange(appt, 'confirmed')} className="text-blue-400 text-xs">Confirmar</button>}
                                {appt.status === 'confirmed' && <button onClick={()=>openFinishModal(appt)} className="text-green-400 text-xs">Finalizar</button>}
                                <button onClick={()=>handleStatusChange(appt, 'cancelled')} className="text-red-400 text-xs">X</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        )}
      </div>

      {/* MODAL CRIAR */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-[#333] w-full max-w-lg">
                <h3 className="text-gold font-bold mb-4">NOVO AGENDAMENTO</h3>
                <form onSubmit={handleCreate} className="space-y-4">
                    <input className="input-field" placeholder="Cliente" value={newAppt.clientName} onChange={e=>setNewAppt({...newAppt, clientName: e.target.value})} required />
                    <select className="input-field" value={newAppt.serviceId} onChange={e=>setNewAppt({...newAppt, serviceId: e.target.value})}>
                        <option value="">Serviço...</option>
                        {services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                        <select className="input-field" value={newAppt.barberId} onChange={e=>setNewAppt({...newAppt, barberId: e.target.value})}>
                            <option value="">Selecione o Barbeiro...</option>
                            {barbers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input type="date" className="input-field" value={newAppt.date} onChange={e=>setNewAppt({...newAppt, date: e.target.value})} />
                    </div>
                    
                    {/* Exibe aviso se nenhum barbeiro estiver disponível na lista */}
                    {barbers.length === 0 && (
                        <p className="text-red-400 text-xs border border-red-900/50 p-2 rounded bg-red-900/10">
                            Nenhum barbeiro encontrado. Verifique se há usuários com o cargo "Barbeiro" na aba Equipe.
                        </p>
                    )}

                    <div className="grid grid-cols-5 gap-2">
                        {availableSlots.map(slot => (
                            <button key={slot} type="button" onClick={()=>setNewAppt({...newAppt, time: slot})} 
                                className={`p-2 text-xs rounded border ${busySlots.includes(slot) ? 'border-red-900 text-red-500' : newAppt.time === slot ? 'bg-gold text-black' : 'border-[#333] text-[#888]'}`}
                            >{slot}</button>
                        ))}
                    </div>
                    <button className="btn-primary mt-2">CONFIRMAR</button>
                    <button type="button" onClick={()=>setShowCreateModal(false)} className="w-full text-[#666] text-xs mt-2">Cancelar</button>
                </form>
            </div>
        </div>
      )}

      {/* MODAL FINALIZAR */}
      {showFinishModal && finishingAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-[#333] w-full max-w-md">
                <h3 className="text-gold font-bold mb-2">FINALIZAR</h3>
                <div className="bg-yellow-900/20 p-4 rounded mb-4">
                    <button onClick={handleConfirmPayment} className="w-full bg-yellow-600 text-white py-2 rounded font-bold">
                        Confirmar Pagamento (R$ {finishingAppt.price})
                    </button>
                </div>
                
                <div className={`transition-opacity duration-300 ${!isPaymentConfirmed ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <h4 className="text-xs font-bold text-[#666] uppercase mb-2">Insumos Utilizados</h4>
                    <div className="bg-[#111] p-3 rounded-xl border border-[#333] mb-4 max-h-40 overflow-y-auto">
                        {consumedSupplies.length > 0 ? (consumedSupplies.map((item, idx) => (<div key={idx} className="flex justify-between items-center mb-2 border-b border-[#333] pb-2 last:border-0 last:pb-0"><span className="text-sm font-bold text-[#eee]">{item.name}</span><div className="flex items-center gap-2"><input type="number" step="0.001" className="w-16 text-center border border-[#333] rounded p-1 text-sm bg-black text-white" value={item.qty} onChange={(e) => handleSupplyChange(idx, e.target.value)} /><span className="text-xs text-[#666] w-8">{item.unit}</span></div></div>))) : (<p className="text-center text-[#444] italic text-sm">Sem insumos vinculados.</p>)}
                    </div>
                </div>

                <button onClick={confirmFinish} disabled={!isPaymentConfirmed} className="btn-primary">CONCLUIR</button>
            </div>
        </div>
      )}
    </div>
  );
}