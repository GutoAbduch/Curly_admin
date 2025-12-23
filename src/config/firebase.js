import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <--- NOVO

const firebaseConfig = {
  apiKey: "AIzaSyCvH-bZXnON0RaiBjC6vbx4Jd23GQtyPlg",
  authDomain: "renovos-admin-78f46.firebaseapp.com",
  projectId: "renovos-admin-78f46",
  storageBucket: "renovos-admin-78f46.firebasestorage.app", // Verifique se isso está correto no seu console
  messagingSenderId: "411846036128",
  appId: "1:411846036128:web:8e20bae55e56ddde1c17c5"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // <--- NOVO: Exportamos o storage para usar nas páginas