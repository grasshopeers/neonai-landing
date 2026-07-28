import "dotenv/config";

const token = process.env.DISCORD_TICKET_BOT_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TICKET_BOT_TOKEN");
  process.exit(1);
}

const headers = {
  Authorization: `Bot ${token}`,
  "Content-Type": "application/json",
};

const app = await fetch("https://discord.com/api/v10/oauth2/applications/@me", {
  headers,
}).then((r) => r.json());

console.log(`Application: ${app.name} (${app.id})`);
console.log(`Current flags: ${app.flags ?? 0}`);

/** Limited privileged intents (bots in <100 servers) — API-updatable */
const GATEWAY_GUILD_MEMBERS_LIMITED = 1 << 15;
const GATEWAY_MESSAGE_CONTENT_LIMITED = 1 << 19;
const needed =
  GATEWAY_GUILD_MEMBERS_LIMITED | GATEWAY_MESSAGE_CONTENT_LIMITED;
const newFlags = (app.flags ?? 0) | needed;

if ((app.flags & needed) === needed) {
  console.log("✓ Server Members + Message Content intents already enabled");
} else {
  const res = await fetch("https://discord.com/api/v10/applications/@me", {
    method: "PATCH",
    headers,
    body: JSON.stringify({ flags: newFlags }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("Could not enable intents via API:", body);
    console.log(
      `\nEnable manually:\nhttps://discord.com/developers/applications/${app.id}/bot\n` +
        "→ Privileged Gateway Intents → turn ON:\n" +
        "   • Server Members Intent\n" +
        "   • Message Content Intent\n"
    );
    process.exit(1);
  }
  console.log("✓ Enabled Server Members + Message Content intents");
}

const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${app.id}&permissions=8&scope=bot&guild_id=${process.env.DISCORD_GUILD_ID ?? ""}`;
console.log(`\nInvite to server:\n${inviteUrl}\n`);
