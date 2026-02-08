//lib/firebase.ts


import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA3takg8JB26dUU0y1byqI8Ut97rB6Hh7o",
  authDomain: "slack-attendance-db.firebaseapp.com",
  projectId: "slack-attendance-db",
  storageBucket: "slack-attendance-db.firebasestorage.app",
  messagingSenderId: "340341315001",
  appId: "1:340341315001:web:fcc99478a04f2c2f781268"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };