import React, { useState, useEffect } from 'react';
import { Outlet, useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function AdminLayout() {
  const { shopId } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [storePlan, setStorePlan] = useState('Starter');
  const [loading, setLoading] = useState(true);
  
  // Variáveis globais de suporte (buscadas do banco)
  const [globalSettings, setGlobalSettings] = useState({ whatsapp: '', pixKey: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate(`/${shopId}/login`);
        return;
      }

      try {
        // 1. Busca Usuário
        const userDocRef = doc(db, `artifacts/${shopId}/public/data/users/${currentUser.uid}`);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
           const userData = userSnap.data();
           setRole(userData.role);
           setUser(currentUser);

           // 2. Busca Configuração da Loja
           const storeDocRef = doc(db, `artifacts/${shopId}/public/data`);
           const storeSnap = await getDoc(storeDocRef);
           
           // 3. Busca Configurações Globais (WhatsApp do Suporte, Pagamentos)
           // Elas ficam salvas na loja Mestre (ABDUCH)
           const globalRef = doc(db, `artifacts/abduch/public/data/store_settings/global_config`);
           const globalSnap = await getDoc(globalRef);
           if (globalSnap.exists()) {
               setGlobalSettings(globalSnap.data());
           }

           // --- LÓGICA DE PLANOS E TRAVAS ---
           let finalPlan = 'Starter';

           // A. Se for o QG (ABDUCH), é sempre BLACK (Você nunca é bloqueado)
           if (shopId.toLowerCase() === 'abduch') {
               finalPlan = 'Black';
           } 
           else if (storeSnap.exists()) {
               const data = storeSnap.data();
               const now = new Date();
               
               // B. Verifica se está no Período de Teste (15 dias)
               if (data.trialEndsAt && now < data.trialEndsAt.toDate()) {
                   finalPlan = 'Black'; // Libera tudo durante o teste
               } else {
                   finalPlan = data.plan || 'Starter';
               }
           }
           
           setStorePlan(finalPlan);

        } else {
           navigate(`/${shopId}/login`);
        }
      } catch (error) {
        console.error("Erro layout:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [shopId, navigate]);

  if (loading) return (
    <div className="h-screen bg-black text-[#D4AF37] flex items-center justify-center font-bold tracking-widest animate-pulse">
        CARREGANDO CURLY...
    </div>
  );

  return (
    <div className="flex min-h-screen bg-black">
      {/* Passamos as configs globais para o Sidebar usar no botão Fale Conosco */}
      <Sidebar 
          userRole={role} 
          shopId={shopId} 
          storePlan={storePlan} 
          supportWhatsapp={globalSettings.whatsapp}
      />
      
      <main className="ml-64 flex-1 p-8 bg-[#050505] overflow-y-auto h-screen">
        <Outlet context={{ user, role, shopId, storePlan }} />
      </main>
    </div>
  );
}