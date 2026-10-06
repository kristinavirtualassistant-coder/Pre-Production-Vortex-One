const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineJsonSecret } = require("firebase-functions/params");

const runtimeConfig = defineJsonSecret("VORTEX_ONE_RUNTIME_CONFIG");

let appPromise;

function loadRuntimeConfig() {
  const config = runtimeConfig.value();
  if (!config || typeof config !== "object") {
    throw new Error("VORTEX_ONE_RUNTIME_CONFIG must contain a JSON object");
  }
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined && value !== null) process.env[key] = String(value);
  }
}

async function getApp() {
  loadRuntimeConfig();
  if (!appPromise) {
    const { createApp } = require("./dist/server.cjs");
    appPromise = createApp();
  }
  return appPromise;
}

exports.api = onRequest(
  {
    region: "us-west1",
    timeoutSeconds: 60,
    memory: "1GiB",
    maxInstances: 20,
    secrets: [runtimeConfig],
  },
  async (req, res) => {
    try {
      const app = await getApp();
      return app(req, res);
    } catch (error) {
      console.error("Vortex One API initialization failed:", error);
      return res.status(503).json({ error: "Service temporarily unavailable" });
    }
  },
);

exports.workerTick = onSchedule(
  {
    schedule: "every 1 minutes",
    timeZone: "UTC",
    region: "us-west1",
    timeoutSeconds: 540,
    memory: "1GiB",
    maxInstances: 1,
    secrets: [runtimeConfig],
  },
  async () => {
    loadRuntimeConfig();
    const { runFirebaseWorkerTick } = require("./dist/worker.cjs");
    return runFirebaseWorkerTick();
  },
);
