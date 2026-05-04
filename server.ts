import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import "dotenv/config";
import { HfInference } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Per-user processing lock to prevent simultaneous requests and enforce 0.5s delay
const userLocks = new Map<string, number>();

// Initialize Hugging Face
// Strictly using the server-side environment variable as requested
const hfToken = process.env.HUGGINGFACE_API_KEY;
if (!hfToken) {
  console.warn("⚠️ HUGGINGFACE_API_KEY is missing from environment variables.");
}
const hf = new HfInference(hfToken);

// Initialize Gemini
const geminiKey = process.env.GEMINI_API_KEY;
const genAI = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
if (!genAI) {
  console.warn("⚠️ GEMINI_API_KEY is missing. Vision and Audio transcription will not work.");
}

// Initialize Groq
const groqKey = process.env.GROQ_API_KEY;
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null;
if (!groq) {
  console.warn("⚠️ GROQ_API_KEY is missing. Backup logic will be disabled.");
}

// Initialize Firebase Admin
try {
  if (!admin.apps.length) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (serviceAccount) {
      try {
        const cert = JSON.parse(serviceAccount);
        admin.initializeApp({
          credential: admin.credential.cert(cert),
          projectId: projectId || cert.project_id
        });
        console.log(`✅ Firebase initialized with Service Account JSON.`);
      } catch (parseError) {
        console.error("❌ Firebase parse error:", parseError);
        admin.initializeApp({ projectId });
      }
    } else if (projectId) {
      admin.initializeApp({ projectId });
    }
  }
} catch (initError: any) {
  console.error("❌ Firebase Error:", initError.message);
}

const db = admin.firestore();

// Logging user counts
const logUserCounts = async () => {
  try {
    const usersSnapshot = await db.collection("users").get();
    const totalUsers = usersSnapshot.size;
    
    // Define active as someone who messaged in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsersSnapshot = await db.collection("users")
      .where("lastActive", ">=", oneDayAgo)
      .get();
    const activeUsers = activeUsersSnapshot.size;

    console.log(`[OMNI] Total Users: ${totalUsers} | Active Today: ${activeUsers}`);
  } catch (err) {
    console.error("[OMNI] Error logging user counts:", err);
  }
};

/**
 * HF MODELS - Checked for Inference API availability
 */
const HF_MODELS = {
  TEXT: "meta-llama/Llama-3.1-8B-Instruct", 
  VISION: "mistralai/Pixtral-12B-2409",
  IMAGE: "black-forest-labs/FLUX.1-schnell",
  AUDIO: "openai/whisper-large-v3-turbo" 
};

const GROQ_MODELS = {
  VERSATILE: "llama-3.3-70b-versatile",
  AUDIO: "distil-whisper-large-v3-en"
};

const OPENROUTER_MODELS = {
  TEXT: "meta-llama/llama-3.3-70b-instruct:free",
  IMAGE: "black-forest-labs/flux-1-schnell:free",
  AUDIO: "openai/whisper-large-v3-turbo",
  MULTIMODAL: "google/lyria-3-clip-preview:free"
};

/**
 * Perform an internet search using Tavily API
 */
async function performSearch(query: string) {
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (!tavilyKey || query.length < 5) return null;

  try {
    console.log(`[SEARCH] Querying Tavily for: ${query}`);
    const response = await axios.post("https://api.tavily.com/search", {
      api_key: tavilyKey,
      query: query,
      search_depth: "basic",
      include_answer: true,
      max_results: 3
    });
    return response.data.answer || response.data.results?.[0]?.content || null;
  } catch (error: any) {
    console.error("[Search Error]", error.message);
    return null;
  }
}

async function sendWhatsAppAction(to: string, action: "typing_on") {
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_TOKEN;
  const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;
  try {
    await axios.post(url, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/\D/g, ''),
      sender_action: action
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (e) {}
}

async function getOmniResponseWithSequentialBackups(phoneNumber: string, userInput: string, mediaData?: { mimeType: string, data: string }) {
  const timeoutMs = 5000; // Reduced to 5s per model to fit in WhatsApp's 20s window
  
  // Preparation logic
  const history: any[] = [];
  try {
    const snapshot = await db.collection("users").doc(phoneNumber).collection("chats").orderBy("timestamp", "desc").limit(10).get();
    history.push(...snapshot.docs.map(doc => ({
      role: doc.data().role === "user" ? "user" : "assistant",
      content: doc.data().text || ""
    })).reverse());
  } catch (e) {}

  const userText = userInput || (mediaData ? "Analyze this image" : "Hello");

  // Search context
  let internetData = "";
  if (!mediaData && userText.trim().length > 10) {
    try {
      const result = await performSearch(userText);
      if (result) internetData = `\n\n[LIVE INTERNET CONTEXT]:\n${result}\n\nUse this data for accuracy.`;
    } catch (e) {}
  }

  const systemPrompt = `Your name is OMNI, an expert academic tutor created by NSG (Nuell Study Guide).
  NSG was created by ABRAHAM EMMANUEL PROSPER, a 100L Electrical and Electronics Engineering student at Delta State University (DELSU), Oleh Campus.
  
  NSG TOOLS:
  1. RECORDING ENGINE: Amplifies audio and cancels noise for classroom clarity.
  2. SMART QUIZ: Topic -> Difficulty -> Review Explanations.
  3. CBT EXAM: Host/Join sessions with custom Matric numbers.
  4. FACULTY SPECIALS: Med, Law, Engineering, Business Auditor, Language Diagnostics.
  5. ASSIGNMENT SOLVER: Photo/Text input -> Logic steps.
 
  INSTRUCTIONS:
  - DO NOT use LaTeX symbols $ or $$. Use plain text.
  - Be professional, concise, and friendly.
  - Suggest NSG (https://nuellstudyguide.name.ng/) for academic tasks.

  ${internetData}`;

  const runWithTimeout = async (label: string, task: () => Promise<string | null>) => {
    return new Promise<string | null>(async (resolve) => {
      const timer = setTimeout(() => {
        console.warn(`[AI] ${label} timed out after ${timeoutMs}ms`);
        resolve(null);
      }, timeoutMs);

      try {
        const result = await task();
        clearTimeout(timer);
        if (result) resolve(result.replace(/\$+/g, ""));
        else resolve(null);
      } catch (err: any) {
        clearTimeout(timer);
        console.error(`[AI] ${label} error:`, err.message);
        resolve(null);
      }
    });
  };

  // Send "typing..." action to WhatsApp to buy time (Meta supports this)
  sendWhatsAppAction(phoneNumber, "typing_on").catch(() => {});

  // --- Main AI: HF ---
  const askHF = async () => {
    try {
      console.log(`[AI] Main: HF for ${phoneNumber}...`);
      const isVision = mediaData && mediaData.mimeType.startsWith("image/");
      const model = isVision ? HF_MODELS.VISION : HF_MODELS.TEXT;
      const content = isVision ? [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.data}` } }
      ] : userText;

      const res = await hf.chatCompletion({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: content as any }],
        max_tokens: 1024,
        temperature: 0.6
      });
      return res.choices[0]?.message?.content || null;
    } catch (e: any) {
      console.warn("[AI] HF Chat failed:", e.message);
      return null;
    }
  };

  // --- Backup 1: Gemini ---
  const askGemini = async () => {
    if (!genAI) return null;
    try {
      console.log(`[AI] Backup 1: Gemini for ${phoneNumber}...`);
      const isVision = mediaData && mediaData.mimeType.startsWith("image/");
      let contents = [];
      if (isVision) {
        contents = [{ role: "user", parts: [{ text: userText }, { inlineData: { data: mediaData.data, mimeType: mediaData.mimeType } }] }];
      } else {
        contents = [
          { role: "user", parts: [{ text: systemPrompt }] },
          ...history.map(h => ({ role: h.role === "assistant" ? "model" : "user", parts: [{ text: h.content }] })),
          { role: "user", parts: [{ text: userText }] }
        ];
      }
      const res = await genAI.models.generateContent({ model: "gemini-3.1-flash-lite-preview", contents });
      return res.text || null;
    } catch (e) { return null; }
  };

  // --- Backup 2: Groq ---
  const askGroq = async () => {
    if (!groq) return null;
    try {
      console.log(`[AI] Backup 2: Groq for ${phoneNumber}...`);
      const res = await groq.chat.completions.create({
        model: GROQ_MODELS.VERSATILE,
        messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userText }],
        max_tokens: 1024
      });
      return res.choices[0]?.message?.content || null;
    } catch (e) { return null; }
  };

  // --- Backup 3: OpenRouter ---
  const askOpenRouter = async () => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return null;
    try {
      console.log(`[AI] Backup 3: OpenRouter for ${phoneNumber}...`);
      const h: any[] = history.map(m => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content
      }));
      const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
        model: OPENROUTER_MODELS.TEXT,
        messages: [{ role: "system", content: systemPrompt }, ...h, { role: "user", content: userText }],
      }, {
        headers: { "Authorization": `Bearer ${key}` }
      });
      return res.data.choices[0]?.message?.content || null;
    } catch (e: any) {
      console.warn("[AI] OpenRouter failed:", e.message);
      return null;
    }
  };

  const response = await runWithTimeout("Main HF", askHF) 
                || await runWithTimeout("Backup 1 Gemini", askGemini) 
                || await runWithTimeout("Backup 2 Groq", askGroq)
                || await runWithTimeout("Backup 3 OpenRouter", askOpenRouter);

  if (response) {
    saveChatMessage(phoneNumber, "user", userInput || (mediaData ? "[Image]" : "[Message]")).catch(() => {});
    saveChatMessage(phoneNumber, "model", response).catch(() => {});
    return response;
  }

  return "OMNI is having major brain fog. Please try again soon!";
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const timeoutMs = 5000;

  const tryHF = async () => {
    try {
      console.log("[VOICE] Main: HF Transcription...");
      const res = await hf.automaticSpeechRecognition({ model: HF_MODELS.AUDIO, data: audioBuffer });
      return res.text;
    } catch (e: any) {
      console.warn("[VOICE] HF Transcription failed:", e.message);
      return null;
    }
  };

  const tryGroq = async () => {
    if (!groq) return null;
    try {
      console.log("[VOICE] Backup: Groq Transcription...");
      const res = await groq.audio.transcriptions.create({
        file: Object.assign(new Blob([audioBuffer]), { name: "audio.ogg" }) as any,
        model: GROQ_MODELS.AUDIO,
      });
      return res.text;
    } catch (e) { return null; }
  };

  const tryGemini = async () => {
    if (!genAI) return null;
    try {
      console.log("[VOICE] Backup: Gemini Transcription...");
      const res = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ role: "user", parts: [{ inlineData: { data: audioBuffer.toString("base64"), mimeType: "audio/ogg" } }, { text: "Transcribe exactly." }] }]
      });
      return res.text || null;
    } catch (e) { return null; }
  };

  const tryOpenRouter = async () => {
    const key = process.env.OPENROUTER_API_KEY;
    if (!key) return null;
    try {
      console.log("[VOICE] Backup: OpenRouter Transcription...");
      const formData = new FormData();
      formData.append("file", new Blob([audioBuffer]), "audio.ogg");
      formData.append("model", OPENROUTER_MODELS.AUDIO);
      const res = await axios.post("https://openrouter.ai/api/v1/audio/transcriptions", formData, {
        headers: { "Authorization": `Bearer ${key}` }
      });
      return res.data.text || null;
    } catch (e: any) {
      console.warn("[VOICE] OpenRouter Transcription failed:", e.message);
      return null;
    }
  };

  const runWithTimeout = async (label: string, fn: () => Promise<string | null>) => {
    return new Promise<string | null>(async (resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      try {
        const res = await fn();
        clearTimeout(timer);
        resolve(res);
      } catch (e) {
        clearTimeout(timer);
        resolve(null);
      }
    });
  };

  const transcript = await runWithTimeout("HF Voice", tryHF) 
               || await runWithTimeout("Groq Voice", tryGroq) 
               || await runWithTimeout("Gemini Voice", tryGemini) 
               || await runWithTimeout("OpenRouter Voice", tryOpenRouter)
               || "";
  return transcript;
}

async function saveChatMessage(phoneNumber: string, role: "user" | "model", text: string) {
  try {
    await db.collection("users").doc(phoneNumber).collection("chats").add({
      role,
      text,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {}
}

// --- SERVER SETUP ---

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Webhook Verification (GET)
  app.get("/api/whatsapp", (req, res) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook Verified \u2705");
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // Receiving messages (POST)
  app.post("/api/whatsapp", async (req, res) => {
    res.status(200).send("EVENT_RECEIVED");

    try {
      const body = req.body;
      if (body.object === "whatsapp_business_account") {
        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const value = changes?.value;
        const message = value?.messages?.[0];

        if (!message) return;

        const phoneNumber = message.from;
        
        // Rate limiting
        const now = Date.now();
        if (userLocks.has(phoneNumber) && (now - userLocks.get(phoneNumber)!) < 500) {
          return;
        }
        userLocks.set(phoneNumber, now);

            // Process in background
        (async () => {
          let responseText = "";
          
          try {
            const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            
            // User lookup / registration
            const userRef = db.collection("users").doc(phoneNumber);
            const userDoc = await userRef.get();
            let userData = userDoc.exists ? userDoc.data() : null;

            if (!userDoc.exists) {
              userData = { id: phoneNumber, phoneNumber, messageCount: 0, hasPaid: false, createdAt: admin.firestore.FieldValue.serverTimestamp() };
              await userRef.set(userData);
            }

            // Subscription check
            const isPremium = userData?.hasPaid && userData?.expiryDate && new Date(userData.expiryDate) > new Date();

            // Omni Universal Limits (All users)
            const usageRef = userRef.collection("omniUsage").doc(today);
            const usageDoc = await usageRef.get();
            const usageData = usageDoc.exists ? usageDoc.data() : { voiceNotes: 0, images: 0 };

            if (!usageDoc.exists) {
              await usageRef.set(usageData);
            }

            // Limit: Voice Notes (Max 3/day)
            if (message.type === "audio") {
              if (usageData.voiceNotes >= 3) {
                await sendWhatsAppMessage(phoneNumber, "Sorry, you have reached your daily limit of 3 voice notes on Omni. Please use text for now! \ud83d\udeab\ud83c\udf99\ufe0f");
                return;
              }
              await usageRef.update({ voiceNotes: admin.firestore.FieldValue.increment(1) });
            }

            // Limit: Images (Total 3/day)
            if (message.type === "image" || (message.type === "text" && message.text.body.toLowerCase().includes("generate") && (message.text.body.toLowerCase().includes("image") || message.text.body.toLowerCase().includes("picture")))) {
              if (usageData.images >= 3) {
                await sendWhatsAppMessage(phoneNumber, "Sorry, you have reached your daily limit of 3 image interactions (sending/generating) on Omni. \ud83d\udeab\ud83d\uddbc\ufe0f");
                return;
              }
              await usageRef.update({ images: admin.firestore.FieldValue.increment(1) });
            }

            // Standard Message Processing
            if (message.type === "text") {
              const textInput = message.text.body;
              const lowerText = textInput.toLowerCase();

              if (lowerText === "clear chat") {
                const chats = await userRef.collection("chats").get();
                const batch = db.batch();
                chats.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                responseText = "History cleared! How can I help you now?";
              } else if (lowerText === "pay" || lowerText === "subscribe") {
                responseText = `Subscribe to OMNI Premium for 90 days of unlimited access! \ud83c\udf1f\n\nLink: ${process.env.APP_URL}/subscribe/${phoneNumber}`;
              } else if (lowerText.includes("generate") && (lowerText.includes("image") || lowerText.includes("picture"))) {
                const imageUrl = await generateImageHF(textInput);
                if (imageUrl && !imageUrl.startsWith("#")) {
                  await sendWhatsAppImage(phoneNumber, imageUrl, "Here is your generated image!");
                  return;
                }
                responseText = "I'm sorry, I couldn't generate that image at the moment.";
              } else {
                responseText = await getOmniResponseWithSequentialBackups(phoneNumber, textInput);
              }
            } else if (message.type === "image") {
              const imageData = await downloadWhatsAppMedia(message.image.id);
              responseText = await getOmniResponseWithSequentialBackups(phoneNumber, message.image.caption || "Examine this image", {
                mimeType: message.image.mime_type,
                data: imageData.toString("base64")
              });
            } else if (message.type === "audio") {
              const audioData = await downloadWhatsAppMedia(message.audio.id);
              const transcription = await transcribeAudio(audioData);
              if (transcription) {
                responseText = await getOmniResponseWithSequentialBackups(phoneNumber, transcription);
              } else {
                responseText = "I couldn't hear that clearly.";
              }
            }

            if (responseText) {
              await sendWhatsAppMessage(phoneNumber, responseText);
              await userRef.update({ 
                 messageCount: admin.firestore.FieldValue.increment(1),
                 lastActive: admin.firestore.FieldValue.serverTimestamp()
              });
            }

          } catch (e: any) {
            console.error("[BG PROCESS ERROR]", e.message);
          }
        })();
      }
    } catch (error: any) {
      console.error("[WEBHOOK ERROR]", error.message);
    }
  });

  // --- HELPERS ---

  async function sendWhatsAppMessage(to: string, text: string) {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;
    
    try {
      await axios.post(url, {
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ''),
        type: "text",
        text: { body: text },
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error: any) {
      console.error("[META SEND ERROR]", error.response?.data || error.message);
    }
  }

  async function generateImageHF(prompt: string): Promise<string | null> {
    const tryHF = async () => {
      try {
        const response = await hf.textToImage({
          model: HF_MODELS.IMAGE,
          inputs: prompt,
          parameters: { guidance_scale: 3.5, num_inference_steps: 4 }
        });
        const buffer = Buffer.from(await (response as any).arrayBuffer());
        return await uploadMediaToWhatsApp(buffer, "image/jpeg", "gen.jpg");
      } catch (e: any) {
        console.error("[IMAGE GEN HF ERROR]", e.message);
        return null;
      }
    };

    const tryOpenRouter = async () => {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return null;
      try {
        const res = await axios.post("https://openrouter.ai/api/v1/chat/completions", {
          model: OPENROUTER_MODELS.IMAGE,
          messages: [{ role: "user", content: prompt }],
        }, {
          headers: { "Authorization": `Bearer ${key}` }
        });
        // Some OpenRouter image models return a markdown image or a URL in content
        const content = res.data.choices[0]?.message?.content || "";
        const urlMatch = content.match(/https?:\/\/[^\s\)]+/);
        if (urlMatch) {
          const imgUrl = urlMatch[0];
          const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer' });
          return await uploadMediaToWhatsApp(Buffer.from(imgRes.data), "image/jpeg", "gen.jpg");
        }
        return null;
      } catch (e: any) {
        console.error("[IMAGE GEN OR ERROR]", e.message);
        return null;
      }
    };

    return await tryHF() || await tryOpenRouter();
  }

  async function uploadMediaToWhatsApp(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    const url = `https://graph.facebook.com/v25.0/${phoneId}/media`;

    const formData = new (await import('form-data')).default();
    formData.append("file", buffer, { filename, contentType: mimeType });
    formData.append("messaging_product", "whatsapp");

    try {
      const r = await axios.post(url, formData, {
        headers: { ...formData.getHeaders(), Authorization: `Bearer ${token}` }
      });
      return r.data.id;
    } catch (e: any) {
      console.error("[META UPLOAD ERROR]", e.response?.data || e.message);
      return null;
    }
  }

  async function sendWhatsAppImage(to: string, mediaId: string, caption?: string) {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    const url = `https://graph.facebook.com/v25.0/${phoneId}/messages`;
    
    try {
      await axios.post(url, {
        messaging_product: "whatsapp",
        to: to.replace(/\D/g, ''),
        type: "image",
        image: { id: mediaId, caption }
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e: any) {
      console.error("[META IMAGE SEND ERROR]", e.response?.data || e.message);
    }
  }

  async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
    const url = `https://graph.facebook.com/v25.0/${mediaId}`;
    const r = await axios.get(url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    const mediaUrl = r.data.url;
    const mediaR = await axios.get(mediaUrl, { 
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` },
      responseType: "arraybuffer" 
    });
    return Buffer.from(mediaR.data);
  }

  // --- FRONTEND ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const d = path.join(process.cwd(), "dist");
    app.use(express.static(d));
    app.get("*", (req, res) => res.sendFile(path.join(d, "index.html")));
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server on ${PORT}`);
    logUserCounts();
    // Periodically log counts every hour
    setInterval(logUserCounts, 60 * 60 * 1000);
  });
}

startServer();
