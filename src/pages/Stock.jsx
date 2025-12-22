import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, addDoc, onSnapshot, deleteDoc, updateDoc, doc, serverTimestamp, query, orderBy, limit, getDoc, increment } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

export default function Stock() {
  const { user, role, shopId } = useOutletContext();
  const APP_ID = shopId;
  
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [moving, setMoving] = useState(false);
  const [quickValues, setQuickValues] = useState({});
  
  const [prodForm, setProdForm] = useState({ name: '', unit: '', cost: '', sell: '', qty: '', vol: '' });
  const [moveForm, setMoveForm] = useState({ prodId: '', type: 'entry', qty: '', cost: '', waste: '', sale: '' });

  const canManageData = ['Admin', 'Gerente'].includes(role);

  useEffect(() => {
    if(!APP_ID) return;
    
    const unsubP = onSnapshot(collection(db, `artifacts/${APP_ID}/public/data/products`), (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    
    const q = query(collection(db, `artifacts/${APP_ID}/public/data/movements`), orderBy('createdAt', 'desc'), limit(50));
    const unsubM = onSnapshot(q, (snap) => {
      const cleanList = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.userName !== 'Admin Teste');
      setMovements(cleanList);
    });
    
    return () => { unsubP(); unsubM(); };
  }, [APP_ID]);

  const handleProdChange = (e) => {
    const { name, value } = e.target;
    setProdForm(prev => {
      const newState = { ...prev, [name]: value };
      if (name === 'cost' || name === 'qty') {
        const c = parseFloat(name === 'cost' ? value : prev.cost);
        const q = parseFloat(name === 'qty' ? value : prev.qty);
        if (!isNaN(c) && !isNaN(q) && q > 0) { newState.sell = ((c / q) * 2.2).toFixed(2); }
      }
      return newState;
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const qty = parseFloat(prodForm.qty);
      const cost = parseFloat(prodForm.cost);
      const vol = parseFloat(prodForm.vol);
      const sell = prodForm.sell ? parseFloat(prodForm.sell) : null;
      let finalQty = qty;
      if ((prodForm.unit === 'Litros' || prodForm.unit === 'KG') && vol) { finalQty = qty * vol; }

      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/products`), {
        name: prodForm.name, unit: prodForm.unit, cost: parseFloat((qty > 0 ? cost / qty : cost).toFixed(2)),
        sell, qty: parseFloat(finalQty.toFixed(3)), itemVol: vol || null, createdAt: serverTimestamp()
      });
      
      setProdForm({ name: '', unit: '', cost: '', sell: '', qty: '', vol: '' });
      alert("Cadastrado!");
    } catch (err) { alert(err.message); } finally { setSubmitting(false); }
  };

  const handleMove = async (e) => {
    e.preventDefault(); setMoving(true);
    try {
      const pRef = doc(db, `artifacts/${APP_ID}/public/data/products`, moveForm.prodId);
      const pData = (await getDoc(pRef)).data();
      const factor = ((pData.unit === 'Litros' || pData.unit === 'KG') && pData.itemVol) ? pData.itemVol : 1;
      let newQty = pData.qty, newCost = pData.cost, delta = 0, finValue = 0;

      if (moveForm.type === 'entry') {
        const qty = parseFloat(moveForm.qty), cost = parseFloat(moveForm.cost);
        finValue = -Math.abs(cost);
        newCost = ((pData.qty / factor * pData.cost) + cost) / ((pData.qty / factor) + qty);
        delta = qty * factor; newQty += delta;
      } else {
        const stockMove = (moveForm.type === 'waste' && !pData.sell) ? parseFloat(moveForm.waste || moveForm.qty) : parseFloat(moveForm.qty) * factor;
        if (moveForm.type !== 'waste' && pData.sell) finValue = stockMove * (pData.sell / factor);
        delta = -stockMove; newQty -= stockMove;
      }
      
      const updates = { qty: parseFloat(newQty.toFixed(3)), cost: parseFloat(newCost.toFixed(2)) };
      if (moveForm.sale) updates.sell = parseFloat(moveForm.sale);
      await updateDoc(pRef, updates);
      
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/movements`), { 
        userId: user.uid, userName: user.displayName || user.email, productId: moveForm.prodId, productName: pData.name, type: moveForm.type, 
        delta, unit: pData.unit, value: finValue, costAtTime: pData.cost, isExternal: !!pData.sell, createdAt: serverTimestamp() 
      });
      
      setMoveForm({ prodId: '', type: 'entry', qty: '', cost: '', waste: '', sale: '' }); alert("Registrado!");
    } catch (err) { alert(err.message); } finally { setMoving(false); }
  };

  const executeQuickMove = async (p, type) => {
    const val = parseFloat(quickValues[p.id]);
    if (!val || (p.sell && !Number.isInteger(val))) return alert("Valor inválido.");
    const delta = type === 'entry' ? val : -val;
    await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/products`, p.id), { qty: increment(delta) });
    await addDoc(collection(db, `artifacts/${APP_ID}/public/data/movements`), { userId: user.uid, userName: user.displayName || user.email, productId: p.id, productName: p.name, type: type === 'entry' ? 'entry' : 'exit', delta, unit: p.unit, isExternal: !!p.sell, note: 'Rápido', createdAt: serverTimestamp() });
    setQuickValues(prev => ({ ...prev, [p.id]: '' }));
  };

  const handleRevert = async (log) => {
    if(!canManageData) return alert("Acesso negado.");
    if(!confirm("Reverter?")) return;
    try {
        await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/products`, log.productId), { qty: increment(-log.delta) });
        await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/movements`, log.id));
    } catch (err) { alert("Erro: " + err.message); }
  };

  const handleDeleteProduct = async (id) => { if(!canManageData) return alert("Acesso negado."); if(confirm("Excluir?")) await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/products`, id)); };

  return (
    <div className="space-y-8 pb-10 text-[#F3E5AB]">
      {/* CADASTRO */}
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        <h2 className="text-lg font-bold text-gold font-egyptian mb-4">CADASTRO DE PRODUTOS</h2>
        <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2"><label className="label-top">Nome</label><input name="name" value={prodForm.name} onChange={handleProdChange} className="input-field" placeholder="Ex: Shampoo" required /></div>
          <div><label className="label-top">Unidade</label><select name="unit" value={prodForm.unit} onChange={handleProdChange} className="input-field" required><option value="">Selecione...</option><option value="Litros">Litros</option><option value="KG">KG</option><option value="UND">UND</option></select></div>
          <div><label className="label-top">Vol. Item</label><input name="vol" type="number" step="0.001" value={prodForm.vol} onChange={handleProdChange} className="input-field" placeholder="Ex: 0.5 (se 500ml/g)" disabled={prodForm.unit === 'UND'} /></div>
          <div><label className="label-top">Custo Lote (R$)</label><input name="cost" type="number" step="0.01" value={prodForm.cost} onChange={handleProdChange} className="input-field" placeholder="Total pago" required /></div>
          <div><label className="label-top">Qtd Lote</label><input name="qty" type="number" value={prodForm.qty} onChange={handleProdChange} className="input-field" placeholder="Total itens" required /></div>
          <div><label className="label-top text-gold">Venda Unit.</label><input name="sell" type="number" step="0.01" value={prodForm.sell} onChange={handleProdChange} className="input-field border-gold/30" placeholder="Sugestão" /><span className="text-[10px] text-gold/60 mt-1 block">*Sugestão: Custo + 120%</span></div>
          <div className="flex items-end"><button type="submit" className="btn-primary py-2.5 text-sm">CADASTRAR</button></div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222] h-fit sticky top-24">
          <h2 className="text-lg font-bold text-gold font-egyptian mb-4">MOVIMENTAÇÃO</h2>
          <form onSubmit={handleMove} className="space-y-4">
            <div><label className="label-top">Produto</label><select value={moveForm.prodId} onChange={e => setMoveForm({...moveForm, prodId: e.target.value})} className="input-field" required><option value="">Selecione...</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div><label className="label-top">Tipo</label><select value={moveForm.type} onChange={e => setMoveForm({...moveForm, type: e.target.value})} className="input-field"><option value="entry">Entrada</option><option value="exit">Saída</option><option value="waste">Perda</option></select></div>
            {moveForm.type === 'entry' && <><input type="number" step="0.01" value={moveForm.cost} onChange={e => setMoveForm({...moveForm, cost: e.target.value})} className="input-field" placeholder="Custo Total" required /><input type="number" value={moveForm.qty} onChange={e => setMoveForm({...moveForm, qty: e.target.value})} className="input-field" placeholder="Qtd Itens" required /><input type="number" step="0.01" value={moveForm.sale} onChange={e => setMoveForm({...moveForm, sale: e.target.value})} className="input-field" placeholder="Novo Preço Venda" /></>}
            {(moveForm.type !== 'entry') && <input type="number" step={moveForm.type === 'waste' ? "1" : "0.001"} value={moveForm.qty} onChange={e => setMoveForm({...moveForm, qty: e.target.value})} className="input-field" placeholder="Qtd" required />}
            <button type="submit" className="btn-primary bg-gold hover:bg-white hover:text-black">CONFIRMAR</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
            <h3 className="font-bold text-[#F3E5AB] mb-4">Histórico Recente</h3>
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm text-left text-[#888]">
                    <thead className="text-xs text-[#555] uppercase bg-[#111] sticky top-0"><tr><th className="px-3 py-2">Data</th><th>User</th><th>Prod</th><th>Tipo</th><th className="text-right">Qtd</th><th className="text-center">Ação</th></tr></thead>
                    <tbody>
                        {movements.map(m => (
                            <tr key={m.id} className="hover:bg-[#111]">
                                <td className="px-3 py-2 text-xs">{m.createdAt?.toDate().toLocaleDateString('pt-BR')}</td>
                                <td className="px-3 py-2 text-xs font-bold text-gold">{m.userName ? m.userName.split(' ')[0] : 'Adm'}</td>
                                <td className="px-3 py-2 font-medium text-[#eee]">{m.productName}</td>
                                <td className="px-3 py-2 text-xs">{m.type}</td>
                                <td className="px-3 py-2 font-bold text-right text-[#eee]">{m.delta}</td>
                                <td className="px-3 py-2 text-center">{canManageData && (<button onClick={() => handleRevert(m)} className="text-[#666] hover:text-red-500"><i className="fas fa-undo"></i></button>)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
          </div>

          <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
            <h3 className="font-bold text-[#F3E5AB] mb-4">Estoque Atual</h3>
            <div className="grid gap-3">
                {products.map(p => (
                    <div key={p.id} className="border border-[#222] p-4 rounded-xl flex justify-between items-center bg-[#111]">
                        <div className="w-full">
                            <div className="flex items-center gap-2"><h4 className="font-bold text-[#eee]">{p.name}</h4>{p.sell ? <span className="text-[9px] bg-green-900/30 text-green-400 px-1 rounded font-bold">VENDA</span> : <span className="text-[9px] bg-amber-900/30 text-amber-400 px-1 rounded font-bold">INT</span>}</div>
                            <div className="text-xs text-[#666]">Custo Médio: <strong>R$ {p.cost}</strong></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="number" className="w-16 text-xs p-1 border border-[#333] rounded text-center bg-[#0a0a0a] text-[#eee]" value={quickValues[p.id] || ''} onChange={(e) => setQuickValues({...quickValues, [p.id]: e.target.value})} placeholder="Qtd" />
                            <button onClick={() => executeQuickMove(p, 'exit')} className="w-6 h-6 bg-red-900/30 text-red-400 rounded hover:bg-red-900"><i className="fas fa-minus text-xs"></i></button>
                            <button onClick={() => executeQuickMove(p, 'entry')} className="w-6 h-6 bg-green-900/30 text-green-400 rounded hover:bg-green-900"><i className="fas fa-plus text-xs"></i></button>
                            <div className="text-right min-w-[60px]"><div className="text-xl font-black text-gold">{p.qty}</div><span className="text-xs text-[#555]">{p.unit}</span></div>
                            {canManageData && (<button onClick={() => handleDeleteProduct(p.id)} className="text-[#444] ml-2 hover:text-red-500"><i className="fas fa-trash"></i></button>)}
                        </div>
                    </div>
                ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`.label-top { display: block; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #666; margin-bottom: 0.25rem; letter-spacing: 0.05em; }`}</style>
    </div>
  );
}