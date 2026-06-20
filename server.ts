import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import "dotenv/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Server-side Gemini AI Question Generation
  app.post("/api/gemini/generate-questions", async (req, res) => {
    const { topic, count } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    const questionCount = Math.max(1, Math.min(20, parseInt(count) || 5));

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured in the developer secrets panel.",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      let response;
      let attempts = 0;
      const maxAttempts = 2;
      let lastError: any = null;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `Generate exactly ${questionCount} multiple choice questions (MCQs) in Bengali language on the topic: "${topic}". Make sure the questions are high-quality, professional, appropriate for competitive examinations like BCS, Primary, or Bank exams. Each question must have 4 distinct options, a correct answer index (1 to 4), and a detailed explanation in Bengali clarifying why that answer is correct. Follow the requested JSON schema structure precisely.`,
            config: {
              systemInstruction:
                "You are an expert Bengali educationalist who drafts high-quality MCQ exam papers for BCS (Bangladesh Civil Service) and other government exams. Ensure correctness in language, spellings, options, and explanations. Do not include any HTML wrappers or text markdown outside of the JSON array.",
              temperature: attempts === 1 ? 0.7 : 0.2, // Lower temperature on retry for strict schema adherence
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
          
          if (response?.text) {
            break; // Succeeded!
          }
        } catch (err: any) {
          lastError = err;
          console.warn(`Attempt ${attempts} failed:`, err.message || err);
          if (attempts >= maxAttempts) {
            throw err;
          }
        }
      }

      const text = response?.text;
      if (!text) {
        throw new Error("No text returned from Gemini after processing");
      }

      // Robust JSON extraction & sanitization
      let cleanText = text.trim();
      
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
        error: error.message || "Failed to generate questions. Please try again.",
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
