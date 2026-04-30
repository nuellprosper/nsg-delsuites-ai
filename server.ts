import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

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

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS?.replace(/\s/g, ''),
    },
  });

  app.post("/api/send-welcome-email", async (req, res) => {
    const { email, name } = req.body;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to NSG!',
      text: `Hi ${name},\n\nWelcome to NSG (Nuell Study Guide)! We are thrilled to have you here.\n\nYou can upgrade to Premium anytime to unlock all exclusive features. It's very affordable: 300N for a month and 3600N for a year. Subscribing helps us keep the platform running and provide you with the best tools.\n\nIf you encounter any problems, please reach out to us at nuellstudyguide@gmail.com.\n\nHappy studying!\n\nBest regards,\nABRAHAM EMMANUEL PROSPER\nFounder, NSG`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  app.post("/api/send-premium-thank-you", async (req, res) => {
    const { email, name } = req.body;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Thank You for Subscribing to NSG Premium!',
      text: `Hi ${name},\n\nThank you for subscribing to NSG Premium! Your support means a lot to us.\n\nWe encourage you to share the app with everyone you know so they can also benefit from our academic tools. Link: https://nuellstudyguide.name.ng\n\nIf you have any issues, contact us at nuellstudyguide@gmail.com.\n\nHappy studying!\n\nBest regards,\nABRAHAM EMMANUEL PROSPER\nFounder, NSG`,
    };

    try {
      await transporter.sendMail(mailOptions);
      res.json({ success: true });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // Marketing Email Logic
  const broadcastMarketingEmail = async () => {
    try {
      const templatesSnap = await adminDb.collection('email_templates').where('active', '==', true).get();
      if (templatesSnap.empty) return;

      const templates = templatesSnap.docs.map(doc => doc.data());
      const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

      const usersSnap = await adminDb.collection('users').get();
      
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const lastEmail = userData.lastMarketingEmailAt?.toDate() || new Date(0);
        const daysSinceLast = (Date.now() - lastEmail.getTime()) / (1000 * 60 * 60 * 24);

        // Send if more than 2 days since last marketing email
        if (daysSinceLast >= 2) {
          const body = selectedTemplate.body.replace(/\$\{name\}/g, userData.fullName || userData.displayName || 'there');
          
          await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: userData.email,
            subject: selectedTemplate.subject,
            text: body,
          });

          await userDoc.ref.update({
            lastMarketingEmailAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          console.log(`Sent marketing email to ${userData.email}`);
        }
      }
    } catch (error) {
      console.error("Broadcast error:", error);
    }
  };

  // Run broadcast check every 24 hours
  setInterval(broadcastMarketingEmail, 24 * 60 * 60 * 1000);

  // Trigger manual broadcast (for admin)
  app.post("/api/admin/trigger-broadcast", async (req, res) => {
    const { secret } = req.body;
    if (secret !== process.env.ADMIN_SECRET && process.env.NODE_ENV === 'production') {
      return res.status(403).send("Unauthorized");
    }
    await broadcastMarketingEmail();
    res.json({ success: true, message: "Broadcast initiated" });
  });

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
