import { ACTIVATION_TICKER_ITEMS } from "../constants";

export default function ActivationsTicker() {
  const items = [...ACTIVATION_TICKER_ITEMS, ...ACTIVATION_TICKER_ITEMS];

  return (
    <div className="relative overflow-hidden border-y border-white/5 bg-white/[0.02] py-3">
      <div className="absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-neon-bg to-transparent sm:w-16" />
      <div className="absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-neon-bg to-transparent sm:w-16" />

      <div className="flex w-max animate-ticker whitespace-nowrap will-change-transform motion-reduce:animate-none">
        {items.map((item, i) => (
          <span
            key={i}
            className="mx-6 inline-flex items-center gap-2 text-xs text-white/40 sm:mx-8"
          >
            <span className="h-1 w-1 rounded-full bg-green-500/80 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
            {item}
            <span className="rounded border border-green-500/50 bg-green-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-green-400 uppercase shadow-[0_0_10px_rgba(34,197,94,0.35)]">
              Activated
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}
