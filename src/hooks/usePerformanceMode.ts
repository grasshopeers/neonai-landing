import { useState, useEffect } from "react";
import { useIsDesktop } from "./useIsDesktop";

/** True on mobile/tablet or when user prefers reduced motion — use to lighten animations. */
export function usePerformanceMode() {
  const isDesktop = useIsDesktop(768);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const isMobile = !isDesktop;
  const isLowPower = isMobile || reducedMotion;

  return { isDesktop, isMobile, isLowPower, reducedMotion };
}
