"use strict";
const config = require("../config/env");
const logger = require("../utils/logger");

const URL_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

// Optional control: no secret configured -> skipped. Secret configured -> mandatory, and fails CLOSED.
async function verify(token, ip) {
  if (!config.turnstileSecret) return true;
  if (!token) return false;
  try {
    const body = new URLSearchParams({
      secret: config.turnstileSecret,
      response: token,
      remoteip: ip || "",
    });
    const res = await fetch(URL_VERIFY, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    logger.error({ err: err.message }, "turnstile_error");
    return false;
  }
}

module.exports = { verify };
