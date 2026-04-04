import dotenv from "dotenv";

dotenv.config();

export const config = {
  telegramBotToken: required("TELEGRAM_BOT_TOKEN"),
  openaiApiKey: required("OPENAI_API_KEY"),
  openaiModel: process.env.OPENAI_MODEL || "gpt-5",
  kieApiKey: required("KIE_API_KEY"),
  remoteGenerationConcurrency: positiveInt(process.env.REMOTE_GENERATION_CONCURRENCY, 0),
  localRenderConcurrency: positiveInt(process.env.LOCAL_RENDER_CONCURRENCY, 2),
  sharpConcurrency: positiveInt(process.env.SHARP_CONCURRENCY, 2),
  sharpCacheMemoryMb: positiveInt(process.env.SHARP_CACHE_MEMORY_MB, 64),
  googleServiceAccountEmail: required("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
  googleServiceAccountPrivateKey: required("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY").replace(/\\n/g, "\n"),
  microsoftGraphAccessToken: optional("MICROSOFT_GRAPH_ACCESS_TOKEN"),
  microsoftRefreshToken: optional("MICROSOFT_REFRESH_TOKEN"),
  microsoftTenantId: optional("MICROSOFT_TENANT_ID"),
  microsoftClientId: optional("MICROSOFT_CLIENT_ID"),
  microsoftClientSecret: optional("MICROSOFT_CLIENT_SECRET"),
  microsoftScopes: process.env.MICROSOFT_SCOPES || "offline_access Files.Read User.Read",
  outputDir: new URL("../output/", import.meta.url)
};

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name) {
  return process.env[name] || "";
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
