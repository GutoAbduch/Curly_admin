import React, { useState } from 'react';
import { auth, db } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';

export default function Login() {
  const navigate = useNavigate();
  const params = useParams();
  
  // Recupera o ID da loja da URL (ex: curlyapp.com/abduch) ou usa vazio/fallback
  // Se estiver acessando pela raiz, urlShopId será undefined
  const urlShopId = params.shopId; 

  const [isRegistering, setIsRegistering] = useState(false);
  const [userType, setUserType] = useState('client'); // 'client' (funcionário) ou 'company' (nova loja)
  
  // Estados do Formulário
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Se tiver ID na URL, usa ele como padrão. Se não, o usuário digita.
  const [manualShopId, setManualShopId] = useState(''); 
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  
  const [loading, setLoading] = useState(false);

  // Define qual ID de loja será usado (o da URL tem prioridade)
  const currentShopId = urlShopId || manualShopId;

  // --- TRATAMENTO DE ERROS ---
  const handleError = (error) => {
      console.error("Erro Auth:", error);
      const msg = error.message || "";
      
      if (msg.includes("password")) return alert("A senha deve ter pelo menos 6 caracteres.");
      if (msg.includes("email-already-in-use")) return alert("Este e-mail já está cadastrado.");
      if (msg.includes("invalid-email")) return alert("E-mail inválido.");
      if (msg.includes("user-not-found")) return alert("Usuário não encontrado.");
      if (msg.includes("wrong-password")) return alert("Senha incorreta.");
      if (msg.includes("missing-email")) return alert("Digite o e-mail.");
      if (msg.includes("ADMIN_ONLY_OPERATION")) return alert("Operação não permitida.");
      
      alert("Erro ao processar: " + msg);
  };

  // --- LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      
      // Se tiver loja na URL, redireciona para o dashboard dessa loja
      // Se não, o sistema deve decidir (geralmente vai para o último acesso ou dashboard geral)
      if (urlShopId) {
          navigate(`/${urlShopId}/app/dashboard`);
      } else {
          // Fallback se logar sem loja definida na URL (você pode ajustar essa rota depois)
          navigate('/app/dashboard'); 
      }
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  // --- CADASTRO (REGISTER) ---
  const handleRegister = async (e) => {
    e.preventDefault();
    
    // 1. Validações Gerais
    if (!termsAccepted) return alert("Você precisa aceitar os Termos de Uso.");
    if (password.length < 6) return alert("A senha precisa ter no mínimo 6 caracteres.");
    if (!name || !email || !password || !phone) return alert("Preencha todos os campos obrigatórios.");

    // 2. Validação Específica para Funcionário
    if (userType === 'client' && !currentShopId) return alert("Informe o ID da Loja para se vincular.");

    setLoading(true);

    try {
      // 3. Criar usuário no Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: name });

      // 4. Salvar dados no Firestore conforme o tipo
      if (userType === 'company') {
          // === NOVA EMPRESA ===
          const newShopId = user.uid; // ID da loja é o UID do dono
          
          // Config da Loja
          await setDoc(doc(db, `artifacts/${newShopId}/public/data/store_settings/full_config`), {
              ownerName: name,
              ownerEmail: email,
              phone: phone,
              shopName: name, // Nome inicial
              createdAt: serverTimestamp(),
              status: 'pending', // Vai para aba Franquias
              plan: 'trial', 
              subscriptionStatus: 'inactive'
          });

          // Usuário Admin
          await setDoc(doc(db, `artifacts/${newShopId}/public/data/users/${user.uid}`), {
              name: name,
              email: email,
              role: 'Admin',
              phone: phone,
              createdAt: serverTimestamp()
          });

          alert(`Loja criada com sucesso!\nID: ${newShopId}\nAguarde aprovação.`);
          navigate(`/${newShopId}/app/dashboard`);

      } else {
          // === NOVO FUNCIONÁRIO ===
          try {
             // Vincula à loja definida (da URL ou digitada)
             await setDoc(doc(db, `artifacts/${currentShopId}/public/data/users/${user.uid}`), {
                name: name,
                email: email,
                role: 'visitante', // Vai para aba Equipe
                phone: phone,
                createdAt: serverTimestamp()
             });
             
             alert("Cadastro realizado! Aguarde a aprovação do gerente.");
             navigate(`/${currentShopId}/app/dashboard`);
             
          } catch (err) {
             console.error(err);
             alert("Erro ao vincular. Verifique se o ID da Loja existe.");
          }
      }

    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,rgba(212,175,55,0.05)_0%,rgba(0,0,0,0)_70%)] animate-pulse-slow pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#111] border border-[#222] rounded-2xl p-8 shadow-2xl relative z-10 animate-fade-in">
        
        {/* HEADER IDENTIDADE VISUAL + LOJA */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-[#D4AF37] font-egyptian tracking-widest mb-2">CURLY</h1>
          <p className="text-gray-500 text-xs uppercase tracking-[0.3em] mb-4">Sistema de Gestão</p>
          
          {/* IDENTIFICADOR DA LOJA (Recuperado) */}
          {urlShopId ? (
              <div className="inline-block px-3 py-1 rounded border border-[#333] bg-[#0a0a0a]">
                  <p className="text-[10px] text-[#666] uppercase tracking-wider">
                      Acessando Loja: <span className="text-[#eee] font-bold ml-1">{urlShopId}</span>
                  </p>
              </div>
          ) : (
              <div className="inline-block px-3 py-1 rounded border border-[#333] bg-[#0a0a0a] opacity-50">
                   <p className="text-[10px] text-[#666] uppercase tracking-wider">Acesso Geral</p>
              </div>
          )}
        </div>

        {/* Toggles */}
        <div className="flex bg-[#000] p-1 rounded-lg mb-6 border border-[#222]">
          <button 
            onClick={() => setIsRegistering(false)} 
            className={`flex-1 py-2 text-xs font-bold rounded transition-all ${!isRegistering ? 'bg-[#222] text-white shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            ENTRAR
          </button>
          <button 
            onClick={() => setIsRegistering(true)} 
            className={`flex-1 py-2 text-xs font-bold rounded transition-all ${isRegistering ? 'bg-[#D4AF37] text-black shadow' : 'text-gray-500 hover:text-gray-300'}`}
          >
            CADASTRAR
          </button>
        </div>

        <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
          
          {/* CAMPOS DE CADASTRO */}
          {isRegistering && (
            <>
              <div className="flex gap-4 justify-center mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="uType" checked={userType === 'client'} onChange={() => setUserType('client')} className="accent-gold" />
                      <span className={`text-xs font-bold ${userType === 'client' ? 'text-white' : 'text-gray-500'}`}>Sou Funcionário</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="uType" checked={userType === 'company'} onChange={() => setUserType('company')} className="accent-gold" />
                      <span className={`text-xs font-bold ${userType === 'company' ? 'text-white' : 'text-gray-500'}`}>Abrir Barbearia</span>
                  </label>
              </div>

              <div className="space-y-4 animate-slide-up">
                  <input type="text" placeholder="Seu Nome Completo" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
                  <input type="tel" placeholder="Seu Telefone (WhatsApp)" className="input-field" value={phone} onChange={e => setPhone(e.target.value)} required />
                  
                  {/* ID DA LOJA: Automático se tiver na URL, manual se não tiver */}
                  {userType === 'client' && (
                    <div>
                        {urlShopId ? (
                            <div className="input-field border-l-4 border-l-green-500 bg-[#1a1a1a] text-gray-400 cursor-not-allowed flex items-center justify-between">
                                <span>{urlShopId}</span>
                                <i className="fas fa-lock text-[10px]"></i>
                            </div>
                        ) : (
                            <input 
                                type="text" 
                                placeholder="Digite o ID da Loja" 
                                className="input-field border-l-4 border-l-gold" 
                                value={manualShopId} onChange={e => setManualShopId(e.target.value)} 
                                required 
                            />
                        )}
                        <p className="text-[9px] text-gray-500 mt-1 ml-1">* Vínculo com a barbearia.</p>
                    </div>
                  )}
              </div>
            </>
          )}

          {/* CAMPOS COMUNS */}
          <div className="space-y-4">
            <input type="email" placeholder="E-mail" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Senha (mín. 6 caracteres)" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {/* CHECKBOX TERMOS (Obrigatório) */}
          {isRegistering && (
              <div className="flex items-start gap-2 pt-2">
                  <input type="checkbox" id="terms" className="mt-1 accent-gold cursor-pointer" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} />
                  <label htmlFor="terms" className="text-[10px] text-gray-400 cursor-pointer leading-tight">
                      Li e concordo com os <a href="#" className="text-gold underline hover:text-white">Termos de Uso</a> e <a href="#" className="text-gold underline hover:text-white">Política de Privacidade</a> do Curly Admin.
                  </label>
              </div>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 mt-4 text-sm tracking-widest uppercase font-bold shadow-lg shadow-gold/10">
            {loading ? 'Processando...' : (isRegistering ? 'CRIAR CONTA' : 'ACESSAR SISTEMA')}
          </button>
        </form>

        <div className="mt-8 text-center">
            <p className="text-[10px] text-gray-600">© 2025 Curly Admin System. Versão 2.1</p>
        </div>
      </div>
    </div>
  );
}