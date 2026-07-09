import { useRef, useState } from "react";
import { motion } from "framer-motion";

export default function MagneticButton({
  children,
  className = "",
  onClick,
  href,
  type = "button",
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit";
}) {
  const ref = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ x: number; y: number; id: number }[]>(
    []
  );

  const handleMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({
      x: (e.clientX - rect.left - rect.width / 2) * 0.15,
      y: (e.clientY - rect.top - rect.height / 2) * 0.15,
    });
  };

  const handleLeave = () => setPos({ x: 0, y: 0 });

  const addRipple = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const id = Date.now();
    setRipples((prev) => [
      ...prev,
      { x: e.clientX - rect.left, y: e.clientY - rect.top, id },
    ]);
    setTimeout(
      () => setRipples((prev) => prev.filter((r) => r.id !== id)),
      600
    );
  };

  const sharedProps = {
    ref,
    onMouseMove: handleMove,
    onMouseLeave: handleLeave,
    className: `relative overflow-hidden ${className}`,
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
  };

  const rippleLayer = (
    <>
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 animate-ripple rounded-full bg-white/30"
          style={{ left: r.x, top: r.y }}
        />
      ))}
    </>
  );

  if (href) {
    return (
      <motion.a
        {...sharedProps}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        onClick={(e) => {
          addRipple(e);
          onClick?.();
        }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        {rippleLayer}
        <span className="relative z-10">{children}</span>
      </motion.a>
    );
  }

  return (
    <motion.button
      {...sharedProps}
      type={type}
      onClick={(e) => {
        addRipple(e);
        onClick?.();
      }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
    >
      {rippleLayer}
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
