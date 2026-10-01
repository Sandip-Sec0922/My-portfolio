"use strict";
const argon2 = require("argon2");

// argon2id with OWASP-recommended minimums (19 MiB, t=2, p=1): memory-hard, resists GPU cracking.
const OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

const hash = (password) => argon2.hash(password, OPTS);

const verify = async (storedHash, password) => {
  try {
    return await argon2.verify(storedHash, password);
  } catch {
    return false; // malformed hash must behave like "wrong password"
  }
};

// WHY: for unknown emails we still burn one full argon2 verification so response time
// doesn't reveal which emails exist (user enumeration via timing).
let dummy;
const dummyHash = () =>
  (dummy ??= hash("timing-equaliser-not-a-real-password"));

module.exports = { hash, verify, dummyHash };
