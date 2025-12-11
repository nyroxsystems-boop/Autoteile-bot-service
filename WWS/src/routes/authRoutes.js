const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { DEMO_USER, JWT_SECRET } = require("../config");

const router = express.Router();

router.post("/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password required" });
  }
  if (username !== DEMO_USER.username) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  let passwordIsValid = false;
  if (DEMO_USER.passwordHash) {
    passwordIsValid = await bcrypt.compare(password, DEMO_USER.passwordHash);
  } else {
    passwordIsValid = password === DEMO_USER.passwordPlain;
  }

  if (!passwordIsValid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ username: DEMO_USER.username, role: "admin" }, JWT_SECRET, {
    expiresIn: "8h"
  });

  res.json({
    token,
    user: { username: DEMO_USER.username }
  });
});

module.exports = router;
