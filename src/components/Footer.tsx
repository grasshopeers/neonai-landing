import { MessageCircle, ExternalLink } from "lucide-react";
import { DISCORD_INVITE_URL, getPurchaseDiscordUrl, SYSTEM_REQUIREMENTS } from "../constants";
import MagneticButton from "./ui/MagneticButton";

export default function Footer() {
  return (
    <footer className="border-t border-white/5">
      {/* Discord CTA strip */}
      <div
        id="discord-cta"
        className="relative overflow-hidden border-b border-white/5 px-6 py-12"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-neon-crimson/5 via-transparent to-neon-ruby/5" />
        <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
          <p className="text-sm font-semibold tracking-wide text-neon-crimson uppercase">
            Join the community
          </p>
          <h3 className="text-2xl font-black tracking-tight sm:text-3xl">
            Open a ticket on Discord to purchase or get support
          </h3>
          <div className="flex flex-col gap-3 sm:flex-row">
            <MagneticButton
              href={getPurchaseDiscordUrl("footer")}
              className="gradient-crimson flex items-center justify-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold shadow-crimson"
            >
              <MessageCircle className="h-5 w-5" />
              Get License via Discord
            </MagneticButton>
            <MagneticButton
              href={DISCORD_INVITE_URL}
              className="rounded-xl border border-white/10 px-8 py-3.5 text-sm font-semibold text-white/80 transition-colors hover:border-neon-crimson/40"
            >
              Join Community
            </MagneticButton>
          </div>
        </div>
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-neon-crimson/50 to-transparent" />
        <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-neon-crimson/50 to-transparent" />
      </div>

      {/* System requirements */}
      <div className="border-b border-white/5 px-6 py-6">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-4 sm:justify-start">
          <span className="text-xs font-semibold tracking-wide text-white/30 uppercase">
            System requirements
          </span>
          {SYSTEM_REQUIREMENTS.map((req) => (
            <span
              key={req}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-white/50"
            >
              {req}
            </span>
          ))}
        </div>
      </div>

      <div className="px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <div className="text-center md:text-left">
              <p className="text-xl font-black tracking-tight glow-crimson">
                Neon<span className="gradient-text">Ai</span>
              </p>
              <p className="mt-2 text-xs text-white/30">
                &copy; 2026 NeonAi. All rights reserved.
              </p>
            </div>

            <div className="flex gap-6 text-sm text-white/40">
              <a href="#" className="transition-colors hover:text-white/70">
                Terms of Service
              </a>
              <a href="#" className="transition-colors hover:text-white/70">
                Privacy Policy
              </a>
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-white/70"
              >
                Discord
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-xs leading-relaxed text-white/20 md:text-left">
            NeonAi and all associated branding, software, and documentation are
            protected intellectual property. Unauthorized reproduction,
            distribution, or reverse engineering is strictly prohibited.
          </p>
        </div>
      </div>
    </footer>
  );
}
