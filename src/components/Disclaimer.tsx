import { useState } from "react";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";

export default function Disclaimer() {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ type: "spring", stiffness: 120, damping: 22 }}
      className="mx-auto mt-10 max-w-4xl"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
    >
      {/* Gradient border wrapper */}
      <motion.div
        animate={{
          boxShadow: hovered
            ? "0 0 32px rgba(220, 38, 38, 0.15), 0 8px 32px rgba(0,0,0,0.4)"
            : "0 4px 24px rgba(0,0,0,0.3)",
        }}
        transition={{ duration: 0.3 }}
        className="disclaimer-clip relative p-px"
        style={{
          background:
            "linear-gradient(135deg, rgba(220,38,38,0.45) 0%, rgba(255,255,255,0.08) 40%, rgba(153,27,27,0.25) 100%)",
        }}
      >
        <div className="disclaimer-clip relative overflow-hidden bg-[#0e0e10] px-6 py-5 sm:px-8 sm:py-6">
          {/* Background texture */}
          <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-[0.04]" />
          <motion.div
            className="pointer-events-none absolute -top-8 -left-8 h-32 w-32 rounded-full bg-neon-crimson/10 blur-3xl"
            animate={{ opacity: hovered ? 0.8 : 0.4, scale: hovered ? 1.2 : 1 }}
            transition={{ duration: 0.4 }}
          />

          {/* Scan shimmer */}
          <motion.div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-crimson/60 to-transparent"
            animate={{ opacity: [0.3, 0.8, 0.3], x: ["-100%", "100%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />

          {/* Chamfer accent — top-left cut highlight */}
          <div
            className="pointer-events-none absolute top-0 left-0 h-5 w-5"
            style={{
              background: "linear-gradient(135deg, rgba(220,38,38,0.5) 50%, transparent 50%)",
            }}
          />

          <div
            className="relative flex items-start gap-4 sm:gap-5"
            role="note"
            aria-label="Disclaimer"
          >
            {/* Icon badge */}
            <motion.div
              animate={{ scale: hovered ? 1.05 : 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className="relative shrink-0"
            >
              <div className="rounded-lg border border-neon-crimson/25 bg-neon-crimson/10 p-2.5 shadow-crimson-sm">
                <ShieldAlert className="h-5 w-5 text-neon-crimson" strokeWidth={1.75} />
              </div>
              <motion.span
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-neon-crimson"
                animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold tracking-tight text-white sm:text-lg">
                Disclaimer
              </h3>

              <p className="mt-2.5 text-sm leading-relaxed text-white/50 sm:text-[15px]">
                NeonAi products do not reverse engineer third-party hardware or
                software and do not manipulate copyrighted or intellectual
                property owned by third-party software or game publishers.
              </p>

              {/* Bottom accent line */}
              <motion.div
                className="mt-4 h-px max-w-[120px] bg-gradient-to-r from-neon-crimson/60 to-transparent"
                initial={{ scaleX: 0, originX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
