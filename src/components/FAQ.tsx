import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { FAQ_ITEMS } from "../constants";

export default function FAQ() {
  const [openFaq, setOpenFaq] = useState<boolean[]>(FAQ_ITEMS.map(() => false));

  const toggleFaq = (index: number) => {
    setOpenFaq((prev) => prev.map((open, i) => (i === index ? !open : open)));
  };

  return (
    <section id="faq" className="snap-start px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
        </motion.div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item, index) => (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="overflow-hidden rounded-xl border border-white/5 bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => toggleFaq(index)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="flex items-center gap-3">
                  <HelpCircle className="h-4 w-4 shrink-0 text-neon-crimson/60" />
                  <span className="text-sm font-semibold sm:text-base">{item.question}</span>
                </span>
                <motion.span
                  animate={{ rotate: openFaq[index] ? 180 : 0 }}
                  transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
                  className="shrink-0 text-white/40"
                >
                  <ChevronDown className="h-5 w-5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {openFaq[index] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="border-t border-white/5 px-6 py-4 pl-[3.25rem] text-sm leading-relaxed text-white/50">
                      {item.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
