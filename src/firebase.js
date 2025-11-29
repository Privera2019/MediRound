// src/firebase.js — MediRound Firebase

import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
} from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyAoL667IWaP-cjF1acNxeXAqRTLaY7Iq1o",
  authDomain: "mediround-7e4c7.firebaseapp.com",
  projectId: "mediround-7e4c7",
  storageBucket: "mediround-7e4c7.firebasestorage.app",
  messagingSenderId: "754741515165",
  appId: "1:754741515165:web:2f8a44d91a0e9ea20d5574",
  measurementId: "G-HCMNDNQM0C",
};

const app = initializeApp(firebaseConfig);

// Analytics will only work in a browser with proper environment (https)
try {
  getAnalytics(app);
} catch (e) {
  // ignore analytics errors in dev
}

export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
};