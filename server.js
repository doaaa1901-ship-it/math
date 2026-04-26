const express = require("express");
const nodemailer = require("nodemailer");
const bodyParser = require("body-parser");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ In-memory stores (replace with MongoDB later)
const users = {};
const verificationCodes = {};

// ✅ Gmail transporter with App Password
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
async function sendWelcomeEmail(to, name, code = null) {
  const subject = code ? "Your MathApp Verification Code" : "Welcome to MathApp!";
  const inboxLink = getInboxUrl(to);

  const html = code
    ? `<div>Hi ${name}, your verification code is <b>${code}</b>. <a href="${inboxLink}">Open Inbox</a></div>`
    : `<div>Hi ${name}, welcome to MathApp! <a href="${inboxLink}">Open Inbox</a></div>`;

  const text = code
    ? `Hi ${name}, your verification code is: ${code}`
    : `Hi ${name}, your MathApp account has been created using the email: ${to}.`;

  return transporter.sendMail({
    from: process.env.GMAIL_USER,
    to,
    subject,
    text,
    html
  });
}

// ✅ Routes
app.get("/", (req, res) => {
  res.send("🚀 MathApp backend is running!");
});

app.post("/api/signup", async (req, res) => {
  const { name, email, password } = req.body;
  if (users[email]) return res.status(400).json({ error: "Email already registered." });

  const code = generateVerificationCode();
  const expiresAt = Date.now() + 5 * 60 * 1000;
  verificationCodes[email] = { code, expiresAt };
  users[email] = { name, password };

  try {
    await sendWelcomeEmail(email, name, code);
    res.json({ success: true, message: "Verification email sent." });
  } catch (err) {
    res.status(500).json({ error: "Failed to send email." });
  }
});

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

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user) return res.status(400).json({ error: "User not found." });
  if (user.password !== password) return res.status(400).json({ error: "Incorrect password." });
  res.json({ user, message: "Login successful." });
});

// ✅ Use Railway’s dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
