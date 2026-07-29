import "dotenv/config";

const apiKey = process.env.RENDER_API_KEY;
const mainToken = process.env.DISCORD_BOT_TOKEN;
const ticketToken = process.env.DISCORD_TICKET_BOT_TOKEN;
const guildId = process.env.DISCORD_GUILD_ID;
const websiteUrl =
  process.env.NEONAI_WEBSITE_URL ?? "https://neonai-official.netlify.app";

if (!apiKey) {
  console.error("Missing RENDER_API_KEY in discord/.env");
  process.exit(1);
}

if (!mainToken || !ticketToken || !guildId) {
  console.error("Missing DISCORD_BOT_TOKEN, DISCORD_TICKET_BOT_TOKEN, or DISCORD_GUILD_ID");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  Accept: "application/json",
  "Content-Type": "application/json",
};

type ServiceRef = { id: string; name: string };

type ServiceDef = {
  name: string;
  startCommand: string;
  envVars: { key: string; value: string }[];
};

const SERVICES: ServiceDef[] = [
  {
    name: "neonai-bot",
    startCommand: "npm run bot",
    envVars: [
      { key: "DISCORD_BOT_TOKEN", value: mainToken },
      { key: "DISCORD_GUILD_ID", value: guildId },
      { key: "NEONAI_WEBSITE_URL", value: websiteUrl },
    ],
  },
  {
    name: "neonai-ticket-bot",
    startCommand: "npm run ticket-bot",
    envVars: [
      { key: "DISCORD_TICKET_BOT_TOKEN", value: ticketToken },
      { key: "DISCORD_GUILD_ID", value: guildId },
      { key: "NEONAI_WEBSITE_URL", value: websiteUrl },
    ],
  },
];

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
  if (!id) throw new Error("No Render workspace found.");
  return id;
}

async function listServices(): Promise<ServiceRef[]> {
  const body = (await api("/services?limit=100")) as { service?: ServiceRef }[];
  return body.map((row) => row.service).filter(Boolean) as ServiceRef[];
}

async function findOrCreateService(
  ownerId: string,
  def: ServiceDef
): Promise<ServiceRef> {
  let service = (await listServices()).find((s) => s.name === def.name);
  if (service) return service;

  console.log(`Creating Render service ${def.name}...`);
  const created = (await api("/services", {
    method: "POST",
    body: JSON.stringify({
      type: "web_service",
      name: def.name,
      ownerId,
      repo: "https://github.com/grasshopeers/neonai-landing",
      branch: "main",
      autoDeploy: "yes",
      rootDir: "discord",
      buildFilter: { paths: ["discord/**"] },
      envVars: def.envVars,
      serviceDetails: {
        runtime: "node",
        plan: "free",
        envSpecificDetails: {
          buildCommand: "npm install",
          startCommand: def.startCommand,
        },
      },
    }),
  })) as { service?: ServiceRef };

  service = created.service;
  if (!service?.id) throw new Error(`Create ${def.name} missing service id`);
  return service;
}

async function setEnvVars(serviceId: string, envVars: { key: string; value: string }[]) {
  await api(`/services/${serviceId}/env-vars`, {
    method: "PUT",
    body: JSON.stringify(envVars),
  });
}

async function triggerDeploy(serviceId: string) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: "POST",
    headers,
    body: JSON.stringify({ clearCache: "do_not_clear" }),
  });
  if (res.status === 202 || res.status === 201) {
    const text = await res.text();
    return text ? JSON.parse(text) : { id: "triggered" };
  }
  throw new Error(`Deploy failed (${res.status}): ${await res.text()}`);
}

try {
  const ownerId = await getOwnerId();

  for (const def of SERVICES) {
    const service = await findOrCreateService(ownerId, def);
    console.log(`\n${service.name} (${service.id})`);
    await setEnvVars(service.id, def.envVars);
    console.log("  env vars set");
    const deploy = await triggerDeploy(service.id);
    console.log(`  deploy triggered (${deploy.id ?? "ok"})`);
  }

  console.log("\nBoth bots deploying on Render.");
  console.log("Dashboard: https://dashboard.render.com/");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
