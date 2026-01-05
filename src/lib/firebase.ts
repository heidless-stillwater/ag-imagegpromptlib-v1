import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
const firebaseConfig = {
    apiKey: "AIzaSyAQ1mxB2uj86qOAXlT_mUQitK61PQiqXYY",
    authDomain: "heidless-firebase.firebaseapp.com",
    projectId: "heidless-firebase",
    storageBucket: "heidless-firebase.firebasestorage.app",
    messagingSenderId: "232488530911",
    appId: "1:232488530911:web:26540803653cd063110a6a",
    measurementId: "G-Y5X8DBZ2FB"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with specific database ID and global settings
// Setting ignoreUndefinedProperties to true resolves many "invalid nested entity" errors
export const db = initializeFirestore(app, {
    ignoreUndefinedProperties: true,
}, 'imgprompt-db-0');

export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
