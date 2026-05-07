import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import "dotenv/config";
import { HfInference } from "@huggingface/inference";
import { GoogleGenAI } from "@google/genai";
import Groq from "groq-sdk";
import nodemailer from "nodemailer";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
let adminApp;
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
if (serviceAccount) {
  try {
    const cert = JSON.parse(serviceAccount);
    adminApp = admin.initializeApp({
      credential: admin.credential.cert(cert),
      projectId: firebaseConfig.projectId,
    });
  } catch (e) {
    adminApp = admin.initializeApp({ projectId: firebaseConfig.projectId });
  }
} else {
  adminApp = admin.initializeApp({ projectId: firebaseConfig.projectId });
}
const db = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId || undefined);

// Initialize AI SDKs
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;

const HF_MODELS = {
  TEXT: "meta-llama/Llama-3.1-8B-Instruct", 
  VISION: "mistralai/Pixtral-12B-2409",
  IMAGE: "black-forest-labs/FLUX.1-schnell",
  AUDIO: "openai/whisper-large-v3-turbo" 
};

const GROQ_MODELS = {
  VERSATILE: "llama-3.3-70b-versatile"
};

// Rate limiting
const userLocks = new Map<string, number>();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- Email Setup ---
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
    },
  });

  // --- Webhook Verification ---
  app.get("/api/whatsapp", (req, res) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === verifyToken) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  // --- WhatsApp Webhook ---
  app.post("/api/whatsapp", async (req, res) => {
    res.sendStatus(200);
    const body = req.body;
    if (body.object === "whatsapp_business_account") {
      const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return;

      const phoneNumber = message.from;
      const now = Date.now();
      if (userLocks.has(phoneNumber) && (now - userLocks.get(phoneNumber)!) < 500) return;
      userLocks.set(phoneNumber, now);

      (async () => {
        try {
          let responseText = "";
          if (message.type === "text") {
            responseText = await getOmniResponse(message.text.body, phoneNumber);
          } else if (message.type === "audio") {
            const audioData = await downloadWhatsAppMedia(message.audio.id);
            const transcription = await transcribeAudio(audioData);
            if (transcription) responseText = await getOmniResponse(transcription, phoneNumber);
          } else if (message.type === "image") {
             const imageData = await downloadWhatsAppMedia(message.image.id);
             responseText = await getOmniResponse(message.image.caption || "Analyze this", phoneNumber, {
               mimeType: message.image.mime_type,
               data: imageData.toString("base64")
             });
          }

          if (responseText) await sendWhatsAppMessage(phoneNumber, responseText);
        } catch (e) { console.error("WhatsApp Error", e); }
      })();
    }
  });

  // --- Core AI Function with Fallback ---
  async function getOmniResponse(userInput: string, phoneNumber: string, mediaData?: any) {
    let responseText = "";
    const history: any[] = [];
    try {
      const chatSnap = await db.collection("users").doc(phoneNumber).collection("chats").orderBy("timestamp", "desc").limit(6).get();
      history.push(...chatSnap.docs.map(d => ({ role: d.data().role === "user" ? "user" : "assistant", content: d.data().text })).reverse());
    } catch (e) {}

    const systemPrompt = "You are OMNI, an expert academic tutor by NSG.";

    try {
      if (genAI) {
        let contents;
        if (mediaData) {
          contents = [{ role: "user" as const, parts: [{ text: userInput }, { inlineData: mediaData }] }];
        } else {
          contents = [
            { role: "user" as const, parts: [{ text: systemPrompt }] },
            ...history.map(h => ({ role: (h.role === "assistant" ? "model" : "user") as "model" | "user", parts: [{ text: h.content }] })),
            { role: "user" as const, parts: [{ text: userInput }] }
          ];
        }

        const result = await genAI.models.generateContent({
           model: "gemini-3.1-flash-lite-preview",
           contents: contents
        });
        responseText = result.text || "";
        if (!responseText) throw new Error("Empty gemini response");
      } else {
        throw new Error("Gemini not configured");
      }
    } catch (err) {
      console.warn("Primary Gemini failed, trying HF Llama fallback...");
      try {
        const response = await hf.chatCompletion({
          model: HF_MODELS.TEXT,
          messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userInput }],
          max_tokens: 1024,
        });
        responseText = response.choices[0].message.content || "";
        if (!responseText) throw new Error("Empty HF response");
      } catch (hfErr) {
        if (groq) {
          try {
            const completion = await groq.chat.completions.create({
              model: GROQ_MODELS.VERSATILE,
              messages: [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: userInput }],
            });
            responseText = completion.choices[0].message.content || "";
          } catch (groqErr) {
            responseText = "OMNI is having a major brain fog. Please try again soon!";
          }
        }
      }
    }
    
    if (responseText) {
      await db.collection("users").doc(phoneNumber).collection("chats").add({
        role: "assistant", text: responseText, timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      await db.collection("users").doc(phoneNumber).collection("chats").add({
        role: "user", text: userInput, timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return responseText;
  }

  // --- Audio Logic ---
  async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const tryHF = async () => {
      try {
        const res = await hf.automaticSpeechRecognition({ model: HF_MODELS.AUDIO, data: audioBuffer });
        return res.text || null;
      } catch (e: any) {
        console.warn("[VOICE] HF Transcription failed:", e.message);
        return null;
      }
    };

    const tryGroq = async () => {
      if (!groq) return null;
      const res = await groq.audio.transcriptions.create({
        file: Object.assign(new Blob([audioBuffer]), { name: "audio.ogg" }) as any,
        model: "distil-whisper-large-v3-en",
      });
      return res.text || null;
    };

    const tryGemini = async () => {
      if (!genAI) return null;
      const res = await genAI.models.generateContent({
        model: "gemini-3.1-flash-lite-preview",
        contents: [{ role: "user", parts: [{ inlineData: { data: audioBuffer.toString("base64"), mimeType: "audio/ogg" } }, { text: "Transcribe this audio." }] }]
      });
      return res.text || null;
    };

    try {
      const transcript = await tryHF().catch(() => tryGroq()).catch(() => tryGemini()) || "";
      if (transcript && genAI) {
        const cleanup = await genAI.models.generateContent({
          model: "gemini-3.1-flash-lite-preview",
          contents: [{ role: "user", parts: [{ text: `Clean up this transcript: ${transcript}` }] }]
        });
        return cleanup.text || transcript;
      }
      return transcript;
    } catch (err) {
      return "";
    }
  }

  // --- External API Helpers ---
  async function sendWhatsAppMessage(to: string, text: string) {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_TOKEN;
    if (!phoneId || !token) return;
    try {
      await axios.post(`https://graph.facebook.com/v25.0/${phoneId}/messages`, {
        messaging_product: "whatsapp", to: to.replace(/\D/g, ''), type: "text", text: { body: text },
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (e) {}
  }

  async function downloadWhatsAppMedia(mediaId: string): Promise<Buffer> {
    const r = await axios.get(`https://graph.facebook.com/v25.0/${mediaId}`, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } });
    const mediaR = await axios.get(r.data.url, { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` }, responseType: "arraybuffer" });
    return Buffer.from(mediaR.data);
  }

  // Paystack verification endpoint
  app.post("/api/verify-payment", async (req, res) => {
    const { reference, uid, plan } = req.body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) return res.status(500).json({ error: "Paystack secret key not configured" });
    try {
      const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: { Authorization: `Bearer ${secretKey}` }
      });
      if (response.data.data.status === "success") {
        const duration = plan === 'monthly' ? 30 : 365;
        const newUntil = new Date();
        newUntil.setDate(newUntil.getDate() + duration);
        await db.collection('users').doc(uid).update({ 
          premiumUntil: admin.firestore.Timestamp.fromDate(newUntil) 
        });
        res.json({ status: "success", premiumUntil: newUntil.toISOString() });
      } else { res.json({ status: "failed" }); }
    } catch (error) { res.status(500).json({ error: "Verification failed" }); }
  });

  // User Lookup by Matric (for CBT login)
  app.get("/api/lookup-user", async (req, res) => {
    const { matric } = req.query;
    if (!matric) return res.status(400).json({ error: "Matric required" });
    try {
      const q = await db.collection("users").where("matric", "==", matric).limit(1).get();
      if (q.empty) {
        // Try matricNumber too
        const qAlt = await db.collection("users").where("matricNumber", "==", matric).limit(1).get();
        if (qAlt.empty) return res.status(404).json({ error: "User not found" });
        return res.json({ email: qAlt.docs[0].data().email });
      }
      res.json({ email: q.docs[0].data().email });
    } catch (e) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`NSG Omni Server running on http://localhost:${PORT}`);
  });
}

startServer();
