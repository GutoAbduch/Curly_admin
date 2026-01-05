import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase'; 
import { collection, onSnapshot, doc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useOutletContext } from 'react-router-dom';
import { CheckCircle, XCircle, Edit, Trash2, Key, ShieldAlert, Users as UsersIcon } from 'lucide-react';
import { PLAN_LIMITS } from '../config/plans'; // Importa os limites

export default function Users() {
  const { role, shopId, storePlan } = useOutletContext();
  const APP_ID = shopId;

  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ role: 'User', level: '', commissionRate: 0 });
  const [saving, setSaving] = useState(false);

  const canManageTeam = ['Admin', 'Gerente'].includes(role);
  const canDeleteUser = role === 'Admin';

  if (!canManageTeam) return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] border border-[#222] rounded-xl">
          <ShieldAlert className="text-red-500 w-12 h-12 mb-4" />
          <h2 className="text-2xl font-bold text-[#eee]">Acesso Restrito</h2>
          <p className="text-[#666]">Apenas a gerência pode acessar os dados da equipe.</p>
      </div>
  );

  useEffect(() => {
    if(!APP_ID) return;
    const q = query(collection(db, `artifacts/${APP_ID}/public/data/users`), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [APP_ID]);

  const pendingUsers = users.filter(u => u.role === 'pending');
  const activeUsers = users.filter(u => u.role !== 'pending');

  // CONTAGEM DE FUNCIONÁRIOS (Sem contar Admin)
  const currentEmployeeCount = activeUsers.filter(u => u.role !== 'Admin' && u.role !== 'User').length;
  // User comum (Cliente) geralmente não conta, mas ajustamos aqui para contar STAFF (Barbeiro, Gerente, Financeiro)
  // Se você quiser contar TODOS menos o Admin, use: activeUsers.filter(u => u.role !== 'Admin').length
  
  const planInfo = PLAN_LIMITS[storePlan || 'Starter'];

  const handleEdit = (user) => {
      // --- LÓGICA DE BLOQUEIO DE PLANO ---
      // Se for aprovar alguém que está pendente (ou seja, vai virar funcionário)
      if (user.role === 'pending') {
          if (currentEmployeeCount >= planInfo.maxEmployees) {
              alert(`LIMITE ATINGIDO!\n\nO plano ${storePlan} permite no máximo ${planInfo.maxEmployees} funcionários (exceto o dono).\nVocê já possui ${currentEmployeeCount}.\n\nFaça um Upgrade para expandir a equipe.`);
              return;
          }
      }

      setEditingUser(user);
      // Se for pendente, sugerimos 'Barbeiro' por padrão
      const initialRole = user.role === 'pending' ? 'Barbeiro' : (user.role || 'User');
      
      setFormData({ 
          role: initialRole, 
          level: user.level || '', 
          commissionRate: user.commissionRate || 0 
      });
  };

  const handleLevelChange = (lvl) => {
      let rate = 0;
      switch(lvl) {
          case 'Auxiliar': rate = 40; break;
          case 'Barbeiro I': rate = 45; break;
          case 'Barbeiro II': rate = 50; break;
          case 'Barbeiro III': rate = 55; break;
          case 'Barbeiro IV': rate = 65; break;
          case 'Gerente': rate = 100; break;
          default: rate = 0;
      }
      setFormData({ ...formData, level: lvl, commissionRate: rate });
  };

  const handleRoleChange = (newRole) => {
      if (!['Barbeiro', 'Gerente'].includes(newRole)) {
          setFormData({ role: newRole, level: '', commissionRate: 0 });
      } else {
          setFormData({ ...formData, role: newRole });
      }
  };

  const handleUpdateUser = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
          await updateDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, editingUser.id), {
              role: formData.role,
              level: formData.level,
              commissionRate: formData.commissionRate
          });
          setEditingUser(null);
          alert("Usuário atualizado com sucesso!");
      } catch (error) {
          alert("Erro ao atualizar: " + error.message);
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async (id, isReject = false) => {
      if(!window.confirm(isReject ? "Recusar solicitação?" : "Remover usuário?")) return;
      try {
          await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, id));
      } catch (error) { alert("Erro ao excluir."); }
  };

  const sendResetPassword = async (email) => {
      if(!window.confirm(`Enviar e-mail de redefinição para ${email}?`)) return;
      try { await sendPasswordResetEmail(auth, email); alert("E-mail enviado!"); } 
      catch (error) { alert("Erro: " + error.message); }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8 flex justify-between items-end">
        <div>
            <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">EQUIPE</h2>
            <p className="text-[#666] text-sm">Gerencie permissões e comissões</p>
        </div>
        
        {/* Mostrador de Limite do Plano */}
        <div className="bg-[#111] px-4 py-2 rounded-lg border border-[#333] flex flex-col items-end">
            <span className="text-[10px] text-[#666] uppercase font-bold">Capacidade do Plano {storePlan}</span>
            <div className={`text-lg font-bold flex items-center gap-2 ${currentEmployeeCount >= planInfo.maxEmployees ? 'text-red-500' : 'text-gold'}`}>
                <UsersIcon className="w-4 h-4" />
                {currentEmployeeCount} / {storePlan === 'Black' ? '∞' : planInfo.maxEmployees}
            </div>
        </div>
      </div>

      {/* --- SOLICITAÇÕES PENDENTES --- */}
      {pendingUsers.length > 0 && (
        <div className="mb-10 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <h3 className="text-gold font-bold text-sm uppercase tracking-widest">Solicitações de Acesso ({pendingUsers.length})</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pendingUsers.map(u => (
                    <div key={u.id} className="bg-yellow-900/10 border border-yellow-500/30 p-5 rounded-xl flex flex-col relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-2 bg-yellow-500/20 rounded-bl-xl">
                            <span className="text-[10px] text-yellow-500 font-bold uppercase">Novo Cadastro</span>
                        </div>
                        <h3 className="text-lg font-bold text-[#eee]">{u.name}</h3>
                        <p className="text-xs text-[#888] mb-1">{u.email}</p>
                        <p className="text-xs text-[#888] mb-4">Cel: {u.phone}</p>
                        <div className="mt-auto flex gap-2">
                            <button onClick={() => handleEdit(u)} className="flex-1 bg-green-900/20 border border-green-900/50 text-green-500 py-2 rounded text-xs font-bold hover:bg-green-500 hover:text-black transition flex items-center justify-center gap-1">
                                <CheckCircle className="w-4 h-4" /> APROVAR
                            </button>
                            <button onClick={() => handleDelete(u.id, true)} className="flex-1 bg-red-900/20 border border-red-900/50 text-red-500 py-2 rounded text-xs font-bold hover:bg-red-500 hover:text-black transition flex items-center justify-center gap-1">
                                <XCircle className="w-4 h-4" /> RECUSAR
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      )}

      {/* --- EQUIPE ATIVA --- */}
      <div className="mb-4">
          <h3 className="text-[#666] font-bold text-xs uppercase tracking-widest border-b border-[#222] pb-2 mb-4">Membros Ativos</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeUsers.map(u => (
              <div key={u.id} className="bg-[#111] p-5 rounded-xl border border-[#333] hover:border-gold transition group">
                  <div className="flex justify-between items-start mb-4">
                      <div className="h-12 w-12 rounded-full bg-[#0a0a0a] border border-[#222] flex items-center justify-center text-gold text-xl font-black">
                          {u.name?.charAt(0) || u.email?.charAt(0)}
                      </div>
                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'Admin' ? 'bg-red-900/30 text-red-500' : 'bg-[#222] text-[#888]'}`}>
                          {u.role}
                      </span>
                  </div>
                  <h3 className="text-lg font-bold text-[#eee]">{u.name || 'Sem Nome'}</h3>
                  <p className="text-xs text-[#666] mb-4">{u.email}</p>

                  {['Barbeiro', 'Gerente'].includes(u.role) && (
                      <div className="bg-[#050505] p-3 rounded mb-4 border border-[#222]">
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#666]">Nível:</span><span className="text-[#eee] font-bold">{u.level || '-'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                              <span className="text-[#666]">Comissão:</span><span className="text-gold font-bold">{u.commissionRate}%</span>
                          </div>
                      </div>
                  )}

                  <div className="flex gap-2 mt-auto">
                      <button onClick={() => handleEdit(u)} className="flex-1 bg-[#222] text-[#ccc] py-2 rounded text-xs font-bold hover:bg-gold hover:text-black transition flex items-center justify-center gap-2">
                          <Edit className="w-3 h-3" /> EDITAR
                      </button>
                      <button onClick={() => sendResetPassword(u.email)} className="w-10 bg-[#222] text-[#666] rounded hover:text-white flex items-center justify-center" title="Redefinir Senha"><Key className="w-3 h-3" /></button>
                      {canDeleteUser && (
                          <button onClick={() => handleDelete(u.id)} className="w-10 bg-red-900/10 text-red-500 rounded hover:bg-red-900 hover:text-white border border-red-900/30 flex items-center justify-center"><Trash2 className="w-3 h-3" /></button>
                      )}
                  </div>
              </div>
          ))}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] p-6 rounded-2xl border border-[#333] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-gold mb-6 font-egyptian">
                    {editingUser.role === 'pending' ? 'Aprovar Acesso' : 'Editar Acesso'}
                </h3>
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Nome</label>
                        <input className="input-field opacity-50 cursor-not-allowed w-full bg-[#222] p-3 rounded text-[#888]" value={editingUser.name || editingUser.email} disabled />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Função (Cargo)</label>
                        <select className="input-field w-full bg-[#0a0a0a] border border-[#333] rounded p-3 text-white focus:border-gold outline-none" value={formData.role} onChange={(e) => handleRoleChange(e.target.value)}>
                            <option value="pending" disabled>Selecione um cargo...</option>
                            <option value="User">Cliente (Apenas Agenda)</option>
                            <option value="Barbeiro">Barbeiro</option>
                            <option value="Gerente">Gerente</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Admin">Admin (Dono)</option>
                        </select>
                    </div>
                    {['Barbeiro', 'Gerente'].includes(formData.role) && (
                        <div className="bg-[#1a1a1a] p-3 rounded border border-[#333] animate-fade-in">
                            <label className="text-[10px] font-bold text-gold uppercase block mb-1">Nível de Comissão</label>
                            <select className="input-field w-full bg-[#0a0a0a] border border-[#333] rounded p-2 text-white mb-2 text-sm" value={formData.level} onChange={(e) => handleLevelChange(e.target.value)} required>
                                <option value="">Selecione...</option>
                                <option value="Auxiliar">Auxiliar (40%)</option>
                                <option value="Barbeiro I">Barbeiro I (45%)</option>
                                <option value="Barbeiro II">Barbeiro II (50%)</option>
                                <option value="Barbeiro III">Barbeiro III (55%)</option>
                                <option value="Barbeiro IV">Barbeiro IV (65%)</option>
                                <option value="Gerente">Gerente (100%)</option>                            
                            </select>
                            <div className="flex items-center justify-between text-xs text-[#888]"><span>Comissão Automática:</span><span className="font-bold text-[#eee]">{formData.commissionRate}%</span></div>
                        </div>
                    )}
                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-[#222] text-[#888] rounded-lg font-bold hover:text-white transition">CANCELAR</button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1 bg-gold text-black font-bold rounded-lg hover:bg-yellow-500 transition">{saving ? 'SALVANDO...' : 'CONFIRMAR'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}