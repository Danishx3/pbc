// --- Global Theme Logic ---
(function() {
  function applyTheme(theme) {
    let isDark = true;
    if (theme === 'light') {
      isDark = false;
    } else if (theme === 'dark') {
      isDark = true;
    } else {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      document.body.classList.add('black');
      document.body.classList.remove('black1', 'light-theme');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.body.classList.remove('black');
      document.body.classList.add('black1', 'light-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    
    try {
      localStorage.setItem('pbc_theme', theme);
    } catch(e) {}

    // Update theme toggle icons across the page if any
    const toggleIcon = document.getElementById('themeToggleIcon');
    if (toggleIcon) {
      toggleIcon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme, isDark: isDark } }));
  }

  const applyInitialTheme = () => {
    const savedTheme = (function() {
      try { return localStorage.getItem('pbc_theme') || 'light'; }
      catch(e) { return 'light'; }
    })();
    applyTheme(savedTheme);
  };

  if (document.body) {
    applyInitialTheme();
  } else {
    document.addEventListener('DOMContentLoaded', applyInitialTheme);
  }

  // Expose to window so dropdowns or direct toggle buttons can call it
  window.changePBCTheme = applyTheme;

  // Direct toggle function (Light <-> Dark)
  window.togglePBCTheme = function() {
    const savedTheme = localStorage.getItem('pbc_theme') || 'light';
    let isCurrentDark = false;
    if (savedTheme === 'dark') {
      isCurrentDark = true;
    } else if (savedTheme === 'light') {
      isCurrentDark = false;
    } else {
      isCurrentDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    const nextTheme = isCurrentDark ? 'light' : 'dark';
    applyTheme(nextTheme);
  };

  // Sync theme changes across tabs/iframes
  window.addEventListener('storage', (e) => {
    if (e.key === 'pbc_theme') {
      applyTheme(e.newValue || 'light');
    }
  });

  // Re-sync icon state when DOM loads, in case DOM wasn't ready during head execution
  document.addEventListener('DOMContentLoaded', () => {
    const isDark = document.body.classList.contains('black') || document.documentElement.getAttribute('data-theme') === 'dark';
    const toggleIcon = document.getElementById('themeToggleIcon');
    if (toggleIcon) {
      toggleIcon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
    }
  });
})();

