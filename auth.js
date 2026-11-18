// Firebase is initialized in firebase-config.js
// Use the global instances or access directly
const db = window.firebaseDb || firebase.database();
const auth = window.firebaseAuth || firebase.auth();
    
        auth.onAuthStateChanged(user => {
    if (user) {
      // User is logged in, now fetch their username
      db.ref('users/' + user.uid).once('value')
        .then(snapshot => {
          const data = snapshot.val();
          const username = (data && data.username) ? data.username : (user.displayName || (user.email ? user.email.split('@')[0] : 'Scholar'));
          const el = document.getElementById("welcomeMessage");
          if (el) el.innerText = `Welcome, ${username}!`;

          if (!data || !data.username) {
            db.ref('users/' + user.uid).update({
              username: username,
              email: user.email || '',
              photoURL: user.photoURL || '',
              lastLogin: Date.now()
            }).catch(console.warn);
          }
        })
        .catch(error => {
          console.error(error);
          const fallback = user.displayName || (user.email ? user.email.split('@')[0] : 'Scholar');
          const el = document.getElementById("welcomeMessage");
          if (el) el.innerText = `Welcome, ${fallback}!`;
        });
    } else {
      window.location.href = "login.html"; // Not logged in, redirect
    }
  });
  
  function logout() {
    auth.signOut().then(() => {
      window.location.href = "login.html";
    });
  }