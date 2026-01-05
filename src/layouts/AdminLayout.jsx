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
  const [storePlan, setStorePlan] = useState('Starter'); // Valor padrão seguro
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate(`/${shopId}/login`);
        return;
      }

      try {
        // 1. Busca dados do Usuário (Cargo/Role)
        const userDocRef = doc(db, `artifacts/${shopId}/public/data/users/${currentUser.uid}`);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
           const userData = userSnap.data();
           setRole(userData.role);
           setUser(currentUser);

           // 2. Busca dados da Loja (PLANO ATUAL)
           // Lendo diretamente da configuração pública da loja
           const storeDocRef = doc(db, `artifacts/${shopId}/public/data`);
           const storeSnap = await getDoc(storeDocRef);
           
           if (storeSnap.exists()) {
               const storeData = storeSnap.data();
               // Se não tiver plano definido no banco, assume 'Starter'
               setStorePlan(storeData.plan || 'Starter');
           }

        } else {
           // Usuário logado no Auth mas sem registro nesta loja
           navigate(`/${shopId}/login`);
        }
      } catch (error) {
        console.error("Erro ao carregar layout:", error);
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
      {/* Passamos o Plano para o Sidebar controlar os menus */}
      <Sidebar userRole={role} shopId={shopId} storePlan={storePlan} />
      
      <main className="ml-64 flex-1 p-8 bg-[#050505] overflow-y-auto h-screen">
        {/* Passamos o Plano para as páginas internas (Users, Finance, etc) */}
        <Outlet context={{ user, role, shopId, storePlan }} />
      </main>
    </div>
  );
}