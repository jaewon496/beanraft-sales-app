import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBRrxkXnyGd3HKXFKEUB2o15sY8U2N2Mic",
  authDomain: "beancraft-sales-team.firebaseapp.com",
  databaseURL: "https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beancraft-sales-team",
  storageBucket: "beancraft-sales-team.firebasestorage.app",
  messagingSenderId: "803745881200",
  appId: "1:803745881200:web:fb430162f761e3ecdba8b5"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

export { app as firebase, database, auth };
