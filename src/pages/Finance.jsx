import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function Finance() {
  const { user, role, shopId } = useOutletContext();
  const APP_ID = shopId;
  
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  
  // Totais para Exibição (Cards)
  const [stockBalance, setStockBalance] = useState({ currentCost: 0, potentialSale: 0, periodProfit: 0 });
  const [serviceBalance, setServiceBalance] = useState({ total: 0, categories: {} });
  const [payrollData, setPayrollData] = useState([]);
  
  // DADOS BRUTOS (Restaurados para o CSV)
  const [rawProducts, setRawProducts] = useState([]);      
  const [rawMovements, setRawMovements] = useState([]);    
  const [rawAppointments, setRawAppointments] = useState([]); 

  const [payoutFrequencies, setPayoutFrequencies] = useState({});
  const [processingPayment, setProcessingPayment] = useState(null);

  // Permissões
  const canExecutePayout = ['Admin', 'Financeiro'].includes(role);
  const canDownloadReports = ['Admin', 'Financeiro'].includes(role);

  useEffect(() => {
    if(!APP_ID) return;
    
    const fetchData = async () => {
      setLoading(true);
      const start = new Date(`${startDate}T00:00:00`); 
      const end = new Date(`${endDate}T23:59:59`);
      
      // 1. ESTOQUE & MOVIMENTAÇÕES
      const pSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/products`));
      let cost = 0, pot = 0; 
      const prodList = []; // Lista para CSV
      
      pSnap.forEach(d => { 
          const p = d.data(); 
          prodList.push(p); // Salva bruto
          if(p.qty > 0) { cost += p.cost * p.qty; if(p.sell) pot += p.sell * p.qty; }
      });
      setRawProducts(prodList);
      
      const mRef = collection(db, `artifacts/${APP_ID}/public/data/movements`);
      const mSnap = await getDocs(query(mRef, where('createdAt', '>=', start), where('createdAt', '<=', end), where('type', '==', 'exit'), where('isExternal', '==', true)));
      let profit = 0; 
      const moveList = []; // Lista para CSV
      
      mSnap.forEach(d => { 
          const m = d.data(); 
          m.calculatedProfit = (m.value - (m.costAtTime * Math.abs(m.delta))); // Calcula lucro individual
          moveList.push(m);
          profit += m.calculatedProfit; 
      });
      setRawMovements(moveList);
      setStockBalance({ currentCost: cost, potentialSale: pot, periodProfit: profit });

      // 2. SERVIÇOS & FOLHA
      const aSnap = await getDocs(query(collection(db, `artifacts/${APP_ID}/public/data/appointments`), where('status', '==', 'finished'), where('date', '>=', start), where('date', '<=', end)));
      let sTotal = 0; const cats = {}; const payMap = {};
      const apptList = []; // Lista para CSV
      
      const uSnap = await getDocs(collection(db, `artifacts/${APP_ID}/public/data/users`)); 
      const uMap = {}; uSnap.forEach(u => uMap[u.id] = u.data());

      aSnap.forEach(d => { 
          const a = d.data(); 
          apptList.push(a); // Salva bruto
          const p = parseFloat(a.price||0); 
          sTotal += p; 
          cats[a.serviceCategory||'Outros'] = (cats[a.serviceCategory||'Outros']||0) + p;
          
          if(a.barberId) { 
              if(!payMap[a.barberId]) payMap[a.barberId] = { id: a.barberId, name: a.barberName, rate: uMap[a.barberId]?.commissionRate||0, total: 0, alreadyPaid: 0 }; // TODO: Add alreadyPaid logic if needed
              payMap[a.barberId].total += (p * (payMap[a.barberId].rate/100)); 
          }
      });
      
      setRawAppointments(apptList);
      setServiceBalance({ total: sTotal, categories: cats }); 
      setPayrollData(Object.values(payMap)); 
      setLoading(false);
    };
    fetchData();
  }, [startDate, endDate, APP_ID]);

  const handleConfirmPayment = async (employee) => {
    if (!canExecutePayout) return alert("Apenas Admin e Financeiro podem realizar pagamentos.");
    if (!confirm(`Confirmar pagamento de ${formatCurrency(employee.total)} para ${employee.name}?`)) return;

    setProcessingPayment(employee.id);
    try {
      await addDoc(collection(db, `artifacts/${APP_ID}/public/data/payouts`), {
        employeeId: employee.id, employeeName: employee.name, amount: employee.total,
        periodStart: startDate, periodEnd: endDate, confirmedBy: user.email, confirmedAt: serverTimestamp()
      });
      alert("Pagamento registrado!");
    } catch (err) { alert(err.message); } finally { setProcessingPayment(null); }
  };

  const handleExportCSV = (type) => {
    if (!canDownloadReports) return alert("Acesso restrito.");

    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'stock') {
        csvContent += "RELATORIO DE ESTOQUE\n\nPRODUTO;QTD;CUSTO UN;TOTAL CUSTO\n";
        rawProducts.forEach(p => {
            if(p.qty > 0) csvContent += `${p.name};${p.qty};${p.cost};${(p.cost*p.qty).toFixed(2)}\n`;
        });
        csvContent += `\nLUCRO REAL NO PERIODO (${startDate} a ${endDate})\nDATA;ITEM;QTD;VENDA;LUCRO\n`;
        rawMovements.forEach(m => {
            csvContent += `${m.createdAt?.toDate().toLocaleDateString()};${m.productName};${m.delta};${m.value};${m.calculatedProfit.toFixed(2)}\n`;
        });
    } else if (type === 'services') {
        csvContent += `RELATORIO DE SERVICOS (${startDate} a ${endDate})\n\nDATA;CLIENTE;SERVICO;PROFISSIONAL;VALOR\n`;
        rawAppointments.forEach(a => {
            csvContent += `${a.dateString};${a.clientName};${a.serviceName};${a.barberName};${a.price}\n`;
        });
        csvContent += `\nTOTAL GERAL;;;;${serviceBalance.total.toFixed(2)}`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_${type}_${shopId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8 pb-12 text-[#F3E5AB]">
      {/* HEADER DE FILTROS */}
      <div className="bg-[#0a0a0a] p-4 rounded-2xl shadow-sm border border-[#222] flex flex-col md:flex-row justify-between items-center gap-4">
        <h2 className="font-bold text-gold font-egyptian text-lg">FINANCEIRO & RELATÓRIOS</h2>
        <div className="flex gap-2 items-center">
            <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="input-field w-auto bg-[#111] border-[#333] text-[#eee]"/>
            <span className="text-[#666] text-xs">até</span>
            <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="input-field w-auto bg-[#111] border-[#333] text-[#eee]"/>
        </div>
      </div>
      
      {loading ? <p className="text-center text-[#666] animate-pulse">Processando dados...</p> : (
        <>
          {/* SEÇÃO 1: ESTOQUE */}
          <div className="bg-[#0a0a0a] rounded-2xl shadow-sm border border-[#222] overflow-hidden">
             <div className="bg-[#111] p-4 border-b border-[#222] flex justify-between items-center">
                <h3 className="font-bold text-[#eee] flex items-center gap-2"><i className="fas fa-boxes text-blue-500"></i> Balança de Estoque</h3>
                {canDownloadReports && (
                    <button onClick={() => handleExportCSV('stock')} className="text-xs font-bold text-black bg-gold hover:bg-white px-3 py-1.5 rounded transition shadow-sm">
                        <i className="fas fa-download mr-1"></i> Baixar CSV
                    </button>
                )}
             </div>
             <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 border border-[#222] rounded-xl bg-[#0a0a0a]">
                    <p className="text-xs font-bold text-[#666] uppercase mb-1">Custo em Estoque</p>
                    <h4 className="text-2xl font-black text-[#eee]">{formatCurrency(stockBalance.currentCost)}</h4>
                </div>
                <div className="p-4 border border-[#222] rounded-xl bg-[#0a0a0a]">
                    <p className="text-xs font-bold text-gold uppercase mb-1">Potencial de Venda</p>
                    <h4 className="text-2xl font-black text-gold">{formatCurrency(stockBalance.potentialSale)}</h4>
                </div>
                <div className="p-4 border border-[#222] rounded-xl bg-[#0a0a0a]">
                    <p className="text-xs font-bold text-green-500 uppercase mb-1">Lucro Líquido (Período)</p>
                    <h4 className="text-2xl font-black text-green-500">{formatCurrency(stockBalance.periodProfit)}</h4>
                </div>
             </div>
          </div>

          {/* SEÇÃO 2: SERVIÇOS */}
          <div className="bg-[#0a0a0a] rounded-2xl shadow-sm border border-[#222] overflow-hidden">
             <div className="bg-[#111] p-4 border-b border-[#222] flex justify-between items-center">
                <h3 className="font-bold text-[#eee] flex items-center gap-2"><i className="fas fa-cut text-purple-500"></i> Balança de Serviços</h3>
                {canDownloadReports && (
                    <button onClick={() => handleExportCSV('services')} className="text-xs font-bold text-black bg-gold hover:bg-white px-3 py-1.5 rounded transition shadow-sm">
                        <i className="fas fa-download mr-1"></i> Baixar CSV
                    </button>
                )}
             </div>
             <div className="p-6">
                <div className="text-center mb-8">
                    <p className="text-sm font-bold text-[#666] uppercase tracking-widest">Faturamento Total</p>
                    <h2 className="text-4xl font-black text-gold mt-2 font-egyptian">{formatCurrency(serviceBalance.total)}</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(serviceBalance.categories).map(([cat, val], idx) => (
                        <div key={idx} className="border border-[#222] rounded-xl p-4 flex flex-col items-center text-center hover:border-gold/30 transition">
                            <span className="text-[10px] font-bold bg-[#222] text-[#888] px-2 py-1 rounded mb-2 uppercase">{cat}</span>
                            <span className="font-bold text-lg text-[#eee]">{formatCurrency(val)}</span>
                        </div>
                    ))}
                </div>
             </div>
          </div>
          
          {/* SEÇÃO 3: FOLHA DE PAGAMENTO (Tabela) */}
          <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-[#222]">
            <h3 className="font-bold text-gold mb-4 border-b border-[#222] pb-2">Folha de Pagamento Estimada</h3>
            <table className="w-full text-sm text-left">
                <thead className="text-[#666] uppercase border-b border-[#333]"><tr><th className="py-2">Nome</th><th>Comissão a Receber</th><th>Ação</th></tr></thead>
                <tbody>
                  {payrollData.map(p => (
                      <tr key={p.id} className="border-b border-[#222] last:border-0 hover:bg-[#111]">
                          <td className="py-3 font-bold text-[#eee]">{p.name}</td>
                          <td className="py-3 text-gold font-bold">{formatCurrency(p.total)}</td>
                          <td className="py-3">
                              {!canExecutePayout ? 
                                  <span className="text-xs bg-[#222] px-2 py-1 rounded text-[#666] border border-[#333]"><i className="fas fa-lock"></i> Restrito</span> 
                                  : <button onClick={() => handleConfirmPayment(p)} disabled={processingPayment === p.id} className="bg-gold text-black px-3 py-1 rounded text-xs font-bold hover:bg-white transition">PAGAR</button>
                              }
                          </td>
                      </tr>
                  ))}
                </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}