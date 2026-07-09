import { motion } from "framer-motion";
import { FEATURES } from "../constants";
import TiltCard from "./ui/TiltCard";

export default function Features() {
  return (
    <section id="features" className="snap-start px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Built for <span className="gradient-text">Performance</span>
          </h2>
          <p className="mt-4 text-white/50">
            Every feature engineered for competitive precision.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.08 }}
              >
                <TiltCard className="group h-full overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-colors duration-300 hover:border-neon-crimson/30 hover:shadow-crimson-sm">
                  <div className="relative z-10">
                    <div className="mb-4 inline-flex rounded-xl bg-neon-crimson/10 p-3 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="h-6 w-6 text-neon-crimson" />
                    </div>
                    <h3 className="text-lg font-bold tracking-tight">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                      {feature.description}
                    </p>
                  </div>
                </TiltCard>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
