import "dotenv/config";

const apiKey = process.env.RENDER_API_KEY;
const mainToken = process.env.DISCORD_BOT_TOKEN;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const websiteUrl =
  process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app";

if (!apiKey) {
  console.error("Missing RENDER_API_KEY");
  process.exit(1);
}
if (!mainToken || !ticketToken || !guildId) {
  console.error("Missing bot tokens or DISCORD_GUILD_ID");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

type ServiceRef = { id: string; name: string };

const CLOUD_SERVICE = "neonai-bots";
const LEGACY_SERVICES = ["neonai-bot", "neonai-ticket-bot"];

const envVars = [
  { key: "DISCORD_BOT_TOKEN", value: mainToken },
  { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
  { key: "DISCORD_GUILD_ID", value: guildId },
  { key: "NEONAI_WEBSITE_URL", value: websiteUrl },
];

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function listServices(): Promise<ServiceRef[]> {
  const body = (await api("/services?limit=100")) as { service?: ServiceRef }[];
  return body.map((r) => r.service).filter(Boolean) as ServiceRef[];
}

async function getOwnerId() {
  const owners = (await api("/owners")) as { owner?: { id: string } }[];
  return owners[0]?.owner?.id as string;
}

async function upsertCloudService(ownerId: string) {
  let service = (await listServices()).find((s) => s.name === CLOUD_SERVICE);
  if (!service) {
    console.log(`Creating ${CLOUD_SERVICE}...`);
    const created = (await api("/services", {
      method: "POST",
      body: JSON.stringify({
        type: "web_service",
        name: CLOUD_SERVICE,
        ownerId,
        repo: "https://github.com/grasshopeers/neonai-landing",
        branch: "main",
        autoDeploy: "yes",
        rootDir: "discord",
        buildFilter: { paths: ["discord/**"] },
        envVars,
        serviceDetails: {
          runtime: "node",
          plan: "free",
          envSpecificDetails: {
            buildCommand: "npm install",
            startCommand: "npm run cloud-bots",
          },
        },
      }),
    })) as { service?: ServiceRef };
    service = created.service;
  }
  if (!service?.id) throw new Error("Cloud service missing id");
  return service;
}

async function deploy(serviceId: string) {
  await api(`/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify(envVars),
  });
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  });
  if (!res.ok && res.status !== 202 && res.status !== 201) {
    throw new Error(`Deploy failed: ${await res.text()}`);
  }
}

try {
  const ownerId = await getOwnerId();
  const service = await upsertCloudService(ownerId);
  console.log(`${service.name} (${service.id})`);
  await deploy(service.id);
  console.log("Deploy triggered — both bots run in one service (fits free tier hours).");

  for (const legacy of LEGACY_SERVICES) {
    const old = (await listServices()).find((s) => s.name === legacy);
    if (old) console.log(`Legacy service still exists: ${legacy} — suspend/delete in Render dashboard to save hours.`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
