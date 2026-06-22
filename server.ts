import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

interface BackupKey {
  id: string;
  key: string;
  label: string;
  status: "active" | "rate_limited" | "invalid";
  lastUsed?: string;
  cooldownUntil?: string;
  errorMessage?: string;
}

const KEYS_FILE = path.join(process.cwd(), "g_keys.json");
const envKeyCooldowns = new Map<string, string>(); // key -> cooldown until timestamp (ISO)

function loadBackupKeys(): BackupKey[] {
  try {
    if (fs.existsSync(KEYS_FILE)) {
      const data = fs.readFileSync(KEYS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading backup keys file:", err);
  }
  return [];
}

function saveBackupKeys(keys: BackupKey[]) {
  try {
    fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing backup keys file:", err);
  }
}

function maskKey(key: string): string {
  if (!key) return "";
  const trimmed = key.trim();
  if (trimmed.length <= 10) return "****";
  return trimmed.substring(0, 6) + "..." + trimmed.substring(trimmed.length - 4);
}

function translateGeminiError(error: any): string {
  const msg = String(error.message || error).toLowerCase();
  
  if (msg.includes("api_key") || msg.includes("api key") || msg.includes("key is invalid") || msg.includes("api_key_invalid") || msg.includes("invalid key")) {
    return "Gemini API Key-টি বৈধ নয় অথবা এটি সঠিকভাবে সেটিংস প্যানেলে কনফিগার করা হয়নি। অনুগ্রহ করে আপনার Google AI Studio থেকে নতুন রি-জেনারেট করা এবং সচল API Key অ্যাপ সেটিংস-এ আপডেট করুন।";
  }
  
  if (msg.includes("429") || msg.includes("exhausted") || msg.includes("quota") || msg.includes("limit") || msg.includes("rate limit")) {
    return "দুঃখিত! আজকের জন্য আপনার জেমিনি ফ্রী কোটা (Free Quota Limit) বা রেট লিমিট শেষ হয়ে গেছে। সাধারণত প্রতি মিনিটে ১৫টি এবং দিনে ১৫০০টি রিকোয়েস্টের একটি নির্দিষ্ট ফ্রী কোটা লিমিট থাকে। অনুগ্রহ করে কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন অথবা সেটিংস প্যানেলে আরেকটি নতুন এপিআই কী (API Key) পরিবর্তন করে ফেলুন।";
  }
  
  if (msg.includes("safety") || msg.includes("blocked") || msg.includes("candidate") || msg.includes("harmful") || msg.includes("harassment") || msg.includes("hate")) {
    return "এআই সেফটি গার্ড বা ফিল্টারিং সিস্টেম দ্বারা এই প্রশ্ন জেনারেশন বা পার্সিং রিকোয়েস্টটি ব্লক করা হয়েছে। অনুগ্রহ করে আপনার টপিক, বিষয় বা টেক্সটের শব্দসমূহ একটু সাধারণ করে লিখুন যেন কোনো সেনসিティブ কিওয়ার্ড না থাকে।";
  }

  if (msg.includes("503") || msg.includes("unavailable") || msg.includes("overload") || msg.includes("busy")) {
    return "জেমিনি এআই সার্ভার এই মুহূর্তে অতিরিক্ত ট্রাফিকের কারণে লোড নিতে পারছে না। অনুগ্রহ করে ২-৩ মিনিট পর পুনরায় সাবমিট করুন বা এআই স্পার্কস বাটন ক্লিক করুন।";
  }

  return `সার্ভার রেসপন্স ত্রুটি: ${error.message || error}`;
}

async function getGenAIClient(): Promise<{ ai: GoogleGenAI; keyText: string; keyId: string; source: string; label: string }> {
  const keys = loadBackupKeys();
  const envKey = process.env.GEMINI_API_KEY;
  const now = new Date();
  
  const candidates: { id: string; key: string; label: string; source: string; status: "active" | "rate_limited" | "invalid"; cooldownUntil?: string }[] = [];
  
  if (envKey && envKey.trim()) {
    const cooldownEnv = envKeyCooldowns.get(envKey.trim());
    const isCooldownActive = cooldownEnv && new Date(cooldownEnv) > now;
    candidates.push({
      id: "primary_env",
      key: envKey.trim(),
      label: "এনভায়রনমেন্ট কী (GEMINI_API_KEY)",
      source: "env",
      status: isCooldownActive ? "rate_limited" : "active",
      cooldownUntil: cooldownEnv
    });
  }
  
  for (const bk of keys) {
    const isCooldown = bk.cooldownUntil && new Date(bk.cooldownUntil) > now;
    const currentStatus = isCooldown ? ("rate_limited" as const) : bk.status;
    candidates.push({
      id: bk.id,
      key: bk.key,
      label: bk.label || maskKey(bk.key),
      source: "backup",
      status: currentStatus,
      cooldownUntil: bk.cooldownUntil
    });
  }
  
  const activeCandidates = candidates.filter(c => c.status === "active");
  
  if (activeCandidates.length === 0) {
    if (candidates.length > 0) {
      const fallback = candidates[0];
      console.warn(`[API KEY WARNING] All keys are limited. Trying fallback key: ${fallback.label}`);
      return {
        ai: new GoogleGenAI({
          apiKey: fallback.key,
          httpOptions: { headers: { "User-Agent": "aistudio-build" } }
        }),
        keyText: fallback.key,
        keyId: fallback.id,
        source: fallback.source,
        label: fallback.label
      };
    }
    throw new Error("কোথাও কোনো Gemini API Key কনফিগার করা নেই। অনুগ্রহ করে অ্যাডমিন প্যানেল থেকে অন্ততঃ একটি কী যুক্ত করুন।");
  }
  
  const selected = activeCandidates[0];
  return {
    ai: new GoogleGenAI({
      apiKey: selected.key,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    }),
    keyText: selected.key,
    keyId: selected.id,
    source: selected.source,
    label: selected.label
  };
}

function handleKeyFailure(keyId: string, keyValue: string, error: any) {
  const msg = String(error.message || error).toLowerCase();
  const isRateLimit = msg.includes("429") || msg.includes("exhausted") || msg.includes("quota") || msg.includes("limit") || msg.includes("rate limit");
  const isInvalid = msg.includes("api_key") || msg.includes("api key") || msg.includes("key is invalid") || msg.includes("api_key_invalid") || msg.includes("invalid key");
  
  if (isRateLimit || isInvalid) {
    const cooldownDurationMinutes = 15;
    const cooldownTime = new Date(Date.now() + cooldownDurationMinutes * 60 * 1000).toISOString();
    
    if (keyId === "primary_env") {
      envKeyCooldowns.set(keyValue, cooldownTime);
      console.warn(`[ROTATOR] Primary Env API key is rate-limited. Cooldown until ${cooldownTime}`);
    } else {
      const keys = loadBackupKeys();
      const updated = keys.map(k => {
        if (k.id === keyId) {
          return {
            ...k,
            status: isInvalid ? ("invalid" as const) : ("rate_limited" as const),
            cooldownUntil: isRateLimit ? cooldownTime : undefined,
            errorMessage: String(error.message || error)
          };
        }
        return k;
      });
      saveBackupKeys(updated);
      console.warn(`[ROTATOR] Backup key [${keyId}] marked as ${isInvalid ? 'invalid' : 'rate-limited'}. Cooldown until ${cooldownTime}`);
    }
  }
}

async function executeWithKeyRotation<T>(
  operation: (ai: GoogleGenAI, keyLabel: string) => Promise<T>
): Promise<T> {
  let attempts = 0;
  const maxOperationAttempts = 5;
  let lastError: any = null;
  
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
        const updated = keys.map(k => {
          if (k.id === selected.keyId) {
            return {
              ...k,
              lastUsed: new Date().toISOString(),
              status: "active" as const,
              errorMessage: undefined
            };
          }
          return k;
        });
        saveBackupKeys(updated);
      }
      return result;
    } catch (err: any) {
      lastError = err;
      console.error(`[ROTATOR] Key [${selected.label}] failed:`, err.message || err);
      handleKeyFailure(selected.keyId, selected.keyText, err);
    }
  }
  
  throw lastError || new Error("সবগুলো Gemini API Key ফেইল করেছে বা তাদের লিমিট অতিক্রম করেছে।");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Custom CORS middleware to allow cross-origin requests from mobile/standalone apps
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

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API endpoints to manage backup keys
  app.get("/api/gemini-keys", (req, res) => {
    try {
      const keys = loadBackupKeys();
      const envKey = process.env.GEMINI_API_KEY;
      const hasEnvKey = !!(envKey && envKey.trim());

      const masked = keys.map(k => ({
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to load keys" });
    }
  });

  app.post("/api/gemini-keys", async (req, res) => {
    const { key, label, force } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: "এপিআই কী (API Key) আবশ্যক।" });
    }

    const trimmedKey = key.trim();
    const cleanLabel = (label || "").trim() || `Backup Key (${maskKey(trimmedKey)})`;

    let validationPassed = true;
    let initialStatus: "active" | "rate_limited" | "invalid" = "active";
    let validationErrorMsg = "";

    // Test the key before saving it to guarantee validity!
    try {
      const testAi = new GoogleGenAI({
        apiKey: trimmedKey,
        httpOptions: { headers: { "User-Agent": "aistudio-build" } }
      });
      // Quick fast test checking if key can run a basic prompt
      const testResp = await testAi.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Respond only with the word 'OK'. This is a validation check.",
        config: { maxOutputTokens: 10 }
      });
      
      if (!testResp || !testResp.text) {
        throw new Error("গুগল রেসপন্স ফাঁকা এসেছে।");
      }
    } catch (testErr: any) {
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
            error: `এই API Key-টি সচল নয়। গুগল সার্ভার রেসপন্স: ${validationErrorMsg || "Unknown error"}. আপনি কি এই কী-টি তাও জোরপূর্বক সেভ করতে চান?`,
            canForce: true
          });
        }
      } else {
        // Other error (e.g. timeout or network issue), keep as active but record error
        initialStatus = "active";
      }
    }

    try {
      const keys = loadBackupKeys();
      const exists = keys.some(k => k.key === trimmedKey);
      if (exists) {
        return res.status(400).json({ error: "এই API Key-টি ইতিমধ্যেই ডাটাবেজে যুক্ত আছে।" });
      }

      const newKey: BackupKey = {
        id: "key-" + Date.now(),
        key: trimmedKey,
        label: cleanLabel,
        status: initialStatus,
        errorMessage: validationPassed ? undefined : validationErrorMsg,
        cooldownUntil: initialStatus === "rate_limited" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : undefined
      };

      keys.push(newKey);
      saveBackupKeys(keys);
      res.json({
        success: true,
        validationPassed,
        warning: validationPassed ? undefined : `আপনার এপিআই কী-টি সেভ করা হয়েছে, কিন্তু টেস্ট ভ্যালিডেশন পাস হয়নি। স্ট্যাটাস: ${initialStatus === "rate_limited" ? "RATE LIMITED (কোটা শেষ)" : "INVALID (অচল)"}।`,
        key: { id: newKey.id, label: newKey.label, status: newKey.status }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/gemini-keys/:id", (req, res) => {
    try {
      const { id } = req.params;
      const keys = loadBackupKeys();
      const filtered = keys.filter(k => k.id !== id);
      saveBackupKeys(filtered);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/gemini-keys/reset", (req, res) => {
    try {
      const keys = loadBackupKeys();
      const resetKeys = keys.map(k => ({
        ...k,
        status: "active" as const,
        cooldownUntil: undefined,
        errorMessage: undefined
      }));
      saveBackupKeys(resetKeys);
      envKeyCooldowns.clear();
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Server-side Gemini AI Question Generation with automated Rotation
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
            systemInstruction:
              "You are an expert Bengali educationalist who drafts high-quality MCQ exam papers for BCS (Bangladesh Civil Service) and other government exams. Ensure correctness in language, spellings, options, and explanations. Do not include any HTML wrappers or text markdown outside of the JSON array.",
            temperature: 0.7,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "A list of generated MCQ questions",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: {
                    type: Type.STRING,
                    description: "The text of the MCQ question in Bengali.",
                  },
                  option1: {
                    type: Type.STRING,
                    description: "The first answer choice.",
                  },
                  option2: {
                    type: Type.STRING,
                    description: "The second answer choice.",
                  },
                  option3: {
                    type: Type.STRING,
                    description: "The third answer choice.",
                  },
                  option4: {
                    type: Type.STRING,
                    description: "The fourth answer choice.",
                  },
                  correctAnswer: {
                    type: Type.INTEGER,
                    description: "The 1-based index (1, 2, 3, or 4) of the correct answer option.",
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "A comprehensive Bengali explanation of the correct choice.",
                  },
                },
                required: [
                  "question",
                  "option1",
                  "option2",
                  "option3",
                  "option4",
                  "correctAnswer",
                  "explanation",
                ],
              },
            },
          },
        });

        const text = response?.text;
        if (!text) {
          throw new Error("No text returned from Gemini after processing");
        }
        return text;
      });

      // Robust JSON extraction & sanitization
      let cleanText = questionsResult.trim();
      
      // If the model wrapped the JSON in markdown code blocks, strip them
      if (cleanText.startsWith("```")) {
        // Remove leading markdown
        cleanText = cleanText.replace(/^```(json)?/i, "");
        // Remove trailing markdown
        cleanText = cleanText.replace(/```$/, "");
        cleanText = cleanText.trim();
      }

      // If there are any stray leading/trailing comments or text, find first [ and last ]
      const firstBracket = cleanText.indexOf("[");
      const lastBracket = cleanText.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1) {
        cleanText = cleanText.substring(firstBracket, lastBracket + 1);
      }

      const questions = JSON.parse(cleanText);
      res.json({ success: true, questions });
    } catch (error: any) {
      console.error("Gemini Generation Error:", error);
      res.status(500).json({
        error: translateGeminiError(error),
      });
    }
  });

  // Server-side Gemini AI Paste-to-MCQ Parser with automated Rotation
  app.post("/api/gemini/parse-pasted-question", async (req, res) => {
    const { rawText } = req.body;

    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: "পাস্ট করা টেক্সট খালি হতে পারবে না।" });
    }

    try {
      const questionsResult = await executeWithKeyRotation(async (ai, keyLabel) => {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Translate and parse the following raw, arbitrary, unfiltered pasted Bengali text into a standardized JSON list of MCQ questions. The pasted text may contain one or many questions, 4 answer options (labeled with ক/খ/গ/ঘ, a/b/c/d, 1/2/3/4 or others), the correct answer, and an optional explanation. 

Input raw text to parse:
"""
${rawText}
"""

Please follow these parsing rules:
1. Identify the question statement.
2. Identify 4 distinct options. If less than 4 options are provided, come up with logical choices to make it exactly 4 options.
3. Determine the correct answer option index (1-based: 1, 2, 3, or 4). Carefully map Bengali labels 'ক' or 'A' to 1, 'খ' or 'B' to 2, 'গ' or 'C' to 3, 'ঘ' or 'D' to 4.
4. Extract the explanation/justification. If there's no explanation or the explanation is missing/unclear in the input text, auto-generate a comprehensive Bengali explanation explaining why the correct choice is correct.
5. Keep the language in Bengali.`,
          config: {
            systemInstruction:
              "You are an expert Bengali educationalist who parses raw textbook and exam copy-pastes into clean structured database formats. You always return a valid JSON array and nothing else. Ensure there are no markdown wrappers. Do not include any text outside the JSON output.",
            temperature: 0.1, // Low temperature for highly precise structured parsing
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              description: "A list of parsed MCQ questions",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: {
                    type: Type.STRING,
                    description: "The main text/statement of the question in Bengali.",
                  },
                  option1: {
                    type: Type.STRING,
                    description: "The first answer option.",
                  },
                  option2: {
                    type: Type.STRING,
                    description: "The second answer option.",
                  },
                  option3: {
                    type: Type.STRING,
                    description: "The third answer option.",
                  },
                  option4: {
                    type: Type.STRING,
                    description: "The fourth answer option.",
                  },
                  correctAnswer: {
                    type: Type.INTEGER,
                    description: "The 1-based index (1, 2, 3, or 4) of the correct option.",
                  },
                  explanation: {
                    type: Type.STRING,
                    description: "Bengali explanation of the correct answer.",
                  },
                },
                required: [
                  "question",
                  "option1",
                  "option2",
                  "option3",
                  "option4",
                  "correctAnswer",
                  "explanation",
                ],
              },
            },
          },
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
    } catch (error: any) {
      console.error("Gemini Converter Error:", error);
      res.status(500).json({
        error: translateGeminiError(error),
      });
    }
  });

  // Server-side Gemini AI Chat Assistant for tutoring and fast queries
  app.post("/api/gemini/chat", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: "প্রশ্ন খালি হতে পারবে না।" });
    }

    try {
      const chatResult = await executeWithKeyRotation(async (ai) => {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction:
              "You are an expert Educational tutor named MCQ HERO ASSISTANT. Help the users clear their doubts on various competitive exams in Bangladesh. Answer in clear, friendly, and structured Bengali using beautiful markdown. Keep your tone highly polite and supportive.",
            temperature: 0.7,
          },
        });
        return response?.text || "দুঃখিত, কোনো উত্তর পাওয়া যায়নি।";
      });

      res.json({ success: true, answer: chatResult });
    } catch (error: any) {
      console.error("Gemini Chat Error:", error);
      res.status(500).json({
        error: translateGeminiError(error),
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
