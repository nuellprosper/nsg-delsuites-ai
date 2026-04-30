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
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId,
});

const adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

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
  const broadcastMarketingEmail = async (templateId?: string, forceAll: boolean = false) => {
    try {
      let selectedTemplate;
      
      if (templateId) {
        const tDoc = await adminDb.collection('email_templates').doc(templateId).get();
        if (!tDoc.exists) return { success: false, message: "Template not found" };
        selectedTemplate = tDoc.data();
      } else {
        const templatesSnap = await adminDb.collection('email_templates').where('active', '==', true).get();
        if (templatesSnap.empty) return { success: false, message: "No active templates" };
        const templates = templatesSnap.docs.map(doc => doc.data());
        selectedTemplate = templates[Math.floor(Math.random() * templates.length)];
      }

      if (!selectedTemplate) return { success: false, message: "No template selected" };

      const usersSnap = await adminDb.collection('users').get();
      let count = 0;
      
      for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        if (!userData.email) continue;
        
        const lastEmail = userData.lastMarketingEmailAt?.toDate() || new Date(0);
        const daysSinceLast = (Date.now() - lastEmail.getTime()) / (1000 * 60 * 60 * 24);

        // Send if forced (manual) OR more than 2 days since last marketing email
        if (forceAll || daysSinceLast >= 2) {
          const userName = userData.fullName || userData.displayName || 'there';
          const nameRegex = /\$\{name\}|\{\{name\}\}/g;
          
          const subject = selectedTemplate.subject.replace(nameRegex, userName);
          const body = selectedTemplate.body.replace(nameRegex, userName);
          
          await transporter.sendMail({
            from: `"ABRAHAM EMMANUEL PROSPER" <${process.env.EMAIL_USER}>`,
            to: userData.email,
            subject: subject,
            text: body,
          });

          await userDoc.ref.update({
            lastMarketingEmailAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          count++;
          console.log(`Sent marketing email to ${userData.email}`);
        }
      }
      return { success: true, count };
    } catch (error) {
      console.error("Broadcast error:", error);
      return { success: false, error: String(error) };
    }
  };

  // Run periodic broadcast check every 24 hours (strictly following the 2-day rule)
  setInterval(() => broadcastMarketingEmail(), 24 * 60 * 60 * 1000);

  // Trigger manual broadcast (for admin) - sends TO ALL immediately
  app.post("/api/admin/trigger-broadcast", async (req, res) => {
    const { secret, templateId } = req.body;
    // Allow 'GOD_MODE' for dev/ease, or check env
    if (secret !== (process.env.ADMIN_SECRET || 'GOD_MODE')) {
      return res.status(403).send("Unauthorized");
    }
    
    const result = await broadcastMarketingEmail(templateId, true);
    res.json(result);
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
