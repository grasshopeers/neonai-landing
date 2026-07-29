import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const discordDir = resolve(__dirname, "..");
const repoRoot = resolve(discordDir, "..");

const apiKey = process.env.RENDER_API_KEY;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!ticketToken || !guildId) {
  console.error("Missing DISCORD_TICKET_BOT_TOKEN or DISCORD_GUILD_ID in discord/.env");
  process.exit(1);
}

const headers = (key: string) => ({
  Authorization: `Bearer ${key}`,
  Accept: "application/json",
  "Content-Type": "application/json",
});

type ServiceRef = { id: string; name: string };

async function listServices(key: string): Promise<ServiceRef[]> {
  const res = await fetch("https://api.render.com/v1/services?limit=100", {
    headers: headers(key),
  });
  if (!res.ok) throw new Error(`List services failed: ${await res.text()}`);
  const body = (await res.json()) as { service?: ServiceRef }[];
  return body.map((row) => row.service).filter(Boolean) as ServiceRef[];
}

async function findOrCreateService(key: string): Promise<ServiceRef> {
  let service = (await listServices(key)).find((s) => s.name === "neonai-ticket-bot");
  if (service) return service;

  console.log("No neonai-ticket-bot service yet — creating Blueprint from GitHub...");
  const blueprintRes = await fetch("https://api.render.com/v1/blueprints", {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      name: "neonai-landing",
      repo: "https://github.com/grasshopeers/neonai-landing",
      branch: "main",
      autoDeploy: "yes",
    }),
  });

  if (!blueprintRes.ok) {
    throw new Error(`Blueprint create failed: ${await blueprintRes.text()}`);
  }

  console.log("Blueprint sync started — waiting for worker service...");
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    service = (await listServices(key)).find((s) => s.name === "neonai-ticket-bot");
    if (service) return service;
    process.stdout.write(".");
  }

  throw new Error("Timed out waiting for neonai-ticket-bot service after Blueprint sync.");
}

async function configureRender(key: string, service: ServiceRef) {
  console.log(`Found service: ${service.name} (${service.id})`);

  const envRes = await fetch(
    `https://api.render.com/v1/services/${service.id}/env-vars`,
    {
      method: "PUT",
      headers: headers(key),
      body: JSON.stringify([
        { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
        { key: "DISCORD_GUILD_ID", value: guildId },
        {
          key: "NEONAI_WEBSITE_URL",
          value: process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app",
        },
      ]),
    }
  );

  if (!envRes.ok) throw new Error(`Set env vars failed: ${await envRes.text()}`);
  console.log("✓ Render environment variables set");

  const deploy = await fetch(
    `https://api.render.com/v1/services/${service.id}/deploys`,
    {
      method: "POST",
      headers: headers(key),
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    }
  );

  if (!deploy.ok) throw new Error(`Deploy trigger failed: ${await deploy.text()}`);
  const deployBody = (await deploy.json()) as { id?: string };
  console.log(`✓ Deploy triggered (${deployBody.id ?? "ok"})`);
  console.log("Dashboard: https://dashboard.render.com/");
}

function installWindowsTask() {
  const script = resolve(discordDir, "scripts/install-ticket-bot-task.ps1");
  if (!existsSync(script)) {
    console.warn("install-ticket-bot-task.ps1 not found — skipping local task");
    return;
  }

  console.log("\nInstalling Windows scheduled task (ticket bot starts at logon)...");
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${script}" -SkipStart`, {
    cwd: discordDir,
    stdio: "inherit",
  });
}

console.log("=== NeonAi hosting setup ===\n");

if (apiKey) {
  try {
    const service = await findOrCreateService(apiKey);
    await configureRender(apiKey, service);
    console.log("\nRender worker configured. Stop any local ticket-bot once Render logs show online.");
  } catch (err) {
    console.error("Render setup failed:", err instanceof Error ? err.message : err);
    console.log("Falling back to local always-on task...\n");
    installWindowsTask();
    process.exit(1);
  }
} else {
  console.log("No RENDER_API_KEY in discord/.env — using local always-on Windows task instead.");
  console.log("(Add RENDER_API_KEY later and re-run: npm run setup-hosting)\n");
  installWindowsTask();
}

console.log("\nDone.");
