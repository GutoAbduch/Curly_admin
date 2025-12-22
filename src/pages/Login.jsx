import React, { useState } from 'react';
import { signInWithEmailAndPassword, signInAnonymously, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [phone, setPhone] = useState(''); const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  
  const navigate = useNavigate();
  // Captura o ID da loja da URL (ex: renovosbbs)
  // Se não tiver (acesso direto na raiz), usa 'renovosbbs' como fallback
  const params = useParams();
  const shopId = params.shopId || 'renovosbbs';

  const APP_ID = 'default-app-id'; 
  const MASTER_PASSWORD = 'Curly#Admin!2025';

  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { 
        await signInWithEmailAndPassword(auth, email, password); 
        // REDIRECIONAMENTO DINÂMICO: Vai para a loja correta
        navigate(`/${shopId}/admin/services`); 
    } 
    catch (err) { setError("Credenciais inválidas."); } finally { setLoading(false); }
  };

  const handleSignUp = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    if (password !== confirmPassword) { setError("Senhas não conferem."); setLoading(false); return; }
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, `artifacts/${APP_ID}/public/data/users/${cred.user.uid}`), { name, email, phone, role: 'User', createdAt: serverTimestamp() });
      await signOut(auth); alert("Conta criada! Aguarde aprovação do admin."); setIsSignUp(false);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleDemo = async () => {
    if (prompt("Senha Mestra:") !== MASTER_PASSWORD) return alert("Senha incorreta!");
    setLoading(true);
    try { 
        const c = await signInAnonymously(auth); 
        await setDoc(doc(db, `artifacts/${APP_ID}/public/data/users/${c.user.uid}`), { 
            name: 'Admin Teste', role: 'Admin', isProtected: true, createdAt: serverTimestamp() 
        }); 
        // REDIRECIONAMENTO DINÂMICO
        navigate(`/${shopId}/admin/services`); 
    }
    catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center p-4">
      {/* Background Effect */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1500] to-[#000000] opacity-80 pointer-events-none"></div>

      <div className="bg-[#0a0a0a] max-w-md w-full p-8 rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.1)] border border-[#222] relative z-10">
        
        {/* Identidade Visual */}
        <div className="text-center mb-8">
            <div className="inline-block p-3 rounded-full border border-[#D4AF37] mb-4 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                <i className="fas fa-cut text-2xl text-[#D4AF37]"></i>
            </div>
            <h1 className="text-5xl font-black font-egyptian text-[#D4AF37] tracking-widest mb-1">CURLY</h1>
            <p className="text-[#888] text-xs uppercase tracking-[0.3em] font-bold">Management Store</p>
            {/* Exibe qual loja está sendo acessada */}
            <p className="text-[#444] text-[10px] mt-2 uppercase tracking-widest border border-[#222] inline-block px-2 py-1 rounded">
                Acesso: <span className="text-[#eee]">{shopId}</span>
            </p>
        </div>

        <form onSubmit={isSignUp ? handleSignUp : handleLogin} className="space-y-5">
          {isSignUp && <><input className="input-field" placeholder="Nome da Barbearia" value={name} onChange={e=>setName(e.target.value)} required /><input className="input-field" placeholder="Telefone" value={phone} onChange={e=>setPhone(e.target.value)} required /></>}
          <input className="input-field" placeholder="E-mail Corporativo" value={email} onChange={e=>setEmail(e.target.value)} required />
          <input className="input-field" placeholder="Senha" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          {isSignUp && <input className="input-field" placeholder="Confirmar Senha" type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required />}
          
          {error && <p className="text-red-400 text-xs text-center border border-red-900/50 bg-red-900/10 p-2 rounded">{error}</p>}
          
          <button disabled={loading} className="btn-primary mt-4">
            {loading ? <i className="fas fa-spinner fa-spin"></i> : (isSignUp ? 'REGISTRAR BARBEARIA' : 'ACESSAR PAINEL')}
          </button>
          
          <div className="flex flex-col gap-3 text-center mt-6">
              <p className="text-xs text-[#666] cursor-pointer hover:text-[#D4AF37] transition" onClick={()=>setIsSignUp(!isSignUp)}>
                {isSignUp ? 'Já possui conta? Fazer Login' : 'Não tem conta? Cadastrar Nova Barbearia'}
              </p>
              {!isSignUp && <button type="button" onClick={handleDemo} className="text-[10px] text-[#333] hover:text-[#555] transition">Login Master (Admin)</button>}
          </div>
        </form>
      </div>
    </div>
  );
}