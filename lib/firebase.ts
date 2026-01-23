import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAPN0AepAH7P3kwCQQGxmSC-mklMS_qIfk",
  authDomain: "space-exploration-70eb6.firebaseapp.com",
  projectId: "space-exploration-70eb6",
  storageBucket: "space-exploration-70eb6.firebasestorage.app",
  messagingSenderId: "525608290324",
  appId: "1:525608290324:web:bea8b3a283bc60535f3f01",
  measurementId: "G-NPHLQR6CTH"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export { db };