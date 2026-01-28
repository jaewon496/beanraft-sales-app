// Firebase 설정
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBGYNPDCLpuAJqwNWzuoLBp_o0DuqjfHNE",
  authDomain: "beancraft-sales.firebaseapp.com",
  projectId: "beancraft-sales",
  storageBucket: "beancraft-sales.firebasestorage.app",
  messagingSenderId: "692498037498",
  appId: "1:692498037498:web:ae0b98765d7a5c4a8d5e7f"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export default app;
