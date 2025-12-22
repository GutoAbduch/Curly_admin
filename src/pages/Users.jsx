import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase'; 
import { collection, onSnapshot, doc, updateDoc, deleteDoc, orderBy, query } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useOutletContext } from 'react-router-dom';

export default function Users() {
  const { role, shopId } = useOutletContext();
  const APP_ID = shopId;
  const [users, setUsers] = useState([]);
  
  if (role !== 'Admin') return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] bg-[#0a0a0a] rounded-2xl border border-[#222]">
          <div className="bg-red-500/10 p-6 rounded-full mb-6"><i className="fas fa-lock text-red-500 text-4xl"></i></div>
          <h2 className="text-2xl font-bold text-[#eee] mb-2">Acesso Negado</h2>
          <p className="text-[#666]">Apenas Administradores podem gerenciar a equipe.</p>
      </div>
  );

  useEffect(() => {
    if(!APP_ID) return;
    const unsub = onSnapshot(query(collection(db, `artifacts/${APP_ID}/public/data/users`), orderBy('createdAt', 'desc')), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.role === 'User' ? -1 : 1)));
    });
    return () => unsub();
  }, [APP_ID]);

  const handleDeleteUser = async (uid) => { if(confirm("Excluir?")) await deleteDoc(doc(db, `artifacts/${APP_ID}/public/data/users`, uid)); };
  const handleResetPassword = async (email) => { if(email && confirm("Resetar senha?")) await sendPasswordResetEmail(auth, email); };

  return (
    <div className="space-y-6 text-[#F3E5AB]">
      <div className="bg-[#0a0a0a] p-6 rounded-2xl shadow-sm border border-[#222]">
        <h2 className="text-xl font-bold text-gold font-egyptian mb-4">EQUIPE & ACESSOS</h2>
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-[#888]">
                <thead className="text-xs text-[#555] uppercase bg-[#111]"><tr><th className="px-4 py-3">Nome</th><th className="px-4 py-3">Cargo</th><th className="px-4 py-3 text-center">Ações</th></tr></thead>
                <tbody>
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-[#111] border-b border-[#222] last:border-0">
                        <td className="px-4 py-3"><b className="text-[#eee]">{u.name}</b><br/><span className="text-xs">{u.email}</span></td>
                        <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${u.role === 'Admin' ? 'bg-red-900 text-red-200' : 'bg-[#222] text-gold'}`}>{u.role}</span></td>
                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                            {!u.isProtected && (
                                <>
                                    <button onClick={() => handleResetPassword(u.email)} className="text-amber-500 hover:text-amber-300"><i className="fas fa-key"></i></button>
                                    <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 hover:text-red-300"><i className="fas fa-trash"></i></button>
                                </>
                            )}
                        </td>
                      </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}