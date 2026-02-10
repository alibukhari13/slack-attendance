//lib/firebase.ts


import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA8aWCd-cTG7QFlw6XqUx-te6SVjmM2T2Y",
  authDomain: "db-manager-86b40.firebaseapp.com",
  projectId: "db-manager-86b40",
  storageBucket: "db-manager-86b40.firebasestorage.app",
  messagingSenderId: "25423726916",
  appId: "1:25423726916:web:4feec5cefcd28126eb6f11"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };