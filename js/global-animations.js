(function() {
  // 1. Inject CSS for amazing animations and background globally
  const style = document.createElement('style');
  style.textContent = `
    body {
      background: linear-gradient(-45deg, #00060f, #021a17, #00060f, #04101e) !important;
      background-size: 400% 400% !important;
      animation: globalGradientBG 15s ease infinite !important;
      color: #f8fafc;
    }
    @keyframes globalGradientBG {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* Floating Particles Background */
    .global-particles {
      position: fixed;
      top: 0; left: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: -9999; /* Deep background */
    }
    .global-particle {
      position: absolute;
      background: radial-gradient(circle, rgba(79, 209, 197, 0.4) 0%, transparent 70%);
      border-radius: 50%;
      animation: globalFloatUp infinite linear;
    }
    @keyframes globalFloatUp {
      0% { transform: translateY(100vh) scale(0); opacity: 0; }
      20% { opacity: 1; transform: translateY(80vh) scale(1); }
      80% { opacity: 1; }
      100% { transform: translateY(-20vh) scale(0.5); opacity: 0; }
    }

    /* Scroll Animation Classes */
    .reveal-up { opacity: 0; transform: translateY(60px); transition: all 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .reveal-scale { opacity: 0; transform: scale(0.85); transition: all 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .reveal-left { opacity: 0; transform: translateX(-60px); transition: all 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .reveal-right { opacity: 0; transform: translateX(60px); transition: all 0.9s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
    .is-revealed { opacity: 1 !important; transform: translate(0) scale(1) !important; }
  `;
  document.head.appendChild(style);

  // 2. Add Particles container
  const particlesDiv = document.createElement('div');
  particlesDiv.className = 'global-particles';
  particlesDiv.id = 'global-particles';
  
  function initParticles() {
    // Only inject if it doesn't already exist
    if (!document.getElementById('global-particles')) {
      if (document.body) {
        document.body.insertBefore(particlesDiv, document.body.firstChild);
      } else {
        document.documentElement.appendChild(particlesDiv);
      }
      createParticles();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initParticles);
  } else {
    initParticles();
  }

  function createParticles() {
    const container = document.getElementById('global-particles');
    if (!container) return;
    for (let i = 0; i < 25; i++) {
      const p = document.createElement('div');
      p.className = 'global-particle';
      const size = Math.random() * 40 + 10;
      p.style.width = size + 'px';
      p.style.height = size + 'px';
      p.style.left = Math.random() * 100 + 'vw';
      p.style.animationDuration = (Math.random() * 12 + 6) + 's';
      p.style.animationDelay = Math.random() * 5 + 's';
      container.appendChild(p);
    }
  }

  // 3. Scroll Animations Observer
  document.addEventListener("DOMContentLoaded", function() {
    const observerOptions = { threshold: 0.1, rootMargin: "0px 0px -50px 0px" };
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.reveal-up, .reveal-scale, .reveal-left, .reveal-right').forEach((el) => {
      observer.observe(el);
    });
  });
})();
