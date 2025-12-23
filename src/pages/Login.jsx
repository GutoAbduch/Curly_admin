import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';

export default function Login() {
  const navigate = useNavigate();
  const params = useParams();
  
  // SEU E-MAIL MESTRE
  const MASTER_EMAIL = 'gutoabduch@gmail.com';
  
  // ID da loja (fallback para renovosbbs apenas para testes locais)
  const shopId = params.shopId || 'renovosbbs';

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
    docOwner: '', // CPF ou CNPJ do dono
    fantasyName: '',
    ownerName: '',
    address: '',
    email: '',
    phone: ''
  });

  // --- FUNÇÕES DE LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    try { 
        await signInWithEmailAndPassword(auth, loginEmail, loginPass); 
        navigate(`/${shopId}/admin/services`); 
    } catch (err) { 
        console.error(err);
        setError("E-mail ou senha incorretos."); 
    } finally { setLoading(false); }
  };

  const handleMasterAccess = () => {
    setLoginEmail(MASTER_EMAIL);
    const passInput = document.querySelector('input[type="password"]');
    if(passInput) passInput.focus();
    setError('Digite sua senha de administrador.');
  };

  // --- FUNÇÃO CADASTRO DE USUÁRIO (FUNCIONÁRIO) ---
  const handleUserRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    if (userForm.password !== userForm.confirmPassword) {
        setLoading(false); return setError("As senhas não conferem.");
    }
    if (userForm.password.length < 6) {
        setLoading(false); return setError("A senha deve ter no mínimo 6 caracteres.");
    }

    try {
        // 1. Cria autenticação no Firebase Auth
        const cred = await createUserWithEmailAndPassword(auth, userForm.email, userForm.password);
        await updateProfile(cred.user, { displayName: userForm.name });

        // 2. Salva no Firestore da loja atual
        // Regra de Negócio: Conta nasce "Sem Cargo" (role: 'pending')
        await setDoc(doc(db, `artifacts/${shopId}/public/data/users/${cred.user.uid}`), {
            name: userForm.name,
            email: userForm.email,
            cpf: userForm.cpf,
            birthDate: userForm.birthDate,
            phone: userForm.phone,
            role: 'pending', // <--- IMPORTANTE: Usuário nasce bloqueado
            createdAt: serverTimestamp()
        });

        await signOut(auth);
        alert("Cadastro realizado! Solicite ao gerente a liberação do seu acesso.");
        setMode('login');
        setUserForm({ name: '', email: '', cpf: '', birthDate: '', phone: '', password: '', confirmPassword: '' });

    } catch (err) {
        setError(translateFirebaseError(err.code));
    } finally {
        setLoading(false);
    }
  };

  // --- FUNÇÃO CADASTRO DE EMPRESA (SOLICITAÇÃO) ---
  const handleCompanyRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');

    // Validação básica de tamanho do documento
    if (companyForm.docOwner.replace(/\D/g, '').length < 11) {
        setLoading(false); return setError("CPF/CNPJ inválido (mínimo 11 números).");
    }
    if (!termsAccepted) {
        setLoading(false); return setError("Você deve aceitar os Termos e Condições.");
    }

    try {
        // Envia solicitação para a coleção global de pedidos
        await addDoc(collection(db, 'company_requests'), {
            ...companyForm,
            status: 'pending', // Aguardando você aprovar na Loja Principal
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

  const translateFirebaseError = (code) => {
      if (code === 'auth/email-already-in-use') return 'Este e-mail já está cadastrado.';
      if (code === 'auth/weak-password') return 'A senha é muito fraca.';
      return 'Erro ao cadastrar. Verifique os dados.';
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#050505] flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#1a1500] to-[#000000] opacity-80 pointer-events-none"></div>

      <div className="bg-[#0a0a0a] max-w-md w-full p-8 rounded-2xl shadow-[0_0_50px_rgba(212,175,55,0.1)] border border-[#222] relative z-10 my-8">
        
        {/* HEADER DA IDENTIDADE VISUAL */}
        <div className="text-center mb-6">
            <div className="inline-block p-3 rounded-full border border-[#D4AF37] mb-4 shadow-[0_0_15px_rgba(212,175,55,0.2)]">
                <i className="fas fa-cut text-2xl text-[#D4AF37]"></i>
            </div>
            <h1 className="text-4xl font-black font-egyptian text-[#D4AF37] tracking-widest mb-1">CURLY</h1>
            <p className="text-[#444] text-[10px] mt-2 uppercase tracking-widest border border-[#222] inline-block px-2 py-1 rounded">
                Loja: <span className="text-[#eee]">{shopId}</span>
            </p>
        </div>

        {/* BOX DE ERRO */}
        {error && <div className="mb-4 bg-red-900/20 border border-red-900/50 p-3 rounded text-red-400 text-xs text-center">{error}</div>}

        {/* --- MODO 1: LOGIN --- */}
        {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4 animate-fade-in">
                <h2 className="text-center text-[#eee] font-bold text-lg mb-4">Acesso ao Sistema</h2>
                <input className="input-field" placeholder="E-mail" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required />
                <input className="input-field" placeholder="Senha" type="password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} required />
                
                <button disabled={loading} className="btn-primary mt-4">
                    {loading ? 'ENTRANDO...' : 'ACESSAR PAINEL'}
                </button>

                <div className="flex flex-col gap-3 text-center mt-6 pt-6 border-t border-[#222]">
                    <p className="text-xs text-[#666]">Não possui acesso?</p>
                    <div className="flex gap-2 justify-center">
                        <button type="button" onClick={()=>setMode('registerUser')} className="text-xs text-[#D4AF37] hover:underline font-bold">Sou Funcionário</button>
                        <span className="text-[#333]">|</span>
                        <button type="button" onClick={()=>setMode('registerCompany')} className="text-xs text-[#D4AF37] hover:underline font-bold">Quero Contratar (Empresa)</button>
                    </div>
                    <button type="button" onClick={handleMasterAccess} className="text-[10px] text-[#333] hover:text-[#555] mt-4">Login Master</button>
                </div>
            </form>
        )}

        {/* --- MODO 2: CADASTRO DE USUÁRIO (FUNCIONÁRIO) --- */}
        {mode === 'registerUser' && (
            <form onSubmit={handleUserRegister} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#222]">
                    <h2 className="text-[#eee] font-bold">Cadastro de Funcionário</h2>
                    <button type="button" onClick={()=>setMode('login')} className="text-xs text-[#666] hover:text-[#eee]">Voltar</button>
                </div>
                
                <input className="input-field" placeholder="Nome Completo" value={userForm.name} onChange={e=>setUserForm({...userForm, name: e.target.value})} required />
                <input className="input-field" placeholder="E-mail Pessoal" type="email" value={userForm.email} onChange={e=>setUserForm({...userForm, email: e.target.value})} required />
                <div className="grid grid-cols-2 gap-2">
                    <input className="input-field" placeholder="CPF" value={userForm.cpf} onChange={e=>setUserForm({...userForm, cpf: e.target.value})} required />
                    <input className="input-field" placeholder="Data Nasc." type="date" value={userForm.birthDate} onChange={e=>setUserForm({...userForm, birthDate: e.target.value})} required />
                </div>
                <input className="input-field" placeholder="Celular / WhatsApp" value={userForm.phone} onChange={e=>setUserForm({...userForm, phone: e.target.value})} required />
                <input className="input-field" placeholder="Senha" type="password" value={userForm.password} onChange={e=>setUserForm({...userForm, password: e.target.value})} required />
                <input className="input-field" placeholder="Confirmar Senha" type="password" value={userForm.confirmPassword} onChange={e=>setUserForm({...userForm, confirmPassword: e.target.value})} required />

                <div className="bg-yellow-900/10 border border-yellow-900/30 p-2 rounded text-[10px] text-yellow-500 text-center mb-2">
                    <i className="fas fa-exclamation-triangle mr-1"></i>
                    Sua conta será criada como "Pendente". O gerente da loja precisará aprovar seu acesso.
                </div>

                <button disabled={loading} className="btn-primary">{loading ? 'CRIANDO...' : 'CRIAR CONTA'}</button>
            </form>
        )}

        {/* --- MODO 3: CADASTRO DE EMPRESA (PRÉ-CADASTRO) --- */}
        {mode === 'registerCompany' && (
            <form onSubmit={handleCompanyRegister} className="space-y-3 animate-fade-in">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#222]">
                    <h2 className="text-[#eee] font-bold">Contratar Sistema (Empresas)</h2>
                    <button type="button" onClick={()=>setMode('login')} className="text-xs text-[#666] hover:text-[#eee]">Voltar</button>
                </div>

                <input className="input-field" placeholder="Nome Fantasia da Barbearia" value={companyForm.fantasyName} onChange={e=>setCompanyForm({...companyForm, fantasyName: e.target.value})} required />
                <input className="input-field" placeholder="Nome do Responsável Legal" value={companyForm.ownerName} onChange={e=>setCompanyForm({...companyForm, ownerName: e.target.value})} required />
                <input className="input-field" placeholder="CPF ou CNPJ do Responsável" value={companyForm.docOwner} onChange={e=>setCompanyForm({...companyForm, docOwner: e.target.value})} required />
                <input className="input-field" placeholder="E-mail Comercial" type="email" value={companyForm.email} onChange={e=>setCompanyForm({...companyForm, email: e.target.value})} required />
                <input className="input-field" placeholder="Telefone de Contato" value={companyForm.phone} onChange={e=>setCompanyForm({...companyForm, phone: e.target.value})} required />
                <textarea className="input-field h-20" placeholder="Endereço Completo da Empresa" value={companyForm.address} onChange={e=>setCompanyForm({...companyForm, address: e.target.value})} required />

                <div className="flex items-start gap-2 mt-2 bg-[#111] p-3 rounded border border-[#222]">
                    <input type="checkbox" id="terms" className="mt-1" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)} />
                    <label htmlFor="terms" className="text-xs text-[#888] cursor-pointer select-none">
                        Li e aceito os <span className="text-gold underline font-bold">Termos e Condições de Uso</span> da Plataforma Curly.
                    </label>
                </div>

                <button disabled={loading} className="btn-primary mt-2">{loading ? 'ENVIANDO...' : 'SOLICITAR SISTEMA'}</button>
            </form>
        )}

      </div>
    </div>
  );
}