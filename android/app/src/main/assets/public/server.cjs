var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_config = require("dotenv/config");
var KEYS_FILE = import_path.default.join(process.cwd(), "g_keys.json");
var envKeyCooldowns = /* @__PURE__ */ new Map();
function loadBackupKeys() {
  try {
    if (import_fs.default.existsSync(KEYS_FILE)) {
      const data = import_fs.default.readFileSync(KEYS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading backup keys file:", err);
  }
  return [];
}
function saveBackupKeys(keys) {
  try {
    import_fs.default.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing backup keys file:", err);
  }
}
function maskKey(key) {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "****";
  return trimmed.substring(0, 6) + "..." + trimmed.substring(trimmed.length - 4);
}
function translateGeminiError(error) {
  const msg = String(error.message || error).toLowerCase();
  if (msg.includes("api_key") || msg.includes("api key") || msg.includes("key is invalid") || msg.includes("api_key_invalid") || msg.includes("invalid key")) {
    return "Gemini API Key-\u099F\u09BF \u09AC\u09C8\u09A7 \u09A8\u09DF \u0985\u09A5\u09AC\u09BE \u098F\u099F\u09BF \u09B8\u09A0\u09BF\u0995\u09AD\u09BE\u09AC\u09C7 \u09B8\u09C7\u099F\u09BF\u0982\u09B8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2\u09C7 \u0995\u09A8\u09AB\u09BF\u0997\u09BE\u09B0 \u0995\u09B0\u09BE \u09B9\u09DF\u09A8\u09BF\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 Google AI Studio \u09A5\u09C7\u0995\u09C7 \u09A8\u09A4\u09C1\u09A8 \u09B0\u09BF-\u099C\u09C7\u09A8\u09BE\u09B0\u09C7\u099F \u0995\u09B0\u09BE \u098F\u09AC\u0982 \u09B8\u099A\u09B2 API Key \u0985\u09CD\u09AF\u09BE\u09AA \u09B8\u09C7\u099F\u09BF\u0982\u09B8-\u098F \u0986\u09AA\u09A1\u09C7\u099F \u0995\u09B0\u09C1\u09A8\u0964";
  }
  if (msg.includes("429") || msg.includes("exhausted") || msg.includes("quota") || msg.includes("limit") || msg.includes("rate limit")) {
    return "\u09A6\u09C1\u0983\u0996\u09BF\u09A4! \u0986\u099C\u0995\u09C7\u09B0 \u099C\u09A8\u09CD\u09AF \u0986\u09AA\u09A8\u09BE\u09B0 \u099C\u09C7\u09AE\u09BF\u09A8\u09BF \u09AB\u09CD\u09B0\u09C0 \u0995\u09CB\u099F\u09BE (Free Quota Limit) \u09AC\u09BE \u09B0\u09C7\u099F \u09B2\u09BF\u09AE\u09BF\u099F \u09B6\u09C7\u09B7 \u09B9\u09DF\u09C7 \u0997\u09C7\u099B\u09C7\u0964 \u09B8\u09BE\u09A7\u09BE\u09B0\u09A3\u09A4 \u09AA\u09CD\u09B0\u09A4\u09BF \u09AE\u09BF\u09A8\u09BF\u099F\u09C7 \u09E7\u09EB\u099F\u09BF \u098F\u09AC\u0982 \u09A6\u09BF\u09A8\u09C7 \u09E7\u09EB\u09E6\u09E6\u099F\u09BF \u09B0\u09BF\u0995\u09CB\u09DF\u09C7\u09B8\u09CD\u099F\u09C7\u09B0 \u098F\u0995\u099F\u09BF \u09A8\u09BF\u09B0\u09CD\u09A6\u09BF\u09B7\u09CD\u099F \u09AB\u09CD\u09B0\u09C0 \u0995\u09CB\u099F\u09BE \u09B2\u09BF\u09AE\u09BF\u099F \u09A5\u09BE\u0995\u09C7\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0995\u09BF\u099B\u09C1\u0995\u09CD\u09B7\u09A3 \u0985\u09AA\u09C7\u0995\u09CD\u09B7\u09BE \u0995\u09B0\u09C7 \u0986\u09AC\u09BE\u09B0 \u099A\u09C7\u09B7\u09CD\u099F\u09BE \u0995\u09B0\u09C1\u09A8 \u0985\u09A5\u09AC\u09BE \u09B8\u09C7\u099F\u09BF\u0982\u09B8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2\u09C7 \u0986\u09B0\u09C7\u0995\u099F\u09BF \u09A8\u09A4\u09C1\u09A8 \u098F\u09AA\u09BF\u0986\u0987 \u0995\u09C0 (API Key) \u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8 \u0995\u09B0\u09C7 \u09AB\u09C7\u09B2\u09C1\u09A8\u0964";
  }
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("candidate") || msg.includes("harmful") || msg.includes("harassment") || msg.includes("hate")) {
    return "\u098F\u0986\u0987 \u09B8\u09C7\u09AB\u099F\u09BF \u0997\u09BE\u09B0\u09CD\u09A1 \u09AC\u09BE \u09AB\u09BF\u09B2\u09CD\u099F\u09BE\u09B0\u09BF\u0982 \u09B8\u09BF\u09B8\u09CD\u099F\u09C7\u09AE \u09A6\u09CD\u09AC\u09BE\u09B0\u09BE \u098F\u0987 \u09AA\u09CD\u09B0\u09B6\u09CD\u09A8 \u099C\u09C7\u09A8\u09BE\u09B0\u09C7\u09B6\u09A8 \u09AC\u09BE \u09AA\u09BE\u09B0\u09CD\u09B8\u09BF\u0982 \u09B0\u09BF\u0995\u09CB\u09DF\u09C7\u09B8\u09CD\u099F\u099F\u09BF \u09AC\u09CD\u09B2\u0995 \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0986\u09AA\u09A8\u09BE\u09B0 \u099F\u09AA\u09BF\u0995, \u09AC\u09BF\u09B7\u09DF \u09AC\u09BE \u099F\u09C7\u0995\u09CD\u09B8\u099F\u09C7\u09B0 \u09B6\u09AC\u09CD\u09A6\u09B8\u09AE\u09C2\u09B9 \u098F\u0995\u099F\u09C1 \u09B8\u09BE\u09A7\u09BE\u09B0\u09A3 \u0995\u09B0\u09C7 \u09B2\u09BF\u0996\u09C1\u09A8 \u09AF\u09C7\u09A8 \u0995\u09CB\u09A8\u09CB \u09B8\u09C7\u09A8\u09B8\u09BF\u30C6\u30A3\u30D6 \u0995\u09BF\u0993\u09DF\u09BE\u09B0\u09CD\u09A1 \u09A8\u09BE \u09A5\u09BE\u0995\u09C7\u0964";
  }
  if (msg.includes("503") || msg.includes("unavailable") || msg.includes("overload") || msg.includes("busy")) {
    return "\u099C\u09C7\u09AE\u09BF\u09A8\u09BF \u098F\u0986\u0987 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u098F\u0987 \u09AE\u09C1\u09B9\u09C2\u09B0\u09CD\u09A4\u09C7 \u0985\u09A4\u09BF\u09B0\u09BF\u0995\u09CD\u09A4 \u099F\u09CD\u09B0\u09BE\u09AB\u09BF\u0995\u09C7\u09B0 \u0995\u09BE\u09B0\u09A3\u09C7 \u09B2\u09CB\u09A1 \u09A8\u09BF\u09A4\u09C7 \u09AA\u09BE\u09B0\u099B\u09C7 \u09A8\u09BE\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u09E8-\u09E9 \u09AE\u09BF\u09A8\u09BF\u099F \u09AA\u09B0 \u09AA\u09C1\u09A8\u09B0\u09BE\u09DF \u09B8\u09BE\u09AC\u09AE\u09BF\u099F \u0995\u09B0\u09C1\u09A8 \u09AC\u09BE \u098F\u0986\u0987 \u09B8\u09CD\u09AA\u09BE\u09B0\u09CD\u0995\u09B8 \u09AC\u09BE\u099F\u09A8 \u0995\u09CD\u09B2\u09BF\u0995 \u0995\u09B0\u09C1\u09A8\u0964";
  }
  return `\u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u09B0\u09C7\u09B8\u09AA\u09A8\u09CD\u09B8 \u09A4\u09CD\u09B0\u09C1\u099F\u09BF: ${error.message || error}`;
}
async function getGenAIClient() {
  const keys = loadBackupKeys();
  const envKey = process.env.GEMINI_API_KEY;
  const now = /* @__PURE__ */ new Date();
  const candidates = [];
  if (envKey && envKey.trim()) {
    const cooldownEnv = envKeyCooldowns.get(envKey.trim());
    const isCooldownActive = cooldownEnv && new Date(cooldownEnv) > now;
    candidates.push({
      id: "primary_env",
      key: envKey.trim(),
      label: "\u098F\u09A8\u09AD\u09BE\u09DF\u09B0\u09A8\u09AE\u09C7\u09A8\u09CD\u099F \u0995\u09C0 (GEMINI_API_KEY)",
      source: "env",
      status: isCooldownActive ? "rate_limited" : "active",
      cooldownUntil: cooldownEnv
    });
  }
  for (const bk of keys) {
    const isCooldown = bk.cooldownUntil && new Date(bk.cooldownUntil) > now;
    const currentStatus = isCooldown ? "rate_limited" : bk.status;
    candidates.push({
      id: bk.id,
      key: bk.key,
      label: bk.label || maskKey(bk.key),
      source: "backup",
      status: currentStatus,
      cooldownUntil: bk.cooldownUntil
    });
  }
  const activeCandidates = candidates.filter((c) => c.status === "active");
  if (activeCandidates.length === 0) {
    if (candidates.length > 0) {
      const fallback = candidates[0];
      console.warn(`[API KEY WARNING] All keys are limited. Trying fallback key: ${fallback.label}`);
      return {
        ai: new import_genai.GoogleGenAI({
          apiKey: fallback.key,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } }
        }),
        keyText: fallback.key,
        keyId: fallback.id,
        source: fallback.source,
        label: fallback.label
      };
    }
    throw new Error("\u0995\u09CB\u09A5\u09BE\u0993 \u0995\u09CB\u09A8\u09CB Gemini API Key \u0995\u09A8\u09AB\u09BF\u0997\u09BE\u09B0 \u0995\u09B0\u09BE \u09A8\u09C7\u0987\u0964 \u0985\u09A8\u09C1\u0997\u09CD\u09B0\u09B9 \u0995\u09B0\u09C7 \u0985\u09CD\u09AF\u09BE\u09A1\u09AE\u09BF\u09A8 \u09AA\u09CD\u09AF\u09BE\u09A8\u09C7\u09B2 \u09A5\u09C7\u0995\u09C7 \u0985\u09A8\u09CD\u09A4\u09A4\u0983 \u098F\u0995\u099F\u09BF \u0995\u09C0 \u09AF\u09C1\u0995\u09CD\u09A4 \u0995\u09B0\u09C1\u09A8\u0964");
  }
  const selected = activeCandidates[0];
  return {
    ai: new import_genai.GoogleGenAI({
      apiKey: selected.key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    }),
    keyText: selected.key,
    keyId: selected.id,
    source: selected.source,
    label: selected.label
  };
}
function handleKeyFailure(keyId, keyValue, error) {
  const msg = String(error.message || error).toLowerCase();
  const isRateLimit = msg.includes("429") || msg.includes("exhausted") || msg.includes("quota") || msg.includes("limit") || msg.includes("rate limit");
  const isInvalid = msg.includes("api_key") || msg.includes("api key") || msg.includes("key is invalid") || msg.includes("api_key_invalid") || msg.includes("invalid key");
  if (isRateLimit || isInvalid) {
    const cooldownDurationMinutes = 15;
    const cooldownTime = new Date(Date.now() + cooldownDurationMinutes * 60 * 1e3).toISOString();
    if (keyId === "primary_env") {
      envKeyCooldowns.set(keyValue, cooldownTime);
      console.warn(`[ROTATOR] Primary Env API key is rate-limited. Cooldown until ${cooldownTime}`);
    } else {
      const keys = loadBackupKeys();
      const updated = keys.map((k) => {
        if (k.id === keyId) {
          return {
            ...k,
            status: isInvalid ? "invalid" : "rate_limited",
            cooldownUntil: isRateLimit ? cooldownTime : void 0,
            errorMessage: String(error.message || error)
          };
        }
        return k;
      });
      saveBackupKeys(updated);
      console.warn(`[ROTATOR] Backup key [${keyId}] marked as ${isInvalid ? "invalid" : "rate-limited"}. Cooldown until ${cooldownTime}`);
    }
  }
}
async function executeWithKeyRotation(operation) {
  let attempts = 0;
  const maxOperationAttempts = 5;
  let lastError = null;
  while (attempts < maxOperationAttempts) {
    let selected;
    try {
      selected = await getGenAIClient();
    } catch (err) {
      throw err;
    }
    try {
      attempts++;
      console.log(`[ROTATOR] Running Gemini operation with key: ${selected.label} (Attempt ${attempts})`);
      const result = await operation(selected.ai, selected.label);
      if (selected.keyId !== "primary_env") {
        const keys = loadBackupKeys();
        const updated = keys.map((k) => {
          if (k.id === selected.keyId) {
            return {
              ...k,
              lastUsed: (/* @__PURE__ */ new Date()).toISOString(),
              status: "active",
              errorMessage: void 0
            };
          }
          return k;
        });
        saveBackupKeys(updated);
      }
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[ROTATOR] Key [${selected.label}] failed:`, err.message || err);
      handleKeyFailure(selected.keyId, selected.keyText, err);
    }
  }
  throw lastError || new Error("\u09B8\u09AC\u0997\u09C1\u09B2\u09CB Gemini API Key \u09AB\u09C7\u0987\u09B2 \u0995\u09B0\u09C7\u099B\u09C7 \u09AC\u09BE \u09A4\u09BE\u09A6\u09C7\u09B0 \u09B2\u09BF\u09AE\u09BF\u099F \u0985\u09A4\u09BF\u0995\u09CD\u09B0\u09AE \u0995\u09B0\u09C7\u099B\u09C7\u0964");
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.get("/api/gemini-keys", (req, res) => {
    try {
      const keys = loadBackupKeys();
      const envKey = process.env.GEMINI_API_KEY;
      const hasEnvKey = !!(envKey && envKey.trim());
      const masked = keys.map((k) => ({
        id: k.id,
        label: k.label,
        key: k.key,
        keyMasked: maskKey(k.key),
        status: k.status,
        lastUsed: k.lastUsed,
        cooldownUntil: k.cooldownUntil,
        errorMessage: k.errorMessage
      }));
      res.json({
        keys: masked,
        hasEnvKey,
        envKey: envKey ? envKey : null,
        envKeyMasked: hasEnvKey ? maskKey(envKey) : null,
        envKeyCooldown: hasEnvKey ? envKeyCooldowns.get(envKey.trim()) : null
      });
    } catch (err) {
      res.status(500).json({ error: err.message || "Failed to load keys" });
    }
  });
  app.post("/api/gemini-keys", async (req, res) => {
    const { key, label, force } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: "\u098F\u09AA\u09BF\u0986\u0987 \u0995\u09C0 (API Key) \u0986\u09AC\u09B6\u09CD\u09AF\u0995\u0964" });
    }
    const trimmedKey = key.trim();
    const cleanLabel = (label || "").trim() || `Backup Key (${maskKey(trimmedKey)})`;
    let validationPassed = true;
    let initialStatus = "active";
    let validationErrorMsg = "";
    try {
      const testAi = new import_genai.GoogleGenAI({
        apiKey: trimmedKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      const testResp = await testAi.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Respond only with the word 'OK'. This is a validation check.",
        config: { maxOutputTokens: 10 }
      });
      if (!testResp || !testResp.text) {
        throw new Error("\u0997\u09C1\u0997\u09B2 \u09B0\u09C7\u09B8\u09AA\u09A8\u09CD\u09B8 \u09AB\u09BE\u0981\u0995\u09BE \u098F\u09B8\u09C7\u099B\u09C7\u0964");
      }
    } catch (testErr) {
      validationPassed = false;
      const errMsg = String(testErr.message || testErr).toLowerCase();
      validationErrorMsg = testErr.message || String(testErr);
      console.warn("API key self-test failed:", validationErrorMsg);
      const isRateLimit = errMsg.includes("429") || errMsg.includes("exhausted") || errMsg.includes("quota") || errMsg.includes("limit") || errMsg.includes("rate limit");
      const isInvalid = errMsg.includes("api_key") || errMsg.includes("api key") || errMsg.includes("key is invalid") || errMsg.includes("api_key_invalid") || errMsg.includes("invalid key");
      if (isRateLimit) {
        initialStatus = "rate_limited";
      } else if (isInvalid) {
        initialStatus = "invalid";
        if (!force) {
          return res.status(400).json({
            error: `\u098F\u0987 API Key-\u099F\u09BF \u09B8\u099A\u09B2 \u09A8\u09DF\u0964 \u0997\u09C1\u0997\u09B2 \u09B8\u09BE\u09B0\u09CD\u09AD\u09BE\u09B0 \u09B0\u09C7\u09B8\u09AA\u09A8\u09CD\u09B8: ${validationErrorMsg || "Unknown error"}. \u0986\u09AA\u09A8\u09BF \u0995\u09BF \u098F\u0987 \u0995\u09C0-\u099F\u09BF \u09A4\u09BE\u0993 \u099C\u09CB\u09B0\u09AA\u09C2\u09B0\u09CD\u09AC\u0995 \u09B8\u09C7\u09AD \u0995\u09B0\u09A4\u09C7 \u099A\u09BE\u09A8?`,
            canForce: true
          });
        }
      } else {
        initialStatus = "active";
      }
    }
    try {
      const keys = loadBackupKeys();
      const exists = keys.some((k) => k.key === trimmedKey);
      if (exists) {
        return res.status(400).json({ error: "\u098F\u0987 API Key-\u099F\u09BF \u0987\u09A4\u09BF\u09AE\u09A7\u09CD\u09AF\u09C7\u0987 \u09A1\u09BE\u099F\u09BE\u09AC\u09C7\u099C\u09C7 \u09AF\u09C1\u0995\u09CD\u09A4 \u0986\u099B\u09C7\u0964" });
      }
      const newKey = {
        id: "key-" + Date.now(),
        key: trimmedKey,
        label: cleanLabel,
        status: initialStatus,
        errorMessage: validationPassed ? void 0 : validationErrorMsg,
        cooldownUntil: initialStatus === "rate_limited" ? new Date(Date.now() + 15 * 60 * 1e3).toISOString() : void 0
      };
      keys.push(newKey);
      saveBackupKeys(keys);
      res.json({
        success: true,
        validationPassed,
        warning: validationPassed ? void 0 : `\u0986\u09AA\u09A8\u09BE\u09B0 \u098F\u09AA\u09BF\u0986\u0987 \u0995\u09C0-\u099F\u09BF \u09B8\u09C7\u09AD \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7, \u0995\u09BF\u09A8\u09CD\u09A4\u09C1 \u099F\u09C7\u09B8\u09CD\u099F \u09AD\u09CD\u09AF\u09BE\u09B2\u09BF\u09A1\u09C7\u09B6\u09A8 \u09AA\u09BE\u09B8 \u09B9\u09DF\u09A8\u09BF\u0964 \u09B8\u09CD\u099F\u09CD\u09AF\u09BE\u099F\u09BE\u09B8: ${initialStatus === "rate_limited" ? "RATE LIMITED (\u0995\u09CB\u099F\u09BE \u09B6\u09C7\u09B7)" : "INVALID (\u0985\u099A\u09B2)"}\u0964`,
        key: { id: newKey.id, label: newKey.label, status: newKey.status }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.delete("/api/gemini-keys/:id", (req, res) => {
    try {
      const { id } = req.params;
      const keys = loadBackupKeys();
      const filtered = keys.filter((k) => k.id !== id);
      saveBackupKeys(filtered);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/gemini-keys/reset", (req, res) => {
    try {
      const keys = loadBackupKeys();
      const resetKeys = keys.map((k) => ({
        ...k,
        status: "active",
        cooldownUntil: void 0,
        errorMessage: void 0
      }));
      saveBackupKeys(resetKeys);
      envKeyCooldowns.clear();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  app.post("/api/gemini/generate-questions", async (req, res) => {
    const { topic, count } = req.body;
    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }
    const questionCount = Math.max(1, Math.min(20, parseInt(count) || 5));
    try {
      const questionsResult = await executeWithKeyRotation(async (ai, keyLabel) => {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Generate exactly ${questionCount} multiple choice questions (MCQs) in Bengali language on the topic: "${topic}". Make sure the questions are high-quality, professional, appropriate for competitive examinations like BCS, Primary, or Bank exams. Each question must have 4 distinct options, a correct answer index (1 to 4), and a detailed explanation in Bengali clarifying why that answer is correct. Follow the requested JSON schema structure precisely.`,
          config: {
            systemInstruction: "You are an expert Bengali educationalist who drafts high-quality MCQ exam papers for BCS (Bangladesh Civil Service) and other government exams. Ensure correctness in language, spellings, options, and explanations. Do not include any HTML wrappers or text markdown outside of the JSON array.",
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.ARRAY,
              description: "A list of generated MCQ questions",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  question: {
                    type: import_genai.Type.STRING,
                    description: "The text of the MCQ question in Bengali."
                  },
                  option1: {
                    type: import_genai.Type.STRING,
                    description: "The first answer choice."
                  },
                  option2: {
                    type: import_genai.Type.STRING,
                    description: "The second answer choice."
                  },
                  option3: {
                    type: import_genai.Type.STRING,
                    description: "The third answer choice."
                  },
                  option4: {
                    type: import_genai.Type.STRING,
                    description: "The fourth answer choice."
                  },
                  correctAnswer: {
                    type: import_genai.Type.INTEGER,
                    description: "The 1-based index (1, 2, 3, or 4) of the correct answer option."
                  },
                  explanation: {
                    type: import_genai.Type.STRING,
                    description: "A comprehensive Bengali explanation of the correct choice."
                  }
                },
                required: [
                  "question",
                  "option1",
                  "option2",
                  "option3",
                  "option4",
                  "correctAnswer",
                  "explanation"
                ]
              }
            }
          }
        });
        const text = response?.text;
        if (!text) {
          throw new Error("No text returned from Gemini after processing");
        }
        return text;
      });
      let cleanText = questionsResult.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(json)?/i, "");
        cleanText = cleanText.replace(/```$/, "");
        cleanText = cleanText.trim();
      }
      const firstBracket = cleanText.indexOf("[");
      const lastBracket = cleanText.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
      const questions = JSON.parse(cleanText);
      res.json({ success: true, questions });
    } catch (error) {
      console.error("Gemini Generation Error:", error);
      res.status(500).json({
        error: translateGeminiError(error)
      });
    }
  });
  app.post("/api/gemini/parse-pasted-question", async (req, res) => {
    const { rawText } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "\u09AA\u09BE\u09B8\u09CD\u099F \u0995\u09B0\u09BE \u099F\u09C7\u0995\u09CD\u09B8\u099F \u0996\u09BE\u09B2\u09BF \u09B9\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7 \u09A8\u09BE\u0964" });
    }
    try {
      const questionsResult = await executeWithKeyRotation(async (ai, keyLabel) => {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Translate and parse the following raw, arbitrary, unfiltered pasted Bengali text into a standardized JSON list of MCQ questions. The pasted text may contain one or many questions, 4 answer options (labeled with \u0995/\u0996/\u0997/\u0998, a/b/c/d, 1/2/3/4 or others), the correct answer, and an optional explanation. 

Input raw text to parse:
"""
${rawText}
"""

Please follow these parsing rules:
1. Identify the question statement.
2. Identify 4 distinct options. If less than 4 options are provided, come up with logical choices to make it exactly 4 options.
3. Determine the correct answer option index (1-based: 1, 2, 3, or 4). Carefully map Bengali labels '\u0995' or 'A' to 1, '\u0996' or 'B' to 2, '\u0997' or 'C' to 3, '\u0998' or 'D' to 4.
4. Extract the explanation/justification. If there's no explanation or the explanation is missing/unclear in the input text, auto-generate a comprehensive Bengali explanation explaining why the correct choice is correct.
5. Keep the language in Bengali.`,
          config: {
            systemInstruction: "You are an expert Bengali educationalist who parses raw textbook and exam copy-pastes into clean structured database formats. You always return a valid JSON array and nothing else. Ensure there are no markdown wrappers. Do not include any text outside the JSON output.",
            temperature: 0.1,
            // Low temperature for highly precise structured parsing
            responseMimeType: "application/json",
            responseSchema: {
              type: import_genai.Type.ARRAY,
              description: "A list of parsed MCQ questions",
              items: {
                type: import_genai.Type.OBJECT,
                properties: {
                  question: {
                    type: import_genai.Type.STRING,
                    description: "The main text/statement of the question in Bengali."
                  },
                  option1: {
                    type: import_genai.Type.STRING,
                    description: "The first answer option."
                  },
                  option2: {
                    type: import_genai.Type.STRING,
                    description: "The second answer option."
                  },
                  option3: {
                    type: import_genai.Type.STRING,
                    description: "The third answer option."
                  },
                  option4: {
                    type: import_genai.Type.STRING,
                    description: "The fourth answer option."
                  },
                  correctAnswer: {
                    type: import_genai.Type.INTEGER,
                    description: "The 1-based index (1, 2, 3, or 4) of the correct option."
                  },
                  explanation: {
                    type: import_genai.Type.STRING,
                    description: "Bengali explanation of the correct answer."
                  }
                },
                required: [
                  "question",
                  "option1",
                  "option2",
                  "option3",
                  "option4",
                  "correctAnswer",
                  "explanation"
                ]
              }
            }
          }
        });
        const text = response?.text;
        if (!text) {
          throw new Error("Gemini returned an empty response.");
        }
        return text;
      });
      let cleanText = questionsResult.trim();
      if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(json)?/i, "");
        cleanText = cleanText.replace(/```$/, "");
        cleanText = cleanText.trim();
      }
      const firstBracket = cleanText.indexOf("[");
      const lastBracket = cleanText.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }
      const parsedQuestions = JSON.parse(cleanText);
      res.json({ success: true, questions: parsedQuestions });
    } catch (error) {
      console.error("Gemini Converter Error:", error);
      res.status(500).json({
        error: translateGeminiError(error)
      });
    }
  });
  app.post("/api/gemini/chat", async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "\u09AA\u09CD\u09B0\u09B6\u09CD\u09A8 \u0996\u09BE\u09B2\u09BF \u09B9\u09A4\u09C7 \u09AA\u09BE\u09B0\u09AC\u09C7 \u09A8\u09BE\u0964" });
    }
    try {
      const chatResult = await executeWithKeyRotation(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: "You are an expert Educational tutor named MCQ HERO ASSISTANT. Help the users clear their doubts on various competitive exams in Bangladesh. Answer in clear, friendly, and structured Bengali using beautiful markdown. Keep your tone highly polite and supportive.",
            temperature: 0.7
          }
        });
        return response?.text || "\u09A6\u09C1\u0983\u0996\u09BF\u09A4, \u0995\u09CB\u09A8\u09CB \u0989\u09A4\u09CD\u09A4\u09B0 \u09AA\u09BE\u0993\u09DF\u09BE \u09AF\u09BE\u09DF\u09A8\u09BF\u0964";
      });
      res.json({ success: true, answer: chatResult });
    } catch (error) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({
        error: translateGeminiError(error)
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
