const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "supersecret-demo-secret";

// Demo-User; in real-world setups use hashed passwords + env configuration.
const DEMO_USER = {
  username: "admin",
  // Klartext nur für Demo. Für produktive Nutzung Passwort-Hash + sichere Secrets verwenden.
  passwordPlain: process.env.DEMO_PASSWORD || "admin123"
};

module.exports = {
  PORT,
  JWT_SECRET,
  DEMO_USER
};
