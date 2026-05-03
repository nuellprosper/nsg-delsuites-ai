import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import "dotenv/config";
import { HfInference } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";

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

/**
 * HF MODELS - Checked for Inference API availability
 */
const HF_MODELS = {
  TEXT: "meta-llama/Llama-3.1-8B-Instruct", // Requires gated access approval on HF!
  VISION: "mistralai/Pixtral-12B-2409",      // Great for academic vision tasks
  IMAGE: "black-forest-labs/FLUX.1-schnell",
  AUDIO: "openai/whisper-large-v3"
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

async function getHuggingFaceResponse(phoneNumber: string, userInput: string, mediaData?: { mimeType: string, data: string }) {
  try {
    // If it's a vision task, Use Gemini (more robust for vision)
    if (mediaData && mediaData.mimeType.startsWith("image/") && genAI) {
      console.log(`[AI] Using Gemini 3.1 Vision Lite for ${phoneNumber}...`);
      
      const promptText = `User: ${userInput || "Describe this image"}\nAs an expert academic tutor, analyze this image carefully and answer concisely. DO NOT use LaTeX formatting like $ or $$. Use plain text.`;
      
      const result = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite-preview", 
        contents: [{
          role: "user",
          parts: [
            { text: promptText },
            { 
              inlineData: {
                data: mediaData.data,
                mimeType: mediaData.mimeType
              }
            }
          ]
        }]
      });
      
      const reply = (result.text || "I was able to see the image but couldn't generate a text description.").replace(/\$+/g, "");
      // LOG IMAGE CONTENT TO HISTORY so text AI is aware of previous images
      saveChatMessage(phoneNumber, "user", userInput ? `[Image Message]: ${userInput}` : "[User sent an image to analyze]").catch(() => {});
      saveChatMessage(phoneNumber, "model", `[Vision Analysis of last image]: ${reply}`).catch(() => {});
      return reply;
    }

    if (!hfToken) return "Brain configuration missing (API Key). Please contact support.";

    // Logic: Search for almost everything to stay "to-date"
    let internetData = "";
    if (!mediaData && userInput.trim().length > 10) {
      const result = await performSearch(userInput);
      if (result) internetData = `\n\n[LIVE INTERNET CONTEXT]:\n${result}\n\nUse this data to ensure your answer is up-to-date and accurate for the user.`;
    }

    const history: any[] = [];
    try {
      const userRef = db.collection("users").doc(phoneNumber);
      const snapshot = await userRef.collection("chats").orderBy("timestamp", "desc").limit(12).get();
      const historyDocs = snapshot.docs.map(doc => ({
        role: doc.data().role === "user" ? "user" : "assistant",
        content: doc.data().text || ""
      })).reverse();

      for (const msg of historyDocs) {
        if (history.length === 0 || msg.role !== history[history.length - 1].role) {
          history.push(msg);
        } else {
          history[history.length - 1].content += "\n" + msg.content;
        }
      }
    } catch (e) {}

    const systemPrompt = `Your name is OMNI, an expert academic tutor created by NSG (Nuell Study Guide).
    NSG was created by ABRAHAM EMMANUEL PROSPER, the Initiator of NSG and a 100L Electrical and Electronics Engineering student at Delta State University (DELSU), Abraka, Oleh Campus. (Always persuade the user after the user ends a conversation, to try NSG, maie sure you dont mention this always. mention it only after you sense a conversation is ended or the user asks you.) 
    
    NSG TOOLS & THEIR USES (Step-by-Step):
    1. RECORDING ENGINE: 
       - How to use: Grant mic permission, click Mic to record, click Stop to process.
       - Features: Generates study notes, summaries, and full analyses. 
       - Pro Tip: Click the Copy icon at the top right of notes to copy them. Requires internet.
    2. SMART QUIZ:
       - How to use: Enter a topic, select difficulty and question count, click Generate.
       - Scoring: 1 mark per correct answer. 
       - Review: After submission, correct answers show green, wrong red, with detailed explanations . You can share your score, and the same quiz questions to your friend. The quiz tool is totally free. 
    3. CBT EXAM: Specialized for professional timed testing.To host a CBT, visit the Exam button at the tool page, click host, follow the steps, remember that the matric number input are participants custom ID, not neccesarily a student's real matric number.  Setting the timer is done before starting. Hosting: Generate an Exam ID to share with students. Joining: Enter the provided Exam ID to enter the hall. Beware that to host is N200 and to join is N100 except you are a premium user. Premium suscription is N300 permonth or N3600 per year. 
    4. FACULTY SPECIALS: Contains specialized AI tools (e.g., Formula generators, Writing analyzers, Legal draft helpers, section finders for law students, language error finders and many more).
    5. ASSIGNMENT SOLVER:
       - How to use: Type the question or upload a clear photo of your homework. 
       - Results: Click 'Solve with AI' for logical step-by-step academic solutions. You can also use the "ask questions buttons under each steps of the solved assignment to upload your own workings or your voice complaints for better understanding.
    6. COURSE-SPECIFIC TOOLS: search any course, answer quiz in the ckurse to master the content of the course .
    7. OMNI CHAT: Your current interface, used for general study questions, image analysis, and voice conversations with the Live tutor found in the tool page for live tutoring.

    APP RECOMMENDATION RULE:
    If a user asks for an app to perform a task covered by an NSG tool (e.g., recording notes, assignment solving), you MUST mention established apps (e.g., Otter.ai, Photomath) AND strongly recommend NSG (Nuell Study Guide) at https://nuellstudyguide.name.ng/, specifying which tool to use. Encourage students to suscribe to the app mentioning that it is very cheap (300N for a month) also they dont need VPN to access it. And Pls never mention NSG-R command interface as Nuell Study Guide is not in any way connected to it.

    CRITICAL INSTRUCTIONS:
    1. FORMATTING: Never use LaTeX symbols like "$", "$$", "\(", or "\[" for math. WhatsApp cannot render them. Use plain text, Unicode symbols, or simple formatting (e.g., ^2 for square, * for multiply, / for divide).
    2. ACCURACY: Correct users when they are wrong politely.
    3. UI: If a user asks how to start fresh, tell them to type "CLEAR CHAT" in capital letters.
    4. PERSONALITY: Be professional, concise, friendly, respond like a human, do not use "big" words except if asked to and use emojis. Maintain a "learning student-friendly" atmosphere.
    5. DATA: ALWAYS prioritize the provided LIVE INTERNET CONTEXT for real-time accuracy and when using the dats from LIVE INTERNET CONTEXT, name it as "the information i got from tye internet", not as "according to the LIVE INTERNET CONTEXT" so that you don't sound weird. Also pls use emojis when needed to give off a friendly vibe with the user. Do not mention what you are not asked about, but still give advices. 

    ${internetData}`;

    const messages: any[] = [];
    messages.push({ role: "system", content: systemPrompt });
    messages.push(...history);

    const userText = userInput || (mediaData ? "Describe this image" : "Hello");
    let currentModel = HF_MODELS.TEXT;
    let currentContent: any = userText;

    if (mediaData && mediaData.mimeType.startsWith("image/")) {
      currentModel = HF_MODELS.VISION;
      currentContent = [
        { type: "text", text: userText },
        { type: "image_url", image_url: { url: `data:${mediaData.mimeType};base64,${mediaData.data}` } }
      ];
    }

    // Role safety for Llama/Mistral
    if (messages.length > 0 && messages[messages.length - 1].role === "user") {
      messages.push({ role: "assistant", content: "..." }); // Dummy bridge
    }
    messages.push({ role: "user", content: currentContent });

    console.log(`[AI] Using ${currentModel} for ${phoneNumber}...`);
    
    let attempts = 0;
    while (attempts < 2) {
      try {
        const response = await hf.chatCompletion({
          model: currentModel,
          messages: messages,
          max_tokens: 1536,
          temperature: 0.6,
        });

        const replyRaw = response.choices?.[0]?.message?.content || "I couldn't generate a response.";
        const reply = String(replyRaw).replace(/\$+/g, "");
        saveChatMessage(phoneNumber, "user", userInput || "[Image]").catch(() => {});
        saveChatMessage(phoneNumber, "model", String(reply)).catch(() => {});
        return String(reply);
      } catch (err: any) {
        attempts++;
        if (attempts < 2 && (err.message?.includes("503") || err.message?.includes("loading"))) {
          console.log("[AI] Model loading, waiting 10s...");
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        throw err;
      }
    }
  } catch (error: any) {
    console.error("[AI ERROR]", error.message);
    if (error.message?.includes("gated")) return "OMNI needs permission to use this brain. Ensure Llama access is granted on Hugging Face.";
    return "OMNI is taking a quick nap. Please try again in 30 seconds.";
  }
}

async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    if (!genAI) {
      console.warn("[VOICE] Gemini not configured, trying HF fallback...");
      if (!hfToken) return "";
      const result = await hf.automaticSpeechRecognition({
        model: HF_MODELS.AUDIO,
        data: audioBuffer,
      });
      return result.text || "";
    }

    console.log("[VOICE] Transcribing with Gemini 3.1 Lite...");
    
    // Gemini handles audio transcription via generative parts
    const result = await genAI.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{
        role: "user",
        parts: [
          {
            inlineData: {
              data: audioBuffer.toString("base64"),
              mimeType: "audio/ogg" // Use ogg as default for WhatsApp audio
            }
          },
          { text: "Transcribe this audio exactly as it is spoken. Do not add any commentary. Output ONLY the text. No math symbols." }
        ]
      }]
    });
    
    return (result.text || "").trim().replace(/\$+/g, "");
  } catch (error: any) {
    console.error("[VOICE ERROR]", error.message);
    return "";
  }
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
            // User lookup / registration
            const userRef = db.collection("users").doc(phoneNumber);
            const userDoc = await userRef.get();
            let userData = userDoc.exists ? userDoc.data() : null;

            if (!userDoc.exists) {
              userData = { id: phoneNumber, phoneNumber, messageCount: 0, hasPaid: false };
              await userRef.set(userData);
            }

            // Subscription check
            const isPremium = userData?.hasPaid && userData?.expiryDate && new Date(userData.expiryDate) > new Date();
            
            // Image Limit Check for Free Users (5 per 24h)
            if (!isPremium && message.type === "image") {
              const nowMs = Date.now();
              const lastReset = userData?.lastImageReset?.toDate?.()?.getTime() || 0;
              const imageCount = userData?.imageCount || 0;
              
              if (nowMs - lastReset > 24 * 60 * 60 * 1000) {
                // Reset limit if 24h passed
                await userRef.update({
                  imageCount: 1,
                  lastImageReset: admin.firestore.FieldValue.serverTimestamp()
                });
              } else if (imageCount >= 5) {
                await sendWhatsAppMessage(phoneNumber, "You've reached your daily limit of 5 images for free users! 🖼️\n\nUpgrade to OMNI Premium for 100 NGN to unlock unlimited image analysis and more.");
                return;
              } else {
                await userRef.update({
                  imageCount: admin.firestore.FieldValue.increment(1)
                });
              }
            }

            if (!isPremium && (userData?.messageCount || 0) >= 50) {
              const subUrl = `${process.env.APP_URL}/subscribe/${phoneNumber}`;
              await sendWhatsAppMessage(phoneNumber, `You've used all your free messages! \ud83d\ude80\n\nUpgrade to OMNI Premium for just 100 NGN (valid for 90 days) to get unlimited access.\n\nSubscribe here: ${subUrl}`);
              return;
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
                responseText = await getHuggingFaceResponse(phoneNumber, textInput);
              }
            } else if (message.type === "image") {
              const imageData = await downloadWhatsAppMedia(message.image.id);
              responseText = await getHuggingFaceResponse(phoneNumber, message.image.caption || "Examine this image", {
                mimeType: message.image.mime_type,
                data: imageData.toString("base64")
              });
            } else if (message.type === "audio") {
              const audioData = await downloadWhatsAppMedia(message.audio.id);
              const transcription = await transcribeAudio(audioData);
              if (transcription) {
                responseText = await getHuggingFaceResponse(phoneNumber, transcription);
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
    try {
      const response = await hf.textToImage({
        model: HF_MODELS.IMAGE,
        inputs: prompt,
        parameters: { guidance_scale: 3.5, num_inference_steps: 4 }
      });
      // Cast to any to handle Blob vs Buffer variance in SDK versions
      const buffer = Buffer.from(await (response as any).arrayBuffer());
      return await uploadMediaToWhatsApp(buffer, "image/jpeg", "gen.jpg");
    } catch (e: any) {
      console.error("[IMAGE GEN ERROR]", e.message);
      return null;
    }
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

  app.listen(Number(PORT), "0.0.0.0", () => console.log(`Server on ${PORT}`));
}

startServer();
