import { useState, useEffect, useCallback } from "react";

export function useMouseParallax(intensity = 12) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const x = ((e.clientX - cx) / rect.width) * intensity;
      const y = ((e.clientY - cy) / rect.height) * intensity;
      setOffset({ x, y });
    },
    [intensity]
  );

  const onMouseLeave = useCallback(() => setOffset({ x: 0, y: 0 }), []);

  return { offset, onMouseMove, onMouseLeave };
}

export function useGlobalMousePosition() {
  const [pos, setPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return pos;
}
