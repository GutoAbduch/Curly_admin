import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const ClientAuthContext = createContext();

export function useClientAuth() {
  return useContext(ClientAuthContext);
}

export function ClientAuthProvider({ children }) {
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);

  // Salva dados do cliente no Firestore (coleção 'clients')
  const saveClientProfile = async (user, additionalData = {}) => {
      const clientRef = doc(db, 'clients', user.uid);
      const snapshot = await getDoc(clientRef);
      
      if (!snapshot.exists()) {
          await setDoc(clientRef, {
              uid: user.uid,
              email: user.email,
              name: user.displayName || additionalData.name || '',
              phone: additionalData.phone || '',
              role: 'client', // Importante para diferenciar de admins
              createdAt: serverTimestamp(),
              photoUrl: user.photoURL || null
          });
      }
  };

  function signup(email, password, name, phone) {
    return createUserWithEmailAndPassword(auth, email, password).then(async (result) => {
        await updateProfile(result.user, { displayName: name });
        await saveClientProfile(result.user, { name, phone });
        return result.user;
    });
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setClient(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    client,
    signup,
    login,
    logout
  };

  return (
    <ClientAuthContext.Provider value={value}>
      {!loading && children}
    </ClientAuthContext.Provider>
  );
}