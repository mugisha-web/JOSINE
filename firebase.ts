
// Fix: Use standard modular SDK imports from 'firebase/app' and 'firebase/auth'
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

/**
 * FIREBASE CONFIGURATION
 * Path: Firebase Console > Project Settings > General > Your apps
 */
const firebaseConfig = {
  apiKey: "AIzaSyDywwVldj9q7Lu4N1NzyiB5Wywla8LcAYk",
  authDomain: "igihozo.firebaseapp.com",
  projectId: "igihozo",
  storageBucket: "igihozo.firebasestorage.app",
  messagingSenderId: "482765886496",
  appId: "1:482765886496:web:399b83da03ca85e8ec9845",
  measurementId: "G-B2T75PQB0C"
};

// Initialize Firebase with the modular SDK
const app = initializeApp(firebaseConfig);

// Initialize and export Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
