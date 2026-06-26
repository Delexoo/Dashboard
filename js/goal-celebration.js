/**
 * Canvas confetti for revenue goal celebrations.
 */
(function (global) {
  const COLORS = ["#22c55e", "#eab308", "#3b82f6", "#a855f7", "#ef4444", "#14b8a6", "#f97316"];

  let canvas = null;
  let ctx = null;
  let pieces = [];
  let rafId = null;

  function prefersReducedMotion() {
    if (global.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return true;
    if (global.SiteTheme?.isReduceMotion?.()) return true;
    if (global.UserPrefs?.forceReduceMotion?.()) return true;
    return false;
  }

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement("canvas");
    canvas.className = "goal-confetti-canvas";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "fixed",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "99980",
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    global.addEventListener("resize", resizeCanvas);
    resizeCanvas();
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(global.innerWidth * dpr);
    canvas.height = Math.floor(global.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createPiece(origin) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2.5 + Math.random() * 5;
    const ox = origin?.x ?? global.innerWidth / 2;
    const oy = origin?.y ?? global.innerHeight * 0.32;
    return {
      x: ox + (Math.random() - 0.5) * 48,
      y: oy + (Math.random() - 0.5) * 24,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (3 + Math.random() * 2.5),
      w: 9 + Math.random() * 10,
      h: 6 + Math.random() * 7,
      rot: Math.random() * Math.PI,
      rotV: (Math.random() - 0.5) * 0.2,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      life: 1,
      gravity: 0.12 + Math.random() * 0.08,
    };
  }

  function spawn(count, origin) {
    for (let i = 0; i < count; i++) pieces.push(createPiece(origin));
  }

  function loop() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, global.innerWidth, global.innerHeight);

    pieces = pieces.filter((p) => p.life > 0.04 && p.y < global.innerHeight + 48);

    pieces.forEach((p) => {
      p.vx *= 0.985;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.rotV;
      p.life -= 0.0048;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (pieces.length) {
      rafId = global.requestAnimationFrame(loop);
    } else {
      rafId = null;
      ctx.clearRect(0, 0, global.innerWidth, global.innerHeight);
    }
  }

  function fire(opts) {
    if (prefersReducedMotion()) return;
    ensureCanvas();
    spawn(opts?.count ?? 110, opts?.origin);
    if (!rafId) rafId = global.requestAnimationFrame(loop);
  }

  function firePreview(originEl) {
    const rect = originEl?.getBoundingClientRect?.();
    fire({
      count: 88,
      origin: rect
        ? { x: rect.left + rect.width * 0.72, y: rect.top + rect.height * 0.42 }
        : { x: global.innerWidth / 2, y: global.innerHeight * 0.38 },
    });
  }

  function fireGoalReached() {
    if (global.UserPrefs?.showGoalCelebration?.() === false) return;
    if (prefersReducedMotion()) return;

    fire({ count: 150 });
    global.setTimeout(
      () => fire({ count: 80, origin: { x: global.innerWidth * 0.28, y: global.innerHeight * 0.22 } }),
      200
    );
    global.setTimeout(
      () => fire({ count: 80, origin: { x: global.innerWidth * 0.72, y: global.innerHeight * 0.24 } }),
      360
    );
  }

  global.GoalCelebration = {
    fire,
    firePreview,
    fireGoalReached,
    prefersReducedMotion,
  };
})(window);
