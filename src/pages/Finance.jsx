import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { useOutletContext } from 'react-router-dom';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export default function Finance() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId;
  
  // Datas: Padrão é o mês atual
  const date = new Date();
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  
  const [loading, setLoading] = useState(true);
  
  // Estados de Dados
  const [financialMoves, setFinancialMoves] = useState([]); // Entradas e Saídas (Caixa)
  const [payrollData, setPayrollData] = useState([]); // Folha de Pagamento Calculada
  
  // Totais do Período (Cards)
  const [summary, setSummary] = useState({
      income: 0,
      expense: 0,
      balance: 0,
      totalTips: 0 // Total de gorjetas no período
  });

  // Lista de Usuários (Para pegar a % de comissão atualizada)
  const [usersMap, setUsersMap] = useState({});

  useEffect(() => {
    if(!APP_ID) return;
    loadData();
  }, [startDate, endDate, APP_ID]);

  const loadData = async () => {
    setLoading(true);
    try {
        // 1. Buscar Usuários (Para saber a taxa de comissão de cada um)
        const qUsers = query(collection(db, `artifacts/${APP_ID}/public/data/users`));
        const snapUsers = await getDocs(qUsers);
        const uMap = {};
        snapUsers.docs.forEach(d => {
            const u = d.data();
            uMap[d.id] = { 
                name: u.name || u.email, 
                rate: parseFloat(u.commissionRate || 0) 
            };
        });
        setUsersMap(uMap);

        // 2. Buscar Movimentações Financeiras (Caixa Geral)
        const qFin = query(
            collection(db, `artifacts/${APP_ID}/public/data/financial`),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'desc')
        );
        const snapFin = await getDocs(qFin);
        const moves = snapFin.docs.map(d => ({ id: d.id, ...d.data() }));
        setFinancialMoves(moves);

        // 3. Buscar Agendamentos Concluídos (Para cálculo preciso da Folha)
        // Usamos a coleção 'appointments' porque lá temos separado o que é 'price' e o que é 'tip'
        const qAppts = query(
            collection(db, `artifacts/${APP_ID}/public/data/appointments`),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            where('status', '==', 'completed')
        );
        const snapAppts = await getDocs(qAppts);
        const completedAppts = snapAppts.docs.map(d => d.data());

        calculateSummaryAndPayroll(moves, completedAppts, uMap);

    } catch (error) {
        console.error("Erro ao carregar financeiro:", error);
    } finally {
        setLoading(false);
    }
  };

  const calculateSummaryAndPayroll = (moves, appts, uMap) => {
      // --- A. Resumo do Caixa (Cards) ---
      let income = 0;
      let expense = 0;
      
      moves.forEach(m => {
          if(m.type === 'income') income += parseFloat(m.amount);
          if(m.type === 'expense') expense += parseFloat(m.amount);
      });

      // --- B. Cálculo da Folha (Regra: Gorjeta Integral) ---
      const payrollTemp = {};
      let totalTipsPeriod = 0;

      appts.forEach(appt => {
          const bId = appt.barberId;
          if(!bId || !uMap[bId]) return;

          const barberName = uMap[bId].name;
          const commissionRate = uMap[bId].rate; // Ex: 50
          
          const servicePrice = parseFloat(appt.price || 0); // Ex: 80
          const tip = parseFloat(appt.tip || 0); // Ex: 20

          // A REGRA DE OURO:
          // Comissão incide apenas no preço do serviço. A gorjeta é soma pura.
          const commissionValue = servicePrice * (commissionRate / 100); 
          const totalForBarber = commissionValue + tip;

          if(!payrollTemp[bId]) {
              payrollTemp[bId] = { 
                  id: bId, 
                  name: barberName, 
                  serviceTotal: 0, 
                  tipsTotal: 0, 
                  commissionTotal: 0,
                  finalPay: 0,
                  rate: commissionRate
              };
          }

          payrollTemp[bId].serviceTotal += servicePrice;
          payrollTemp[bId].tipsTotal += tip;
          payrollTemp[bId].commissionTotal += commissionValue;
          payrollTemp[bId].finalPay += totalForBarber;

          totalTipsPeriod += tip;
      });

      // Converte objeto em array para a tabela
      const payrollArray = Object.values(payrollTemp);

      setPayrollData(payrollArray);
      setSummary({
          income,
          expense,
          balance: income - expense,
          totalTips: totalTipsPeriod
      });
  };

  if (!['Admin', 'Financeiro'].includes(role)) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <h2 className="text-2xl font-bold text-red-500">Acesso Restrito</h2>
        <p className="text-[#666]">Painel exclusivo para administração financeira.</p>
    </div>
  );

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">FINANCEIRO</h2>
            <p className="text-[#666] text-sm">Fluxo de caixa e comissões</p>
        </div>
        
        {/* Filtro de Data */}
        <div className="flex items-center gap-2 bg-[#111] p-2 rounded-xl border border-[#222]">
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-white text-xs outline-none" />
            <span className="text-[#666]">-</span>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-white text-xs outline-none" />
            <button onClick={loadData} className="bg-gold text-black px-3 py-1 rounded text-xs font-bold hover:bg-white transition"><i className="fas fa-search"></i></button>
        </div>
      </div>

      {loading ? (
           <div className="text-center py-20 text-[#666] animate-pulse">Calculando balanço...</div>
      ) : (
          <div className="space-y-8">
            
            {/* 1. CARDS DE RESUMO */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                    <p className="text-[10px] font-bold text-[#666] uppercase mb-1">Entradas (Total)</p>
                    <p className="text-2xl font-black text-green-500">{formatCurrency(summary.income)}</p>
                </div>
                <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                    <p className="text-[10px] font-bold text-[#666] uppercase mb-1">Saídas</p>
                    <p className="text-2xl font-black text-red-500">{formatCurrency(summary.expense)}</p>
                </div>
                <div className="bg-[#111] p-5 rounded-2xl border border-[#333]">
                    <p className="text-[10px] font-bold text-[#666] uppercase mb-1">Saldo Líquido</p>
                    <p className={`text-2xl font-black ${summary.balance >= 0 ? 'text-blue-400' : 'text-red-500'}`}>{formatCurrency(summary.balance)}</p>
                </div>
                <div className="bg-[#111] p-5 rounded-2xl border border-gold/30 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><i className="fas fa-coins text-4xl text-gold"></i></div>
                    <p className="text-[10px] font-bold text-gold uppercase mb-1">Total de Gorjetas</p>
                    <p className="text-2xl font-black text-gold">{formatCurrency(summary.totalTips)}</p>
                    <p className="text-[9px] text-[#888]">Repasse integral à equipe</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 2. FOLHA DE PAGAMENTO (CÁLCULO CORRIGIDO) */}
                <div className="bg-[#111] rounded-2xl border border-[#333] overflow-hidden flex flex-col h-full">
                    <div className="p-5 border-b border-[#222] flex justify-between items-center">
                        <h3 className="font-bold text-[#eee]">Folha de Pagamento Estimada</h3>
                        <span className="text-[10px] bg-blue-900/20 text-blue-400 px-2 py-1 rounded">Baseada em {startDate.slice(5)}</span>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-[#0a0a0a] text-[#666] uppercase text-[10px]">
                                <tr>
                                    <th className="p-4">Profissional</th>
                                    <th className="p-4 text-center">Serviços</th>
                                    <th className="p-4 text-center">Comissão</th>
                                    <th className="p-4 text-center text-gold">Gorjetas</th>
                                    <th className="p-4 text-right">Total a Pagar</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#222]">
                                {payrollData.length === 0 && (
                                    <tr><td colSpan="5" className="p-8 text-center text-[#444]">Nenhum serviço computado neste período.</td></tr>
                                )}
                                {payrollData.map(p => (
                                    <tr key={p.id} className="hover:bg-[#161616] transition">
                                        <td className="p-4">
                                            <div className="font-bold text-[#eee]">{p.name}</div>
                                            <div className="text-[10px] text-[#666]">Taxa: {p.rate}%</div>
                                        </td>
                                        <td className="p-4 text-center text-[#888]">{formatCurrency(p.serviceTotal)}</td>
                                        <td className="p-4 text-center text-[#ccc] font-bold">
                                            {formatCurrency(p.commissionTotal)}
                                        </td>
                                        <td className="p-4 text-center text-gold font-bold bg-gold/5">
                                            {formatCurrency(p.tipsTotal)}
                                        </td>
                                        <td className="p-4 text-right font-black text-green-400 text-base">
                                            {formatCurrency(p.finalPay)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-[#0a0a0a] text-[10px] text-[#555] border-t border-[#222] mt-auto">
                        * Cálculo: (Serviços x Taxa%) + 100% das Gorjetas.
                    </div>
                </div>

                {/* 3. EXTRATO DE MOVIMENTAÇÕES */}
                <div className="bg-[#111] rounded-2xl border border-[#333] overflow-hidden flex flex-col h-full">
                    <div className="p-5 border-b border-[#222]">
                        <h3 className="font-bold text-[#eee]">Extrato do Caixa</h3>
                    </div>
                    <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
                        {financialMoves.length === 0 && (
                            <div className="p-8 text-center text-[#444]">Nenhuma movimentação registrada.</div>
                        )}
                        {financialMoves.map(move => (
                            <div key={move.id} className="p-4 border-b border-[#222] flex justify-between items-center hover:bg-[#161616]">
                                <div>
                                    <p className="text-sm font-bold text-[#eee]">{move.description}</p>
                                    <p className="text-[10px] text-[#666] uppercase">{new Date(move.createdAt?.seconds * 1000).toLocaleDateString()} • {move.paymentMethod}</p>
                                </div>
                                <div className={`font-bold ${move.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                                    {move.type === 'income' ? '+' : '-'}{formatCurrency(move.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
          </div>
      )}
    </div>
  );
}