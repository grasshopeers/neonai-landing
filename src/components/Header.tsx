import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import { NAV_LINKS, DISCORD_INVITE_URL, getPurchaseDiscordUrl } from "../constants";
import { useScrollSpy } from "../hooks/useScrollSpy";
import MagneticButton from "./ui/MagneticButton";

interface HeaderProps {
  scrolled: boolean;
}

export default function Header({ scrolled }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const sectionIds = NAV_LINKS.filter((l) => l.sectionId !== "discord-cta").map(
    (l) => l.sectionId
  );
  const activeSection = useScrollSpy(sectionIds);

  const scrollTo = (href: string) => {
    setMenuOpen(false);
    if (href.startsWith("#")) {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <>
      <header
        className={`fixed inset-x-0 top-[2px] z-50 transition-all duration-500 ${
          scrolled || menuOpen
            ? "border-b border-white/5 bg-neon-bg/95 shadow-lg shadow-black/20 backdrop-blur-xl"
            : "bg-neon-bg/40 backdrop-blur-sm"
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="shrink-0 text-lg font-black tracking-tight glow-crimson sm:text-xl"
          >
            Neon<span className="gradient-text">Ai</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive =
                link.sectionId !== "discord-cta" &&
                activeSection === link.sectionId;

              if (link.label === "Discord") {
                return (
                  <a
                    key={link.href}
                    href={DISCORD_INVITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-white/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                );
              }

              return (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => scrollTo(link.href)}
                  className={`relative text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-white/60 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -bottom-1 left-0 h-0.5 w-full bg-neon-crimson"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <MagneticButton
              href={getPurchaseDiscordUrl("navbar")}
              className="gradient-crimson hidden rounded-lg px-4 py-2 text-sm font-semibold shadow-crimson sm:inline-flex sm:px-5 sm:py-2.5"
            >
              Purchase Now
            </MagneticButton>

            <MagneticButton
              href={getPurchaseDiscordUrl("navbar")}
              className="gradient-crimson rounded-lg px-3 py-2 text-xs font-semibold shadow-crimson sm:hidden"
            >
              Buy
            </MagneticButton>

            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="inline-flex rounded-lg border border-white/10 p-2 text-white/70 transition-colors hover:border-neon-crimson/40 hover:text-white md:hidden"
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <motion.nav
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="fixed inset-x-4 top-[4.5rem] z-40 overflow-hidden rounded-xl border border-white/10 bg-[#111113]/95 shadow-2xl backdrop-blur-xl md:hidden"
            >
              <div className="flex flex-col p-2">
                {NAV_LINKS.map((link) => {
                  if (link.label === "Discord") {
                    return (
                      <a
                        key={link.href}
                        href={DISCORD_INVITE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setMenuOpen(false)}
                        className="rounded-lg px-4 py-3.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.04] hover:text-white"
                      >
                        {link.label}
                      </a>
                    );
                  }

                  const isActive = activeSection === link.sectionId;

                  return (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => scrollTo(link.href)}
                      className={`rounded-lg px-4 py-3.5 text-left text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-neon-crimson/10 text-white"
                          : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                      }`}
                    >
                      {link.label}
                    </button>
                  );
                })}
                <div className="mt-1 border-t border-white/5 p-2">
                  <MagneticButton
                    href={getPurchaseDiscordUrl("navbar-mobile")}
                    className="gradient-crimson flex w-full justify-center rounded-lg py-3 text-sm font-bold shadow-crimson"
                  >
                    Purchase Now
                  </MagneticButton>
                </div>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
