import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, writeBatch, limit } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

export default function Stock() {
  const { shopId } = useParams();
  
  // --- ESTADOS ---
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // Abas
  const [activeTab, setActiveTab] = useState('inventory'); 

  // Modais
  const [modalType, setModalType] = useState(null); 
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filtros
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Forms
  const [formData, setFormData] = useState({
    name: '', category: '', useType: 'resale', minStock: '',
    measureUnit: 'un', measureValue: '',
    batchNumber: '', batchTotalCost: '', quantity: '', expirationDate: '',
    salePrice: ''
  });
  
  const [outData, setOutData] = useState({ quantity: '', reason: 'sale' });
  const [calculated, setCalculated] = useState({ unitCost: 0, suggestedPrice: 0 });

  // --- HELPERS ---
  const getSafeDate = (timestamp) => {
      if (!timestamp) return new Date();
      if (typeof timestamp.toDate === 'function') return timestamp.toDate();
      if (timestamp instanceof Date) return timestamp;
      return new Date(timestamp);
  };

  const formatDate = (timestamp) => {
      if (!timestamp) return '-';
      return getSafeDate(timestamp).toLocaleString('pt-BR');
  };

  // --- EFEITOS ---
  useEffect(() => {
    const totalCost = parseFloat(formData.batchTotalCost) || 0;
    const qtd = parseFloat(formData.quantity) || 0;
    if (totalCost > 0 && qtd > 0) {
        const unitCost = totalCost / qtd;
        setCalculated({ unitCost: unitCost, suggestedPrice: unitCost * 2.2 }); 
    } else {
        setCalculated({ unitCost: 0, suggestedPrice: 0 });
    }
  }, [formData.batchTotalCost, formData.quantity]);

  const applySuggestion = () => {
    setFormData(prev => ({...prev, salePrice: calculated.suggestedPrice.toFixed(2)}));
  };

  // --- FETCH DATA ---
  const fetchProducts = async () => {
    if (!shopId) return;
    try {
      const q = query(collection(db, `artifacts/${shopId}/public/data/products`), orderBy('name'));
      const querySnapshot = await getDocs(q);
      setProducts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) { console.error("Erro produtos:", error); } finally { setLoading(false); }
  };

  const fetchMovements = async () => {
    if (!shopId) return;
    try {
        let q = query(collection(db, `artifacts/${shopId}/public/data/movements`), orderBy('date', 'desc'));
        if (!dateFilter.start && !dateFilter.end) q = query(q, limit(300));

        const querySnapshot = await getDocs(q);
        let movList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (dateFilter.start || dateFilter.end) {
            const startDate = dateFilter.start ? new Date(dateFilter.start + 'T00:00:00') : null;
            const endDate = dateFilter.end ? new Date(dateFilter.end + 'T23:59:59') : null;
            movList = movList.filter(mov => {
                const movDate = getSafeDate(mov.date);
                if (startDate && movDate < startDate) return false;
                if (endDate && movDate > endDate) return false;
                return true;
            });
        }
        setMovements(movList);
    } catch (error) { console.error("Erro histórico:", error); }
  };

  useEffect(() => { fetchProducts(); }, [shopId]);

  // --- RELATÓRIOS ---
  const stockReports = useMemo(() => {
      const stats = {};
      movements.forEach(mov => {
          if (mov.type === 'OUT' && mov.reason === 'sale') {
              const pName = mov.productName || 'Desconhecido';
              if (!stats[pName]) {
                  stats[pName] = { name: pName, qtySold: 0, totalCost: 0, totalSale: 0, lastSale: null };
              }
              stats[pName].qtySold += parseFloat(mov.quantity || 0);
              stats[pName].totalCost += parseFloat(mov.costValue || 0);
              stats[pName].totalSale += parseFloat(mov.saleValue || 0);
              
              const mDate = getSafeDate(mov.date);
              if (!stats[pName].lastSale || mDate > stats[pName].lastSale) stats[pName].lastSale = mDate;
          }
      });
      const list = Object.values(stats);
      const topSelling = [...list].sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);
      const worstSelling = [...list].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5);
      return { list, topSelling, worstSelling };
  }, [movements]);

  // --- EXPORTAR CSV ---
  const exportDetailedCSV = () => {
      if (products.length === 0) return alert("Carregue os produtos primeiro.");
      let csv = "Produto,Tipo,Custo Un,Valor Venda,Lucro Proj,Lucro Real (Total),Qtd Vendida,Ultima Venda,Estoque Atual\n";

      products.forEach(p => {
          const stat = stockReports.list.find(s => s.name === p.name);
          const qtySold = stat ? stat.qtySold : 0;
          const lastSale = stat && stat.lastSale ? stat.lastSale.toLocaleDateString() : '-';
          const realProfit = stat ? (stat.totalSale - stat.totalCost) : 0;
          const currentCost = parseFloat(p.costPrice || 0);
          const currentSale = parseFloat(p.salePrice || 0);
          const projProfit = currentSale - currentCost;

          csv += `"${p.name}","${p.useType}",${currentCost.toFixed(2)},${currentSale.toFixed(2)},${projProfit.toFixed(2)},${realProfit.toFixed(2)},${qtySold},${lastSale},${p.currentStock}\n`;
      });

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Relatorio_Estoque_${new Date().toLocaleDateString()}.csv`;
      link.click();
  };

  const exportHistoryCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Data,Hora,Tipo,Produto,Qtd,Motivo,Usuario\n";
    movements.forEach(mov => {
        const d = getSafeDate(mov.date);
        csvContent += `${d.toLocaleDateString()},${d.toLocaleTimeString()},${mov.type},"${mov.productName}",${mov.quantity},${mov.reason},${mov.user}\n`;
    });
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Historico_Movimentacao.csv`;
    link.click();
  };

  // --- ACTIONS ---
  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    if (!formData.batchNumber || !formData.batchTotalCost || !formData.quantity) { 
        alert("Dados do Lote Obrigatórios."); setSaving(false); return; 
    }
    try {
      const batchOp = writeBatch(db);
      const newProdRef = doc(collection(db, `artifacts/${shopId}/public/data/products`));
      const unitCost = parseFloat(formData.batchTotalCost) / parseFloat(formData.quantity);

      const productData = {
        name: formData.name, category: formData.category, useType: formData.useType,
        minStock: Number(formData.minStock), currentStock: Number(formData.quantity),
        measureUnit: formData.measureUnit, measureValue: Number(formData.measureValue),
        salePrice: formData.useType === 'resale' ? Number(formData.salePrice) : null, 
        costPrice: unitCost,
        updatedAt: serverTimestamp()
      };
      batchOp.set(newProdRef, productData);

      const batchRef = doc(collection(db, `artifacts/${shopId}/public/data/products/${newProdRef.id}/batches`));
      batchOp.set(batchRef, {
        batchNumber: formData.batchNumber, totalCost: Number(formData.batchTotalCost), unitCost: unitCost,
        initialQuantity: Number(formData.quantity), currentQuantity: Number(formData.quantity),
        expirationDate: formData.expirationDate || null, entryDate: serverTimestamp(), isActive: true
      });

      const moveRef = doc(collection(db, `artifacts/${shopId}/public/data/movements`));
      batchOp.set(moveRef, {
        type: 'IN', productId: newProdRef.id, productName: formData.name, quantity: Number(formData.quantity),
        reason: 'purchase', date: serverTimestamp(), 
        user: auth.currentUser?.email, userName: auth.currentUser?.displayName || 'Admin', 
        batchNumber: formData.batchNumber
      });

      await batchOp.commit();
      alert("Sucesso!"); setModalType(null); resetForm(); fetchProducts();
    } catch (error) { console.error(error); alert("Erro: " + error.message); } finally { setSaving(false); }
  };

  // --- STOCK OUT (LÓGICA LIVRE) ---
  const openStockOut = (prod) => { 
      setSelectedProduct(prod);
      // Lógica automática: Se for interno, já cai em "Uso Interno" e remove opção "Venda"
      const initialReason = prod.useType === 'internal' ? 'internal' : 'sale';
      setOutData({ quantity: '', reason: initialReason });
      setModalType('stockOut'); 
  };

  const handleStockOut = async (e) => {
    e.preventDefault(); setSaving(true);
    const qtyToRemove = Number(outData.quantity);

    if (qtyToRemove <= 0) { alert("Qtd inválida."); setSaving(false); return; }
    if (qtyToRemove > selectedProduct.currentStock) { alert("Estoque insuficiente."); setSaving(false); return; }

    // NOTA: Regra de inteiros/decimais foi removida conforme solicitação.

    try {
        const batchesRef = collection(db, `artifacts/${shopId}/public/data/products/${selectedProduct.id}/batches`);
        const q = query(batchesRef, where('isActive', '==', true), orderBy('entryDate', 'asc'));
        const snapshot = await getDocs(q);
        
        const batchWrite = writeBatch(db);
        let remaining = qtyToRemove; 
        let costOfGoodsSold = 0;

        snapshot.docs.forEach((docSnap) => {
            if (remaining <= 0) return;
            const batch = docSnap.data();
            const take = Math.min(batch.currentQuantity, remaining);
            const newQtd = Number((batch.currentQuantity - take).toFixed(3));
            
            const updateData = { currentQuantity: newQtd };
            if (newQtd <= 0) updateData.isActive = false;
            
            batchWrite.update(docSnap.ref, updateData);
            
            remaining = Number((remaining - take).toFixed(3));
            costOfGoodsSold += (take * batch.unitCost);
        });

        const productRef = doc(db, `artifacts/${shopId}/public/data/products`, selectedProduct.id);
        const newTotal = Number((selectedProduct.currentStock - qtyToRemove).toFixed(3));
        batchWrite.update(productRef, { currentStock: newTotal, updatedAt: serverTimestamp() });

        const saleTotalValue = (selectedProduct.salePrice || 0) * qtyToRemove;

        const moveRef = doc(collection(db, `artifacts/${shopId}/public/data/movements`));
        batchWrite.set(moveRef, {
            type: 'OUT', productId: selectedProduct.id, productName: selectedProduct.name, quantity: qtyToRemove,
            reason: outData.reason, date: serverTimestamp(), 
            user: auth.currentUser?.email, userName: auth.currentUser?.displayName || 'Admin', 
            costValue: costOfGoodsSold,
            saleValue: outData.reason === 'sale' ? saleTotalValue : 0
        });

        await batchWrite.commit();
        alert("Baixa realizada!"); setModalType(null); fetchProducts();

    } catch (error) { console.error(error); alert("Erro na baixa."); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (confirm("Apagar produto?")) {
      try { await deleteDoc(doc(db, `artifacts/${shopId}/public/data/products`, id)); fetchProducts(); } catch (e) { console.error(e); }
    }
  };

  const resetForm = () => {
    setFormData({ name: '', category: '', useType: 'resale', minStock: '', measureUnit: 'un', measureValue: '', batchNumber: '', batchTotalCost: '', quantity: '', expirationDate: '', salePrice: '' });
    setCalculated({ unitCost: 0, suggestedPrice: 0 });
  };

  return (
    <div className="p-4 md:p-8 animate-fade-in text-[#eee] pb-20">
      
      {/* HEADER & BOTÃO GRANDE DE ENTRADA */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D4AF37] font-egyptian">Estoque</h1>
          <p className="text-gray-400 text-sm">Controle PEPS. Use o botão ao lado para lançar notas.</p>
        </div>
        
        {/* BOTÃO MAIS SUGESTIVO E ORGANIZADO */}
        <button 
            onClick={() => { resetForm(); setModalType('create'); }} 
            className="bg-gradient-to-r from-yellow-600 to-[#D4AF37] text-black font-black uppercase tracking-wider py-3 px-6 rounded-lg shadow-lg hover:scale-105 transition-transform flex items-center gap-3"
        >
            <i className="fas fa-box-open text-xl"></i>
            <span>Nova Entrada (Nota Fiscal)</span>
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-4 border-b border-[#222] mb-6 overflow-x-auto">
          <button onClick={() => {setActiveTab('inventory'); fetchProducts();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'inventory' ? 'border-gold text-gold' : 'border-transparent text-gray-500 hover:text-white'}`}>INVENTÁRIO</button>
          <button onClick={() => {setActiveTab('reports'); fetchMovements();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'reports' ? 'border-gold text-gold' : 'border-transparent text-gray-500 hover:text-white'}`}>RELATÓRIOS & CSV</button>
          <button onClick={() => {setActiveTab('history'); fetchMovements();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === 'history' ? 'border-gold text-gold' : 'border-transparent text-gray-500 hover:text-white'}`}>HISTÓRICO</button>
      </div>

      {/* --- INVENTÁRIO --- */}
      {activeTab === 'inventory' && (
          <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden shadow-xl animate-fade-in">
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                   <thead className="bg-[#1a1500] text-[#D4AF37] uppercase text-[10px]">
                      <tr><th className="p-4">Produto</th><th className="p-4">Tipo</th><th className="p-4 text-center">Estoque</th><th className="p-4">Preço Venda</th><th className="p-4 text-right">Ações</th></tr>
                   </thead>
                   <tbody className="divide-y divide-[#222]">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-[#1a1a1a]">
                           <td className="p-4 font-bold">{prod.name} <span className="text-xs text-gray-500 block font-normal">{prod.category}</span></td>
                           <td className="p-4">{prod.useType === 'resale' ? <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Revenda</span> : <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">Interno</span>}</td>
                           <td className="p-4 text-center"><span className={`font-bold text-lg ${prod.currentStock <= prod.minStock ? 'text-red-500 animate-pulse' : 'text-[#eee]'}`}>{Number(prod.currentStock).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span> <span className="text-xs text-gray-500">{prod.measureUnit}</span></td>
                           <td className="p-4 text-emerald-400 font-mono">{prod.salePrice ? Number(prod.salePrice).toFixed(2) : '-'}</td>
                           <td className="p-4 text-right flex justify-end gap-2">
                              <button onClick={() => openStockOut(prod)} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 w-8 h-8 rounded flex items-center justify-center" title="Dar Baixa"><i className="fas fa-minus"></i></button>
                              <button onClick={() => handleDelete(prod.id)} className="text-gray-600 hover:text-red-500 p-2" title="Remover"><i className="fas fa-trash"></i></button>
                           </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
      )}

      {/* --- RELATÓRIOS --- */}
      {activeTab === 'reports' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap gap-2 items-center bg-[#111] p-4 rounded-xl border border-[#222]">
                  <input type="date" onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="bg-black text-white text-xs p-2 rounded border border-[#333]"/>
                  <input type="date" onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="bg-black text-white text-xs p-2 rounded border border-[#333]"/>
                  <button onClick={fetchMovements} className="text-xs font-bold bg-[#333] px-3 py-2 rounded text-white hover:bg-[#444]">Filtrar</button>
                  <div className="flex-1"></div>
                  <button onClick={exportDetailedCSV} className="text-xs font-bold bg-green-900/20 text-green-400 border border-green-900 px-4 py-2 rounded flex items-center gap-2 hover:bg-green-900 hover:text-white transition"><i className="fas fa-file-csv"></i> CSV Detalhado</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                      <h4 className="text-gold font-bold mb-4 uppercase text-xs">Top 5 Mais Vendidos</h4>
                      {stockReports.topSelling.map((s, i) => <div key={i} className="flex justify-between py-2 border-b border-[#222] last:border-0"><span className="text-white">#{i+1} {s.name}</span><span className="text-gold font-mono font-bold">{s.qtySold} un</span></div>)}
                  </div>
                  <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                      <h4 className="text-red-400 font-bold mb-4 uppercase text-xs">Top 5 Menos Vendidos</h4>
                      {stockReports.worstSelling.map((s, i) => <div key={i} className="flex justify-between py-2 border-b border-[#222] last:border-0"><span className="text-gray-400">#{i+1} {s.name}</span><span className="text-gray-600 font-mono">{s.qtySold} un</span></div>)}
                  </div>
              </div>
          </div>
      )}

      {/* --- HISTÓRICO --- */}
      {activeTab === 'history' && (
        <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden animate-fade-in">
             <div className="p-4 flex justify-between items-center bg-[#0a0a0a]">
                <h3 className="font-bold text-[#eee]">Movimentações</h3>
                <button onClick={exportHistoryCSV} className="text-xs bg-[#333] text-white px-3 py-1 rounded border border-[#555] hover:bg-[#444]">CSV Simples</button>
             </div>
             <div className="max-h-[600px] overflow-y-auto">
                 <table className="w-full text-left text-sm">
                     <thead className="bg-[#000] text-gray-500 uppercase text-[10px]"><tr><th className="p-4">Data</th><th className="p-4">Tipo</th><th className="p-4">Produto</th><th className="p-4">Qtd</th><th className="p-4">Motivo</th><th className="p-4">Usuário</th></tr></thead>
                     <tbody className="divide-y divide-[#222]">
                        {movements.map(mov => (
                            <tr key={mov.id} className="hover:bg-[#161616]">
                                <td className="p-4 text-gray-400">{formatDate(mov.date)}</td>
                                <td className="p-4">{mov.type === 'IN' ? <span className="text-green-500 font-bold">ENTRADA</span> : <span className="text-red-500 font-bold">SAÍDA</span>}</td>
                                <td className="p-4 text-white font-bold">{mov.productName}</td>
                                <td className="p-4 font-mono">{Number(mov.quantity).toLocaleString()}</td>
                                <td className="p-4 text-xs text-gray-400 uppercase">{mov.reason === 'purchase' ? 'Compra' : mov.reason === 'sale' ? 'Venda' : 'Uso Interno'}</td>
                                <td className="p-4 text-xs text-gray-500">{mov.userName || mov.user}</td>
                            </tr>
                        ))}
                     </tbody>
                 </table>
             </div>
         </div>
      )}

      {/* --- MODAL 1: CRIAR (ENTRADA) --- */}
      {modalType === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-3xl rounded-2xl border border-[#333] shadow-2xl overflow-y-auto max-h-[90vh] animate-slide-up">
            <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#111]">
              <h2 className="text-xl font-bold text-[#D4AF37]">Entrada de Estoque</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2"><label className="text-xs text-gray-500 block mb-1">Nome do Produto</label><input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Shampoo" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Categoria</label><input className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: Lavatório" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Estoque Mínimo</label><input type="number" className="input-field" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} placeholder="Ex: 5" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4 bg-[#161616] p-4 rounded border border-[#222]">
                  <div className="col-span-1"><label className="text-xs text-gray-500 block mb-1">Tipo Medida</label><select className="input-field" value={formData.measureUnit} onChange={e => setFormData({...formData, measureUnit: e.target.value})}><option value="un">Unidade (UND)</option><option value="lt">Litro (LT)</option><option value="kg">Quilo (KG)</option></select></div>
                  <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Qtd na Embalagem</label><input type="number" step="0.001" className="input-field" value={formData.measureValue} onChange={e => setFormData({...formData, measureValue: e.target.value})} placeholder="Ex: 0.250" /></div>
              </div>
              <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'resale' ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#222] border-[#333] text-gray-500'}`}><input type="radio" name="useType" value="resale" checked={formData.useType === 'resale'} onChange={() => setFormData({...formData, useType: 'resale'})} className="hidden"/> Item de Revenda</label>
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'internal' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#222] border-[#333] text-gray-500'}`}><input type="radio" name="useType" value="internal" checked={formData.useType === 'internal'} onChange={() => setFormData({...formData, useType: 'internal'})} className="hidden"/> Uso Interno</label>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-[#222] pb-1">2. Dados da Compra (Lote)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2"><input className="input-field" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} required placeholder="Nº Lote" /></div>
                    <div className="col-span-2"><input type="date" className="input-field text-gray-400" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} /></div>
                    <div className="col-span-2"><input type="number" step="0.01" className="input-field" value={formData.batchTotalCost} onChange={e => setFormData({...formData, batchTotalCost: e.target.value})} required placeholder="R$ Total Nota" /></div>
                    <div className="col-span-2"><input type="number" className="input-field" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required placeholder="Qtd Itens" /></div>
                </div>
              </div>
              {formData.useType === 'resale' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-[#111] p-4 rounded border border-[#333]">
                      <div><span className="block text-xs text-gray-500 mb-1">Custo Unitário Calculado</span><div className="text-xl font-mono text-gray-400">R$ {calculated.unitCost.toFixed(2)}</div></div>
                      <div><label className="text-xs text-green-400 font-bold block mb-1">Preço Final de Venda</label><div className="flex gap-2"><input type="number" step="0.01" className="input-field w-full text-lg font-bold text-green-400" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="0.00" />{calculated.suggestedPrice > 0 && <button type="button" onClick={applySuggestion} className="bg-[#D4AF37] text-black px-2 rounded text-xs font-bold">Sugestão</button>}</div></div>
                  </div>
              )}
              <div className="pt-4 border-t border-[#222] flex justify-end gap-3">
                  <button type="button" onClick={() => setModalType(null)} className="px-6 py-3 rounded text-gray-400 hover:text-white border border-transparent hover:border-[#333]">Cancelar</button>
                  <button type="submit" disabled={saving} className="btn-primary px-8">{saving ? 'SALVANDO...' : 'CADASTRAR'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 2: BAIXA (SAÍDA) --- */}
      {modalType === 'stockOut' && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-2xl border border-[#333] shadow-2xl animate-scale-in">
             <div className="p-6 border-b border-[#222]">
                <h2 className="text-xl font-bold text-red-500">Baixa de Estoque</h2>
                <p className="text-xs text-gray-500 mt-1">Produto: <span className="text-white">{selectedProduct.name}</span></p>
                <p className="text-xs text-gray-500">Tipo: <span className={selectedProduct.useType === 'resale' ? 'text-green-400' : 'text-blue-400'}>{selectedProduct.useType === 'resale' ? 'Revenda' : 'Interno'}</span></p>
             </div>
             <form onSubmit={handleStockOut} className="p-6 space-y-4">
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Quantidade</label>
                    <input 
                        type="number" 
                        step="0.001"
                        className="input-field text-red-400 border-red-900/30 focus:border-red-500" 
                        value={outData.quantity} onChange={e => setOutData({...outData, quantity: e.target.value})} 
                        placeholder="Quantidade"
                        required autoFocus
                    />
                 </div>
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Motivo</label>
                    <select className="input-field" value={outData.reason} onChange={e => setOutData({...outData, reason: e.target.value})}>
                        {selectedProduct.useType === 'resale' && <option value="sale">Venda no Balcão</option>}
                        <option value="internal">Uso Interno / Lavatório</option>
                        <option value="loss">Perda / Quebra / Vencimento</option>
                    </select>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setModalType(null)} className="flex-1 py-2 text-gray-500 hover:text-white">Cancelar</button>
                    <button className="flex-1 btn-primary bg-red-600 border-red-800 hover:bg-red-500">Confirmar Baixa</button>
                 </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}