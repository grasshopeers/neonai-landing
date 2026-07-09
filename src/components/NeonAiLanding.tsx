import { useState, useEffect } from "react";
import AmbientBackground from "./Background";
import ScrollProgress from "./ScrollProgress";
import CustomCursor from "./CustomCursor";
import Header from "./Header";
import Hero from "./Hero";
import ActivationsTicker from "./ActivationsTicker";
import Features from "./Features";
import Pricing from "./Pricing";
import DemoPanel from "./DemoPanel";
import PerformanceSection from "./PerformanceSection";
import FAQ from "./FAQ";
import Footer from "./Footer";

export default function NeonAiLanding() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-neon-bg">
      <AmbientBackground />
      <ScrollProgress />
      <CustomCursor />
      <Header scrolled={scrolled} />

      <main className="relative z-10">
        <Hero />
        <ActivationsTicker />
        <Features />
        <Pricing />
        <DemoPanel />
        <PerformanceSection />
        <FAQ />
      </main>

      <Footer />
    </div>
  );
}
