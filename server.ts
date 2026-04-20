import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

import { getFirestore } from "firebase-admin/firestore";

dotenv.config();

// Initialize Firebase Admin
const adminApp = admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

const adminDb = getFirestore(firebaseConfig.firestoreDatabaseId || "(default)");

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Paystack verification endpoint
  app.post("/api/verify-payment", async (req, res) => {
    const { reference, uid, plan } = req.body;
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    if (!secretKey) {
      return res.status(500).json({ error: "Paystack secret key not configured" });
    }

    if (!uid) {
      return res.status(400).json({ error: "User UID required" });
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      if (response.data.data.status === "success") {
        // Securely update Firestore from the backend
        const duration = plan === 'monthly' ? 30 : 365;
        const newUntil = new Date();
        newUntil.setDate(newUntil.getDate() + duration);

        await adminDb.collection('users').doc(uid).update({
          premiumUntil: admin.firestore.Timestamp.fromDate(newUntil),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ status: "success", data: response.data.data, premiumUntil: newUntil.toISOString() });
      } else {
        res.json({ status: "failed", data: response.data.data });
      }
    } catch (error: any) {
      console.error("Paystack Verification Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Verification failed" });
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
