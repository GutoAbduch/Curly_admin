// src/config/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";       // <--- Importação necessária
import { getFirestore } from "firebase/firestore"; // <--- Importação necessária

const firebaseConfig = {
  apiKey: "AIzaSyCvH-bZXnON0RaiBjC6vbx4Jd23GQtyPlg",
  authDomain: "renovos-admin-78f46.firebaseapp.com",
  projectId: "renovos-admin-78f46",
  storageBucket: "renovos-admin-78f46.firebasestorage.app",
  messagingSenderId: "411846036128",
  appId: "1:411846036128:web:8e20bae55e56ddde1c17c5"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa e EXPORTA os serviços para usar no resto do site
export const auth = getAuth(app);
export const db = getFirestore(app);