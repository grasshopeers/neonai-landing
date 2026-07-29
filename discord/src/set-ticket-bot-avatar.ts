import "dotenv/config";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const token = process.env.DISCORD_TICKET_BOT_TOKEN;
if (!token) {
  console.error("Missing DISCORD_TICKET_BOT_TOKEN in discord/.env");
  process.exit(1);
}

const avatarPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/neonai-tickets-avatar.png"
);

const image = readFileSync(avatarPath);
const avatar = `data:image/png;base64,${image.toString("base64")}`;

const res = await fetch("https://discord.com/api/v10/users/@me", {
  method: "PATCH",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ avatar }),
});

if (!res.ok) {
  console.error("Failed to set avatar:", res.status, await res.text());
  process.exit(1);
}

const user = (await res.json()) as { username: string; avatar: string };
console.log(`Avatar updated for ${user.username}`);
console.log(`https://cdn.discordapp.com/avatars/${user.id ?? "bot"}/${user.avatar}.png`);
