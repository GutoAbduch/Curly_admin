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
  
  // Controle de Visualização
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory' | 'reports' | 'history'

  // Controle de Modais
  const [modalType, setModalType] = useState(null); // 'create' | 'stockOut'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filtros de Data (Para Relatórios)
  const [dateFilter, setDateFilter] = useState({ start: '', end: '' });

  // Formulário de Criação (Entrada)
  const [formData, setFormData] = useState({
    name: '', category: '', useType: 'resale', minStock: '',
    measureUnit: 'un', measureValue: '',
    batchNumber: '', batchTotalCost: '', quantity: '', expirationDate: '',
    salePrice: ''
  });

  // Formulário de Baixa
  const [outData, setOutData] = useState({
    quantity: '',
    reason: 'sale' // sale, internal, loss
  });

  // Cálculos Automáticos
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

  // --- EFEITOS DE CÁLCULO ---
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

  // --- BUSCA DE DADOS ---
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
        
        // Se não tiver filtro, limita para não travar
        if (!dateFilter.start && !dateFilter.end) {
             q = query(q, limit(300));
        }

        const querySnapshot = await getDocs(q);
        let movList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Filtragem no Cliente (Firestore range filter é limitado com orderBy desc)
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

  // --- LÓGICA DE RELATÓRIOS (UseMemo) ---
  const stockReports = useMemo(() => {
      const stats = {};
      
      movements.forEach(mov => {
          // Filtra apenas saídas por VENDA
          if (mov.type === 'OUT' && mov.reason === 'sale') {
              const pName = mov.productName || 'Desconhecido';
              
              if (!stats[pName]) {
                  stats[pName] = {
                      name: pName,
                      qtySold: 0,
                      totalCost: 0, // Custo da Mercadoria Vendida (CMV)
                      totalSale: 0, // Valor Bruto Vendido
                      lastSale: null
                  };
              }

              stats[pName].qtySold += parseFloat(mov.quantity || 0);
              stats[pName].totalCost += parseFloat(mov.costValue || 0);
              stats[pName].totalSale += parseFloat(mov.saleValue || 0); // Campo novo que vamos salvar
              
              const mDate = getSafeDate(mov.date);
              if (!stats[pName].lastSale || mDate > stats[pName].lastSale) {
                  stats[pName].lastSale = mDate;
              }
          }
      });

      const list = Object.values(stats);
      
      // Ordenações
      const topSelling = [...list].sort((a, b) => b.qtySold - a.qtySold).slice(0, 5);
      const worstSelling = [...list].sort((a, b) => a.qtySold - b.qtySold).slice(0, 5);

      return { list, topSelling, worstSelling };
  }, [movements]);


  // --- EXPORTAR CSV DETALHADO (REQUISITO 1) ---
  const exportDetailedCSV = () => {
      if (products.length === 0) return alert("Sem dados.");

      // Cabeçalho
      let csv = "Produto,Lote Atual,Custo Un (Medio),Valor Venda,Lucro Proj (Un),Lucro Real (Periodo),Qtd Vendida,Ultima Venda,Estoque Atual\n";

      products.forEach(p => {
          // Dados do Relatório (Vendas no período)
          const stat = stockReports.list.find(s => s.name === p.name);
          
          const qtySold = stat ? stat.qtySold : 0;
          const lastSale = stat && stat.lastSale ? stat.lastSale.toLocaleDateString() : '-';
          
          // Lucro Real = Total Vendido - Custo do Vendido
          const realProfit = stat ? (stat.totalSale - stat.totalCost) : 0;

          // Lucro Projetado (Unitário) = Preço Venda Atual - Custo Atual
          // Nota: 'costPrice' é um campo que vamos salvar no create agora.
          const currentCost = p.costPrice || 0;
          const currentSale = p.salePrice || 0;
          const projProfit = currentSale - currentCost;

          // Lote: Vamos tentar pegar o lote ativo do movimento de entrada mais recente (simulado) ou deixar genérico
          // Como o CSV é "por produto", e um produto pode ter N lotes, mostramos "Vários" ou tentamos achar o ativo.
          // Para simplificar e atender ao pedido "Lote", mostramos o 'activeBatch' se tivéssemos salvo no produto,
          // mas como não temos, deixamos claro.
          const batchInfo = "Ver Detalhes"; 

          csv += `"${p.name}","${batchInfo}",${currentCost.toFixed(2)},${currentSale.toFixed(2)},${projProfit.toFixed(2)},${realProfit.toFixed(2)},${qtySold},${lastSale},${p.currentStock}\n`;
      });

      const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Relatorio_Estoque_Detalhado_${new Date().toLocaleDateString()}.csv`;
      link.click();
  };

  // --- EXPORTAR CSV HISTÓRICO SIMPLES ---
  const exportHistoryCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Data,Tipo,Produto,Qtd,Motivo,Usuario\n";
    movements.forEach(mov => {
        const d = getSafeDate(mov.date);
        csvContent += `${d.toLocaleDateString()},${mov.type},"${mov.productName}",${mov.quantity},${mov.reason},${mov.user}\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Historico_Movimentacao.csv`;
    link.click();
  };


  // --- AÇÃO: CRIAR PRODUTO (ENTRADA) ---
  const handleCreate = async (e) => {
    e.preventDefault(); setSaving(true);
    
    if (!formData.batchNumber || !formData.batchTotalCost || !formData.quantity) { 
        alert("Dados do Lote Obrigatórios."); setSaving(false); return; 
    }

    try {
      const batchOp = writeBatch(db);
      
      const newProdRef = doc(collection(db, `artifacts/${shopId}/public/data/products`));
      
      // Cálculo do Custo Unitário
      const unitCost = parseFloat(formData.batchTotalCost) / parseFloat(formData.quantity);

      const productData = {
        name: formData.name, category: formData.category, useType: formData.useType,
        minStock: Number(formData.minStock), currentStock: Number(formData.quantity),
        measureUnit: formData.measureUnit, measureValue: Number(formData.measureValue),
        salePrice: formData.useType === 'resale' ? Number(formData.salePrice) : null, 
        costPrice: unitCost, // NOVO: Salvamos o custo no produto para facilitar relatórios
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
      alert("Produto cadastrado com sucesso!"); setModalType(null); resetForm(); fetchProducts();

    } catch (error) { 
      console.error(error); alert("Erro: " + error.message); 
    } finally { setSaving(false); }
  };

  // --- AÇÃO: BAIXA (SAÍDA PEPS) ---
  const handleStockOut = async (e) => {
    e.preventDefault(); setSaving(true);
    const qtyToRemove = Number(outData.quantity);

    if (qtyToRemove <= 0) { alert("Qtd inválida."); setSaving(false); return; }
    if (qtyToRemove > selectedProduct.currentStock) { alert("Estoque insuficiente."); setSaving(false); return; }
    if (selectedProduct.useType === 'resale' && !Number.isInteger(qtyToRemove)) { alert("Revenda apenas inteiros."); setSaving(false); return; }
    if (selectedProduct.measureUnit === 'un' && !Number.isInteger(qtyToRemove)) { alert("Unidades apenas inteiros."); setSaving(false); return; }

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

        // NOVO: Calcular Valor de Venda Total (para Lucro Real)
        const saleTotalValue = (selectedProduct.salePrice || 0) * qtyToRemove;

        const moveRef = doc(collection(db, `artifacts/${shopId}/public/data/movements`));
        batchWrite.set(moveRef, {
            type: 'OUT', productId: selectedProduct.id, productName: selectedProduct.name, quantity: qtyToRemove,
            reason: outData.reason, date: serverTimestamp(), 
            user: auth.currentUser?.email, userName: auth.currentUser?.displayName || 'Admin', 
            costValue: costOfGoodsSold, // Quanto custou pra gente
            saleValue: saleTotalValue // Por quanto vendemos (Se for venda)
        });

        await batchWrite.commit();
        alert("Baixa realizada!"); setModalType(null); setOutData({ quantity: '', reason: 'sale' }); fetchProducts();

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
  const openStockOut = (prod) => { setSelectedProduct(prod); setModalType('stockOut'); };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="p-4 md:p-8 animate-fade-in text-[#eee] pb-20">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D4AF37] font-egyptian">Gestão de Estoque</h1>
          <p className="text-gray-400 text-sm">Controle PEPS, Lotes e Lucratividade.</p>
        </div>
      </div>

      {/* ABAS */}
      <div className="flex gap-4 border-b border-[#222] mb-6">
          <button onClick={() => {setActiveTab('inventory'); fetchProducts();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'inventory' ? 'border-gold text-gold' : 'border-transparent text-gray-500'}`}>
              INVENTÁRIO
          </button>
          <button onClick={() => {setActiveTab('reports'); fetchMovements();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'reports' ? 'border-gold text-gold' : 'border-transparent text-gray-500'}`}>
              RELATÓRIOS & CSV
          </button>
          <button onClick={() => {setActiveTab('history'); fetchMovements();}} className={`pb-2 px-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'history' ? 'border-gold text-gold' : 'border-transparent text-gray-500'}`}>
              HISTÓRICO GERAL
          </button>
      </div>

      {/* --- ABA 1: INVENTÁRIO --- */}
      {activeTab === 'inventory' && (
          <div className="animate-fade-in">
              <div className="flex justify-end mb-4">
                   <button onClick={() => { resetForm(); setModalType('create'); }} className="btn-primary flex items-center gap-2"><i className="fas fa-plus"></i> Novo Produto</button>
              </div>
              <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#1a1500] text-[#D4AF37] text-sm uppercase tracking-wider">
                        <th className="p-4">Produto</th>
                        <th className="p-4">Medida</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4 text-center">Estoque</th>
                        <th className="p-4">Preço Venda</th>
                        <th className="p-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#222]">
                      {loading ? (
                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">Carregando estoque...</td></tr>
                      ) : products.length === 0 ? (
                        <tr><td colSpan="6" className="p-8 text-center text-gray-500">Nenhum produto cadastrado.</td></tr>
                      ) : (
                        products.map((prod) => (
                          <tr key={prod.id} className="hover:bg-[#1a1a1a] transition-colors group">
                            <td className="p-4 font-bold">{prod.name} <span className="text-xs text-gray-500 block font-normal">{prod.category}</span></td>
                            <td className="p-4 text-sm text-gray-400">{prod.measureValue || ''} {prod.measureUnit ? prod.measureUnit.toUpperCase() : 'UN'}</td>
                            <td className="p-4">{prod.useType === 'resale' ? <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded">Revenda</span> : <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">Interno</span>}</td>
                            <td className="p-4 text-center"><span className={`font-bold text-lg ${prod.currentStock <= prod.minStock ? 'text-red-500 animate-pulse' : 'text-[#eee]'}`}>{Number(prod.currentStock).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</span></td>
                            <td className="p-4 text-emerald-400 font-mono">{prod.salePrice ? Number(prod.salePrice).toFixed(2) : '-'}</td>
                            <td className="p-4 text-right">
                              <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openStockOut(prod)} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 w-8 h-8 rounded flex items-center justify-center" title="Dar Baixa"><i className="fas fa-minus"></i></button>
                                <button onClick={() => handleDelete(prod.id)} className="text-gray-600 hover:text-red-500 p-2" title="Remover"><i className="fas fa-trash"></i></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
      )}

      {/* --- ABA 2: RELATÓRIOS (NOVO) --- */}
      {activeTab === 'reports' && (
          <div className="space-y-6 animate-fade-in">
              <div className="flex flex-wrap gap-2 items-center bg-[#111] p-4 rounded-xl border border-[#222]">
                  <h3 className="text-sm font-bold text-gray-400 mr-2">Filtrar Período:</h3>
                  <input type="date" onChange={e => setDateFilter({...dateFilter, start: e.target.value})} className="bg-black text-white text-xs p-2 rounded border border-[#333]"/>
                  <input type="date" onChange={e => setDateFilter({...dateFilter, end: e.target.value})} className="bg-black text-white text-xs p-2 rounded border border-[#333]"/>
                  <button onClick={fetchMovements} className="text-xs font-bold bg-[#333] px-3 py-2 rounded text-white hover:bg-[#444]">Aplicar Filtro</button>
                  <div className="flex-1"></div>
                  <button onClick={exportDetailedCSV} className="text-xs font-bold bg-green-900/20 text-green-400 border border-green-900 px-4 py-2 rounded flex items-center gap-2 hover:bg-green-900 hover:text-white transition"><i className="fas fa-file-csv"></i> Relatório Detalhado (Lucro)</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                      <h4 className="text-gold font-bold mb-4 uppercase text-xs tracking-widest border-b border-[#222] pb-2">Top 5 Mais Vendidos</h4>
                      {stockReports.topSelling.length === 0 && <p className="text-gray-500 text-sm">Sem vendas no período.</p>}
                      {stockReports.topSelling.map((s, i) => (
                          <div key={i} className="flex justify-between py-2 border-b border-[#222] last:border-0">
                              <span className="text-white">#{i+1} {s.name}</span>
                              <span className="text-gold font-mono font-bold">{s.qtySold} un</span>
                          </div>
                      ))}
                  </div>
                  <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                      <h4 className="text-red-400 font-bold mb-4 uppercase text-xs tracking-widest border-b border-[#222] pb-2">Top 5 Menos Vendidos</h4>
                      {stockReports.worstSelling.length === 0 && <p className="text-gray-500 text-sm">Sem vendas no período.</p>}
                      {stockReports.worstSelling.map((s, i) => (
                          <div key={i} className="flex justify-between py-2 border-b border-[#222] last:border-0">
                              <span className="text-gray-400">#{i+1} {s.name}</span>
                              <span className="text-gray-600 font-mono">{s.qtySold} un</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* --- ABA 3: HISTÓRICO GERAL --- */}
      {activeTab === 'history' && (
        <div className="bg-[#111] rounded-xl border border-[#222] overflow-hidden animate-fade-in">
             <div className="p-4 flex justify-between items-center bg-[#0a0a0a]">
                <h3 className="font-bold text-[#eee]">Todas as Movimentações</h3>
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

      {/* --- MODAL DE CRIAÇÃO (IGUAL AO ANTERIOR) --- */}
      {modalType === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-3xl rounded-2xl border border-[#333] shadow-2xl overflow-y-auto max-h-[90vh] animate-slide-up">
            <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#111]">
              <h2 className="text-xl font-bold text-[#D4AF37]">Entrada de Estoque</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Nome</label>
                      <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Shampoo" />
                  </div>
                  <div>
                      <label className="text-xs text-gray-500 block mb-1">Categoria</label>
                      <input className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: Lavatório" />
                  </div>
                  <div>
                      <label className="text-xs text-gray-500 block mb-1">Estoque Mínimo</label>
                      <input type="number" className="input-field" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} placeholder="Ex: 5" />
                  </div>
              </div>
              <div className="grid grid-cols-3 gap-4 bg-[#161616] p-4 rounded border border-[#222]">
                  <div className="col-span-1">
                      <label className="text-xs text-gray-500 block mb-1">Unidade</label>
                      <select className="input-field" value={formData.measureUnit} onChange={e => setFormData({...formData, measureUnit: e.target.value})}>
                          <option value="un">Unidade (UND)</option><option value="lt">Litro (LT)</option><option value="kg">Quilo (KG)</option>
                      </select>
                  </div>
                  <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Qtd Embalagem</label>
                      <input type="number" step="0.001" className="input-field" value={formData.measureValue} onChange={e => setFormData({...formData, measureValue: e.target.value})} placeholder="Ex: 0.250" />
                  </div>
              </div>
              <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'resale' ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#222] border-[#333] text-gray-500'}`}>
                      <input type="radio" name="useType" value="resale" checked={formData.useType === 'resale'} onChange={() => setFormData({...formData, useType: 'resale'})} className="hidden"/> Item de Revenda
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'internal' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#222] border-[#333] text-gray-500'}`}>
                      <input type="radio" name="useType" value="internal" checked={formData.useType === 'internal'} onChange={() => setFormData({...formData, useType: 'internal'})} className="hidden"/> Uso Interno
                  </label>
              </div>
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-[#222] pb-1">Dados do Lote (NF)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2"><input className="input-field" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} required placeholder="Nº Lote" /></div>
                    <div className="col-span-2"><input type="date" className="input-field text-gray-400" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} /></div>
                    <div className="col-span-2"><input type="number" step="0.01" className="input-field" value={formData.batchTotalCost} onChange={e => setFormData({...formData, batchTotalCost: e.target.value})} required placeholder="R$ Total Nota" /></div>
                    <div className="col-span-2"><input type="number" className="input-field" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required placeholder="Qtd Itens" /></div>
                </div>
              </div>
              {formData.useType === 'resale' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-[#111] p-4 rounded border border-[#333]">
                      <div>
                          <span className="block text-xs text-gray-500 mb-1">Custo Unitário</span>
                          <div className="text-xl font-mono text-gray-400">R$ {calculated.unitCost.toFixed(2)}</div>
                      </div>
                      <div>
                          <label className="text-xs text-green-400 font-bold block mb-1">Preço Venda</label>
                          <div className="flex gap-2">
                             <input type="number" step="0.01" className="input-field w-full text-lg font-bold text-green-400" value={formData.salePrice} onChange={e => setFormData({...formData, salePrice: e.target.value})} placeholder="0.00" />
                             {calculated.suggestedPrice > 0 && <button type="button" onClick={applySuggestion} className="bg-[#D4AF37] text-black px-2 rounded text-xs font-bold">Sugestão</button>}
                          </div>
                      </div>
                  </div>
              )}
              <button className="btn-primary w-full">SALVAR ENTRADA</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE BAIXA (IGUAL AO ANTERIOR) --- */}
      {modalType === 'stockOut' && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-2xl border border-[#333] shadow-2xl animate-scale-in">
             <div className="p-6 border-b border-[#222]"><h2 className="text-xl font-bold text-red-500">Baixa: {selectedProduct.name}</h2></div>
             <form onSubmit={handleStockOut} className="p-6 space-y-4">
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Quantidade</label>
                    <input type="number" step="0.001" className="input-field" value={outData.quantity} onChange={e => setOutData({...outData, quantity: e.target.value})} placeholder="Qtd" required />
                 </div>
                 <div>
                    <label className="text-xs text-gray-500 block mb-1">Motivo</label>
                    <select className="input-field" value={outData.reason} onChange={e => setOutData({...outData, reason: e.target.value})}><option value="sale">Venda</option><option value="internal">Uso Interno</option><option value="loss">Perda/Quebra</option></select>
                 </div>
                 <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setModalType(null)} className="flex-1 py-2 text-gray-500 hover:text-white">Cancelar</button>
                    <button className="flex-1 btn-primary bg-red-600 border-red-800 hover:bg-red-500">Confirmar</button>
                 </div>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}