import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDaa83rPLVOPjvdL_Xs6lrW1Xd9P60uXtM",
  authDomain: "scanpress-cb23b.firebaseapp.com",
  projectId: "scanpress-cb23b",
  storageBucket: "scanpress-cb23b.firebasestorage.app",
  messagingSenderId: "337392697712",
  appId: "1:337392697712:web:69ba953ce80dab65778fb5"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;