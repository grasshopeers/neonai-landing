import { useEffect, useRef } from "react";
import { usePerformanceMode } from "../hooks/usePerformanceMode";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export default function AmbientBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isLowPower } = usePerformanceMode();

  useEffect(() => {
    if (isLowPower) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let particles: Particle[] = [];
    let visible = !document.hidden;
    const count = 24;

    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const init = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.2 + 0.4,
        alpha: Math.random() * 0.35 + 0.08,
      }));
    };

    const draw = () => {
      if (visible) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0) p.x = canvas.width;
          if (p.x > canvas.width) p.x = 0;
          if (p.y < 0) p.y = canvas.height;
          if (p.y > canvas.height) p.y = 0;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(220, 38, 38, ${p.alpha})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };

    resize();
    init();
    draw();

    const onResize = () => {
      resize();
      init();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, [isLowPower]);

  return (
    <>
      {!isLowPower && (
        <canvas
          ref={canvasRef}
          className="pointer-events-none fixed inset-0 z-0 opacity-30"
          aria-hidden
        />
      )}
      <div
        className={`pointer-events-none fixed inset-0 z-0 bg-mesh-gradient ${
          isLowPower ? "opacity-40 motion-reduce:animate-none" : "opacity-60"
        }`}
        aria-hidden
      />
      {!isLowPower && (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-grid-pattern opacity-[0.03]"
            aria-hidden
          />
          <div
            className="pointer-events-none fixed inset-0 z-0 bg-noise opacity-[0.02]"
            aria-hidden
          />
        </>
      )}
    </>
  );
}
