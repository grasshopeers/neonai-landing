import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiKey = process.env.RENDER_API_KEY;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!apiKey) {
  console.error(`
Missing RENDER_API_KEY.

1. Open https://dashboard.render.com/u/settings#api-keys
2. Create an API key
3. Run:
   $env:RENDER_API_KEY="rnd_..."
   npm run configure-render
`);
  process.exit(1);
}

if (!ticketToken || !guildId) {
  console.error("Missing DISCORD_TICKET_BOT_TOKEN or DISCORD_GUILD_ID in discord/.env");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

const services = await fetch("https://api.render.com/v1/services?limit=50", {
  headers,
}).then((r) => r.json());

const list = services as { cursor?: string; service?: { id: string; name: string; type: string } }[];
const flat = Array.isArray(services)
  ? services
  : list.flatMap?.((item) => (item.service ? [item.service] : [])) ?? [];

let service =
  flat.find((s: { name?: string }) => s.name === "neonai-ticket-bot") ??
  null;

if (!service) {
  const page = await fetch("https://api.render.com/v1/services?name=neonai-ticket-bot", {
    headers,
  }).then((r) => r.json());
  const fromSearch = (page as { service?: { id: string; name: string } }[]).map(
    (p) => p.service
  ).filter(Boolean);
  service = fromSearch[0] ?? null;
}

if (!service?.id) {
  console.error("Could not find Render service 'neonai-ticket-bot'.");
  console.error("Create the Blueprint from render.yaml first, then re-run.");
  process.exit(1);
}

console.log(`Found service: ${service.name} (${service.id})`);

const envRes = await fetch(
  `https://api.render.com/v1/services/${service.id}/env-vars`,
  {
    method: "PUT",
    headers,
    body: JSON.stringify([
      { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
      { key: "DISCORD_GUILD_ID", value: guildId },
      { key: "NEONAI_WEBSITE_URL", value: process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app" },
    ]),
  }
);

if (!envRes.ok) {
  console.error("Failed to set env vars:", await envRes.text());
  process.exit(1);
}

console.log("✓ Environment variables set on Render");

const deploy = await fetch(
  `https://api.render.com/v1/services/${service.id}/deploys`,
  {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  }
);

if (!deploy.ok) {
  console.error("Env set but deploy trigger failed:", await deploy.text());
  process.exit(1);
}

const deployBody = await deploy.json();
console.log(`✓ Deploy triggered: ${deployBody.id ?? "ok"}`);
console.log("\nStop your local ticket bot — only one process can use the same token.");
console.log("Dashboard: https://dashboard.render.com/");
