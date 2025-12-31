import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, addDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function Finance() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId;
  
  // Segurança
  if (!['Admin', 'Financeiro'].includes(role)) return <div className="p-10 text-center text-red-500">Acesso Restrito</div>;

  // --- DATAS E ESTADOS ---
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [loading, setLoading] = useState(true);
  
  // Abas
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'payroll', 'reports'

  // Dados Carregados
  const [financialMoves, setFinancialMoves] = useState([]); 
  const [allAppointments, setAllAppointments] = useState([]); 
  const [servicesMap, setServicesMap] = useState({}); // Mapa para saber a Categoria dos serviços
  
  // Dados Calculados
  const [payrollData, setPayrollData] = useState([]); 
  const [paymentHistory, setPaymentHistory] = useState([]); 
  const [summary, setSummary] = useState({ income: 0, expense: 0, balance: 0, totalTips: 0 });

  // Modais
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(null);

  // Form Genérico
  const [formEntry, setFormEntry] = useState({ description: '', amount: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    if(!APP_ID) return;
    loadData();
  }, [startDate, endDate, APP_ID]);

  const loadData = async () => {
    setLoading(true);
    try {
        // 1. Buscar Categorias dos Serviços (Para o CSV)
        const qServices = query(collection(db, `artifacts/${APP_ID}/public/data/services`));
        const snapServices = await getDocs(qServices);
        const sMap = {};
        snapServices.docs.forEach(d => {
            const s = d.data();
            // Mapeia ID ou Nome para a Categoria
            sMap[s.name] = s.category || 'Geral';
            sMap[d.id] = s.category || 'Geral'; 
        });
        setServicesMap(sMap);

        // 2. Usuários (Taxas de Comissão)
        const qUsers = query(collection(db, `artifacts/${APP_ID}/public/data/users`));
        const snapUsers = await getDocs(qUsers);
        const uMap = {};
        snapUsers.docs.forEach(d => {
            const u = d.data();
            uMap[d.id] = { name: u.name || u.email, rate: parseFloat(u.commissionRate || 50) };
        });

        // 3. Movimentações Financeiras
        const qFin = query(
            collection(db, `artifacts/${APP_ID}/public/data/financial`),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const snapFin = await getDocs(qFin);
        const moves = snapFin.docs.map(d => ({ id: d.id, ...d.data() }));
        setFinancialMoves(moves);
        
        // Separa histórico de pagamentos de comissão
        setPaymentHistory(moves.filter(m => m.category === 'Pagamento Comissão'));

        // 4. Agendamentos (Trazemos TODOS para relatórios)
        const qAppts = query(
            collection(db, `artifacts/${APP_ID}/public/data/appointments`),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        );
        const snapAppts = await getDocs(qAppts);
        const appts = snapAppts.docs.map(d => d.data());
        setAllAppointments(appts);

        // Filtra apenas concluídos para o cálculo financeiro
        const completedAppts = appts.filter(a => a.status === 'completed');

        calculateSummaryAndPayroll(moves, completedAppts, uMap);

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
    } finally {
        setLoading(false);
    }
  };

  const calculateSummaryAndPayroll = (moves, appts, uMap) => {
      let income = 0, expense = 0;
      moves.forEach(m => {
          if(m.type === 'income') income += parseFloat(m.amount);
          if(m.type === 'expense') expense += parseFloat(m.amount);
      });

      // Cálculo da Folha
      const payrollTemp = {};
      let totalTipsPeriod = 0;

      appts.forEach(appt => {
          const bId = appt.barberId;
          if(!bId || !uMap[bId]) return;

          const commissionRate = uMap[bId].rate;
          const servicePrice = parseFloat(appt.price || 0);
          const tip = parseFloat(appt.tip || 0);
          
          const commissionValue = servicePrice * (commissionRate / 100); 
          const totalForBarber = commissionValue + tip;

          if(!payrollTemp[bId]) {
              payrollTemp[bId] = { 
                  id: bId, name: uMap[bId].name, serviceTotal: 0, tipsTotal: 0, 
                  commissionTotal: 0, grossPay: 0, paidAlready: 0, rate: commissionRate
              };
          }
          payrollTemp[bId].serviceTotal += servicePrice;
          payrollTemp[bId].tipsTotal += tip;
          payrollTemp[bId].commissionTotal += commissionValue;
          payrollTemp[bId].grossPay += totalForBarber;
          totalTipsPeriod += tip;
      });

      // Abater pagamentos já feitos no período
      moves.forEach(m => {
          if (m.type === 'expense' && m.category === 'Pagamento Comissão' && m.barberId && payrollTemp[m.barberId]) {
              payrollTemp[m.barberId].paidAlready += parseFloat(m.amount);
          }
      });

      setPayrollData(Object.values(payrollTemp));
      setSummary({ income, expense, balance: income - expense, totalTips: totalTipsPeriod });
  };

  // --- RELATÓRIOS INTELIGENTES (SERVIÇOS) ---
  const serviceStats = useMemo(() => {
      const stats = {};
      
      allAppointments.forEach(appt => {
          const sName = appt.serviceName || 'Outros';
          const sId = appt.serviceId;
          
          if (!stats[sName]) {
              stats[sName] = {
                  name: sName,
                  category: servicesMap[sName] || servicesMap[sId] || 'Geral',
                  totalRevenue: 0,
                  countScheduled: 0, // Total (inclui cancelados)
                  countFinished: 0, // Só completados
                  paymentMethods: {},
                  barbers: {},
                  unitPrice: appt.price || 0
              };
          }
          
          // Contagem de Agendados (Todos que estão no banco nesse período)
          stats[sName].countScheduled += 1;
          
          if (appt.status === 'completed') {
              stats[sName].countFinished += 1;
              stats[sName].totalRevenue += parseFloat(appt.price || 0);
              
              const pm = appt.paymentMethod || 'N/A';
              stats[sName].paymentMethods[pm] = (stats[sName].paymentMethods[pm] || 0) + 1;
              
              const bn = appt.barberName || 'N/A';
              stats[sName].barbers[bn] = (stats[sName].barbers[bn] || 0) + 1;
          }
      });

      const list = Object.values(stats);
      // Top 5 Lucrativos (Receita Total)
      const topProfitable = [...list].sort((a,b) => b.totalRevenue - a.totalRevenue).slice(0, 5);
      const leastProfitable = [...list].sort((a,b) => a.totalRevenue - b.totalRevenue).slice(0, 5);
      
      return { list, topProfitable, leastProfitable };
  }, [allAppointments, servicesMap]);

  // --- EXPORTAR CSVs ---
  const downloadCSV = (content, filename) => {
      const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
  };

  const exportServicesCSV = () => {
      let csv = "Servico,Categoria,Preco Unit,Total Receita,Qtd Agendada,Qtd Finalizada,Pagto Predominante,Top Funcionario\n";
      serviceStats.list.forEach(s => {
          // Encontra o mais frequente
          const topPm = Object.keys(s.paymentMethods).reduce((a, b) => s.paymentMethods[a] > s.paymentMethods[b] ? a : b, '-');
          const topBarber = Object.keys(s.barbers).reduce((a, b) => s.barbers[a] > s.barbers[b] ? a : b, '-');
          
          csv += `"${s.name}","${s.category}",${s.unitPrice},${s.totalRevenue},${s.countScheduled},${s.countFinished},${topPm},${topBarber}\n`;
      });
      downloadCSV(csv, `Relatorio_Servicos_${startDate}.csv`);
  };

  const exportPayrollHistoryCSV = () => {
      let csv = "Data,Hora,Funcionario,Valor Pago,Referencia Periodo,Pago Por\n";
      paymentHistory.forEach(p => {
          const d = new Date(p.createdAt?.seconds * 1000 || new Date());
          csv += `${d.toLocaleDateString()},${d.toLocaleTimeString()},"${p.description.replace('Pagamento: ', '')}",${p.amount},"${p.refPeriod || 'Avulso'}",${p.paidBy || 'Admin'}\n`;
      });
      downloadCSV(csv, `Historico_Pagamentos_${startDate}.csv`);
  };

  const exportExtractCSV = () => {
      let csv = "Data,Tipo,Categoria,Descricao,Valor,Usuario\n";
      financialMoves.forEach(m => {
          csv += `${m.date},${m.type === 'income' ? 'Entrada' : 'Saída'},${m.category},"${m.description}",${m.amount},${m.user || 'Admin'}\n`;
      });
      downloadCSV(csv, `Extrato_${startDate}.csv`);
  };

  // --- HANDLERS ---
  const handleNewTransaction = async (type) => {
      try {
          await addDoc(collection(db, `artifacts/${APP_ID}/public/data/financial`), {
              type: type,
              category: formEntry.category,
              description: formEntry.description,
              amount: parseFloat(formEntry.amount),
              date: formEntry.date,
              user: auth.currentUser?.email,
              createdAt: serverTimestamp()
          });
          setShowExpenseModal(false); setShowIncomeModal(false);
          setFormEntry({ description: '', amount: '', category: 'Outros', date: new Date().toISOString().split('T')[0] });
          loadData();
      } catch (err) { alert("Erro ao salvar."); }
  };

  const handlePayBarber = async (barber) => {
      const remaining = barber.grossPay - barber.paidAlready;
      if (remaining <= 0) return alert("Sem saldo pendente para o período selecionado.");

      const amountStr = prompt(`Saldo Restante: ${formatCurrency(remaining)}\nValor a pagar:`, remaining);
      if (!amountStr) return;
      
      // Dinâmica de Período (Requisito 3)
      const refPeriod = prompt("Referente a qual período? (Ex: 15 dias, 30 dias, Semanal)", "15 dias");
      
      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount <= 0) return alert("Valor inválido.");

      try {
          await addDoc(collection(db, `artifacts/${APP_ID}/public/data/financial`), {
              type: 'expense',
              category: 'Pagamento Comissão',
              description: `Pagamento: ${barber.name}`,
              amount: amount,
              refPeriod: refPeriod || 'Avulso',
              paidBy: auth.currentUser?.email || 'Admin',
              date: new Date().toISOString().split('T')[0],
              barberId: barber.id,
              createdAt: serverTimestamp()
          });

          setShowReceiptModal({
              name: barber.name,
              amount: amount,
              date: new Date().toLocaleDateString('pt-BR'),
              ref: refPeriod || 'Avulso',
              services: `${barber.rate}% Com. + Gorjetas`,
              paidBy: auth.currentUser?.displayName || auth.currentUser?.email || 'Admin'
          });
          loadData();
      } catch (err) { alert("Erro ao pagar."); }
  };

  // --- RENDER ---
  return (
    <div className="animate-fade-in pb-20 p-4 md:p-8 text-[#eee]">
      
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">FINANCEIRO</h2>
            <p className="text-[#666] text-sm">Controle de caixa, comissões e relatórios</p>
        </div>
        <div className="flex items-center gap-2 bg-[#111] p-2 rounded-xl border border-[#222]">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-xs outline-none" />
            <span className="text-[#666]">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-xs outline-none" />
            <button onClick={loadData} className="bg-gold text-black px-3 py-1 rounded text-xs font-bold hover:bg-white transition"><i className="fas fa-search"></i></button>
        </div>
      </div>

      {/* Navegação */}
      <div className="flex gap-4 border-b border-[#222] mb-6 overflow-x-auto">
          <button onClick={() => setActiveTab('dashboard')} className={`pb-2 px-2 text-sm font-bold whitespace-nowrap ${activeTab === 'dashboard' ? 'text-gold border-b-2 border-gold' : 'text-gray-500'}`}>DASHBOARD & EXTRATO</button>
          <button onClick={() => setActiveTab('payroll')} className={`pb-2 px-2 text-sm font-bold whitespace-nowrap ${activeTab === 'payroll' ? 'text-gold border-b-2 border-gold' : 'text-gray-500'}`}>FOLHA DE PAGAMENTO</button>
          <button onClick={() => setActiveTab('reports')} className={`pb-2 px-2 text-sm font-bold whitespace-nowrap ${activeTab === 'reports' ? 'text-gold border-b-2 border-gold' : 'text-gray-500'}`}>RELATÓRIO DE SERVIÇOS</button>
      </div>

      {loading ? <div className="text-center py-20 text-[#666] animate-pulse">Carregando dados...</div> : (
          <div>
            
            {/* --- ABA 1: DASHBOARD --- */}
            {activeTab === 'dashboard' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                            <p className="text-[10px] font-bold text-[#666] uppercase">Entradas</p>
                            <p className="text-2xl font-black text-green-500">{formatCurrency(summary.income)}</p>
                        </div>
                        <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                            <p className="text-[10px] font-bold text-[#666] uppercase">Saídas</p>
                            <p className="text-2xl font-black text-red-500">{formatCurrency(summary.expense)}</p>
                        </div>
                        <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                            <p className="text-[10px] font-bold text-[#666] uppercase">Saldo</p>
                            <p className={`text-2xl font-black ${summary.balance >= 0 ? 'text-blue-400' : 'text-red-500'}`}>{formatCurrency(summary.balance)}</p>
                        </div>
                        <div className="bg-[#111] p-5 rounded-2xl border border-gold/30">
                            <p className="text-[10px] font-bold text-gold uppercase">Gorjetas (Repasse)</p>
                            <p className="text-2xl font-black text-gold">{formatCurrency(summary.totalTips)}</p>
                        </div>
                    </div>

                    <div className="bg-[#111] rounded-2xl border border-[#333] overflow-hidden flex flex-col h-full">
                        <div className="p-4 border-b border-[#222] flex justify-between items-center bg-[#0a0a0a]">
                            <h3 className="font-bold text-[#eee]">Extrato Detalhado</h3>
                            <div className="flex gap-2">
                                <button onClick={() => { setFormEntry({category: 'Investimento', description: '', amount: '', date: new Date().toISOString().split('T')[0]}); setShowIncomeModal(true); }} className="text-xs bg-green-900/20 text-green-400 border border-green-900 px-3 py-1 rounded hover:bg-green-900 hover:text-white transition">+ Novo Recebimento</button>
                                <button onClick={() => { setFormEntry({category: 'Despesa Fixa', description: '', amount: '', date: new Date().toISOString().split('T')[0]}); setShowExpenseModal(true); }} className="text-xs bg-red-900/20 text-red-400 border border-red-900 px-3 py-1 rounded hover:bg-red-900 hover:text-white transition">- Nova Despesa</button>
                                <button onClick={exportExtractCSV} className="text-xs bg-[#333] text-white border border-[#555] px-3 py-1 rounded hover:bg-[#555]"><i className="fas fa-file-csv"></i> CSV</button>
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-[500px] custom-scrollbar">
                            {financialMoves.length === 0 && <div className="p-8 text-center text-[#444]">Nenhuma movimentação.</div>}
                            {financialMoves.map(move => (
                                <div key={move.id} className="p-4 border-b border-[#222] flex justify-between items-center hover:bg-[#161616]">
                                    <div>
                                        <p className="text-sm font-bold text-[#eee]">{move.description}</p>
                                        <p className="text-[10px] text-[#666] uppercase">{new Date(move.createdAt?.seconds * 1000 || new Date()).toLocaleDateString()} • {move.category}</p>
                                    </div>
                                    <span className={`font-bold ${move.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                        {move.type === 'income' ? '+' : '-'}{formatCurrency(move.amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* --- ABA 2: PAYROLL --- */}
            {activeTab === 'payroll' && (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {payrollData.map(p => {
                            const remaining = p.grossPay - p.paidAlready;
                            return (
                                <div key={p.id} className="bg-[#111] p-6 rounded-xl border border-[#333] hover:border-gold transition">
                                    <h3 className="font-bold text-white text-lg mb-1">{p.name}</h3>
                                    <p className="text-xs text-gray-500 mb-4">{p.rate}% Comissão</p>
                                    <div className="space-y-1 text-sm text-gray-400 mb-4">
                                        <div className="flex justify-between"><span>Produção:</span> <span>{formatCurrency(p.serviceTotal)}</span></div>
                                        <div className="flex justify-between"><span>Gorjetas:</span> <span className="text-gold">{formatCurrency(p.tipsTotal)}</span></div>
                                        <div className="flex justify-between"><span>Total Bruto:</span> <span>{formatCurrency(p.grossPay)}</span></div>
                                        <div className="flex justify-between text-red-400"><span>Já Pago:</span> <span>-{formatCurrency(p.paidAlready)}</span></div>
                                    </div>
                                    <div className="flex justify-between items-center mb-4 pt-2 border-t border-[#222]">
                                        <span className="font-bold text-white uppercase text-xs">A Pagar</span>
                                        <span className="font-black text-xl text-green-400">{formatCurrency(remaining > 0 ? remaining : 0)}</span>
                                    </div>
                                    <button onClick={() => handlePayBarber(p)} disabled={remaining <= 0} className={`w-full py-2 rounded font-bold text-sm ${remaining > 0 ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-[#222] text-[#444]'}`}>
                                        PAGAR SALDO
                                    </button>
                                </div>
                            )
                        })}
                    </div>

                    <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
                        <div className="p-4 bg-[#0a0a0a] border-b border-[#222] flex justify-between items-center">
                            <h3 className="font-bold text-[#eee]">Histórico de Pagamentos de Salário</h3>
                            <button onClick={exportPayrollHistoryCSV} className="text-xs bg-[#333] text-white border border-[#555] px-3 py-1 rounded hover:bg-[#555]"><i className="fas fa-file-csv"></i> Exportar Histórico</button>
                        </div>
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#000] text-[#666] uppercase text-[10px]">
                                <tr><th className="p-4">Data</th><th className="p-4">Funcionário</th><th className="p-4">Referência</th><th className="p-4">Pago Por</th><th className="p-4 text-right">Valor</th></tr>
                            </thead>
                            <tbody className="divide-y divide-[#222]">
                                {paymentHistory.length === 0 && <tr><td colSpan="5" className="p-8 text-center text-[#444]">Nenhum pagamento neste período.</td></tr>}
                                {paymentHistory.map(h => (
                                    <tr key={h.id} className="hover:bg-[#161616]">
                                        <td className="p-4 text-gray-500">{new Date(h.createdAt?.seconds * 1000 || new Date()).toLocaleString()}</td>
                                        <td className="p-4 font-bold text-white">{h.description.replace('Pagamento: ', '')}</td>
                                        <td className="p-4 text-xs text-blue-400">{h.refPeriod || 'Avulso'}</td>
                                        <td className="p-4 text-xs text-gray-500">{h.paidBy || '-'}</td>
                                        <td className="p-4 text-right font-mono text-red-400 font-bold">-{formatCurrency(h.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* --- ABA 3: RELATÓRIOS (NOVO) --- */}
            {activeTab === 'reports' && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gold">Análise de Serviços</h3>
                        <button onClick={exportServicesCSV} className="bg-green-900/20 text-green-400 border border-green-900 px-4 py-2 rounded font-bold hover:bg-green-900 hover:text-white transition"><i className="fas fa-file-csv mr-2"></i> CSV Detalhado</button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                            <h4 className="text-green-400 font-bold mb-4 uppercase text-xs tracking-widest border-b border-[#222] pb-2">Top 5 Mais Lucrativos</h4>
                            {serviceStats.topProfitable.map((s, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-[#222] last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-600 font-black text-lg">#{i+1}</span>
                                        <div>
                                            <p className="font-bold text-white">{s.name}</p>
                                            <p className="text-[10px] text-gray-500">{s.countFinished} realizados</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-green-500 font-bold">{formatCurrency(s.totalRevenue)}</span>
                                </div>
                            ))}
                        </div>
                        <div className="bg-[#111] p-6 rounded-xl border border-[#333]">
                            <h4 className="text-red-400 font-bold mb-4 uppercase text-xs tracking-widest border-b border-[#222] pb-2">Top 5 Menos Lucrativos</h4>
                            {serviceStats.leastProfitable.map((s, i) => (
                                <div key={i} className="flex justify-between items-center py-2 border-b border-[#222] last:border-0">
                                    <div className="flex items-center gap-3">
                                        <span className="text-gray-600 font-black text-lg">#{i+1}</span>
                                        <div>
                                            <p className="font-bold text-white">{s.name}</p>
                                            <p className="text-[10px] text-gray-500">{s.countFinished} realizados</p>
                                        </div>
                                    </div>
                                    <span className="font-mono text-gray-400 font-bold">{formatCurrency(s.totalRevenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
          </div>
      )}

      {/* --- MODAIS --- */}
      {(showIncomeModal || showExpenseModal) && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#111] w-full max-w-md rounded-2xl border border-[#333] p-6 shadow-2xl animate-scale-in">
                  <h3 className={`text-lg font-bold mb-4 ${showIncomeModal ? 'text-green-400' : 'text-red-400'}`}>
                      {showIncomeModal ? 'Registrar Recebimento Extra' : 'Registrar Despesa'}
                  </h3>
                  <div className="space-y-3">
                      <input className="input-field" placeholder="Descrição" value={formEntry.description} onChange={e => setFormEntry({...formEntry, description: e.target.value})} />
                      <div className="grid grid-cols-2 gap-3">
                          <input type="number" step="0.01" className="input-field" placeholder="R$ Valor" value={formEntry.amount} onChange={e => setFormEntry({...formEntry, amount: e.target.value})} />
                          <input type="date" className="input-field" value={formEntry.date} onChange={e => setFormEntry({...formEntry, date: e.target.value})} />
                      </div>
                      <select className="input-field" value={formEntry.category} onChange={e => setFormEntry({...formEntry, category: e.target.value})}>
                          {showIncomeModal ? (
                              <><option>Investimento</option><option>Bonificação</option><option>Parceria</option><option>Outros</option></>
                          ) : (
                              <><option>Despesa Fixa</option><option>Despesa Variável</option><option>Manutenção</option><option>Pró-Labore</option><option>Outros</option></>
                          )}
                      </select>
                      <div className="flex gap-2 pt-2">
                          <button onClick={() => {setShowExpenseModal(false); setShowIncomeModal(false)}} className="flex-1 py-2 text-gray-500 hover:text-white">Cancelar</button>
                          <button onClick={() => handleNewTransaction(showIncomeModal ? 'income' : 'expense')} className={`flex-1 rounded font-bold ${showIncomeModal ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>Confirmar</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {showReceiptModal && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
              <div className="bg-white text-black w-full max-w-sm rounded p-8 shadow-2xl relative animate-scale-in font-mono">
                  <button onClick={() => setShowReceiptModal(null)} className="absolute top-2 right-2 text-gray-400 hover:text-black print:hidden"><i className="fas fa-times"></i></button>
                  <div className="text-center border-b-2 border-black pb-4 mb-4 border-dashed">
                      <h2 className="text-2xl font-black uppercase tracking-widest">ABDUCH</h2>
                      <p className="text-xs">RECIBO DE PAGAMENTO</p>
                  </div>
                  <div className="space-y-2 text-sm mb-6">
                      <div className="flex justify-between"><span>Beneficiário:</span><span className="font-bold">{showReceiptModal.name}</span></div>
                      <div className="flex justify-between"><span>Data Emissão:</span><span>{showReceiptModal.date}</span></div>
                      <div className="flex justify-between"><span>Referência:</span><span>{showReceiptModal.ref}</span></div>
                      <div className="flex justify-between border-t pt-2 mt-2"><span>Pago Por:</span><span className="font-bold">{showReceiptModal.paidBy}</span></div>
                  </div>
                  <div className="text-center border-y-2 border-black py-4 mb-8 border-dashed">
                      <p className="text-xs uppercase mb-1">Valor Líquido</p>
                      <p className="text-3xl font-bold">{formatCurrency(showReceiptModal.amount)}</p>
                  </div>
                  <div className="text-center mt-12">
                      <div className="border-b border-black w-3/4 mx-auto mb-2"></div>
                      <p className="text-[10px] uppercase">Assinatura</p>
                  </div>
                  <button onClick={() => window.print()} className="mt-8 w-full bg-black text-white py-3 font-bold uppercase print:hidden hover:bg-gray-800">Imprimir</button>
              </div>
          </div>
      )}
    </div>
  );
}