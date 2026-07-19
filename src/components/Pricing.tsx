import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Ticket, Sparkles } from "lucide-react";
import { PRICING_TIERS, getPurchaseDiscordUrl } from "../constants";
import Disclaimer from "./Disclaimer";

export default function Pricing() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <section id="pricing" className="snap-start px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Choose Your <span className="gradient-text">License</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-white/50">
            Select a plan — you&apos;ll be redirected to Discord where our ticket
            bot opens a private channel to complete your purchase.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
          className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#111113]/80 shadow-2xl shadow-black/40 backdrop-blur-sm"
        >
          {/* Ambient glow behind popular row area */}
          <div className="pointer-events-none absolute inset-x-0 top-[38%] h-24 bg-neon-crimson/[0.04] blur-2xl" />

          {/* Header */}
          <div className="relative grid grid-cols-[1fr_auto] gap-4 border-b border-white/10 px-5 py-4 sm:px-8">
            <span className="text-xs font-semibold tracking-widest text-white/35 uppercase">
              Plan
            </span>
            <span className="text-xs font-semibold tracking-widest text-white/35 uppercase">
              Price
            </span>
          </div>

          {/* Rows */}
          <div className="relative divide-y divide-white/[0.06]">
            {PRICING_TIERS.map((tier, index) => {
              const isHovered = hoveredId === tier.id;

              return (
                <motion.a
                  key={tier.id}
                  href={getPurchaseDiscordUrl(tier.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 22,
                    delay: index * 0.07,
                  }}
                  onHoverStart={() => setHoveredId(tier.id)}
                  onHoverEnd={() => setHoveredId(null)}
                  whileTap={{ scale: 0.985 }}
                  className="group relative block"
                >
                  {/* Hover glow sweep */}
                  <motion.div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neon-crimson/10 via-neon-crimson/5 to-transparent"
                    initial={false}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.25 }}
                  />

                  {/* Left accent bar */}
                  <motion.div
                    className="absolute inset-y-0 left-0 w-0.5 bg-neon-crimson"
                    initial={false}
                    animate={{
                      scaleY: isHovered || tier.highlight ? 1 : 0,
                      opacity: isHovered || tier.highlight ? 1 : 0,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />

                  <div
                    className={`relative grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-5 sm:px-8 sm:py-6 ${
                      tier.highlight ? "bg-neon-crimson/[0.04]" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <motion.span
                          className="text-lg font-bold tracking-tight text-white sm:text-xl"
                          animate={{ x: isHovered ? 4 : 0 }}
                          transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        >
                          {tier.name}
                        </motion.span>

                        {tier.highlight && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-neon-crimson/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-neon-crimson uppercase">
                            <Sparkles className="h-3 w-3" />
                            Popular
                          </span>
                        )}

                        <span className="hidden text-xs text-white/30 sm:inline">
                          · {tier.tag}
                        </span>
                      </div>

                      {"note" in tier && tier.note && (
                        <p className="mt-1 text-[11px] text-white/25">{tier.note}</p>
                      )}

                      {/* Mobile tag + CTA hint */}
                      <motion.p
                        className="mt-1 flex items-center gap-1.5 text-xs text-white/35 sm:mt-1.5"
                        animate={{ opacity: isHovered ? 1 : 0.6 }}
                      >
                        <Ticket className="h-3 w-3 text-neon-crimson/60" />
                        <span className="sm:hidden">{tier.tag} · </span>
                        Open Discord ticket
                        <motion.span
                          animate={{ x: isHovered ? 3 : 0 }}
                          className="inline-flex text-neon-crimson"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </motion.span>
                      </motion.p>
                    </div>

                    <div className="flex items-center gap-3">
                      <motion.span
                        className={`text-xl font-black tracking-tight sm:text-2xl ${
                          isHovered ? "gradient-text" : "text-white"
                        }`}
                        animate={{ scale: isHovered ? 1.06 : 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 20 }}
                      >
                        ${tier.price}
                      </motion.span>

                      <motion.div
                        className="hidden rounded-full border border-neon-crimson/30 bg-neon-crimson/10 p-2 text-neon-crimson sm:flex"
                        initial={false}
                        animate={{
                          scale: isHovered ? 1 : 0.85,
                          opacity: isHovered ? 1 : 0,
                        }}
                        transition={{ type: "spring", stiffness: 400, damping: 22 }}
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </motion.div>
                    </div>
                  </div>
                </motion.a>
              );
            })}
          </div>

          {/* Footer strip */}
          <div className="border-t border-white/[0.06] bg-black/20 px-5 py-3 sm:px-8">
            <p className="flex items-center justify-center gap-2 text-center text-[11px] text-white/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-crimson" />
              Instant redirect · Ticket bot handles tier selection in Discord
            </p>
          </div>
        </motion.div>

        <Disclaimer />
      </div>
    </section>
  );
}
