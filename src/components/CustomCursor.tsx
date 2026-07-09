import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useGlobalMousePosition } from "../hooks/useMouseParallax";

export default function CustomCursor() {
  const isDesktop = useIsDesktop();
  const { x, y } = useGlobalMousePosition();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isDesktop) return;
    document.body.classList.add("cursor-none");
    return () => document.body.classList.remove("cursor-none");
  }, [isDesktop]);

  useEffect(() => {
    const show = () => setVisible(true);
    const hide = () => setVisible(false);
    document.addEventListener("mouseenter", show);
    document.addEventListener("mouseleave", hide);
    return () => {
      document.removeEventListener("mouseenter", show);
      document.removeEventListener("mouseleave", hide);
    };
  }, []);

  if (!isDesktop) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed z-[9999] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-crimson mix-blend-difference"
        animate={{ x, y, opacity: visible ? 1 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, mass: 0.5 }}
      />
      <motion.div
        className="pointer-events-none fixed z-[9998] h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-neon-crimson/40"
        animate={{ x, y, opacity: visible ? 0.6 : 0 }}
        transition={{ type: "spring", stiffness: 150, damping: 20, mass: 0.8 }}
      />
    </>
  );
}
