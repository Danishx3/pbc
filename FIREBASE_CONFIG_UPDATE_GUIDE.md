# Firebase Configuration Update Guide

## Overview
Firebase configuration has been centralized into a single file (`firebase-config.js`) for better security and maintainability.

## What Was Done
1. Created `firebase-config.js` in the root directory with centralized Firebase configuration
2. Updated key files to use the centralized configuration
3. Removed inline Firebase configuration from updated files

## Files Already Updated
- ✅ auth.js
- ✅ index.html
- ✅ main.html
- ✅ login.html
- ✅ signup.html
- ✅ ilm/ilm.html
- ✅ quiz.html
- ✅ user.html
- ✅ admin/admin.html
- ✅ admin/demo.html
- ✅ admin/quiz.html
- ✅ admin/level1/fiqh.html
- ✅ level1/level1.html
- ✅ playlist/play.html

## Remaining Files to Update

About 50 files still need to be updated. The pattern is the same for all:

### For files in root directory:
1. Add `<script src="firebase-config.js"></script>` after Firebase SDK scripts
2. Remove the `firebaseConfig` object
3. Remove `firebase.initializeApp(firebaseConfig);`
4. Replace `const db = firebase.database();` and `const auth = firebase.auth();` with:
   ```javascript
   // Firebase is initialized in firebase-config.js
   const db = window.firebaseDb || firebase.database();
   const auth = window.firebaseAuth || firebase.auth();
   ```

### For files in subdirectories:
- `level1/`, `level2/`, `level3/`: Use `../firebase-config.js`
- `admin/level1/`, `admin/level2/`, `admin/level3/`: Use `../../firebase-config.js`
- `playlist/`: Use `../firebase-config.js`

## Example Update Pattern

**Before:**
```html
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js"></script>

<script>
  const firebaseConfig = {
    apiKey: "AIzaSyBWbtgmtGHStYogBtd4B6w7HelVr-OoZEE",
    authDomain: "piousbrothers-c5e99.firebaseapp.com",
    projectId: "piousbrothers-c5e99",
    storageBucket: "piousbrothers-c5e99.firebasestorage.app",
    messagingSenderId: "988225455952",
    appId: "1:988225455952:web:088c919b1b537caa3e8e55",
    measurementId: "G-5GYBVCJY9P"
  };
  firebase.initializeApp(firebaseConfig);
  const db = firebase.database();
  const auth = firebase.auth();
</script>
```

**After:**
```html
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-database-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js"></script>
<script src="firebase-config.js"></script>

<script>
  // Firebase is initialized in firebase-config.js
  const db = window.firebaseDb || firebase.database();
  const auth = window.firebaseAuth || firebase.auth();
</script>
```

## Security Notes

**Important:** Client-side Firebase configuration is always visible in the browser. The real security comes from:
1. **Firebase Security Rules** - Configure proper rules in Firebase Console
2. **Firebase App Check** - Enable App Check to protect your backend resources
3. **API Key Restrictions** - Restrict API keys by domain/origin in Google Cloud Console

The centralized configuration makes it easier to:
- Update the configuration in one place
- Manage and maintain the codebase
- Reduce the risk of configuration errors

## Next Steps

1. Update remaining HTML files following the pattern above
2. Test each page to ensure Firebase still works correctly
3. Configure Firebase Security Rules in Firebase Console
4. Consider enabling Firebase App Check for additional security

