import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle, Crosshair } from "lucide-react";
import {
  getPurchaseDiscordUrl,
  DISCORD_INVITE_URL,
  HERO_ROTATE_WORDS,
  HERO_STATS,
} from "../constants";
import { useMouseParallax } from "../hooks/useMouseParallax";
import { usePerformanceMode } from "../hooks/usePerformanceMode";
import { useInViewport } from "../hooks/useInViewport";
import MagneticButton from "./ui/MagneticButton";
import CountUp from "./ui/CountUp";

function AppWindowMockup() {
  const { isLowPower } = usePerformanceMode();
  const { ref: viewportRef, inView } = useInViewport(0.05);
  const [target, setTarget] = useState({ x: 62, y: 38 });
  const [crosshair, setCrosshair] = useState({ x: 50, y: 50 });
  const [confidence, setConfidence] = useState(98);
  const [hovering, setHovering] = useState(false);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
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
          x: 48 + Math.random() * 28,
          y: 28 + Math.random() * 28,
        });
        setConfidence(94 + Math.floor(Math.random() * 6));
      },
      isLowPower ? 3500 : 2400
    );
    return () => clearInterval(id);
  }, [active, isLowPower]);

  useEffect(() => {
    if (!active) return;
    const ease = hovering && !isLowPower ? 0.12 : 0.08;

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
    const tick = () => {
      setCrosshair((prev) => ({
        x: prev.x + (target.x - prev.x) * ease,
        y: prev.y + (target.y - prev.y) * ease,
      }));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, hovering, active, isLowPower]);

  const statusPills = [
    { label: "VTM", title: "Vision inference backend" },
    { label: "DXGI capture", title: "Desktop screen capture API" },
    { label: "External", title: "Runs outside the game — no injection" },
  ];

  return (
    <motion.div
      ref={viewportRef}
      initial={{ opacity: 0, y: 40, rotateX: isLowPower ? 0 : 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.9, delay: 0.3, ease: "easeOut" }}
      className="relative w-full max-w-md"
      style={{ perspective: 1000 }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => {
        setHovering(false);
        setMouse({ x: 0.5, y: 0.5 });
      }}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setMouse({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }}
    >
      <motion.div
        animate={{ y: hovering ? -4 : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="overflow-hidden rounded-xl border border-white/10 bg-[#111113] shadow-2xl shadow-black/60"
      >
        <div className="flex items-center gap-2 border-b border-white/5 bg-black/60 px-4 py-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-neon-crimson" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <div className="h-2.5 w-2.5 rounded-full bg-white/20" />
          <span className="ml-2 font-mono text-[10px] text-white/30">
            NeonAi.exe — running
          </span>
          <span className="ml-auto flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
            <span className="text-[10px] text-green-500/80">LIVE</span>
          </span>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-[#0a0a0b] via-[#111113] to-[#0a0a0b]">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.06]" />

          {!isLowPower && (
            <motion.div
              className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-neon-crimson/50 to-transparent"
              animate={{ top: ["0%", "100%"] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
            />
          )}

          {/* FOV ring — pulses */}
          <motion.div
            className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon-crimson/25"
            animate={
              isLowPower
                ? undefined
                : { scale: [1, 1.06, 1], opacity: [0.4, 0.7, 0.4] }
            }
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          {!isLowPower && (
            <motion.div
              className="absolute left-[18%] top-[22%] h-8 w-8 rounded-full border border-neon-crimson/20"
              animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <motion.div
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-crimson"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          )}

          {/* Target box */}
          <motion.div
            className="absolute h-10 w-10"
            animate={{ left: `${target.x}%`, top: `${target.y}%` }}
            transition={{ type: "spring", stiffness: 70, damping: 16 }}
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <span className="absolute -top-4 left-0 font-mono text-[9px] text-neon-crimson">
              TARGET {confidence}%
            </span>
            <div className="absolute inset-0 border-2 border-neon-crimson/70" />
            <span className="absolute -left-px -top-px h-2 w-2 border-l-2 border-t-2 border-neon-crimson" />
            <span className="absolute -right-px -top-px h-2 w-2 border-r-2 border-t-2 border-neon-crimson" />
            <span className="absolute -bottom-px -left-px h-2 w-2 border-b-2 border-l-2 border-neon-crimson" />
            <span className="absolute -bottom-px -right-px h-2 w-2 border-b-2 border-r-2 border-neon-crimson" />
          </motion.div>

          {/* Crosshair — tracks target + subtle mouse parallax */}
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${crosshair.x + (mouse.x - 0.5) * (hovering ? 6 : 0)}%`,
              top: `${crosshair.y + (mouse.y - 0.5) * (hovering ? 6 : 0)}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <Crosshair className="h-7 w-7 text-white/30" strokeWidth={1.25} />
            {!isLowPower && (
              <motion.div
                className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-crimson"
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
            )}
          </div>

          {/* Status pills */}
          <div className="absolute right-3 bottom-3 left-3 flex flex-wrap gap-2">
            {statusPills.map((pill, i) => (
              <motion.span
                key={pill.label}
                title={pill.title}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="cursor-default rounded-full border border-neon-crimson/20 bg-neon-crimson/10 px-2 py-0.5 font-mono text-[9px] text-neon-crimson/80 transition-colors hover:border-neon-crimson/40 hover:bg-neon-crimson/15"
              >
                {pill.label}
              </motion.span>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        className="absolute -inset-4 -z-10 rounded-2xl bg-neon-crimson/10 blur-2xl"
        animate={{ opacity: hovering && !isLowPower ? 0.35 : 0.15 }}
      />
    </motion.div>
  );
}

export default function Hero() {
  const { offset, onMouseMove, onMouseLeave } = useMouseParallax(12);
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setWordIndex((i) => (i + 1) % HERO_ROTATE_WORDS.length),
      2800
    );
    return () => clearInterval(id);
  }, []);

  return (
    <section
      id="hero"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      className="relative flex min-h-screen snap-start items-center px-6 pt-24 pb-16"
    >
      <motion.div
        className="pointer-events-none absolute top-1/3 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-neon-crimson/8 blur-[120px]"
        animate={{
          x: offset.x,
          y: offset.y,
          scale: [1, 1.05, 1],
        }}
        transition={{
          x: { type: "spring", stiffness: 80, damping: 20 },
          y: { type: "spring", stiffness: 80, damping: 20 },
          scale: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="text-center lg:text-left"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-4 inline-block rounded-full border border-neon-crimson/20 bg-neon-crimson/5 px-4 py-1.5 text-xs font-semibold tracking-widest text-neon-crimson uppercase"
          >
            External AI Aim Assist
          </motion.p>

          <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
            The Future of{" "}
            <span className="gradient-text glow-crimson">Aiming</span> is here.
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-white/60 sm:text-xl lg:mx-0">
            Engineered for{" "}
            <motion.span
              layout
              className="inline-block align-baseline font-semibold"
              transition={{ layout: { duration: 0.35, ease: "easeInOut" } }}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={HERO_ROTATE_WORDS[wordIndex]}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.35 }}
                  className="gradient-text inline-block whitespace-nowrap"
                >
                  {HERO_ROTATE_WORDS[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </motion.span>
            . The most advanced external AI aim assist on the market.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row lg:justify-start">
            <MagneticButton
              href={getPurchaseDiscordUrl("hero")}
              className="gradient-crimson rounded-xl px-8 py-4 text-base font-bold shadow-crimson transition-shadow hover:shadow-crimson-lg"
            >
              Get Instant Access
            </MagneticButton>

            <MagneticButton
              href={DISCORD_INVITE_URL}
              className="rounded-xl border border-neon-crimson/60 px-8 py-4 text-base font-semibold text-white transition-all hover:border-neon-crimson hover:shadow-crimson-sm"
            >
              <span className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Join Discord Community
              </span>
            </MagneticButton>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-14 grid grid-cols-3 gap-6 border-t border-white/5 pt-8"
          >
            {HERO_STATS.map((stat) => (
              <div key={stat.label} className="text-center lg:text-left">
                <p className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {"display" in stat ? (
                    stat.display
                  ) : (
                    <CountUp
                      end={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                    />
                  )}
                </p>
                <p className="mt-1 text-xs text-white/40">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <div className="flex justify-center lg:justify-end">
          <AppWindowMockup />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <ChevronDown className="h-6 w-6 animate-bounce text-white/30" />
      </motion.div>
    </section>
  );
}
