import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  DOWNLOAD_REQUEST_URL,
  type DownloadRequestResponse,
} from "../constants";

type DownloadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: DownloadRequestResponse }
  | { kind: "error"; message: string; retryAfter?: number };

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function reasonMessage(data: DownloadRequestResponse): string {
  switch (data.reason) {
    case "invalid_key":
      return "This key was not found. Check for typos or contact support.";
    case "revoked":
      return "This license has been revoked.";
    case "expired":
      return "This license has expired. Purchase a new plan on Discord.";
    case "cooldown":
      return "Download cooldown is active. Please wait before requesting again.";
    case "rate_limited":
      return "Too many requests from your network. Wait a few minutes.";
    case "build_unavailable":
      return data.message || "The build is not available for download yet.";
    case "missing_key":
      return "Enter your license key.";
    default:
      return data.reason || "Download is not available for this key.";
  }
}

export default function DownloadPage() {
  const [keyInput, setKeyInput] = useState("");
  const [state, setState] = useState<DownloadState>({ kind: "idle" });
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [linkLeft, setLinkLeft] = useState(0);

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = window.setInterval(() => {
      setCooldownLeft((v) => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldownLeft]);

  useEffect(() => {
    if (linkLeft <= 0) return;
    const id = window.setInterval(() => {
      setLinkLeft((v) => Math.max(0, v - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [linkLeft]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const key = normalizeKey(keyInput);
    if (!key) {
      setState({ kind: "error", message: "Enter your license key." });
      return;
    }

    setState({ kind: "loading" });
    setLinkLeft(0);
    try {
      const response = await fetch(DOWNLOAD_REQUEST_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await response.json()) as DownloadRequestResponse;

      if (!response.ok && !data.reason) {
        throw new Error(`Server error (${response.status})`);
      }

      if (!data.ok) {
        const retry =
          typeof data.retry_after_seconds === "number"
            ? data.retry_after_seconds
            : data.cooldown_until
              ? Math.max(
                  0,
                  Math.ceil((Date.parse(data.cooldown_until) - Date.now()) / 1000)
                )
              : undefined;
        if (retry && retry > 0) setCooldownLeft(retry);
        setState({
          kind: "error",
          message: reasonMessage(data),
          retryAfter: retry,
        });
        return;
      }

      setState({ kind: "ready", data });
      setLinkLeft(data.expires_in ?? 120);
      if (data.cooldown_until) {
        const secs = Math.max(
          0,
          Math.ceil((Date.parse(data.cooldown_until) - Date.now()) / 1000)
        );
        setCooldownLeft(secs);
      } else if (data.cooldown_seconds) {
        setCooldownLeft(data.cooldown_seconds);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the license server.";
      setState({ kind: "error", message });
    }
  };

  const ready = state.kind === "ready" ? state.data : null;
  const linkAlive = Boolean(ready?.download_url && linkLeft > 0);

  return (
    <div className="relative min-h-screen bg-neon-bg text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(220,38,38,0.12),_transparent_55%)]" />

      <header className="relative z-10 border-b border-white/5 bg-neon-bg/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="text-lg font-black tracking-tight glow-crimson">
            Neon<span className="gradient-text">Ai</span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </a>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10 text-center"
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03]">
            <ShieldCheck className="h-7 w-7 text-neon-crimson" />
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Download your <span className="gradient-text">build</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/50">
            Enter a valid license key to receive a one-time download link. Links expire in{" "}
            <span className="text-white/80">2 minutes</span> and downloads are limited to{" "}
            <span className="text-white/80">once every 20 minutes</span> per key.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8"
        >
          <label htmlFor="license-key" className="mb-2 block text-sm font-semibold">
            License key
          </label>
          <input
            id="license-key"
            type="text"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-neon-panel px-4 py-3 font-mono text-sm tracking-wider text-white outline-none transition-colors placeholder:text-white/25 focus:border-neon-crimson/50"
          />

          <button
            type="submit"
            disabled={state.kind === "loading" || cooldownLeft > 0}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-crimson to-neon-ruby px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {state.kind === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Requesting…
              </>
            ) : cooldownLeft > 0 ? (
              <>Cooldown {formatCountdown(cooldownLeft)}</>
            ) : (
              "Request download"
            )}
          </button>

          {state.kind === "error" && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p>{state.message}</p>
                {cooldownLeft > 0 && (
                  <p className="mt-1 text-red-200/70">
                    Try again in {formatCountdown(cooldownLeft)}.
                  </p>
                )}
              </div>
            </div>
          )}

          {ready?.ok && (
            <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                <div className="w-full space-y-3 text-sm">
                  <p className="font-semibold">Key accepted — download ready</p>
                  <p className="text-white/70">
                    Plan:{" "}
                    <span className="text-white">
                      {ready.plan_label || ready.plan || "—"}
                    </span>
                  </p>
                  {ready.build_id && (
                    <p className="text-white/70">
                      Build: <span className="text-white">{ready.build_id}</span>
                    </p>
                  )}
                  <p className="text-white/70">
                    Link expires in:{" "}
                    <span className="font-mono text-white">
                      {linkAlive ? formatCountdown(linkLeft) : "expired"}
                    </span>
                  </p>

                  {linkAlive && ready.download_url ? (
                    <a
                      href={ready.download_url}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-neon-crimson to-neon-ruby px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90"
                    >
                      <Download className="h-4 w-4" />
                      Download {ready.filename || "build"}
                    </a>
                  ) : (
                    <p className="text-amber-200/90">
                      This link expired. Wait for the cooldown, then request again.
                    </p>
                  )}

                  <p className="text-xs text-white/40">
                    The download is single-use and proxied through our license server. There is no
                    permanent public build URL.
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.form>

        <p className="mt-8 text-center text-xs text-white/35">
          Need a key? Purchase via Discord. Already have one?{" "}
          <a href="/verify" className="text-white/55 underline-offset-2 hover:text-white hover:underline">
            Verify status
          </a>
        </p>
      </main>
    </div>
  );
}
