// Firebase compat 모드 (기존 v8 스타일 코드 호환)
import firebase from 'firebase/compat/app';
import 'firebase/compat/database';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBRrxkXnyGd3HKXFKEUB2o15sY8U2N2Mic",
  authDomain: "beancraft-sales-team.firebaseapp.com",
  databaseURL: "https://beancraft-sales-team-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "beancraft-sales-team",
  storageBucket: "beancraft-sales-team.firebasestorage.app",
  messagingSenderId: "803745881200",
  appId: "1:803745881200:web:fb430162f761e3ecdba8b5"
};

// Firebase 초기화 (이미 초기화된 경우 기존 앱 사용)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const database = firebase.database();

// 내보내기
export { firebase, database };
