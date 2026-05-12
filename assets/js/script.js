(() => {
  "use strict";

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const debounce = (fn, wait = 150) => {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const MOBILE_BREAKPOINT = "(max-width: 640px)";
  const SLIDE_TRANSITION_MS = 450;

  // -----------------------------------------------------------------
  // Smooth anchors
  // -----------------------------------------------------------------
  const initSmoothAnchors = () => {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      anchor.addEventListener("click", (event) => {
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({
          behavior: reducedMotion.matches ? "auto" : "smooth",
          block: "start",
        });
      });
    });
  };

  // -----------------------------------------------------------------
  // Stages slider (grid on desktop, swipe-like carousel on mobile)
  // -----------------------------------------------------------------
  // Each tuple groups desktop stage items (by zero-based index) into a
  // single mobile slide. Plane illustration is rendered only inside the
  // first slide.
  const MOBILE_SLIDE_GROUPS = [[0, 1], [2], [3, 4], [5], [6]];

  const createStagesSlider = () => {
    const root = document.querySelector('[data-slider="stages"]');
    if (!root) return;

    const track = root.querySelector(".stages-slider__track");
    const prevBtn = root.querySelector(".circle-btn--prev");
    const nextBtn = root.querySelector(".circle-btn--next");
    const dotsRoot = root.querySelector(".dots");
    if (!track || !prevBtn || !nextBtn || !dotsRoot) return;

    const desktopMarkup = track.innerHTML;

    let index = 0;
    let maxIndex = 0;
    let slideStep = 0;
    let mobileBuilt = false;
    let isAnimating = false;

    const getStageData = (item) => {
      const num = item.querySelector("b")?.textContent?.trim() || "";
      const full = item.textContent.replace(/\s+/g, " ").trim();
      const text = full.replace(new RegExp(`^${num}\\s*`), "").trim();
      return { num, text };
    };

    const buildMobileSlides = () => {
      const data = Array.from(track.children).map(getStageData);

      track.innerHTML = MOBILE_SLIDE_GROUPS
        .map((group, slideIdx) => {
          const rows = group
            .map((idx) => {
              const item = data[idx];
              if (!item) return "";
              return `<div class="stage-mobile-row"><b>${item.num}</b><span>${item.text}</span></div>`;
            })
            .join("");
          const plane =
            slideIdx === 0
              ? '<img src="./assets/img/airplane.png" alt="" class="stage-mobile-plane" width="401" height="235" />'
              : "";
          return `
            <div class="stage-slide">
              ${plane}
              <article class="stage-item stage-item--mobile">${rows}</article>
            </div>
          `;
        })
        .join("");
      mobileBuilt = true;
    };

    const buildDots = () => {
      dotsRoot.innerHTML = "";
      Array.from(track.children).forEach((_, idx) => {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.dataset.dot = String(idx);
        if (idx === index) dot.classList.add("is-active");
        dotsRoot.append(dot);
      });
    };

    const setDots = () => {
      Array.from(dotsRoot.children).forEach((dot, idx) => {
        dot.classList.toggle("is-active", idx === index);
      });
    };

    const update = () => {
      track.style.transform = `translateX(-${index * slideStep}px)`;
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index >= maxIndex;
      setDots();
    };

    const recalc = () => {
      const isMobile = window.matchMedia(MOBILE_BREAKPOINT).matches;

      if (isMobile && !mobileBuilt) {
        buildMobileSlides();
        index = 0;
      } else if (!isMobile && mobileBuilt) {
        track.innerHTML = desktopMarkup;
        mobileBuilt = false;
        index = 0;
      }

      const currentSlides = Array.from(track.children);
      const perView = isMobile ? 1 : currentSlides.length;
      maxIndex = Math.max(currentSlides.length - perView, 0);
      index = clamp(index, 0, maxIndex);

      const firstSlide = currentSlides[0];
      if (!firstSlide) return;
      const styles = getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || "0");
      slideStep = firstSlide.getBoundingClientRect().width + gap;

      buildDots();
      update();
    };

    const go = (delta) => {
      if (isAnimating) return;
      const next = clamp(index + delta, 0, maxIndex);
      if (next === index) return;
      isAnimating = true;
      index = next;
      update();
      setTimeout(() => {
        isAnimating = false;
      }, SLIDE_TRANSITION_MS);
    };

    prevBtn.addEventListener("click", () => go(-1));
    nextBtn.addEventListener("click", () => go(1));

    window.addEventListener("resize", debounce(recalc, 150));
    recalc();
  };

  // -----------------------------------------------------------------
  // Members slider (3 / 2 / 1 per view + autoplay)
  // -----------------------------------------------------------------
  const AUTOPLAY_INTERVAL = 4000;

  const createMembersSlider = () => {
    const section = document.querySelector(".members");
    const root = document.querySelector('[data-slider="members"]');
    if (!root || !section) return;

    const track = root.querySelector(".members-slider__track");
    const prevBtn = section.querySelector(".circle-btn--prev");
    const nextBtn = section.querySelector(".circle-btn--next");
    const counter = section.querySelector(".members__counter");
    if (!track || !prevBtn || !nextBtn || !counter) return;

    const slides = Array.from(track.children);

    let page = 0;
    let perView = 3;
    let totalPages = 1;
    let step = 0;
    let timer = null;
    let isAnimating = false;

    const setCounter = () => {
      const shown = Math.min((page + 1) * perView, slides.length);
      counter.textContent = `${shown} / ${slides.length}`;
    };

    const update = (animate = true) => {
      track.style.transition =
        animate && !reducedMotion.matches ? `transform var(--transition-slide, 0.45s ease)` : "none";
      track.style.transform = `translateX(-${page * perView * step}px)`;
      prevBtn.disabled = page === 0;
      nextBtn.disabled = page >= totalPages - 1;
      setCounter();
    };

    const move = (delta, userInitiated = false) => {
      if (isAnimating) return;
      const next = clamp(page + delta, 0, totalPages - 1);
      if (next === page) return;
      isAnimating = true;
      page = next;
      update(true);
      setTimeout(() => {
        isAnimating = false;
      }, SLIDE_TRANSITION_MS);
      if (userInitiated) startAutoplay();
    };

    const recalc = () => {
      perView = window.matchMedia(MOBILE_BREAKPOINT).matches
        ? 1
        : window.matchMedia("(max-width: 900px)").matches
          ? 2
          : 3;
      totalPages = Math.ceil(slides.length / perView);
      page = 0;
      const firstReal = track.children[0];
      if (!firstReal) return;
      const styles = getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || "0");
      step = firstReal.getBoundingClientRect().width + gap;
      update(false);
    };

    const startAutoplay = () => {
      stopAutoplay();
      if (reducedMotion.matches) return;
      if (document.hidden) return;
      timer = setInterval(() => move(1), AUTOPLAY_INTERVAL);
    };

    const stopAutoplay = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    prevBtn.addEventListener("click", () => move(-1, true));
    nextBtn.addEventListener("click", () => move(1, true));

    root.addEventListener("mouseenter", stopAutoplay);
    root.addEventListener("mouseleave", startAutoplay);
    root.addEventListener("focusin", stopAutoplay);
    root.addEventListener("focusout", startAutoplay);

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopAutoplay();
      else startAutoplay();
    });

    reducedMotion.addEventListener?.("change", () => {
      if (reducedMotion.matches) stopAutoplay();
      else startAutoplay();
    });

    window.addEventListener("resize", debounce(recalc, 150));

    recalc();
    startAutoplay();
  };

  // -----------------------------------------------------------------
  // Boot
  // -----------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    initSmoothAnchors();
    createStagesSlider();
    createMembersSlider();
  });
})();
