import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Monitor, Cpu, Zap } from "lucide-react";
import { usePerformanceMode } from "../hooks/usePerformanceMode";

function PerformanceChart() {
  const { isLowPower } = usePerformanceMode();
  const [tick, setTick] = useState(0);
  const [displayFps, setDisplayFps] = useState(200);
  const [displayGpu, setDisplayGpu] = useState(12);

  useEffect(() => {
    const id = setInterval(
      () => {
        setTick((t) => t + 1);
        setDisplayFps(198 + Math.floor(Math.random() * 5));
        setDisplayGpu(10 + Math.floor(Math.random() * 4));
      },
      isLowPower ? 4000 : 2200
    );
    return () => clearInterval(id);
  }, [isLowPower]);

  const fpsPoints = [
    [0, 42], [60, 40], [120, 41], [180, 39], [240, 40], [300, 38], [360, 39],
  ];
  const gpuPoints = [
    [0, 55], [60, 53], [120, 54], [180, 52], [240, 53], [300, 51], [360, 52],
  ];

  const jitter = (base: number) => base + Math.sin(tick * 0.8 + base) * 1.5;
  const toPath = (pts: number[][]) =>
    pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${jitter(y)}`).join(" ");

  const fpsPath = toPath(fpsPoints);

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-neon-crimson" />
          <span className="text-sm font-semibold tracking-wide text-white/80">
            Real-Time Performance
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-neon-crimson" /> FPS
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white/40" /> GPU Load
          </span>
        </div>
      </div>

      <svg viewBox="0 0 360 70" className="h-36 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="fpsGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#DC2626" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {[20, 35, 50].map((y) => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,0.05)" />
        ))}

        <motion.path
          d={toPath(gpuPoints)}
          fill="none"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
          animate={{ d: toPath(gpuPoints) }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        />
        <motion.path
          d={fpsPath}
          fill="none"
          stroke="#DC2626"
          strokeWidth="2.5"
          filter="url(#glow)"
          animate={{ d: fpsPath }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        />
        <motion.path
          d={`${fpsPath} L360,70 L0,70 Z`}
          fill="url(#fpsGrad)"
          animate={{ d: `${fpsPath} L360,70 L0,70 Z` }}
          transition={{ duration: 1.8, ease: "easeInOut" }}
        />
      </svg>

      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-white/5 pt-4">
        {[
          { label: "Avg FPS", value: `${displayFps}`, icon: Monitor },
          { label: "GPU Usage", value: `${displayGpu}%`, icon: Cpu },
          { label: "Latency", value: "0.2ms", icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="text-center">
            <Icon className="mx-auto mb-1 h-4 w-4 text-neon-crimson/70" />
            <motion.p
              key={value}
              initial={{ opacity: 0.5, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold tracking-tight"
            >
              {value}
            </motion.p>
            <p className="text-xs text-white/40">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComparisonBars() {
  const bars = [
    { label: "NeonAi (External)", value: 12, color: "bg-neon-crimson" },
    { label: "Traditional (Memory injection)", value: 38, color: "bg-white/25" },
  ];

  return (
    <div className="mt-8 space-y-4 rounded-xl border border-white/5 bg-white/[0.02] p-5">
      <p className="text-xs font-semibold tracking-wide text-white/50 uppercase">
        Overhead comparison (visual)
      </p>
      {bars.map((bar, i) => (
        <motion.div
          key={bar.label}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15 }}
        >
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-white/60">{bar.label}</span>
            <span className="font-mono text-white/40">{bar.value}% GPU</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <motion.div
              className={`h-full rounded-full ${bar.color}`}
              initial={{ width: 0 }}
              whileInView={{ width: `${bar.value * 2.5}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.2 + i * 0.2, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      ))}
      <p className="text-[10px] text-white/25">
        Illustrative comparison — actual results vary by hardware and configuration.
      </p>
    </div>
  );
}

export default function PerformanceSection() {
  return (
    <section id="performance" className="snap-start px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
              External Execution,{" "}
              <span className="gradient-text">Zero Overhead</span>
            </h2>
            <p className="mt-6 leading-relaxed text-white/50">
              NeonAi operates through external screen analysis — computing precise
              mouse offset instructions without scanning memory files or injecting
              into game processes. Designed for isolation with native-level performance.
            </p>
            <ul className="mt-8 space-y-4">
              {[
                "Screen capture models with sub-millisecond inference",
                "No memory file scanning or process injection",
                "Dedicated thread pool for input processing",
                "GPU-accelerated vision pipeline via DirectML",
              ].map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 text-sm text-white/60"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neon-crimson" />
                  {item}
                </motion.li>
              ))}
            </ul>
            <ComparisonBars />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <PerformanceChart />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
