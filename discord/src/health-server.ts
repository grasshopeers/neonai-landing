import { createServer } from "node:http";

export function startHealthServer(isReady: () => boolean, label = "bot") {
  const port = Number(process.env.PORT ?? 3000);
  createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(isReady() ? "ok" : "starting");
  }).listen(port, () => {
    console.log(`${label} health check on port ${port}`);
  });
}
