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

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);

  // Make db and auth globally available for convenience
  // Note: You can also access them via firebase.database() and firebase.auth() directly
  if (typeof window !== 'undefined') {
    window.firebaseDb = firebase.database();
    window.firebaseAuth = firebase.auth();

    // Global Tracking Logic
    (function() {
      try {
        const db = window.firebaseDb;
        const date = new Date();
        const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        
        // 1. Always increment Page Views (every load)
        db.ref('analytics/site/totalPageViews').transaction(count => (count || 0) + 1);
        db.ref('analytics/site/dailyPageViews/' + today).transaction(count => (count || 0) + 1);
        
        // 2. Increment Visitors only once per session
        if (!sessionStorage.getItem('ilmify_global_visited')) {
          db.ref('analytics/site/totalVisitors').transaction(count => (count || 0) + 1);
          db.ref('analytics/site/dailyVisitors/' + today).transaction(count => (count || 0) + 1);
          sessionStorage.setItem('ilmify_global_visited', 'true');
        }
      } catch (e) {
        console.warn('Tracking initialization failed', e);
      }
    })();
  }
} else {
  console.warn('Firebase SDK not loaded. Make sure to include Firebase scripts before this config file.');
}


