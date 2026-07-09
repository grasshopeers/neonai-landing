import { motion } from "framer-motion";
import { useScrollProgress } from "../hooks/useScrollProgress";

export default function ScrollProgress() {
  const progress = useScrollProgress();

  return (
    <div className="fixed inset-x-0 top-0 z-[60] h-[2px] bg-white/5">
      <motion.div
        className="h-full bg-gradient-to-r from-neon-crimson via-red-500 to-neon-ruby shadow-crimson-sm"
        style={{ width: `${progress}%` }}
        layout={false}
      />
    </div>
  );
}
