import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase'; 
import { collection, onSnapshot, doc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useOutletContext } from 'react-router-dom';

export default function Users() {
  const { role, shopId } = useOutletContext();
  const [users, setUsers] = useState([]);
  
  // Estado para o Modal de Edição
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({ role: 'User', level: '', commissionRate: 0 });
  const [saving, setSaving] = useState(false);

  // Permissões Locais
  const canManageTeam = ['Admin', 'Gerente'].includes(role);
  const canDeleteUser = role === 'Admin'; // SÓ ADMIN DEMITE

  // Segurança Visual
  if (!canManageTeam) return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
          <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
          <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Negado</h2>
          <p className="text-[#666]">Você não tem permissão para gerenciar a equipe.</p>
      </div>
  );

  useEffect(() => {
    if(!shopId) return;
    const unsub = onSnapshot(query(collection(db, `artifacts/${shopId}/public/data/users`), orderBy('createdAt', 'desc')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.role === 'User' ? -1 : 1)));
    });
    return () => unsub();
  }, [shopId]);

  // --- AÇÕES ---
  
  const handleDeleteUser = async (uid) => { 
      if(!canDeleteUser) return alert("Apenas o Dono (Admin) pode excluir usuários.");
      if(confirm("Tem certeza que deseja remover este usuário da equipe?")) {
          await deleteDoc(doc(db, `artifacts/${shopId}/public/data/users`, uid)); 
      }
  };

  const handleResetPassword = async (email) => { 
      if(email && confirm(`Enviar e-mail de redefinição de senha para ${email}?`)) {
          await sendPasswordResetEmail(auth, email);
          alert("E-mail enviado!");
      }
  };

  // --- EDIÇÃO DE CARGO ---

  const openEditModal = (user) => {
      setEditingUser(user);
      setFormData({ 
          role: user.role || 'User', 
          level: user.level || '', 
          commissionRate: user.commissionRate || 0 
      });
  };

  const handleRoleChange = (newRole) => {
      setFormData({ ...formData, role: newRole });
      // Se não for cargo que corta cabelo, zera nível
      if (!['Barbeiro', 'Gerente'].includes(newRole)) {
          setFormData(prev => ({ ...prev, role: newRole, level: '', commissionRate: 0 }));
      }
  };

  const handleLevelChange = (newLevel) => {
      let rate = 0;
      switch(newLevel) {
          case 'Iniciante': rate = 35; break;
          case 'Barbeiro I': rate = 40; break;
          case 'Barbeiro II': rate = 45; break;
          case 'Barbeiro III': rate = 50; break;
          case 'Master': rate = 60; break;
          default: rate = 0;
      }
      setFormData({ ...formData, level: newLevel, commissionRate: rate });
  };

  const saveChanges = async (e) => {
      e.preventDefault();
      setSaving(true);
      try {
          await updateDoc(doc(db, `artifacts/${shopId}/public/data/users`, editingUser.id), {
              role: formData.role,
              level: formData.level,
              commissionRate: formData.commissionRate
          });
          setEditingUser(null);
          alert("Permissões atualizadas com sucesso!");
      } catch (err) {
          alert("Erro ao salvar: " + err.message);
      } finally {
          setSaving(false);
      }
  };

  return (
    <div className="space-y-6 text-[#F3E5AB]">
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gold font-egyptian">EQUIPE & ACESSOS</h2>
            {!canDeleteUser && <span className="text-[10px] bg-[#222] px-2 py-1 rounded text-[#666]">Modo Gerente: Edição Permitida / Exclusão Bloqueada</span>}
        </div>
        
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-[#888]">
                <thead className="text-xs text-[#555] uppercase bg-[#111]">
                    <tr>
                        <th className="px-4 py-3">Nome</th>
                        <th className="px-4 py-3">Cargo Atual</th>
                        <th className="px-4 py-3">Comissão</th>
                        <th className="px-4 py-3 text-center">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-[#111] border-b border-[#222] last:border-0 transition">
                        <td className="px-4 py-3">
                            <b className="text-[#eee] text-base">{u.name}</b>
                            <br/><span className="text-xs text-[#666]">{u.email}</span>
                            {u.cpf && <span className="text-[10px] text-[#444] block">CPF: {u.cpf}</span>}
                        </td>
                        <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                u.role === 'Admin' ? 'bg-red-900/20 text-red-400 border-red-900/50' : 
                                u.role === 'Gerente' ? 'bg-purple-900/20 text-purple-400 border-purple-900/50' :
                                u.role === 'Barbeiro' ? 'bg-gold/10 text-gold border-gold/30' : 
                                u.role === 'Financeiro' ? 'bg-green-900/20 text-green-400 border-green-900/50' :
                                u.role === 'pending' ? 'bg-yellow-900/10 text-yellow-600 border-yellow-900/30' :
                                'bg-[#222] text-[#888] border-[#333]'
                            }`}>
                                {u.role === 'pending' ? 'Pendente' : u.role}
                            </span>
                            {['Barbeiro', 'Gerente'].includes(u.role) && u.level && (
                                <div className="text-[10px] text-[#888] mt-1">{u.level}</div>
                            )}
                        </td>
                        <td className="px-4 py-3">
                            {['Barbeiro', 'Gerente'].includes(u.role) ? (
                                <span className="font-bold text-[#eee]">{u.commissionRate}%</span>
                            ) : (
                                <span className="text-[#444]">-</span>
                            )}
                        </td>
                        <td className="px-4 py-3 text-center flex justify-center gap-3">
                            {!u.isProtected && (
                                <>
                                    <button onClick={() => openEditModal(u)} className="text-blue-500 hover:text-blue-300 transition" title="Editar Cargo">
                                        <i className="fas fa-edit"></i>
                                    </button>
                                    <button onClick={() => handleResetPassword(u.email)} className="text-amber-500 hover:text-amber-300 transition" title="Resetar Senha">
                                        <i className="fas fa-key"></i>
                                    </button>
                                    
                                    {/* SÓ ADMIN VÊ O BOTÃO EXCLUIR */}
                                    {canDeleteUser && (
                                        <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-300 transition" title="Excluir">
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    )}
                                </>
                            )}
                        </td>
                      </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 animate-fade-in">
            <div className="bg-[#111] border border-[#333] p-6 rounded-2xl w-full max-w-sm shadow-2xl relative">
                <button onClick={() => setEditingUser(null)} className="absolute top-4 right-4 text-[#666] hover:text-[#eee]"><i className="fas fa-times"></i></button>
                
                <h3 className="text-lg font-bold text-gold mb-1">Editar Permissões</h3>
                <p className="text-xs text-[#666] mb-4">Usuário: <span className="text-[#eee]">{editingUser.name}</span></p>

                <form onSubmit={saveChanges} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-[#666] uppercase block mb-1">Selecione o Cargo</label>
                        <select 
                            className="input-field bg-[#0a0a0a]" 
                            value={formData.role} 
                            onChange={(e) => handleRoleChange(e.target.value)}
                        >
                            <option value="pending">Sem Cargo (Pendente)</option>
                            <option value="Barbeiro">Barbeiro (Agenda + Comissão)</option>
                            <option value="Gerente">Gerente (Gestão + Agenda)</option>
                            <option value="Financeiro">Financeiro (Apenas Finanças)</option>
                            <option value="Admin">Administrador (Total)</option>
                        </select>
                    </div>

                    {/* SELEÇÃO DE NÍVEL (Se for Barbeiro OU Gerente) */}
                    {['Barbeiro', 'Gerente'].includes(formData.role) && (
                        <div className="bg-[#1a1a1a] p-3 rounded border border-[#333] animate-fade-in">
                            <label className="text-[10px] font-bold text-gold uppercase block mb-1">Nível de Comissão</label>
                            <p className="text-[9px] text-[#666] mb-2">Este cargo realiza atendimentos?</p>
                            <select 
                                className="input-field bg-[#0a0a0a] mb-2"
                                value={formData.level}
                                onChange={(e) => handleLevelChange(e.target.value)}
                                required
                            >
                                <option value="">Selecione...</option>
                                <option value="Iniciante">Iniciante (35%)</option>
                                <option value="Barbeiro I">Barbeiro I (40%)</option>
                                <option value="Barbeiro II">Barbeiro II (45%)</option>
                                <option value="Barbeiro III">Barbeiro III (50%)</option>
                                <option value="Master">Master (60%)</option>
                            </select>
                            
                            <div className="flex items-center justify-between text-xs text-[#888]">
                                <span>Comissão Automática:</span>
                                <span className="font-bold text-[#eee]">{formData.commissionRate}%</span>
                            </div>
                        </div>
                    )}

                    <div className="pt-2">
                        <button type="submit" disabled={saving} className="btn-primary">
                            {saving ? 'SALVANDO...' : 'ATUALIZAR ACESSO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}