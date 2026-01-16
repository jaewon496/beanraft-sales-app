import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBRrxkXnyGd3HKXFKEUB2o15sY8U2N2Mic",
  authDomain: "beancraft-sales-team.firebaseapp.com",
  databaseURL: "https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beancraft-sales-team",
  storageBucket: "beancraft-sales-team.firebasestorage.app",
  messagingSenderId: "995629604879",
  appId: "1:995629604879:web:eb60f4b66c6c5c936f1d77"
};

const firebase = initializeApp(firebaseConfig);
const database = getDatabase(firebase);

export { firebase, database };
