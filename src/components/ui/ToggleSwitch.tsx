import { motion } from "framer-motion";

export default function ToggleSwitch({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 500, damping: 15 }}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${
        enabled
          ? "bg-gradient-to-r from-neon-crimson to-neon-ruby shadow-crimson-sm"
          : "bg-white/10"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
        className="absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow-md"
        animate={{ x: enabled ? 20 : 0 }}
      />
    </motion.button>
  );
}
