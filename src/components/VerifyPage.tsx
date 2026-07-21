import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, XCircle } from "lucide-react";
import { VERIFY_STATUS_URL, type VerifyStatusResponse } from "../constants";

type VerifyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "done"; data: VerifyStatusResponse }
  | { kind: "error"; message: string };

function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return "Never (lifetime)";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function reasonMessage(data: VerifyStatusResponse): string {
  switch (data.reason) {
    case "invalid_key":
      return "This key was not found. Check for typos or contact support.";
    case "revoked":
      return "This license has been revoked. Open a Discord ticket if you believe this is an error.";
    case "expired":
      return "This license has expired. Purchase a new plan on Discord.";
    case "rate_limited":
      return "Too many checks from your network. Wait a few minutes and try again.";
    case "missing_key":
      return "Enter your license key.";
    default:
      return data.reason || "This key cannot be used.";
  }
}

export default function VerifyPage() {
  const [keyInput, setKeyInput] = useState("");
  const [state, setState] = useState<VerifyState>({ kind: "idle" });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const key = normalizeKey(keyInput);
    if (!key) {
      setState({ kind: "error", message: "Enter your license key." });
      return;
    }

    setState({ kind: "loading" });
    try {
      const response = await fetch(VERIFY_STATUS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const data = (await response.json()) as VerifyStatusResponse;
      if (!response.ok && !data.reason) {
        throw new Error(`Server error (${response.status})`);
      }
      setState({ kind: "done", data });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not reach the license server.";
      setState({ kind: "error", message });
    }
  };

  const result = state.kind === "done" ? state.data : null;
  const isValid = Boolean(result?.valid);

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
            <KeyRound className="h-7 w-7 text-neon-crimson" />
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            Verify your <span className="gradient-text">license key</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/50">
            Check whether a license key is valid, expired, or already in use.
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
            disabled={state.kind === "loading"}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-neon-crimson to-neon-ruby px-4 py-3 text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto"
          >
            {state.kind === "loading" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking…
              </>
            ) : (
              "Check key status"
            )}
          </button>

          {state.kind === "error" && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{state.message}</p>
            </div>
          )}

          {result && (
            <div
              className={`mt-6 rounded-xl border px-4 py-4 ${
                isValid
                  ? "border-emerald-500/20 bg-emerald-500/10"
                  : "border-red-500/20 bg-red-500/10"
              }`}
            >
              <div className="flex items-start gap-3">
                {isValid ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                )}
                <div className="space-y-2 text-sm">
                  <p className="font-semibold">
                    {isValid ? "Key is valid" : "Key is not usable"}
                  </p>
                  {!isValid && <p className="text-white/70">{reasonMessage(result)}</p>}
                  {isValid && (
                    <>
                      <p className="text-white/70">
                        Plan: <span className="text-white">{result.plan_label || result.plan}</span>
                      </p>
                      <p className="text-white/70">
                        Expires: <span className="text-white">{formatExpiry(result.expires)}</span>
                      </p>
                      <p className="text-white/70">
                        Status:{" "}
                        <span className="text-white">
                          {result.activated ? "Already in use" : "Available"}
                        </span>
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </motion.form>
      </main>
    </div>
  );
}
