import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair,
  Waves,
  Focus,
  FolderOpen,
  Cpu,
  Zap,
  Activity,
} from "lucide-react";
import {
  DEMO_TABS,
  SAVED_CONFIGS,
  type DemoTab,
} from "../constants";
import SliderControl from "./ui/SliderControl";
import LivePreview, { EasingCurvePreview } from "./LivePreview";

const TAB_ICONS: Record<DemoTab, typeof Crosshair> = {
  "aim-assist": Crosshair,
  humanization: Waves,
  "target-settings": Focus,
  configs: FolderOpen,
};

function StatPill({
  icon: Icon,
  label,
  value,
  accent = false,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
        accent
          ? "border-neon-crimson/25 bg-neon-crimson/10"
          : "border-white/5 bg-white/[0.02]"
      }`}
    >
      <Icon className={`h-3 w-3 ${accent ? "text-neon-crimson" : "text-white/40"}`} />
      <span className="font-mono text-[9px] text-white/35">{label}</span>
      <span className={`font-mono text-[10px] font-bold ${accent ? "text-neon-crimson" : "text-white/70"}`}>
        {value}
      </span>
    </div>
  );
}

export default function DemoPanel() {
  const [activeTab, setActiveTab] = useState<DemoTab>("aim-assist");
  const [fovRadius, setFovRadius] = useState(2.5);
  const [smoothFactor, setSmoothFactor] = useState(4.0);
  const [rcsStrength, setRcsStrength] = useState(65);
  const [microWeight, setMicroWeight] = useState(35);
  const [targetPriority, setTargetPriority] = useState("Head");
  const [secondaryTarget, setSecondaryTarget] = useState("Neck");
  const [activeConfig, setActiveConfig] = useState(0);
  const [uptime, setUptime] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setUptime((u) => u + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const formatUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const tabVariants = {
    enter: { opacity: 0, x: 20, filter: "blur(4px)" },
    center: { opacity: 1, x: 0, filter: "blur(0px)" },
    exit: { opacity: 0, x: -20, filter: "blur(4px)" },
  };

  return (
    <section id="demo" className="snap-start px-6 py-24">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">
            <span className="gradient-text">Control Panel</span>
          </h2>
          <p className="mt-4 text-white/50">
            Tweak settings live — every slider updates the preview in real time.
          </p>
        </motion.div>

        {/* Outer glow shell */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 80, damping: 18 }}
          className="relative"
        >
          <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-neon-crimson/20 via-transparent to-neon-ruby/20 blur-xl" />

          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0c0e] shadow-2xl shadow-black/60">
            {/* Title bar */}
            <div className="relative flex items-center gap-2 border-b border-white/5 bg-gradient-to-r from-black/80 via-[#111113] to-black/80 px-4 py-3">
              <div className="flex gap-1.5">
                <motion.div
                  whileHover={{ scale: 1.2 }}
                  className="h-3 w-3 cursor-pointer rounded-full bg-neon-crimson shadow-[0_0_8px_rgba(220,38,38,0.6)]"
                />
                <div className="h-3 w-3 rounded-full bg-white/15" />
                <div className="h-3 w-3 rounded-full bg-white/15" />
              </div>
              <span className="ml-2 font-mono text-xs text-white/35">
                neonai — control panel v1
              </span>
              <div className="ml-auto flex items-center gap-3">
                <span className="hidden font-mono text-[10px] text-white/25 sm:inline">
                  uptime {formatUptime(uptime)}
                </span>
                <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/5 px-2.5 py-1">
                  <motion.span
                    className="h-1.5 w-1.5 rounded-full bg-green-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <span className="font-mono text-[10px] font-semibold text-green-400">
                    RUNNING
                  </span>
                </span>
              </div>
            </div>

            {/* Telemetry strip */}
            <div className="flex flex-wrap gap-2 border-b border-white/5 bg-black/30 px-4 py-2.5">
              <StatPill icon={Zap} label="FPS" value="200+" accent />
              <StatPill icon={Activity} label="LAT" value="0.2ms" />
              <StatPill icon={Cpu} label="BACKEND" value="VTM" accent />
              <StatPill icon={Crosshair} label="CAPTURE" value="DXGI" />
            </div>

            <div className="flex flex-col lg:flex-row">
              {/* Sidebar */}
              <div className="relative flex flex-row overflow-x-auto border-b border-white/5 lg:w-56 lg:flex-col lg:border-r lg:border-b-0">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-neon-crimson/[0.03] to-transparent" />
                {DEMO_TABS.map((tab) => {
                  const Icon = TAB_ICONS[tab.id];
                  const isActive = activeTab === tab.id;
                  return (
                    <motion.button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.97 }}
                      className={`relative flex items-center gap-3 whitespace-nowrap px-5 py-4 text-left text-sm font-medium transition-colors ${
                        isActive
                          ? "text-white"
                          : "text-white/35 hover:bg-white/[0.03] hover:text-white/65"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="demo-tab-bg"
                          className="absolute inset-0 bg-gradient-to-r from-neon-crimson/15 to-transparent"
                          transition={{ type: "spring", stiffness: 350, damping: 30 }}
                        />
                      )}
                      {isActive && (
                        <motion.span
                          layoutId="demo-tab-bar"
                          className="absolute inset-y-2 left-0 w-1 rounded-full bg-neon-crimson shadow-crimson-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 28 }}
                        />
                      )}
                      <Icon
                        className={`relative z-10 h-4 w-4 shrink-0 ${
                          isActive ? "text-neon-crimson" : "text-white/30"
                        }`}
                      />
                      <span className="relative z-10">{tab.label}</span>
                    </motion.button>
                  );
                })}
              </div>

              {/* Main workspace */}
              <div className="grid flex-1 gap-0 lg:grid-cols-2">
                {/* Controls */}
                <div className="relative min-h-[300px] border-b border-white/5 p-6 lg:border-r lg:border-b-0 lg:p-8">
                  <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-[0.03]" />

                  <AnimatePresence mode="wait">
                    {activeTab === "aim-assist" && (
                      <motion.div
                        key="aim-assist"
                        variants={tabVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 260, damping: 26 }}
                        className="relative space-y-6"
                      >
                        <div className="flex items-center gap-2">
                          <Crosshair className="h-5 w-5 text-neon-crimson" />
                          <h3 className="text-lg font-bold tracking-tight">
                            Aim Assist
                          </h3>
                        </div>
                        <SliderControl
                          label="FOV Radius"
                          value={fovRadius}
                          min={1}
                          max={10}
                          step={0.5}
                          unit="°"
                          onChange={setFovRadius}
                        />
                        <SliderControl
                          label="Smooth Factor"
                          value={smoothFactor}
                          min={1}
                          max={10}
                          step={0.5}
                          unit=""
                          onChange={setSmoothFactor}
                        />
                        <EasingCurvePreview smoothFactor={smoothFactor} />
                      </motion.div>
                    )}

                    {activeTab === "humanization" && (
                      <motion.div
                        key="humanization"
                        variants={tabVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 260, damping: 26 }}
                        className="relative space-y-6"
                      >
                        <div className="flex items-center gap-2">
                          <Waves className="h-5 w-5 text-neon-crimson" />
                          <h3 className="text-lg font-bold tracking-tight">
                            Humanization
                          </h3>
                        </div>
                        <SliderControl
                          label="Recoil Compensation (RCS)"
                          value={rcsStrength}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={setRcsStrength}
                        />
                        <SliderControl
                          label="Micro-adjustment Weight"
                          value={microWeight}
                          min={0}
                          max={100}
                          step={1}
                          unit="%"
                          onChange={setMicroWeight}
                        />
                        <div className="relative overflow-hidden rounded-xl border border-neon-crimson/20 bg-gradient-to-br from-neon-crimson/10 to-transparent p-5">
                          <motion.div
                            className="absolute inset-0 bg-neon-crimson/5"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <p className="relative text-xs text-white/40">
                            Humanization score
                          </p>
                          <motion.p
                            key={rcsStrength + microWeight}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="relative mt-1 text-3xl font-black text-neon-crimson"
                          >
                            {Math.round((rcsStrength + microWeight) / 2)}%
                          </motion.p>
                        </div>
                      </motion.div>
                    )}

                    {activeTab === "target-settings" && (
                      <motion.div
                        key="target-settings"
                        variants={tabVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 260, damping: 26 }}
                        className="relative space-y-6"
                      >
                        <div className="flex items-center gap-2">
                          <Focus className="h-5 w-5 text-neon-crimson" />
                          <h3 className="text-lg font-bold tracking-tight">
                            Target Priority
                          </h3>
                        </div>
                        {[
                          { id: "primary-target", label: "Primary Target", value: targetPriority, set: setTargetPriority },
                          { id: "secondary-target", label: "Secondary Target", value: secondaryTarget, set: setSecondaryTarget },
                        ].map((field) => (
                          <div key={field.id}>
                            <label htmlFor={field.id} className="mb-2 block text-sm font-medium text-white/70">
                              {field.label}
                            </label>
                            <select
                              id={field.id}
                              value={field.value}
                              onChange={(e) => field.set(e.target.value)}
                              className="w-full cursor-pointer rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-all focus:border-neon-crimson/50 focus:shadow-crimson-sm"
                            >
                              {["Head", "Neck", "Chest"].map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                        <motion.div
                          layout
                          className="rounded-xl border border-neon-crimson/25 bg-neon-crimson/5 p-4"
                        >
                          <p className="text-sm text-white/50">
                            Active chain:{" "}
                            <span className="font-bold text-neon-crimson">{targetPriority}</span>
                            <span className="text-white/30"> → </span>
                            <span className="font-bold text-white/80">{secondaryTarget}</span>
                          </p>
                        </motion.div>
                      </motion.div>
                    )}

                    {activeTab === "configs" && (
                      <motion.div
                        key="configs"
                        variants={tabVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 260, damping: 26 }}
                        className="relative space-y-3"
                      >
                        <div className="mb-4 flex items-center gap-2">
                          <FolderOpen className="h-5 w-5 text-neon-crimson" />
                          <h3 className="text-lg font-bold tracking-tight">Configs</h3>
                        </div>
                        {SAVED_CONFIGS.map((config, index) => (
                          <motion.button
                            key={config.name}
                            type="button"
                            onClick={() => setActiveConfig(index)}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.98 }}
                            className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition-all ${
                              activeConfig === index
                                ? "border-neon-crimson/40 bg-gradient-to-r from-neon-crimson/15 to-transparent shadow-crimson-sm"
                                : "border-white/5 bg-white/[0.02] hover:border-white/10"
                            }`}
                          >
                            <span className="text-sm font-medium">{config.name}</span>
                            {activeConfig === index && (
                              <motion.span
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="rounded-full bg-neon-crimson/25 px-2.5 py-0.5 text-xs font-bold text-neon-crimson"
                              >
                                ACTIVE
                              </motion.span>
                            )}
                          </motion.button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Live preview — sticky on desktop */}
                <div className="relative bg-black/20 p-4 lg:sticky lg:top-24 lg:p-6">
                  <LivePreview
                    fovRadius={fovRadius}
                    smoothFactor={smoothFactor}
                    targetPriority={targetPriority}
                    activeTab={activeTab}
                  />
                </div>
              </div>
            </div>

            {/* Demo disclaimer */}
            <div className="border-t border-white/5 bg-black/40 px-4 py-3 sm:px-6">
              <p className="text-center text-[11px] leading-relaxed text-white/30 sm:text-left">
                <span className="font-semibold text-white/40">Visual demo only.</span>{" "}
                This control panel is an illustrative preview of the NeonAi interface.
                The production application may differ in layout, labeling, and available
                options as features are updated across releases.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
