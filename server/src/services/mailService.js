"use strict";
const nodemailer = require("nodemailer");
const config = require("../config/env");

let transport;
function getTransport() {
  const { host, port, user, pass, notifyEmail } = config.smtp;
  if (!host || !notifyEmail) return null; // optional feature
  transport ??= nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465, // never fall back to plaintext SMTP
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 5000,
    socketTimeout: 10000,
  });
  return transport;
}

// Plain-text only (no HTML body) -> no HTML/script injection into your mail client.
// Visitor-supplied name goes in the body, never a header; subject/email are already validated single-line.
async function notifyNewMessage(msg) {
  const t = getTransport();
  if (!t) return;
  await t.sendMail({
    from: config.smtp.user || config.smtp.notifyEmail,
    to: config.smtp.notifyEmail,
    replyTo: msg.email,
    subject: `[Portfolio] ${msg.subject}`,
    text: `From: ${msg.name} <${msg.email}>\nIP: ${msg.ip}\n\n${msg.message}`,
  });
}

module.exports = { notifyNewMessage };
