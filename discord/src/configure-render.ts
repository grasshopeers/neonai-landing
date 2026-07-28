import "dotenv/config";

const apiKey = process.env.RENDER_API_KEY;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;

if (!apiKey) {
  console.error("Missing RENDER_API_KEY in discord/.env");
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

type ServiceRef = { id: string; name: string };

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed (${res.status}): ${text || res.statusText}`);
  }
  return text ? JSON.parse(text) : null;
}

async function getOwnerId(): Promise<string> {
  const owners = (await api("/owners")) as { owner?: { id: string } }[];
  const id = owners[0]?.owner?.id;
  if (!id) throw new Error("No Render workspace found on this account.");
  return id;
}

async function listServices(): Promise<ServiceRef[]> {
  const body = (await api("/services?limit=100")) as { service?: ServiceRef }[];
  return body.map((row) => row.service).filter(Boolean) as ServiceRef[];
}

async function findOrCreateService(ownerId: string): Promise<ServiceRef> {
  let service = (await listServices()).find((s) => s.name === "neonai-ticket-bot");
  if (service) return service;

  console.log("Creating Render background worker neonai-ticket-bot...");
  const created = (await api("/services", {
    method: "POST",
    body: JSON.stringify({
      type: "web_service",
      name: "neonai-ticket-bot",
      ownerId,
      repo: "https://github.com/grasshopeers/neonai-landing",
      branch: "main",
      autoDeploy: "yes",
      rootDir: "discord",
      buildFilter: { paths: ["discord/**"] },
      envVars: [
        { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
        { key: "DISCORD_GUILD_ID", value: guildId },
        {
          key: "NEONAI_WEBSITE_URL",
          value: process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app",
        },
      ],
      serviceDetails: {
        runtime: "node",
        plan: "free",
        envSpecificDetails: {
          buildCommand: "npm install",
          startCommand: "npm run ticket-bot",
        },
      },
    }),
  })) as { service?: ServiceRef };

  service = created.service;
  if (!service?.id) throw new Error("Service create response missing service id.");
  return service;
}

async function setEnvVars(serviceId: string) {
  await api(`/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify([
      { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
      { key: "DISCORD_GUILD_ID", value: guildId },
      {
        key: "NEONAI_WEBSITE_URL",
        value: process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app",
      },
    ]),
  });
}

async function triggerDeploy(serviceId: string) {
  return api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  }) as Promise<{ id?: string }>;
}

try {
  const ownerId = await getOwnerId();
  const service = await findOrCreateService(ownerId);
  console.log(`Service: ${service.name} (${service.id})`);

  await setEnvVars(service.id);
  console.log("Environment variables set on Render");

  const deploy = await triggerDeploy(service.id);
  console.log(`Deploy triggered (${deploy.id ?? "ok"})`);
  console.log("\nStop your local ticket bot once Render logs show online.");
  console.log("Dashboard: https://dashboard.render.com/");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
