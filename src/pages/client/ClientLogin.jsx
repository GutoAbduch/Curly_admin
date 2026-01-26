import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../../context/ClientAuthContext';
import { ArrowLeft, User, Lock, Phone, Mail } from 'lucide-react';

export default function ClientLogin() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup } = useClientAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
        if (isLogin) {
            await login(email, password);
        } else {
            await signup(email, password, name, phone);
        }
        navigate(-1); // Volta para a página anterior
    } catch (err) {
        console.error(err);
        setError('Erro ao autenticar. Verifique seus dados.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F2] flex items-center justify-center p-4 font-sans text-[#1a1a1a]">
        
        {/* Botão Voltar */}
        <button 
            onClick={() => navigate('/')} 
            className="absolute top-6 left-6 p-3 rounded-full bg-white border border-[#e5e5e5] hover:border-[#D4AF37] hover:text-[#D4AF37] transition shadow-sm z-10"
        >
            <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-[#f0f0f0] relative">
            {/* Barra Dourada Topo */}
            <div className="h-2 w-full bg-[#D4AF37]"></div>

            <div className="p-8 md:p-12">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black font-egyptian mb-2">
                        {isLogin ? 'Bem-vindo(a)' : 'Criar Conta'}
                    </h1>
                    <p className="text-[#666] text-sm">
                        {isLogin ? 'Acesse para gerenciar seus agendamentos' : 'Preencha seus dados para começar'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-3 bg-red-50 text-red-600 text-xs rounded-lg text-center font-bold border border-red-100">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {!isLogin && (
                        <>
                            <div className="relative group">
                                <User className="absolute left-4 top-3.5 w-5 h-5 text-[#999] group-focus-within:text-[#D4AF37] transition-colors" />
                                <input 
                                    required 
                                    type="text" 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-3 bg-[#f9f9f9] border border-[#eee] rounded-xl outline-none focus:border-[#D4AF37] transition text-sm" 
                                    placeholder="Nome Completo" 
                                />
                            </div>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-3.5 w-5 h-5 text-[#999] group-focus-within:text-[#D4AF37] transition-colors" />
                                <input 
                                    required 
                                    type="tel" 
                                    value={phone} 
                                    onChange={e => setPhone(e.target.value)} 
                                    className="w-full pl-12 pr-4 py-3 bg-[#f9f9f9] border border-[#eee] rounded-xl outline-none focus:border-[#D4AF37] transition text-sm" 
                                    placeholder="Telefone / WhatsApp" 
                                />
                            </div>
                        </>
                    )}

                    <div className="relative group">
                        <Mail className="absolute left-4 top-3.5 w-5 h-5 text-[#999] group-focus-within:text-[#D4AF37] transition-colors" />
                        <input 
                            required 
                            type="email" 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            className="w-full pl-12 pr-4 py-3 bg-[#f9f9f9] border border-[#eee] rounded-xl outline-none focus:border-[#D4AF37] transition text-sm" 
                            placeholder="E-mail" 
                        />
                    </div>

                    <div className="relative group">
                        <Lock className="absolute left-4 top-3.5 w-5 h-5 text-[#999] group-focus-within:text-[#D4AF37] transition-colors" />
                        <input 
                            required 
                            type="password" 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            className="w-full pl-12 pr-4 py-3 bg-[#f9f9f9] border border-[#eee] rounded-xl outline-none focus:border-[#D4AF37] transition text-sm" 
                            placeholder="Senha" 
                        />
                    </div>

                    <button 
                        disabled={loading} 
                        type="submit" 
                        className="w-full py-4 bg-[#D4AF37] hover:bg-[#cda631] text-white font-bold rounded-xl shadow-lg hover:scale-[1.02] transition-all tracking-widest uppercase text-xs mt-6"
                    >
                        {loading ? 'Carregando...' : (isLogin ? 'ENTRAR' : 'CRIAR CONTA')}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-[#f5f5f5]">
                    <p className="text-sm text-[#666]">
                        {isLogin ? 'Novo por aqui?' : 'Já tem cadastro?'}
                        <button onClick={() => setIsLogin(!isLogin)} className="ml-2 font-bold text-[#D4AF37] hover:underline">
                            {isLogin ? 'Crie sua conta' : 'Fazer Login'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}