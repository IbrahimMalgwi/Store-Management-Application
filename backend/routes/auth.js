import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { getDB, saveCollection } from "../db.js";
import { authenticateToken, normalizeRole } from "../middleware/auth.js";
import { getLicenseAccess } from "../src/license.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "stockos_secret_key_123";
const MIN_PASSWORD_LENGTH = 8;
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || "15m";
const REFRESH_TOKEN_DAYS = Number.parseInt(process.env.REFRESH_TOKEN_DAYS || "7", 10);

const hashRefreshToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const getRefreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (Number.isFinite(REFRESH_TOKEN_DAYS) ? REFRESH_TOKEN_DAYS : 7));
  return expiresAt.toISOString();
};

const isExpired = (expiresAt) => Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());

const buildUserResponse = (user, instance, userRole = normalizeRole(user.role)) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: userRole,
  active: user.active,
  instanceId: user.instanceId,
  instanceName: instance.name,
  instanceSlug: instance.slug,
  license: instance.license,
});

const createAccessToken = (user, userRole = normalizeRole(user.role)) => jwt.sign(
  { id: user.id, name: user.name, email: user.email, role: userRole, instanceId: user.instanceId },
  JWT_SECRET,
  { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
);

const issueRefreshToken = (db, user, req) => {
  const refreshToken = crypto.randomBytes(48).toString("base64url");
  const expiresAt = getRefreshExpiry();
  const now = new Date().toISOString();

  db.refreshTokens = db.refreshTokens || [];
  db.refreshTokens.push({
    id: crypto.randomUUID(),
    instanceId: user.instanceId,
    userId: user.id,
    tokenHash: hashRefreshToken(refreshToken),
    createdAt: now,
    expiresAt,
    lastUsedAt: now,
    revokedAt: null,
    userAgent: req.headers["user-agent"] || "",
  });
  saveCollection("refreshTokens", db.refreshTokens);

  return { refreshToken, refreshTokenExpiresAt: expiresAt };
};

const revokeRefreshTokensForUser = (db, userId, instanceId) => {
  const now = new Date().toISOString();
  db.refreshTokens = (db.refreshTokens || []).map(token =>
    token.userId === userId && token.instanceId === instanceId && !token.revokedAt
      ? { ...token, revokedAt: now }
      : token
  );
  saveCollection("refreshTokens", db.refreshTokens);
};

const validateAccountAccess = (user, instance) => {
  if (!user || !instance) {
    return { status: 401, message: "Invalid credentials" };
  }

  if (!instance.active) {
    return { status: 403, message: "This business instance is inactive" };
  }

  const licenseAccess = getLicenseAccess(instance.license);
  if (!licenseAccess.allowed) {
    return { status: 403, message: licenseAccess.reason };
  }

  if (!user.active) {
    return { status: 403, message: "Account is inactive. Contact admin" };
  }

  return null;
};

router.post("/login", async (req, res) => {
  const { email, password, role, instanceId, instanceSlug } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const db = getDB();
  const requestedInstance = instanceId
    ? db.instances.find(instance => instance.id === instanceId)
    : instanceSlug
      ? db.instances.find(instance => instance.slug === instanceSlug)
      : null;

  const requestedRole = role ? normalizeRole(role) : null;
  let candidates = db.users.filter(u => u.email === email && (!requestedRole || normalizeRole(u.role) === requestedRole));
  if (requestedInstance) {
    candidates = candidates.filter(u => u.instanceId === requestedInstance.id);
  }

  if (!requestedInstance && candidates.length > 1) {
    return res.status(400).json({ message: "Multiple instances use this account. Select an instance to continue." });
  }

  const user = candidates[0];
  const instance = user ? db.instances.find(item => item.id === user.instanceId) : null;
  const accessError = validateAccountAccess(user, instance);
  if (accessError) {
    return res.status(accessError.status).json({ message: accessError.message });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const userRole = normalizeRole(user.role);
  const refresh = issueRefreshToken(db, user, req);

  res.json({
    token: createAccessToken(user, userRole),
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
    refreshToken: refresh.refreshToken,
    refreshTokenExpiresAt: refresh.refreshTokenExpiresAt,
    user: buildUserResponse(user, instance, userRole),
  });
});

router.post("/refresh", (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  const db = getDB();
  const tokenHash = hashRefreshToken(refreshToken);
  const index = (db.refreshTokens || []).findIndex(token => token.tokenHash === tokenHash && !token.revokedAt);
  const session = index >= 0 ? db.refreshTokens[index] : null;

  if (!session) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  if (isExpired(session.expiresAt)) {
    db.refreshTokens[index] = { ...session, revokedAt: new Date().toISOString() };
    saveCollection("refreshTokens", db.refreshTokens);
    return res.status(401).json({ message: "Refresh token expired" });
  }

  const user = db.users.find(item => item.id === session.userId && item.instanceId === session.instanceId);
  const instance = user ? db.instances.find(item => item.id === user.instanceId) : null;
  const accessError = validateAccountAccess(user, instance);
  if (accessError) {
    return res.status(accessError.status).json({ message: accessError.message });
  }

  const nextRefreshToken = crypto.randomBytes(48).toString("base64url");
  const nextExpiresAt = getRefreshExpiry();
  db.refreshTokens[index] = {
    ...session,
    tokenHash: hashRefreshToken(nextRefreshToken),
    lastUsedAt: new Date().toISOString(),
    expiresAt: nextExpiresAt,
  };
  saveCollection("refreshTokens", db.refreshTokens);

  const userRole = normalizeRole(user.role);
  res.json({
    token: createAccessToken(user, userRole),
    accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES_IN,
    refreshToken: nextRefreshToken,
    refreshTokenExpiresAt: nextExpiresAt,
    user: buildUserResponse(user, instance, userRole),
  });
});

router.post("/logout", (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const db = getDB();
    const tokenHash = hashRefreshToken(refreshToken);
    const index = (db.refreshTokens || []).findIndex(token => token.tokenHash === tokenHash && !token.revokedAt);

    if (index >= 0) {
      db.refreshTokens[index] = { ...db.refreshTokens[index], revokedAt: new Date().toISOString() };
      saveCollection("refreshTokens", db.refreshTokens);
    }
  }

  res.json({ message: "Logged out" });
});

router.put("/password", authenticateToken, async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ message: "Current password, new password, and confirmation are required" });
  }

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ message: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "New password and confirmation do not match" });
  }

  const db = getDB();
  const index = db.users.findIndex(user => user.id === req.user.id && user.instanceId === req.user.instanceId);
  const user = index >= 0 ? db.users[index] : null;

  if (!user) {
    return res.status(404).json({ message: "Account not found" });
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    return res.status(400).json({ message: "New password must be different from the current password" });
  }

  const salt = await bcrypt.genSalt(10);
  db.users[index] = {
    ...user,
    password: await bcrypt.hash(newPassword, salt),
    passwordUpdatedAt: new Date().toISOString(),
  };

  saveCollection("users", db.users);
  revokeRefreshTokensForUser(db, user.id, user.instanceId);

  res.json({ message: "Password changed successfully. Sign in again to continue." });
});

export default router;
