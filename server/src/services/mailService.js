"use strict";
const dns = require("node:dns").promises;
const nodemailer = require("nodemailer");
const config = require("../config/env");

let transportPromise;
async function getTransport() {
  const { host, port, user, pass, notifyEmail } = config.smtp;
  if (!host || !notifyEmail) return null; // optional feature
  if (!transportPromise) {
    transportPromise = dns
      .lookup(host, { family: 4 })
      .then(({ address }) => {
        return nodemailer.createTransport({
          host: address,
          port,
          secure: port === 465,
          requireTLS: port !== 465, // never fall back to plaintext SMTP
          tls: { servername: host },
          auth: user ? { user, pass } : undefined,
          connectionTimeout: 10000,
          socketTimeout: 10000,
        });
      })
      .catch((error) => {
        transportPromise = null;
        throw error;
      });
  }
  return transportPromise;
}

async function sendWithResend({ to, subject, text, replyTo }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.resend.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [to],
      subject,
      text,
      ...(replyTo && { reply_to: replyTo }),
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const error = new Error(
      `Resend API responded ${response.status}: ${String(result.message || result.name || "email request failed").slice(0, 200)}`,
    );
    error.code = result.name;
    error.responseCode = response.status;
    throw error;
  }
}

async function sendEmail({ to, subject, text, replyTo }) {
  if (config.resend.apiKey && config.resend.from)
    return sendWithResend({ to, subject, text, replyTo });

  const t = await getTransport();
  if (!t) throw new Error("Email delivery is not configured");
  return t.sendMail({
    from: config.smtp.user || config.smtp.notifyEmail,
    to,
    replyTo,
    subject,
    text,
  });
}

// Plain-text only (no HTML body) -> no HTML/script injection into your mail client.
// Visitor-supplied name goes in the body, never a header; subject/email are already validated single-line.
async function notifyNewMessage(msg) {
  if (
    !config.smtp.notifyEmail ||
    (!(config.resend.apiKey && config.resend.from) &&
      !(config.smtp.host && config.smtp.notifyEmail))
  )
    return;
  await sendEmail({
    to: config.smtp.notifyEmail,
    replyTo: msg.email,
    subject: `[Portfolio] ${msg.subject}`,
    text: `From: ${msg.name} <${msg.email}>\nIP: ${msg.ip}\n\n${msg.message}`,
  });
}

async function sendAdminPasswordResetOtp(email, otp) {
  await sendEmail({
    to: email,
    subject: "Admin password reset code",
    text: `Your admin password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`,
  });
}

const canSendPasswordReset = () =>
  Boolean(
    (config.resend.apiKey && config.resend.from) ||
      (config.smtp.host && config.smtp.notifyEmail),
  );

module.exports = {
  notifyNewMessage,
  sendAdminPasswordResetOtp,
  canSendPasswordReset,
};
