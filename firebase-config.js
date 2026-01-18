/**
 * Firebase Configuration - Centralized Configuration File
 * 
 * IMPORTANT SECURITY NOTES:
 * 1. Client-side Firebase configs are always visible in the browser's source code
 * 2. The API key is not a secret - it's meant to be public and is restricted by domain/origin
 * 3. REAL SECURITY comes from Firebase Security Rules in Firebase Console
 * 4. Always configure proper Security Rules for Firebase Realtime Database, Firestore, and Storage
 * 5. Use Firebase App Check to protect your backend resources
 * 
 * This centralized file makes it easier to manage and update the configuration.
 * To change the config, update it here and it will be used across all pages.
 */

// Firebase Configuration Object
const firebaseConfig = {
  apiKey: "AIzaSyBWbtgmtGHStYogBtd4B6w7HelVr-OoZEE",
  authDomain: "piousbrothers-c5e99.firebaseapp.com",
  projectId: "piousbrothers-c5e99",
  storageBucket: "piousbrothers-c5e99.firebasestorage.app",
  messagingSenderId: "988225455952",
  appId: "1:988225455952:web:088c919b1b537caa3e8e55",
  measurementId: "G-5GYBVCJY9P"
};

// Initialize Firebase (only if Firebase SDK is loaded)
if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
  
  // Make db and auth globally available for convenience
  // Note: You can also access them via firebase.database() and firebase.auth() directly
  if (typeof window !== 'undefined') {
    window.firebaseDb = firebase.database();
    window.firebaseAuth = firebase.auth();
  }
} else {
  console.warn('Firebase SDK not loaded. Make sure to include Firebase scripts before this config file.');
}


