  (function () {
      const page  = document.querySelector('.page');
      const root  = document.documentElement;

      function setGalleryLeft() {
        // getBoundingClientRect gives the true rendered left edge of .page,
        // including the auto-centering margin. Add scrollX in case page is
        // scrolled horizontally (rare, but correct).
        const left = page.getBoundingClientRect().left + window.scrollX;
        // Also include .page's own padding-left so the first card lines
        // up with the text, not the page box edge.
        const style = getComputedStyle(page);
        const pagePad = parseFloat(style.paddingLeft) || 0;
        root.style.setProperty('--gallery-left', (left + pagePad) + 'px');
      }

      setGalleryLeft();
      window.addEventListener('resize', setGalleryLeft);
    })();
 
 (function () {
      const track = document.getElementById('gallery');

      // ── State ──────────────────────────────────────────────────────
      let isDragging   = false;
      let startX       = 0;
      let scrollStart  = 0;

      // Momentum / physics state
      let velocity     = 0;     // px/frame
      let lastX        = 0;
      let lastTime     = 0;
      let rafId        = null;

      // Spring state (for bounce beyond edges)
      let overscroll   = 0;     // virtual overscroll amount in px
      let isSpinging   = false;

      // Tunables
      const FRICTION   = 0.98;  // momentum decay per frame (lower = more friction)
      const SPRING_K   = 0.08;  // spring stiffness (higher = snappier)
      const SPRING_D   = 0.55;  // spring damping  (higher = less bouncy)
      const MAX_OVER   = 400;   // max overscroll drag distance in px
      let springVel    = 0;

      // ── Helpers ────────────────────────────────────────────────────
      const maxScroll = () => track.scrollWidth - track.clientWidth;

      function clampedScroll() {
        return Math.max(0, Math.min(track.scrollLeft, maxScroll()));
      }

      function applyTranslate(px) {
        // Visual rubber-band: shift the inner flex content via transform
        track.style.transform = `translateX(${px}px)`;
      }

      function cancelRAF() {
        if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      }

      // ── Spring animation after release ─────────────────────────────
      function springBack() {
        isSpinging = true;
        const max  = maxScroll();
        const snap = Math.max(0, Math.min(track.scrollLeft + overscroll, max));

        // How far are we over the edge?
        let displacement = overscroll;
        springVel = velocity;

        function step() {
          // Spring: F = -k*x - d*v
          const force = -SPRING_K * displacement - SPRING_D * springVel;
          springVel  += force;
          displacement += springVel;

          applyTranslate(-displacement);

          if (Math.abs(displacement) < 0.5 && Math.abs(springVel) < 0.5) {
            // Settled — commit real scroll and clear transform
            applyTranslate(0);
            overscroll  = 0;
            springVel   = 0;
            isSpinging  = false;
            rafId = null;
            return;
          }
          rafId = requestAnimationFrame(step);
        }
        rafId = requestAnimationFrame(step);
      }

      // ── Momentum glide after release ───────────────────────────────
      function glide() {
        velocity *= FRICTION;

        if (Math.abs(velocity) < 0.5) {
          velocity = 0;
          // Check if we need to spring back from an edge
          const over = track.scrollLeft < 0
            ? track.scrollLeft
            : track.scrollLeft > maxScroll()
              ? track.scrollLeft - maxScroll()
              : 0;
          if (Math.abs(over) > 1) {
            overscroll = over;
            springBack();
          } else {
            rafId = null;
          }
          return;
        }

        track.scrollLeft -= velocity;
        rafId = requestAnimationFrame(glide);
      }

      // ── Mouse events ───────────────────────────────────────────────
      track.addEventListener('mousedown', (e) => {
        cancelRAF();
        isDragging  = true;
        startX      = e.pageX;
        scrollStart = track.scrollLeft;
        lastX       = e.pageX;
        lastTime    = performance.now();
        velocity    = 0;
        overscroll  = 0;
        applyTranslate(0);
        track.classList.add('is-dragging');
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const dx   = e.pageX - lastX;
        const now  = performance.now();
        const dt   = Math.max(1, now - lastTime);
        velocity   = (dx / dt) * 16; // normalise to ~60fps frame
        lastX      = e.pageX;
        lastTime   = now;

        const raw  = scrollStart - (e.pageX - startX);
        const max  = maxScroll();

        if (raw < 0) {
          // Rubber-band left edge
          const over   = -raw;
          const resist = MAX_OVER * (1 - Math.exp(-over / MAX_OVER));
          track.scrollLeft = 0;
          applyTranslate(resist);
          overscroll = -resist;
        } else if (raw > max) {
          // Rubber-band right edge
          const over   = raw - max;
          const resist = MAX_OVER * (1 - Math.exp(-over / MAX_OVER));
          track.scrollLeft = max;
          applyTranslate(-resist);
          overscroll = resist;
        } else {
          track.scrollLeft = raw;
          overscroll = 0;
          applyTranslate(0);
        }
      });

      document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        track.classList.remove('is-dragging');

        if (overscroll !== 0) {
          springBack();
        } else {
          rafId = requestAnimationFrame(glide);
        }
      });

      // ── Touch events (iOS gets native bounce; this covers Android) ──
      track.addEventListener('touchstart', (e) => {
        cancelRAF();
        startX      = e.touches[0].pageX;
        scrollStart = track.scrollLeft;
        lastX       = startX;
        lastTime    = performance.now();
        velocity    = 0;
        overscroll  = 0;
        applyTranslate(0);
      }, { passive: true });

      track.addEventListener('touchmove', (e) => {
        const x    = e.touches[0].pageX;
        const dx   = x - lastX;
        const now  = performance.now();
        const dt   = Math.max(1, now - lastTime);
        velocity   = (dx / dt) * 16;
        lastX      = x;
        lastTime   = now;

        const raw  = scrollStart - (x - startX);
        const max  = maxScroll();

        if (raw < 0) {
          const resist = MAX_OVER * (1 - Math.exp(-(-raw) / MAX_OVER));
          track.scrollLeft = 0;
          applyTranslate(resist);
          overscroll = -resist;
        } else if (raw > max) {
          const resist = MAX_OVER * (1 - Math.exp(-(raw - max) / MAX_OVER));
          track.scrollLeft = max;
          applyTranslate(-resist);
          overscroll = resist;
        } else {
          track.scrollLeft = raw;
          overscroll = 0;
          applyTranslate(0);
        }
      }, { passive: true });

      track.addEventListener('touchend', () => {
        if (overscroll !== 0) {
          springBack();
        } else {
          rafId = requestAnimationFrame(glide);
        }
      });

    })();


    const track = document.querySelector('.gallery-track');

new IntersectionObserver(([entry], obs) => {
  if (entry.isIntersecting) {
    track.classList.add('is-visible');
    obs.disconnect();
  }
}, { threshold: 0.15 }).observe(track);