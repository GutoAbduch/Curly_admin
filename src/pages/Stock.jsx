import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, getDocs, doc, deleteDoc, updateDoc, serverTimestamp, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { useParams } from 'react-router-dom';

export default function Stock() {
  const { shopId } = useParams();
  
  // Dados Principais
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Controle de Modais
  const [modalType, setModalType] = useState(null); // 'create' | 'stockOut'
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [saving, setSaving] = useState(false);

  // Formulário de Criação (Entrada)
  const [formData, setFormData] = useState({
    name: '', category: '', useType: 'resale', minStock: '',
    measureUnit: 'un', measureValue: '', // Simplificado: un, lt, kg
    batchNumber: '', batchTotalCost: '', quantity: '', expirationDate: '',
    salePrice: ''
  });

  // Formulário de Baixa (Saída)
  const [outData, setOutData] = useState({
    quantity: '',
    reason: 'sale' // sale, internal, loss
  });

  // Dados Calculados (Entrada)
  const [calculated, setCalculated] = useState({ unitCost: 0, suggestedPrice: 0 });

  // --- EFEITOS E CÁLCULOS ---
  useEffect(() => {
    const totalCost = parseFloat(formData.batchTotalCost) || 0;
    const qtd = parseFloat(formData.quantity) || 0;
    if (totalCost > 0 && qtd > 0) {
        const unitCost = totalCost / qtd;
        setCalculated({ unitCost: unitCost, suggestedPrice: unitCost * 2.2 }); // Markup 120%
    } else {
        setCalculated({ unitCost: 0, suggestedPrice: 0 });
    }
  }, [formData.batchTotalCost, formData.quantity]);

  const applySuggestion = () => {
    setFormData(prev => ({...prev, salePrice: calculated.suggestedPrice.toFixed(2)}));
  };

  // --- LEITURA DE DADOS ---
  const fetchProducts = async () => {
    if (!shopId) return;
    try {
      const q = query(collection(db, `artifacts/${shopId}/public/data/products`), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const productsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsList);
    } catch (error) {
      console.error("Erro ao buscar estoque:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [shopId]);

  // --- AÇÃO 1: CRIAR PRODUTO (ENTRADA DE LOTE) ---
  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);

    if (!formData.batchNumber || !formData.batchTotalCost || !formData.quantity) {
        alert("Dados do Lote Obrigatórios."); setSaving(false); return;
    }

    try {
      const batchOp = writeBatch(db); // Operação atômica

      // 1. Referência do Produto
      const newProdRef = doc(collection(db, `artifacts/${shopId}/public/data/products`));
      
      const productData = {
        name: formData.name,
        category: formData.category,
        useType: formData.useType,
        minStock: Number(formData.minStock),
        currentStock: Number(formData.quantity), // Estoque inicial
        measureUnit: formData.measureUnit,
        measureValue: Number(formData.measureValue),
        salePrice: formData.useType === 'resale' ? Number(formData.salePrice) : null,
        updatedAt: serverTimestamp()
      };
      batchOp.set(newProdRef, productData);

      // 2. Referência do Lote (Subcoleção)
      const batchRef = doc(collection(db, `artifacts/${shopId}/public/data/products/${newProdRef.id}/batches`));
      const batchData = {
        batchNumber: formData.batchNumber,
        totalCost: Number(formData.batchTotalCost),
        unitCost: calculated.unitCost,
        initialQuantity: Number(formData.quantity),
        currentQuantity: Number(formData.quantity),
        expirationDate: formData.expirationDate || null,
        entryDate: serverTimestamp(),
        isActive: true
      };
      batchOp.set(batchRef, batchData);

      // 3. Registrar Movimentação (Histórico)
      const moveRef = doc(collection(db, `artifacts/${shopId}/public/data/movements`));
      batchOp.set(moveRef, {
        type: 'IN', // ENTRADA
        productId: newProdRef.id,
        productName: formData.name,
        quantity: Number(formData.quantity),
        reason: 'purchase', // Compra
        date: serverTimestamp(),
        user: auth.currentUser?.email || 'unknown',
        batchNumber: formData.batchNumber
      });

      await batchOp.commit();

      alert("Produto cadastrado com sucesso!");
      setModalType(null); resetForm(); fetchProducts();

    } catch (error) {
      console.error(error); 
      alert("Erro ao salvar: " + error.message);
    } finally { setSaving(false); }
  };

  // --- AÇÃO 2: BAIXA DE ESTOQUE (SAÍDA INTELIGENTE - PEPS) ---
  const handleStockOut = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const qtyToRemove = Number(outData.quantity);
    if (qtyToRemove <= 0) { alert("Quantidade inválida."); setSaving(false); return; }
    if (qtyToRemove > selectedProduct.currentStock) { alert("Estoque insuficiente."); setSaving(false); return; }

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
            const available = batch.currentQuantity;
            const take = Math.min(available, remaining);
            const newQtd = available - take;
            const updateData = { currentQuantity: newQtd };
            if (newQtd === 0) updateData.isActive = false; // Desativa lote vazio

            batchWrite.update(docSnap.ref, updateData);
            remaining -= take;
            costOfGoodsSold += (take * batch.unitCost);
        });

        const productRef = doc(db, `artifacts/${shopId}/public/data/products`, selectedProduct.id);
        batchWrite.update(productRef, {
            currentStock: selectedProduct.currentStock - qtyToRemove,
            updatedAt: serverTimestamp()
        });

        const moveRef = doc(collection(db, `artifacts/${shopId}/public/data/movements`));
        batchWrite.set(moveRef, {
            type: 'OUT',
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            quantity: qtyToRemove,
            reason: outData.reason,
            date: serverTimestamp(),
            user: auth.currentUser?.email || 'unknown',
            costValue: costOfGoodsSold
        });

        await batchWrite.commit();
        alert("Baixa realizada com sucesso!");
        setModalType(null); setOutData({ quantity: '', reason: 'sale' }); fetchProducts();

    } catch (error) {
        console.error("Erro na baixa:", error);
        alert("Erro ao processar baixa.");
    } finally {
        setSaving(false);
    }
  };

  // --- AÇÃO 3: DELETAR PRODUTO ---
  const handleDelete = async (id) => {
    if (confirm("ATENÇÃO: Isso removerá o produto e todo seu histórico visual da tela. Confirma?")) {
      try {
        await deleteDoc(doc(db, `artifacts/${shopId}/public/data/products`, id));
        fetchProducts();
      } catch (error) { console.error(error); }
    }
  };

  // Helpers
  const resetForm = () => {
    setFormData({
        name: '', category: '', useType: 'resale', minStock: '',
        measureUnit: 'un', measureValue: '',
        batchNumber: '', batchTotalCost: '', quantity: '', expirationDate: '', salePrice: ''
    });
    setCalculated({ unitCost: 0, suggestedPrice: 0 });
  };

  const openStockOut = (prod) => {
      setSelectedProduct(prod);
      setModalType('stockOut');
  };

  // --- RENDERIZAÇÃO ---
  return (
    <div className="p-4 md:p-8 animate-fade-in text-[#eee]">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D4AF37] font-egyptian">Gestão de Estoque</h1>
          <p className="text-gray-400 text-sm">Entradas, Saídas e Controle de Lotes.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={() => { resetForm(); setModalType('create'); }} className="btn-primary flex items-center gap-2">
            <i className="fas fa-plus"></i> Entrada / Novo
            </button>
        </div>
      </div>

      {/* TABELA */}
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
                    <td className="p-4 font-bold">
                        {prod.name} 
                        <span className="text-xs text-gray-500 block font-normal">{prod.category}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-400">
                        {/* PROTEÇÃO CONTRA ERRO: Se measureUnit não existir, assume 'UN' */}
                        {prod.measureValue || ''} {prod.measureUnit ? prod.measureUnit.toUpperCase() : 'UN'}
                    </td>
                    <td className="p-4">
                        {prod.useType === 'resale' 
                            ? <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-900/50">Revenda</span>
                            : <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded border border-blue-900/50">Interno</span>
                        }
                    </td>
                    <td className="p-4 text-center">
                        <div className="flex flex-col items-center">
                            <span className={`font-bold text-lg ${prod.currentStock <= prod.minStock ? 'text-red-500 animate-pulse' : 'text-[#eee]'}`}>
                                {prod.currentStock}
                            </span>
                            <span className="text-[10px] text-gray-600">UND</span>
                        </div>
                    </td>
                    <td className="p-4 text-emerald-400 font-mono">
                        {prod.salePrice ? `R$ ${prod.salePrice.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => openStockOut(prod)}
                            className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 w-8 h-8 rounded flex items-center justify-center transition-all"
                            title="Dar Baixa / Saída"
                        >
                            <i className="fas fa-minus"></i>
                        </button>
                        <button 
                            onClick={() => handleDelete(prod.id)} 
                            className="text-gray-600 hover:text-red-500 p-2"
                            title="Remover Cadastro"
                        >
                            <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL DE CRIAR (ENTRADA) --- */}
      {modalType === 'create' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-3xl rounded-2xl border border-[#333] shadow-2xl overflow-y-auto max-h-[90vh] animate-slide-up">
            
            <div className="p-6 border-b border-[#222] flex justify-between items-center bg-[#111]">
              <h2 className="text-xl font-bold text-[#D4AF37]">Entrada de Estoque</h2>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white"><i className="fas fa-times"></i></button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-8">
              {/* DEF PRODUTO */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-[#222] pb-1">1. Definição do Produto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="label-text">Nome do Produto</label>
                        <input className="input-field" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required placeholder="Ex: Shampoo Premium" />
                    </div>
                    <div>
                        <label className="label-text">Categoria</label>
                        <input className="input-field" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: Lavatório" />
                    </div>
                    <div>
                        <label className="label-text">Estoque Mínimo (Alerta)</label>
                        <input type="number" className="input-field" value={formData.minStock} onChange={e => setFormData({...formData, minStock: e.target.value})} placeholder="Ex: 5" />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4 bg-[#161616] p-4 rounded border border-[#222]">
                    <div className="col-span-3"><span className="text-xs text-[#D4AF37] font-bold">Unidade de Medida</span></div>
                    <div className="col-span-1">
                        <label className="label-text">Tipo</label>
                        <select className="input-field" value={formData.measureUnit} onChange={e => setFormData({...formData, measureUnit: e.target.value})}>
                            <option value="un">Unidade (UND)</option>
                            <option value="lt">Litro (LT)</option>
                            <option value="kg">Quilo (KG)</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="label-text">Qtd. na Embalagem</label>
                        <input type="number" step="0.001" className="input-field" value={formData.measureValue} onChange={e => setFormData({...formData, measureValue: e.target.value})} placeholder="1 para 1LT/KG" />
                        <span className="text-[10px] text-gray-500">Dica: Para 250ml, selecione Litro e digite 0.250</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'resale' ? 'bg-[#D4AF37]/20 border-[#D4AF37] text-[#D4AF37]' : 'bg-[#222] border-[#333] text-gray-500'}`}>
                        <input type="radio" name="useType" value="resale" checked={formData.useType === 'resale'} onChange={() => setFormData({...formData, useType: 'resale'})} className="hidden"/>
                        <i className="fas fa-tag"></i> Item de Revenda
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded cursor-pointer border transition-all ${formData.useType === 'internal' ? 'bg-blue-900/20 border-blue-500 text-blue-400' : 'bg-[#222] border-[#333] text-gray-500'}`}>
                        <input type="radio" name="useType" value="internal" checked={formData.useType === 'internal'} onChange={() => setFormData({...formData, useType: 'internal'})} className="hidden"/>
                        <i className="fas fa-hands-wash"></i> Uso Interno
                    </label>
                </div>
              </div>

              {/* DADOS LOTE */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-[#222] pb-1">2. Dados da Compra (Lote)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2">
                        <label className="label-text">Nº Lote / NF</label>
                        <input className="input-field" value={formData.batchNumber} onChange={e => setFormData({...formData, batchNumber: e.target.value})} required placeholder="Lote 001" />
                    </div>
                    <div className="col-span-2">
                        <label className="label-text">Validade (Opcional)</label>
                        <input type="date" className="input-field text-gray-400" value={formData.expirationDate} onChange={e => setFormData({...formData, expirationDate: e.target.value})} />
                    </div>
                    
                    {/* CAMPO LIMPO SEM R$ */}
                    <div className="col-span-2 bg-gray-900/50 p-2 rounded border border-gray-800 relative">
                        <label className="label-text text-blue-300">Valor Total da Nota</label>
                        <input 
                            type="number" step="0.01" 
                            className="input-field w-full border-blue-900/30 focus:border-blue-500" 
                            value={formData.batchTotalCost} 
                            onChange={e => setFormData({...formData, batchTotalCost: e.target.value})} 
                            required placeholder="0.00" 
                        />
                    </div>

                    <div className="col-span-2 bg-gray-900/50 p-2 rounded border border-gray-800">
                        <label className="label-text text-blue-300">Qtd. Itens na Nota</label>
                        <input type="number" className="input-field border-blue-900/30 focus:border-blue-500" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required placeholder="Ex: 12" />
                    </div>
                </div>
              </div>

              {/* PREÇO VENDA */}
              {formData.useType === 'resale' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex justify-between items-end border-b border-[#222] pb-1">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">3. Preço de Venda</h3>
                        {calculated.suggestedPrice > 0 && (
                            <button type="button" onClick={applySuggestion} className="text-[10px] bg-[#D4AF37] text-black px-2 py-0.5 rounded font-bold hover:bg-white transition-colors">
                                <i className="fas fa-magic mr-1"></i> Sugestão: {calculated.suggestedPrice.toFixed(2)}
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                        <div className="bg-[#111] p-3 rounded border border-[#333]">
                            <span className="block text-xs text-gray-500 mb-1">Custo Unitário Calculado</span>
                            <div className="text-xl font-mono text-gray-400">R$ {calculated.unitCost.toFixed(2)}</div>
                        </div>
                        <div>
                            {/* CAMPO LIMPO SEM R$ */}
                            <label className="label-text text-green-400 font-bold">Preço Final de Venda</label>
                            <input 
                                type="number" step="0.01" 
                                className="input-field w-full border-green-900/50 focus:border-green-500 text-lg font-bold text-green-400" 
                                value={formData.salePrice} 
                                onChange={e => setFormData({...formData, salePrice: e.target.value})} 
                                required placeholder="0.00" 
                            />
                        </div>
                    </div>
                  </div>
              )}

              <div className="pt-4 border-t border-[#222] flex justify-end gap-3">
                <button type="button" onClick={() => setModalType(null)} className="px-6 py-3 rounded text-gray-400 hover:text-white border border-transparent hover:border-[#333]">Cancelar</button>
                <button type="submit" disabled={saving} className="btn-primary px-8">
                    {saving ? 'SALVANDO...' : 'CADASTRAR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL DE BAIXA (SAÍDA) --- */}
      {modalType === 'stockOut' && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] w-full max-w-md rounded-2xl border border-[#333] shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-[#222]">
                <h2 className="text-xl font-bold text-red-500">Baixa de Estoque</h2>
                <p className="text-xs text-gray-500 mt-1">Produto: <span className="text-white">{selectedProduct.name}</span></p>
                <p className="text-xs text-gray-500">Disponível: <span className="text-white">{selectedProduct.currentStock}</span></p>
            </div>
            
            <form onSubmit={handleStockOut} className="p-6 space-y-4">
                <div>
                    <label className="label-text">Quantidade para Remover</label>
                    <input 
                        type="number" 
                        className="input-field text-red-400 border-red-900/30 focus:border-red-500" 
                        value={outData.quantity} 
                        onChange={e => setOutData({...outData, quantity: e.target.value})} 
                        autoFocus
                        required 
                    />
                </div>
                <div>
                    <label className="label-text">Motivo da Baixa</label>
                    <select className="input-field" value={outData.reason} onChange={e => setOutData({...outData, reason: e.target.value})}>
                        <option value="sale">Venda no Balcão</option>
                        <option value="internal">Uso Interno / Lavatório</option>
                        <option value="loss">Perda / Quebra / Vencimento</option>
                    </select>
                </div>

                <div className="bg-yellow-900/10 border border-yellow-900/30 p-3 rounded text-[10px] text-yellow-600">
                    <i className="fas fa-info-circle mr-1"></i>
                    O sistema descontará automaticamente dos lotes mais antigos primeiro (PEPS).
                </div>

                <div className="pt-2 flex justify-end gap-3">
                    <button type="button" onClick={() => setModalType(null)} className="px-4 py-2 rounded text-gray-400 hover:text-white">Cancelar</button>
                    <button type="submit" disabled={saving} className="bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 px-6 py-2 rounded font-bold transition-all">
                        {saving ? 'PROCESSANDO...' : 'CONFIRMAR BAIXA'}
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .label-text { display: block; font-size: 0.75rem; color: #888; margin-bottom: 0.25rem; }
      `}</style>

    </div>
  );
}