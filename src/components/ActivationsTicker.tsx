import { useEffect, useRef, useState } from "react";
import { MotionConfig, motion } from "framer-motion";
import { ACTIVATION_TICKER_ITEMS } from "../constants";

function TickerItem({ item }: { item: string }) {
  return (
    <span className="mx-6 inline-flex items-center gap-2 text-xs text-white/40 sm:mx-8">
      <span className="h-1 w-1 rounded-full bg-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
      {item}
      <span className="rounded border border-green-500/50 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-green-400 uppercase shadow-[0_0_10px_rgba(34,197,94,0.35)]">
        Activated
      </span>
    </span>
  );
}

export default function ActivationsTicker() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [loopWidth, setLoopWidth] = useState(0);
  const items = [...ACTIVATION_TICKER_ITEMS, ...ACTIVATION_TICKER_ITEMS];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const measure = () => {
      setLoopWidth(track.scrollWidth / 2);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(track);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-3">
      <div className="absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-neon-bg to-transparent sm:w-16" />
      <div className="absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-neon-bg to-transparent sm:w-16" />

      <MotionConfig reducedMotion="never">
        <motion.div
          ref={trackRef}
          className="flex w-max whitespace-nowrap will-change-transform"
          animate={loopWidth > 0 ? { x: [0, -loopWidth] } : undefined}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: "loop",
              duration: 28,
              ease: "linear",
            },
          }}
        >
          {items.map((item, i) => (
            <TickerItem key={`${item}-${i}`} item={item} />
          ))}
        </motion.div>
      </MotionConfig>
    </div>
  );
}
