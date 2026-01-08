import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase'; 
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, addDoc, collection, serverTimestamp, getDoc } from 'firebase/firestore';
import { Scissors, AlertTriangle, CheckCircle } from 'lucide-react'; 

export default function Login() {
  const navigate = useNavigate();
  const params = useParams();
   
  // CORREÇÃO: Padrão alterado de 'renovosbbs' para 'abduch' (Seu QG)
  const shopId = params.shopId || 'abduch';

  // Estados de Controle de Tela
  // mode: 'login' | 'registerUser' | 'registerCompany'
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Estados do Formulário de Login
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Estados do Formulário de Usuário (Pessoa Física)
  const [userForm, setUserForm] = useState({
    name: '', email: '', cpf: '', birthDate: '', phone: '', password: '', confirmPassword: ''
  });

  // Estados do Formulário de Empresa (Franquia)
  const [companyForm, setCompanyForm] = useState({
    docOwner: '', 
    fantasyName: '',
    ownerName: '',
    address: '',
    email: '',
    phone: ''
  });

  // --- FUNÇÕES DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault(); 
    setLoading(true); 
    setError('');
    
    const cleanEmail = loginEmail.trim();

    try { 
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, loginPass); 
        const user = userCred.user;

        // VERIFICAÇÃO DE STATUS (PENDING)
        const userDocRef = doc(db, `artifacts/${shopId}/public/data/users/${user.uid}`);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'pending') {
               await signOut(auth);
               throw new Error("Seu cadastro está em análise. Aguarde aprovação do gerente.");
            }
        }

        navigate(`/${shopId}/admin/services`); 
    } catch (err) { 
        console.error(err);
        if (err.message.includes("análise")) {
            setError(err.message);
        } else {
            setError("E-mail ou senha incorretos."); 
        }
    } finally { 
        setLoading(false); 
    }
  };

  // --- FUNÇÃO CADASTRO DE USUÁRIO (FUNCIONÁRIO) ---
  const handleUserRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    if (!termsAccepted) {
        setLoading(false); return setError("Você deve aceitar os Termos e Condições.");
    }

    if (userForm.password !== userForm.confirmPassword) {
        setLoading(false); return setError("As senhas não conferem.");
    }
    if (userForm.password.length < 6) {
        setLoading(false); return setError("A senha deve ter no mínimo 6 caracteres.");
    }

    const cleanEmail = userForm.email.trim();

    try {
        let userCredential;
        let isNewUser = true;

        try {
            // Tenta criar usuário novo
            userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, userForm.password);
            await updateProfile(userCredential.user, { displayName: userForm.name });
        } catch (createError) {
            // Se já existe, tenta vincular
            if (createError.code === 'auth/email-already-in-use') {
                try {
                    userCredential = await signInWithEmailAndPassword(auth, cleanEmail, userForm.password);
                    isNewUser = false; 
                } catch (loginError) {
                    throw new Error("Este e-mail já possui uma conta, mas a senha informada não confere.");
                }
            } else {
                throw createError; 
            }
        }

        const user = userCredential.user;

        // Salva vínculo no Firestore da loja atual
        await setDoc(doc(db, `artifacts/${shopId}/public/data/users/${user.uid}`), {
            name: userForm.name,
            email: cleanEmail,
            cpf: userForm.cpf,
            birthDate: userForm.birthDate,
            phone: userForm.phone,
            role: 'pending', 
            createdAt: serverTimestamp(), 
            linkedAt: serverTimestamp() 
        });

        await signOut(auth);
        
        if (isNewUser) {
            alert("Cadastro realizado! Solicite ao gerente a liberação do seu acesso.");
        } else {
            alert("Sua conta existente foi vinculada a esta Barbearia! Solicite a liberação ao gerente.");
        }
        
        setMode('login');
        setUserForm({ name: '', email: '', cpf: '', birthDate: '', phone: '', password: '', confirmPassword: '' });
        setTermsAccepted(false);

    } catch (err) {
        setError(err.message === "Este e-mail já possui uma conta, mas a senha informada não confere." 
            ? err.message 
            : "Erro ao cadastrar. Verifique os dados."
        );
    } finally {
        setLoading(false);
    }
  };

  // --- FUNÇÃO CADASTRO DE EMPRESA (SOLICITAÇÃO) ---
  const handleCompanyRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    if (companyForm.docOwner.replace(/\D/g, '').length < 11) {
        setLoading(false); return setError("CPF/CNPJ inválido (mínimo 11 números).");
    }
    if (!termsAccepted) {
        setLoading(false); return setError("Você deve aceitar os Termos e Condições.");
    }

    try {
        await addDoc(collection(db, 'company_requests'), {
            ...companyForm,
            status: 'pending',
            requestDate: serverTimestamp()
        });

        alert("Solicitação enviada! Nossa equipe entrará em contato para liberar seu sistema.");
        setMode('login');
        setCompanyForm({ docOwner: '', fantasyName: '', ownerName: '', address: '', email: '', phone: '' });
        setTermsAccepted(false);

    } catch (err) {
        console.error(err);
        setError("Erro ao enviar solicitação. Tente novamente.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1500] to-[#000000] opacity-80 pointer-events-none"></div>

      <div className="bg-[#0a0a0a] max-w-md w-full p-8 rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.1)] border border-[#222] relative z-10 my-8">
        
        {/* HEADER */}
        <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center p-3 rounded-full border border-[#D4AF37] mb-4 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                <Scissors className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h1 className="text-4xl font-black font-egyptian text-[#D4AF37] tracking-widest mb-1">CURLY</h1>
            <p className="text-[#444] text-[10px] mt-2 uppercase tracking-widest border border-[#222] inline-block px-2 py-1 rounded">
                Loja: <span className="text-[#eee]">{shopId}</span>
            </p>
        </div>

        {/* ERRO */}
        {error && <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded text-red-400 text-xs text-center">{error}</div>}

        {/* --- MODO 1: LOGIN --- */}
        {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                <h2 className="text-center text-[#eee] font-bold text-lg mb-4">Acesso ao Sistema</h2>
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="E-mail" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Senha" type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} required />
                
                <button disabled={loading} className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded mt-4 hover:bg-[#b5952f] transition-colors">
                    {loading ? 'ENTRANDO...' : 'ACESSAR PAINEL'}
                </button>

                <div className="flex flex-col gap-3 text-center mt-6 pt-6 border-t border-[#222]">
                    <p className="text-xs text-[#666]">Não possui acesso?</p>
                    <div className="flex gap-2 justify-center">
                        <button type="button" onClick={()=>setMode('registerUser')} className="text-xs text-[#D4AF37] hover:underline font-bold">Sou Funcionário</button>
                        <span className="text-[#333]">|</span>
                        <button type="button" onClick={()=>setMode('registerCompany')} className="text-xs text-[#D4AF37] hover:underline font-bold">Quero Contratar (Empresa)</button>
                    </div>
                </div>
            </form>
        )}

        {/* --- MODO 2: CADASTRO USUÁRIO --- */}
        {mode === 'registerUser' && (
            <form onSubmit={handleUserRegister} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#222]">
                    <h2 className="text-[#eee] font-bold">Cadastro de Funcionário</h2>
                    <button type="button" onClick={()=>setMode('login')} className="text-xs text-[#666] hover:text-[#eee]">Voltar</button>
                </div>
                
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Nome Completo" value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="E-mail Pessoal" type="email" value={userForm.email} onChange={e=>setUserForm({...userForm, email: e.target.value})} required />
                <div className="grid grid-cols-2 gap-2">
                    <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="CPF" value={userForm.cpf} onChange={e=>setUserForm({...userForm, cpf: e.target.value})} required />
                    <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Data Nasc." type="date" value={userForm.birthDate} onChange={e=>setUserForm({...userForm, birthDate: e.target.value})} required />
                </div>
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Celular / WhatsApp" value={userForm.phone} onChange={e=>setUserForm({...userForm, phone: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Senha" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Confirmar Senha" type="password" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} required />

                <div className="flex items-start gap-2 mt-2 bg-[#111] p-3 rounded border border-[#222]">
                    <input type="checkbox" id="termsUser" className="mt-1" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} />
                    <label htmlFor="termsUser" className="text-xs text-[#888] cursor-pointer select-none">
                        Li e aceito os <span className="text-[#D4AF37] underline font-bold">Termos e Condições de Uso</span>.
                    </label>
                </div>

                <div className="bg-yellow-900/10 border border-yellow-900/30 p-2 rounded text-[10px] text-yellow-500 text-center mb-2 flex items-center justify-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Sua conta será criada como "Pendente".
                </div>

                <button disabled={loading} className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded hover:bg-[#b5952f] transition-colors">
                    {loading ? 'CRIANDO...' : 'CRIAR CONTA'}
                </button>
            </form>
        )}

        {/* --- MODO 3: CADASTRO EMPRESA --- */}
        {mode === 'registerCompany' && (
            <form onSubmit={handleCompanyRegister} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#222]">
                    <h2 className="text-[#eee] font-bold">Contratar Sistema (Empresas)</h2>
                    <button type="button" onClick={()=>setMode('login')} className="text-xs text-[#666] hover:text-[#eee]">Voltar</button>
                </div>

                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Nome Fantasia da Barbearia" value={companyForm.fantasyName} onChange={e=>setCompanyForm({...companyForm, fantasyName: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Nome do Responsável Legal" value={companyForm.ownerName} onChange={e=>setCompanyForm({...companyForm, ownerName: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="CPF ou CNPJ do Responsável" value={companyForm.docOwner} onChange={e=>setCompanyForm({...companyForm, docOwner: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="E-mail Comercial" type="email" value={companyForm.email} onChange={e=>setCompanyForm({...companyForm, email: e.target.value})} required />
                <input className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee]" placeholder="Telefone de Contato" value={companyForm.phone} onChange={e=>setCompanyForm({...companyForm, phone: e.target.value})} required />
                <textarea className="input-field w-full bg-[#111] border border-[#222] rounded p-3 text-[#eee] h-20" placeholder="Endereço Completo da Empresa" value={companyForm.address} onChange={e=>setCompanyForm({...companyForm, address: e.target.value})} required />

                <div className="flex items-start gap-2 mt-2 bg-[#111] p-3 rounded border border-[#222]">
                    <input type="checkbox" id="terms" className="mt-1" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} />
                    <label htmlFor="terms" className="text-xs text-[#888] cursor-pointer select-none">
                        Li e aceito os <span className="text-[#D4AF37] underline font-bold">Termos e Condições de Uso</span> da Plataforma Curly.
                    </label>
                </div>

                <button disabled={loading} className="w-full bg-[#D4AF37] text-black font-bold py-3 rounded mt-2 hover:bg-[#b5952f] transition-colors">
                    {loading ? 'ENVIANDO...' : 'SOLICITAR SISTEMA'}
                </button>
            </form>
        )}

      </div>
    </div>
  );
}