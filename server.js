const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ In-memory stores
const users = {}; 
const verificationCodes = {}; 

// ✅ Gmail transporter with App Password
require("dotenv").config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});


// ✅ Generate 6-digit verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ✅ Detect inbox URL by email domain
function getInboxUrl(email) {
  if (email.includes("@gmail.com")) return "https://mail.google.com";
  if (email.includes("@outlook.com") || email.includes("@hotmail.com") || email.includes("@live.com")) return "https://outlook.live.com/mail";
  if (email.includes("@yahoo.com")) return "https://mail.yahoo.com";
  return "https://www.google.com";
}

// ✅ Send email with HTML + smart inbox link
function sendWelcomeEmail(to, name, code = null) {
  const subject = code
    ? "Your MathApp Verification Code"
    : "Welcome to MathApp!";

  const inboxLink = getInboxUrl(to);

  const html = code
    ? `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
      <div style="background:#4CAF50;color:#fff;padding:20px;text-align:center;">
        <h1 style="margin:0;">Welcome to MathApp</h1>
      </div>
      <div style="padding:20px;">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Thanks for signing up! To verify your account, please use the code below:</p>
        <div style="background:#f4f4f4;border:1px dashed #4CAF50;padding:15px;text-align:center;font-size:24px;font-weight:bold;color:#333;margin:20px 0;">
          ${code}
        </div>
        <p>This code will expire in <strong>5 minutes</strong>.</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${inboxLink}" target="_blank" 
             style="display:inline-block;background:#4CAF50;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;">
            Open Your Inbox to Verify
          </a>
        </div>
        <p>Happy learning,<br><strong>The MathApp Team</strong></p>
      </div>
      <div style="background:#eee;padding:10px;text-align:center;font-size:12px;color:#777;">
        &copy; ${new Date().getFullYear()} MathApp. All rights reserved.
      </div>
    </div>
    `
    : `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
      <div style="background:#4CAF50;color:#fff;padding:20px;text-align:center;">
        <h1 style="margin:0;">Welcome to MathApp</h1>
      </div>
      <div style="padding:20px;">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your account has been created successfully using the email:</p>
        <div style="background:#f4f4f4;border:1px solid #ccc;padding:10px;text-align:center;font-size:16px;color:#333;margin:20px 0;">
          ${to}
        </div>
        <p>We’re excited to have you on board. Start exploring math challenges and track your progress!</p>
        <div style="text-align:center;margin:20px 0;">
          <a href="${inboxLink}" target="_blank" 
             style="display:inline-block;background:#4CAF50;color:#fff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:bold;">
            Open Your Inbox
          </a>
        </div>
        <p>Best regards,<br><strong>The MathApp Team</strong></p>
      </div>
      <div style="background:#eee;padding:10px;text-align:center;font-size:12px;color:#777;">
        &copy; ${new Date().getFullYear()} MathApp. All rights reserved.
      </div>
    </div>
    `;

  const text = code
    ? `Hi ${name}, your verification code is: ${code}`
    : `Hi ${name}, your MathApp account has been created using the email: ${to}.`;
   
    return transporter
    .sendMail({
      from: "amrelmasry842@gmail.com",
      to,
      subject,
      text,
      html
    })
    .catch(err => {
      console.error("Email error:", err);
      throw err;
    });
}

// ✅ Test route
app.get("/test-email", async (req, res) => {
  try {
    await sendWelcomeEmail("example@gmail.com", "Test User", "123456");
    res.send("✅ Test email sent!");
  } catch (err) {
    res.status(500).send("❌ Failed to send email: " + err.message);
  }
});

// ✅ Signup route with code generation
app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;

  if (users[email]) return res.status(400).json({ error: "Email already registered." });

  const code = generateVerificationCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;

  verificationCodes[email] = { code, expiresAt };
  users[email] = { name, password };

  console.log(`🔐 Code for ${email}: ${code}`);

  try {
    await sendWelcomeEmail(email, name, code);
    res.json({ success: true, message: "Verification email sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email." });
  }
});

// ✅ Verify route
app.post("/api/verify", (req, res) => {
  const { email, code } = req.body;
  const entry = verificationCodes[email];
  const user = users[email];

  if (!entry || !user) return res.status(400).json({ error: "No verification code or user found." });
  if (Date.now() > entry.expiresAt) return res.status(400).json({ error: "Verification code expired." });
  if (entry.code !== code) return res.status(400).json({ error: "Incorrect verification code." });

  delete verificationCodes[email];
  res.json({ success: true, message: "Account verified and logged in.", user });
});

// ✅ Resend code route
app.post("/api/resend", async (req, res) => {
  const { name, email } = req.body;
  if (!users[email]) return res.status(400).json({ error: "User not found." });

  const code = generateVerificationCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  verificationCodes[email] = { code, expiresAt };

  console.log(`🔁 Resent code for ${email}: ${code}`);
  try {
    await sendWelcomeEmail(email, name, code);
    res.json({ success: true, message: "Verification code resent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to resend email." });
  }
});

// ✅ Login route
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users[email];

  if (!user) return res.status(400).json({ error: "User not found." });
  if (user.password !== password) return res.status(400).json({ error: "Incorrect password." });

  res.json({ user, message: "Login successful." });
});

// ✅ Root route
app.get("/", (req, res) => {
  res.send("🚀 MathApp backend is running!");
});

// ✅ Start server
app.listen(5000, () => console.log("Server running on http://localhost:5000"));
