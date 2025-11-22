// Load env: prefer .env.local in dev, then .env (production defaults)
import { config } from "dotenv";
config({ path: ".env.local", override: true });
config();

import http from "http";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import path from "path";
import apiRouter from "./routes/api.js";
import tradesRouter from "./routes/trades.js";
import { attachWsServers } from "./ws/index.js";

const app = express();

// ===== Security & perf =====
const WEB_ORIGIN = process.env.WEB_ORIGIN || "*"; // set this in Railway
const IMAGE_HOST = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com";
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://ejsaflvzljklapbrcfxr.supabase.co",
          "wss://ejsaflvzljklapbrcfxr.supabase.co",
          "https://hdadmin.up.railway.app",
          "https://api.massive.com",
          "wss://hdadmin.up.railway.app",
          "wss://socket.massive.com",
        ],
        imgSrc: ["'self'", "data:", IMAGE_HOST],
        frameAncestors: ["'self'"],
      },
    },
  })
);
app.use(compression());
app.use(
  cors({
    origin: WEB_ORIGIN === "*" ? "*" : [WEB_ORIGIN],
    credentials: false,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// Basic request logging (redact api keys)
app.set("trust proxy", 1);
app.use(
  morgan("tiny", {
    skip: (req: Request) => req.url.includes("/api/massive"),
  })
);

// Rate limit API paths
// Skip rate limiting entirely for /api/massive since it has its own upstream limits
const generalLimiter = rateLimit({ windowMs: 60_000, max: 1200 });

app.use("/api", (req, res, next) => {
  // Skip rate limiting for Massive proxy to avoid false 429s; upstream Massive has its own limits
  if (req.path.startsWith("/massive")) {
    return next();
  }
  return generalLimiter(req, res, next);
});

// ===== API routes =====
app.use("/api", apiRouter);
app.use(tradesRouter); // Trades router handles its own /api/trades* paths

// Diagnostic: expose limited MASSIVE_API_KEY presence (no full key)
app.get("/api/massive-key-status", (_req: Request, res: Response) => {
  const key = process.env.MASSIVE_API_KEY || "";
  res.json({
    present: Boolean(key),
    length: key.length,
    prefix: key ? key.slice(0, 6) + "…" : null,
    nodeEnv: process.env.NODE_ENV || "unknown",
  });
});

// ===== Health Check Endpoint =====
app.get("/api/health", async (_req: Request, res: Response) => {
  const health = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      massive: false,
      supabase: false,
      scanner: false,
    },
    details: {} as any,
  };

  // Check Massive.com connectivity
  try {
    const massiveResponse = await fetch("https://api.massive.com/v1/marketstatus/now", {
      headers: {
        Authorization: `Bearer ${process.env.MASSIVE_API_KEY}`,
      },
      signal: AbortSignal.timeout(3000),
    });
    health.services.massive = massiveResponse.ok;
    health.details.massive = {
      status: massiveResponse.status,
      ok: massiveResponse.ok,
    };
  } catch (error: any) {
    health.services.massive = false;
    health.details.massive = {
      error: error.message || "Connection failed",
    };
  }

  // Check Supabase connectivity
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Quick health check query
      const { error } = await supabase.from("profiles").select("count").limit(1).maybeSingle();

      health.services.supabase = !error;
      health.details.supabase = error ? { error: error.message } : { ok: true };
    } else {
      health.services.supabase = false;
      health.details.supabase = { error: "Missing Supabase credentials" };
    }
  } catch (error: any) {
    health.services.supabase = false;
    health.details.supabase = {
      error: error.message || "Connection failed",
    };
  }

  // Check scanner worker heartbeat
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from("scanner_heartbeat")
        .select("*")
        .eq("id", "composite_scanner")
        .maybeSingle();

      if (!error && data) {
        const lastScan = new Date(data.last_scan).getTime();
        const now = Date.now();
        const ageMinutes = (now - lastScan) / 60000;

        // Scanner is healthy if last scan was within 2 minutes
        health.services.scanner = ageMinutes < 2;
        health.details.scanner = {
          lastScan: data.last_scan,
          ageMinutes: Math.round(ageMinutes * 10) / 10,
          signalsDetected: data.signals_detected,
          status: data.status,
          healthy: ageMinutes < 2,
        };
      } else {
        health.services.scanner = false;
        health.details.scanner = {
          error: error?.message || "No heartbeat record found",
        };
      }
    } else {
      health.services.scanner = false;
      health.details.scanner = { error: "Missing Supabase credentials" };
    }
  } catch (error: any) {
    health.services.scanner = false;
    health.details.scanner = {
      error: error.message || "Connection failed",
    };
  }

  // Determine overall health
  const allHealthy = Object.values(health.services).every((v) => v);
  health.status = allHealthy ? "ok" : "degraded";

  res.status(allHealthy ? 200 : 503).json(health);
});

// ===== Static SPA (vite build) =====
const distDir = path.resolve(process.cwd(), "dist");
const indexFile = path.join(distDir, "index.html");
app.use(express.static(distDir));
app.get("/ping", (_req, res) => {
  console.log("[Server] /ping hit");
  res.json({ status: "pong" });
});
app.get("*", (_, res, next) => {
  res.sendFile(indexFile, (err) => {
    if (err) {
      console.error("[Server] Failed to send index.html", err);
      next(err);
    }
  });
});

app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error("[Server] Express error handler", err);
  res.status(500).json({ error: "Internal server error" });
});

// ===== HTTP server + WS proxies =====
const httpServer = http.createServer(app);
attachWsServers(httpServer);

const defaultPort = process.env.NODE_ENV === "development" ? 3000 : 8080;
const PORT = Number(process.env.PORT || defaultPort);

httpServer.listen(PORT, "0.0.0.0", async () => {
  console.log(`✓ Server listening on ${PORT} (${process.env.NODE_ENV || "production"})`);
  if (!process.env.MASSIVE_API_KEY) {
    console.warn("⚠️  MASSIVE_API_KEY is not set — REST/WS proxy will reject upstream calls");
  } else {
    const masked = process.env.MASSIVE_API_KEY.slice(0, 6) + "…";
    console.log(
      `MASSIVE_API_KEY detected (prefix=${masked}, length=${process.env.MASSIVE_API_KEY.length})`
    );
  }

  // Start composite scanner worker
  try {
    const { CompositeScannerWorker } = await import("./workers/compositeScanner.js");
    const scannerWorker = new CompositeScannerWorker();
    await scannerWorker.start();
  } catch (error) {
    console.error("[Server] Failed to start composite scanner worker:", error);
  }
});

export default app;
