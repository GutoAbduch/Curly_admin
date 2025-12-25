import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase'; 
import { collection, onSnapshot, doc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useOutletContext } from 'react-router-dom';

export default function Users() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId;

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
          <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Restrito</h2>
          <p className="text-[#666]">Apenas a gerência pode acessar os dados da equipe.</p>
      </div>
  );

  useEffect(() => {
    if(!APP_ID) return;

    // Busca usuários vinculados a esta loja
    // (Nota: Em produção idealmente filtramos por shopId se os users estiverem todos numa coleção só, 
    // mas aqui estamos usando subcoleção da loja, então já vem filtrado)
    const q = query(collection(db, `artifacts/${APP_ID}/public/data/users`), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [APP_ID]);

  const handleEdit = (user) => {
      setEditingUser(user);
      setFormData({ 
          role: user.role || 'User', 
          level: user.level || '', 
          commissionRate: user.commissionRate || 0 
      });
  };

  // --- ATUALIZADA: LÓGICA DE COMISSÃO ---
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
      // Se mudar para Admin/User/Financeiro, zera comissão
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
          alert("Dados atualizados com sucesso!");
      } catch (error) {
          console.error(error);
          alert("Erro ao atualizar.");
      } finally {
          setSaving(false);
      }
  };

  const handleDelete = async (id) => {
      if(!window.confirm("Tem certeza que deseja remover este usuário da equipe?")) return;
      try {
          await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, id));
      } catch (error) {
          alert("Erro ao excluir.");
      }
  };

  const sendResetPassword = async (email) => {
      if(!window.confirm(`Enviar e-mail de redefinição para ${email}?`)) return;
      try {
          await sendPasswordResetEmail(auth, email);
          alert("E-mail enviado!");
      } catch (error) {
          alert("Erro: " + error.message);
      }
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white font-egyptian tracking-wider">EQUIPE</h2>
        <p className="text-[#666] text-sm">Gerencie permissões e comissões</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map(u => (
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

                  {/* Info de Comissão */}
                  {['Barbeiro', 'Gerente'].includes(u.role) && (
                      <div className="bg-[#050505] p-3 rounded mb-4 border border-[#222]">
                          <div className="flex justify-between text-xs mb-1">
                              <span className="text-[#666]">Nível:</span>
                              <span className="text-[#eee] font-bold">{u.level || '-'}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                              <span className="text-[#666]">Comissão:</span>
                              <span className="text-gold font-bold">{u.commissionRate}%</span>
                          </div>
                      </div>
                  )}

                  <div className="flex gap-2 mt-auto">
                      <button onClick={() => handleEdit(u)} className="flex-1 bg-[#222] text-[#ccc] py-2 rounded text-xs font-bold hover:bg-gold hover:text-black transition">
                          EDITAR
                      </button>
                      <button onClick={() => sendResetPassword(u.email)} className="w-10 bg-[#222] text-[#666] rounded hover:text-white" title="Redefinir Senha">
                          <i className="fas fa-key"></i>
                      </button>
                      {canDeleteUser && (
                          <button onClick={() => handleDelete(u.id)} className="w-10 bg-red-900/10 text-red-500 rounded hover:bg-red-900 hover:text-white border border-red-900/30">
                              <i className="fas fa-trash"></i>
                          </button>
                      )}
                  </div>
              </div>
          ))}
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111] p-6 rounded-2xl border border-[#333] w-full max-w-md shadow-2xl">
                <h3 className="text-xl font-bold text-gold mb-6 font-egyptian">Editar Acesso</h3>
                
                <form onSubmit={handleUpdateUser} className="space-y-4">
                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Nome</label>
                        <input className="input-field opacity-50 cursor-not-allowed" value={editingUser.name || editingUser.email} disabled />
                    </div>

                    <div>
                        <label className="text-xs font-bold text-[#666] uppercase">Função (Cargo)</label>
                        <select 
                            className="input-field" 
                            value={formData.role} 
                            onChange={(e) => handleRoleChange(e.target.value)}
                        >
                            <option value="User">Cliente (User)</option>
                            <option value="Barbeiro">Barbeiro</option>
                            <option value="Gerente">Gerente</option>
                            <option value="Financeiro">Financeiro</option>
                            <option value="Admin">Admin (Dono)</option>
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
                                <option value="Auxiliar">Auxiliar (40%)</option>
                                <option value="Barbeiro I">Barbeiro I (45%)</option>
                                <option value="Barbeiro II">Barbeiro II (50%)</option>
                                <option value="Barbeiro III">Barbeiro III (55%)</option>
                                <option value="Barbeiro IV">Barbeiro IV (65%)</option>
                                <option value="Gerente">Gerente (100%)</option>                            
                            </select>
                            
                            <div className="flex items-center justify-between text-xs text-[#888]">
                                <span>Comissão Automática:</span>
                                <span className="font-bold text-[#eee]">{formData.commissionRate}%</span>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2 pt-4">
                        <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-3 bg-[#222] text-[#888] rounded-lg font-bold hover:text-white transition">CANCELAR</button>
                        <button type="submit" disabled={saving} className="btn-primary flex-1">
                            {saving ? 'SALVANDO...' : 'ATUALIZAR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}