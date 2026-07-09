import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { usePerformanceMode } from "../hooks/usePerformanceMode";
import { useInViewport } from "../hooks/useInViewport";

export default function LivePreview({
  fovRadius,
  smoothFactor,
  targetPriority,
  activeTab,
}: {
  fovRadius: number;
  smoothFactor: number;
  targetPriority: string;
  activeTab?: string;
}) {
  const { isLowPower } = usePerformanceMode();
  const { ref: viewportRef, inView } = useInViewport(0.05);
  const [target, setTarget] = useState({ x: 70, y: 35 });
  const [crosshair, setCrosshair] = useState({ x: 50, y: 50 });
  const [confidence, setConfidence] = useState(97);
  const [fps, setFps] = useState(200);
  const [pageVisible, setPageVisible] = useState(true);

  useEffect(() => {
    const onVis = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const active = inView && pageVisible;

  useEffect(() => {
    if (!active) return;
    const id = setInterval(
      () => {
        setTarget({
          x: 52 + Math.random() * 28,
          y: 22 + Math.random() * 32,
        });
        setConfidence(92 + Math.floor(Math.random() * 8));
        setFps(198 + Math.floor(Math.random() * 6));
      },
      isLowPower ? 4000 : 2800
    );
    return () => clearInterval(id);
  }, [active, isLowPower]);

  useEffect(() => {
    if (!active) return;
    const ease = Math.max(0.04, 0.28 - smoothFactor * 0.025);

    if (isLowPower) {
      const id = setInterval(() => {
        setCrosshair((prev) => ({
          x: prev.x + (target.x - prev.x) * ease,
          y: prev.y + (target.y - prev.y) * ease,
        }));
      }, 120);
      return () => clearInterval(id);
    }

    let raf: number;
    const animate = () => {
      setCrosshair((prev) => ({
        x: prev.x + (target.x - prev.x) * ease,
        y: prev.y + (target.y - prev.y) * ease,
      }));
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [target, smoothFactor, active, isLowPower]);

  const fovSize = 36 + fovRadius * 14;

  return (
    <div ref={viewportRef} className="relative h-full min-h-[280px] sm:min-h-[320px]">
      {/* Holographic frame */}
      <div className="absolute -inset-px rounded-xl bg-gradient-to-br from-neon-crimson/40 via-transparent to-neon-ruby/30 opacity-60" />
      <div className="relative flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-[#080809]">
        {/* HUD header */}
        <div className="flex items-center justify-between border-b border-white/5 bg-black/50 px-3 py-2.5 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <motion.span
              className="h-2 w-2 rounded-full bg-neon-crimson"
              animate={
                isLowPower ? undefined : { opacity: [0.4, 1, 0.4], scale: [1, 1.2, 1] }
              }
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="font-mono text-[10px] font-semibold tracking-widest text-white/50 uppercase">
              Live Preview
            </span>
          </div>
          <div className="flex flex-wrap justify-end gap-1.5">
            <span className="rounded border border-neon-crimson/30 bg-neon-crimson/10 px-2 py-0.5 font-mono text-[8px] text-neon-crimson">
              VTM
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[8px] text-white/45">
              DXGI
            </span>
            <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-0.5 font-mono text-[8px] text-green-400">
              {fps}+ FPS
            </span>
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f0f12] via-[#0a0a0b] to-[#050506]" />
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.07]" />

          {/* Scanlines */}
          {!isLowPower && (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
              }}
            />
          )}

          {/* Radar sweep */}
          {!isLowPower && (
            <motion.div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-0.5 origin-bottom bg-gradient-to-t from-neon-crimson/40 to-transparent"
              style={{ transformOrigin: "bottom center" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* Environment silhouettes */}
          <div className="absolute bottom-0 left-0 h-2/5 w-1/3 bg-gradient-to-t from-white/[0.03] to-transparent" />
          <div className="absolute top-0 right-0 h-1/2 w-2/5 bg-gradient-to-bl from-white/[0.02] to-transparent" />

          {/* FOV rings */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              className="absolute rounded-full border border-neon-crimson/20"
              style={{
                width: fovSize + 20,
                height: fovSize + 20,
                left: -(fovSize + 20) / 2,
                top: -(fovSize + 20) / 2,
              }}
              animate={
                isLowPower
                  ? undefined
                  : { scale: [1, 1.05, 1], opacity: [0.2, 0.45, 0.2] }
              }
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute rounded-full border-2 border-neon-crimson/50"
              style={{
                width: fovSize,
                height: fovSize,
                left: -fovSize / 2,
                top: -fovSize / 2,
                boxShadow: "0 0 30px rgba(220,38,38,0.25), inset 0 0 20px rgba(220,38,38,0.05)",
              }}
              layout
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            />
          </div>

          {/* Tracer line crosshair → target */}
          {!isLowPower && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full">
              <motion.line
                x1={`${crosshair.x}%`}
                y1={`${crosshair.y}%`}
                x2={`${target.x}%`}
                y2={`${target.y}%`}
                stroke="rgba(220,38,38,0.35)"
                strokeWidth="1"
                strokeDasharray="4 4"
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </svg>
          )}

          {/* Target */}
          <motion.div
            className="absolute h-9 w-7"
            animate={{ left: `${target.x}%`, top: `${target.y}%` }}
            transition={{ type: "spring", stiffness: 55, damping: 14 }}
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <span className="absolute -top-4 left-0 font-mono text-[8px] font-bold text-neon-crimson">
              {targetPriority.toUpperCase()} {confidence}%
            </span>
            <div className="absolute inset-0 border border-neon-crimson shadow-[0_0_12px_rgba(220,38,38,0.4)]" />
            {(["tl", "tr", "bl", "br"] as const).map((c) => (
              <span
                key={c}
                className={`absolute h-2 w-2 border-neon-crimson ${
                  c === "tl"
                    ? "-left-px -top-px border-l-2 border-t-2"
                    : c === "tr"
                      ? "-right-px -top-px border-r-2 border-t-2"
                      : c === "bl"
                        ? "-bottom-px -left-px border-b-2 border-l-2"
                        : "-bottom-px -right-px border-b-2 border-r-2"
                }`}
              />
            ))}
          </motion.div>

          {/* Crosshair */}
          <div
            className="pointer-events-none absolute z-10"
            style={{
              left: `${crosshair.x}%`,
              top: `${crosshair.y}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8" fill="none" stroke="rgba(220,38,38,0.15)" strokeWidth="1" />
              <line x1="12" y1="2" x2="12" y2="7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="12" y1="17" x2="12" y2="22" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="2" y1="12" x2="7" y2="12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="17" y1="12" x2="22" y2="12" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="1.5" fill="#DC2626" />
            </svg>
          </div>

          {/* Corner HUD */}
          <div className="absolute left-2 top-2 space-y-1 font-mono text-[8px] text-white/25">
            <div>MODE: {activeTab?.replace("-", " ").toUpperCase() ?? "AIM"}</div>
            <div>LAT: 0.{Math.round(smoothFactor * 2)}ms</div>
          </div>

          {/* Bottom stats bar */}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-white/5 bg-black/60 px-3 py-2 backdrop-blur-md">
            <span className="font-mono text-[9px] text-white/40">
              FOV <span className="text-neon-crimson">{fovRadius.toFixed(1)}°</span>
            </span>
            <span className="font-mono text-[9px] text-white/40">
              SMTH <span className="text-neon-crimson">{smoothFactor.toFixed(1)}</span>
            </span>
            <span className="font-mono text-[9px] text-white/40">
              TRK <span className="text-green-400">LOCKED</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function EasingCurvePreview({ smoothFactor }: { smoothFactor: number }) {
  const cp = Math.min(0.9, 0.2 + smoothFactor * 0.07);
  const path = `M 10 90 C ${10 + cp * 80} 90, ${10 + cp * 60} 10, 190 10`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-neon-crimson/15 bg-gradient-to-br from-neon-crimson/5 to-transparent p-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.05]" />
      <p className="relative mb-2 text-xs font-semibold tracking-wide text-white/50 uppercase">
        Smoothing curve
      </p>
      <svg viewBox="0 0 200 100" className="relative h-20 w-full">
        <defs>
          <linearGradient id="curveGlow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#DC2626" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="10" y1="90" x2="190" y2="90" stroke="rgba(255,255,255,0.06)" />
        <line x1="10" y1="10" x2="10" y2="90" stroke="rgba(255,255,255,0.06)" />
        <motion.path
          d={`${path} L190 90 L10 90 Z`}
          fill="url(#curveGlow)"
          fillOpacity={0.15}
          animate={{ d: `${path} L190 90 L10 90 Z` }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="#DC2626"
          strokeWidth="2.5"
          filter="drop-shadow(0 0 4px rgba(220,38,38,0.6))"
          animate={{ d: path }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
        />
        <motion.circle
          cx="190"
          cy="10"
          r="4"
          fill="#DC2626"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      </svg>
      <p className="relative mt-1 font-mono text-[10px] text-white/30">
        Higher smooth → gentler approach
      </p>
    </div>
  );
}

export { EasingCurvePreview };
