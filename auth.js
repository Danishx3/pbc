// Firebase is initialized in firebase-config.js
// Use the global instances or access directly
const db = window.firebaseDb || firebase.database();
const auth = window.firebaseAuth || firebase.auth();
    
        auth.onAuthStateChanged(user => {
    if (user) {
      // User is logged in, now fetch their username
      db.ref('users/' + user.uid).once('value')
        .then(snapshot => {
          const username = snapshot.val().username;
          document.getElementById("welcomeMessage").innerText = `Welcome, ${username}!`;
        })
        .catch(error => {
          console.error(error);
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