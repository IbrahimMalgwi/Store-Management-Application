import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createSeedData, DEFAULT_BUSINESS_PROFILE } from "./seed.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.resolve(__dirname, "../../data/db.json");

let data = {
  businessProfile: { ...DEFAULT_BUSINESS_PROFILE },
  items: [],
  users: [],
  txns: [],
  notifications: [],
};

const normalizeBusinessProfile = (profile = {}) => ({
  businessName: String(profile.businessName || DEFAULT_BUSINESS_PROFILE.businessName).trim(),
  address: String(profile.address || DEFAULT_BUSINESS_PROFILE.address).trim(),
  phone: String(profile.phone || DEFAULT_BUSINESS_PROFILE.phone).trim(),
  email: String(profile.email || DEFAULT_BUSINESS_PROFILE.email).trim(),
});

const normalizeData = (nextData) => ({
  businessProfile: normalizeBusinessProfile(
    nextData.businessProfile || nextData.users?.find(user => user.role === "admin")?.businessProfile || nextData.users?.[0]?.businessProfile
  ),
  items: nextData.items || [],
  users: (nextData.users || []).map(({ businessProfile, ...user }) => user),
  txns: nextData.txns || [],
  notifications: nextData.notifications || [],
});

const ensureDataDirectory = () => {
  const dir = path.dirname(DB_FILE);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const persist = () => {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file", error);
  }
};

export const initDB = async () => {
  ensureDataDirectory();

  if (fs.existsSync(DB_FILE)) {
    try {
      data = normalizeData(JSON.parse(fs.readFileSync(DB_FILE, "utf-8")));
      persist();
      return;
    } catch (error) {
      console.error("Error reading database file, resetting to seed data", error);
    }
  }

  data = await createSeedData();
  persist();
};

export const getDB = () => data;

export const saveCollection = (collection, items) => {
  data[collection] = items;
  persist();
};

export const replaceDB = (nextData) => {
  data = normalizeData(nextData);
  persist();
};

export const resetToSeed = async () => {
  data = await createSeedData();
  persist();
  return data;
};
