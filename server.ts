import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { ACMManager } from "./src/server/manager.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;
  const acm = new ACMManager();

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.post("/api/telemetry", (req, res) => {
    const { objects } = req.body;
    acm.ingestTelemetry(objects);
    res.json({ status: "ok", count: objects.length });
  });

  app.post("/api/maneuver/schedule", (req, res) => {
    const { satelliteId, burn } = req.body;
    acm.scheduleManeuver(satelliteId, burn);
    res.json({ status: "ok" });
  });

  app.post("/api/simulate/step", (req, res) => {
    const { dt } = req.body;
    const result = acm.step(dt || 60);
    res.json(result);
  });

  app.get("/api/visualization/snapshot", (req, res) => {
    res.json(acm.getSnapshot());
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal Server Error", message: err.message });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ACM Server running on http://localhost:${PORT}`);
  });
}

startServer();
