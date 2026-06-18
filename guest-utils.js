// Guest Mode Utility Functions for ILMIFY

/**
 * Check if user is in guest mode
 * @returns {boolean} True if user is in guest mode
 */
function isGuestMode() {
    return localStorage.getItem('guestMode') === 'true';
}

/**
 * Enable guest mode
 */
function enableGuestMode() {
    localStorage.setItem('guestMode', 'true');
    localStorage.setItem('guestStartTime', Date.now().toString());
}

/**
 * Disable guest mode (when user logs in)
 */
function disableGuestMode() {
    localStorage.removeItem('guestMode');
    localStorage.removeItem('guestStartTime');
    localStorage.removeItem('guestBannerDismissed');
}

/**
 * Require authentication - redirect to login if not authenticated
 * @param {string} message - Message to show on login page
 * @param {string} returnUrl - URL to return to after login
 */
function requireAuth(message = 'Please login to access this feature', returnUrl = null) {
    if (isGuestMode()) {
        // Store return URL and message for after login

        localStorage.setItem('authMessage', message);

        // Redirect to login (guest mode stays active so they can still browse)
        alert(message + '\n\nYou can login/signup to access this feature, or continue browsing as a guest.');
        window.location.href = 'login.html';
        return false;
    }
    return true;
}

/**
 * Show guest mode banner
 */
function showGuestBanner() {
    // Check if banner was dismissed in this session
    if (sessionStorage.getItem('guestBannerDismissed') === 'true') {
        return;
    }

    // Create banner if it doesn't exist
    if (document.getElementById('guestBanner')) {
        return;
    }

    const banner = document.createElement('div');
    banner.id = 'guestBanner';
    banner.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #0d564f, #1a7a70);
            color: white;
            padding: 12px 20px;
            text-align: center;
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideDown 0.3s ease-out;
        ">
            <div style="max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                <div style="flex: 1; min-width: 200px;">
                    <i class="fas fa-user-circle" style="margin-right: 8px;"></i>
                    <strong>Browsing as Guest</strong> - 
                    <span style="opacity: 0.9;">Sign up to unlock all features, save progress, and more!</span>
                </div>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button onclick="window.location.href='signup.html'" style="
                        background: white;
                        color: #0d564f;
                        border: none;
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: 14px;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        Sign Up Free
                    </button>
                    <button onclick="window.location.href='login.html'" style="
                        background: rgba(255,255,255,0.2);
                        color: white;
                        border: 1px solid white;
                        padding: 8px 20px;
                        border-radius: 20px;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        font-size: 14px;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        Login
                    </button>
                    <button onclick="dismissGuestBanner()" style="
                        background: none;
                        border: none;
                        color: white;
                        font-size: 20px;
                        cursor: pointer;
                        padding: 0 5px;
                        opacity: 0.8;
                    " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'">
                        ×
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Add padding to body to prevent content from being hidden under banner
    document.body.style.paddingTop = '60px';

    // Add animation keyframes
    if (!document.getElementById('guestBannerStyles')) {
        const style = document.createElement('style');
        style.id = 'guestBannerStyles';
        style.textContent = `
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
            @media (max-width: 768px) {
                #guestBanner > div > div {
                    flex-direction: column;
                    text-align: center;
                }
                #guestBanner button {
                    width: 100%;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

/**
 * Dismiss guest banner for this session
 */
function dismissGuestBanner() {
    const banner = document.getElementById('guestBanner');
    if (banner) {
        banner.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            banner.remove();
            document.body.style.paddingTop = '0';
        }, 300);
    }
    sessionStorage.setItem('guestBannerDismissed', 'true');
}

/**
 * Initialize guest mode on page load
 */
function initGuestMode() {
    if (isGuestMode()) {
        showGuestBanner();

        // Update navigation buttons
        updateNavigationForGuest();
    }
}

/**
 * Update navigation buttons for guest mode
 */
function updateNavigationForGuest() {
    // Find logout button and replace with login/signup
    const logoutButtons = document.querySelectorAll('button[onclick*="logout"]');
    logoutButtons.forEach(btn => {
        btn.textContent = 'Login / Sign Up';
        btn.onclick = () => window.location.href = 'login.html';
    });

    // Hide chat widget if exists
    const chatFab = document.querySelector('.chat-fab');
    if (chatFab) {
        chatFab.style.display = 'none';
    }
}

/**
 * Get guest-friendly username
 * @returns {string} Username for display
 */
function getGuestUsername() {
    return 'Guest User';
}

/**
 * Check if feature requires authentication
 * @param {string} feature - Feature name
 * @returns {boolean} True if feature requires auth
 */
function requiresAuth(feature) {
    const authRequiredFeatures = [
        'donation',
        'chat',
        'quiz-progress',
        'user-profile',
        'settings'
    ];
    return authRequiredFeatures.includes(feature);
}

/**
 * Show feature locked message
 * @param {string} featureName - Name of the locked feature
 */
function showFeatureLockedMessage(featureName) {
    const message = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid #1a7a70;
            border-radius: 16px;
            padding: 40px;
            max-width: 400px;
            text-align: center;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        " id="featureLockedModal">
            <i class="fas fa-lock" style="font-size: 48px; color: #1a7a70; margin-bottom: 20px;"></i>
            <h3 style="color: #afe9da; margin-bottom: 15px; font-size: 24px;">Feature Locked</h3>
            <p style="color: rgba(255,255,255,0.8); margin-bottom: 25px; line-height: 1.6;">
                ${featureName} requires an account. Sign up for free to unlock this and many other features!
            </p>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button onclick="window.location.href='signup.html'" style="
                    background: linear-gradient(135deg, #0d564f, #1a7a70);
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    Sign Up Free
                </button>
                <button onclick="document.getElementById('featureLockedModal').remove()" style="
                    background: rgba(255,255,255,0.1);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.2);
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 16px;
                ">
                    Close
                </button>
            </div>
        </div>
        <div onclick="document.getElementById('featureLockedModal').remove()" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            z-index: 9999;
        " id="featureLockedBackdrop"></div>
    `;

    const container = document.createElement('div');
    container.innerHTML = message;
    document.body.appendChild(container);
}

// Auto-initialize on DOM load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGuestMode);
} else {
    initGuestMode();
}

/* ══════════════════════════════════════════
   GLOBAL PAGE LOADING ANIMATION
   Auto-injects a loader on every page that
   imports guest-utils.js. Fades out on load.
══════════════════════════════════════════ */
(function () {
    // Detect theme on initial script run (works immediately before HTML parsing is complete)
    const isLightTheme = (function () {
        try {
            const saved = localStorage.getItem('pbc_theme') || 'current';
            if (saved === 'light') return true;
            if (saved === 'dark') return false;
            return window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
        } catch (e) {
            return false;
        }
    })();

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        #pageLoader {
            position: fixed;
            inset: 0;
            z-index: 99999;
            background: linear-gradient(135deg, #0a1f1c 0%, #0d2b27 50%, #071a17 100%);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 28px;
            transition: opacity 0.5s ease, visibility 0.5s ease;
        }
        #pageLoader.light {
            background: linear-gradient(135deg, #f0f4f8 0%, #ffffff 50%, #edf2f7 100%) !important;
        }
        #pageLoader.hidden {
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
        }
        .loader-icon {
            font-size: 3.2rem;
            color: #1a9e8f;
            animation: loaderPulse 1.4s ease-in-out infinite;
            filter: drop-shadow(0 0 18px rgba(26,158,143,0.55));
        }
        #pageLoader.light .loader-icon {
            filter: drop-shadow(0 0 18px rgba(13, 148, 136, 0.15)) !important;
        }
        .loader-ring {
            width: 64px;
            height: 64px;
            border: 4px solid rgba(26,158,143,0.15);
            border-top-color: #1a9e8f;
            border-radius: 50%;
            animation: loaderSpin 0.85s linear infinite;
        }
        #pageLoader.light .loader-ring {
            border: 4px solid rgba(13, 148, 136, 0.15) !important;
            border-top-color: #0d9488 !important;
        }
        .loader-text {
            font-family: 'Anek Latin', 'Inter', sans-serif;
            font-size: 0.85rem;
            letter-spacing: 0.16em;
            color: rgba(174,233,218,0.55);
            text-transform: uppercase;
            animation: loaderFade 1.4s ease-in-out infinite;
        }
        #pageLoader.light .loader-text {
            color: #4a5568 !important;
        }
        @keyframes loaderSpin  { to { transform: rotate(360deg); } }
        @keyframes loaderPulse { 0%,100% { transform: scale(1);    opacity:.9; }
                                  50%    { transform: scale(1.12); opacity:1;  } }
        @keyframes loaderFade  { 0%,100% { opacity:.4; } 50% { opacity:.9; } }
    `;
    document.head.appendChild(style);

    // Inject loader HTML as first child of body (works even before DOMContentLoaded)
    function injectLoader() {
        if (document.getElementById('pageLoader')) return;
        const loader = document.createElement('div');
        loader.id = 'pageLoader';
        if (isLightTheme) {
            loader.className = 'light';
        }
        const logoSrc = isLightTheme ? '/app1.jpg' : '/logoo.png';
        loader.innerHTML = `
            <img src="${logoSrc}" alt="Ilmify" class="loader-icon" style="width:80px;height:80px;object-fit:contain;border-radius:16px;">
            <div class="loader-ring"></div>
            <span class="loader-text">Loading…</span>
        `;
        if (document.body) {
            document.body.insertBefore(loader, document.body.firstChild);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.insertBefore(loader, document.body.firstChild);
            });
        }
    }

    injectLoader();

    // Remove loader once everything (images, scripts) is fully loaded
    window.addEventListener('load', () => {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 550);
        }
    });
})();
