document.getElementById("year").textContent = new Date().getFullYear();

const THEME_KEY = "theme";
const root = document.documentElement;
const themeToggle = document.getElementById("themeToggle");

function applyTheme(theme) {
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

const storedTheme = localStorage.getItem(THEME_KEY);
if (storedTheme) {
  applyTheme(storedTheme);
}

themeToggle.addEventListener("click", () => {
  const isLight = root.getAttribute("data-theme") === "light";
  const next = isLight ? "dark" : "light";
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

const navToggle = document.getElementById("navToggle");
const navLinks = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("is-open");
  navToggle.classList.toggle("is-open", isOpen);
  navToggle.setAttribute("aria-expanded", isOpen);
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("is-open");
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".recommendation-toggle").forEach((btn) => {
  const text = btn.previousElementSibling;
  btn.addEventListener("click", () => {
    const expanded = text.classList.toggle("is-clamped") === false;
    btn.textContent = expanded ? "Show less" : "Show more";
  });
});

const revealTargets = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealTargets.forEach((el) => observer.observe(el));

/* Circuit-board background: Manhattan-routed traces with vias and
   traveling signal pulses, redrawn on resize/theme change, paused
   off-screen and for prefers-reduced-motion. */
(() => {
  const canvas = document.getElementById("bg-circuit");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const offscreen = document.createElement("canvas");
  const octx = offscreen.getContext("2d");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STEP = 48;
  let width = 0, height = 0, dpr = 1;
  let paths = [];
  let pulses = [];
  let rafId = null;

  function themeColor(varName, fallback) {
    const v = getComputedStyle(root).getPropertyValue(varName).trim();
    return v || fallback;
  }

  function hexToRgb(hex) {
    const m = hex.replace("#", "");
    const bigint = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }
  function randInt(min, max) {
    return Math.floor(rand(min, max + 1));
  }

  function generatePaths() {
    const cols = Math.max(2, Math.floor(width / STEP));
    const rows = Math.max(2, Math.floor(height / STEP));
    const count = Math.min(42, Math.max(10, Math.floor((width * height) / 42000)));
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    const result = [];

    for (let i = 0; i < count; i++) {
      let gx = randInt(0, cols);
      let gy = randInt(0, rows);
      const points = [{ x: gx * STEP, y: gy * STEP }];
      let dir = dirs[randInt(0, 3)];
      const segments = randInt(3, 7);

      for (let s = 0; s < segments; s++) {
        if (s > 0 && Math.random() > 0.55) {
          const perp = dirs.filter((d) => d.x * dir.x + d.y * dir.y === 0);
          dir = perp[randInt(0, perp.length - 1)];
        }
        const len = randInt(1, 4);
        const nx = gx + dir.x * len;
        const ny = gy + dir.y * len;
        if (nx < 0 || nx > cols || ny < 0 || ny > rows) break;
        gx = nx;
        gy = ny;
        points.push({ x: gx * STEP, y: gy * STEP });
      }

      if (points.length < 2) continue;

      let total = 0;
      const cum = [0];
      for (let p = 1; p < points.length; p++) {
        total += Math.hypot(points[p].x - points[p - 1].x, points[p].y - points[p - 1].y);
        cum.push(total);
      }

      result.push({ points, cum, total });
    }
    return result;
  }

  function pointAtFraction(path, frac) {
    const target = frac * path.total;
    const { points, cum } = path;
    for (let i = 1; i < cum.length; i++) {
      if (target <= cum[i]) {
        const segFrac = cum[i] === cum[i - 1] ? 0 : (target - cum[i - 1]) / (cum[i] - cum[i - 1]);
        return {
          x: points[i - 1].x + (points[i].x - points[i - 1].x) * segFrac,
          y: points[i - 1].y + (points[i].y - points[i - 1].y) * segFrac,
        };
      }
    }
    return points[points.length - 1];
  }

  function drawStatic() {
    const borderRgb = hexToRgb(themeColor("--border", "#232d40"));
    const accentRgb = hexToRgb(themeColor("--accent", "#2dd4bf"));

    octx.clearRect(0, 0, width, height);
    octx.lineWidth = 1.5;
    octx.lineJoin = "round";

    paths.forEach((path) => {
      octx.strokeStyle = `rgba(${borderRgb.r}, ${borderRgb.g}, ${borderRgb.b}, 0.55)`;
      octx.beginPath();
      path.points.forEach((pt, i) => {
        if (i === 0) octx.moveTo(pt.x, pt.y);
        else octx.lineTo(pt.x, pt.y);
      });
      octx.stroke();

      octx.fillStyle = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.35)`;
      [path.points[0], path.points[path.points.length - 1]].forEach((pt) => {
        octx.beginPath();
        octx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2);
        octx.fill();
      });
    });
  }

  function initPulses() {
    const accentPaths = paths.filter(() => Math.random() < 0.4);
    pulses = accentPaths.map((path) => ({
      path,
      frac: Math.random(),
      speed: rand(0.06, 0.16) / 60,
    }));
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(offscreen, 0, 0, width, height);

    const accentRgb = hexToRgb(themeColor("--accent", "#2dd4bf"));

    pulses.forEach((pulse) => {
      pulse.frac += pulse.speed;
      if (pulse.frac > 1) pulse.frac = 0;
      const pos = pointAtFraction(pulse.path, pulse.frac);

      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 8);
      gradient.addColorStop(0, `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.9)`);
      gradient.addColorStop(1, `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 1)`;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function animate() {
    drawFrame();
    rafId = requestAnimationFrame(animate);
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    [canvas, offscreen].forEach((c) => {
      c.width = width * dpr;
      c.height = height * dpr;
    });
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    paths = generatePaths();
    drawStatic();
    initPulses();
    if (!prefersReducedMotion) drawFrame();
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 200);
  });

  const themeObserver = new MutationObserver(() => {
    drawStatic();
    if (prefersReducedMotion) drawFrame();
  });
  themeObserver.observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    } else if (!prefersReducedMotion && !rafId) {
      animate();
    }
  });

  resize();
  if (!prefersReducedMotion) animate();
})();
