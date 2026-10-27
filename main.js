/* Spandan Ghoshal — site interactions
   Scroll reveals, masthead shadow, mobile navigation. */

(function () {
  "use strict";

  /* Masthead shadow on scroll */
  var masthead = document.querySelector(".masthead");
  if (masthead) {
    var onScroll = function () {
      masthead.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* Mobile nav toggle */
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  /* Scroll-reveal via IntersectionObserver */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* Animate the change-point figure when it scrolls into view */
  var fig = document.querySelector(".fig-frame");
  if (fig && "IntersectionObserver" in window) {
    var figIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            fig.classList.add("fig-animate");
            figIo.unobserve(fig);
          }
        });
      },
      { threshold: 0.35 }
    );
    figIo.observe(fig);
  } else if (fig) {
    fig.classList.add("fig-animate");
  }

  /* Mandala background layer: two large mandalas that turn slowly as the page scrolls */
  (function () {
    var layer = document.createElement("div");
    layer.className = "mandala-layer";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = '<div class="mandala mandala--a"></div><div class="mandala mandala--b"></div>';
    document.body.insertBefore(layer, document.body.firstChild);
    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    var ticking = false;
    var update = function () {
      layer.style.setProperty("--spin", (window.scrollY * 0.05).toFixed(2));
      ticking = false;
    };
    window.addEventListener("scroll", function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* Footer year */
  var year = document.querySelector("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
})();
