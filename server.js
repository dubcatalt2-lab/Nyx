import express from "express";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { hostname } from "node:os";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { createReadStream, readFileSync } from "node:fs";
import { mkdir, open as openFile, stat, statfs, unlink } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";
import { Server as SocketIOServer } from "socket.io";

// Using the process root keeps this file compatible with Netlify's CommonJS
// function bundle while preserving normal `node server.js` behavior.
const __dirname = resolve(process.env.NYX_PROJECT_ROOT || process.cwd());
const staticRoot = resolve(process.env.NYX_STATIC_ROOT || __dirname);
const require = createRequire(join(__dirname, "package.json"));
const { uvPath } = require("@titaniumnetwork-dev/ultraviolet");
const { baremuxPath } = require("@mercuryworkshop/bare-mux/node");
const { scramjetPath } = require("@mercuryworkshop/scramjet/path");
const scramjetControllerPath = dirname(require.resolve("@mercuryworkshop/scramjet-controller"));
const epoxyPath = join(dirname(require.resolve("@mercuryworkshop/epoxy-transport")), "..", "dist");
const libcurlPath = dirname(require.resolve("@mercuryworkshop/libcurl-transport"));
const erudaPath = require.resolve("eruda");
let cinebyAppCache = { source: "", expires: 0 };
const gameCoverLookupCache = new Map();
let duckMathGamesCache = { games: [], expires: 0, promise: null };
let catClassGamesCache = { games: [], expires: 0, promise: null };
let catClassCoverUrls = new Set();
const nyxMediaSearchCache = new Map();
const nyxMediaSearchAttempts = new Map();
const nyxMediaSearchCacheTtlMs = 5 * 60_000;
const nyxMediaSearchCacheLimit = 200;
const nyxMediaSearchWindowMs = 15 * 60_000;
const nyxMediaSearchMaxAttempts = 60;
const nyxMetingAssetResolutionCache = new Map();
const nyxMetingAssetResolutionTtlMs = 5 * 60_000;
const nyxMetingAssetResolutionCacheLimit = 500;
const nyxMusicArtworkCache = new Map();
const nyxMusicArtworkInflight = new Map();
const nyxMusicArtworkCacheByteLimit = 32 * 1024 * 1024;
let nyxMusicArtworkCacheBytes = 0;
let nyxSoundCloudTokenCache = { accessToken: "", expiresAt: 0, promise: null };
const nyxCustomRoleLabelLimit = 64;
const app = express();

function normalizePublicWispUrl(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const url = new URL(raw);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    if (url.protocol !== "ws:" && url.protocol !== "wss:") return "";
    if (!url.pathname || url.pathname === "/") url.pathname = "/wisp/";
    if (!url.pathname.endsWith("/")) url.pathname += "/";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

const externalWispUrl = normalizePublicWispUrl(process.env.WISP_URL);
const embeddedWispAllowedOrigins = [...new Set([
  ...String(process.env.NYX_ALLOWED_ORIGINS || "").split(","),
  process.env.NYX_PUBLIC_ORIGIN
].map(value => String(value || "").trim().replace(/\/$/, "")).filter(Boolean))];
if (!externalWispUrl) {
  wisp.options.allow_private_ips = false;
  wisp.options.allow_loopback_ips = false;
  wisp.options.allow_direct_ip = true;
  wisp.options.allow_udp_streams = false;
  wisp.options.port_whitelist = [80, 443];
  wisp.options.dns_method = "lookup";
  wisp.options.dns_result_order = "ipv4first";
  // wisp-js 0.4.1's per-host limiter cannot iterate its stream object safely.
  wisp.options.stream_limit_per_host = -1;
  wisp.options.stream_limit_total = 64;
  wisp.options.wisp_motd = "Nyx embedded Wisp";
}
const presenceSessions = new Map();
const presenceSessionFirstSeen = new Map();
const presenceSessionDetails = new Map();
const presenceTtlMs = 45_000;
const nyxGuestAdjectives = Object.freeze(["Astral", "Blue", "Cosmic", "Dreaming", "Hidden", "Lunar", "Midnight", "Quiet", "Silver", "Starry", "Velvet", "Wandering"]);
const nyxGuestNouns = Object.freeze(["Comet", "Echo", "Fox", "Moth", "Moon", "Nova", "Orbit", "Raven", "Shadow", "Spark", "Star", "Willow"]);
const profileImageDataLimit = 850_000;
const profileImageDocumentLimit = 900_000;
const profileMediaEncodedLimit = 11_250_000;
const profileMediaChunkLimit = 450_000;
const profileMediaChunkCountLimit = 32;
const ownerDashboardUserScanLimit = 5_000;
const ownerDashboardPageSizeLimit = 100;
const signedInOnlineWindowMs = 6 * 60_000;
const signedInPresence = new Map();
const userActivityEventWindowMs = 15 * 60_000;
const userActivityEventTimes = new Map();
const nyxChatChannels = Object.freeze([
  Object.freeze({ id: "general", name: "General", description: "The main Nyx community chat." }),
  Object.freeze({ id: "gaming", name: "Gaming", description: "Games, scores, and Pirate Cove." }),
  Object.freeze({ id: "study", name: "Study Hall", description: "Homework help and study talk." }),
  Object.freeze({ id: "off-topic", name: "Off Topic", description: "Everything that belongs somewhere else." }),
  Object.freeze({ id: "staff-room", name: "Staff Room", description: "A private channel for moderators and staff.", minimumRole: "moderator" })
]);
const nyxChatVoiceChannels = Object.freeze([
  Object.freeze({ id: "lounge", name: "Lounge", description: "Open voice chat for the Nyx community." }),
  Object.freeze({ id: "gaming-voice", name: "Gaming", description: "Talk while playing in Pirate Cove." }),
  Object.freeze({ id: "study-voice", name: "Study Room", description: "A quieter room for studying together." })
]);
const nyxChatChannelIdPattern = /^[a-z0-9][a-z0-9-]{1,47}$/;
const nyxChatConfigurationCollection = "nyxChatConfiguration";
const nyxChatConfigurationDocument = "channels";
const nyxChatConfigurationTtlMs = 10 * 60_000;
let nyxChatConfigurationCache = { expiresAt: 0, value: null, promise: null };
const nyxChatIdentityCacheTtlMs = 15 * 60_000;
const nyxChatIdentityCache = new Map();
const nyxChatMemberDirectoryCacheTtlMs = 10 * 60_000;
let nyxChatMemberDirectoryCache = { expiresAt: 0, value: null, promise: null };
const nyxChatChannelActivityCacheTtlMs = 10 * 60_000;
let nyxChatChannelActivityCache = { expiresAt: 0, value: new Map(), promise: null };
let nyxChatRealtimeRevision = Date.now();
const nyxChatRealtimeEvents = [];
const nyxChatRealtimeEventLimit = 500;
let nyxChatRealtimeDroppedBeforeRevision = 0;
let nyxChatSocketServer = null;
const nyxChatVoiceSessionIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const nyxChatVoiceSignalTypes = new Set(["offer", "answer", "candidate"]);
// Explicit leave requests end active calls. This long timeout only removes
// abandoned in-memory presence after a browser or device disappears abruptly.
const nyxChatVoiceStaleMs = 24 * 60 * 60_000;
const nyxChatVoiceSignalTtlMs = 60_000;
const nyxChatVoiceRoomLimit = 8;
const nyxChatVoiceSessions = new Map();
const nyxChatVoiceSignals = new Map();
const nyxChatVoiceJoinAttempts = new Map();
const nyxChatVoiceSignalAttempts = new Map();
const nyxChatMessageLimit = 1_000;
const nyxChatSendWindowMs = 10_000;
const nyxChatSendMaxPerWindow = 6;
const nyxChatSendAttempts = new Map();
const nyxChatMuteCollection = "nyxChatMutes";
const nyxChatMuteMinimumMs = 60_000;
const nyxChatMuteMaximumMs = 28 * 24 * 60 * 60_000;
const nyxChatMuteCacheTtlMs = 15_000;
const nyxChatMuteCache = new Map();
const nyxSearchHistoryCollection = "nyxSearchHistory";
const nyxSearchHistoryRetentionMs = 30 * 24 * 60 * 60_000;
const nyxSearchHistoryAttempts = new Map();
let nyxSearchHistoryLastCleanupAt = 0;
const nyxSearchHistoryPatterns = Object.freeze([
  Object.freeze({ category: "Sexually explicit", pattern: /\b(?:porn(?:ography)?|xxx|hentai|rule\s*34|nudes?|sex\s+videos?)\b/i }),
  Object.freeze({ category: "Child exploitation", pattern: /\b(?:csam|child\s+(?:porn|nudes?|sexual\s+content))\b/i }),
  Object.freeze({ category: "Violence or threats", pattern: /\b(?:how\s+to\s+(?:make|build)\s+(?:a\s+)?bomb|school\s+shooting|(?:kill|murder)\s+(?:someone|a\s+person|my\s+(?:teacher|classmate|parent)))\b/i }),
  Object.freeze({ category: "Self-harm instructions", pattern: /\b(?:how\s+to\s+(?:kill\s+myself|commit\s+suicide)|suicide\s+methods?|best\s+way\s+to\s+die|self[-\s]?harm\s+(?:methods?|tips))\b/i }),
  Object.freeze({ category: "Illegal drugs", pattern: /\b(?:(?:buy|sell)\s+(?:fentanyl|cocaine|meth(?:amphetamine)?|heroin)|how\s+to\s+make\s+meth)\b/i }),
  Object.freeze({ category: "Targeted cyber abuse", pattern: /\b(?:doxx?(?:ing)?|swat(?:ting)?\s+someone|ddos(?:ing)?|steal\s+(?:a\s+)?password|hack\s+(?:an?\s+)?account|grab\s+(?:someone(?:'s)?|a\s+person(?:'s)?)\s+ip)\b/i })
]);
const nyxChatConversationIdPattern = /^[a-f0-9]{40}$/;
const nyxChatAttachmentIdPattern = /^[a-f0-9]{40}$/;
const nyxCaffeineGiftIdPattern = /^[a-f0-9]{40}$/;
const nyxCaffeineGiftCollection = "nyxCaffeineGifts";
const nyxCaffeineGiftPendingMs = 7 * 24 * 60 * 60_000;
const nyxChatAttachmentMimeTypes = new Set([
  "image/gif", "image/jpeg", "image/png", "image/webp",
  "audio/mpeg", "audio/mp4", "audio/ogg", "audio/wav", "audio/x-wav", "audio/webm",
  "video/mp4", "video/ogg", "video/quicktime", "video/webm",
  "application/pdf", "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation"
]);
const nyxChatAttachmentFileLimit = 8 * 1024 * 1024;
const nyxChatAttachmentMessageLimit = 8 * 1024 * 1024;
const nyxChatAttachmentCountLimit = 3;
const nyxChatAttachmentEncodedLimit = 11_500_000;
const nyxChatAttachmentChunkLimit = 450_000;
const nyxChatAttachmentChunkCountLimit = 32;
const nyxChatAttachmentUploadTtlMs = 60 * 60_000;
// Historical streamed Owner uploads remain readable, but all new uploads are
// constrained by the same 8 MB per-file and per-message limit.
const nyxChatOwnerAttachmentFileLimit = 1024 * 1024 * 1024;
const nyxChatOwnerAttachmentChunkLimit = 4 * 1024 * 1024;
const nyxChatOwnerAttachmentChunkCountLimit = 256;
const nyxChatAttachmentRoot = resolve(process.env.NYX_CHAT_ATTACHMENT_ROOT || "/var/lib/nyx/chat-attachments");
const nyxChatAttachmentTickets = new Map();
const nyxChatAttachmentUploads = new Set();
const nyxChatAttachmentTicketTtlMs = 10 * 60_000;
let nyxChatAttachmentLastCleanupAt = 0;
const nyxChatReactionEmoji = new Set(["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👀"]);
const nyxAccountSignInAttempts = new Map();
const nyxAccountRegisterAttempts = new Map();
const nyxAccountPasswordResetAttempts = new Map();
const nyxAccountSignInWindowMs = 15 * 60_000;
const nyxAccountSignInMaxAttempts = 10;
const nyxAccountRegisterMaxAttempts = 5;
const nyxAccountPasswordResetMaxAttempts = 5;
const ownerDashboardSnapshotTtlMs = 30_000;
let ownerDashboardSnapshotCache = { expiresAt: 0, value: null, promise: null };
const nyxCustomRoleCollection = "nyxCustomRoles";
const nyxCustomRoleIdPattern = /^[a-z0-9][a-z0-9-]{1,31}$/;
const nyxCustomRoleCacheTtlMs = 60_000;
let nyxCustomRoleCache = { expiresAt: 0, value: new Map(), promise: null };
const nyxIpBanCollectionName = "nyxIpBans";
const nyxIpBanCacheTtlMs = 10 * 60_000;
const nyxIpBanRetryDelayMs = 5 * 60_000;
const nyxIpBanListLimit = 500;
let nyxIpBanCache = { expiresAt: 0, retryAt: 0, bans: new Map(), promise: null, loaded: false };
let nyxIpBanBootstrapPromise = null;
const nyxCustomHostnameCollectionName = "nyxCustomHostnames";
const nyxCustomHostnameRegistrationAttempts = new Map();
const nyxCustomHostnameRegistrationWindowMs = 60 * 60_000;
const nyxCustomHostnameRegistrationMaxAttempts = 10;
const nyxCustomHostnameAskCacheTtlMs = 5 * 60_000;
const nyxCustomHostnameAskNegativeCacheTtlMs = 30_000;
const nyxCustomHostnameAskCacheLimit = 1_000;
const nyxCustomHostnameAskCache = new Map();
const nyxCustomHostnameAskInFlight = new Map();
const linkGeneratorAttempts = new Map();
const linkGeneratorWindowMs = 15 * 60 * 1000;
const linkGeneratorMaxAttempts = 5;
const freeLinkDailyLimit = 3;
const freeNetworkDailyLimit = 25;
const premiumImmediateCooldownAt = 5;
const premiumAccumulatedLimit = 30;
const premiumCooldownMs = 10 * 60 * 1000;
const premiumGenerationUsage = new Map();
const downloadSafetyCache = new Map();
const downloadSafetyAttempts = new Map();
const downloadSafetyWindowMs = 60_000;
const downloadSafetyMaxAttempts = 60;
const linkCheckerAttempts = new Map();
const linkCheckerWindowMs = 15 * 60_000;
const linkCheckerMaxAttempts = 30;
const linkCheckerPageAttempts = new Map();
const linkCheckerPageBatchMaxAttempts = 20;
const linkCheckerBulkAccessCache = new Map();
const linkCheckerBulkAccessCacheTtlMs = 5 * 60_000;
const linkCheckerBulkActiveByUser = new Map();
let linkCheckerBulkActiveRequests = 0;
const linkCheckerBulkMaxConcurrentPerUser = Math.max(1, Math.min(24, Number.parseInt(process.env.NYX_LINK_CHECKER_BULK_CONCURRENCY_PER_USER || "12", 10) || 12));
const linkCheckerBulkMaxConcurrentGlobal = Math.max(linkCheckerBulkMaxConcurrentPerUser, Math.min(96, Number.parseInt(process.env.NYX_LINK_CHECKER_BULK_CONCURRENCY_GLOBAL || "48", 10) || 48));
const linkCheckerApiOrigin = "https://lc.nocturne.lol";
let linkCheckerAccountCookie = "";
let linkCheckerAccountLoginPromise = null;
const freednsRegistryAttempts = new Map();
const freednsRegistryWindowMs = 20 * 60_000;
const freednsRegistryMaxAttempts = 240;
const freednsRegistryCache = new Map();
const freednsRegistryCacheTtlMs = 30 * 60_000;
let linkGeneratorFirebasePromise;
app.use(express.json({ limit: "2mb" }));
app.use((error, _req, res, next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: "Invalid JSON request body." });
    return;
  }
  next(error);
});

function normalizeNyxIp(value) {
  const candidate = String(value || "").trim().replace(/^\[|\]$/g, "").toLowerCase();
  const ip = candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
  return isIP(ip) ? ip : "";
}

function embeddedWispOriginAllowed(origin, requestHost = "") {
  if (!embeddedWispAllowedOrigins.length || embeddedWispAllowedOrigins.includes("*")) return true;
  const normalizedOrigin = String(origin || "").trim().replace(/\/$/, "");
  if (embeddedWispAllowedOrigins.includes(normalizedOrigin)) return true;
  try {
    const parsed = new URL(normalizedOrigin);
    const host = String(requestHost || "").split(",")[0].trim().toLowerCase();
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function rejectWispUpgrade(socket, status = "403 Forbidden") {
  try {
    socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  } finally {
    socket.destroy();
  }
}

function nyxRequestHeader(req, name) {
  if (typeof req.get === "function") return req.get(name);
  return req.headers?.[String(name || "").toLowerCase()];
}

function nyxClientIp(req) {
  const forwarded = process.env.NYX_TRUST_PROXY === "true"
    ? String(nyxRequestHeader(req, "x-nf-client-connection-ip") || nyxRequestHeader(req, "cf-connecting-ip") || nyxRequestHeader(req, "x-forwarded-for") || "").split(",")[0]
    : "";
  return normalizeNyxIp(forwarded) || normalizeNyxIp(req.socket?.remoteAddress);
}

function nyxInternalLoopbackRequest(req) {
  const remoteIp = normalizeNyxIp(req.socket?.remoteAddress);
  if (remoteIp !== "127.0.0.1" && remoteIp !== "::1") return false;
  try {
    const requestHostname = new URL(`http://${String(req.headers?.host || "")}`).hostname;
    const hostIp = normalizeNyxIp(requestHostname);
    return hostIp === "127.0.0.1" || hostIp === "::1";
  } catch {
    return false;
  }
}

function nyxIpBanId(ip) {
  return createHash("sha256").update(`nyx-ip-ban:${ip}`).digest("hex");
}

function normalizeNyxCustomHostname(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 300 || raw.includes("*")) return "";
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      isIP(hostname) ||
      hostname.length > 253
    ) return "";
    const labels = hostname.split(".");
    if (labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))) return "";
    if (["example", "invalid", "localhost", "local", "test", "internal"].includes(labels.at(-1))) return "";
    return hostname;
  } catch {
    return "";
  }
}

function nyxCustomHostnameDocumentId(hostname) {
  return createHash("sha256").update(`nyx-custom-hostname:${hostname}`).digest("hex");
}

function nyxCustomHostnameTargetIps() {
  return [...new Set(String(process.env.NYX_CUSTOM_HOST_IPS || "")
    .split(",")
    .map(normalizeNyxIp)
    .filter(Boolean))];
}

function nyxCustomHostnameRateState(clientId, now = Date.now()) {
  for (const [key, state] of nyxCustomHostnameRegistrationAttempts) {
    if (now - state.windowStarted > nyxCustomHostnameRegistrationWindowMs) nyxCustomHostnameRegistrationAttempts.delete(key);
  }
  let state = nyxCustomHostnameRegistrationAttempts.get(clientId);
  if (!state || now - state.windowStarted > nyxCustomHostnameRegistrationWindowMs) {
    state = { attempts: 0, windowStarted: now };
    nyxCustomHostnameRegistrationAttempts.set(clientId, state);
  }
  return state;
}

async function nyxCustomHostnameResolvedIps(hostname) {
  let timer;
  try {
    const addresses = lookup(hostname, { all: true, verbatim: true }).catch(() => []);
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("DNS verification timed out.")), 5_000);
    });
    const results = await Promise.race([addresses, timeout]);
    return [...new Set(results.map(result => normalizeNyxIp(result?.address)).filter(Boolean))];
  } finally {
    clearTimeout(timer);
  }
}

function cacheNyxCustomHostnameDecision(hostname, allowed) {
  const now = Date.now();
  for (const [cachedHostname, cached] of nyxCustomHostnameAskCache) {
    if (!cached || cached.expiresAt <= now) nyxCustomHostnameAskCache.delete(cachedHostname);
  }
  while (nyxCustomHostnameAskCache.size >= nyxCustomHostnameAskCacheLimit) {
    const oldestHostname = nyxCustomHostnameAskCache.keys().next().value;
    if (!oldestHostname) break;
    nyxCustomHostnameAskCache.delete(oldestHostname);
  }
  nyxCustomHostnameAskCache.set(hostname, {
    allowed,
    expiresAt: now + (allowed ? nyxCustomHostnameAskCacheTtlMs : nyxCustomHostnameAskNegativeCacheTtlMs)
  });
  return allowed;
}

async function nyxCustomHostnameAllowed(hostname) {
  const normalized = normalizeNyxCustomHostname(hostname);
  if (!normalized) return false;
  const configuredHostnames = [...embeddedWispAllowedOrigins, process.env.NYX_PUBLIC_ORIGIN]
    .map(value => normalizeNyxCustomHostname(value))
    .filter(Boolean);
  if (configuredHostnames.includes(normalized)) return true;
  const cached = nyxCustomHostnameAskCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.allowed;
  if (cached) nyxCustomHostnameAskCache.delete(normalized);

  const existingCheck = nyxCustomHostnameAskInFlight.get(normalized);
  if (existingCheck) return existingCheck;

  const check = (async () => {
    if (firebaseAdminModeConfigured()) {
      const firebase = await linkGeneratorFirebase();
      const snapshot = await firebase.firestore
        .collection(nyxCustomHostnameCollectionName)
        .doc(nyxCustomHostnameDocumentId(normalized))
        .get();
      const data = snapshot.data() || {};
      if (snapshot.exists && normalizeNyxCustomHostname(data.hostname) === normalized) {
        return cacheNyxCustomHostnameDecision(normalized, data.status !== "disabled");
      }
    }

    const targetIps = nyxCustomHostnameTargetIps();
    if (!targetIps.length) return cacheNyxCustomHostnameDecision(normalized, false);
    const resolvedIps = await nyxCustomHostnameResolvedIps(normalized);
    return cacheNyxCustomHostnameDecision(normalized, resolvedIps.some(ip => targetIps.includes(ip)));
  })();
  nyxCustomHostnameAskInFlight.set(normalized, check);
  try {
    return await check;
  } finally {
    if (nyxCustomHostnameAskInFlight.get(normalized) === check) nyxCustomHostnameAskInFlight.delete(normalized);
  }
}

function nyxIpBanRecord(id, data = {}) {
  const ip = normalizeNyxIp(data.ip);
  if (!ip) return null;
  return {
    id: String(id || ""),
    ip,
    reason: String(data.reason || "").trim().slice(0, 160),
    createdAt: safeDateIso(data.createdAt),
    createdBy: String(data.createdBy || "").slice(0, 254)
  };
}

function refreshNyxIpBans(firebase, force = false) {
  const now = Date.now();
  if (!force && (nyxIpBanCache.expiresAt > now || nyxIpBanCache.retryAt > now)) return nyxIpBanCache.promise;
  if (nyxIpBanCache.promise) return nyxIpBanCache.promise;
  const refresh = (async () => {
    try {
      const snapshot = await firebase.firestore.collection(nyxIpBanCollectionName).limit(nyxIpBanListLimit).get();
      const bans = new Map();
      snapshot.docs.forEach(document => {
        const ban = nyxIpBanRecord(document.id, document.data());
        if (ban) bans.set(ban.ip, ban);
      });
      nyxIpBanCache = {
        expiresAt: Date.now() + nyxIpBanCacheTtlMs,
        retryAt: 0,
        bans,
        promise: null,
        loaded: true
      };
      return bans;
    } catch (error) {
      nyxIpBanCache = {
        ...nyxIpBanCache,
        expiresAt: 0,
        retryAt: Date.now() + nyxIpBanRetryDelayMs,
        promise: null
      };
      console.warn("Nyx IP ban refresh paused; using the last known list:", error?.message || error);
      return nyxIpBanCache.bans;
    }
  })();
  nyxIpBanCache.promise = refresh;
  return refresh;
}

async function nyxIpBans(firebase, { wait = false, force = false } = {}) {
  const now = Date.now();
  if (!force && nyxIpBanCache.expiresAt > now) return nyxIpBanCache.bans;
  const refresh = refreshNyxIpBans(firebase, force);
  if (wait && refresh) return refresh;
  return nyxIpBanCache.bans;
}

function queueNyxIpBanRefresh() {
  const now = Date.now();
  if (!firebaseAdminModeConfigured() || nyxIpBanCache.expiresAt > now || nyxIpBanCache.retryAt > now || nyxIpBanCache.promise || nyxIpBanBootstrapPromise) return;
  nyxIpBanBootstrapPromise = Promise.resolve()
    .then(() => linkGeneratorFirebase())
    .then(firebase => firebase ? refreshNyxIpBans(firebase) : nyxIpBanCache.bans)
    .catch(error => {
      nyxIpBanCache = { ...nyxIpBanCache, expiresAt: 0, retryAt: Date.now() + nyxIpBanRetryDelayMs, promise: null };
      console.warn("Nyx IP ban initialization paused; using the last known list:", error?.message || error);
      return nyxIpBanCache.bans;
    })
    .finally(() => {
      nyxIpBanBootstrapPromise = null;
    });
}

function cacheNyxIpBan(ban) {
  if (!ban?.ip) return;
  const bans = new Map(nyxIpBanCache.bans);
  bans.set(ban.ip, ban);
  nyxIpBanCache = { ...nyxIpBanCache, bans, expiresAt: Date.now() + nyxIpBanCacheTtlMs, retryAt: 0, loaded: true };
}

function removeCachedNyxIpBan(ban) {
  if (!ban?.ip) return;
  const bans = new Map(nyxIpBanCache.bans);
  bans.delete(ban.ip);
  nyxIpBanCache = { ...nyxIpBanCache, bans, expiresAt: Date.now() + nyxIpBanCacheTtlMs, retryAt: 0, loaded: true };
}

function nyxRequestIpIsBanned(req) {
  if (!firebaseAdminModeConfigured()) return false;
  const ip = nyxClientIp(req);
  if (!ip) return false;
  queueNyxIpBanRefresh();
  return nyxIpBanCache.bans.has(ip);
}

async function nyxIpBanGuard(req, res, next) {
  try {
    if (!(await nyxRequestIpIsBanned(req))) {
      next();
      return;
    }
    res.set("Cache-Control", "no-store");
    if (req.path.startsWith("/api/")) {
      res.status(403).json({ error: "This network has been blocked from Nyx." });
      return;
    }
    res.status(403).type("html").send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nyx access blocked</title><style>html,body{margin:0;min-height:100%;display:grid;place-items:center;background:#0b101a;color:#f5f7fb;font:16px/1.5 system-ui,sans-serif}main{max-width:440px;padding:32px;text-align:center}h1{margin:0 0 10px;font-size:24px}p{margin:0;color:#b7c1d1}</style><main><h1>Access blocked</h1><p>This network has been blocked from Nyx.</p></main>`);
  } catch (error) {
    console.warn("Nyx IP ban guard used its fail-open path:", error?.message || error);
    next();
  }
}

app.use(nyxIpBanGuard);
const uvHandlerPath = join(uvPath, "uv.handler.js");
const uvBundlePath = join(uvPath, "uv.bundle.js");
const baremuxIndexPath = join(baremuxPath, "index.mjs");
const scramjetRuntimePath = join(scramjetPath, "scramjet.js");

app.use((req, res, next) => {
  const noStorePaths = new Set([
    "/",
    "/index.html",
    "/app.webmanifest",
    "/script.js",
    "/startup.js",
    "/styles.css",
    "/uv.sw.js",
    "/uv.config.js",
    "/uv/uv.bundle.js",
    "/uv/uv.client.js",
    "/scramjet.sw.js",
    "/uv/uv.handler.js",
    "/baremux/index.mjs",
    "/scramjet/scramjet.js",
    "/nyx-scramjet-runtime-guard.js"
  ]);
  const noStorePrefix = /^\/(?:assets\/(?:gms-games|reds-misc)\/|gms-games-|reds-misc-)/i.test(req.path);
  if (noStorePaths.has(req.path) || noStorePrefix) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function gameTitleKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(?:online|unblocked|play|game)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 100);
}

function gameCoverResultScore(page, titleKey) {
  if (!page?.thumbnail?.source) return -Infinity;
  const pageKey = gameTitleKey(page.title);
  const description = String(page.terms?.description?.[0] || "").toLowerCase();
  const isExactTitle = pageKey === titleKey;
  const isGameArticle = /video game|browser game|arcade game|platform game|puzzle game|sports game|racing game/.test(description);
  if (!isExactTitle && !isGameArticle) return -Infinity;
  let score = 0;
  if (isExactTitle) score += 100;
  else if (pageKey.includes(titleKey) || titleKey.includes(pageKey)) score += 55;
  if (isGameArticle) score += 45;
  if (/film|album|song|novel|television|company|person/.test(description)) score -= 60;
  return score;
}

async function findOnlineGameCover(title) {
  const cleanTitle = String(title || "").replace(/\s+/g, " ").trim().slice(0, 90);
  const titleKey = gameTitleKey(cleanTitle);
  if (!cleanTitle || !titleKey) return "";
  if (gameCoverLookupCache.has(titleKey)) return gameCoverLookupCache.get(titleKey);
  const lookup = (async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      generator: "search",
      gsrsearch: `${cleanTitle} video game`,
      gsrnamespace: "0",
      gsrlimit: "6",
      prop: "pageimages|pageterms",
      piprop: "thumbnail",
      pithumbsize: "512",
      pilimit: "6",
      wbptterms: "description",
      redirects: "1"
    });
    const response = await fetch(`https://en.wikipedia.org/w/api.php?${params}`, {
      headers: {
        "accept": "application/json",
        "user-agent": "nyx-local-game-library/1.0"
      },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) return "";
    const payload = await response.json();
    const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
    const match = pages
      .map(page => ({ page, score: gameCoverResultScore(page, titleKey) }))
      .filter(result => result.score >= 40)
      .sort((a, b) => b.score - a.score)[0]?.page;
    const source = String(match?.thumbnail?.source || "");
    try {
      const imageUrl = new URL(source);
      return imageUrl.protocol === "https:" && imageUrl.hostname === "upload.wikimedia.org" ? imageUrl.href : "";
    } catch {
      return "";
    }
  })().catch(() => "");
  gameCoverLookupCache.set(titleKey, lookup);
  return lookup;
}

app.get("/game-cover", async (req, res) => {
  const title = String(req.query.title || "");
  if (!title.trim() || title.length > 100) {
    res.status(400).type("text/plain").send("Invalid game title");
    return;
  }
  const cover = await findOnlineGameCover(title);
  if (!cover) {
    res.status(404).type("text/plain").send("No online cover found");
    return;
  }
  try {
    await sendCatalogCover(res, cover);
  } catch (error) {
    res.status(502).type("text/plain").send(`Online cover network error: ${error?.message || error}`);
  }
});

const duckMathGameHosts = new Set([
  "classroomlesson.github.io",
  "db2.duckmath.org",
  "mathlete.pages.dev",
  "turbowarp.org",
  "noclip.website",
  "dives05.github.io"
]);

function safeDuckMathGameUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || !duckMathGameHosts.has(url.hostname)) return "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return "";
  }
}

async function loadDuckMathGames() {
  const now = Date.now();
  if (duckMathGamesCache.games.length && duckMathGamesCache.expires > now) {
    return duckMathGamesCache.games;
  }
  if (duckMathGamesCache.promise) return duckMathGamesCache.promise;

  duckMathGamesCache.promise = (async () => {
    const page = await fetchText("https://duckmath.org/");
    const bundlePath = page.match(/<script[^>]+src=["']([^"']*\/assets\/index-[^"']+\.js)["']/i)?.[1];
    if (!bundlePath) throw new Error("DuckMath game bundle was not found");
    const bundleUrl = new URL(bundlePath, "https://duckmath.org/").href;
    const bundle = await fetchText(bundleUrl, { accept: "text/javascript,*/*;q=0.8" });
    const games = [];
    const seen = new Set();
    const entryPattern = /\{link:"([^"]+)"[\s\S]{0,900}?title:"([^"]+)"/g;
    let match;
    while ((match = entryPattern.exec(bundle))) {
      const url = safeDuckMathGameUrl(match[1]);
      const title = String(match[2] || "").replace(/\\(["'\\/bfnrt])/g, "$1").trim();
      const key = `${title.toLowerCase()}\n${url}`;
      if (!url || !title || seen.has(key)) continue;
      seen.add(key);
      games.push({ title, url });
    }
    if (games.length < 50) throw new Error("DuckMath returned an incomplete game list");
    duckMathGamesCache = {
      games,
      expires: Date.now() + 60 * 60 * 1000,
      promise: null
    };
    return games;
  })();

  try {
    return await duckMathGamesCache.promise;
  } finally {
    duckMathGamesCache.promise = null;
  }
}

app.get("/duckmath-games", async (_req, res) => {
  try {
    const games = await loadDuckMathGames();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ games });
  } catch (error) {
    res.status(502).json({ error: `DuckMath list network error: ${error?.message || error}` });
  }
});

const catClassCatalogEndpoints = Object.freeze([
  { id: "catclass", url: "https://catclass.net/json/g.json" },
  { id: "selenite", url: "https://catclass.net/api/g4m3-sources/selenite" },
  { id: "velara", url: "https://catclass.net/api/g4m3-sources/velara" },
  { id: "edurocks", url: "https://catclass.net/api/g4m3-sources/edurocks" },
  { id: "truffled", url: "https://catclass.net/api/g4m3-sources/truffled" }
]);
const catalogCoverHosts = new Set([
  "catclass.net",
  "school.catclass.xyz",
  "selenite.cc",
  "velara.cc",
  "truffled.lol",
  "edunet.climaref.cl",
  "hub16x.netlify.app",
  "rivegames.com",
  "iogames.party",
  "1v1lolreloaded.com",
  "ubgwtf.gitlab.io",
  "upload.wikimedia.org"
]);
const catalogCoverTypes = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const catalogCoverByteLimit = 5 * 1024 * 1024;

function safeCatalogCoverUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
    if (!catalogCoverHosts.has(url.hostname) || url.href.length > 2_000) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function catalogCoverFallback(value) {
  const url = safeCatalogCoverUrl(value);
  return url ? `/catalog-game-cover?url=${encodeURIComponent(url.href)}` : "";
}

async function sendCatalogCover(res, initialUrl) {
  let url = safeCatalogCoverUrl(initialUrl);
  if (!url) {
    res.status(400).type("text/plain").send("Invalid catalog cover URL");
    return;
  }
  for (let redirects = 0; redirects <= 2; redirects += 1) {
    const upstream = await fetch(url, {
      redirect: "manual",
      headers: { "accept": "image/avif,image/webp,image/png,image/jpeg,image/gif", "user-agent": "nyx/1.0" },
      signal: AbortSignal.timeout(10_000)
    });
    if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get("location")) {
      url = safeCatalogCoverUrl(new URL(upstream.headers.get("location"), url).href);
      if (!url) {
        res.status(502).type("text/plain").send("Catalog cover redirected outside its approved source");
        return;
      }
      continue;
    }
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`Catalog cover returned ${upstream.status}`);
      return;
    }
    const contentType = String(upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (!catalogCoverTypes.has(contentType) || (contentLength && contentLength > catalogCoverByteLimit)) {
      res.status(415).type("text/plain").send("Catalog cover did not return a supported image");
      return;
    }
    const chunks = [];
    let totalBytes = 0;
    const reader = upstream.body?.getReader?.();
    if (!reader) {
      res.status(502).type("text/plain").send("Catalog cover returned no image body");
      return;
    }
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > catalogCoverByteLimit) {
        await reader.cancel();
        res.status(413).type("text/plain").send("Catalog cover is too large");
        return;
      }
      chunks.push(Buffer.from(value));
    }
    const body = Buffer.concat(chunks, totalBytes);
    if (!body.length) {
      res.status(413).type("text/plain").send("Catalog cover is too large");
      return;
    }
    res.set({
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Type": contentType,
      "Content-Length": String(body.length),
      "X-Content-Type-Options": "nosniff"
    });
    res.send(body);
    return;
  }
  res.status(502).type("text/plain").send("Catalog cover redirected too many times");
}

function safeCatalogUrl(value, base) {
  try {
    const url = new URL(String(value || "").trim(), base);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function excludedExternalGame(title, url, cover) {
  const identity = [title, url, cover]
    .map(value => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, ""))
    .join(" ");
  return identity.includes("amirrorscursesfw")
    || identity.includes("amatyamirrorscurse");
}

function catClassCatalogItems(source, payload) {
  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.games) ? payload.games : [];
  return items.flatMap(item => {
    let title = "";
    let url = "";
    let cover = "";

    if (source === "catclass") {
      title = item?.name;
      url = safeCatalogUrl(item?.url, "https://catclass.net/");
      cover = safeCatalogUrl(item?.img, "https://catclass.net/");
    } else if (source === "selenite") {
      const directory = String(item?.directory || "").replace(/^\/+/, "");
      const image = String(item?.image || "").replace(/^\/+/, "");
      title = item?.name;
      url = directory ? safeCatalogUrl(directory, "https://selenite.cc/resources/semag/") : "";
      cover = directory && image
        ? safeCatalogUrl(`${directory}/${image}`, "https://selenite.cc/resources/semag/")
        : "";
    } else if (source === "velara") {
      title = item?.title;
      if (!title || title === "!!DMCA" || title === "!!G4m3 Request" || title.includes("[!]") || String(item?.location || "").includes("astra")) return [];
      url = safeCatalogUrl(item?.location, "https://velara.cc/");
      cover = safeCatalogUrl(item?.image, "https://velara.cc/");
    } else if (source === "edurocks") {
      title = item?.name;
      if (String(title || "").includes("[!]")) return [];
      url = safeCatalogUrl(String(item?.url || "").replace(/^\.\//, ""), "https://edunet.climaref.cl/");
      cover = safeCatalogUrl(String(item?.img || "").replace(/^\.\//, ""), "https://edunet.climaref.cl/");
    } else if (source === "truffled") {
      title = item?.name;
      url = safeCatalogUrl(item?.url, "https://truffled.lol/");
      cover = safeCatalogUrl(item?.thumbnail, "https://truffled.lol/");
    }

    title = String(title || "").replace(/\s+/g, " ").trim().slice(0, 120);
    return title && url && !excludedExternalGame(title, url, cover)
      ? [{ title, url, cover, coverFallback: catalogCoverFallback(cover), provider: source }]
      : [];
  });
}

async function loadCatClassGames() {
  const now = Date.now();
  if (catClassGamesCache.games.length && catClassGamesCache.expires > now) return catClassGamesCache.games;
  if (catClassGamesCache.promise) return catClassGamesCache.promise;

  catClassGamesCache.promise = (async () => {
    const results = await Promise.allSettled(catClassCatalogEndpoints.map(async source => {
      const response = await fetch(source.url, {
        headers: { "accept": "application/json", "user-agent": "nyx/1.0" },
        signal: AbortSignal.timeout(12_000)
      });
      if (!response.ok) throw new Error(`${source.id} returned ${response.status}`);
      return catClassCatalogItems(source.id, await response.json());
    }));
    const games = [];
    const seen = new Set();
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      for (const game of result.value) {
        const key = `${game.title.toLowerCase()}\n${game.url}`;
        if (seen.has(key)) continue;
        seen.add(key);
        games.push(game);
      }
    }
    if (!games.length) throw new Error("No CatClass catalog source was available");
    catClassCoverUrls = new Set(games.map(game => safeCatalogCoverUrl(game.cover)?.href).filter(Boolean));
    catClassGamesCache = { games, expires: Date.now() + 30 * 60 * 1000, promise: null };
    return games;
  })();

  try {
    return await catClassGamesCache.promise;
  } finally {
    catClassGamesCache.promise = null;
  }
}

app.get("/catclass-games", async (_req, res) => {
  try {
    const games = await loadCatClassGames();
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ games });
  } catch (error) {
    res.status(502).json({ error: `CatClass list network error: ${error?.message || error}` });
  }
});

app.get("/catalog-game-cover", async (req, res) => {
  try {
    const url = safeCatalogCoverUrl(req.query.url);
    if (!url) {
      res.status(400).type("text/plain").send("Invalid catalog cover URL");
      return;
    }
    await loadCatClassGames();
    if (!catClassCoverUrls.has(url.href)) {
      res.status(404).type("text/plain").send("Catalog cover is not in the current game library");
      return;
    }
    await sendCatalogCover(res, url);
  } catch (error) {
    res.status(502).type("text/plain").send(`Catalog cover network error: ${error?.message || error}`);
  }
});

function patchedUvHandler() {
  const source = readFileSync(uvHandlerPath, "utf8");
  const original = "t.respondWith(h?l(t.target,[t.data.message,t.data.transfer],t.that):l(t.target,[t.data.message,t.data.origin,t.data.transfer],t.that))";
  const patched = `(()=>{let n=t.data.transfer||[];try{const o=new Set(n);const i=new Set;const a=e=>{if(!e||typeof e!="object"||i.has(e))return;i.add(e);let t="";try{t=Object.prototype.toString.call(e)}catch{}if(typeof MessagePort!="undefined"&&e instanceof MessagePort||t==="[object MessagePort]"){o.add(e);return}if(Array.isArray(e)){for(const t of e)a(t);return}for(const t of Object.values(e))a(t)};a(t.data.message);n=[...o]}catch{}return t.respondWith(h?l(t.target,[t.data.message,n],t.that):l(t.target,[t.data.message,t.data.origin,n],t.that))})()`;
  return source.includes(original) ? source.replace(original, patched) : source;
}

function patchedBareMuxIndex() {
  return readFileSync(baremuxIndexPath, "utf8")
    .replace(
      'const e=(await self.clients.matchAll({type:"window",includeUncontrolled:!0})).map',
      'const e=(await self.clients.matchAll({type:"window",includeUncontrolled:!0})).filter((e=>{try{const t=new URL(e.url);return t.origin===self.location.origin&&!t.pathname.startsWith("/service/")&&!t.pathname.startsWith("/~/sj/")}catch{return!1}})).map'
    )
    .replace(/setTimeout\(([^,]+),1e3,new TypeError\("timeout"\)\)/g, 'setTimeout($1,5000,new TypeError("timeout"))')
    .replace(/within 1s/g, "within 5s");
}

function patchedUvBundle() {
  const source = readFileSync(uvBundlePath, "utf8");
  const original = "rewriteImport(t,r,n=this.meta){return this.rewriteUrl(t,{...n,base:r})}";
  const patched = "rewriteImport(t,r,n=this.meta){return this.rewriteUrl(r,{...n,base:t})}";
  if (!source.includes(original)) throw new Error("Ultraviolet dynamic import signature changed");
  return source.replace(original, patched);
}

function patchedScramjetRuntime() {
  const source = readFileSync(scramjetRuntimePath, "utf8");
  const original = 'if(u.origin===new i.xP(e.rawUrl).origin)throw new i.$D("attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting");';
  const patched = 'if(u.origin===new i.xP(e.rawUrl).origin&&u.pathname.startsWith(t.context.prefix.pathname))u=new i.xP((0,n.v2)(u,t.context));else if(u.origin===new i.xP(e.rawUrl).origin)throw new i.$D("attempted to fetch from same origin - this means the site has obtained a reference to the real origin, aborting");';
  return source.includes(original) ? source.replace(original, patched) : source;
}

function scramjetRuntimeGuard() {
  return `(() => {
  if (typeof window === "undefined" || window.__nyxScramjetGuards) return;
  window.__nyxScramjetGuards = true;
  const nativeOpen = window.open?.bind(window);
  if (!window.trustedTypes) {
    try {
      Object.defineProperty(window, "trustedTypes", {
        configurable: true,
        value: {
          createPolicy(_name, rules = {}) {
            return {
              createHTML(value) {
                return typeof rules.createHTML === "function" ? rules.createHTML(value) : value;
              },
              createScript(value) {
                return typeof rules.createScript === "function" ? rules.createScript(value) : value;
              },
              createScriptURL(value) {
                return typeof rules.createScriptURL === "function" ? rules.createScriptURL(value) : value;
              }
            };
          }
        }
      });
    } catch {}
  }
  try {
    const nativeCurrentScript = Object.getOwnPropertyDescriptor(Document.prototype, "currentScript");
    const fallbackScript = document.createElement("script");
    fallbackScript.setAttribute("nonce", "");
    Object.defineProperty(Document.prototype, "currentScript", {
      configurable: true,
      get() {
        let current = null;
        try {
          current = nativeCurrentScript?.get?.call(this) || null;
        } catch {}
        if (current) return current;
        return this.querySelector?.("script[src],script") || fallbackScript;
      }
    });
  } catch {}
  try {
    if (!window.__nyxRuntimeShortcuts) {
      window.__nyxRuntimeShortcuts = true;
      const isEditingTarget = target => !!(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName || "")));
      const selectedTextFromTarget = target => {
        try {
          if (/^(INPUT|TEXTAREA)$/i.test(target?.tagName || "")) return String(target.value || "").slice(target.selectionStart || 0, target.selectionEnd || 0);
          return String(getSelection?.() || "");
        } catch {
          return "";
        }
      };
      const replaceSelectionInTarget = (target, text) => {
        try {
          if (/^(INPUT|TEXTAREA)$/i.test(target?.tagName || "")) {
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const value = String(target.value || "");
            target.value = value.slice(0, start) + text + value.slice(end);
            const cursor = start + String(text).length;
            target.setSelectionRange(cursor, cursor);
            target.dispatchEvent(new Event("input", { bubbles: true }));
            return;
          }
          document.execCommand?.("insertText", false, text);
        } catch {}
      };
      const writeClipboard = async text => {
        try {
          await navigator.clipboard?.writeText(String(text || ""));
        } catch {
          try { document.execCommand?.("copy"); } catch {}
        }
      };
      const shortcutParent = (() => { try { return window.parent; } catch { return null; } })();
      const shortcutTop = (() => { try { return window.top; } catch { return null; } })();
      const postAltShortcut = payload => {
        try { shortcutParent?.postMessage(payload, "*"); } catch {}
        try {
          if (shortcutTop && shortcutTop !== shortcutParent) shortcutTop.postMessage(payload, "*");
        } catch {}
        try { window.parent?.postMessage(payload, "*"); } catch {}
        try {
          if (window.top && window.top !== window.parent) window.top.postMessage(payload, "*");
        } catch {}
      };
      window.addEventListener("keydown", event => {
        const key = String(event.key || "").toLowerCase();
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && key === "alt") {
          event.preventDefault();
          event.stopPropagation();
          postAltShortcut({ type: "nyx:alt-prime" });
          return;
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && isEditingTarget(event.target) && /^[acxvzy]$/.test(key)) {
          event.preventDefault();
          event.stopPropagation();
          if (key === "a") {
            if (event.target?.select) event.target.select();
            else document.execCommand?.("selectAll");
            return;
          }
          if (key === "c") {
            writeClipboard(selectedTextFromTarget(event.target));
            return;
          }
          if (key === "x") {
            const selected = selectedTextFromTarget(event.target);
            writeClipboard(selected);
            replaceSelectionInTarget(event.target, "");
            return;
          }
          if (key === "v") {
            navigator.clipboard?.readText?.().then(text => replaceSelectionInTarget(event.target, text)).catch(() => {
              try { document.execCommand?.("paste"); } catch {}
            });
            return;
          }
          if (key === "z") {
            document.execCommand?.("undo");
            return;
          }
          if (key === "y") {
            document.execCommand?.("redo");
            return;
          }
        }
        if (event.altKey && !event.ctrlKey && !event.metaKey && event.location !== 2 && (/^[1-9]$/.test(key) || ["l", "d", "t", "w", "r", "arrowleft", "arrowright", "tab"].includes(key))) {
          event.preventDefault();
          event.stopPropagation();
          postAltShortcut({ type: "nyx:alt-shortcut", key, code: event.code || "", location: event.location || 0, shiftKey: !!event.shiftKey });
          return;
        }
      }, true);
    }
  } catch {}
  const blockedHtml = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>nyx://blocked67haha</title><style>html,body{margin:0;width:100%;height:100%;background:#fff;color:#111;font:28px Raleway,Arial,sans-serif}body{display:grid;place-items:center;text-align:center}main{padding:24px}</style></head><body><main>are you trying to hack me scamma???</main></body></html>';
  const popupProtectionEnabled = () => {
    try {
      return JSON.parse(localStorage.getItem("nyx.popupProtection") ?? "true") !== false;
    } catch {
      return true;
    }
  };
  const writeBlocked = popup => {
    if (!popup) return false;
    try {
      popup.document.open();
      popup.document.write(blockedHtml);
      popup.document.close();
      popup.focus?.();
      return true;
    } catch {
      return false;
    }
  };
  const opennyxPopupWarning = () => {
    // Popup protection must never create a real popup just to display a
    // warning. Return a browser-like inert handle to the calling site.
    const popup = null;
    return {
      closed: false,
      focus() { try { popup?.focus?.(); } catch {} },
      blur() { try { popup?.blur?.(); } catch {} },
      close() { try { popup?.close?.(); } catch {} this.closed = true; },
      postMessage() {},
      document: {
        open() { writeBlocked(popup); return this; },
        write() { writeBlocked(popup); },
        writeln() { writeBlocked(popup); },
        close() { writeBlocked(popup); }
      },
      location: {
        href: "nyx://blocked67haha",
        assign() { opennyxPopupWarning(); },
        replace() { opennyxPopupWarning(); },
        reload() { writeBlocked(popup); },
        toString() { return "nyx://blocked67haha"; }
      }
    };
  };
  const isDownloadUrl = value => {
    const rawHref = String(value || "").trim();
    // Blob/data URLs and script-like paths are also used by verification
    // challenges, workers, and client-side navigation. Treating them as
    // downloads breaks those flows before they can complete. Explicit
    // Explicit download links are still handled by isDownloadLink below.
    if (/^(?:blob|data):/i.test(rawHref)) return false;
    const href = rawHref.split(/[?#]/)[0].toLowerCase();
    return /\.(?:apk|appx|bat|bin|cmd|com|crx|deb|dmg|exe|iso|jar|msi|pkg|scr|wsf|zip|7z|rar)$/i.test(href);
  };
  const postDownloadRequest = (value, filename = "") => {
    const href = String(value || "").trim();
    if (!href || !window.parent || window.parent === window) return false;
    try {
      window.parent.postMessage({
        type: "nyx:download-request",
        url: href,
        filename: String(filename || ""),
        sourceUrl: String(location.href || "")
      }, "*");
      return true;
    } catch {
      return false;
    }
  };
  let guardedOpen = (...args) => {
    if (isDownloadUrl(args[0]) && postDownloadRequest(args[0])) return null;
    if (!popupProtectionEnabled() && nativeOpen) return nativeOpen(...args);
    return opennyxPopupWarning();
  };
  try {
    if (typeof nativeOpen === "function" && typeof Proxy === "function") {
      guardedOpen = new Proxy(nativeOpen, {
        apply(target, thisArg, args) {
          if (isDownloadUrl(args[0]) && postDownloadRequest(args[0])) return null;
          if (!popupProtectionEnabled()) return Reflect.apply(target, thisArg, args);
          return opennyxPopupWarning();
        },
        construct(target, args, newTarget) {
          if (!popupProtectionEnabled()) {
            try {
              return Reflect.construct(target, args, newTarget);
            } catch {
              return Reflect.apply(target, window, args);
            }
          }
          return opennyxPopupWarning();
        },
        get(target, prop, receiver) {
          if (prop === "__nyxPopupGuard") return true;
          if (prop === "toString") return () => "function open() { [native code] }";
          return Reflect.get(target, prop, receiver);
        }
      });
    }
  } catch {}
  const shouldTrapPopupTarget = target => {
    const value = String(target || "").toLowerCase();
    return value && !["_self", "_parent", "_top"].includes(value);
  };
  const isDownloadLink = link => {
    if (!link) return false;
    if (link.hasAttribute("download")) return true;
    return isDownloadUrl(link.href || link.getAttribute("href") || "");
  };
  try {
    Object.defineProperty(window, "open", { value: guardedOpen, writable: true, configurable: true });
  } catch {
    window.open = guardedOpen;
  }
  try {
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (isDownloadLink(this) && postDownloadRequest(this.href || this.getAttribute("href"), this.getAttribute("download") || "")) return;
      if (popupProtectionEnabled() && shouldTrapPopupTarget(this.target)) {
        opennyxPopupWarning();
        return;
      }
      return nativeAnchorClick.call(this);
    };
  } catch {}
  if (document && !window.__nyxPopupWarningListeners) {
    window.__nyxPopupWarningListeners = true;
    document.addEventListener("click", event => {
      const link = event.target?.closest?.("a[href]");
      if (!link) return;
      if (isDownloadLink(link) && postDownloadRequest(link.href || link.getAttribute("href"), link.getAttribute("download") || "")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!popupProtectionEnabled() || !shouldTrapPopupTarget(link.getAttribute("target"))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
    document.addEventListener("auxclick", event => {
      const link = event.target?.closest?.("a[href]");
      if (!link) return;
      if (isDownloadLink(link) && postDownloadRequest(link.href || link.getAttribute("href"), link.getAttribute("download") || "")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (!popupProtectionEnabled() || !shouldTrapPopupTarget(link.getAttribute("target"))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
    document.addEventListener("submit", event => {
      if (!popupProtectionEnabled()) return;
      const form = event.target;
      if (!form || String(form.tagName || "").toUpperCase() !== "FORM" || !shouldTrapPopupTarget(form.getAttribute("target"))) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      opennyxPopupWarning();
    }, true);
  }
  const wrapCue = name => {
    const Native = window[name];
    if (typeof Native !== "function" || Native.__nyxWrapped) return;
    function SafeCue(start, end, text) {
      let safeStart = Number(start);
      let safeEnd = Number(end);
      if (!Number.isFinite(safeStart) || safeStart < 0) safeStart = 0;
      if (!Number.isFinite(safeEnd) || safeEnd <= safeStart) safeEnd = safeStart + 0.001;
      return Reflect.construct(Native, [safeStart, safeEnd, text == null ? "" : String(text)], new.target || SafeCue);
    }
    try {
      Object.setPrototypeOf(SafeCue, Native);
      SafeCue.prototype = Native.prototype;
      Object.defineProperty(SafeCue, "__nyxWrapped", { value: true });
      window[name] = SafeCue;
    } catch {}
  };
  wrapCue("VTTCue");
  wrapCue("TextTrackCue");
})();`;
}

function safeSeraphPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./-]+$/i.test(clean)) return "";
  if (/(^|\/)(?:404|408)\.html$/i.test(clean)) return "";
  return clean;
}

app.get("/seraph-fetch", async (req, res) => {
  const path = safeSeraphPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid Seraph path");
    return;
  }
  const upstreamUrl = `https://cdn.jsdelivr.net/gh/a456pur/seraph@main/games/${path}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`Seraph upstream returned ${upstream.status}`);
      return;
    }
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("html").send(await upstream.text());
  } catch (error) {
    res.status(502).type("text/plain").send(`Seraph network error: ${error?.message || error}`);
  }
});

function safeSeraphAssetPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./?&=%-]+$/i.test(clean)) return "";
  return clean;
}

function rewriteSeraphCss(css, assetPath) {
  const base = new URL(String(assetPath || ""), "https://seraph.local/");
  return String(css || "").replace(/url\(\s*(["']?)(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"')]+)\1\s*\)/gi, (match, quote, raw) => {
    try {
      const resolved = new URL(String(raw || "").trim(), base).pathname.replace(/^\/+/, "");
      return `url(${quote}/seraph-asset?path=${encodeURIComponent(resolved)}${quote})`;
    } catch {
      return match;
    }
  });
}

app.get("/seraph-asset", async (req, res) => {
  const path = safeSeraphAssetPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid Seraph asset path");
    return;
  }
  const upstreamUrl = `https://cdn.jsdelivr.net/gh/a456pur/seraph@main/${path}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        "accept": "*/*",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`Seraph asset returned ${upstream.status}`);
      return;
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(/text\/css/i.test(contentType || "") || /\.css(?:$|\?)/i.test(path) ? Buffer.from(rewriteSeraphCss(buffer.toString("utf8"), path)) : buffer);
  } catch (error) {
    res.status(502).type("text/plain").send(`Seraph asset network error: ${error?.message || error}`);
  }
});

const gnMathGamesCache = { timestamp: 0, games: [] };
const gnMathTitleCache = new Map();
const gnMathRepos = new Set(["html", "covers", "assets"]);

function safeGnMathPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (!clean || clean.includes("..") || !/^[a-z0-9_./?&=%-]+$/i.test(clean)) return "";
  return clean;
}

function safeGnMathHtmlPath(path) {
  const clean = safeGnMathPath(path);
  if (!clean || !/^[a-z0-9_.-]+\.html$/i.test(clean)) return "";
  return clean;
}

function gnMathCoverName(path) {
  const id = String(path || "").match(/^\d+/)?.[0];
  return id ? `${id}.png` : "";
}

function extractTitle(html, fallback) {
  const match = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match ? match[1].replace(/\s+/g, " ").trim() : "";
  return title || fallback;
}

async function fetchText(url, headers = {}) {
  const upstream = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "user-agent": "nyx/1.0",
      ...headers
    }
  });
  if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
  return upstream.text();
}

app.get("/gn-math-games", async (_req, res) => {
  const now = Date.now();
  if (gnMathGamesCache.games.length && now - gnMathGamesCache.timestamp < 10 * 60 * 1000) {
    res.json({ games: gnMathGamesCache.games });
    return;
  }
  try {
    const [htmlResponse, coverResponse] = await Promise.all([
      fetch("https://api.github.com/repos/gn-math/html/contents/", {
        headers: { "accept": "application/vnd.github+json", "user-agent": "nyx/1.0" }
      }),
      fetch("https://api.github.com/repos/gn-math/covers/contents/", {
        headers: { "accept": "application/vnd.github+json", "user-agent": "nyx/1.0" }
      })
    ]);
    if (!htmlResponse.ok) throw new Error(`HTML HTTP ${htmlResponse.status}`);
    if (!coverResponse.ok) throw new Error(`Covers HTTP ${coverResponse.status}`);
    const items = await htmlResponse.json();
    const covers = new Set((await coverResponse.json())
      .filter(item => item?.type === "file")
      .map(item => item.name));
    const games = (Array.isArray(items) ? items : [])
      .filter(item => item?.type === "file" && /\.html?$/i.test(item.name))
      .map(item => {
        const cover = gnMathCoverName(item.name);
        return {
          path: item.name,
          title: gnMathTitleCache.get(item.name) || "",
          cover: cover && covers.has(cover) ? `/gn-math-asset?repo=covers&path=${encodeURIComponent(cover)}` : ""
        };
      })
      .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
    gnMathGamesCache.timestamp = now;
    gnMathGamesCache.games = games;
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({ games });
  } catch (error) {
    res.status(502).json({ error: `GN Math list network error: ${error?.message || error}` });
  }
});

app.get("/gn-math-title", async (req, res) => {
  const path = safeGnMathHtmlPath(req.query.path);
  if (!path) {
    res.status(400).json({ error: "Invalid GN Math path" });
    return;
  }
  if (gnMathTitleCache.has(path)) {
    res.json({ title: gnMathTitleCache.get(path) });
    return;
  }
  try {
    const html = await fetchText(`https://raw.githubusercontent.com/gn-math/html/main/${path}`);
    const title = extractTitle(html, "");
    if (title) gnMathTitleCache.set(path, title);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.json({ title });
  } catch (error) {
    res.status(502).json({ error: `GN Math title network error: ${error?.message || error}` });
  }
});

app.get("/gn-math-fetch", async (req, res) => {
  const path = safeGnMathHtmlPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid GN Math path");
    return;
  }
  try {
    const html = await fetchText(`https://raw.githubusercontent.com/gn-math/html/main/${path}`);
    const title = extractTitle(html, "");
    if (title) gnMathTitleCache.set(path, title);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.type("html").send(html);
  } catch (error) {
    res.status(502).type("text/plain").send(`GN Math network error: ${error?.message || error}`);
  }
});

app.get("/gn-math-asset", async (req, res) => {
  const repo = String(req.query.repo || "");
  const path = safeGnMathPath(req.query.path);
  if (!gnMathRepos.has(repo) || !path) {
    res.status(400).type("text/plain").send("Invalid GN Math asset path");
    return;
  }
  try {
    const upstream = await fetch(`https://raw.githubusercontent.com/gn-math/${repo}/main/${path}`, {
      headers: {
        "accept": "*/*",
        "user-agent": "nyx/1.0"
      }
    });
    if (!upstream.ok) {
      res.status(upstream.status).type("text/plain").send(`GN Math asset returned ${upstream.status}`);
      return;
    }
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    res.status(502).type("text/plain").send(`GN Math asset network error: ${error?.message || error}`);
  }
});

const gnMathProxyHosts = new Set([
  "cdn.jsdelivr.net",
  "raw.githubusercontent.com",
  "rawcdn.githack.com",
  "raw.githack.com"
]);

function safeGnMathProxyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!gnMathProxyHosts.has(url.hostname)) return null;
    if (/(?:googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|pagead|cdn\.r9x\.in)/i.test(url.href)) return null;
    return url;
  } catch {
    return null;
  }
}

async function directProxyFetch(url) {
  let upstream;
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      upstream = await fetch(url, {
        headers: {
          "accept": "*/*",
          "user-agent": "nyx/1.0"
        }
      });
      if (upstream.ok || ![429, 500, 502, 503, 504].includes(upstream.status)) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 180 + attempt * 260));
  }
  if (!upstream && lastError) throw lastError;
  if (!upstream.ok) {
    const error = new Error(`HTTP ${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }
  const body = Buffer.from(await upstream.arrayBuffer());
  return {
    body,
    contentType: upstream.headers.get("content-type") || "application/octet-stream",
    cacheControl: "no-store"
  };
}

function isHtmlProxyPayload(url, result) {
  const pathname = String(url?.pathname || "").toLowerCase();
  const executable = /\.(?:js|mjs|cjs|json|wasm|data|unityweb|mem|symbols\.json)(?:$|[?#])/i.test(pathname);
  if (!executable) return false;
  const contentType = String(result?.contentType || "").toLowerCase();
  if (contentType.includes("text/html") || contentType.includes("application/xhtml")) return true;
  const start = result?.body?.subarray?.(0, 512)?.toString("utf8").replace(/^\uFEFF/, "").trimStart() || "";
  return /^(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(start);
}

function gnMathProxyCandidates(url) {
  const candidates = [url];
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "cdn.jsdelivr.net" && parts[0] === "gh" && parts.length >= 4) {
    const [owner, repoRef, ...resourcePath] = parts.slice(1);
    const separator = repoRef.lastIndexOf("@");
    if (separator > 0) {
      const repository = repoRef.slice(0, separator);
      const ref = repoRef.slice(separator + 1);
      candidates.push(new URL(`https://raw.githubusercontent.com/${owner}/${repository}/${ref}/${resourcePath.join("/")}`));
      candidates.push(new URL(`https://raw.githack.com/${owner}/${repository}/${ref}/${resourcePath.join("/")}`));
    }
  } else if (
    ["raw.githubusercontent.com", "raw.githack.com", "rawcdn.githack.com"].includes(url.hostname) &&
    parts.length >= 4
  ) {
    const [owner, repository, ref, ...resourcePath] = parts;
    candidates.push(new URL(`https://raw.githubusercontent.com/${owner}/${repository}/${ref}/${resourcePath.join("/")}`));
    candidates.push(new URL(`https://cdn.jsdelivr.net/gh/${owner}/${repository}@${ref}/${resourcePath.join("/")}`));
    candidates.push(new URL(`https://raw.githack.com/${owner}/${repository}/${ref}/${resourcePath.join("/")}`));
  }
  return candidates.filter((candidate, index, list) =>
    list.findIndex(item => item.href === candidate.href) === index
  );
}

function gnMathResourceContentType(url, upstreamType) {
  const pathname = String(url?.pathname || "").toLowerCase();
  if (/\.(?:js|mjs|cjs)$/.test(pathname)) return "application/javascript; charset=utf-8";
  if (/\.json$/.test(pathname)) return "application/json; charset=utf-8";
  if (/\.wasm$/.test(pathname)) return "application/wasm";
  if (/\.css$/.test(pathname)) return "text/css; charset=utf-8";
  return upstreamType;
}

function rewriteGnMathJsonAssets(url, result) {
  if (!/\.json$/i.test(url.pathname)) return result;
  try {
    const data = JSON.parse(result.body.toString("utf8"));
    const rewrite = value => {
      if (Array.isArray(value)) return value.map(rewrite);
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewrite(entry)]));
      }
      if (
        typeof value !== "string" ||
        !/\.(?:js|mjs|cjs|json|wasm|data|unityweb|mem|symbols\.json)(?:[?#].*)?$/i.test(value)
      ) return value;
      if (/^(?:data|blob|javascript|about):/i.test(value)) return value;
      const asset = new URL(value, url);
      return safeGnMathProxyUrl(asset)
        // Unity prepends the JSON file's directory to these values. Keeping
        // this relative avoids the double-slash path that an absolute value
        // would create (//gn-math-proxy), which Netlify treats as the SPA.
        ? `gn-math-proxy?url=${encodeURIComponent(asset.href)}`
        : value;
    };
    return {
      ...result,
      body: Buffer.from(JSON.stringify(rewrite(data))),
      contentType: "application/json; charset=utf-8"
    };
  } catch {
    return result;
  }
}

app.get("/gn-math-proxy", async (req, res) => {
  const url = safeGnMathProxyUrl(req.query.url);
  if (!url) {
    res.status(400).type("text/plain").send("Invalid GN Math proxy URL");
    return;
  }
  let lastError;
  for (const candidate of gnMathProxyCandidates(url)) {
    try {
      let result = await directProxyFetch(candidate);
      if (isHtmlProxyPayload(candidate, result)) {
        const error = new Error("upstream returned HTML for a game resource");
        error.status = 502;
        throw error;
      }
      result = rewriteGnMathJsonAssets(candidate, result);
      res.setHeader("Cache-Control", result.cacheControl);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.type(gnMathResourceContentType(candidate, result.contentType));
      res.send(result.body);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  res.status(lastError?.status || 502).type("text/plain").send(`GN Math proxy error: ${lastError?.message || lastError}`);
});

const redsMiscProxyHosts = new Set([
  "raw.githubusercontent.com",
  "cdn.jsdelivr.net",
  "rawcdn.githack.com",
  "raw.githack.com"
]);

function safeRedsMiscPath(path) {
  const clean = String(path || "").replace(/^\/+/, "");
  if (
    !/^misc\/[a-z0-9_.() -]+(?:\/[a-z0-9_.() -]+)*\.html?$/i.test(clean) ||
    clean.includes("..") ||
    clean.includes("\\")
  ) return "";
  return clean;
}

function safeRedsMiscProxyUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const isGithubPages = url.hostname === "github.io" || url.hostname.endsWith(".github.io");
    if (!redsMiscProxyHosts.has(url.hostname) && !isGithubPages) return null;
    if (url.hostname === "raw.githubusercontent.com") {
      const allowed = /^\/isaacduh123\/reds-exploit-corner\/main\//i.test(url.pathname);
      if (!allowed) return null;
    }
    if (/(?:googletagmanager|google-analytics|googlesyndication|doubleclick|facebook|recaptcha|pagead|cdn\.r9x\.in)/i.test(url.href)) return null;
    return url;
  } catch {
    return null;
  }
}

function rewriteGmsCssUrls(buffer, baseUrl) {
  const css = buffer.toString("utf8");
  return Buffer.from(css.replace(/url\(\s*(["']?)(?![a-z][a-z0-9+.-]*:|\/\/|#|data:|blob:)([^"')]+)\1\s*\)/gi, (_match, quote, raw) => {
    try {
      const next = new URL(String(raw || "").trim(), baseUrl).href;
      return `url(${quote}/gms-games-proxy?url=${encodeURIComponent(next)}${quote})`;
    } catch {
      return _match;
    }
  }), "utf8");
}

async function handleGmsGamesFetch(req, res) {
  const path = safeRedsMiscPath(req.query.path);
  if (!path) {
    res.status(400).type("text/plain").send("Invalid GMS path");
    return;
  }
  try {
    const url = new URL(`https://raw.githubusercontent.com/isaacduh123/reds-exploit-corner/main/${path}`);
    const result = await directProxyFetch(url);
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(result.body);
  } catch (error) {
    res.status(error?.status || 502).type("text/plain").send(`GMS network error: ${error?.message || error}`);
  }
}

async function handleGmsGamesProxy(req, res) {
  const url = safeRedsMiscProxyUrl(req.query.url);
  if (!url) {
    res.status(400).type("text/plain").send("Invalid GMS proxy URL");
    return;
  }
  try {
    const result = await directProxyFetch(url);
    const isCss = /text\/css/i.test(result.contentType) || /\.css(?:$|\?)/i.test(url.pathname);
    const body = isCss ? rewriteGmsCssUrls(result.body, url.href) : result.body;
    res.setHeader("Cache-Control", result.cacheControl);
    res.type(result.contentType);
    res.send(body);
  } catch (error) {
    res.status(error?.status || 502).type("text/plain").send(`GMS proxy error: ${error?.message || error}`);
  }
}

app.get("/gms-games-fetch", handleGmsGamesFetch);
app.get("/gms-games-proxy", handleGmsGamesProxy);
app.get("/reds-misc-fetch", handleGmsGamesFetch);
app.get("/reds-misc-proxy", handleGmsGamesProxy);

const nyxAiModels = {
  "chatgpt-5.4-mini": process.env.NYX_AI_MODEL_CHATGPT_54_MINI || "navy:gpt-5.4-mini"
};

const nyxAiFallbackCatalog = [
  ["llama-3.3-70b-versatile", "Llama 3.3 70B (Versatile)"],
  ["openai/gpt-oss-120b", "GPT-OSS 120B"],
  ["qwen/qwen3-32b", "Qwen3 32B"],
  ["meta-llama/llama-4-scout-17b-16e-instruct", "Llama 4 Scout (Vision)"],
  ["navy:gpt-5.4-mini", "ChatGPT 5.4 Mini"],
  ["navy:claude-opus-5", "Claude Opus 5"],
  ["navy:gpt-4o-mini-search-preview", "GPT-4o Mini Search (Preview)"],
  ["navy:gemini-3.1-pro-preview", "Gemini 3.1 Pro (Preview)"],
  ["navy:gemini-3.5-flash", "Gemini 3.5 Flash"],
  ["navy:grok-4.3", "Grok 4.3"],
  ["navy:grok-4.1-fast-reasoning", "Grok 4.1 Fast (Reasoning)"],
  ["navy:deepseek-v4-pro", "DeepSeek V4 Pro"],
  ["navy:llama-4-scout", "Llama 4 Scout"],
  ["navy:mistral-medium-latest", "Mistral Medium"],
  ["navy:kimi-k2.6", "Kimi K2.6"],
  ["navy:nemotron-3-super", "Nemotron 3 Super"],
  ["navy:mimo-v2.5-pro", "MiMo V2.5 Pro"],
  ["navy:c4ai-aya-expanse-32b", "Aya Expanse 32B"],
  ["navy:gpt-4o", "GPT-4o"],
  ["navy:kimi-k2.5", "Kimi K2.5"],
  ["navy:qwen3.5-397b-a17b", "Qwen3.5 397B A17B"],
  ["navy:hermes-4-405b", "Hermes 4 405B"],
  ["navy:mistral-medium-3.5", "Mistral Medium 3.5"]
].map(([id, label]) => ({ id, label }));

let nyxAiCatalogCache = { expiresAt: 0, models: nyxAiFallbackCatalog };

function nyxAiKey() {
  return process.env.NYX_AI_API_KEY || "";
}

function nyxAiEndpoint() {
  const explicitEndpoint = String(process.env.NYX_AI_ENDPOINT || "").trim();
  if (explicitEndpoint) return explicitEndpoint;
  const baseUrl = String(process.env.NYX_AI_BASE_URL || "https://vilen.sbs").trim().replace(/\/+$/, "");
  return /\/api\/ai$/i.test(baseUrl) ? baseUrl : `${baseUrl}/api/ai`;
}

function nyxAiCatalogEndpoint() {
  const explicitEndpoint = String(process.env.NYX_AI_MODELS_ENDPOINT || "").trim();
  if (explicitEndpoint) return explicitEndpoint;
  return `${nyxAiEndpoint().replace(/\/+$/, "")}/config`;
}

function nyxAiNormalizeCatalog(models) {
  if (!Array.isArray(models)) return [];
  const seen = new Set();
  return models.flatMap(item => {
    const id = String(item?.id || "").trim();
    if (!/^[a-z0-9][a-z0-9._:/-]{0,127}$/i.test(id) || seen.has(id) || (item?.audience && item.audience !== "all")) return [];
    seen.add(id);
    return [{
      id,
      label: String(item?.label || id).trim().slice(0, 100) || id,
      company: String(item?.company || "").trim().slice(0, 50),
      vision: Boolean(item?.vision),
      reasoning: Boolean(item?.reasoning)
    }];
  });
}

async function nyxAiAvailableModels() {
  const now = Date.now();
  if (nyxAiCatalogCache.expiresAt > now) return nyxAiCatalogCache.models;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetch(nyxAiCatalogEndpoint(), {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    const data = await response.json().catch(() => ({}));
    const models = response.ok ? nyxAiNormalizeCatalog(data?.models) : [];
    if (!models.length) throw new Error("The AI model catalog was empty.");
    nyxAiCatalogCache = { expiresAt: now + 300_000, models };
  } catch {
    nyxAiCatalogCache = { expiresAt: now + 60_000, models: nyxAiFallbackCatalog };
  } finally {
    clearTimeout(timeout);
  }
  return nyxAiCatalogCache.models;
}

async function nyxAiResolveModel(requestedModel) {
  const alias = nyxAiModels[requestedModel];
  if (alias) return alias;
  const models = await nyxAiAvailableModels();
  return models.some(item => item.id === requestedModel) ? requestedModel : "";
}

function nyxAiErrorMessage(data, status) {
  const error = data?.error;
  return String(
    (error && typeof error === "object" ? error.message : error)
    || data?.message
    || `Model request failed (${status}).`
  );
}

function nyxAiStreamText(data) {
  if (!data || typeof data !== "object") return "";
  if (data.type === "delta") return String(data.text || data.delta || "");
  return String(data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.text || "");
}

function nyxAiWriteStreamChunk(res, text, model) {
  if (!text) return;
  res.write(`data: ${JSON.stringify({
    id: "nyx-ai",
    object: "chat.completion.chunk",
    model,
    choices: [{ index: 0, delta: { content: String(text) }, finish_reason: null }]
  })}\n\n`);
}

const nyxAiUsage = new Map();
let nyxAiActiveRequests = 0;
const nyxAiLimit = (name, fallback) => {
  const value = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
const nyxAiLimits = {
  minute: nyxAiLimit("NYX_AI_REQUESTS_PER_MINUTE", 6),
  daily: nyxAiLimit("NYX_AI_REQUESTS_PER_DAY", 60),
  perIpConcurrent: nyxAiLimit("NYX_AI_CONCURRENT_PER_IP", 2),
  globalConcurrent: nyxAiLimit("NYX_AI_CONCURRENT_GLOBAL", 3),
  promptChars: nyxAiLimit("NYX_AI_MAX_PROMPT_CHARS", 4000),
  contextChars: nyxAiLimit("NYX_AI_MAX_CONTEXT_CHARS", 24000),
  timeoutMs: nyxAiLimit("NYX_AI_TIMEOUT_MS", 45000)
};

function nyxAiClientId(req) {
  const forwarded = process.env.NYX_TRUST_PROXY === "true"
    ? String(req.get("cf-connecting-ip") || req.get("x-forwarded-for") || "").split(",")[0].trim()
    : "";
  return forwarded || req.socket.remoteAddress || "unknown";
}

function nyxAiRateLimit(req, res, next) {
  const now = Date.now();
  const clientId = nyxAiClientId(req);
  const usage = nyxAiUsage.get(clientId) || { minute: [], day: [], active: 0, seen: now };
  usage.minute = usage.minute.filter(time => now - time < 60_000);
  usage.day = usage.day.filter(time => now - time < 86_400_000);
  usage.seen = now;
  nyxAiUsage.set(clientId, usage);
  res.setHeader("x-ratelimit-limit-minute", nyxAiLimits.minute);
  res.setHeader("x-ratelimit-remaining-minute", Math.max(0, nyxAiLimits.minute - usage.minute.length));
  res.setHeader("x-ratelimit-limit-day", nyxAiLimits.daily);
  res.setHeader("x-ratelimit-remaining-day", Math.max(0, nyxAiLimits.daily - usage.day.length));
  if (usage.minute.length >= nyxAiLimits.minute || usage.day.length >= nyxAiLimits.daily) {
    const retryAfter = usage.minute.length >= nyxAiLimits.minute
      ? Math.max(1, Math.ceil((60_000 - (now - usage.minute[0])) / 1000))
      : Math.max(1, Math.ceil((86_400_000 - (now - usage.day[0])) / 1000));
    res.setHeader("retry-after", retryAfter);
    res.status(429).json({ error: "Nyx AI usage limit reached. Please try again later." });
    return;
  }
  if (usage.active >= nyxAiLimits.perIpConcurrent || nyxAiActiveRequests >= nyxAiLimits.globalConcurrent) {
    res.setHeader("retry-after", "10");
    res.status(429).json({ error: "Nyx AI is busy. Please wait for another response to finish." });
    return;
  }
  usage.minute.push(now);
  usage.day.push(now);
  usage.active += 1;
  nyxAiActiveRequests += 1;
  let released = false;
  req.nyxAiRelease = () => {
    if (released) return;
    released = true;
    usage.active = Math.max(0, usage.active - 1);
    nyxAiActiveRequests = Math.max(0, nyxAiActiveRequests - 1);
  };
  res.once("close", req.nyxAiRelease);
  res.once("finish", req.nyxAiRelease);
  next();
}

setInterval(() => {
  const cutoff = Date.now() - 86_400_000;
  for (const [clientId, usage] of nyxAiUsage) {
    if (!usage.active && usage.seen < cutoff) nyxAiUsage.delete(clientId);
  }
}, 3_600_000).unref();

app.get("/api/nyx-ai/models", async (_req, res) => {
  const models = await nyxAiAvailableModels();
  const defaultProviderId = nyxAiModels["chatgpt-5.4-mini"];
  const exposedModels = models.map(item => item.id === defaultProviderId
    ? { ...item, id: "chatgpt-5.4-mini", providerId: item.id }
    : item);
  if (!exposedModels.some(item => item.id === "chatgpt-5.4-mini")) {
    exposedModels.unshift({
      id: "chatgpt-5.4-mini",
      providerId: defaultProviderId,
      label: "ChatGPT 5.4 Mini",
      company: "ChatGPT",
      vision: true,
      reasoning: true
    });
  }
  exposedModels.sort((left, right) => Number(right.id === "chatgpt-5.4-mini") - Number(left.id === "chatgpt-5.4-mini"));
  res.setHeader("cache-control", "public, max-age=60, stale-while-revalidate=240");
  res.json({ models: exposedModels });
});

app.post("/api/nyx-ai", nyxAiRateLimit, async (req, res) => {
  const key = nyxAiKey();
  if (!key) {
    res.status(503).json({
      error: "Nyx AI is not configured. Set NYX_AI_API_KEY in the server environment."
    });
    return;
  }
  const requestedModel = String(req.body?.model || "chatgpt-5.4-mini");
  const model = await nyxAiResolveModel(requestedModel);
  if (!model) {
    res.status(400).json({ error: "Unknown Nyx AI model." });
    return;
  }
  const message = String(req.body?.message || "").trim();
  const imageContext = String(req.body?.imageContext || "").trim();
  if (message.length > nyxAiLimits.promptChars) {
    res.status(413).json({ error: `Message is too long. The limit is ${nyxAiLimits.promptChars} characters.` });
    return;
  }
  const history = Array.isArray(req.body?.messages)
    ? req.body.messages.slice(-20).map(item => ({
        role: item?.role === "assistant" ? "assistant" : "user",
        content: String(item?.content || "").slice(0, 12000)
      })).filter(item => item.content.trim())
    : [];
  let contextChars = imageContext.length;
  for (const item of history) contextChars += item.content.length;
  if (contextChars > nyxAiLimits.contextChars) {
    res.status(413).json({ error: "This conversation is too long. Clear the chat and try again." });
    return;
  }
  if (!message && !imageContext && !history.length) {
    res.status(400).json({ error: "Message is required." });
    return;
  }
  const endpoint = nyxAiEndpoint();
  const prompt = imageContext ? `${message || "Answer the attached image."}\n\nImage context from Nyx OCR/analysis:\n${imageContext}` : message;
  const messages = history.length ? history : [{ role: "user", content: prompt }];
  if (history.length && imageContext) messages[messages.length - 1] = { role: "user", content: prompt };
  const wantsStream = req.body?.stream !== false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), nyxAiLimits.timeoutMs);
  res.once("close", () => controller.abort());
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        system: "You are Nyx AI inside the Nyx browser. Be helpful, direct, and accurate. If you do not know something, say so plainly.",
        messages,
        temperature: Number(process.env.NYX_AI_TEMPERATURE || 0.7),
        max_tokens: Number(process.env.NYX_AI_MAX_TOKENS || 1200),
        stream: wantsStream
      })
    });
    if (wantsStream && upstream.ok) {
      res.status(200);
      res.setHeader("content-type", "text/event-stream; charset=utf-8");
      res.setHeader("cache-control", "no-cache, no-transform");
      res.setHeader("connection", "keep-alive");
      res.flushHeaders?.();
      const reader = upstream.body?.getReader();
      if (!reader) throw new Error("AI provider did not return a response stream.");
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw || raw === "[DONE]") continue;
          const event = JSON.parse(raw);
          if (event?.type === "error") {
            nyxAiWriteStreamChunk(res, `Nyx AI error: ${nyxAiErrorMessage(event, upstream.status)}`, model);
            continue;
          }
          nyxAiWriteStreamChunk(res, nyxAiStreamText(event), model);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim().startsWith("data:")) {
        const raw = buffer.trim().slice(5).trim();
        if (raw && raw !== "[DONE]") {
          const event = JSON.parse(raw);
          nyxAiWriteStreamChunk(res, nyxAiStreamText(event), model);
        }
      }
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: nyxAiErrorMessage(data, upstream.status)
      });
      return;
    }
    const text = data?.response || data?.text || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
    res.json({ text: String(text || "").trim(), model });
  } catch (error) {
    if (!res.headersSent) {
      const timedOut = error?.name === "AbortError";
      res.status(timedOut ? 504 : 502).json({ error: timedOut ? "Nyx AI timed out. Please try again." : `Nyx AI request failed: ${error?.message || error}` });
    } else if (!res.writableEnded) {
      res.end();
    }
  } finally {
    clearTimeout(timeout);
    req.nyxAiRelease?.();
  }
});

app.use((req, res, next) => {
  const referer = String(req.get("referer") || "");
  const fromGmsRunner = /\/assets\/(?:gms-games|reds-misc)\/play\.html/i.test(referer);
  if (fromGmsRunner && (req.path === "/" || req.path === "/index.html")) {
    res.status(409).type("html").send(`<!doctype html>
<meta charset="utf-8">
<title>GMS navigation blocked</title>
<style>
  html,body{margin:0;width:100%;height:100%;display:grid;place-items:center;background:#0b0f17;color:#f8fafc;font:16px Outfit,Arial,sans-serif}
  main{max-width:420px;padding:24px;text-align:center}
</style>
<main>This GMS game tried to open Nyx inside itself, so Nyx blocked that redirect.</main>`);
    return;
  }
  next();
});

app.get("/healthz", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "nyx",
    wisp: externalWispUrl ? "external" : "embedded",
    chatRealtime: nyxChatSocketServer ? "socket.io" : "polling"
  });
});

function pruneLocalPresence(now = Date.now()) {
  for (const [sessionId, lastSeen] of presenceSessions) {
    if (now - lastSeen > presenceTtlMs) {
      presenceSessions.delete(sessionId);
      presenceSessionFirstSeen.delete(sessionId);
      presenceSessionDetails.delete(sessionId);
    }
  }
  return presenceSessions.size;
}

function setPresenceCors(res) {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400"
  });
}

function nyxGuestIdentity(sessionId) {
  const digest = createHash("sha256").update(`nyx-guest:${sessionId}`).digest();
  const suffix = digest.readUInt16BE(2).toString().padStart(5, "0");
  return {
    id: digest.toString("hex").slice(0, 24),
    displayName: `${nyxGuestAdjectives[digest[0] % nyxGuestAdjectives.length]} ${nyxGuestNouns[digest[1] % nyxGuestNouns.length]} ${suffix}`,
    username: `guest-${digest.toString("hex").slice(0, 8)}`
  };
}

function nyxStartupGuestName(value) {
  const name = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 48);
  if (!name || /^(?:guest|profile|set username|user|username)$/i.test(name)) return "";
  return name;
}

function nyxStartupGuestUsername(name, fallback) {
  const username = String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 32);
  return username || fallback;
}

async function nyxPresenceAccountUid(req) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match || !firebaseAdminModeConfigured()) return "";
  try {
    const firebase = await linkGeneratorFirebase();
    const token = await firebase?.auth.verifyIdToken(match[1], false);
    return String(token?.uid || "").slice(0, 128);
  } catch {
    return "";
  }
}

function recordLocalPresence(sessionId, accountUid = "", startupName = "", now = Date.now()) {
  presenceSessions.set(sessionId, now);
  const firstSeen = presenceSessionFirstSeen.get(sessionId) || now;
  presenceSessionFirstSeen.set(sessionId, firstSeen);
  const guest = nyxGuestIdentity(sessionId);
  const guestName = nyxStartupGuestName(startupName) || guest.displayName;
  const guestUsername = nyxStartupGuestUsername(guestName, guest.username);
  presenceSessionDetails.set(sessionId, {
    lastSeen: now,
    firstSeen,
    accountUid,
    guestName,
    guestUsername
  });
  return pruneLocalPresence(now);
}

function presenceCount(now = Date.now()) {
  return pruneLocalPresence(now);
}

async function sendPresence(res, status = 200, countPromise = presenceCount(), extra = {}) {
  setPresenceCors(res);
  const online = await countPromise;
  res.status(status)
    .set("Cache-Control", "no-store")
    .json({ online, ttl: presenceTtlMs, ...extra });
}

app.options(["/presence", "/api/presence"], (_req, res) => {
  setPresenceCors(res);
  res.set("Cache-Control", "no-store").sendStatus(204);
});

app.get(["/presence", "/api/presence"], async (_req, res) => {
  await sendPresence(res);
});

app.post(["/presence", "/api/presence"], express.text({ type: "text/plain", limit: "2kb" }), async (req, res) => {
  try {
    const payload = JSON.parse(req.body || "{}");
    const sessionId = String(payload.sessionId || "");
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)) {
      await sendPresence(res, 400);
      return;
    }
    const now = Date.now();
    const accountUid = await nyxPresenceAccountUid(req);
    const startupName = nyxStartupGuestName(payload.userName);
    const count = recordLocalPresence(sessionId, accountUid, startupName, now);
    const randomGuestIdentity = nyxGuestIdentity(sessionId);
    const guestName = startupName || randomGuestIdentity.displayName;
    const guestIdentity = accountUid ? null : {
      displayName: guestName,
      username: nyxStartupGuestUsername(guestName, randomGuestIdentity.username)
    };
    await sendPresence(res, 200, Promise.resolve(count), {
      guest: guestIdentity
    });
  } catch {
    await sendPresence(res, 400);
  }
});

app.get("/runtime-config.js", (_req, res) => {
  const publicOrigin = linkGeneratorConfig().origin;
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript").send(
    `globalThis.__NYX_RUNTIME_CONFIG__=Object.freeze(${JSON.stringify({
      wispUrl: externalWispUrl,
      presenceUrl: publicOrigin ? `${publicOrigin}/api/presence` : "",
      publicOrigin
    })});`
  );
});

app.get("/uv/uv.handler.js", (_req, res) => {
  res.type("application/javascript").send(patchedUvHandler());
});
app.get("/uv/uv.bundle.js", (_req, res) => {
  res.type("application/javascript").send(patchedUvBundle());
});
app.get("/baremux/index.mjs", (_req, res) => {
  res.type("application/javascript").send(patchedBareMuxIndex());
});
app.get("/scramjet/scramjet.js", (_req, res) => {
  res.type("application/javascript").send(patchedScramjetRuntime());
});
app.get("/nyx-scramjet-runtime-guard.js", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.type("application/javascript").send(scramjetRuntimeGuard());
});
app.get("/nyx-compat/cineby-app.js", async (_req, res) => {
  try {
    if (!cinebyAppCache.source || cinebyAppCache.expires < Date.now()) {
      const pageResponse = await fetch("https://www.cineby.at/");
      if (!pageResponse.ok) throw new Error(`Cineby returned ${pageResponse.status}`);
      const html = await pageResponse.text();
      const match = html.match(/<script[^>]+src=["']([^"']*\/_app-[^"']+\.js)["']/i);
      if (!match) throw new Error("Cineby app bundle was not found");
      const scriptUrl = new URL(match[1], "https://www.cineby.at/");
      const scriptResponse = await fetch(scriptUrl);
      if (!scriptResponse.ok) throw new Error(`Cineby app bundle returned ${scriptResponse.status}`);
      const original = await scriptResponse.text();
      const devtoolPatched = original.replace(
        /ignore:\(\)=>\[[^\]]*\]\.includes\(location\.href\)/,
        "ignore:()=>true"
      );
      if (devtoolPatched === original) throw new Error("Cineby DevTools detector signature changed");
      const patched = devtoolPatched.replace(
        /let e=\[\{id:"adstag-gk",src:"\/scripts\/os\.js"\},\{id:"adstag-2",src:"\/\/[^"\\]+"\}\];/,
        "let e=[];"
      );
      if (patched === devtoolPatched) throw new Error("Cineby ad loader signature changed");
      cinebyAppCache = { source: patched, expires: Date.now() + 5 * 60 * 1000 };
    }
    res.setHeader("Cache-Control", "no-store");
    res.type("application/javascript").send(cinebyAppCache.source);
  } catch (error) {
    res.status(502).type("application/javascript").send(`throw new Error(${JSON.stringify(`Nyx Cineby compatibility failed: ${error.message}`)});`);
  }
});
app.get("/assets/vendor/eruda.min.js", (_req, res) => {
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.type("application/javascript").sendFile(erudaPath);
});

function linkGeneratorConfig() {
  const maxZones = Math.max(1, Math.min(10_000, Number.parseInt(process.env.LINK_GENERATOR_MAX_ZONES || "100", 10) || 100));
  const premiumBatchLimit = Math.max(1, Math.min(10, Number.parseInt(process.env.LINK_GENERATOR_PREMIUM_BATCH_LIMIT || "10", 10) || 10));
  let origin = "";
  try {
    const parsed = new URL(process.env.NYX_PUBLIC_ORIGIN || "https://nyxlearning.netlify.app");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      parsed.pathname = parsed.pathname.replace(/\/$/, "");
      parsed.search = "";
      parsed.hash = "";
      origin = parsed.href.replace(/\/$/, "");
    }
  } catch {}
  return {
    apiKey: String(process.env.BUNNY_API_KEY || "").trim(),
    accessCode: String(process.env.LINK_GENERATOR_ACCESS_CODE || ""),
    origin,
    maxZones,
    premiumBatchLimit
  };
}

function linkGeneratorFirebaseConfig() {
  return {
    webApiKey: String(process.env.FIREBASE_WEB_API_KEY || "").trim(),
    projectId: String(process.env.FIREBASE_PROJECT_ID || "").trim(),
    clientEmail: String(process.env.FIREBASE_CLIENT_EMAIL || "").trim(),
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n").trim()
  };
}

function firebaseAdminModeConfigured() {
  const { projectId, clientEmail, privateKey } = linkGeneratorFirebaseConfig();
  return Boolean(projectId && clientEmail && privateKey);
}

function firebaseAccountModeConfigured() {
  return firebaseAdminModeConfigured() && Boolean(linkGeneratorFirebaseConfig().webApiKey);
}

async function linkGeneratorFirebase() {
  if (!firebaseAdminModeConfigured()) return null;
  if (!linkGeneratorFirebasePromise) {
    linkGeneratorFirebasePromise = (async () => {
      const config = linkGeneratorFirebaseConfig();
      const [{ cert, getApps, initializeApp }, { getAuth }, { getFirestore }] = await Promise.all([
        import("firebase-admin/app"),
        import("firebase-admin/auth"),
        import("firebase-admin/firestore")
      ]);
      let firebaseApp = getApps().find(item => item.name === "nyx-link-generator");
      if (!firebaseApp) {
        firebaseApp = initializeApp({
          credential: cert({ projectId: config.projectId, clientEmail: config.clientEmail, privateKey: config.privateKey }),
          projectId: config.projectId
        }, "nyx-link-generator");
      }
      return { auth: getAuth(firebaseApp), firestore: getFirestore(firebaseApp) };
    })().catch(error => {
      linkGeneratorFirebasePromise = null;
      throw error;
    });
  }
  return linkGeneratorFirebasePromise;
}

function secretMatches(actual, expected) {
  const left = createHash("sha256").update(String(actual || "")).digest();
  const right = createHash("sha256").update(String(expected || "")).digest();
  return timingSafeEqual(left, right) && Boolean(expected);
}

const founderProfileDefaults = Object.freeze({
  displayName: "1aqlla",
  handle: "@1aqlla",
  role: "Owner / Founder",
  bio: "Built Nyx for people who search, study, and create.",
  avatarUrl: "/assets/icons/founder-1aqlla.jpg",
  bannerUrl: "",
  accent: "#8fb8ff",
  accentPrimary: "#8fb8ff",
  accentSecondary: "#8ea1ff",
  bannerColor: "#8ea1ff",
  displayNameFont: "gg-sans",
  displayNameEffect: "solid",
  displayNameColorPrimary: "#ffffff",
  displayNameColorSecondary: "#8ea1ff",
  profileEffect: "none",
  customEffectPattern: "starfield",
  customEffectColorPrimary: "#ffffff",
  customEffectColorSecondary: "#8ea1ff",
  customEffectSpeed: 7,
  customEffectIntensity: 70,
  avatarDecoration: "none",
  status: "online",
  roles: ["Owner", "Developer"],
  badges: ["Founder"],
  linkLabel: "",
  linkUrl: ""
});

const nyxProfileEffectValues = Object.freeze([
  "none",
  "blooming-roses"
]);
const nyxAvatarDecorationValues = Object.freeze([
  "none",
  "candlelight"
]);
const nyxLegacyProfileEffectMap = Object.freeze({
  glow: "blooming-roses",
  sparkle: "blooming-roses",
  aurora: "blooming-roses",
  holographic: "blooming-roses",
  fireflies: "blooming-roses",
  "cosmic-dust": "blooming-roses",
  "electric-storm": "blooming-roses",
  "meteor-shower": "blooming-roses",
  "cyber-grid": "blooming-roses",
  plasma: "blooming-roses",
  snowfall: "blooming-roses",
  embers: "blooming-roses",
  bubbles: "blooming-roses",
  "starlight-ribbon": "blooming-roses",
  "cherry-bloom": "blooming-roses",
  "ocean-caustics": "blooming-roses",
  "chromatic-inferno": "blooming-roses",
  ghostfire: "blooming-roses",
  "pirate-breach": "blooming-roses",
  "kraken-depths": "blooming-roses",
  "celestial-rift": "blooming-roses",
  stormforged: "blooming-roses",
  custom: "blooming-roses"
});
const nyxLegacyAvatarDecorationMap = Object.freeze({
  starfall: "candlelight",
  orbit: "candlelight",
  laurel: "candlelight",
  "neon-wings": "candlelight",
  "crystal-crown": "candlelight",
  "lunar-halo": "candlelight",
  "rose-vines": "candlelight",
  "inferno-crown": "candlelight",
  "corsair-crest": "candlelight",
  "kraken-grasp": "candlelight",
  "eclipse-halo": "candlelight",
  "phoenix-wings": "candlelight",
  "crystal-aegis": "candlelight"
});

function nyxProfileEffectValue(value, fallback = "none") {
  const candidate = String(value || "").toLowerCase();
  const migrated = nyxLegacyProfileEffectMap[candidate] || candidate;
  return nyxProfileEffectValues.includes(migrated) ? migrated : fallback;
}

function nyxAvatarDecorationValue(value, fallback = "none") {
  const candidate = String(value || "").toLowerCase();
  const migrated = nyxLegacyAvatarDecorationMap[candidate] || candidate;
  return nyxAvatarDecorationValues.includes(migrated) ? migrated : fallback;
}

function founderProfileConfig() {
  return { administratorUid: String(process.env.NYX_FOUNDER_PROFILE_ADMIN_UID || "").trim() };
}

function founderProfileText(value, fallback, limit) {
  const text = String(value ?? "").trim().replace(/\s+/g, " ").slice(0, limit);
  return text || fallback;
}

function founderProfileUrl(value, fallback = "") {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length <= profileImageDataLimit) return raw.replace(/\s/g, "");
  if (raw.length > 1_500) return fallback;
  if (/^\/assets\/[a-z0-9/_\-.]+$/i.test(raw)) return raw;
  if (/^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/(?:avatar|banner)\/[A-Za-z0-9_-]{12,80}$/.test(raw)) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    parsed.username = "";
    parsed.password = "";
    return parsed.href;
  } catch {
    return fallback;
  }
}

function normalizeFounderProfile(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const roles = Array.isArray(source.roles) ? source.roles : founderProfileDefaults.roles;
  const badges = Array.isArray(source.badges) ? source.badges : [];
  const accentPrimary = /^#[0-9a-f]{6}$/i.test(String(source.accentPrimary || source.accent || "").trim()) ? String(source.accentPrimary || source.accent).trim().toLowerCase() : founderProfileDefaults.accentPrimary;
  const accentSecondary = /^#[0-9a-f]{6}$/i.test(String(source.accentSecondary || "").trim()) ? String(source.accentSecondary).trim().toLowerCase() : founderProfileDefaults.accentSecondary;
  const bannerColor = /^#[0-9a-f]{6}$/i.test(String(source.bannerColor || "").trim()) ? String(source.bannerColor).trim().toLowerCase() : accentSecondary;
  const displayNameColorPrimary = /^#[0-9a-f]{6}$/i.test(String(source.displayNameColorPrimary || "").trim()) ? String(source.displayNameColorPrimary).trim().toLowerCase() : founderProfileDefaults.displayNameColorPrimary;
  const displayNameColorSecondary = /^#[0-9a-f]{6}$/i.test(String(source.displayNameColorSecondary || "").trim()) ? String(source.displayNameColorSecondary).trim().toLowerCase() : accentSecondary;
  const customEffectColorPrimary = /^#[0-9a-f]{6}$/i.test(String(source.customEffectColorPrimary || "").trim()) ? String(source.customEffectColorPrimary).trim().toLowerCase() : founderProfileDefaults.customEffectColorPrimary;
  const customEffectColorSecondary = /^#[0-9a-f]{6}$/i.test(String(source.customEffectColorSecondary || "").trim()) ? String(source.customEffectColorSecondary).trim().toLowerCase() : accentSecondary;
  return {
    displayName: founderProfileText(source.displayName, founderProfileDefaults.displayName, 48),
    handle: founderProfileText(source.handle, founderProfileDefaults.handle, 40),
    role: founderProfileText(source.role, founderProfileDefaults.role, 64),
    bio: founderProfileText(source.bio, founderProfileDefaults.bio, 500),
    avatarUrl: founderProfileUrl(source.avatarUrl, founderProfileDefaults.avatarUrl),
    bannerUrl: founderProfileUrl(source.bannerUrl),
    accent: accentPrimary,
    accentPrimary,
    accentSecondary,
    bannerColor,
    displayNameFont: ["gg-sans", "headline", "rounded", "wide", "slab", "condensed", "mono-block", "tempo", "sakura", "jellybean", "modern", "medieval", "eight-bit", "vampyre"].includes(String(source.displayNameFont || "").toLowerCase()) ? String(source.displayNameFont).toLowerCase() : founderProfileDefaults.displayNameFont,
    displayNameEffect: ["solid", "gradient", "neon", "toon", "pop"].includes(String(source.displayNameEffect || "").toLowerCase()) ? String(source.displayNameEffect).toLowerCase() : founderProfileDefaults.displayNameEffect,
    displayNameColorPrimary,
    displayNameColorSecondary,
    profileEffect: nyxProfileEffectValue(source.profileEffect, founderProfileDefaults.profileEffect),
    customEffectPattern: ["starfield", "aurora", "comets", "grid"].includes(String(source.customEffectPattern || "").toLowerCase()) ? String(source.customEffectPattern).toLowerCase() : founderProfileDefaults.customEffectPattern,
    customEffectColorPrimary,
    customEffectColorSecondary,
    customEffectSpeed: Math.max(2, Math.min(18, Number(source.customEffectSpeed) || founderProfileDefaults.customEffectSpeed)),
    customEffectIntensity: Math.max(20, Math.min(100, Number(source.customEffectIntensity) || founderProfileDefaults.customEffectIntensity)),
    avatarDecoration: nyxAvatarDecorationValue(source.avatarDecoration, founderProfileDefaults.avatarDecoration),
    status: ["online", "idle", "dnd", "offline"].includes(String(source.status || "").toLowerCase()) ? String(source.status).toLowerCase() : founderProfileDefaults.status,
    roles: roles.map(role => founderProfileText(role, "", 32)).filter(Boolean).slice(0, 8),
    badges: badges.map(badge => founderProfileText(badge, "", 32)).filter(Boolean).slice(0, 8),
    linkLabel: founderProfileText(source.linkLabel, "", 40),
    linkUrl: founderProfileUrl(source.linkUrl)
  };
}

async function verifiedFounderOwner(req) {
  const config = founderProfileConfig();
  if (!config.administratorUid || !firebaseAdminModeConfigured()) {
    return { enabled: false, owner: false, dashboard: false, role: "member", roleLabel: "Member", permissions: [] };
  }
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return { enabled: true, owner: false, dashboard: false, role: "member", roleLabel: "Member", permissions: [] };
  try {
    const firebase = await linkGeneratorFirebase();
    const token = await firebase?.auth.verifyIdToken(match[1], true);
    if (!token) throw new Error("The account session is unavailable.");
    const administration = token.uid === config.administratorUid
      ? { role: "owner" }
      : (await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get()).data();
    const role = nyxRoleForUser(token.uid, administration, config.administratorUid);
    const actor = { uid: token.uid, role, permissions: nyxRolePolicy(role).permissions };
    return { enabled: true, ...nyxOwnerAccessPayload(actor) };
  } catch {
    return { enabled: true, owner: false, dashboard: false, role: "member", roleLabel: "Member", permissions: [] };
  }
}

function nyxUsernameFromToken(token = {}) {
  const email = String(token.email || "");
  const username = email.split("@")[0].replace(/[^a-z0-9_.-]/gi, "").slice(0, 32);
  return username || "nyx-user";
}

function nyxProfileUsername(value, fallback = "nyx-user") {
  const username = String(value || "").trim().replace(/^@+/, "").toLowerCase();
  return /^[a-z0-9_.-]{3,32}$/.test(username) ? username : fallback;
}

function nyxProfileImage(value, fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(raw) && raw.length <= profileImageDataLimit) return raw.replace(/\s/g, "");
  return founderProfileUrl(raw, fallback);
}

function nyxProfileImagePayloadSize(profile = {}) {
  return [profile.avatarUrl, profile.bannerUrl].reduce((total, value) => {
    const image = String(value || "");
    return total + (image.startsWith("data:image/") ? image.length : 0);
  }, 0);
}

async function authenticatedNyxUser(req, checkRevoked = true) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match || !firebaseAdminModeConfigured()) {
    const error = new Error("Sign in to use Nyx Profiles.");
    error.status = 401;
    throw error;
  }
  try {
    const firebase = await linkGeneratorFirebase();
    const token = await firebase?.auth.verifyIdToken(match[1], checkRevoked);
    if (!token) throw new Error("Sign-in is required.");
    return { firebase, token };
  } catch (cause) {
    const error = new Error(cause?.message === "Sign-in is required." ? cause.message : "Your sign-in has expired. Sign in again.");
    error.status = 401;
    throw error;
  }
}

function normalizeNyxUserProfile(value = {}, token = {}) {
  const source = value && typeof value === "object" ? value : {};
  const uid = String(token.uid || "");
  const username = nyxUsernameFromToken(token);
  const fallbackName = founderProfileText(token.name, username, 48);
  const fallbackUsername = nyxProfileUsername(username || uid.slice(0, 8) || "user");
  const fallbackHandle = `@${fallbackUsername}`;
  const accentPrimary = /^#[0-9a-f]{6}$/i.test(String(source.accentPrimary || source.accent || "").trim()) ? String(source.accentPrimary || source.accent).trim().toLowerCase() : "#5865f2";
  const accentSecondary = /^#[0-9a-f]{6}$/i.test(String(source.accentSecondary || source.bannerPrimary || "").trim()) ? String(source.accentSecondary || source.bannerPrimary).trim().toLowerCase() : "#8ea1ff";
  const bannerColor = /^#[0-9a-f]{6}$/i.test(String(source.bannerColor || source.bannerSecondary || "").trim()) ? String(source.bannerColor || source.bannerSecondary).trim().toLowerCase() : accentSecondary;
  const displayNameColorPrimary = /^#[0-9a-f]{6}$/i.test(String(source.displayNameColorPrimary || "").trim()) ? String(source.displayNameColorPrimary).trim().toLowerCase() : "#ffffff";
  const displayNameColorSecondary = /^#[0-9a-f]{6}$/i.test(String(source.displayNameColorSecondary || "").trim()) ? String(source.displayNameColorSecondary).trim().toLowerCase() : accentSecondary;
  const customEffectColorPrimary = /^#[0-9a-f]{6}$/i.test(String(source.customEffectColorPrimary || "").trim()) ? String(source.customEffectColorPrimary).trim().toLowerCase() : "#ffffff";
  const customEffectColorSecondary = /^#[0-9a-f]{6}$/i.test(String(source.customEffectColorSecondary || "").trim()) ? String(source.customEffectColorSecondary).trim().toLowerCase() : accentSecondary;
  return {
    displayName: founderProfileText(source.displayName, fallbackName, 48),
    handle: `@${nyxProfileUsername(source.handle, fallbackUsername)}`,
    bio: founderProfileText(source.bio, "", 280),
    customStatus: founderProfileText(source.customStatus, "", 80),
    avatarUrl: nyxProfileImage(source.avatarUrl, nyxProfileImage(token.picture)),
    bannerUrl: nyxProfileImage(source.bannerUrl),
    accent: accentPrimary,
    accentPrimary,
    accentSecondary,
    bannerColor,
    displayNameFont: ["gg-sans", "headline", "rounded", "wide", "slab", "condensed", "mono-block", "tempo", "sakura", "jellybean", "modern", "medieval", "eight-bit", "vampyre"].includes(String(source.displayNameFont || "").toLowerCase()) ? String(source.displayNameFont).toLowerCase() : "gg-sans",
    displayNameEffect: ["solid", "gradient", "neon", "toon", "pop"].includes(String(source.displayNameEffect || "").toLowerCase()) ? String(source.displayNameEffect).toLowerCase() : "solid",
    displayNameColorPrimary,
    displayNameColorSecondary,
    profileEffect: nyxProfileEffectValue(source.profileEffect),
    customEffectPattern: ["starfield", "aurora", "comets", "grid"].includes(String(source.customEffectPattern || "").toLowerCase()) ? String(source.customEffectPattern).toLowerCase() : "starfield",
    customEffectColorPrimary,
    customEffectColorSecondary,
    customEffectSpeed: Math.max(2, Math.min(18, Number(source.customEffectSpeed) || 7)),
    customEffectIntensity: Math.max(20, Math.min(100, Number(source.customEffectIntensity) || 70)),
    avatarDecoration: nyxAvatarDecorationValue(source.avatarDecoration),
    status: ["online", "idle", "dnd", "offline"].includes(String(source.status || "").toLowerCase()) ? String(source.status).toLowerCase() : "online"
  };
}

async function saveNyxProfileWithUsername(firebase, token, profile, createdAt, previousProfile = null) {
  const uid = String(token.uid || "");
  const username = nyxProfileUsername(profile.handle, nyxProfileUsername(nyxUsernameFromToken(token)));
  const previousUsername = previousProfile ? nyxProfileUsername(previousProfile.handle, "") : "";
  const profileRef = firebase.firestore.collection("nyxUserProfiles").doc(uid);
  const usernameRef = firebase.firestore.collection("nyxUsernames").doc(username);
  const previousUsernameRef = previousUsername && previousUsername !== username
    ? firebase.firestore.collection("nyxUsernames").doc(previousUsername)
    : null;
  const now = new Date().toISOString();
  await firebase.firestore.runTransaction(async transaction => {
    const usernameSnapshot = await transaction.get(usernameRef);
    const previousUsernameSnapshot = previousUsernameRef ? await transaction.get(previousUsernameRef) : null;
    const duplicateProfiles = await transaction.get(
      firebase.firestore.collection("nyxUserProfiles").where("profile.handle", "==", `@${username}`).limit(2)
    );
    const claimedBy = String(usernameSnapshot.data()?.ownerUid || "");
    const duplicateOwner = duplicateProfiles.docs.find(document => document.id !== uid)?.id || "";
    if ((usernameSnapshot.exists && claimedBy !== uid) || duplicateOwner) {
      const error = new Error("That username is already taken.");
      error.status = 409;
      throw error;
    }
    transaction.set(usernameRef, {
      username,
      ownerUid: uid,
      createdAt: String(usernameSnapshot.data()?.createdAt || now),
      updatedAt: now
    }, { merge: true });
    if (previousUsernameRef && previousUsernameSnapshot?.exists && String(previousUsernameSnapshot.data()?.ownerUid || "") === uid) {
      transaction.delete(previousUsernameRef);
    }
    transaction.set(profileRef, {
      profile: { ...profile, handle: `@${username}` },
      createdAt,
      updatedAt: now
    }, { merge: true });
  });
  return { ...profile, handle: `@${username}` };
}

function safeDateIso(value, fallback = "") {
  const timestamp = Date.parse(String(value || ""));
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback;
}

function safeActivityTime(value) {
  const numeric = Number(value || 0);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeNyxRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ["co_owner", "admin", "manager", "developer", "moderator", "support", "tester", "contributor", "member"].includes(role) ? role : "member";
}

const nyxRolePolicies = Object.freeze({
  owner: Object.freeze({
    rank: 100,
    assignableRank: 90,
    permissions: Object.freeze(["dashboard:view", "users:view", "audit:view", "profiles:write", "roles:write", "subscriptions:write", "accounts:reset", "accounts:verify", "accounts:disable", "accounts:delete", "network:bans", "developer-console", "founder:write"])
  }),
  co_owner: Object.freeze({
    rank: 90,
    assignableRank: 80,
    permissions: Object.freeze(["dashboard:view", "users:view", "audit:view", "profiles:write", "roles:write", "subscriptions:write", "accounts:reset", "accounts:verify", "accounts:disable", "accounts:delete", "network:bans", "developer-console"])
  }),
  admin: Object.freeze({
    rank: 80,
    assignableRank: 70,
    permissions: Object.freeze(["dashboard:view", "users:view", "audit:view", "profiles:write", "roles:write", "subscriptions:write", "accounts:reset", "accounts:verify", "accounts:disable", "network:bans"])
  }),
  manager: Object.freeze({
    rank: 70,
    assignableRank: 0,
    permissions: Object.freeze(["dashboard:view", "users:view", "profiles:write", "subscriptions:write"])
  }),
  developer: Object.freeze({ rank: 60, assignableRank: 0, permissions: Object.freeze(["developer-console"]) }),
  moderator: Object.freeze({ rank: 50, assignableRank: 0, permissions: Object.freeze(["dashboard:view", "users:view", "accounts:disable"]) }),
  support: Object.freeze({ rank: 40, assignableRank: 0, permissions: Object.freeze(["dashboard:view", "users:view", "accounts:reset", "accounts:verify"]) }),
  tester: Object.freeze({ rank: 30, assignableRank: 0, permissions: Object.freeze([]) }),
  contributor: Object.freeze({ rank: 20, assignableRank: 0, permissions: Object.freeze([]) }),
  member: Object.freeze({ rank: 10, assignableRank: 0, permissions: Object.freeze([]) })
});

const nyxAssignableRoles = Object.freeze(["member", "contributor", "tester", "support", "moderator", "developer", "manager", "admin", "co_owner"]);
const nyxRoleLabels = Object.freeze({
  owner: "Owner",
  co_owner: "Co-owner",
  admin: "Admin",
  manager: "Manager",
  developer: "Developer",
  moderator: "Moderator",
  support: "Support",
  tester: "Tester",
  contributor: "Contributor",
  member: "Member"
});
const nyxCustomRolePermissionCatalog = Object.freeze([
  ["dashboard:view", "Open Owner Dashboard"], ["users:view", "View accounts"], ["audit:view", "View audit logs"],
  ["profiles:write", "Edit user profiles"], ["roles:write", "Assign built-in roles"], ["subscriptions:write", "Manage subscriptions"],
  ["accounts:reset", "Create password resets"], ["accounts:verify", "Verify emails"], ["accounts:disable", "Disable accounts"],
  ["accounts:delete", "Delete accounts"], ["network:bans", "Manage IP bans"], ["developer-console", "Open Developer Console"],
  ["chat:moderate", "Moderate Nyx Chat"], ["chat:manage_channels", "Manage Chat channels"], ["link-scanner:bulk", "Run full Link Checker scans"]
]);
const nyxCustomRolePermissionSet = new Set(nyxCustomRolePermissionCatalog.map(([permission]) => permission));
const nyxCustomRoleColorCodes = Object.freeze({
  "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa",
  "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa",
  "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff",
  c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff"
});

function nyxCustomRoleColor(value, fallback = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  const code = raw.match(/^&([0-9a-f])$/)?.[1];
  return code ? nyxCustomRoleColorCodes[code] : fallback;
}

async function optionalAuthenticatedNyxUser(req) {
  const firebase = await linkGeneratorFirebase();
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) return { firebase, token: null };
  try {
    return { firebase, token: await firebase?.auth.verifyIdToken(match[1], true) || null };
  } catch {
    return { firebase, token: null };
  }
}

function nyxCustomRolePermissions(value, fallbackRole = "member") {
  const fallback = nyxRolePolicy(fallbackRole).permissions.filter(permission => nyxCustomRolePermissionSet.has(permission));
  if (nyxRolePolicy(fallbackRole).rank >= nyxRolePolicy("moderator").rank) fallback.push("chat:moderate", "link-scanner:bulk");
  if (nyxRolePolicy(fallbackRole).rank >= nyxRolePolicy("manager").rank) fallback.push("chat:manage_channels");
  if (!Array.isArray(value)) return [...fallback];
  return [...new Set(value.map(permission => String(permission || "").trim()).filter(permission => nyxCustomRolePermissionSet.has(permission)))];
}

function nyxCustomRoleId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 32);
}

function nyxCustomRoleRecord(id, value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const roleId = nyxCustomRoleId(id || source.id);
  const baseRole = normalizeNyxRole(source.baseRole);
  const color = nyxCustomRoleColor(source.color, "#8ea1ff");
  if (!nyxCustomRoleIdPattern.test(roleId) || Object.prototype.hasOwnProperty.call(nyxRolePolicies, roleId)) return null;
  return {
    id: roleId,
    label: founderProfileText(source.label, "Custom role", nyxCustomRoleLabelLimit),
    color,
    baseRole,
    rank: nyxRolePolicy(baseRole).rank,
    permissions: nyxCustomRolePermissions(source.permissions, baseRole),
    createdAt: safeDateIso(source.createdAt),
    updatedAt: safeDateIso(source.updatedAt)
  };
}

async function nyxCustomRoles(firebase, force = false) {
  const now = Date.now();
  if (!force && nyxCustomRoleCache.expiresAt > now) return nyxCustomRoleCache.value;
  if (!force && nyxCustomRoleCache.promise) return nyxCustomRoleCache.promise;
  const promise = (async () => {
    const snapshot = await firebase.firestore.collection(nyxCustomRoleCollection).limit(100).get();
    const roles = snapshot.docs.map(document => nyxCustomRoleRecord(document.id, document.data())).filter(Boolean);
    roles.sort((left, right) => right.rank - left.rank || left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
    return new Map(roles.map(role => [role.id, role]));
  })();
  nyxCustomRoleCache.promise = promise;
  try {
    const value = await promise;
    nyxCustomRoleCache = { expiresAt: Date.now() + nyxCustomRoleCacheTtlMs, value, promise: null };
    return value;
  } catch (error) {
    nyxCustomRoleCache.promise = null;
    throw error;
  }
}

function nyxAssignedCustomRole(administration = {}, roles = new Map()) {
  const id = nyxCustomRoleId(administration.customRoleId);
  const role = roles.get(id);
  return role && role.baseRole === normalizeNyxRole(administration.role) ? role : null;
}

function nyxPublicCustomRole(role) {
  return role ? { id: role.id, label: role.label, color: role.color, baseRole: role.baseRole, rank: role.rank, permissions: [...role.permissions] } : null;
}

// Keep private role IDs explicit: privacy must follow the persisted role ID,
// not its editable display label. `tide-stressed` is the live Tide role while
// `tide` remains supported for older installations.
const nyxPrivateCustomRoleIds = new Set(["tide", "tide-stressed"]);

function nyxPrivateCustomRole(role) {
  return Boolean(role && nyxPrivateCustomRoleIds.has(nyxCustomRoleId(role.id)));
}

function nyxRolePresentation(role, customRole, subjectUid = "", viewerUid = "", ownerUid = founderProfileConfig().administratorUid) {
  const normalizedRole = String(role || "").trim().toLowerCase() === "owner" ? "owner" : normalizeNyxRole(role);
  const subject = String(subjectUid || "");
  const viewer = String(viewerUid || "");
  const privateRole = nyxPrivateCustomRole(customRole);
  const canSeePrivateRole = !privateRole || Boolean(viewer && (viewer === subject || viewer === ownerUid));
  if (!canSeePrivateRole) {
    return { role: "moderator", roleLabel: nyxRoleLabels.moderator, customRole: null };
  }
  return {
    role: normalizedRole,
    roleLabel: customRole?.label || nyxRoleLabels[normalizedRole] || nyxRoleLabels.member,
    customRole: nyxPublicCustomRole(customRole)
  };
}

function nyxVisibleCustomRoles(roles, viewerUid = "", ownerUid = founderProfileConfig().administratorUid, viewerCustomRole = null) {
  const viewer = String(viewerUid || "");
  return [...roles.values()]
    .filter(role => viewer === ownerUid || nyxCustomRoleId(viewerCustomRole?.id) === nyxCustomRoleId(role.id) || !nyxPrivateCustomRole(role))
    .map(nyxPublicCustomRole);
}

function nyxRolePolicy(role) {
  return nyxRolePolicies[role] || nyxRolePolicies.member;
}

function nyxRoleForUser(uid, administration = {}, ownerUid = founderProfileConfig().administratorUid) {
  return uid === ownerUid ? "owner" : normalizeNyxRole(administration.role);
}

function nyxActorHasPermission(actor, permission) {
  return Boolean(actor?.permissions?.includes(permission));
}

function nyxActorCanReviewSearchHistory(actor) {
  if (!actor) return false;
  return actor.customRole
    ? Boolean(actor.customRole.permissions?.includes("chat:moderate"))
    : nyxRolePolicy(actor.role).rank >= nyxRolePolicy("moderator").rank;
}

function nyxOwnerAccessPayload(actor) {
  const policy = nyxRolePolicy(actor.role);
  const presentation = nyxRolePresentation(actor.role, actor.customRole, actor.uid, actor.uid);
  return {
    role: presentation.role,
    roleLabel: presentation.roleLabel,
    customRole: presentation.customRole,
    owner: actor.role === "owner",
    dashboard: nyxActorHasPermission(actor, "dashboard:view"),
    canReviewSearchHistory: nyxActorCanReviewSearchHistory(actor),
    permissions: [...actor.permissions],
    assignableRoles: nyxActorHasPermission(actor, "roles:write")
      ? nyxAssignableRoles.filter(role => nyxRolePolicy(role).rank <= policy.assignableRank)
      : []
  };
}

function nyxOwnerUserCapabilities(actor, targetRole, targetUid, ownerUid = founderProfileConfig().administratorUid) {
  const actorPolicy = nyxRolePolicy(actor.role);
  const targetPolicy = nyxRolePolicy(targetRole);
  const ownerManagingSelf = actor.role === "owner" && targetRole === "owner" && actor.uid === targetUid;
  const founderOwnerOverride = actor.role === "owner" && actor.uid === ownerUid && targetUid !== ownerUid;
  const targetProtected = !founderOwnerOverride && (targetUid === ownerUid || targetRole === "owner" || targetPolicy.rank >= actorPolicy.rank);
  const canManageTarget = !targetProtected;
  return {
    canViewAudit: nyxActorHasPermission(actor, "audit:view"),
    canEditProfile: (canManageTarget || ownerManagingSelf) && nyxActorHasPermission(actor, "profiles:write"),
    canSetRole: canManageTarget && nyxActorHasPermission(actor, "roles:write"),
    canSetSubscription: (canManageTarget || ownerManagingSelf) && nyxActorHasPermission(actor, "subscriptions:write"),
    canResetPassword: (canManageTarget || ownerManagingSelf) && nyxActorHasPermission(actor, "accounts:reset"),
    canVerifyEmail: (canManageTarget || ownerManagingSelf) && nyxActorHasPermission(actor, "accounts:verify"),
    canDisableAccount: canManageTarget && nyxActorHasPermission(actor, "accounts:disable"),
    canManageNetworkBans: canManageTarget && nyxActorHasPermission(actor, "network:bans"),
    canDeleteAccount: canManageTarget && nyxActorHasPermission(actor, "accounts:delete"),
    assignableRoles: nyxActorHasPermission(actor, "roles:write")
      ? nyxAssignableRoles.filter(role => nyxRolePolicy(role).rank <= actorPolicy.assignableRank)
      : []
  };
}

function assertNyxOwnerCapability(capabilities, capability, message) {
  if (capabilities?.[capability]) return;
  const error = new Error(message || "Your role does not have permission to perform that action.");
  error.status = 403;
  throw error;
}

function normalizeSubscriptionStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  return ["free", "premium", "trialing", "past_due", "canceled"].includes(status) ? status : "free";
}

function hasPremiumSubscription(value) {
  return ["premium", "trialing"].includes(normalizeSubscriptionStatus(value));
}

function nyxCaffeineSubscription(administration = {}) {
  const subscriptionStatus = normalizeSubscriptionStatus(administration.subscriptionStatus || administration.subscription?.status);
  const source = String(administration.subscriptionSource || "").trim().toLowerCase();
  const active = hasPremiumSubscription(subscriptionStatus);
  return {
    active,
    subscriptionStatus,
    giftDerived: active && source === "caffeine_gift",
    directlyAssigned: active && source !== "caffeine_gift"
  };
}

function nyxCaffeineEntitlement(uid, administration = {}) {
  const subscription = nyxCaffeineSubscription(administration);
  const role = nyxRoleForUser(uid, administration);
  const unlimited = role === "owner" || role === "co_owner";
  return {
    ...subscription,
    active: unlimited || subscription.active,
    giftDerived: !unlimited && subscription.giftDerived,
    directlyAssigned: unlimited || subscription.directlyAssigned,
    unlimited
  };
}

function nyxCaffeineGrantKey(uid, administration = {}) {
  const seed = String(administration.caffeineGrantId || administration.subscriptionUpdatedAt || "legacy-premium").trim();
  return createHash("sha256").update(`${String(uid || "")}:${seed}`, "utf8").digest("hex").slice(0, 40);
}

function nyxCaffeinePendingGift(value, now = Date.now()) {
  const source = value && typeof value === "object" ? value : {};
  const id = String(source.id || "").trim();
  const giverUid = String(source.giverUid || "").trim();
  const expiresAtMs = Math.max(0, Number(source.expiresAtMs || 0));
  if (!nyxCaffeineGiftIdPattern.test(id) || !/^[A-Za-z0-9_-]{8,128}$/.test(giverUid) || expiresAtMs <= now) return null;
  return {
    id,
    giverUid,
    giverDisplayName: founderProfileText(source.giverDisplayName, "A Nyx member", 48),
    giverHandle: `@${nyxProfileUsername(source.giverHandle, "nyx-user")}`,
    createdAtMs: Math.max(0, Number(source.createdAtMs || 0)),
    expiresAtMs
  };
}

async function nyxCaffeineState(firebase, uid) {
  const administrationRef = firebase.firestore.collection("nyxUserAdministration").doc(uid);
  const administrationSnapshot = await administrationRef.get();
  const administration = administrationSnapshot.data() || {};
  const subscription = nyxCaffeineEntitlement(uid, administration);
  const pendingGift = subscription.active ? null : nyxCaffeinePendingGift(administration.pendingCaffeineGift);
  let outgoingGift = null;
  if (subscription.directlyAssigned && !subscription.unlimited) {
    const giftId = nyxCaffeineGrantKey(uid, administration);
    const giftSnapshot = await firebase.firestore.collection(nyxCaffeineGiftCollection).doc(giftId).get();
    const gift = giftSnapshot.data() || {};
    const status = String(gift.status || "").trim().toLowerCase();
    const stillPending = status === "pending" && Number(gift.expiresAtMs || 0) > Date.now();
    if (status === "accepted" || stillPending) {
      outgoingGift = {
        id: giftId,
        status,
        recipientDisplayName: founderProfileText(gift.recipientDisplayName, "Nyx member", 48),
        createdAtMs: Math.max(0, Number(gift.createdAtMs || 0)),
        acceptedAtMs: Math.max(0, Number(gift.acceptedAtMs || 0)),
        expiresAtMs: Math.max(0, Number(gift.expiresAtMs || 0))
      };
    }
  }
  return {
    active: subscription.active,
    giftDerived: subscription.giftDerived,
    unlimited: subscription.unlimited,
    canGift: subscription.unlimited || (subscription.directlyAssigned && !outgoingGift),
    outgoingGift,
    pendingGift
  };
}

function nyxDeliverableEmail(value) {
  const email = String(value || "").trim();
  return Boolean(email && !/@account\.nyx\.local$/i.test(email) && !/\.local$/i.test(email));
}

function normalizeNyxAccountEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !nyxDeliverableEmail(email)
  ) return "";
  return email;
}

async function ownerDashboardActor(req, requiredPermission = "dashboard:view") {
  const { firebase, token } = await authenticatedNyxUser(req);
  const ownerUid = founderProfileConfig().administratorUid;
  if (!ownerUid) {
    const error = new Error("Owner access has not been configured.");
    error.status = 503;
    throw error;
  }
  let administration = {};
  if (token.uid === ownerUid) {
    administration = { role: "owner" };
    await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).set({
      role: "owner",
      owner: true,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } else {
    administration = (await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get()).data() || {};
  }
  const role = nyxRoleForUser(token.uid, administration, ownerUid);
  const policy = nyxRolePolicy(role);
  const customRole = token.uid === ownerUid ? null : nyxAssignedCustomRole(administration, await nyxCustomRoles(firebase));
  const actor = { uid: token.uid, role, customRole, permissions: customRole?.permissions || policy.permissions, rank: customRole?.rank || policy.rank };
  if (requiredPermission && !nyxActorHasPermission(actor, requiredPermission)) {
    const error = new Error(`${nyxRoleLabels[role] || "Member"} does not have permission to open this area.`);
    error.status = 403;
    throw error;
  }
  return { firebase, token, actor, ownerUid };
}

async function nyxFounderOwnerActor(req) {
  const context = await ownerDashboardActor(req, "dashboard:view");
  if (context.actor.role !== "owner" || context.actor.uid !== context.ownerUid) {
    const error = new Error("Only the configured Nyx Owner can manage custom roles.");
    error.status = 403;
    throw error;
  }
  return context;
}

async function linkCheckerBulkSubscriber(req) {
  const { firebase, token } = await authenticatedNyxUser(req, false);
  const cached = linkCheckerBulkAccessCache.get(token.uid);
  let subscriptionStatus = cached?.expiresAt > Date.now() ? cached.subscriptionStatus : "";
  let role = cached?.expiresAt > Date.now() ? cached.role : "";
  let staffAccess = cached?.expiresAt > Date.now() ? cached.staffAccess === true : false;
  if (!subscriptionStatus || !role) {
    const administration = (await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get()).data() || {};
    subscriptionStatus = normalizeSubscriptionStatus(administration.subscriptionStatus || administration.subscription?.status);
    role = nyxRoleForUser(token.uid, administration);
    const customRole = nyxAssignedCustomRole(administration, await nyxCustomRoles(firebase));
    staffAccess = customRole ? customRole.permissions.includes("link-scanner:bulk") : nyxRolePolicy(role).rank >= nyxRolePolicy("moderator").rank;
    linkCheckerBulkAccessCache.set(token.uid, { subscriptionStatus, role, staffAccess, expiresAt: Date.now() + linkCheckerBulkAccessCacheTtlMs });
  }
  if (!hasPremiumSubscription(subscriptionStatus) && !staffAccess) {
    const error = new Error("Premium, Trial, or Moderator access is required to run a full registry scan.");
    error.status = 403;
    throw error;
  }
  return { firebase, token, subscriber: { uid: token.uid, subscriptionStatus, role, staffAccess } };
}

async function nyxOwnerTargetAccess(firebase, actor, uid, ownerUid = founderProfileConfig().administratorUid) {
  const administration = uid === ownerUid
    ? { role: "owner" }
    : (await firebase.firestore.collection("nyxUserAdministration").doc(uid).get()).data() || {};
  const targetRole = nyxRoleForUser(uid, administration, ownerUid);
  return {
    targetRole,
    capabilities: nyxOwnerUserCapabilities(actor, targetRole, uid, ownerUid)
  };
}

async function firestoreDocumentsById(firestore, collectionName, ids, fieldMask = []) {
  const uniqueIds = [...new Set(ids.map(value => String(value || "")).filter(Boolean))];
  const result = new Map();
  for (let offset = 0; offset < uniqueIds.length; offset += 250) {
    const refs = uniqueIds.slice(offset, offset + 250).map(id => firestore.collection(collectionName).doc(id));
    if (!refs.length) continue;
    const snapshots = await firestore.getAll(...refs, ...(fieldMask.length ? [{ fieldMask }] : []));
    snapshots.forEach(snapshot => {
      if (snapshot.exists) result.set(snapshot.id, snapshot.data() || {});
    });
  }
  return result;
}

async function recordNyxAudit(firebase, {
  actorUid = "",
  actorEmail = "",
  action,
  targetUid = "",
  targetEmail = "",
  details = {}
}) {
  const cleanAction = String(action || "").trim().slice(0, 80);
  if (!cleanAction) return;
  const cleanDetails = {};
  Object.entries(details && typeof details === "object" ? details : {}).slice(0, 20).forEach(([key, value]) => {
    const safeKey = String(key || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    if (!safeKey) return;
    if (typeof value === "boolean" || typeof value === "number") cleanDetails[safeKey] = value;
    else cleanDetails[safeKey] = String(value ?? "").slice(0, 240);
  });
  await firebase.firestore.collection("nyxAuditLog").add({
    actorUid: String(actorUid || "").slice(0, 128),
    actorEmail: String(actorEmail || "").slice(0, 254),
    action: cleanAction,
    targetUid: String(targetUid || "").slice(0, 128),
    targetEmail: String(targetEmail || "").slice(0, 254),
    details: cleanDetails,
    createdAt: new Date().toISOString(),
    createdAtMs: Date.now()
  });
}

async function recordNyxAuditSafe(firebase, event) {
  try {
    await recordNyxAudit(firebase, event);
  } catch (error) {
    console.error("Nyx audit event could not be recorded:", error?.message || error);
  }
}

async function listAllFirebaseUsers(auth, limit = ownerDashboardUserScanLimit) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(Math.min(1000, limit - users.length), pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken && users.length < limit);
  return { users, truncated: Boolean(pageToken) };
}

function nyxOwnerUserRecord(user, administration = {}, profileData = {}, activity = {}, ownerUid = "", includeProfileMedia = false, includeNetworkDetails = false, customRoles = new Map()) {
  const profile = normalizeNyxUserProfile(profileData?.profile);
  const email = String(user.email || "");
  const emailUsername = email.split("@")[0] || user.uid.slice(0, 8);
  const profileUsername = String(profile.handle || "").replace(/^@/, "");
  const role = nyxRoleForUser(user.uid, administration, ownerUid);
  const customRole = nyxAssignedCustomRole(administration, customRoles);
  const subscriptionStatus = normalizeSubscriptionStatus(administration.subscriptionStatus || administration.subscription?.status);
  const monthlyRevenueCents = Math.max(0, Math.min(100_000_000, Number(administration.monthlyRevenueCents || administration.subscription?.monthlyRevenueCents || 0) || 0));
  const lastActiveAtMs = safeActivityTime(activity.lastActiveAtMs || activity.lastActiveAt);
  const now = Date.now();
  return {
    uid: user.uid,
    displayName: String(profile.displayName || user.displayName || emailUsername).slice(0, 80),
    username: String(profileUsername || administration.username || emailUsername).slice(0, 80),
    email,
    deliverableEmail: nyxDeliverableEmail(email),
    role,
    customRole: nyxPublicCustomRole(customRole),
    subscriptionStatus,
    monthlyRevenueCents,
    createdAt: safeDateIso(user.metadata?.creationTime),
    lastSignInAt: safeDateIso(user.metadata?.lastSignInTime),
    lastActiveAt: lastActiveAtMs ? new Date(lastActiveAtMs).toISOString() : "",
    lastSeenIp: includeNetworkDetails ? normalizeNyxIp(administration.lastSeenIp) : "",
    lastSeenIpAt: includeNetworkDetails ? safeDateIso(administration.lastSeenIpAt) : "",
    online: Boolean(lastActiveAtMs && now - lastActiveAtMs <= signedInOnlineWindowMs),
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    photoUrl: includeProfileMedia ? String(profile.avatarUrl || user.photoURL || "") : (/^data:image\//i.test(String(profile.avatarUrl || user.photoURL || "")) ? "" : String(profile.avatarUrl || user.photoURL || "").slice(0, 1_500)),
    profile: {
      displayName: profile.displayName,
      handle: profile.handle,
      bio: profile.bio,
      customStatus: profile.customStatus,
      status: profile.status,
      avatarUrl: includeProfileMedia ? profile.avatarUrl : "",
      bannerUrl: includeProfileMedia ? profile.bannerUrl : "",
      accentPrimary: profile.accentPrimary,
      accentSecondary: profile.accentSecondary,
      bannerColor: profile.bannerColor,
      displayNameFont: profile.displayNameFont,
      displayNameEffect: profile.displayNameEffect,
      displayNameColorPrimary: profile.displayNameColorPrimary,
      displayNameColorSecondary: profile.displayNameColorSecondary,
      profileEffect: profile.profileEffect,
      customEffectPattern: profile.customEffectPattern,
      customEffectColorPrimary: profile.customEffectColorPrimary,
      customEffectColorSecondary: profile.customEffectColorSecondary,
      customEffectSpeed: profile.customEffectSpeed,
      customEffectIntensity: profile.customEffectIntensity,
      avatarDecoration: profile.avatarDecoration
    }
  };
}

function nyxOwnerUserForViewer(user, viewerUid = "", ownerUid = founderProfileConfig().administratorUid) {
  if (!user || user.guest) return user;
  const presentation = nyxRolePresentation(user.role, user.customRole, user.uid, viewerUid, ownerUid);
  return { ...user, role: presentation.role, customRole: presentation.customRole };
}

function nyxChatChannelDefinition(value, fallback = null) {
  const source = value && typeof value === "object" ? value : {};
  const id = String(source.id || fallback?.id || "").trim().toLowerCase();
  if (!nyxChatChannelIdPattern.test(id)) return null;
  return {
    id,
    name: founderProfileText(source.name, fallback?.name || "Channel", 32),
    description: founderProfileText(source.description, fallback?.description || "Nyx community channel.", 140),
    minimumRole: nyxRolePolicies[String(source.minimumRole || fallback?.minimumRole || "member").trim().toLowerCase()] ? String(source.minimumRole || fallback?.minimumRole || "member").trim().toLowerCase() : "member"
  };
}

function nyxChatCanAccessChannel(role, channel) {
  return nyxRolePolicy(role).rank >= nyxRolePolicy(channel?.minimumRole || "member").rank;
}

function normalizeNyxChatChannelList(value, defaults, limit) {
  const source = Array.isArray(value) ? value : defaults;
  const seen = new Set();
  return source.map((entry, index) => nyxChatChannelDefinition(entry, defaults[index] || null)).filter(entry => {
    if (!entry || seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  }).slice(0, limit);
}

async function loadNyxChatConfiguration(firebase, force = false) {
  const now = Date.now();
  if (!force && nyxChatConfigurationCache.value && nyxChatConfigurationCache.expiresAt > now) return nyxChatConfigurationCache.value;
  if (!force && nyxChatConfigurationCache.promise) return nyxChatConfigurationCache.promise;
  const promise = (async () => {
    const configurationRef = firebase.firestore.collection(nyxChatConfigurationCollection).doc(nyxChatConfigurationDocument);
    const snapshot = await configurationRef.get();
    const data = snapshot.data() || {};
    const textChannels = normalizeNyxChatChannelList(data.textChannels, nyxChatChannels, 24);
    const voiceChannels = normalizeNyxChatChannelList(data.voiceChannels, nyxChatVoiceChannels, 12);
    if (data.restrictedChannelsInitialized !== true) {
      const staffChannel = nyxChatChannelDefinition(nyxChatChannels.find(channel => channel.id === "staff-room"));
      if (staffChannel && !textChannels.some(channel => channel.id === staffChannel.id)) textChannels.push(staffChannel);
      await configurationRef.set({ textChannels, restrictedChannelsInitialized: true }, { merge: true });
    }
    const value = {
      textChannels: textChannels.length ? textChannels : [...nyxChatChannels],
      voiceChannels: voiceChannels.length ? voiceChannels : [...nyxChatVoiceChannels]
    };
    nyxChatConfigurationCache = { expiresAt: Date.now() + nyxChatConfigurationTtlMs, value, promise: null };
    return value;
  })();
  nyxChatConfigurationCache.promise = promise;
  try {
    return await promise;
  } catch (error) {
    nyxChatConfigurationCache.promise = null;
    throw error;
  }
}

function nyxChatChannel(value) {
  const channel = String(value || "general").trim().toLowerCase();
  return nyxChatChannelIdPattern.test(channel) ? channel : "";
}

function nyxChatAvatar(value) {
  const source = String(value || "").trim();
  if (/^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/avatar\/[A-Za-z0-9_-]{12,80}$/.test(source)) return source;
  return /^https:\/\/[^\s]{1,1900}$/i.test(source) ? source : "";
}

function nyxChatText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function nyxSearchHistoryEntry(value) {
  const query = String(value || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
  if (!query) return { query: "", category: "", flagged: false };
  const matched = nyxSearchHistoryPatterns.find(rule => rule.pattern.test(query));
  return { query, category: matched?.category || "Standard search", flagged: Boolean(matched) };
}

function consumeNyxSearchHistoryAttempt(uid) {
  const now = Date.now();
  const active = (nyxSearchHistoryAttempts.get(uid) || []).filter(timestamp => now - timestamp < 60 * 60_000);
  if (active.length >= 300) {
    const error = new Error("Search history recording is temporarily rate limited.");
    error.status = 429;
    throw error;
  }
  active.push(now);
  nyxSearchHistoryAttempts.set(uid, active);
}

async function cleanupNyxSearchHistory(firebase, now = Date.now()) {
  if (now - nyxSearchHistoryLastCleanupAt < 60 * 60_000) return;
  nyxSearchHistoryLastCleanupAt = now;
  try {
    const snapshot = await firebase.firestore.collection(nyxSearchHistoryCollection).where("expiresAtMs", "<", now).limit(200).get();
    await Promise.all(snapshot.docs.map(document => document.ref.delete()));
  } catch (error) {
    console.error("Nyx search-history cleanup failed:", error?.message || error);
  }
}

async function nyxSearchHistoryClearCapability(firebase, identity, targetUid) {
  const ownerUid = founderProfileConfig().administratorUid;
  const administration = targetUid === ownerUid
    ? { role: "owner" }
    : (await firebase.firestore.collection("nyxUserAdministration").doc(targetUid).get()).data() || {};
  const targetRole = nyxRoleForUser(targetUid, administration, ownerUid);
  const actorRank = nyxRolePolicy(identity.role).rank;
  const targetRank = nyxRolePolicy(targetRole).rank;
  const founderOwner = identity.uid === ownerUid && identity.role === "owner";
  return {
    allowed: identity.uid === targetUid || founderOwner || (targetUid !== ownerUid && actorRank > targetRank),
    targetRole
  };
}

function nyxChatCanModerate(role) {
  return nyxRolePolicy(role).rank >= nyxRolePolicy("moderator").rank;
}

function nyxChatCanManageChannels(role) {
  return ["owner", "co_owner", "admin", "manager"].includes(String(role || ""));
}

function nyxChatMuteDuration(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d{1,4})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/);
  if (!match) return 0;
  const amount = Number(match[1]);
  const unit = match[2][0];
  const multiplier = unit === "m" ? 60_000 : unit === "h" ? 60 * 60_000 : unit === "d" ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000;
  const durationMs = amount * multiplier;
  return durationMs >= nyxChatMuteMinimumMs && durationMs <= nyxChatMuteMaximumMs ? durationMs : 0;
}

function nyxChatMutePayload(value, now = Date.now()) {
  const source = value && typeof value === "object" ? value : {};
  const expiresAtMs = Math.max(0, Number(source.expiresAtMs || 0));
  if (expiresAtMs <= now) return null;
  return {
    targetUid: String(source.targetUid || ""),
    reason: founderProfileText(source.reason, "No reason provided.", 180),
    moderatorUid: String(source.moderatorUid || ""),
    moderatorDisplayName: founderProfileText(source.moderatorDisplayName, "Nyx moderator", 48),
    createdAtMs: Math.max(0, Number(source.createdAtMs || 0)),
    expiresAtMs
  };
}

async function nyxChatActiveMute(firebase, uid, now = Date.now()) {
  const key = String(uid || "").trim();
  if (!key) return null;
  const cached = nyxChatMuteCache.get(key);
  if (cached && cached.cacheExpiresAtMs > now) return cached.value;
  const ref = firebase.firestore.collection(nyxChatMuteCollection).doc(key);
  const snapshot = await ref.get();
  const mute = snapshot.exists ? nyxChatMutePayload(snapshot.data(), now) : null;
  nyxChatMuteCache.set(key, { value: mute, cacheExpiresAtMs: Math.min(mute?.expiresAtMs || Infinity, now + nyxChatMuteCacheTtlMs) });
  if (snapshot.exists && !mute) void ref.delete().catch(() => {});
  return mute;
}

async function assertNyxChatCanSend(firebase, uid) {
  const mute = await nyxChatActiveMute(firebase, uid);
  if (!mute) return;
  const error = new Error(`You are muted from Nyx Chat until ${new Date(mute.expiresAtMs).toLocaleString("en-US")}. Reason: ${mute.reason}`);
  error.status = 403;
  throw error;
}

function nyxChatRole(value) {
  return String(value || "").trim().toLowerCase() === "owner" ? "owner" : normalizeNyxRole(value);
}

function nyxChatAttachmentName(value) {
  return String(value || "attachment")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "-")
    .trim()
    .slice(0, 120) || "attachment";
}

function nyxChatAttachmentMetadata(value) {
  const source = value && typeof value === "object" ? value : {};
  const id = String(source.id || "").trim();
  const mime = String(source.mime || "").trim().toLowerCase();
  const size = Math.max(0, Number(source.size || 0));
  const streamed = source.storage === "disk";
  const sizeLimit = streamed ? nyxChatOwnerAttachmentFileLimit : nyxChatAttachmentFileLimit;
  if (!nyxChatAttachmentIdPattern.test(id) || !nyxChatAttachmentMimeTypes.has(mime) || !Number.isFinite(size) || size < 1 || size > sizeLimit) return null;
  return {
    id,
    name: nyxChatAttachmentName(source.name),
    mime,
    size,
    streamed,
    image: mime.startsWith("image/"),
    audio: mime.startsWith("audio/"),
    video: mime.startsWith("video/"),
    url: `/api/chat/attachments/${id}`
  };
}

function nyxChatAttachmentDiskPath(value) {
  const id = String(value || "").trim();
  if (!nyxChatAttachmentIdPattern.test(id)) return "";
  const path = resolve(nyxChatAttachmentRoot, id);
  return path.startsWith(`${nyxChatAttachmentRoot}${process.platform === "win32" ? "\\" : "/"}`) ? path : "";
}

async function nyxChatAttachmentAccess(firebase, uid, data = {}) {
  if (data.scopeType === "conversation") {
    await nyxChatScope(firebase, uid, { conversationId: data.scopeId });
    return;
  }
  const channel = nyxChatChannel(data.scopeId);
  if (!channel) {
    const error = new Error("Attachment not found.");
    error.status = 404;
    throw error;
  }
  await nyxChatScope(firebase, uid, { channel });
}

function nyxChatAttachmentStream(req, res, metadata, path) {
  const range = String(req.get("range") || "").match(/^bytes=(\d*)-(\d*)$/i);
  let start = 0;
  let end = metadata.size - 1;
  if (range) {
    if (range[1]) start = Number(range[1]);
    if (range[2]) end = Number(range[2]);
    if (!range[1] && range[2]) {
      const suffix = Math.min(metadata.size, Number(range[2]));
      start = metadata.size - suffix;
      end = metadata.size - 1;
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= metadata.size) {
      res.status(416).set("Content-Range", `bytes */${metadata.size}`).end();
      return;
    }
    end = Math.min(end, metadata.size - 1);
  }
  const asciiName = metadata.name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 100) || "attachment";
  const disposition = metadata.image || metadata.audio || metadata.video ? "inline" : "attachment";
  res.status(range ? 206 : 200).set({
    "Accept-Ranges": "bytes",
    "Content-Type": metadata.mime,
    "Content-Length": String(end - start + 1),
    "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    "X-Content-Type-Options": "nosniff",
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${metadata.size}` } : {})
  });
  const stream = createReadStream(path, { start, end });
  stream.on("error", () => {
    if (!res.headersSent) res.status(404).end();
    else res.destroy();
  });
  stream.pipe(res);
}

async function cleanupNyxChatDiskUploads(firebase, now = Date.now()) {
  if (now - nyxChatAttachmentLastCleanupAt < 15 * 60_000) return;
  nyxChatAttachmentLastCleanupAt = now;
  try {
    const snapshot = await firebase.firestore.collection("nyxChatAttachments").where("expiresAtMs", ">", 0).where("expiresAtMs", "<", now).limit(40).get();
    const expired = snapshot.docs.filter(document => document.data()?.storage === "disk" && document.data()?.bound !== true);
    await Promise.all(expired.map(async document => {
      await document.ref.delete();
      const path = nyxChatAttachmentDiskPath(document.id);
      if (path) await unlink(path).catch(() => {});
    }));
  } catch (error) {
    console.error("Nyx chat attachment cleanup failed:", error?.message || error);
  }
}

function nyxChatReactionPayload(value, viewerUid) {
  if (!Array.isArray(value)) return [];
  return value.map(entry => {
    const emoji = String(entry?.emoji || "");
    const uids = [...new Set((Array.isArray(entry?.uids) ? entry.uids : []).map(uid => String(uid || "").trim()).filter(Boolean))].slice(0, 250);
    return nyxChatReactionEmoji.has(emoji) && uids.length ? { emoji, count: uids.length, self: uids.includes(viewerUid) } : null;
  }).filter(Boolean);
}

function nyxChatCustomRole(value) {
  const role = value && typeof value === "object" ? nyxCustomRoleRecord(value.id, value) : null;
  return nyxPublicCustomRole(role);
}

function nyxChatMessagePayload(document, viewerUid = "") {
  const value = document?.data?.() || {};
  const author = value.author && typeof value.author === "object" ? value.author : {};
  const createdAtMs = Math.max(0, Number(value.createdAtMs || 0));
  const conversationId = nyxChatConversationIdPattern.test(String(value.conversationId || "")) ? String(value.conversationId) : "";
  const authorUid = String(author.uid || value.authorUid || "");
  const authorCustomRole = nyxChatCustomRole(author.customRole);
  const authorPresentation = nyxRolePresentation(nyxChatRole(author.role), authorCustomRole, authorUid, viewerUid);
  return {
    id: String(document?.id || ""),
    channel: conversationId ? "" : (nyxChatChannel(value.channel) || "general"),
    conversationId,
    text: nyxChatText(value.text).slice(0, nyxChatMessageLimit),
    attachments: (Array.isArray(value.attachments) ? value.attachments : []).map(nyxChatAttachmentMetadata).filter(Boolean).slice(0, nyxChatAttachmentCountLimit),
    reactions: nyxChatReactionPayload(value.reactions, viewerUid),
    createdAt: safeDateIso(value.createdAt, createdAtMs ? new Date(createdAtMs).toISOString() : ""),
    createdAtMs,
    author: {
      uid: authorUid,
      displayName: founderProfileText(author.displayName, "Nyx member", 48),
      handle: `@${nyxProfileUsername(author.handle, "nyx-user")}`,
      avatarUrl: nyxChatAvatar(author.avatarUrl),
      role: authorPresentation.role,
      customRole: authorPresentation.customRole,
      caffeine: author.caffeine === true
    }
  };
}

function nyxChatConversationId(leftUid, rightUid) {
  return createHash("sha256").update([String(leftUid || ""), String(rightUid || "")].sort().join(":"), "utf8").digest("hex").slice(0, 40);
}

function nyxChatConversationMember(value, fallbackUid = "", viewerUid = "") {
  const source = value && typeof value === "object" ? value : {};
  const uid = String(source.uid || fallbackUid || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return null;
  const customRole = nyxChatCustomRole(source.customRole);
  const presentation = nyxRolePresentation(nyxChatRole(source.role), customRole, uid, viewerUid);
  return {
    uid,
    displayName: founderProfileText(source.displayName, "Nyx member", 48),
    handle: `@${nyxProfileUsername(source.handle, "nyx-user")}`,
    avatarUrl: nyxChatAvatar(source.avatarUrl),
    role: presentation.role,
    customRole: presentation.customRole,
    roleLabel: presentation.roleLabel,
    caffeine: source.caffeine === true
  };
}

function nyxChatConversationPayload(document, viewerUid, membersByUid = new Map()) {
  const value = document?.data?.() || {};
  const participants = [...new Set((Array.isArray(value.participants) ? value.participants : []).map(uid => String(uid || "").trim()).filter(uid => /^[A-Za-z0-9_-]{8,128}$/.test(uid)))];
  if (!document?.id || participants.length !== 2 || !participants.includes(viewerUid)) return null;
  const otherUid = participants.find(uid => uid !== viewerUid) || viewerUid;
  const stored = value.participantProfiles && typeof value.participantProfiles === "object" ? value.participantProfiles[otherUid] : null;
  const other = nyxChatConversationMember(membersByUid.get(otherUid) || stored, otherUid, viewerUid);
  if (!other) return null;
  return {
    id: String(document.id),
    other,
    updatedAtMs: Math.max(0, Number(value.updatedAtMs || value.createdAtMs || 0)),
    lastMessageAtMs: Math.max(0, Number(value.lastMessageAtMs || 0)),
    lastMessageText: founderProfileText(value.lastMessageText, "", 120),
    lastMessageAuthorUid: String(value.lastMessageAuthorUid || "")
  };
}

async function nyxChatScope(firebase, uid, source = {}) {
  const rawScope = String(source.scope || "").trim().toLowerCase();
  const explicitChannel = String(source.channel || "").trim();
  const rawChannel = explicitChannel || (!nyxChatConversationIdPattern.test(rawScope) && nyxChatChannelIdPattern.test(rawScope) ? rawScope : "");
  const channel = rawChannel ? nyxChatChannel(rawChannel) : "";
  if (channel) {
    const configuration = await loadNyxChatConfiguration(firebase);
    const channelDefinition = configuration.textChannels.find(entry => entry.id === channel);
    if (!channelDefinition) {
      const error = new Error("That chat channel does not exist.");
      error.status = 404;
      throw error;
    }
    const administration = await firebase.firestore.collection("nyxUserAdministration").doc(uid).get();
    const role = nyxRoleForUser(uid, administration.data() || {});
    if (!nyxChatCanAccessChannel(role, channelDefinition)) {
      const error = new Error("Your role cannot access that chat channel.");
      error.status = 403;
      throw error;
    }
    return {
      type: "channel",
      id: channel,
      key: channel,
      private: false,
      ref: firebase.firestore.collection("nyxChatChannels").doc(channel),
      messages: firebase.firestore.collection("nyxChatChannels").doc(channel).collection("messages")
    };
  }
  const conversationId = String(source.conversationId || source.conversation || source.scope || "").trim();
  if (!nyxChatConversationIdPattern.test(conversationId)) {
    const error = new Error("That chat conversation does not exist.");
    error.status = 400;
    throw error;
  }
  const ref = firebase.firestore.collection("nyxChatConversations").doc(conversationId);
  const snapshot = await ref.get();
  const participants = (Array.isArray(snapshot.data()?.participants) ? snapshot.data().participants : []).map(value => String(value || ""));
  if (!snapshot.exists || participants.length !== 2 || !participants.includes(uid)) {
    const error = new Error("That private conversation was not found.");
    error.status = 404;
    throw error;
  }
  return { type: "conversation", id: conversationId, key: conversationId, private: true, ref, snapshot, participants, messages: ref.collection("messages") };
}

function nyxChatConsumeSendAttempt(uid) {
  const now = Date.now();
  const recent = (nyxChatSendAttempts.get(uid) || []).filter(timestamp => now - timestamp < nyxChatSendWindowMs);
  if (recent.length >= nyxChatSendMaxPerWindow) {
    const error = new Error("You are sending messages too quickly. Wait a moment and try again.");
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((nyxChatSendWindowMs - (now - recent[0])) / 1000));
    throw error;
  }
  recent.push(now);
  nyxChatSendAttempts.set(uid, recent);
  if (nyxChatSendAttempts.size > 2_000) {
    for (const [key, values] of nyxChatSendAttempts) {
      if (!values.some(timestamp => now - timestamp < nyxChatSendWindowMs)) nyxChatSendAttempts.delete(key);
    }
  }
}

function recordNyxChatRealtimeEvent(event = {}) {
  nyxChatRealtimeRevision = Math.max(nyxChatRealtimeRevision + 1, Date.now());
  nyxChatRealtimeEvents.push({
    revision: nyxChatRealtimeRevision,
    kind: String(event.kind || "message"),
    scopeType: String(event.scopeType || ""),
    scopeId: String(event.scopeId || ""),
    participants: [...new Set((Array.isArray(event.participants) ? event.participants : []).map(value => String(value || "")).filter(Boolean))].slice(0, 4),
    createdAtMs: Math.max(0, Number(event.createdAtMs || Date.now())),
    lastMessageText: founderProfileText(event.lastMessageText, "", nyxChatMessageLimit),
    lastMessageAuthorUid: String(event.lastMessageAuthorUid || "")
  });
  if (nyxChatRealtimeEvents.length > nyxChatRealtimeEventLimit) {
    const removed = nyxChatRealtimeEvents.splice(0, nyxChatRealtimeEvents.length - nyxChatRealtimeEventLimit);
    nyxChatRealtimeDroppedBeforeRevision = Math.max(nyxChatRealtimeDroppedBeforeRevision, Number(removed.at(-1)?.revision || 0));
  }
  return nyxChatRealtimeRevision;
}

function nyxChatMentionHandles(text) {
  return [...String(text || "").toLowerCase().matchAll(/(?:^|[^a-z0-9_.-])@([a-z0-9_.-]+)/g)]
    .map(match => match[1]);
}

function nyxChatEventMentionsIdentity(text, identity = {}) {
  const mentions = nyxChatMentionHandles(text);
  if (mentions.includes("everyone")) return true;
  const handle = String(identity.handle || "").toLowerCase().replace(/^@/, "");
  return Boolean(handle && mentions.includes(handle));
}

function nyxChatSocketUserRoom(uid) {
  return `nyx:user:${String(uid || "")}`;
}

function nyxChatSocketChannelRoom(channelId) {
  return `nyx:channel:${String(channelId || "")}`;
}

function nyxChatSocketIdsForEvent(event = {}) {
  if (!nyxChatSocketServer) return new Set();
  const ids = new Set();
  const rooms = [];
  const participants = [...new Set((Array.isArray(event.participants) ? event.participants : [])
    .map(value => String(value || ""))
    .filter(Boolean))];
  if (participants.length) rooms.push(...participants.map(nyxChatSocketUserRoom));
  else if (event.scopeType === "channel" && event.scopeId) rooms.push(nyxChatSocketChannelRoom(event.scopeId));
  if (!rooms.length) {
    for (const socketId of nyxChatSocketServer.sockets.sockets.keys()) ids.add(socketId);
    return ids;
  }
  for (const room of rooms) {
    for (const socketId of nyxChatSocketServer.sockets.adapter.rooms.get(room) || []) ids.add(socketId);
  }
  return ids;
}

function nyxChatSocketEventForViewer(event = {}, socket) {
  const uid = String(socket?.data?.uid || "");
  const identity = socket?.data?.identity || {};
  const payload = {
    revision: Math.max(0, Number(event.revision || nyxChatRealtimeRevision)),
    kind: String(event.kind || "update"),
    scopeType: String(event.scopeType || ""),
    scopeId: String(event.scopeId || ""),
    createdAtMs: Math.max(0, Number(event.createdAtMs || Date.now()))
  };
  if (event.kind === "message" && event.messageDocument) {
    payload.message = nyxChatMessagePayload(event.messageDocument, uid);
    payload.mentionsViewer = nyxChatEventMentionsIdentity(event.messageText, identity);
    payload.lastMessageAuthorUid = String(event.lastMessageAuthorUid || payload.message?.author?.uid || "");
  } else if (event.kind === "delete") {
    payload.messageId = String(event.messageId || "");
  } else if (event.kind === "reaction") {
    payload.messageId = String(event.messageId || "");
    payload.reactions = nyxChatReactionPayload(event.reactions, uid);
  } else if (event.kind === "presence") {
    payload.uid = String(event.uid || "");
    payload.online = event.online === true;
  }
  return payload;
}

function emitNyxChatSocketEvent(event = {}) {
  if (!nyxChatSocketServer) return 0;
  const socketIds = nyxChatSocketIdsForEvent(event);
  for (const socketId of socketIds) {
    const socket = nyxChatSocketServer.sockets.sockets.get(socketId);
    if (socket) socket.emit("nyx:chat:event", nyxChatSocketEventForViewer(event, socket));
  }
  return socketIds.size;
}

async function authorizeNyxChatSocket(socket, rawToken) {
  const value = String(rawToken || "").trim();
  if (!value || value.length > 8_192 || !firebaseAdminModeConfigured()) throw new Error("Sign in to use Nyx Chat.");
  const firebase = await linkGeneratorFirebase();
  const token = await firebase.auth.verifyIdToken(value, true);
  if (socket.data.uid && socket.data.uid !== token.uid) throw new Error("The Nyx Chat account changed.");
  const [identity, configuration] = await Promise.all([
    nyxChatIdentity(firebase, token),
    loadNyxChatConfiguration(firebase)
  ]);
  const visibleChannels = new Set(configuration.textChannels
    .filter(channel => nyxChatCanAccessChannel(identity.role, channel))
    .map(channel => channel.id));
  for (const room of [...socket.rooms]) {
    if (room.startsWith("nyx:channel:") && !visibleChannels.has(room.slice("nyx:channel:".length))) socket.leave(room);
  }
  socket.join(nyxChatSocketUserRoom(token.uid));
  for (const channelId of visibleChannels) socket.join(nyxChatSocketChannelRoom(channelId));
  socket.data.uid = token.uid;
  socket.data.identity = identity;
  socket.data.token = value;
  signedInPresence.set(token.uid, Date.now());
  return { firebase, token, identity, configuration };
}

async function refreshNyxChatSocketAuthorizations() {
  if (!nyxChatSocketServer) return;
  await Promise.allSettled([...nyxChatSocketServer.sockets.sockets.values()].map(async socket => {
    try {
      await authorizeNyxChatSocket(socket, socket.data.token);
    } catch {
      socket.disconnect(true);
    }
  }));
}

function attachNyxChatSocketServer(server) {
  if (nyxChatSocketServer) return nyxChatSocketServer;
  const io = new SocketIOServer(server, {
    path: "/socket.io",
    serveClient: true,
    maxHttpBufferSize: 100_000,
    perMessageDeflate: false,
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60_000,
      skipMiddlewares: false
    },
    allowRequest(req, callback) {
      if (!embeddedWispOriginAllowed(req.headers.origin, req.headers.host)) {
        callback("Origin is not allowed.", false);
        return;
      }
      Promise.resolve(nyxRequestIpIsBanned(req))
        .then(banned => callback(null, !banned))
        .catch(error => {
          console.error("Nyx Chat socket IP ban check could not be completed:", error?.message || error);
          callback(null, true);
        });
    }
  });
  nyxChatSocketServer = io;
  io.use(async (socket, next) => {
    try {
      await authorizeNyxChatSocket(socket, socket.handshake.auth?.token);
      next();
    } catch {
      const error = new Error("Your Nyx Chat session has expired.");
      error.data = { code: "NYX_CHAT_AUTH" };
      next(error);
    }
  });
  io.on("connection", socket => {
    const uid = String(socket.data.uid || "");
    socket.emit("nyx:chat:ready", { revision: nyxChatRealtimeRevision });
    if (uid) emitNyxChatSocketEvent({ kind: "presence", uid, online: true });
    socket.on("nyx:chat:authorize", async (value, acknowledge) => {
      try {
        await authorizeNyxChatSocket(socket, value?.token);
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      } catch {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: "Your Nyx Chat session has expired.", code: "NYX_CHAT_AUTH" });
        socket.disconnect(true);
      }
    });
    socket.on("nyx:voice:signal", (value, acknowledge) => {
      try {
        relayNyxChatVoiceSignal(uid, value);
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      } catch (error) {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: error.message || "The voice connection could not be relayed.", status: error.status || 503 });
      }
    });
    socket.on("disconnect", () => {
      if (!uid) return;
      queueMicrotask(() => {
        const remaining = nyxChatSocketServer?.sockets.adapter.rooms.get(nyxChatSocketUserRoom(uid))?.size || 0;
        if (!remaining) emitNyxChatSocketEvent({ kind: "presence", uid, online: false });
      });
    });
  });
  return io;
}

async function nyxChatMemberDirectory(firebase) {
  const now = Date.now();
  if (nyxChatMemberDirectoryCache.value && nyxChatMemberDirectoryCache.expiresAt > now) return nyxChatMemberDirectoryCache.value;
  if (nyxChatMemberDirectoryCache.promise) return nyxChatMemberDirectoryCache.promise;
  const promise = (async () => {
    const profileSnapshot = await firebase.firestore.collection("nyxUserProfiles").limit(250).get();
    const uids = profileSnapshot.docs.map(document => document.id);
    const [administration, activity, customRoles] = await Promise.all([
      firestoreDocumentsById(firebase.firestore, "nyxUserAdministration", uids),
      firestoreDocumentsById(firebase.firestore, "nyxUserActivity", uids),
      nyxCustomRoles(firebase)
    ]);
    const ownerUid = founderProfileConfig().administratorUid;
    return profileSnapshot.docs.map(document => {
      const profile = normalizeNyxUserProfile(document.data()?.profile, { uid: document.id });
      const memberAdministration = administration.get(document.id) || {};
      const role = nyxRoleForUser(document.id, memberAdministration, ownerUid);
      const customRole = nyxAssignedCustomRole(memberAdministration, customRoles);
      return {
        uid: document.id,
        displayName: profile.displayName,
        handle: profile.handle,
        avatarUrl: nyxChatAvatar(profile.avatarUrl),
        role,
        customRole: nyxPublicCustomRole(customRole),
        roleLabel: customRole?.label || nyxRoleLabels[role] || nyxRoleLabels.member,
        caffeine: nyxCaffeineEntitlement(document.id, memberAdministration).active,
        lastActiveAtMs: safeActivityTime(activity.get(document.id)?.lastActiveAtMs || activity.get(document.id)?.lastActiveAt)
      };
    });
  })();
  nyxChatMemberDirectoryCache.promise = promise;
  try {
    const value = await promise;
    nyxChatMemberDirectoryCache = { expiresAt: Date.now() + nyxChatMemberDirectoryCacheTtlMs, value, promise: null };
    return value;
  } catch (error) {
    nyxChatMemberDirectoryCache.promise = null;
    throw error;
  }
}

function nyxChatMemberForViewer(member, viewerUid = "", ownerUid = founderProfileConfig().administratorUid) {
  const presentation = nyxRolePresentation(member?.role, member?.customRole, member?.uid, viewerUid, ownerUid);
  return { ...member, role: presentation.role, roleLabel: presentation.roleLabel, customRole: presentation.customRole };
}

async function nyxChatChannelActivity(firebase, channels) {
  const ids = channels.map(channel => channel.id);
  const now = Date.now();
  if (nyxChatChannelActivityCache.expiresAt > now && ids.every(id => nyxChatChannelActivityCache.value.has(id))) {
    return ids.map(id => [id, Number(nyxChatChannelActivityCache.value.get(id) || 0)]);
  }
  if (nyxChatChannelActivityCache.promise) {
    await nyxChatChannelActivityCache.promise;
    return ids.map(id => [id, Number(nyxChatChannelActivityCache.value.get(id) || 0)]);
  }
  const promise = (async () => {
    const snapshots = await Promise.all(ids.map(id => firebase.firestore.collection("nyxChatChannels").doc(id).get()));
    const value = new Map(nyxChatChannelActivityCache.value);
    snapshots.forEach((snapshot, index) => value.set(ids[index], Number(snapshot.data()?.lastMessageAtMs || 0)));
    nyxChatChannelActivityCache = { expiresAt: Date.now() + nyxChatChannelActivityCacheTtlMs, value, promise: null };
  })();
  nyxChatChannelActivityCache.promise = promise;
  try {
    await promise;
  } catch (error) {
    nyxChatChannelActivityCache.promise = null;
    throw error;
  }
  return ids.map(id => [id, Number(nyxChatChannelActivityCache.value.get(id) || 0)]);
}

async function nyxChatIdentity(firebase, token) {
  const uid = String(token.uid || "");
  const now = Date.now();
  const cached = nyxChatIdentityCache.get(uid);
  if (cached?.value && cached.expiresAt > now) return cached.value;
  if (cached?.promise) return cached.promise;
  const promise = (async () => {
    const [profileSnapshot, administrationSnapshot, customRoles] = await Promise.all([
      firebase.firestore.collection("nyxUserProfiles").doc(uid).get(),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get(),
      nyxCustomRoles(firebase)
    ]);
    const profile = normalizeNyxUserProfile(profileSnapshot.data()?.profile, token);
    const administration = administrationSnapshot.data() || {};
    const role = nyxRoleForUser(uid, administration);
    const customRole = nyxAssignedCustomRole(administration, customRoles);
    const caffeine = nyxCaffeineEntitlement(uid, administration).active;
    return {
      uid,
      displayName: profile.displayName,
      handle: profile.handle,
      avatarUrl: nyxChatAvatar(profile.avatarUrl),
      role,
      customRole: nyxPublicCustomRole(customRole),
      roleLabel: customRole?.label || nyxRoleLabels[role] || nyxRoleLabels.member,
      caffeine,
      canModerate: customRole ? customRole.permissions.includes("chat:moderate") : nyxChatCanModerate(role),
      canManageChannels: customRole ? customRole.permissions.includes("chat:manage_channels") : nyxChatCanManageChannels(role)
    };
  })();
  nyxChatIdentityCache.set(uid, { value: null, expiresAt: 0, promise });
  try {
    const value = await promise;
    nyxChatIdentityCache.set(uid, { value, expiresAt: Date.now() + nyxChatIdentityCacheTtlMs, promise: null });
    if (nyxChatIdentityCache.size > 500) {
      for (const [key, entry] of nyxChatIdentityCache) if (!entry?.value || entry.expiresAt <= Date.now()) nyxChatIdentityCache.delete(key);
    }
    return value;
  } catch (error) {
    nyxChatIdentityCache.delete(uid);
    throw error;
  }
}

async function authenticatedNyxChatUser(req, checkRevoked = true) {
  try {
    const result = await authenticatedNyxUser(req, checkRevoked);
    const now = Date.now();
    signedInPresence.set(result.token.uid, now);
    if (signedInPresence.size > 1_000) {
      for (const [uid, lastSeenAtMs] of signedInPresence) {
        if (now - lastSeenAtMs > signedInOnlineWindowMs * 2) signedInPresence.delete(uid);
      }
    }
    return result;
  } catch (error) {
    if (error.status === 401) error.message = "Sign in to use Nyx Chat.";
    throw error;
  }
}

function nyxChatVoiceChannel(value) {
  const channel = String(value || "").trim().toLowerCase();
  return nyxChatChannelIdPattern.test(channel) ? channel : "";
}

function cleanupNyxChatVoice(now = Date.now()) {
  for (const [uid, session] of nyxChatVoiceSessions) {
    if (!session || now - Number(session.lastSeenAtMs || 0) > nyxChatVoiceStaleMs) {
      nyxChatVoiceSessions.delete(uid);
      nyxChatVoiceSignals.delete(uid);
    }
  }
  for (const [uid, signals] of nyxChatVoiceSignals) {
    const active = (Array.isArray(signals) ? signals : []).filter(signal => now - Number(signal?.createdAtMs || 0) <= nyxChatVoiceSignalTtlMs).slice(-200);
    if (active.length) nyxChatVoiceSignals.set(uid, active);
    else nyxChatVoiceSignals.delete(uid);
  }
  for (const [uid, attempts] of nyxChatVoiceJoinAttempts) {
    const active = attempts.filter(timestamp => now - timestamp < 60_000);
    if (active.length) nyxChatVoiceJoinAttempts.set(uid, active);
    else nyxChatVoiceJoinAttempts.delete(uid);
  }
  for (const [uid, attempts] of nyxChatVoiceSignalAttempts) {
    const active = attempts.filter(timestamp => now - timestamp < 10_000);
    if (active.length) nyxChatVoiceSignalAttempts.set(uid, active);
    else nyxChatVoiceSignalAttempts.delete(uid);
  }
}

function nyxChatVoiceIceConfiguration(uid) {
  const stun = {
    urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]
  };
  const urls = String(process.env.NYX_TURN_URLS || "")
    .split(",")
    .map(value => value.trim())
    .filter(value => /^turns?:[^\s,]+$/i.test(value))
    .slice(0, 8);
  const secret = String(process.env.NYX_TURN_SHARED_SECRET || "").trim();
  if (!urls.length || !secret) return { iceServers: [stun], relayConfigured: false };
  const requestedTtl = Number.parseInt(String(process.env.NYX_TURN_TTL_SECONDS || "3600"), 10);
  const ttlSeconds = Math.max(300, Math.min(86_400, Number.isFinite(requestedTtl) ? requestedTtl : 3_600));
  const username = `${Math.floor(Date.now() / 1_000) + ttlSeconds}:${String(uid || "nyx").slice(0, 128)}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  return {
    iceServers: [stun, { urls, username, credential, credentialType: "password" }],
    relayConfigured: true
  };
}

function consumeNyxChatVoiceAttempt(store, uid, windowMs, maximum, message) {
  const now = Date.now();
  const active = (store.get(uid) || []).filter(timestamp => now - timestamp < windowMs);
  if (active.length >= maximum) {
    const error = new Error(message);
    error.status = 429;
    error.retryAfter = Math.max(1, Math.ceil((windowMs - (now - active[0])) / 1_000));
    throw error;
  }
  active.push(now);
  store.set(uid, active);
}

function nyxChatVoiceParticipant(session, viewerUid = "") {
  const identity = session?.identity && typeof session.identity === "object" ? session.identity : {};
  const uid = String(session?.uid || "");
  const presentation = nyxRolePresentation(nyxChatRole(identity.role), nyxChatCustomRole(identity.customRole), uid, viewerUid);
  return {
    uid,
    sessionId: String(session?.sessionId || ""),
    channelId: nyxChatVoiceChannel(session?.channelId),
    displayName: founderProfileText(identity.displayName, "Nyx member", 48),
    handle: `@${nyxProfileUsername(identity.handle, "nyx-user")}`,
    avatarUrl: nyxChatAvatar(identity.avatarUrl),
    role: presentation.role,
    roleLabel: presentation.roleLabel
  };
}

function nyxChatVoiceState(uid, sessionId = "", consumeSignals = false, channels = nyxChatVoiceChannels) {
  const now = Date.now();
  cleanupNyxChatVoice(now);
  const session = nyxChatVoiceSessions.get(uid);
  const visibleChannelIds = new Set(channels.map(channel => channel.id));
  const joined = Boolean(session && visibleChannelIds.has(session.channelId) && session.sessionId === sessionId && nyxChatVoiceSessionIdPattern.test(sessionId));
  if (joined) session.lastSeenAtMs = now;
  let signals = [];
  if (joined && consumeSignals) {
    signals = (nyxChatVoiceSignals.get(uid) || []).filter(signal => signal.toSessionId === sessionId);
    nyxChatVoiceSignals.delete(uid);
  }
  const iceConfiguration = nyxChatVoiceIceConfiguration(uid);
  return {
    channels,
    participants: [...nyxChatVoiceSessions.values()].map(participant => nyxChatVoiceParticipant(participant, uid)).filter(participant => participant.uid && visibleChannelIds.has(participant.channelId)),
    joined,
    channelId: joined ? session.channelId : "",
    signals,
    roomLimit: nyxChatVoiceRoomLimit,
    ...iceConfiguration
  };
}

function nyxChatVoiceSignal(value) {
  const source = value && typeof value === "object" ? value : {};
  const type = String(source.type || "").trim().toLowerCase();
  if (!nyxChatVoiceSignalTypes.has(type)) return null;
  if (type === "candidate") {
    const candidate = source.candidate && typeof source.candidate === "object" ? source.candidate : {};
    const text = String(candidate.candidate || "");
    const sdpMid = candidate.sdpMid == null ? null : String(candidate.sdpMid).slice(0, 256);
    const sdpMLineIndex = candidate.sdpMLineIndex == null ? null : Number(candidate.sdpMLineIndex);
    const usernameFragment = candidate.usernameFragment == null ? null : String(candidate.usernameFragment).slice(0, 256);
    if (!text || text.length > 4_000 || (sdpMLineIndex != null && (!Number.isInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 1_000))) return null;
    return { type, candidate: { candidate: text, sdpMid, sdpMLineIndex, usernameFragment } };
  }
  const description = source.description && typeof source.description === "object" ? source.description : {};
  const sdp = String(description.sdp || "");
  if (description.type !== type || !sdp || sdp.length > 32_000) return null;
  return { type, description: { type, sdp } };
}

function emitNyxChatVoiceRefresh() {
  nyxChatSocketServer?.emit("nyx:voice:refresh", { updatedAtMs: Date.now() });
}

function relayNyxChatVoiceSignal(uid, value) {
  cleanupNyxChatVoice();
  const sessionId = String(value?.sessionId || "").trim();
  const toUid = String(value?.toUid || "").trim();
  const sender = nyxChatVoiceSessions.get(uid);
  const recipient = nyxChatVoiceSessions.get(toUid);
  const signal = nyxChatVoiceSignal(value);
  if (!sender || sender.sessionId !== sessionId) {
    const error = new Error("Rejoin the voice channel before connecting.");
    error.status = 409;
    throw error;
  }
  consumeNyxChatVoiceAttempt(nyxChatVoiceSignalAttempts, uid, 10_000, 120, "Voice connection requests are arriving too quickly.");
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(toUid) || toUid === uid || !recipient || recipient.channelId !== sender.channelId || !signal) {
    const error = new Error("That voice connection request is invalid.");
    error.status = 400;
    throw error;
  }
  const now = Date.now();
  const delivered = {
    id: randomBytes(12).toString("hex"),
    ...signal,
    fromUid: uid,
    fromSessionId: sender.sessionId,
    toSessionId: recipient.sessionId,
    from: nyxChatVoiceParticipant(sender, toUid),
    createdAtMs: now
  };
  const queue = (nyxChatVoiceSignals.get(toUid) || []).filter(item => now - Number(item.createdAtMs || 0) <= nyxChatVoiceSignalTtlMs).slice(-199);
  queue.push(delivered);
  nyxChatVoiceSignals.set(toUid, queue);
  nyxChatSocketServer?.to(nyxChatSocketUserRoom(toUid)).emit("nyx:voice:signal", delivered);
  return delivered;
}

function nyxOwnerGuestRecord(document, now = Date.now()) {
  const sessionId = String(document?.id || "");
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(sessionId)) return null;
  const data = document.data() || {};
  if (String(data.accountUid || "").trim()) return null;
  const lastSeenMs = Number(data.lastSeen || 0);
  if (!Number.isFinite(lastSeenMs) || lastSeenMs <= 0 || lastSeenMs > now + 60_000 || now - lastSeenMs > presenceTtlMs) return null;
  const recordedFirstSeenMs = Number(data.firstSeen || 0);
  const firstSeenMs = Number.isFinite(recordedFirstSeenMs) && recordedFirstSeenMs > 0 && recordedFirstSeenMs <= lastSeenMs
    ? recordedFirstSeenMs
    : lastSeenMs;
  const identity = nyxGuestIdentity(sessionId);
  const displayName = String(data.guestName || identity.displayName).trim().slice(0, 80) || identity.displayName;
  const username = String(data.guestUsername || identity.username).trim().replace(/^@+/, "").slice(0, 80) || identity.username;
  return {
    uid: `guest_${identity.id}`,
    guest: true,
    accountType: "guest",
    displayName,
    username,
    email: "",
    deliverableEmail: false,
    role: "guest",
    subscriptionStatus: "none",
    monthlyRevenueCents: 0,
    createdAt: new Date(firstSeenMs).toISOString(),
    lastSignInAt: "",
    lastActiveAt: new Date(lastSeenMs).toISOString(),
    lastSeenIp: "",
    lastSeenIpAt: "",
    online: true,
    emailVerified: false,
    disabled: false,
    photoUrl: "",
    profile: {}
  };
}

async function nyxActiveGuestUsers(_firebase, now = Date.now()) {
  pruneLocalPresence(now);
  return [...presenceSessionDetails.entries()].map(([id, data]) => nyxOwnerGuestRecord({
    id,
    data: () => data
  }, now)).filter(Boolean);
}

function nyxOwnerSortUsers(users, sort, direction) {
  const allowed = new Set(["displayName", "username", "email", "role", "subscriptionStatus", "createdAt", "lastSignInAt", "lastActiveAt", "status"]);
  const key = allowed.has(sort) ? sort : "createdAt";
  const multiplier = direction === "asc" ? 1 : -1;
  return users.sort((left, right) => {
    let a = key === "status" ? (left.disabled ? "disabled" : "enabled") : left[key];
    let b = key === "status" ? (right.disabled ? "disabled" : "enabled") : right[key];
    if (key.endsWith("At")) {
      a = Date.parse(a || "") || 0;
      b = Date.parse(b || "") || 0;
      return (a - b) * multiplier;
    }
    return String(a || "").localeCompare(String(b || ""), undefined, { sensitivity: "base", numeric: true }) * multiplier;
  });
}

async function ownerDashboardSnapshot(firebase) {
  const now = Date.now();
  if (ownerDashboardSnapshotCache.value && ownerDashboardSnapshotCache.expiresAt > now) return ownerDashboardSnapshotCache.value;
  if (ownerDashboardSnapshotCache.promise) return ownerDashboardSnapshotCache.promise;
  ownerDashboardSnapshotCache.promise = (async () => {
    const { users: authUsers, truncated } = await listAllFirebaseUsers(firebase.auth);
    const uids = authUsers.map(user => user.uid);
    const [administration, profiles, activity, customRoles] = await Promise.all([
      firestoreDocumentsById(firebase.firestore, "nyxUserAdministration", uids),
      firestoreDocumentsById(firebase.firestore, "nyxUserProfiles", uids, ["profile.displayName", "profile.handle", "profile.bio", "profile.customStatus", "profile.status"]),
      firestoreDocumentsById(firebase.firestore, "nyxUserActivity", uids),
      nyxCustomRoles(firebase)
    ]);
    const ownerUid = founderProfileConfig().administratorUid;
    return {
      users: authUsers.map(user => nyxOwnerUserRecord(
        user,
        administration.get(user.uid),
        profiles.get(user.uid),
        activity.get(user.uid),
        ownerUid,
        false,
        false,
        customRoles
      )),
      truncated
    };
  })();
  try {
    const value = await ownerDashboardSnapshotCache.promise;
    ownerDashboardSnapshotCache = { expiresAt: Date.now() + ownerDashboardSnapshotTtlMs, value, promise: null };
    return value;
  } catch (error) {
    ownerDashboardSnapshotCache.promise = null;
    throw error;
  }
}

function invalidateOwnerDashboardSnapshot() {
  ownerDashboardSnapshotCache = { expiresAt: 0, value: null, promise: null };
  nyxChatIdentityCache.clear();
  nyxChatMemberDirectoryCache = { expiresAt: 0, value: null, promise: null };
  const revision = recordNyxChatRealtimeEvent({ kind: "members" });
  emitNyxChatSocketEvent({ kind: "members", revision });
  void refreshNyxChatSocketAuthorizations();
}

function invalidateNyxCustomRoles() {
  nyxCustomRoleCache = { expiresAt: 0, value: new Map(), promise: null };
  invalidateOwnerDashboardSnapshot();
}

function linkGeneratorClientId(req) {
  return String(
    req.get("x-nf-client-connection-ip") ||
    req.get("x-forwarded-for")?.split(",")[0] ||
    req.ip ||
    "unknown"
  ).trim().slice(0, 100);
}

function sameOriginRequest(req) {
  const fetchSite = String(req.get("sec-fetch-site") || "").trim().toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
  if (fetchSite === "cross-site") return false;
  const origin = String(req.get("origin") || "").trim();
  if (!origin) return true;
  try {
    const forwardedHost = String(req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    return new URL(origin).host === forwardedHost;
  } catch {
    return false;
  }
}

function nyxMediaProviderConfigured(provider) {
  if (provider === "soundcloud") {
    return Boolean(
      String(process.env.NYX_SOUNDCLOUD_CLIENT_ID || "").trim() &&
      String(process.env.NYX_SOUNDCLOUD_CLIENT_SECRET || "").trim()
    );
  }
  if (provider === "meting") return true;
  return false;
}

function nyxMediaSearchRateState(clientId, now = Date.now()) {
  for (const [key, state] of nyxMediaSearchAttempts) {
    if (now - state.windowStarted > nyxMediaSearchWindowMs) nyxMediaSearchAttempts.delete(key);
  }
  let state = nyxMediaSearchAttempts.get(clientId);
  if (!state || now - state.windowStarted > nyxMediaSearchWindowMs) {
    state = { attempts: 0, windowStarted: now };
    nyxMediaSearchAttempts.set(clientId, state);
  }
  return state;
}

function nyxMediaCachedSearch(key) {
  const cached = nyxMediaSearchCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    nyxMediaSearchCache.delete(key);
    return null;
  }
  nyxMediaSearchCache.delete(key);
  nyxMediaSearchCache.set(key, cached);
  return cached.results;
}

function nyxMediaCacheSearch(key, results) {
  nyxMediaSearchCache.delete(key);
  nyxMediaSearchCache.set(key, { expiresAt: Date.now() + nyxMediaSearchCacheTtlMs, results });
  while (nyxMediaSearchCache.size > nyxMediaSearchCacheLimit) {
    const oldest = nyxMediaSearchCache.keys().next().value;
    nyxMediaSearchCache.delete(oldest);
  }
}

async function nyxMediaFetchJson(url, options = {}, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.error?.message || payload?.message || payload?.error || "The media provider rejected the request.").slice(0, 240);
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("The media provider timed out. Try again shortly.");
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function nyxSoundCloudAccessToken(force = false) {
  const now = Date.now();
  if (!force && nyxSoundCloudTokenCache.accessToken && nyxSoundCloudTokenCache.expiresAt > now + 60_000) {
    return nyxSoundCloudTokenCache.accessToken;
  }
  if (!force && nyxSoundCloudTokenCache.promise) return nyxSoundCloudTokenCache.promise;
  const clientId = String(process.env.NYX_SOUNDCLOUD_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.NYX_SOUNDCLOUD_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    const error = new Error("SoundCloud has not been connected to Nyxify yet.");
    error.status = 503;
    throw error;
  }
  const promise = nyxMediaFetchJson("https://secure.soundcloud.com/oauth/token", {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  }, 10_000).then(payload => {
    const accessToken = String(payload?.access_token || "").trim();
    if (!accessToken) throw new Error("SoundCloud did not return an access token.");
    const expiresIn = Math.max(300, Number(payload?.expires_in) || 3_600);
    nyxSoundCloudTokenCache = { accessToken, expiresAt: Date.now() + expiresIn * 1_000, promise: null };
    return accessToken;
  });
  nyxSoundCloudTokenCache.promise = promise;
  try {
    return await promise;
  } catch (error) {
    nyxSoundCloudTokenCache = { accessToken: "", expiresAt: 0, promise: null };
    throw error;
  }
}

function nyxHttpsUrl(value, allowedHosts = []) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:") return "";
    if (allowedHosts.length && !allowedHosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return "";
    url.username = "";
    url.password = "";
    return url.href;
  } catch {
    return "";
  }
}

async function nyxSoundCloudSearch(query, limit, retry = true) {
  const cacheKey = `soundcloud:${query.toLowerCase()}:${limit}`;
  const cached = nyxMediaCachedSearch(cacheKey);
  if (cached) return cached;
  const token = await nyxSoundCloudAccessToken(!retry);
  const endpoint = new URL("https://api.soundcloud.com/tracks");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("access", "playable");
  endpoint.searchParams.set("limit", String(limit));
  endpoint.searchParams.set("linked_partitioning", "true");
  try {
    const payload = await nyxMediaFetchJson(endpoint, {
      headers: {
        accept: "application/json; charset=utf-8",
        authorization: `OAuth ${token}`
      }
    }, 10_000);
    const collection = Array.isArray(payload) ? payload : (Array.isArray(payload?.collection) ? payload.collection : []);
    const results = collection.flatMap(item => {
      const id = String(item?.id || "").trim();
      const sourceUrl = nyxHttpsUrl(item?.permalink_url, ["soundcloud.com"]);
      if (!/^\d{1,24}$/.test(id) || !sourceUrl || String(item?.access || "playable") !== "playable") return [];
      const thumbnail = nyxHttpsUrl(item?.artwork_url || item?.user?.avatar_url, ["sndcdn.com"]);
      return [{
        id: `soundcloud-${id}`,
        providerId: id,
        provider: "soundcloud",
        providerLabel: "SoundCloud",
        title: String(item?.title || "Untitled track").trim().slice(0, 180),
        creator: String(item?.metadata_artist || item?.user?.username || "SoundCloud artist").trim().slice(0, 100),
        thumbnail,
        durationMs: Math.max(0, Number(item?.duration) || 0),
        streamUrl: `/api/music/soundcloud/${encodeURIComponent(id)}`,
        sourceUrl
      }];
    });
    nyxMediaCacheSearch(cacheKey, results);
    return results;
  } catch (error) {
    if (retry && Number(error?.status) === 401) {
      nyxSoundCloudTokenCache = { accessToken: "", expiresAt: 0, promise: null };
      return nyxSoundCloudSearch(query, limit, false);
    }
    throw error;
  }
}

function nyxMetingAssetUrl(value, expectedType) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "api.qijieya.cn" || !/^\/meting\/?$/.test(url.pathname)) return "";
    if (String(url.searchParams.get("type") || "").toLowerCase() !== expectedType) return "";
    const id = String(url.searchParams.get("id") || "").trim();
    if (!/^\d{1,24}$/.test(id)) return "";
    const normalized = new URL("https://api.qijieya.cn/meting/");
    normalized.searchParams.set("server", "netease");
    normalized.searchParams.set("type", expectedType);
    normalized.searchParams.set("id", id);
    if (expectedType === "pic") normalized.searchParams.set("cover", "500");
    return normalized.href;
  } catch {
    return "";
  }
}

function nyxMetingAssetId(value, expectedType) {
  const normalized = nyxMetingAssetUrl(value, expectedType);
  if (!normalized) return "";
  return String(new URL(normalized).searchParams.get("id") || "").trim();
}

const nyxMusicArtworkTypes = new Set(["image/avif", "image/gif", "image/jpeg", "image/png", "image/webp"]);
const nyxMusicArtworkByteLimit = 5 * 1024 * 1024;

function nyxMusicAssetUrl(value) {
  try {
    const url = new URL(String(value || ""));
    const trustedHost = url.hostname === "api.qijieya.cn" || url.hostname === "music.126.net" || url.hostname.endsWith(".music.126.net");
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !trustedHost) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function nyxCacheMetingAssetResolution(key, value) {
  nyxMetingAssetResolutionCache.delete(key);
  nyxMetingAssetResolutionCache.set(key, value);
  while (nyxMetingAssetResolutionCache.size > nyxMetingAssetResolutionCacheLimit) {
    nyxMetingAssetResolutionCache.delete(nyxMetingAssetResolutionCache.keys().next().value);
  }
}

async function nyxResolveMetingAsset(assetId, type) {
  const key = `${type}:${assetId}`;
  const now = Date.now();
  const cached = nyxMetingAssetResolutionCache.get(key);
  if (cached?.url && cached.expiresAt > now) {
    nyxCacheMetingAssetResolution(key, cached);
    return cached.url;
  }
  if (cached?.promise) return cached.promise;
  const initial = new URL("https://api.qijieya.cn/meting/");
  initial.searchParams.set("server", "netease");
  initial.searchParams.set("type", type);
  initial.searchParams.set("id", assetId);
  if (type === "pic") initial.searchParams.set("cover", "500");
  const promise = (async () => {
    const upstream = await fetch(initial, {
      redirect: "manual",
      headers: {
        accept: type === "pic" ? "image/avif,image/webp,image/png,image/jpeg,image/gif" : "audio/mpeg,audio/mp4,audio/*;q=0.9,*/*;q=0.1",
        "user-agent": "nyx/1.0"
      },
      signal: AbortSignal.timeout(8_000)
    });
    const location = upstream.headers.get("location");
    upstream.body?.cancel().catch(() => {});
    if (upstream.status < 300 || upstream.status >= 400 || !location) {
      throw new Error("The music provider did not return a media location.");
    }
    const url = nyxMusicAssetUrl(new URL(location, initial).href);
    if (!url || url.hostname === "api.qijieya.cn") {
      throw new Error("The music provider returned an invalid media location.");
    }
    nyxCacheMetingAssetResolution(key, { url, expiresAt: Date.now() + nyxMetingAssetResolutionTtlMs, promise: null });
    return url;
  })();
  nyxCacheMetingAssetResolution(key, { url: "", expiresAt: 0, promise });
  try {
    return await promise;
  } catch (error) {
    if (nyxMetingAssetResolutionCache.get(key)?.promise === promise) nyxMetingAssetResolutionCache.delete(key);
    throw error;
  }
}

function nyxMusicAudioCandidates(value) {
  const resolved = nyxMusicAssetUrl(value);
  if (!resolved) return [];
  const candidates = [];
  for (const hostname of ["m801.music.126.net", "m804.music.126.net", resolved.hostname]) {
    const candidate = new URL(resolved);
    candidate.hostname = hostname;
    if (!candidates.some(item => item.href === candidate.href)) candidates.push(candidate);
  }
  return candidates;
}

function nyxCachedMusicArtwork(assetId) {
  const cached = nyxMusicArtworkCache.get(assetId);
  if (!cached) return null;
  nyxMusicArtworkCache.delete(assetId);
  nyxMusicArtworkCache.set(assetId, cached);
  return cached;
}

function nyxCacheMusicArtwork(assetId, artwork) {
  const existing = nyxMusicArtworkCache.get(assetId);
  if (existing) nyxMusicArtworkCacheBytes -= existing.body.length;
  nyxMusicArtworkCache.delete(assetId);
  if (artwork.body.length > nyxMusicArtworkCacheByteLimit) return;
  nyxMusicArtworkCache.set(assetId, artwork);
  nyxMusicArtworkCacheBytes += artwork.body.length;
  while (nyxMusicArtworkCacheBytes > nyxMusicArtworkCacheByteLimit && nyxMusicArtworkCache.size) {
    const oldestKey = nyxMusicArtworkCache.keys().next().value;
    const oldest = nyxMusicArtworkCache.get(oldestKey);
    nyxMusicArtworkCache.delete(oldestKey);
    nyxMusicArtworkCacheBytes -= oldest?.body?.length || 0;
  }
}

async function nyxLoadMusicArtwork(assetId) {
  const cached = nyxCachedMusicArtwork(assetId);
  if (cached) return cached;
  if (nyxMusicArtworkInflight.has(assetId)) return nyxMusicArtworkInflight.get(assetId);
  const promise = (async () => {
    const url = await nyxResolveMetingAsset(assetId, "pic");
    const upstream = await fetch(url, {
      redirect: "manual",
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg,image/gif", "user-agent": "nyx/1.0" },
      signal: AbortSignal.timeout(8_000)
    });
    if (!upstream.ok) {
      upstream.body?.cancel().catch(() => {});
      const error = new Error("The cover provider could not return this image.");
      error.status = upstream.status;
      throw error;
    }
    const upstreamContentType = String(upstream.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    const contentType = upstreamContentType === "image/jpg" ? "image/jpeg" : upstreamContentType;
    const contentLength = Number(upstream.headers.get("content-length") || 0);
    if (!nyxMusicArtworkTypes.has(contentType) || (contentLength && contentLength > nyxMusicArtworkByteLimit)) {
      upstream.body?.cancel().catch(() => {});
      const error = new Error("The cover provider returned an unsupported image.");
      error.status = 415;
      throw error;
    }
    const reader = upstream.body?.getReader?.();
    if (!reader) throw new Error("The cover provider returned no image body.");
    const chunks = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > nyxMusicArtworkByteLimit) {
        await reader.cancel();
        const error = new Error("The cover image is too large.");
        error.status = 413;
        throw error;
      }
      chunks.push(Buffer.from(value));
    }
    if (!totalBytes) throw new Error("The cover provider returned an empty image.");
    const artwork = { body: Buffer.concat(chunks, totalBytes), contentType };
    nyxCacheMusicArtwork(assetId, artwork);
    return artwork;
  })();
  nyxMusicArtworkInflight.set(assetId, promise);
  try {
    return await promise;
  } finally {
    if (nyxMusicArtworkInflight.get(assetId) === promise) nyxMusicArtworkInflight.delete(assetId);
  }
}

async function sendNyxMusicArtwork(res, assetId) {
  const { body, contentType } = await nyxLoadMusicArtwork(assetId);
  res.set({
    "Cache-Control": "public, max-age=604800, stale-while-revalidate=2592000",
    "Content-Type": contentType,
    "Content-Length": String(body.length),
    "X-Content-Type-Options": "nosniff"
  }).send(body);
}

function primeNyxifyAssets(results) {
  const tracks = Array.isArray(results) ? results.slice(0, 7) : [];
  for (const track of tracks) {
    const artworkId = String(track?.thumbnail || "").match(/\/api\/music\/artwork\/(\d{1,24})$/)?.[1];
    if (artworkId) void nyxLoadMusicArtwork(artworkId).catch(() => {});
    const trackId = String(track?.id || "").trim();
    if (track?.provider === "meting" && /^\d{1,24}$/.test(trackId)) void nyxResolveMetingAsset(trackId, "url").catch(() => {});
  }
}

async function nyxifySearch(query, limit) {
  const cacheKey = `meting:${query.toLowerCase()}:${limit}`;
  const cached = nyxMediaCachedSearch(cacheKey);
  if (cached) return cached;
  const endpoint = new URL("https://api.qijieya.cn/meting/");
  endpoint.searchParams.set("server", "netease");
  endpoint.searchParams.set("type", "search");
  endpoint.searchParams.set("id", query);
  endpoint.searchParams.set("limit", String(limit));
  const payload = await nyxMediaFetchJson(endpoint, {
    headers: { accept: "application/json; charset=utf-8" }
  }, 10_000);
  const results = (Array.isArray(payload) ? payload : []).flatMap((item, index) => {
    const upstreamStreamUrl = nyxMetingAssetUrl(item?.url, "url");
    const thumbnailId = nyxMetingAssetId(item?.pic, "pic");
    const thumbnail = thumbnailId ? `/api/music/artwork/${encodeURIComponent(thumbnailId)}` : "";
    const lyricsUrl = nyxMetingAssetUrl(item?.lrc, "lrc");
    if (!upstreamStreamUrl) return [];
    const parsed = new URL(upstreamStreamUrl);
    const id = String(parsed.searchParams.get("id") || "");
    return [{
      id,
      provider: "meting",
      title: String(item?.name || "Untitled track").trim().slice(0, 180),
      creator: String(item?.artist || "Unknown artist").trim().slice(0, 100),
      thumbnail,
      streamUrl: `/api/music/stream/${encodeURIComponent(id)}`,
      lyricsUrl,
      sourceUrl: `https://music.163.com/#/song?id=${encodeURIComponent(id)}`,
      resultIndex: index
    }];
  });
  nyxMediaCacheSearch(cacheKey, results);
  primeNyxifyAssets(results);
  return results;
}

async function nyxifyPreferredSearch(query, limit) {
  if (nyxMediaProviderConfigured("soundcloud")) {
    try {
      const results = await nyxSoundCloudSearch(query, limit);
      if (results.length) return results;
    } catch {
      // Keep Nyxify useful during a temporary SoundCloud authentication or API outage.
    }
  }
  return nyxifySearch(query, limit);
}

function nyxMediaSearchRequest(req, res, provider, search) {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site media searches are not allowed." });
    return;
  }
  const query = String(req.query?.q || "").trim().replace(/\s+/g, " ").slice(0, 100);
  const limit = Math.max(1, Math.min(20, Number.parseInt(req.query?.limit, 10) || 12));
  if (query.length < 2) {
    res.status(400).json({ error: "Enter at least two characters to search." });
    return;
  }
  const rate = nyxMediaSearchRateState(`${provider}:${linkGeneratorClientId(req)}`);
  rate.attempts += 1;
  if (rate.attempts > nyxMediaSearchMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + nyxMediaSearchWindowMs - Date.now()) / 1_000));
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many media searches. Try again shortly." });
    return;
  }
  Promise.resolve(search(query, limit))
    .then(results => res.json({ provider: results[0]?.provider || provider, query, results }))
    .catch(error => {
      const upstreamStatus = Number(error?.status) || 502;
      const status = upstreamStatus === 429 ? 429 : (upstreamStatus === 503 || upstreamStatus === 504 ? upstreamStatus : 502);
      res.status(status).json({ error: error?.message || `${provider} search is unavailable right now.` });
    });
}

app.get("/api/nyxify/status", (_req, res) => {
  const soundCloudConfigured = nyxMediaProviderConfigured("soundcloud");
  res.set("Cache-Control", "no-store").json({
    configured: true,
    provider: soundCloudConfigured ? "soundcloud" : "meting",
    providerLabel: soundCloudConfigured ? "SoundCloud" : "Nyx music catalog",
    fallback: "meting"
  });
});

app.get("/api/nyxify/search", (req, res) => nyxMediaSearchRequest(req, res, "nyxify", nyxifyPreferredSearch));

app.get("/api/music/artwork/:assetId", async (req, res) => {
  const assetId = String(req.params.assetId || "").trim();
  if (!/^\d{1,24}$/.test(assetId)) {
    res.status(404).end();
    return;
  }
  try {
    await sendNyxMusicArtwork(res, assetId);
  } catch {
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  }
});

app.get("/api/music/soundcloud/:trackId", async (req, res) => {
  res.set({
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  });
  const trackId = String(req.params.trackId || "").trim();
  if (!/^\d{1,24}$/.test(trackId) || !nyxMediaProviderConfigured("soundcloud")) {
    res.status(404).end();
    return;
  }
  const requestedRange = String(req.get("range") || "").trim();
  if (requestedRange && !/^bytes=\d*-\d*$/i.test(requestedRange)) {
    res.status(416).end();
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  res.once("close", () => controller.abort());
  try {
    const token = await nyxSoundCloudAccessToken();
    const endpoint = new URL(`https://api.soundcloud.com/tracks/${trackId}/stream`);
    const upstream = await fetch(endpoint, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "audio/mpeg,audio/mp4,audio/ogg,audio/*;q=0.9,*/*;q=0.1",
        authorization: `OAuth ${token}`,
        ...(requestedRange ? { range: requestedRange } : {})
      }
    });
    clearTimeout(timeout);
    const source = new URL(upstream.url);
    const trustedSource = source.hostname === "api.soundcloud.com" || source.hostname === "soundcloud.com" || source.hostname.endsWith(".soundcloud.com") || source.hostname === "sndcdn.com" || source.hostname.endsWith(".sndcdn.com");
    const contentType = String(upstream.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!trustedSource || (!contentType.startsWith("audio/") && upstream.status !== 416) || ![200, 206, 416].includes(upstream.status)) {
      upstream.body?.cancel().catch(() => {});
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    const headers = {
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length") } : {}),
      ...(upstream.headers.get("content-range") ? { "Content-Range": upstream.headers.get("content-range") } : {})
    };
    res.status(upstream.status).set(headers);
    if (req.method === "HEAD" || !upstream.body) {
      upstream.body?.cancel().catch(() => {});
      res.end();
      return;
    }
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", () => res.headersSent ? res.destroy() : res.status(502).end());
    stream.pipe(res);
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) res.status(error?.name === "AbortError" ? 504 : 502).end();
    else res.destroy();
  }
});

app.get("/api/music/stream/:trackId", async (req, res) => {
  res.set({
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  });
  const trackId = String(req.params.trackId || "").trim();
  if (!/^\d{1,24}$/.test(trackId)) {
    res.status(404).end();
    return;
  }
  const requestedRange = String(req.get("range") || "").trim();
  if (requestedRange && !/^bytes=\d*-\d*$/i.test(requestedRange)) {
    res.status(416).end();
    return;
  }
  const upstreamRange = requestedRange || (req.method === "HEAD" ? "bytes=0-0" : "bytes=0-1048575");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  res.once("close", () => controller.abort());
  try {
    const resolvedUrl = await nyxResolveMetingAsset(trackId, "url");
    const candidates = nyxMusicAudioCandidates(resolvedUrl);
    let upstream = null;
    let lastError = null;
    for (const candidateUrl of candidates) {
      if (controller.signal.aborted) break;
      try {
        const candidate = await fetch(candidateUrl, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(7_000)]),
          headers: {
            accept: "audio/mpeg,audio/mp4,audio/*;q=0.9,*/*;q=0.1",
            range: upstreamRange
          }
        });
        const candidateSource = nyxMusicAssetUrl(candidate.url);
        const candidateType = String(candidate.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
        if (candidateSource && [200, 206, 416].includes(candidate.status) && (candidateType.startsWith("audio/") || candidate.status === 416)) {
          upstream = candidate;
          break;
        }
        candidate.body?.cancel().catch(() => {});
      } catch (error) {
        lastError = error;
        if (controller.signal.aborted) throw error;
      }
    }
    if (!upstream) throw lastError || new Error("The music stream is temporarily unavailable.");
    clearTimeout(timeout);
    const source = new URL(upstream.url);
    const trustedSource = source.hostname === "api.qijieya.cn" || source.hostname === "music.126.net" || source.hostname.endsWith(".music.126.net");
    const contentType = String(upstream.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase();
    if (!trustedSource || (!contentType.startsWith("audio/") && upstream.status !== 416)) {
      upstream.body?.cancel().catch(() => {});
      res.status(502).end();
      return;
    }
    if (![200, 206, 416].includes(upstream.status)) {
      upstream.body?.cancel().catch(() => {});
      res.status(upstream.status === 404 ? 404 : 502).end();
      return;
    }
    const headers = {
      "Accept-Ranges": upstream.headers.get("accept-ranges") || "bytes",
      ...(contentType ? { "Content-Type": contentType } : {}),
      ...(upstream.headers.get("content-length") ? { "Content-Length": upstream.headers.get("content-length") } : {}),
      ...(upstream.headers.get("content-range") ? { "Content-Range": upstream.headers.get("content-range") } : {})
    };
    if (req.method === "HEAD") {
      const totalLength = String(upstream.headers.get("content-range") || "").match(/\/(\d+)$/)?.[1];
      const headHeaders = { ...headers };
      delete headHeaders["Content-Range"];
      if (totalLength) headHeaders["Content-Length"] = totalLength;
      res.status(200).set(headHeaders);
      upstream.body?.cancel().catch(() => {});
      res.end();
      return;
    }
    res.status(upstream.status).set(headers);
    if (!upstream.body) {
      res.end();
      return;
    }
    const stream = Readable.fromWeb(upstream.body);
    stream.on("error", () => {
      if (!res.headersSent) res.status(502).end();
      else res.destroy();
    });
    stream.pipe(res);
  } catch (error) {
    clearTimeout(timeout);
    if (!res.headersSent) res.status(error?.name === "AbortError" ? 504 : 502).end();
    else res.destroy();
  }
});

app.all(["/api/nyxcloud/status", "/api/nyxcloud/search"], (_req, res) => {
  res.set("Cache-Control", "no-store").status(410).json({ error: "NyxCloud has been retired." });
});

app.all(["/api/nyxtube/status", "/api/nyxtube/search", "/api/nyxtube/feed"], (_req, res) => {
  res.set("Cache-Control", "no-store").status(410).json({ error: "NyxTube has been retired." });
});

app.get(["/apps/nyxcloud", "/apps/nyxcloud/"], (_req, res) => {
  res.redirect(302, "/");
});

app.get(["/apps/nyxtube", "/apps/nyxtube/"], (_req, res) => {
  res.redirect(302, "/");
});

function linkGeneratorRateState(clientId, now = Date.now()) {
  for (const [key, state] of linkGeneratorAttempts) {
    if (now - state.windowStarted > linkGeneratorWindowMs) linkGeneratorAttempts.delete(key);
  }
  let state = linkGeneratorAttempts.get(clientId);
  if (!state || now - state.windowStarted > linkGeneratorWindowMs) {
    state = { attempts: 0, windowStarted: now };
    linkGeneratorAttempts.set(clientId, state);
  }
  return state;
}

function normalizedDownloadSafetyUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 4096) return null;
  try {
    const url = new URL(raw);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function downloadSafetyFileRisk(url, filename = "") {
  const candidate = `${String(url?.pathname || "")} ${String(filename || "")}`.toLowerCase();
  const executable = /\.(?:apk|appx|bat|cmd|com|crx|deb|dmg|exe|iso|jar|jse|msi|pkg|ps1|scr|sh|vbs|wsf)(?:$|[\s?#])/i.test(candidate);
  const archive = /\.(?:7z|rar|tar|tgz|zip)(?:$|[\s?#])/i.test(candidate);
  return executable ? "executable" : (archive ? "archive" : "ordinary");
}

function downloadSafetyRateState(clientId, now = Date.now()) {
  for (const [key, state] of downloadSafetyAttempts) {
    if (now - state.windowStarted > downloadSafetyWindowMs) downloadSafetyAttempts.delete(key);
  }
  let state = downloadSafetyAttempts.get(clientId);
  if (!state || now - state.windowStarted > downloadSafetyWindowMs) {
    state = { attempts: 0, windowStarted: now };
    downloadSafetyAttempts.set(clientId, state);
  }
  return state;
}

function linkCheckerRateState(clientId, now = Date.now()) {
  for (const [key, state] of linkCheckerAttempts) {
    if (now - state.windowStarted > linkCheckerWindowMs) linkCheckerAttempts.delete(key);
  }
  let state = linkCheckerAttempts.get(clientId);
  if (!state || now - state.windowStarted > linkCheckerWindowMs) {
    state = { attempts: 0, windowStarted: now };
    linkCheckerAttempts.set(clientId, state);
  }
  return state;
}

function linkCheckerPageRateState(clientId, now = Date.now()) {
  for (const [key, state] of linkCheckerPageAttempts) {
    if (now - state.windowStarted > linkCheckerWindowMs) linkCheckerPageAttempts.delete(key);
  }
  let state = linkCheckerPageAttempts.get(clientId);
  if (!state || now - state.windowStarted > linkCheckerWindowMs) {
    state = { attempts: 0, windowStarted: now };
    linkCheckerPageAttempts.set(clientId, state);
  }
  return state;
}

function reserveLinkCheckerBulkSlot(uid) {
  const activeForUser = linkCheckerBulkActiveByUser.get(uid) || 0;
  if (activeForUser >= linkCheckerBulkMaxConcurrentPerUser || linkCheckerBulkActiveRequests >= linkCheckerBulkMaxConcurrentGlobal) return null;
  linkCheckerBulkActiveByUser.set(uid, activeForUser + 1);
  linkCheckerBulkActiveRequests += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = Math.max(0, (linkCheckerBulkActiveByUser.get(uid) || 1) - 1);
    if (remaining) linkCheckerBulkActiveByUser.set(uid, remaining);
    else linkCheckerBulkActiveByUser.delete(uid);
    linkCheckerBulkActiveRequests = Math.max(0, linkCheckerBulkActiveRequests - 1);
  };
}

function freednsRegistryRateState(clientId, now = Date.now()) {
  for (const [key, state] of freednsRegistryAttempts) {
    if (now - state.windowStarted > freednsRegistryWindowMs) freednsRegistryAttempts.delete(key);
  }
  let state = freednsRegistryAttempts.get(clientId);
  if (!state || now - state.windowStarted > freednsRegistryWindowMs) {
    state = { attempts: 0, windowStarted: now };
    freednsRegistryAttempts.set(clientId, state);
  }
  return state;
}

function freednsRegistryText(value) {
  return String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) => String.fromCodePoint(Number.parseInt(value, 16)))
    .replace(/&#(\d+);/g, (_match, value) => String.fromCodePoint(Number.parseInt(value, 10)))
    .replace(/\s+/g, " ")
    .trim();
}

function parseFreednsRegistryPage(html, requestedPage) {
  const source = String(html || "");
  const pageSummary = source.match(/Page\s*<input[^>]*value=(?:"|')?(\d+)(?:"|')?[^>]*>\s*of\s*([\d,]+)/i);
  const totalSummary = source.match(/Showing\s*<b>[\d,]+<\/b>-<b>[\d,]+<\/b>\s*of\s*<b>([\d,]+)<\/b>\s*total/i);
  const totalPages = Number.parseInt(String(pageSummary?.[2] || "0").replace(/,/g, ""), 10) || 0;
  const totalDomains = Number.parseInt(String(totalSummary?.[1] || "0").replace(/,/g, ""), 10) || 0;
  const currentPage = Number.parseInt(pageSummary?.[1] || String(requestedPage), 10) || requestedPage;
  const domains = [];
  const rows = source.match(/<tr\s+class=(?:"|')?tr[ld](?:"|')?[^>]*>[\s\S]*?<\/tr>/gi) || [];
  rows.forEach(row => {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => match[1]);
    const identity = row.match(/\/subdomain\/edit\.php\?edit_domain_id=(\d+)[^>]*>([^<]+)<\/a>/i);
    if (!identity || cells.length < 2) return;
    const domain = freednsRegistryText(identity[2]).toLowerCase();
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain)) return;
    const hosts = Number.parseInt(String(cells[0].match(/\(([\d,]+)\s+hosts?\s+in\s+use\)/i)?.[1] || "0").replace(/,/g, ""), 10) || 0;
    const status = freednsRegistryText(cells[1]).toLowerCase() === "public" ? "public" : "private";
    const owner = freednsRegistryText(cells[2]);
    const addedText = freednsRegistryText(cells[3]);
    const added = String(addedText.match(/\((\d{2}\/\d{2}\/\d{4})\)/)?.[1] || addedText).slice(0, 40);
    domains.push({ id: identity[1], domain, status, hosts, owner: owner.slice(0, 100), added });
  });
  if (!totalPages || !totalDomains || !domains.length) {
    const error = new Error("FreeDNS returned a registry page Nyx could not read.");
    error.status = 502;
    throw error;
  }
  return { page: currentPage, totalPages, totalDomains, domains };
}

function linkCheckerApiKey() {
  return String(process.env.NYX_LINK_CHECKER_API_KEY || "").trim();
}

async function linkCheckerUpstream(path, options = {}) {
  const apiKey = linkCheckerApiKey();
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  if (apiKey) headers["X-API-Key"] = apiKey;
  const response = await fetch(`${linkCheckerApiOrigin}${path}`, {
    ...options,
    headers,
    signal: AbortSignal.timeout(20_000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(
      response.status === 401 || response.status === 403
        ? "The Link Checker API key was rejected."
        : response.status === 429
          ? "The Link Checker rate limit has been reached."
          : "The Link Checker provider could not complete this request."
    );
    error.status = response.status === 429 ? 429 : (response.status < 500 ? response.status : 502);
    error.retryAfter = response.headers.get("retry-after") || "";
    throw error;
  }
  if (!payload || typeof payload !== "object") {
    const error = new Error("The Link Checker provider returned an invalid response.");
    error.status = 502;
    throw error;
  }
  return payload;
}

function linkCheckerAccountCredentials() {
  const username = String(process.env.NYX_LINK_CHECKER_ACCOUNT_USERNAME || "").trim();
  const password = String(process.env.NYX_LINK_CHECKER_ACCOUNT_PASSWORD || "");
  if (!username || !password) {
    const error = new Error("Fast full scans require the Nocturne account credentials in the VPS environment.");
    error.status = 503;
    throw error;
  }
  return { username, password };
}

function linkCheckerAccountConfigured() {
  return Boolean(
    String(process.env.NYX_LINK_CHECKER_ACCOUNT_USERNAME || "").trim()
    && String(process.env.NYX_LINK_CHECKER_ACCOUNT_PASSWORD || "")
  );
}

function linkCheckerResponseCookies(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => String(value).split(";", 1)[0].trim()).filter(Boolean).join("; ");
}

async function linkCheckerAccountLogin() {
  if (linkCheckerAccountCookie) return linkCheckerAccountCookie;
  if (linkCheckerAccountLoginPromise) return linkCheckerAccountLoginPromise;
  linkCheckerAccountLoginPromise = (async () => {
    const credentials = linkCheckerAccountCredentials();
    let response;
    try {
      response = await fetch(`${linkCheckerApiOrigin}/api/auth/login`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        signal: AbortSignal.timeout(20_000)
      });
    } catch (error) {
      const unavailable = new Error("Nocturne account sign-in is temporarily unavailable.");
      unavailable.status = 503;
      unavailable.retryAfter = "3";
      unavailable.cause = error;
      throw unavailable;
    }
    const payload = await response.json().catch(() => null);
    const cookie = linkCheckerResponseCookies(response);
    if (!response.ok || !cookie) {
      const error = new Error(response.status === 401 ? "The configured Nocturne account login was rejected." : "Nocturne account sign-in is unavailable.");
      error.status = 503;
      if (response.status !== 401) error.retryAfter = response.headers.get("retry-after") || "3";
      throw error;
    }
    linkCheckerAccountCookie = cookie;
    return cookie;
  })();
  try {
    return await linkCheckerAccountLoginPromise;
  } finally {
    linkCheckerAccountLoginPromise = null;
  }
}

async function linkCheckerAccountRequest(path, options = {}, retry = true) {
  const cookie = await linkCheckerAccountLogin();
  const headers = { Accept: "application/json", ...(options.headers || {}), Cookie: cookie };
  let response;
  try {
    response = await fetch(`${linkCheckerApiOrigin}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    const unavailable = new Error("Nocturne is taking longer than expected. Nyx will retry automatically.");
    unavailable.status = 504;
    unavailable.retryAfter = "3";
    unavailable.cause = error;
    throw unavailable;
  }
  const payload = await response.json().catch(() => null);
  const redirectedToLogin = response.redirected && /(?:auth|login)/i.test(new URL(response.url).pathname);
  const htmlInsteadOfJson = response.ok
    && !payload
    && String(response.headers.get("content-type") || "").toLowerCase().includes("text/html");
  if (retry && (response.status === 401 || redirectedToLogin || htmlInsteadOfJson)) {
    linkCheckerAccountCookie = "";
    return linkCheckerAccountRequest(path, options, false);
  }
  if (!response.ok) {
    const error = new Error(
      response.status === 409
        ? "A Nocturne full scan is already running."
        : response.status === 429
          ? "The Nocturne account is temporarily rate limited."
        : response.status === 401
          ? "The configured Nocturne account session was rejected."
          : response.status === 403
            ? "The configured Nocturne account cannot complete this request."
            : "Nocturne could not complete this request."
    );
    error.status = response.status === 409 || response.status === 429
      ? response.status
      : (response.status < 500 ? response.status : 502);
    error.retryAfter = response.headers.get("retry-after") || "";
    throw error;
  }
  if (!payload || typeof payload !== "object") {
    const error = new Error("Nocturne returned an invalid full-scan response.");
    error.status = 502;
    throw error;
  }
  return payload;
}

async function linkCheckerCheckRequest(target, vendor = "", { requireAccount = false } = {}) {
  const options = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: target.href, ...(vendor ? { vendor } : {}) })
  };
  if (linkCheckerAccountConfigured()) {
    return linkCheckerAccountRequest("/api/check", options);
  }
  if (requireAccount) {
    const error = new Error("Fast page scans require the Nocturne account credentials in the VPS environment.");
    error.status = 503;
    throw error;
  }
  return linkCheckerUpstream("/api/check", options);
}

function linkCheckerAccountStatus(payload) {
  const last = payload?.lastResult && typeof payload.lastResult === "object" ? payload.lastResult : null;
  return {
    running: payload?.running === true,
    checked: Math.max(0, Number(payload?.checked) || 0),
    total: Math.max(0, Number(payload?.total) || 0),
    pending: Math.max(0, Number(payload?.pending) || 0),
    startedAt: String(payload?.startedAt || ""),
    vendors: Array.isArray(payload?.vendors) ? payload.vendors.map(String).slice(0, 64) : [],
    lastResult: last ? {
      checked: Math.max(0, Number(last.checked) || 0),
      total: Math.max(0, Number(last.total) || 0),
      failures: Math.max(0, Number(last.failures) || 0),
      finishedAt: String(last.finishedAt || last.completedAt || "")
    } : null
  };
}

function linkCheckerAccountDomainResults(payload) {
  const domains = Array.isArray(payload?.domains) ? payload.domains : [];
  return {
    page: Math.max(1, Number(payload?.page) || 1),
    totalPages: Math.max(1, Number(payload?.totalPages) || 1),
    total: Math.max(0, Number(payload?.total) || 0),
    domains: domains.slice(0, 100).map((domain) => {
      const vendorSource = domain?.vendors && typeof domain.vendors === "object" ? domain.vendors : {};
      const vendorResults = {};
      for (const [key, value] of Object.entries(vendorSource).slice(0, 64)) {
        if (!/^[a-z0-9_-]{1,64}$/i.test(key)) continue;
        vendorResults[key] = {
          blocked: value?.blocked === true ? true : (value?.blocked === false ? false : null),
          category: String(value?.category || "").slice(0, 160),
          error: String(value?.error || "").slice(0, 240)
        };
      }
      return { domain: String(domain?.domain_name || domain?.domain || "").trim().toLowerCase(), vendors: vendorResults };
    }).filter((domain) => domain.domain)
  };
}

app.get("/api/link-checker/vendors", async (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site link checks are not allowed." });
    return;
  }
  try {
    res.json(await linkCheckerUpstream("/api/check/vendors"));
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 502).json({ error: error.message || "The Link Checker provider is unavailable." });
  }
});

app.get("/api/custom-hostnames/config", (_req, res) => {
  const targetIps = nyxCustomHostnameTargetIps();
  res.set("Cache-Control", "no-store");
  res.json({
    enabled: Boolean(targetIps.length),
    automatic: true,
    targetIps,
    registrationLimit: nyxCustomHostnameRegistrationMaxAttempts
  });
});

app.get("/api/custom-hostnames/allow", async (req, res) => {
  if (!nyxInternalLoopbackRequest(req)) {
    res.status(404).end();
    return;
  }
  const requestedHostname = normalizeNyxCustomHostname(req.query?.domain);
  res.set("Cache-Control", "no-store");
  if (!requestedHostname) {
    res.status(400).end();
    return;
  }
  try {
    if (await nyxCustomHostnameAllowed(requestedHostname)) {
      res.status(204).end();
      return;
    }
    res.status(404).end();
  } catch (error) {
    console.error("Nyx custom-hostname authorization failed:", error?.message || error);
    res.status(503).end();
  }
});

app.post("/api/custom-hostnames", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const targetIps = nyxCustomHostnameTargetIps();
  if (!targetIps.length || !firebaseAdminModeConfigured()) {
    res.status(503).json({ error: "Custom-domain connection is not configured on this Nyx server." });
    return;
  }
  const requestedHostname = normalizeNyxCustomHostname(req.body?.hostname);
  if (!requestedHostname) {
    res.status(400).json({ error: "Enter a valid hostname without a path, port, or wildcard." });
    return;
  }
  const rate = nyxCustomHostnameRateState(nyxClientIp(req) || "unknown");
  rate.attempts += 1;
  if (rate.attempts > nyxCustomHostnameRegistrationMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + nyxCustomHostnameRegistrationWindowMs - Date.now()) / 1000));
    res.set("Retry-After", String(retryAfter));
    res.status(429).json({ error: "This network has made too many domain-verification attempts. Try again later." });
    return;
  }
  try {
    const resolvedIps = await nyxCustomHostnameResolvedIps(requestedHostname);
    const matchedIps = resolvedIps.filter(ip => targetIps.includes(ip));
    if (!matchedIps.length) {
      res.status(422).json({
        error: `That hostname does not currently resolve to Nyx. Set its A record to ${targetIps[0]}, wait for DNS to update, and try again.`,
        resolvedIps
      });
      return;
    }
    const firebase = await linkGeneratorFirebase();
    const reference = firebase.firestore
      .collection(nyxCustomHostnameCollectionName)
      .doc(nyxCustomHostnameDocumentId(requestedHostname));
    const existing = await reference.get();
    const now = new Date().toISOString();
    await reference.set({
      hostname: requestedHostname,
      status: "active",
      verifiedIps: matchedIps,
      verifiedAt: now,
      createdAt: existing.data()?.createdAt || now
    }, { merge: true });
    cacheNyxCustomHostnameDecision(requestedHostname, true);
    res.status(existing.exists ? 200 : 201).json({
      ok: true,
      hostname: requestedHostname,
      url: `https://${requestedHostname}/`,
      message: "Domain verified. HTTPS will be prepared automatically on its first visit."
    });
  } catch (error) {
    const status = /timed out/i.test(String(error?.message || "")) ? 504 : 502;
    console.error("Nyx custom-hostname verification failed:", error?.message || error);
    res.status(status).json({ error: status === 504 ? error.message : "Nyx could not verify that hostname right now." });
  }
});

app.get("/connect-domain", (_req, res) => {
  res.sendFile(join(staticRoot, "apps", "connect-domain", "index.html"));
});

app.post("/api/link-checker/full-scan/start", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site full scans are not allowed." });
    return;
  }
  try {
    await linkCheckerBulkSubscriber(req);
    let started = null;
    try {
      started = await linkCheckerAccountRequest("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      });
    } catch (error) {
      if (error.status !== 409) throw error;
      res.json({ running: true, checked: 0, total: 0, pending: 0, vendors: [], started: false });
      return;
    }
    const total = Math.max(0, Number(started?.total) || 0);
    res.status(202).json({ running: true, checked: 0, total, pending: total, vendors: [], started: true });
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 500).json({ error: error.message || "The full scan could not be started." });
  }
});

app.get("/api/link-checker/full-scan/status", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site full scans are not allowed." });
    return;
  }
  try {
    await linkCheckerBulkSubscriber(req);
    res.json(linkCheckerAccountStatus(await linkCheckerAccountRequest("/api/vendors/status")));
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 500).json({ error: error.message || "Full-scan status is unavailable." });
  }
});

app.get("/api/link-checker/full-scan/results", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site full-scan results are not allowed." });
    return;
  }
  const page = Number.parseInt(String(req.query?.page || "1"), 10);
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    res.status(400).json({ error: "A valid full-scan result page is required." });
    return;
  }
  try {
    await linkCheckerBulkSubscriber(req);
    const payload = linkCheckerAccountDomainResults(await linkCheckerAccountRequest(`/api/domains?page=${page}&perPage=100&search=`));
    res.json({ ...payload, page });
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 500).json({ error: error.message || "Full-scan results are unavailable." });
  }
});

app.get("/api/link-checker/freedns-registry", async (req, res) => {
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site registry scraping is not allowed." });
    return;
  }
  const page = Number.parseInt(String(req.query?.page || "1"), 10);
  if (!Number.isInteger(page) || page < 1 || page > 500) {
    res.status(400).json({ error: "A valid FreeDNS registry page is required." });
    return;
  }
  const cached = freednsRegistryCache.get(page);
  if (cached && Date.now() - cached.storedAt < freednsRegistryCacheTtlMs) {
    res.set("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
    res.json({ ...cached.payload, cached: true });
    return;
  }
  const rate = freednsRegistryRateState(linkGeneratorClientId(req));
  rate.attempts += 1;
  if (rate.attempts > freednsRegistryMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + freednsRegistryWindowMs - Date.now()) / 1000));
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: "The FreeDNS registry scrape limit has been reached. Try again later." });
    return;
  }
  try {
    const path = page === 1 ? "/domain/registry/" : `/domain/registry/page-${page}.html`;
    const response = await fetch(`https://freedns.afraid.org${path}`, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "NyxLinkChecker/1.0 (+https://nyxlearning.org)"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      res.status(response.status === 404 ? 404 : 502).json({ error: response.status === 404 ? "That FreeDNS registry page does not exist." : "FreeDNS could not complete the registry request." });
      return;
    }
    const payload = parseFreednsRegistryPage(await response.text(), page);
    if (page > payload.totalPages || payload.page !== page) {
      res.status(400).json({ error: "That FreeDNS registry page is outside the current registry." });
      return;
    }
    freednsRegistryCache.set(page, { storedAt: Date.now(), payload });
    res.set("Cache-Control", "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600");
    res.json({ ...payload, cached: false });
  } catch (error) {
    console.warn("Nyx FreeDNS registry scrape failed:", error?.message || error);
    res.status(error.status || 502).json({ error: error.message || "The FreeDNS registry could not be reached." });
  }
});

app.post("/api/link-checker/page-scan", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site page scans are not allowed." });
    return;
  }
  const requestedUrls = Array.isArray(req.body?.urls) ? req.body.urls : [];
  const targets = [];
  const seen = new Set();
  for (const value of requestedUrls) {
    const target = normalizedDownloadSafetyUrl(value);
    if (!target || seen.has(target.href)) continue;
    seen.add(target.href);
    targets.push(target);
  }
  if (!targets.length || targets.length > 25 || targets.length !== requestedUrls.length) {
    res.status(400).json({ error: "Page scans require between 1 and 25 unique HTTP or HTTPS URLs." });
    return;
  }
  const vendor = String(req.body?.vendor || "").trim().toLowerCase();
  if (vendor && !/^[a-z0-9_-]{1,64}$/.test(vendor)) {
    res.status(400).json({ error: "The selected Link Checker vendor is invalid." });
    return;
  }
  const rate = linkCheckerPageRateState(linkGeneratorClientId(req));
  rate.attempts += 1;
  if (rate.attempts > linkCheckerPageBatchMaxAttempts) {
    const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + linkCheckerWindowMs - Date.now()) / 1000));
    res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many page scans. Try again later." });
    return;
  }

  const results = new Array(targets.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < targets.length) {
      const index = cursor;
      cursor += 1;
      const target = targets[index];
      try {
        results[index] = { url: target.href, report: await linkCheckerCheckRequest(target, vendor, { requireAccount: true }) };
      } catch (error) {
        results[index] = {
          url: target.href,
          error: error.message || "Nocturne could not check this domain.",
          status: error.status || 502
        };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
  if (!results.some((result) => result?.report)) {
    const first = results[0] || {};
    const status = Number(first.status) || 502;
    res.status(status >= 400 && status < 600 ? status : 502).json({ error: first.error || "Nocturne could not check this page." });
    return;
  }
  res.json({ results });
});

app.post("/api/link-checker/check", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site link checks are not allowed." });
    return;
  }
  const bulk = req.body?.bulk === true;
  let bulkSubscriberUid = "";
  if (bulk) {
    try {
      const { subscriber } = await linkCheckerBulkSubscriber(req);
      bulkSubscriberUid = subscriber.uid;
    } catch (error) {
      res.status(error.status || 500).json({ error: error.message || "Full-registry scan access could not be verified." });
      return;
    }
  } else {
    const rate = linkCheckerRateState(linkGeneratorClientId(req));
    rate.attempts += 1;
    if (rate.attempts > linkCheckerMaxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + linkCheckerWindowMs - Date.now()) / 1000));
      res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many link checks. Try again later." });
      return;
    }
  }
  const target = normalizedDownloadSafetyUrl(req.body?.url);
  if (!target) {
    res.status(400).json({ error: "A valid HTTP or HTTPS URL is required." });
    return;
  }
  const vendor = String(req.body?.vendor || "").trim().toLowerCase();
  if (vendor && !/^[a-z0-9_-]{1,64}$/.test(vendor)) {
    res.status(400).json({ error: "The selected Link Checker vendor is invalid." });
    return;
  }
  const releaseBulkSlot = bulk ? reserveLinkCheckerBulkSlot(bulkSubscriberUid) : null;
  if (bulk && !releaseBulkSlot) {
    res.set("Retry-After", "2").status(429).json({ error: "Premium full-scan capacity is busy. Nyx will retry shortly." });
    return;
  }
  try {
    const payload = await linkCheckerCheckRequest(target, vendor);
    res.json(payload);
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 502).json({ error: error.message || "The Link Checker provider is unavailable." });
  } finally {
    releaseBulkSlot?.();
  }
});

app.post("/api/link-checker/domain-info", async (req, res) => {
  res.set("Cache-Control", "public, max-age=900");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site domain lookups are not allowed." });
    return;
  }
  const target = normalizedDownloadSafetyUrl(req.body?.url);
  const host = String(target?.hostname || "").toLowerCase();
  if (!host || host === "localhost" || isIP(host)) {
    res.status(400).json({ error: "Registration details require a public domain name." });
    return;
  }
  try {
    const response = await fetch(`https://rdap.org/domain/${encodeURIComponent(host)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) {
      res.status(response.status === 404 ? 404 : 502).json({
        error: response.status === 404
          ? "Registration details were not found for this domain."
          : "The registration lookup provider is unavailable."
      });
      return;
    }
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      res.status(502).json({ error: "The registration lookup returned an invalid response." });
      return;
    }
    const registrar = Array.isArray(payload.entities)
      ? payload.entities.find(entity => Array.isArray(entity?.roles) && entity.roles.includes("registrar"))
      : null;
    const registrarCard = Array.isArray(registrar?.vcardArray?.[1]) ? registrar.vcardArray[1] : [];
    const registrarName = String(registrarCard.find(field => field?.[0] === "fn")?.[3] || registrar?.handle || "");
    const events = Array.isArray(payload.events) ? payload.events.map(event => ({
      action: String(event?.eventAction || ""),
      date: String(event?.eventDate || "")
    })).filter(event => event.action || event.date) : [];
    const nameservers = Array.isArray(payload.nameservers)
      ? payload.nameservers.map(nameserver => String(nameserver?.ldhName || nameserver?.unicodeName || "")).filter(Boolean)
      : [];
    res.json({
      domain: String(payload.ldhName || payload.unicodeName || host).toLowerCase(),
      handle: String(payload.handle || ""),
      registrar: registrarName,
      status: Array.isArray(payload.status) ? payload.status.map(String) : [],
      events,
      nameservers,
      dnssec: payload.secureDNS?.delegationSigned === true,
      source: "RDAP"
    });
  } catch (error) {
    console.warn("Nyx Link Checker registration lookup failed:", error?.message || error);
    res.status(502).json({ error: "The registration lookup provider could not be reached." });
  }
});

async function googleSafeBrowsingLookup(url) {
  const apiKey = String(process.env.NYX_SAFE_BROWSING_API_KEY || process.env.GOOGLE_SAFE_BROWSING_API_KEY || "").trim();
  if (!apiKey) return { configured: false, matches: [] };
  const cacheKey = url.href;
  const cached = downloadSafetyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "nyx-browser", clientVersion: "1.0.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: [{ url: url.href }]
        }
      })
    });
    if (!response.ok) throw new Error(`Safe Browsing returned ${response.status}`);
    const payload = await response.json().catch(() => ({}));
    const matches = Array.isArray(payload.matches) ? payload.matches.map(match => String(match?.threatType || "UNKNOWN")).filter(Boolean) : [];
    const value = { configured: true, matches };
    downloadSafetyCache.set(cacheKey, { expiresAt: Date.now() + 10 * 60_000, value });
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

app.post("/api/download-safety/check", async (req, res) => {
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-site download checks are not allowed." });
    return;
  }
  const rate = downloadSafetyRateState(linkGeneratorClientId(req));
  rate.attempts += 1;
  if (rate.attempts > downloadSafetyMaxAttempts) {
    res.set("Retry-After", String(Math.ceil(downloadSafetyWindowMs / 1000)));
    res.status(429).json({ error: "Too many download checks. Try again in a minute." });
    return;
  }
  const target = normalizedDownloadSafetyUrl(req.body?.url);
  if (!target) {
    res.status(400).json({ error: "A valid HTTP or HTTPS download URL is required." });
    return;
  }
  const fileRisk = downloadSafetyFileRisk(target, req.body?.filename);
  try {
    const lookup = await googleSafeBrowsingLookup(target);
    const threats = [...new Set(lookup.matches)];
    const blocked = threats.length > 0;
    const caution = !blocked && fileRisk !== "ordinary";
    res.setHeader("cache-control", "no-store");
    res.json({
      verdict: blocked ? "blocked" : (caution ? "caution" : (lookup.configured ? "clear" : "unverified")),
      provider: lookup.configured ? "Google Safe Browsing" : "Nyx local checks",
      providerConfigured: lookup.configured,
      threats,
      fileRisk,
      urlChecked: lookup.configured,
      fileScanned: false,
      message: blocked
        ? "This download URL matches a known threat list."
        : (caution
          ? `This is ${fileRisk === "executable" ? "an executable or installable file" : "an archive"}; inspect it carefully before opening it.`
          : (lookup.configured
            ? "No known URL threat was reported. The file contents were not antivirus-scanned."
            : "URL reputation checking is not configured on this Nyx server. The file contents were not antivirus-scanned."))
    });
  } catch (error) {
    console.warn("Nyx download safety lookup failed:", error?.message || error);
    res.setHeader("cache-control", "no-store");
    res.json({
      verdict: fileRisk === "ordinary" ? "unverified" : "caution",
      provider: "Nyx local checks",
      providerConfigured: true,
      threats: [],
      fileRisk,
      urlChecked: false,
      fileScanned: false,
      message: "The URL reputation service could not be reached. The file contents were not antivirus-scanned."
    });
  }
});

function nyxAccountSignInRateState(clientId, now = Date.now()) {
  for (const [key, state] of nyxAccountSignInAttempts) {
    if (now - state.windowStarted > nyxAccountSignInWindowMs) nyxAccountSignInAttempts.delete(key);
  }
  let state = nyxAccountSignInAttempts.get(clientId);
  if (!state || now - state.windowStarted > nyxAccountSignInWindowMs) {
    state = { attempts: 0, windowStarted: now };
    nyxAccountSignInAttempts.set(clientId, state);
  }
  return state;
}

function nyxAccountRegisterRateState(clientId, now = Date.now()) {
  for (const [key, state] of nyxAccountRegisterAttempts) {
    if (now - state.windowStarted > nyxAccountSignInWindowMs) nyxAccountRegisterAttempts.delete(key);
  }
  let state = nyxAccountRegisterAttempts.get(clientId);
  if (!state || now - state.windowStarted > nyxAccountSignInWindowMs) {
    state = { attempts: 0, windowStarted: now };
    nyxAccountRegisterAttempts.set(clientId, state);
  }
  return state;
}

function nyxAccountPasswordResetRateState(clientId, now = Date.now()) {
  for (const [key, state] of nyxAccountPasswordResetAttempts) {
    if (now - state.windowStarted > nyxAccountSignInWindowMs) nyxAccountPasswordResetAttempts.delete(key);
  }
  let state = nyxAccountPasswordResetAttempts.get(clientId);
  if (!state || now - state.windowStarted > nyxAccountSignInWindowMs) {
    state = { attempts: 0, windowStarted: now };
    nyxAccountPasswordResetAttempts.set(clientId, state);
  }
  return state;
}

function utcQuotaDay(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function quotaIpKey(clientId) {
  return createHash("sha256").update(String(clientId || "unknown")).digest("hex").slice(0, 32);
}

async function reserveFreeLink(firebase, uid, clientId) {
  const day = utcQuotaDay();
  const collection = firebase.firestore.collection("nyxLinkGeneratorUsage");
  const userRef = collection.doc(`${day}_user_${uid}`);
  const ipRef = collection.doc(`${day}_ip_${quotaIpKey(clientId)}`);
  return firebase.firestore.runTransaction(async transaction => {
    const [userSnapshot, ipSnapshot] = await transaction.getAll(userRef, ipRef);
    const userCount = Number(userSnapshot.data()?.count || 0);
    const ipCount = Number(ipSnapshot.data()?.count || 0);
    if (userCount >= freeLinkDailyLimit) {
      const error = new Error(`This account has used all ${freeLinkDailyLimit} free links for today.`);
      error.status = 429;
      throw error;
    }
    if (ipCount >= freeNetworkDailyLimit) {
      const error = new Error("This network has reached the Link Generator safety limit for today.");
      error.status = 429;
      throw error;
    }
    const updatedAt = new Date().toISOString();
    transaction.set(userRef, { count: userCount + 1, day, uid, updatedAt }, { merge: true });
    transaction.set(ipRef, { count: ipCount + 1, day, updatedAt }, { merge: true });
    return { remaining: freeLinkDailyLimit - userCount - 1, userRef, ipRef };
  });
}

async function releaseFreeLink(firebase, reservation) {
  if (!reservation) return;
  try {
    await firebase.firestore.runTransaction(async transaction => {
      const snapshots = await transaction.getAll(reservation.userRef, reservation.ipRef);
      for (let index = 0; index < snapshots.length; index += 1) {
        const count = Math.max(0, Number(snapshots[index].data()?.count || 0) - 1);
        transaction.set(index === 0 ? reservation.userRef : reservation.ipRef, { count, updatedAt: new Date().toISOString() }, { merge: true });
      }
    });
  } catch (error) {
    console.error("Nyx Link Generator could not release a failed quota reservation:", error?.message || error);
  }
}

function premiumCooldownError(cooldownUntil, now = Date.now()) {
  const retryAfter = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
  const minutes = Math.floor(retryAfter / 60);
  const seconds = retryAfter % 60;
  const wait = minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const error = new Error(`Premium cooldown active. Try again in ${wait}.`);
  error.status = 429;
  error.retryAfter = retryAfter;
  return error;
}

function premiumReservationResult(previousCount, previousCooldownUntil, amount, cooldownUntil, version, extra = {}) {
  return {
    previousCount,
    previousCooldownUntil,
    amount,
    accumulated: previousCount + amount,
    cooldownTriggered: cooldownUntil > 0,
    cooldownUntil,
    version,
    ...extra
  };
}

async function reservePremiumGeneration(firebase, clientId, amount, now = Date.now()) {
  const key = quotaIpKey(clientId);
  if (!firebase) {
    const current = premiumGenerationUsage.get(key) || { count: 0, cooldownUntil: 0, version: 0 };
    if (current.cooldownUntil > now) throw premiumCooldownError(current.cooldownUntil, now);
    const previousCount = current.cooldownUntil ? 0 : Number(current.count || 0);
    const accumulated = previousCount + amount;
    const cooldownTriggered = amount >= premiumImmediateCooldownAt || accumulated >= premiumAccumulatedLimit;
    const next = { count: accumulated, cooldownUntil: cooldownTriggered ? now + premiumCooldownMs : 0, version: current.version + 1 };
    premiumGenerationUsage.set(key, next);
    return premiumReservationResult(previousCount, current.cooldownUntil || 0, amount, next.cooldownUntil, next.version, { key, storage: "memory" });
  }

  const ref = firebase.firestore.collection("nyxLinkGeneratorPremiumUsage").doc(key);
  return firebase.firestore.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() || {};
    const activeCooldown = Number(data.cooldownUntil || 0);
    if (activeCooldown > now) throw premiumCooldownError(activeCooldown, now);
    const previousCount = activeCooldown ? 0 : Number(data.count || 0);
    const accumulated = previousCount + amount;
    const cooldownTriggered = amount >= premiumImmediateCooldownAt || accumulated >= premiumAccumulatedLimit;
    const cooldownUntil = cooldownTriggered ? now + premiumCooldownMs : 0;
    const version = Number(data.version || 0) + 1;
    transaction.set(ref, { count: accumulated, cooldownUntil, version, updatedAt: new Date(now).toISOString() }, { merge: true });
    return premiumReservationResult(previousCount, activeCooldown, amount, cooldownUntil, version, { ref, storage: "firestore" });
  });
}

async function adjustPremiumGeneration(firebase, reservation, created) {
  if (!reservation || created >= reservation.amount) return reservation;
  const actual = Math.max(0, Number(created || 0));
  const immediateCooldown = reservation.amount >= premiumImmediateCooldownAt && actual > 0;
  const actualAccumulated = reservation.previousCount + actual;
  const shouldKeepCooldown = immediateCooldown || actualAccumulated >= premiumAccumulatedLimit;

  if (reservation.storage === "memory") {
    const current = premiumGenerationUsage.get(reservation.key);
    if (!current) return reservation;
    const count = Math.max(0, Number(current.count || 0) - (reservation.amount - actual));
    const sameReservation = current.version === reservation.version;
    premiumGenerationUsage.set(reservation.key, {
      count,
      cooldownUntil: sameReservation && !shouldKeepCooldown ? reservation.previousCooldownUntil : current.cooldownUntil,
      version: current.version + 1
    });
    return { ...reservation, accumulated: actualAccumulated, cooldownTriggered: shouldKeepCooldown, cooldownUntil: shouldKeepCooldown ? current.cooldownUntil : reservation.previousCooldownUntil };
  }

  try {
    return await firebase.firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(reservation.ref);
      const data = snapshot.data() || {};
      const sameReservation = Number(data.version || 0) === reservation.version;
      const count = Math.max(0, Number(data.count || 0) - (reservation.amount - actual));
      const cooldownUntil = sameReservation && !shouldKeepCooldown ? reservation.previousCooldownUntil : Number(data.cooldownUntil || 0);
      transaction.set(reservation.ref, { count, cooldownUntil, version: Number(data.version || 0) + 1, updatedAt: new Date().toISOString() }, { merge: true });
      return { ...reservation, accumulated: actualAccumulated, cooldownTriggered: shouldKeepCooldown, cooldownUntil: shouldKeepCooldown ? cooldownUntil : reservation.previousCooldownUntil };
    });
  } catch (error) {
    console.error("Nyx Link Generator could not adjust a Premium cooldown reservation:", error?.message || error);
    return reservation;
  }
}

async function authenticatedLinkGeneratorUser(req) {
  const match = String(req.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error("Sign in with a verified account or enter your Premium access code.");
    error.status = 401;
    throw error;
  }
  const firebase = await linkGeneratorFirebase();
  if (!firebase) {
    const error = new Error("Free account access has not been configured by the Nyx administrator yet.");
    error.status = 503;
    throw error;
  }
  let token;
  try {
    token = await firebase.auth.verifyIdToken(match[1], true);
  } catch {
    const error = new Error("Your sign-in has expired. Sign in again.");
    error.status = 401;
    throw error;
  }
  const administration = await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get();
  const administrationData = administration.data() || {};
  const subscriptionStatus = normalizeSubscriptionStatus(administrationData.subscriptionStatus || administrationData.subscription?.status);
  const premiumAccess = hasPremiumSubscription(subscriptionStatus);
  if (!token.email_verified && !premiumAccess) {
    const error = new Error("Verify your email address before generating free links.");
    error.status = 403;
    throw error;
  }
  return { firebase, uid: token.uid, subscriptionStatus, premiumAccess };
}

function generatedPullZoneName(label) {
  const slug = String(label || "link")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "link";
  return `${slug}-${randomBytes(3).toString("hex")}`;
}

function generatedBunnyUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const validHostname = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.b-cdn\.net$/i.test(parsed.hostname);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port || !validHostname || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizedOrigin(value) {
  try {
    const parsed = new URL(String(value || ""));
    parsed.pathname = parsed.pathname.replace(/\/$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

async function bunnyRequest(path, apiKey, options = {}) {
  const response = await fetch(`https://api.bunny.net${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      AccessKey: apiKey,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15_000)
  });
  let payload = null;
  try { payload = await response.json(); } catch {}
  if (!response.ok) {
    const message = String(payload?.Message || payload?.message || `Bunny API returned ${response.status}`).slice(0, 240);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function resolveNyxAccountIdentifier(firebase, value) {
  const identifier = String(value || "").trim();
  const usernameIdentifier = /^@[a-z0-9_.-]{3,32}$/i.test(identifier);
  if (identifier.includes("@") && !usernameIdentifier) {
    const authEmail = normalizeNyxAccountEmail(identifier);
    return authEmail ? { authEmail, expectedUid: "" } : null;
  }
  const username = nyxProfileUsername(identifier.replace(/^@+/, ""), "");
  if (!username) return null;
  const usernameSnapshot = await firebase.firestore.collection("nyxUsernames").doc(username).get();
  const expectedUid = String(usernameSnapshot.data()?.ownerUid || "");
  if (expectedUid) {
    const account = await firebase.auth.getUser(expectedUid);
    return { authEmail: String(account.email || ""), expectedUid, username, repairUsername: false };
  }
  const localAccountEmail = `${username}@account.nyx.local`;
  const localAccount = await firebase.auth.getUserByEmail(localAccountEmail).catch(() => null);
  if (localAccount) {
    return { authEmail: String(localAccount.email || localAccountEmail), expectedUid: localAccount.uid, username, repairUsername: true };
  }
  const handleProfiles = await firebase.firestore.collection("nyxUserProfiles").where("profile.handle", "==", `@${username}`).limit(2).get();
  if (handleProfiles.size === 1) {
    const account = await firebase.auth.getUser(handleProfiles.docs[0].id).catch(() => null);
    if (account) return { authEmail: String(account.email || ""), expectedUid: account.uid, username, repairUsername: true };
  }
  const legacyProfiles = await firebase.firestore.collection("nyxUserProfiles").where("profile.displayName", "==", username).limit(3).get();
  const legacyAccounts = (await Promise.all(legacyProfiles.docs.map(document => firebase.auth.getUser(document.id).catch(() => null))))
    .filter(account => account && String(account.displayName || "").trim().toLowerCase() === username);
  if (legacyAccounts.length === 1) {
    const account = legacyAccounts[0];
    return { authEmail: String(account.email || ""), expectedUid: account.uid, username, repairUsername: true };
  }
  const authDirectory = await listAllFirebaseUsers(firebase.auth);
  const displayNameAccounts = authDirectory.users.filter(account => String(account.displayName || "").trim().toLowerCase() === username);
  if (displayNameAccounts.length === 1) {
    const account = displayNameAccounts[0];
    return { authEmail: String(account.email || ""), expectedUid: account.uid, username, repairUsername: true };
  }
  return { authEmail: localAccountEmail, expectedUid: "", username, repairUsername: false };
}

async function repairLegacyNyxUsername(firebase, uid, username) {
  if (!uid || !username) return;
  const profileRef = firebase.firestore.collection("nyxUserProfiles").doc(uid);
  const snapshot = await profileRef.get();
  if (!snapshot.exists) return;
  const account = await firebase.auth.getUser(uid);
  const token = { uid, email: String(account.email || ""), name: String(account.displayName || username), picture: String(account.photoURL || "") };
  const previousProfile = normalizeNyxUserProfile(snapshot.data()?.profile, token);
  const nextProfile = { ...previousProfile, handle: `@${username}` };
  await saveNyxProfileWithUsername(firebase, token, nextProfile, String(snapshot.data()?.createdAt || new Date().toISOString()), previousProfile);
}

app.post("/api/account/register", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  if (!firebaseAccountModeConfigured()) {
    res.status(503).json({ error: "Nyx accounts are not configured." });
    return;
  }
  const rateState = nyxAccountRegisterRateState(linkGeneratorClientId(req));
  if (rateState.attempts >= nyxAccountRegisterMaxAttempts) {
    res.status(429).json({ error: "Too many account creation attempts. Try again in a few minutes." });
    return;
  }
  const rawUsername = String(req.body?.username || "").trim().toLowerCase().replace(/^@+/, "");
  const username = nyxProfileUsername(rawUsername, "");
  const password = String(req.body?.password || "");
  const requestedEmail = String(req.body?.email || "").trim();
  const recoveryEmail = requestedEmail ? normalizeNyxAccountEmail(requestedEmail) : "";
  if (!username || username !== rawUsername) {
    res.status(400).json({ error: "Use 3–32 letters, numbers, dots, dashes, or underscores." });
    return;
  }
  if (requestedEmail && !recoveryEmail) {
    res.status(400).json({ error: "Enter a valid email address or leave the email field blank." });
    return;
  }
  if (password.length < 8 || password.length > 256) {
    res.status(400).json({ error: "Choose a password with at least 8 characters." });
    return;
  }
  rateState.attempts += 1;
  let createdUid = "";
  try {
    const firebase = await linkGeneratorFirebase();
    const usernameRef = firebase.firestore.collection("nyxUsernames").doc(username);
    const [usernameSnapshot, duplicateProfiles] = await Promise.all([
      usernameRef.get(),
      firebase.firestore.collection("nyxUserProfiles").where("profile.handle", "==", `@${username}`).limit(1).get()
    ]);
    if (usernameSnapshot.exists || !duplicateProfiles.empty) {
      res.status(409).json({ error: "That username is already taken." });
      return;
    }
    const email = recoveryEmail || `${username}@account.nyx.local`;
    const account = await firebase.auth.createUser({
      email,
      password,
      displayName: username,
      emailVerified: false,
      disabled: false
    });
    createdUid = account.uid;
    const profileToken = { uid: account.uid, email, name: username, picture: "" };
    const profile = normalizeNyxUserProfile({ displayName: username, handle: `@${username}` }, profileToken);
    try {
      await saveNyxProfileWithUsername(firebase, profileToken, profile, new Date().toISOString());
    } catch (error) {
      await firebase.auth.deleteUser(account.uid).catch(() => {});
      createdUid = "";
      throw error;
    }
    createdUid = "";
    await firebase.firestore.collection("nyxUserAdministration").doc(account.uid).set({
      role: "member",
      disabled: false,
      subscriptionStatus: "free",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true }).catch(error => {
      console.warn("Nyx account defaults could not be stored:", error?.message || error);
    });
    await recordNyxAuditSafe(firebase, {
      actorUid: account.uid,
      actorEmail: email,
      action: "account_created",
      targetUid: account.uid,
      targetEmail: email,
      details: { username }
    });
    const customToken = await firebase.auth.createCustomToken(account.uid);
    nyxAccountRegisterAttempts.delete(linkGeneratorClientId(req));
    invalidateOwnerDashboardSnapshot();
    res.status(201).json({
      customToken,
      verificationRequired: Boolean(recoveryEmail)
    });
  } catch (error) {
    const duplicateEmail = error?.code === "auth/email-already-exists";
    const duplicate = duplicateEmail || error?.status === 409;
    const invalidPassword = error?.code === "auth/invalid-password";
    if (createdUid) {
      const firebase = await linkGeneratorFirebase().catch(() => null);
      await firebase?.auth.deleteUser(createdUid).catch(() => {});
    }
    res.status(duplicate ? 409 : (invalidPassword ? 400 : (error.status || 503))).json({
      error: duplicate
        ? (duplicateEmail ? "That email is already connected to an account." : "That username is already taken.")
        : invalidPassword
          ? "Choose a password with at least 8 characters."
          : (error.message || "Account creation is temporarily unavailable.")
    });
  }
});

app.post("/api/account/sign-in", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  if (!firebaseAccountModeConfigured()) {
    res.status(503).json({ error: "Nyx accounts are not configured." });
    return;
  }
  const rateState = nyxAccountSignInRateState(linkGeneratorClientId(req));
  if (rateState.attempts >= nyxAccountSignInMaxAttempts) {
    res.status(429).json({ error: "Too many sign-in attempts. Try again in a few minutes." });
    return;
  }
  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");
  if (!identifier || password.length < 6 || password.length > 256) {
    res.status(400).json({ error: "Enter your username or email and password." });
    return;
  }
  rateState.attempts += 1;
  try {
    const firebase = await linkGeneratorFirebase();
    const resolved = await resolveNyxAccountIdentifier(firebase, identifier);
    if (!resolved?.authEmail) {
      res.status(401).json({ error: "Username, email, or password is incorrect." });
      return;
    }
    const { authEmail, expectedUid } = resolved;
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(linkGeneratorFirebaseConfig().webApiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: authEmail, password, returnSecureToken: true }),
      signal: AbortSignal.timeout(15_000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.localId || (expectedUid && payload.localId !== expectedUid)) {
      res.status(response.status === 429 ? 429 : 401).json({
        error: response.status === 429 ? "Too many sign-in attempts. Try again later." : "Username, email, or password is incorrect."
      });
      return;
    }
    if (resolved.repairUsername && resolved.username) {
      await repairLegacyNyxUsername(firebase, payload.localId, resolved.username).catch(error => {
        console.warn("Nyx legacy username mapping could not be repaired:", error?.message || error);
      });
    }
    const customToken = await firebase.auth.createCustomToken(payload.localId);
    nyxAccountSignInAttempts.delete(linkGeneratorClientId(req));
    res.json({ customToken });
  } catch (error) {
    const knownAccountError = ["auth/user-not-found", "auth/invalid-email"].includes(String(error?.code || ""));
    res.status(knownAccountError ? 401 : 503).json({
      error: knownAccountError ? "Username, email, or password is incorrect." : "Sign-in is temporarily unavailable."
    });
  }
});

app.post("/api/account/password-reset", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  if (!firebaseAccountModeConfigured()) {
    res.status(503).json({ error: "Nyx accounts are not configured." });
    return;
  }
  const clientId = linkGeneratorClientId(req);
  const rateState = nyxAccountPasswordResetRateState(clientId);
  if (rateState.attempts >= nyxAccountPasswordResetMaxAttempts) {
    res.status(429).json({ error: "Too many reset attempts. Try again in a few minutes." });
    return;
  }
  const identifier = String(req.body?.identifier || "").trim();
  if (identifier.length < 3 || identifier.length > 254) {
    res.status(400).json({ error: "Enter your username or email." });
    return;
  }
  rateState.attempts += 1;
  const genericMessage = "If that account has a recovery email, Firebase sent a password-reset message.";
  try {
    const firebase = await linkGeneratorFirebase();
    const resolved = await resolveNyxAccountIdentifier(firebase, identifier).catch(() => null);
    if (resolved?.authEmail && nyxDeliverableEmail(resolved.authEmail)) {
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(linkGeneratorFirebaseConfig().webApiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: resolved.authEmail }),
        signal: AbortSignal.timeout(15_000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok && String(payload?.error?.message || "") !== "EMAIL_NOT_FOUND") {
        throw new Error("Firebase could not send the reset email.");
      }
      if (response.ok) {
        nyxAccountPasswordResetAttempts.delete(clientId);
        await recordNyxAuditSafe(firebase, {
          actorUid: resolved.expectedUid,
          actorEmail: resolved.authEmail,
          action: "password_reset_requested",
          targetUid: resolved.expectedUid,
          targetEmail: resolved.authEmail
        });
      }
    }
    res.status(202).json({ message: genericMessage });
  } catch (error) {
    console.warn("Nyx password reset request failed:", error?.message || error);
    res.status(202).json({ message: genericMessage });
  }
});

app.get("/api/account/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const [account, administration] = await Promise.all([
      firebase.auth.getUser(token.uid),
      firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get()
    ]);
    const administrationData = administration.data() || {};
    const role = nyxRoleForUser(token.uid, administrationData);
    const customRole = nyxAssignedCustomRole(administrationData, await nyxCustomRoles(firebase));
    const access = nyxOwnerAccessPayload({ uid: token.uid, role, customRole, permissions: customRole?.permissions || nyxRolePolicy(role).permissions });
    const subscriptionStatus = normalizeSubscriptionStatus(administrationData.subscriptionStatus || administrationData.subscription?.status);
    res.json({
      uid: token.uid,
      email: nyxDeliverableEmail(account.email) ? String(account.email) : "",
      emailVerified: Boolean(account.emailVerified),
      role,
      owner: access.owner,
      dashboard: access.dashboard,
      permissions: access.permissions,
      subscriptionStatus,
      premiumAccess: hasPremiumSubscription(subscriptionStatus)
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Account information is unavailable." });
  }
});

app.put("/api/account/me/email", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const email = normalizeNyxAccountEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "Enter a valid email address." });
      return;
    }
    const current = await firebase.auth.getUser(token.uid);
    if (String(current.email || "").toLowerCase() !== email) {
      await firebase.auth.updateUser(token.uid, { email, emailVerified: false });
      const now = new Date().toISOString();
      await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).set({
        emailAttachedAt: now,
        updatedAt: now
      }, { merge: true });
      invalidateOwnerDashboardSnapshot();
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: email,
        action: "account_email_changed",
        targetUid: token.uid,
        targetEmail: email
      });
    }
    const updated = await firebase.auth.getUser(token.uid);
    const customToken = await firebase.auth.createCustomToken(token.uid);
    res.json({
      email: String(updated.email || ""),
      emailVerified: Boolean(updated.emailVerified),
      customToken
    });
  } catch (error) {
    const duplicate = error.code === "auth/email-already-exists";
    res.status(duplicate ? 409 : (error.status || 503)).json({
      error: duplicate ? "That email is already connected to another account." : (error.message || "Your email could not be updated.")
    });
  }
});

app.get("/api/profiles/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const ref = firebase.firestore.collection("nyxUserProfiles").doc(token.uid);
    const snapshot = await ref.get();
    const profile = normalizeNyxUserProfile(snapshot.data()?.profile, token);
    const createdAt = String(snapshot.data()?.createdAt || new Date().toISOString());
    if (!snapshot.exists) {
      const savedProfile = await saveNyxProfileWithUsername(firebase, token, profile, createdAt);
      Object.assign(profile, savedProfile);
      invalidateOwnerDashboardSnapshot();
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: token.email,
        action: "profile_created",
        targetUid: token.uid,
        targetEmail: token.email
      });
    }
    res.json({ uid: token.uid, profile, createdAt });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Nyx Profile is unavailable." });
  }
});

app.put("/api/profiles/me", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const ref = firebase.firestore.collection("nyxUserProfiles").doc(token.uid);
    const previous = await ref.get();
    const requestedHandle = String(req.body?.profile?.handle || "").trim().replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9_.-]{3,32}$/.test(requestedHandle)) {
      res.status(400).json({ error: "Usernames must use 3–32 letters, numbers, dots, dashes, or underscores." });
      return;
    }
    let profile = normalizeNyxUserProfile(req.body?.profile, token);
    if (nyxProfileImagePayloadSize(profile) > profileImageDocumentLimit) {
      res.status(413).json({ error: "Your avatar and banner are too large together. Remove one or choose a smaller GIF." });
      return;
    }
    const createdAt = String(previous.data()?.createdAt || new Date().toISOString());
    const previousProfile = normalizeNyxUserProfile(previous.data()?.profile, token);
    const previousUsername = nyxProfileUsername(previousProfile.handle, "");
    profile = await saveNyxProfileWithUsername(firebase, token, profile, createdAt, previousProfile);
    invalidateOwnerDashboardSnapshot();
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email,
      action: previousUsername && previousUsername !== nyxProfileUsername(profile.handle, "") ? "username_changed" : "profile_updated",
      targetUid: token.uid,
      targetEmail: token.email,
      details: previousUsername && previousUsername !== nyxProfileUsername(profile.handle, "") ? { previousUsername, username: nyxProfileUsername(profile.handle, "") } : {}
    });
    res.json({ uid: token.uid, profile, createdAt });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Nyx Profile could not be saved." });
  }
});

function nyxProfileMediaDocumentId(uid, kind, uploadId) {
  return `${uid}--${kind}--${uploadId}`;
}

function nyxProfileMediaRouteValues(req) {
  const uid = String(req.params.uid || "").trim();
  const kind = String(req.params.kind || "").trim().toLowerCase();
  const uploadId = String(req.params.uploadId || "").trim();
  return {
    uid,
    kind,
    uploadId,
    validUid: /^[A-Za-z0-9_-]{8,128}$/.test(uid),
    validKind: kind === "avatar" || kind === "banner",
    validUploadId: /^[A-Za-z0-9_-]{12,80}$/.test(uploadId)
  };
}

async function nyxProfileMediaRecord(firebase, values) {
  if (!values.validUid || !values.validKind || !values.validUploadId) return null;
  const mediaId = nyxProfileMediaDocumentId(values.uid, values.kind, values.uploadId);
  const mediaRef = firebase.firestore.collection("nyxProfileMedia").doc(mediaId);
  const mediaSnapshot = await mediaRef.get();
  const media = mediaSnapshot.data() || {};
  const totalChunks = Number(media.totalChunks || 0);
  if (
    !mediaSnapshot.exists ||
    media.ownerUid !== values.uid ||
    media.kind !== values.kind ||
    media.complete !== true ||
    !/^image\/(?:gif|png|jpeg|webp)$/.test(String(media.mime || "")) ||
    totalChunks < 1 ||
    totalChunks > profileMediaChunkCountLimit
  ) {
    return null;
  }
  return { mediaRef, media, totalChunks };
}

app.put("/api/profile-media/:kind/:uploadId/:index", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const kind = String(req.params.kind || "").trim().toLowerCase();
    const uploadId = String(req.params.uploadId || "").trim();
    const index = Number.parseInt(String(req.params.index || ""), 10);
    const totalChunks = Number.parseInt(String(req.body?.totalChunks || ""), 10);
    const mime = String(req.body?.mime || "").trim().toLowerCase();
    const chunk = String(req.body?.chunk || "").trim();
    if (
      !["avatar", "banner"].includes(kind) ||
      !/^[A-Za-z0-9_-]{12,80}$/.test(uploadId) ||
      !Number.isInteger(index) ||
      index < 0 ||
      !Number.isInteger(totalChunks) ||
      totalChunks < 1 ||
      totalChunks > profileMediaChunkCountLimit ||
      index >= totalChunks ||
      !/^image\/(?:gif|png|jpeg|webp)$/.test(mime) ||
      !chunk ||
      chunk.length > profileMediaChunkLimit ||
      !/^[A-Za-z0-9+/=]+$/.test(chunk)
    ) {
      res.status(400).json({ error: "That profile media chunk is invalid." });
      return;
    }
    const mediaId = nyxProfileMediaDocumentId(token.uid, kind, uploadId);
    const mediaRef = firebase.firestore.collection("nyxProfileMedia").doc(mediaId);
    const chunkRef = mediaRef.collection("chunks").doc(String(index).padStart(3, "0"));
    await Promise.all([
      mediaRef.set({
        ownerUid: token.uid,
        kind,
        mime,
        totalChunks,
        updatedAt: new Date().toISOString()
      }, { merge: true }),
      chunkRef.set({ index, chunk })
    ]);
    res.json({ received: index });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Profile media could not be uploaded." });
  }
});

app.post("/api/profile-media/:kind/:uploadId/complete", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const kind = String(req.params.kind || "").trim().toLowerCase();
    const uploadId = String(req.params.uploadId || "").trim();
    if (!["avatar", "banner"].includes(kind) || !/^[A-Za-z0-9_-]{12,80}$/.test(uploadId)) {
      res.status(400).json({ error: "That profile media upload is invalid." });
      return;
    }
    const mediaId = nyxProfileMediaDocumentId(token.uid, kind, uploadId);
    const mediaRef = firebase.firestore.collection("nyxProfileMedia").doc(mediaId);
    const mediaSnapshot = await mediaRef.get();
    const media = mediaSnapshot.data() || {};
    const totalChunks = Number(media.totalChunks || 0);
    if (
      !mediaSnapshot.exists ||
      media.ownerUid !== token.uid ||
      media.kind !== kind ||
      totalChunks < 1 ||
      totalChunks > profileMediaChunkCountLimit
    ) {
      res.status(404).json({ error: "That profile media upload was not found." });
      return;
    }
    const chunkSnapshots = await Promise.all(
      Array.from({ length: totalChunks }, (_, index) =>
        mediaRef.collection("chunks").doc(String(index).padStart(3, "0")).get()
      )
    );
    const encodedLength = chunkSnapshots.reduce((total, snapshot, index) => {
      const data = snapshot.data() || {};
      return total + (snapshot.exists && data.index === index ? String(data.chunk || "").length : profileMediaEncodedLimit + 1);
    }, 0);
    if (encodedLength < 1 || encodedLength > profileMediaEncodedLimit) {
      res.status(413).json({ error: "That profile image is too large or incomplete." });
      return;
    }
    const finalChunk = String(chunkSnapshots.at(-1)?.data()?.chunk || "");
    const padding = finalChunk.endsWith("==") ? 2 : (finalChunk.endsWith("=") ? 1 : 0);
    const byteLength = Math.floor(encodedLength * 3 / 4) - padding;
    await mediaRef.set({ complete: true, encodedLength, byteLength, completedAt: new Date().toISOString() }, { merge: true });
    res.json({ url: `/api/profile-media/${token.uid}/${kind}/${uploadId}` });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Profile media could not be completed." });
  }
});

app.put("/api/owner-dashboard/users/:uid/profile-media/:kind/:uploadId/:index", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const uid = String(req.params.uid || "").trim();
  const kind = String(req.params.kind || "").trim().toLowerCase();
  const uploadId = String(req.params.uploadId || "").trim();
  const index = Number.parseInt(String(req.params.index || ""), 10);
  const totalChunks = Number.parseInt(String(req.body?.totalChunks || ""), 10);
  const mime = String(req.body?.mime || "").trim().toLowerCase();
  const chunk = String(req.body?.chunk || "").trim();
  if (
    !/^[A-Za-z0-9_-]{8,128}$/.test(uid) ||
    !["avatar", "banner"].includes(kind) ||
    !/^[A-Za-z0-9_-]{12,80}$/.test(uploadId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    !Number.isInteger(totalChunks) ||
    totalChunks < 1 ||
    totalChunks > profileMediaChunkCountLimit ||
    index >= totalChunks ||
    !/^image\/(?:gif|png|jpeg|webp)$/.test(mime) ||
    !chunk ||
    chunk.length > profileMediaChunkLimit ||
    !/^[A-Za-z0-9+/=]+$/.test(chunk)
  ) {
    res.status(400).json({ error: "That profile media chunk is invalid." });
    return;
  }
  try {
    const { firebase, token, actor, ownerUid } = await ownerDashboardActor(req, "profiles:write");
    await firebase.auth.getUser(uid);
    const { capabilities } = await nyxOwnerTargetAccess(firebase, actor, uid, ownerUid);
    assertNyxOwnerCapability(capabilities, "canEditProfile", "Your role cannot edit this account's profile media.");
    const mediaId = nyxProfileMediaDocumentId(uid, kind, uploadId);
    const mediaRef = firebase.firestore.collection("nyxProfileMedia").doc(mediaId);
    const chunkRef = mediaRef.collection("chunks").doc(String(index).padStart(3, "0"));
    await Promise.all([
      mediaRef.set({
        ownerUid: uid,
        uploadedByUid: token.uid,
        kind,
        mime,
        totalChunks,
        updatedAt: new Date().toISOString()
      }, { merge: true }),
      chunkRef.set({ index, chunk })
    ]);
    res.json({ received: index });
  } catch (error) {
    const status = error.code === "auth/user-not-found" ? 404 : (error.status || 503);
    res.status(status).json({ error: status === 404 ? "User not found." : (error.message || "Profile media could not be uploaded.") });
  }
});

app.post("/api/owner-dashboard/users/:uid/profile-media/:kind/:uploadId/complete", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const uid = String(req.params.uid || "").trim();
  const kind = String(req.params.kind || "").trim().toLowerCase();
  const uploadId = String(req.params.uploadId || "").trim();
  if (
    !/^[A-Za-z0-9_-]{8,128}$/.test(uid) ||
    !["avatar", "banner"].includes(kind) ||
    !/^[A-Za-z0-9_-]{12,80}$/.test(uploadId)
  ) {
    res.status(400).json({ error: "That profile media upload is invalid." });
    return;
  }
  try {
    const { firebase, actor, ownerUid } = await ownerDashboardActor(req, "profiles:write");
    await firebase.auth.getUser(uid);
    const { capabilities } = await nyxOwnerTargetAccess(firebase, actor, uid, ownerUid);
    assertNyxOwnerCapability(capabilities, "canEditProfile", "Your role cannot edit this account's profile media.");
    const mediaId = nyxProfileMediaDocumentId(uid, kind, uploadId);
    const mediaRef = firebase.firestore.collection("nyxProfileMedia").doc(mediaId);
    const mediaSnapshot = await mediaRef.get();
    const media = mediaSnapshot.data() || {};
    const totalChunks = Number(media.totalChunks || 0);
    if (
      !mediaSnapshot.exists ||
      media.ownerUid !== uid ||
      media.kind !== kind ||
      totalChunks < 1 ||
      totalChunks > profileMediaChunkCountLimit
    ) {
      res.status(404).json({ error: "That profile media upload was not found." });
      return;
    }
    const chunkSnapshots = await Promise.all(
      Array.from({ length: totalChunks }, (_, chunkIndex) =>
        mediaRef.collection("chunks").doc(String(chunkIndex).padStart(3, "0")).get()
      )
    );
    const encodedLength = chunkSnapshots.reduce((total, snapshot, chunkIndex) => {
      const data = snapshot.data() || {};
      return total + (snapshot.exists && data.index === chunkIndex ? String(data.chunk || "").length : profileMediaEncodedLimit + 1);
    }, 0);
    if (encodedLength < 1 || encodedLength > profileMediaEncodedLimit) {
      res.status(413).json({ error: "That profile image is too large or incomplete." });
      return;
    }
    const finalChunk = String(chunkSnapshots.at(-1)?.data()?.chunk || "");
    const padding = finalChunk.endsWith("==") ? 2 : (finalChunk.endsWith("=") ? 1 : 0);
    const byteLength = Math.floor(encodedLength * 3 / 4) - padding;
    await mediaRef.set({ complete: true, encodedLength, byteLength, completedAt: new Date().toISOString() }, { merge: true });
    res.json({ url: `/api/profile-media/${uid}/${kind}/${uploadId}` });
  } catch (error) {
    const status = error.code === "auth/user-not-found" ? 404 : (error.status || 503);
    res.status(status).json({ error: status === 404 ? "User not found." : (error.message || "Profile media could not be completed.") });
  }
});

app.get("/api/profile-media/:uid/:kind/:uploadId/manifest", async (req, res) => {
  const values = nyxProfileMediaRouteValues(req);
  if (!firebaseAdminModeConfigured()) {
    res.status(404).end();
    return;
  }
  try {
    const firebase = await linkGeneratorFirebase();
    const record = await nyxProfileMediaRecord(firebase, values);
    if (!record) {
      res.status(404).end();
      return;
    }
    res.set({
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff"
    }).json({
      mime: record.media.mime,
      totalChunks: record.totalChunks,
      byteLength: Number(record.media.byteLength || 0)
    });
  } catch {
    res.status(404).end();
  }
});

app.get("/api/profile-media/:uid/:kind/:uploadId/chunks/:index", async (req, res) => {
  const values = nyxProfileMediaRouteValues(req);
  const index = Number.parseInt(String(req.params.index || ""), 10);
  if (!firebaseAdminModeConfigured() || !Number.isInteger(index) || index < 0 || index >= profileMediaChunkCountLimit) {
    res.status(404).end();
    return;
  }
  try {
    const firebase = await linkGeneratorFirebase();
    const record = await nyxProfileMediaRecord(firebase, values);
    if (!record || index >= record.totalChunks) {
      res.status(404).end();
      return;
    }
    const snapshot = await record.mediaRef.collection("chunks").doc(String(index).padStart(3, "0")).get();
    const data = snapshot.data() || {};
    const chunk = String(data.chunk || "");
    if (!snapshot.exists || data.index !== index || !chunk || chunk.length > profileMediaChunkLimit || !/^[A-Za-z0-9+/=]+$/.test(chunk)) {
      res.status(404).end();
      return;
    }
    res.set({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }).send(chunk);
  } catch {
    res.status(404).end();
  }
});

app.get("/api/profile-media/:uid/:kind/:uploadId", async (req, res) => {
  const values = nyxProfileMediaRouteValues(req);
  if (!firebaseAdminModeConfigured()) {
    res.status(404).end();
    return;
  }
  try {
    const firebase = await linkGeneratorFirebase();
    const record = await nyxProfileMediaRecord(firebase, values);
    if (!record) {
      res.status(404).end();
      return;
    }
    const chunkSnapshots = await Promise.all(
      Array.from({ length: record.totalChunks }, (_, index) =>
        record.mediaRef.collection("chunks").doc(String(index).padStart(3, "0")).get()
      )
    );
    const encoded = chunkSnapshots.map((snapshot, index) => {
      const data = snapshot.data() || {};
      if (!snapshot.exists || data.index !== index) throw new Error("Profile media is incomplete.");
      return String(data.chunk || "");
    }).join("");
    if (!encoded || encoded.length > profileMediaEncodedLimit || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
      res.status(404).end();
      return;
    }
    res.set({
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": record.media.mime,
      "Content-Length": String(Buffer.byteLength(encoded, "base64")),
      "X-Content-Type-Options": "nosniff"
    });
    res.end(Buffer.from(encoded, "base64"));
  } catch {
    res.status(404).end();
  }
});

app.get("/api/profiles", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const search = String(req.query.search || "").trim().toLowerCase().slice(0, 80);
    const snapshot = await firebase.firestore.collection("nyxUserProfiles").limit(250).get();
    const uids = snapshot.docs.map(document => document.id);
    const [administration, activity, customRoles] = await Promise.all([
      firestoreDocumentsById(firebase.firestore, "nyxUserAdministration", uids),
      firestoreDocumentsById(firebase.firestore, "nyxUserActivity", uids),
      nyxCustomRoles(firebase)
    ]);
    const ownerUid = founderProfileConfig().administratorUid;
    const now = Date.now();
    const profiles = snapshot.docs.map(document => {
      const data = document.data() || {};
      const profile = normalizeNyxUserProfile(data.profile, { uid: document.id });
      const activityData = activity.get(document.id) || {};
      const lastActiveAtMs = safeActivityTime(activityData.lastActiveAtMs || activityData.lastActiveAt);
      const memberAdministration = administration.get(document.id) || {};
      const actualRole = nyxRoleForUser(document.id, memberAdministration, ownerUid);
      const presentation = nyxRolePresentation(actualRole, nyxAssignedCustomRole(memberAdministration, customRoles), document.id, token.uid, ownerUid);
      return {
        uid: document.id,
        profile,
        role: presentation.role,
        customRole: presentation.customRole,
        roleLabel: presentation.roleLabel,
        online: Boolean(lastActiveAtMs && now - lastActiveAtMs <= signedInOnlineWindowMs),
        createdAt: safeDateIso(data.createdAt),
        self: document.id === token.uid
      };
    }).filter(entry => {
      if (!search) return true;
      return [entry.profile.displayName, entry.profile.handle, entry.role].some(value => String(value || "").toLowerCase().includes(search));
    }).sort((left, right) => {
      if (left.self !== right.self) return left.self ? -1 : 1;
      if (left.online !== right.online) return left.online ? -1 : 1;
      return String(left.profile.displayName || "").localeCompare(String(right.profile.displayName || ""), undefined, { sensitivity: "base", numeric: true });
    }).slice(0, 40);
    res.json({ profiles, total: profiles.length });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Profiles are unavailable." });
  }
});

app.get("/api/profiles/:uid", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const uid = String(req.params.uid || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid) || !firebaseAdminModeConfigured()) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  try {
    const { firebase, token } = await optionalAuthenticatedNyxUser(req);
    const [snapshot, administrationSnapshot, activitySnapshot, customRoles] = await Promise.all([
      firebase.firestore.collection("nyxUserProfiles").doc(uid).get(),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get(),
      firebase.firestore.collection("nyxUserActivity").doc(uid).get(),
      nyxCustomRoles(firebase)
    ]);
    if (!snapshot.exists) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const data = snapshot.data() || {};
    const activity = activitySnapshot.data() || {};
    const lastActiveAtMs = safeActivityTime(activity.lastActiveAtMs || activity.lastActiveAt);
    const ownerUid = founderProfileConfig().administratorUid;
    const administration = administrationSnapshot.data() || {};
    const presentation = nyxRolePresentation(nyxRoleForUser(uid, administration, ownerUid), nyxAssignedCustomRole(administration, customRoles), uid, token?.uid, ownerUid);
    res.json({
      uid,
      profile: normalizeNyxUserProfile(data.profile),
      role: presentation.role,
      customRole: presentation.customRole,
      roleLabel: presentation.roleLabel,
      online: Boolean(lastActiveAtMs && Date.now() - lastActiveAtMs <= signedInOnlineWindowMs),
      createdAt: String(data.createdAt || "")
    });
  } catch {
    res.status(503).json({ error: "Profile is unavailable." });
  }
});

app.post(["/api/moderation/search-history", "/api/moderation/flagged-searches"], async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const entry = nyxSearchHistoryEntry(req.body?.query);
    if (!entry.query) {
      res.json({ stored: false });
      return;
    }
    consumeNyxSearchHistoryAttempt(token.uid);
    const identity = await nyxChatIdentity(firebase, token);
    const now = Date.now();
    await firebase.firestore.collection(nyxSearchHistoryCollection).add({
      uid: token.uid,
      displayName: identity.displayName,
      handle: identity.handle,
      role: identity.role,
      query: entry.query,
      category: entry.category,
      flagged: entry.flagged,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      expiresAtMs: now + nyxSearchHistoryRetentionMs
    });
    void cleanupNyxSearchHistory(firebase, now);
    res.json({ stored: true });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Search history is unavailable." });
  }
});

app.get(["/api/chat/moderation/search-history", "/api/chat/moderation/flagged-searches"], async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req, false);
    const identity = await nyxChatIdentity(firebase, token);
    if (!identity.canModerate) {
      res.status(403).json({ error: "Moderator access is required." });
      return;
    }
    const requestedUid = String(req.query?.uid || "").trim();
    if (requestedUid.length > 128 || /[\u0000-\u001f\u007f]/.test(requestedUid)) {
      res.status(400).json({ error: "That account identifier is invalid." });
      return;
    }
    const now = Date.now();
    const collection = firebase.firestore.collection(nyxSearchHistoryCollection);
    const snapshot = await (requestedUid
      ? collection.where("uid", "==", requestedUid).limit(1000)
      : collection.orderBy("createdAtMs", "desc").limit(250))
      .get();
    const ownerUid = founderProfileConfig().administratorUid;
    const searchUids = [...new Set(snapshot.docs.map(document => String(document.data()?.uid || "")).filter(uid => /^[A-Za-z0-9_-]{8,128}$/.test(uid)))];
    const [searchAdministration, customRoles] = await Promise.all([
      firestoreDocumentsById(firebase.firestore, "nyxUserAdministration", searchUids),
      nyxCustomRoles(firebase)
    ]);
    const searches = snapshot.docs.flatMap(document => {
      const data = document.data() || {};
      if (Number(data.expiresAtMs || 0) <= now) return [];
      const storedRole = String(data.role || "").trim().toLowerCase();
      const storedUid = String(data.uid || "");
      const administration = searchAdministration.get(storedUid) || { role: storedRole };
      const actualRole = nyxRoleForUser(storedUid, administration, ownerUid);
      if (identity.role !== "owner" && actualRole === "owner") return [];
      const presentation = nyxRolePresentation(actualRole, nyxAssignedCustomRole(administration, customRoles), storedUid, identity.uid, ownerUid);
      return [{
        id: document.id,
        uid: storedUid,
        displayName: founderProfileText(data.displayName, "Nyx member", 48),
        handle: founderProfileText(data.handle, "@member", 40),
        role: presentation.role,
        query: founderProfileText(data.query, "", 180),
        category: founderProfileText(data.category, "Standard search", 48),
        flagged: Boolean(data.flagged),
        createdAt: safeDateIso(data.createdAt),
        createdAtMs: safeActivityTime(data.createdAtMs)
      }];
    }).filter(item => item.uid && item.query)
      .sort((left, right) => right.createdAtMs - left.createdAtMs);
    const clearCapability = requestedUid
      ? await nyxSearchHistoryClearCapability(firebase, identity, requestedUid)
      : null;
    void cleanupNyxSearchHistory(firebase, now);
    res.json({ searches, canClear: Boolean(clearCapability?.allowed), targetUid: requestedUid });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Search history is unavailable." });
  }
});

app.delete(["/api/chat/moderation/search-history", "/api/chat/moderation/flagged-searches"], async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req, false);
    const identity = await nyxChatIdentity(firebase, token);
    if (!identity.canModerate) {
      res.status(403).json({ error: "Moderator access is required." });
      return;
    }
    const targetUid = String(req.query?.uid || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(targetUid)) {
      res.status(400).json({ error: "Choose a valid Nyx account." });
      return;
    }
    const capability = await nyxSearchHistoryClearCapability(firebase, identity, targetUid);
    if (!capability.allowed) {
      res.status(403).json({ error: "You cannot clear search history for this account." });
      return;
    }
    const collection = firebase.firestore.collection(nyxSearchHistoryCollection);
    let deletedCount = 0;
    while (true) {
      const snapshot = await collection.where("uid", "==", targetUid).limit(400).get();
      if (snapshot.empty) break;
      const batch = firebase.firestore.batch();
      snapshot.docs.forEach(document => batch.delete(document.ref));
      await batch.commit();
      deletedCount += snapshot.size;
      if (snapshot.size < 400) break;
    }
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email || "",
      action: "search_history_cleared",
      targetUid,
      details: { deletedCount, targetRole: capability.targetRole }
    });
    res.json({ cleared: true, deletedCount });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Search history could not be cleared." });
  }
});

app.post("/api/chat/moderation/mutes", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const action = String(req.body?.action || "mute").trim().toLowerCase();
    const targetUid = String(req.body?.targetUid || "").trim();
    if (!new Set(["mute", "unmute"]).has(action)) {
      res.status(400).json({ error: "Choose mute or unmute." });
      return;
    }
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(targetUid) || targetUid === token.uid) {
      res.status(400).json({ error: "Choose another Nyx member." });
      return;
    }
    let targetUser;
    try {
      targetUser = await firebase.auth.getUser(targetUid);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        res.status(404).json({ error: "That Nyx member was not found." });
        return;
      }
      throw error;
    }
    const [actorAdministrationSnapshot, targetAdministrationSnapshot, actorIdentity, targetIdentity] = await Promise.all([
      firebase.firestore.collection("nyxUserAdministration").doc(token.uid).get(),
      firebase.firestore.collection("nyxUserAdministration").doc(targetUid).get(),
      nyxChatIdentity(firebase, token),
      nyxChatIdentity(firebase, { uid: targetUid, email: targetUser.email || "", name: targetUser.displayName || "" })
    ]);
    const actorRole = nyxRoleForUser(token.uid, actorAdministrationSnapshot.data() || {});
    const targetRole = nyxRoleForUser(targetUid, targetAdministrationSnapshot.data() || {});
    if (!nyxChatCanModerate(actorRole)) {
      res.status(403).json({ error: "Moderator access is required." });
      return;
    }
    const founderOwnerOverride = actorRole === "owner" && token.uid === founderProfileConfig().administratorUid;
    if (!founderOwnerOverride && nyxRolePolicy(targetRole).rank >= nyxRolePolicy(actorRole).rank) {
      res.status(403).json({ error: "You can only mute members ranked below your role." });
      return;
    }
    const ref = firebase.firestore.collection(nyxChatMuteCollection).doc(targetUid);
    const now = Date.now();
    if (action === "unmute") {
      await ref.delete();
      nyxChatMuteCache.set(targetUid, { value: null, cacheExpiresAtMs: now + nyxChatMuteCacheTtlMs });
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: token.email || "",
        action: "chat_user_unmuted",
        targetUid,
        details: { targetRole }
      });
      res.json({ ok: true, targetUid, muted: false });
      return;
    }
    const duration = String(req.body?.duration || "").trim();
    const durationMs = nyxChatMuteDuration(duration);
    const reason = founderProfileText(req.body?.reason, "", 180);
    if (!durationMs) {
      res.status(400).json({ error: "Enter a mute time from 1 minute through 4 weeks, such as 10m, 2h, 1d, or 1w." });
      return;
    }
    if (!reason) {
      res.status(400).json({ error: "A reason is required to mute a member." });
      return;
    }
    const expiresAtMs = now + durationMs;
    const value = {
      targetUid,
      targetDisplayName: targetIdentity.displayName,
      targetHandle: targetIdentity.handle,
      targetRole,
      reason,
      moderatorUid: token.uid,
      moderatorDisplayName: actorIdentity.displayName,
      moderatorRole: actorRole,
      createdAt: new Date(now).toISOString(),
      createdAtMs: now,
      expiresAt: new Date(expiresAtMs).toISOString(),
      expiresAtMs
    };
    await ref.set(value);
    const mute = nyxChatMutePayload(value, now);
    nyxChatMuteCache.set(targetUid, { value: mute, cacheExpiresAtMs: Math.min(expiresAtMs, now + nyxChatMuteCacheTtlMs) });
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email || "",
      action: "chat_user_muted",
      targetUid,
      details: { duration, durationMs, expiresAtMs, reason, targetRole }
    });
    res.status(201).json({ ok: true, targetUid, muted: true, mute });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The chat mute could not be updated." });
  }
});

app.get("/api/chat/bootstrap", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const configuration = await loadNyxChatConfiguration(firebase);
    const [me, directory, latestActivity, conversationSnapshot, caffeine, customRoles] = await Promise.all([
      nyxChatIdentity(firebase, token),
      nyxChatMemberDirectory(firebase),
      nyxChatChannelActivity(firebase, configuration.textChannels),
      firebase.firestore.collection("nyxChatConversations").where("participants", "array-contains", token.uid).limit(100).get(),
      nyxCaffeineState(firebase, token.uid),
      nyxCustomRoles(firebase)
    ]);
    const now = Date.now();
    const members = directory.map(member => ({
      ...nyxChatMemberForViewer(member, token.uid),
      online: now - Math.max(Number(member.lastActiveAtMs || 0), Number(signedInPresence.get(member.uid) || 0)) <= signedInOnlineWindowMs,
      self: member.uid === token.uid,
      lastActiveAtMs: undefined
    }));
    if (!members.some(member => member.uid === token.uid)) members.push({ ...me, online: true, self: true });
    members.sort((left, right) => {
      if (left.self !== right.self) return left.self ? -1 : 1;
      if (left.online !== right.online) return left.online ? -1 : 1;
      const roleRank = nyxRolePolicy(right.role).rank - nyxRolePolicy(left.role).rank;
      return roleRank || String(left.displayName || "").localeCompare(String(right.displayName || ""), undefined, { sensitivity: "base", numeric: true });
    });
    const membersByUid = new Map(members.map(member => [member.uid, member]));
    const visibleTextChannels = configuration.textChannels.filter(channel => nyxChatCanAccessChannel(me.role, channel));
    const visibleVoiceChannels = configuration.voiceChannels.filter(channel => nyxChatCanAccessChannel(me.role, channel));
    const visibleTextChannelIds = new Set(visibleTextChannels.map(channel => channel.id));
    const conversations = conversationSnapshot.docs
      .map(document => nyxChatConversationPayload(document, token.uid, membersByUid))
      .filter(Boolean)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
    res.json({
      channels: visibleTextChannels,
      latestActivity: Object.fromEntries(latestActivity.filter(([channelId]) => visibleTextChannelIds.has(channelId))),
      conversations,
      voice: nyxChatVoiceState(token.uid, "", false, visibleVoiceChannels),
      caffeine,
      customRoles: nyxVisibleCustomRoles(customRoles, token.uid, founderProfileConfig().administratorUid, me.customRole),
      revision: nyxChatRealtimeRevision,
      me,
      members: members.slice(0, 100),
      online: members.filter(member => member.online).length
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Nyx Chat is unavailable." });
  }
});

app.get("/api/chat/updates", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req, false);
    const since = Math.max(0, Number(req.query.since || 0));
    const [identity, configuration] = await Promise.all([
      nyxChatIdentity(firebase, token),
      loadNyxChatConfiguration(firebase)
    ]);
    const visibleChannels = new Set(configuration.textChannels
      .filter(channel => nyxChatCanAccessChannel(identity.role, channel))
      .map(channel => channel.id));
    const reset = Boolean(since && since < nyxChatRealtimeDroppedBeforeRevision);
    const events = (reset ? [] : nyxChatRealtimeEvents.filter(event => event.revision > since)).flatMap(event => {
      if (event.scopeType === "channel" && !visibleChannels.has(event.scopeId)) return [];
      if (event.scopeType === "conversation" && !event.participants.includes(token.uid)) return [];
      if (event.kind === "caffeine" && event.participants.length && !event.participants.includes(token.uid)) return [];
      return [{
        revision: event.revision,
        kind: event.kind,
        scopeType: event.scopeType,
        scopeId: event.scopeId,
        createdAtMs: event.createdAtMs,
        mentionsViewer: event.kind === "message" && nyxChatEventMentionsIdentity(event.lastMessageText, identity),
        lastMessageAuthorUid: event.lastMessageAuthorUid
      }];
    });
    res.json({ revision: nyxChatRealtimeRevision, reset, events });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Chat updates are unavailable." });
  }
});

app.get("/api/chat/caffeine", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    res.json({ caffeine: await nyxCaffeineState(firebase, token.uid) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Caffeine is unavailable." });
  }
});

app.post("/api/chat/caffeine/gifts", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const recipientUid = String(req.body?.recipientUid || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(recipientUid) || recipientUid === token.uid) {
      res.status(400).json({ error: "Choose another Nyx member for this Caffeine gift." });
      return;
    }
    try {
      await firebase.auth.getUser(recipientUid);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        res.status(404).json({ error: "That Nyx member was not found." });
        return;
      }
      throw error;
    }
    const [giver, recipient] = await Promise.all([
      nyxChatIdentity(firebase, token),
      nyxChatIdentity(firebase, { uid: recipientUid })
    ]);
    const giverAdministrationRef = firebase.firestore.collection("nyxUserAdministration").doc(token.uid);
    const recipientAdministrationRef = firebase.firestore.collection("nyxUserAdministration").doc(recipientUid);
    let giftId = "";
    const now = Date.now();
    const expiresAtMs = now + nyxCaffeineGiftPendingMs;
    const unlimitedGiftId = randomBytes(20).toString("hex");
    await firebase.firestore.runTransaction(async transaction => {
      const [giverAdministrationSnapshot, recipientAdministrationSnapshot] = await Promise.all([
        transaction.get(giverAdministrationRef),
        transaction.get(recipientAdministrationRef)
      ]);
      const giverAdministration = giverAdministrationSnapshot.data() || {};
      const recipientAdministration = recipientAdministrationSnapshot.data() || {};
      const giverSubscription = nyxCaffeineEntitlement(token.uid, giverAdministration);
      if (!giverSubscription.directlyAssigned) {
        const error = new Error(giverSubscription.active
          ? "Caffeine received as a gift cannot be gifted again."
          : "An active Caffeine subscription is required to send a gift.");
        error.status = 403;
        throw error;
      }
      if (nyxCaffeineEntitlement(recipientUid, recipientAdministration).active) {
        const error = new Error("That member already has Caffeine.");
        error.status = 409;
        throw error;
      }
      const pendingForRecipient = nyxCaffeinePendingGift(recipientAdministration.pendingCaffeineGift, now);
      if (pendingForRecipient) {
        const error = new Error("That member already has a Caffeine gift waiting for them.");
        error.status = 409;
        throw error;
      }
      giftId = giverSubscription.unlimited ? unlimitedGiftId : nyxCaffeineGrantKey(token.uid, giverAdministration);
      const giftRef = firebase.firestore.collection(nyxCaffeineGiftCollection).doc(giftId);
      const giftSnapshot = await transaction.get(giftRef);
      const existingGift = giftSnapshot.data() || {};
      const existingStatus = String(existingGift.status || "").trim().toLowerCase();
      if (giverSubscription.unlimited && giftSnapshot.exists) {
        const error = new Error("A new Caffeine gift could not be created. Try again.");
        error.status = 409;
        throw error;
      }
      if (existingStatus === "accepted") {
        const error = new Error("You already shared the Caffeine gift from this subscription.");
        error.status = 409;
        throw error;
      }
      if (existingStatus === "pending" && Number(existingGift.expiresAtMs || 0) > now) {
        const error = new Error("Your Caffeine gift is already waiting for someone to accept it.");
        error.status = 409;
        throw error;
      }
      const pendingGift = {
        id: giftId,
        giverUid: token.uid,
        giverDisplayName: giver.displayName,
        giverHandle: giver.handle,
        createdAtMs: now,
        expiresAtMs
      };
      transaction.set(giftRef, {
        giverUid: token.uid,
        giverDisplayName: giver.displayName,
        giverHandle: giver.handle,
        recipientUid,
        recipientDisplayName: recipient.displayName,
        recipientHandle: recipient.handle,
        grantType: giverSubscription.unlimited ? "role_unlimited" : "subscription",
        status: "pending",
        createdAt: new Date(now).toISOString(),
        createdAtMs: now,
        expiresAt: new Date(expiresAtMs).toISOString(),
        expiresAtMs,
        acceptedAt: "",
        acceptedAtMs: 0
      });
      transaction.set(recipientAdministrationRef, { pendingCaffeineGift: pendingGift, updatedAt: new Date(now).toISOString() }, { merge: true });
    });
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email || "",
      action: "caffeine_gift_sent",
      targetUid: recipientUid,
      details: { giftId }
    });
    const revision = recordNyxChatRealtimeEvent({ kind: "caffeine", participants: [token.uid, recipientUid] });
    emitNyxChatSocketEvent({ kind: "caffeine", participants: [token.uid, recipientUid], revision });
    res.status(201).json({ ok: true, caffeine: await nyxCaffeineState(firebase, token.uid) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The Caffeine gift could not be sent." });
  }
});

app.post("/api/chat/caffeine/gifts/:giftId/accept", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const giftId = String(req.params.giftId || "").trim().toLowerCase();
  if (!nyxCaffeineGiftIdPattern.test(giftId)) {
    res.status(400).json({ error: "That Caffeine gift is invalid." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const giftRef = firebase.firestore.collection(nyxCaffeineGiftCollection).doc(giftId);
    const recipientAdministrationRef = firebase.firestore.collection("nyxUserAdministration").doc(token.uid);
    let giverUid = "";
    const now = Date.now();
    await firebase.firestore.runTransaction(async transaction => {
      const [giftSnapshot, recipientAdministrationSnapshot] = await Promise.all([
        transaction.get(giftRef),
        transaction.get(recipientAdministrationRef)
      ]);
      const gift = giftSnapshot.data() || {};
      giverUid = String(gift.giverUid || "").trim();
      if (!giftSnapshot.exists || gift.recipientUid !== token.uid || String(gift.status || "") !== "pending") {
        const error = new Error("That Caffeine gift is no longer available.");
        error.status = 404;
        throw error;
      }
      if (Number(gift.expiresAtMs || 0) <= now) {
        const error = new Error("That Caffeine gift expired. Ask the sender to share it again.");
        error.status = 410;
        throw error;
      }
      const recipientAdministration = recipientAdministrationSnapshot.data() || {};
      if (nyxCaffeineEntitlement(token.uid, recipientAdministration).active) {
        const error = new Error("Your account already has Caffeine.");
        error.status = 409;
        throw error;
      }
      const pendingGift = nyxCaffeinePendingGift(recipientAdministration.pendingCaffeineGift, now);
      if (!pendingGift || pendingGift.id !== giftId) {
        const error = new Error("That Caffeine gift is no longer assigned to your account.");
        error.status = 409;
        throw error;
      }
      const giverAdministrationRef = firebase.firestore.collection("nyxUserAdministration").doc(giverUid);
      const giverAdministrationSnapshot = await transaction.get(giverAdministrationRef);
      const giverAdministration = giverAdministrationSnapshot.data() || {};
      const giverSubscription = nyxCaffeineEntitlement(giverUid, giverAdministration);
      const unlimitedGift = String(gift.grantType || "").trim().toLowerCase() === "role_unlimited";
      const validGiver = unlimitedGift
        ? giverSubscription.unlimited
        : giverSubscription.directlyAssigned && nyxCaffeineGrantKey(giverUid, giverAdministration) === giftId;
      if (!validGiver) {
        const error = new Error("The sender's Caffeine subscription is no longer active.");
        error.status = 409;
        throw error;
      }
      const timestamp = new Date(now).toISOString();
      transaction.set(recipientAdministrationRef, {
        subscriptionStatus: "premium",
        monthlyRevenueCents: 0,
        subscriptionSource: "caffeine_gift",
        caffeineReceivedGiftId: giftId,
        caffeineGrantId: "",
        pendingCaffeineGift: null,
        subscriptionUpdatedAt: timestamp,
        updatedAt: timestamp
      }, { merge: true });
      transaction.set(giftRef, { status: "accepted", acceptedAt: timestamp, acceptedAtMs: now, expiresAt: "", expiresAtMs: 0 }, { merge: true });
    });
    linkCheckerBulkAccessCache.delete(token.uid);
    ownerDashboardSnapshotCache = { expiresAt: 0, value: null, promise: null };
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email || "",
      action: "caffeine_gift_accepted",
      targetUid: token.uid,
      details: { giftId, giverUid }
    });
    const revision = recordNyxChatRealtimeEvent({ kind: "caffeine", participants: [token.uid, giverUid] });
    emitNyxChatSocketEvent({ kind: "caffeine", participants: [token.uid, giverUid], revision });
    res.json({ ok: true, subscriptionStatus: "premium", premiumAccess: true, caffeine: await nyxCaffeineState(firebase, token.uid) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The Caffeine gift could not be accepted." });
  }
});

app.post("/api/chat/channels", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const identity = await nyxChatIdentity(firebase, token);
    if (!identity.canManageChannels) {
      res.status(403).json({ error: "Only Owner, Co-owner, Admin, and Manager roles can manage chat channels." });
      return;
    }
    const action = String(req.body?.action || "").trim().toLowerCase();
    const kind = String(req.body?.kind || "").trim().toLowerCase();
    if (!new Set(["create", "update", "delete"]).has(action) || !new Set(["text", "voice"]).has(kind)) {
      res.status(400).json({ error: "Choose a valid channel action." });
      return;
    }
    const configuration = await loadNyxChatConfiguration(firebase, true);
    const textChannels = configuration.textChannels.map(channel => ({ ...channel }));
    const voiceChannels = configuration.voiceChannels.map(channel => ({ ...channel }));
    const channels = kind === "voice" ? voiceChannels : textChannels;
    const id = String(req.body?.id || "").trim().toLowerCase();
    const name = String(req.body?.name || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 32);
    const description = String(req.body?.description || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 140);
    const requestedMinimumRole = String(req.body?.minimumRole || "member").trim().toLowerCase();
    const minimumRole = nyxRolePolicies[requestedMinimumRole] ? requestedMinimumRole : "member";
    if (nyxRolePolicy(minimumRole).rank > nyxRolePolicy(identity.role).rank) {
      res.status(403).json({ error: "You cannot create a channel restricted above your own role." });
      return;
    }
    let changedId = id;
    if (action === "create") {
      if (!name) {
        res.status(400).json({ error: "Enter a channel name." });
        return;
      }
      const maximum = kind === "voice" ? 12 : 24;
      if (channels.length >= maximum) {
        res.status(409).json({ error: `Nyx supports up to ${maximum} ${kind} channels.` });
        return;
      }
      const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "channel";
      const used = new Set([...textChannels, ...voiceChannels].map(channel => channel.id));
      do changedId = `${base}-${randomBytes(3).toString("hex")}`.slice(0, 48); while (used.has(changedId));
      channels.push({ id: changedId, name, description: description || (kind === "voice" ? "Nyx community voice channel." : "Nyx community channel."), minimumRole });
    } else {
      const index = channels.findIndex(channel => channel.id === id);
      if (index < 0) {
        res.status(404).json({ error: "That chat channel was not found." });
        return;
      }
      if (!nyxChatCanAccessChannel(identity.role, channels[index])) {
        res.status(403).json({ error: "Your role cannot manage that restricted channel." });
        return;
      }
      if (action === "delete") {
        if (channels.length <= 1) {
          res.status(409).json({ error: `Nyx must keep at least one ${kind} channel.` });
          return;
        }
        channels.splice(index, 1);
      } else {
        if (!name) {
          res.status(400).json({ error: "Enter a channel name." });
          return;
        }
        channels[index] = { ...channels[index], name, description: description || channels[index].description, minimumRole };
      }
    }
    const next = { textChannels, voiceChannels };
    const now = Date.now();
    await firebase.firestore.collection(nyxChatConfigurationCollection).doc(nyxChatConfigurationDocument).set({
      ...next,
      updatedAt: new Date(now).toISOString(),
      updatedAtMs: now,
      updatedBy: token.uid
    }, { merge: true });
    nyxChatConfigurationCache = { expiresAt: now + nyxChatConfigurationTtlMs, value: next, promise: null };
    nyxChatChannelActivityCache = { ...nyxChatChannelActivityCache, expiresAt: 0, promise: null };
    const validVoiceIds = new Set(voiceChannels.map(channel => channel.id));
    for (const [uid, session] of nyxChatVoiceSessions) {
      if (!validVoiceIds.has(session.channelId)) {
        nyxChatVoiceSessions.delete(uid);
        nyxChatVoiceSignals.delete(uid);
      }
    }
    emitNyxChatVoiceRefresh();
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email || "",
      action: `chat_channel_${action}`,
      details: { kind, channelId: changedId, name: action === "delete" ? "" : name, minimumRole }
    });
    await refreshNyxChatSocketAuthorizations();
    const revision = recordNyxChatRealtimeEvent({ kind: "configuration" });
    emitNyxChatSocketEvent({ kind: "configuration", revision });
    res.json({
      ok: true,
      textChannels: textChannels.filter(channel => nyxChatCanAccessChannel(identity.role, channel)),
      voiceChannels: voiceChannels.filter(channel => nyxChatCanAccessChannel(identity.role, channel))
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Chat channels could not be updated." });
  }
});

app.get("/api/chat/voice/state", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req, false);
    const configuration = await loadNyxChatConfiguration(firebase);
    const identity = await nyxChatIdentity(firebase, token);
    const visibleVoiceChannels = configuration.voiceChannels.filter(channel => nyxChatCanAccessChannel(identity.role, channel));
    const sessionId = String(req.query.sessionId || "").trim();
    if (sessionId && !nyxChatVoiceSessionIdPattern.test(sessionId)) {
      res.status(400).json({ error: "That voice session is invalid." });
      return;
    }
    res.json(nyxChatVoiceState(token.uid, sessionId, Boolean(sessionId), visibleVoiceChannels));
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Voice channels are unavailable." });
  }
});

app.post("/api/chat/voice/join", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const configuration = await loadNyxChatConfiguration(firebase);
    const identity = await nyxChatIdentity(firebase, token);
    const visibleVoiceChannels = configuration.voiceChannels.filter(channel => nyxChatCanAccessChannel(identity.role, channel));
    const channelId = nyxChatVoiceChannel(req.body?.channelId);
    const sessionId = String(req.body?.sessionId || "").trim();
    if (!channelId || !visibleVoiceChannels.some(channel => channel.id === channelId) || !nyxChatVoiceSessionIdPattern.test(sessionId)) {
      res.status(400).json({ error: "Choose a valid Nyx voice channel." });
      return;
    }
    consumeNyxChatVoiceAttempt(nyxChatVoiceJoinAttempts, token.uid, 60_000, 10, "You are switching voice channels too quickly. Wait a moment and try again.");
    cleanupNyxChatVoice();
    const occupancy = [...nyxChatVoiceSessions.values()].filter(session => session.channelId === channelId && session.uid !== token.uid).length;
    if (occupancy >= nyxChatVoiceRoomLimit) {
      res.status(409).json({ error: `That voice channel is full (${nyxChatVoiceRoomLimit} people maximum).` });
      return;
    }
    const now = Date.now();
    nyxChatVoiceSignals.delete(token.uid);
    nyxChatVoiceSessions.set(token.uid, { uid: token.uid, sessionId, channelId, identity, joinedAtMs: now, lastSeenAtMs: now });
    emitNyxChatVoiceRefresh();
    res.status(201).json(nyxChatVoiceState(token.uid, sessionId, true, visibleVoiceChannels));
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The voice channel could not be joined." });
  }
});

app.post("/api/chat/voice/leave", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { token } = await authenticatedNyxChatUser(req);
    const sessionId = String(req.body?.sessionId || "").trim();
    const session = nyxChatVoiceSessions.get(token.uid);
    if (session && session.sessionId === sessionId) {
      nyxChatVoiceSessions.delete(token.uid);
      nyxChatVoiceSignals.delete(token.uid);
      emitNyxChatVoiceRefresh();
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The voice channel could not be left." });
  }
});

app.post("/api/chat/voice/signal", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { token } = await authenticatedNyxChatUser(req);
    relayNyxChatVoiceSignal(token.uid, req.body);
    res.status(202).json({ ok: true });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The voice connection could not be relayed." });
  }
});

app.post("/api/chat/conversations", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const participantUid = String(req.body?.participantUid || "").trim();
    if (!/^[A-Za-z0-9_-]{8,128}$/.test(participantUid) || participantUid === token.uid) {
      res.status(400).json({ error: "Choose another Nyx member for this private message." });
      return;
    }
    try {
      await firebase.auth.getUser(participantUid);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        res.status(404).json({ error: "That Nyx member was not found." });
        return;
      }
      throw error;
    }
    const [me, other] = await Promise.all([
      nyxChatIdentity(firebase, token),
      nyxChatIdentity(firebase, { uid: participantUid })
    ]);
    const id = nyxChatConversationId(token.uid, participantUid);
    const ref = firebase.firestore.collection("nyxChatConversations").doc(id);
    const existing = await ref.get();
    const now = Date.now();
    await ref.set({
      participants: [token.uid, participantUid].sort(),
      participantProfiles: {
        [token.uid]: nyxChatConversationMember(me, token.uid, token.uid),
        [participantUid]: nyxChatConversationMember(other, participantUid, participantUid)
      },
      createdAt: String(existing.data()?.createdAt || new Date(now).toISOString()),
      createdAtMs: Number(existing.data()?.createdAtMs || now),
      updatedAt: String(existing.data()?.updatedAt || new Date(now).toISOString()),
      updatedAtMs: Number(existing.data()?.updatedAtMs || now)
    }, { merge: true });
    const saved = await ref.get();
    const revision = recordNyxChatRealtimeEvent({ kind: "conversation", scopeType: "conversation", scopeId: id, participants: [token.uid, participantUid] });
    emitNyxChatSocketEvent({ kind: "conversation", scopeType: "conversation", scopeId: id, participants: [token.uid, participantUid], revision });
    res.status(existing.exists ? 200 : 201).json({ conversation: nyxChatConversationPayload(saved, token.uid, new Map([[participantUid, other]])) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The private conversation could not be opened." });
  }
});

app.get("/api/chat/conversations", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const configuration = await loadNyxChatConfiguration(firebase);
    const identity = await nyxChatIdentity(firebase, token);
    const visibleTextChannels = configuration.textChannels.filter(channel => nyxChatCanAccessChannel(identity.role, channel));
    const [snapshot, channelSnapshots] = await Promise.all([
      firebase.firestore.collection("nyxChatConversations").where("participants", "array-contains", token.uid).limit(100).get(),
      Promise.all(visibleTextChannels.map(channel => firebase.firestore.collection("nyxChatChannels").doc(channel.id).get()))
    ]);
    const conversations = snapshot.docs
      .map(document => nyxChatConversationPayload(document, token.uid))
      .filter(Boolean)
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
    const channelActivity = Object.fromEntries(channelSnapshots.map((document, index) => {
      const value = document.data() || {};
      return [visibleTextChannels[index].id, {
        lastMessageAtMs: Math.max(0, Number(value.lastMessageAtMs || 0)),
        lastMessageText: founderProfileText(value.lastMessageText, "", 1_000),
        lastMessageAuthorUid: String(value.lastMessageAuthorUid || "")
      }];
    }));
    res.json({ conversations, channelActivity });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Private conversations are unavailable." });
  }
});

app.get("/api/chat/messages", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const scope = await nyxChatScope(firebase, token.uid, { channel: req.query.channel, conversation: req.query.conversation });
    const after = Math.max(0, Number(req.query.after || 0));
    const before = Math.max(0, Number(req.query.before || 0));
    let query = scope.messages;
    let descending = true;
    let limit = 50;
    if (after) {
      descending = false;
      limit = 100;
      query = query.where("createdAtMs", ">", after).orderBy("createdAtMs", "asc");
    } else if (before) {
      query = query.where("createdAtMs", "<", before).orderBy("createdAtMs", "desc");
    } else {
      query = query.orderBy("createdAtMs", "desc");
    }
    const snapshot = await query.limit(limit).get();
    const messages = snapshot.docs.map(document => nyxChatMessagePayload(document, token.uid)).filter(message => message.text || message.attachments.length);
    if (descending) messages.reverse();
    res.json({ channel: scope.type === "channel" ? scope.id : "", conversationId: scope.private ? scope.id : "", messages, hasMore: !after && snapshot.size === limit, viewerUid: token.uid });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Chat messages are unavailable." });
  }
});

app.post("/api/chat/attachments/large/start", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  res.status(413).json({ error: "Chat attachments are limited to 8 MB for every account." });
  return;
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const identity = await nyxChatIdentity(firebase, token);
    if (identity.role !== "owner") {
      res.status(403).json({ error: "Only the Nyx Owner can upload files larger than 8 MB." });
      return;
    }
    await cleanupNyxChatDiskUploads(firebase);
    const uploadId = String(req.body?.uploadId || "").trim();
    const mime = String(req.body?.mime || "").trim().toLowerCase();
    const name = nyxChatAttachmentName(req.body?.name);
    const size = Number(req.body?.size || 0);
    const totalChunks = Math.ceil(size / nyxChatOwnerAttachmentChunkLimit);
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(uploadId) || !nyxChatAttachmentMimeTypes.has(mime) || !Number.isInteger(size) || size <= nyxChatAttachmentFileLimit || size > nyxChatOwnerAttachmentFileLimit || totalChunks < 1 || totalChunks > nyxChatOwnerAttachmentChunkCountLimit) {
      res.status(400).json({ error: "Owner uploads must be a supported file larger than 8 MB and no larger than 1 GB." });
      return;
    }
    const id = createHash("sha256").update(`${token.uid}:${uploadId}`).digest("hex").slice(0, 40);
    const path = nyxChatAttachmentDiskPath(id);
    if (!path) throw new Error("The attachment storage path is unavailable.");
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const existing = await ref.get();
    const data = existing.data() || {};
    if (existing.exists) {
      if (data.ownerUid !== token.uid || data.storage !== "disk" || data.bound === true || data.mime !== mime || data.name !== name || Number(data.size) !== size) {
        res.status(409).json({ error: "That attachment upload can no longer be changed." });
        return;
      }
      res.json({ id, uploadId, nextIndex: Number(data.nextIndex || 0), receivedBytes: Number(data.receivedBytes || 0), totalChunks });
      return;
    }
    await mkdir(nyxChatAttachmentRoot, { recursive: true, mode: 0o750 });
    const filesystem = await statfs(nyxChatAttachmentRoot);
    const availableBytes = Number(filesystem.bavail) * Number(filesystem.bsize);
    if (!Number.isFinite(availableBytes) || availableBytes < size + nyxChatOwnerAttachmentFileLimit) {
      res.status(507).json({ error: "The Nyx server does not have enough free space for that upload and its safety reserve." });
      return;
    }
    const handle = await openFile(path, "wx", 0o640);
    await handle.close();
    const now = Date.now();
    await ref.create({ id, ownerUid: token.uid, name, mime, size, storage: "disk", totalChunks, nextIndex: 0, receivedBytes: 0, complete: false, bound: false, createdAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(), updatedAtMs: now, expiresAtMs: now + nyxChatAttachmentUploadTtlMs });
    res.status(201).json({ id, uploadId, nextIndex: 0, receivedBytes: 0, totalChunks });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The Owner attachment could not be started." });
  }
});

app.put("/api/chat/attachments/large/:uploadId/:index", express.raw({ type: "application/octet-stream", limit: `${nyxChatOwnerAttachmentChunkLimit}b` }), async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  res.status(413).json({ error: "Chat attachments are limited to 8 MB for every account." });
  return;
  let lockId = "";
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const identity = await nyxChatIdentity(firebase, token);
    if (identity.role !== "owner") {
      res.status(403).json({ error: "Only the Nyx Owner can use large attachment uploads." });
      return;
    }
    const uploadId = String(req.params.uploadId || "").trim();
    const index = Number.parseInt(String(req.params.index || ""), 10);
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(uploadId) || !Number.isInteger(index) || index < 0 || !Buffer.isBuffer(req.body) || !req.body.length) {
      res.status(400).json({ error: "That Owner attachment chunk is invalid." });
      return;
    }
    const id = createHash("sha256").update(`${token.uid}:${uploadId}`).digest("hex").slice(0, 40);
    lockId = id;
    if (nyxChatAttachmentUploads.has(id)) {
      res.status(409).json({ error: "That attachment is already receiving a chunk. Retry this part." });
      return;
    }
    nyxChatAttachmentUploads.add(id);
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const snapshot = await ref.get();
    const data = snapshot.data() || {};
    const receivedBytes = Number(data.receivedBytes || 0);
    const remaining = Number(data.size || 0) - receivedBytes;
    const expectedSize = Math.min(nyxChatOwnerAttachmentChunkLimit, remaining);
    if (!snapshot.exists || data.ownerUid !== token.uid || data.storage !== "disk" || data.complete === true || data.bound === true || index !== Number(data.nextIndex || 0) || index >= Number(data.totalChunks || 0) || req.body.length !== expectedSize) {
      res.status(409).json({ error: "That attachment chunk is out of sequence or has the wrong size." });
      return;
    }
    const path = nyxChatAttachmentDiskPath(id);
    const handle = await openFile(path, "r+");
    try {
      await handle.write(req.body, 0, req.body.length, receivedBytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    const nextIndex = index + 1;
    const nextBytes = receivedBytes + req.body.length;
    const now = Date.now();
    await ref.set({ nextIndex, receivedBytes: nextBytes, updatedAt: new Date(now).toISOString(), updatedAtMs: now, expiresAtMs: now + nyxChatAttachmentUploadTtlMs }, { merge: true });
    res.json({ id, received: index, nextIndex, receivedBytes: nextBytes });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The Owner attachment chunk could not be uploaded." });
  } finally {
    if (lockId) nyxChatAttachmentUploads.delete(lockId);
  }
});

app.post("/api/chat/attachments/large/:uploadId/complete", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  res.status(413).json({ error: "Chat attachments are limited to 8 MB for every account." });
  return;
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const identity = await nyxChatIdentity(firebase, token);
    if (identity.role !== "owner") {
      res.status(403).json({ error: "Only the Nyx Owner can finish large attachment uploads." });
      return;
    }
    const uploadId = String(req.params.uploadId || "").trim();
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(uploadId)) {
      res.status(400).json({ error: "That Owner attachment upload is invalid." });
      return;
    }
    const id = createHash("sha256").update(`${token.uid}:${uploadId}`).digest("hex").slice(0, 40);
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const snapshot = await ref.get();
    const data = snapshot.data() || {};
    if (!snapshot.exists || data.ownerUid !== token.uid || data.storage !== "disk" || data.bound === true || Number(data.receivedBytes || 0) !== Number(data.size || 0) || Number(data.nextIndex || 0) !== Number(data.totalChunks || 0)) {
      res.status(409).json({ error: "That Owner attachment is incomplete." });
      return;
    }
    const file = await stat(nyxChatAttachmentDiskPath(id));
    if (!file.isFile() || file.size !== Number(data.size)) {
      res.status(409).json({ error: "The stored attachment size does not match the upload." });
      return;
    }
    await ref.set({ complete: true, completedAt: new Date().toISOString(), expiresAtMs: Date.now() + nyxChatAttachmentUploadTtlMs }, { merge: true });
    res.json({ attachment: nyxChatAttachmentMetadata({ id, ...data, complete: true }) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The Owner attachment could not be completed." });
  }
});

app.put("/api/chat/attachments/:uploadId/:index", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const uploadId = String(req.params.uploadId || "").trim();
    const index = Number.parseInt(String(req.params.index || ""), 10);
    const totalChunks = Number.parseInt(String(req.body?.totalChunks || ""), 10);
    const mime = String(req.body?.mime || "").trim().toLowerCase();
    const name = nyxChatAttachmentName(req.body?.name);
    const size = Number(req.body?.size || 0);
    const chunk = String(req.body?.chunk || "").trim();
    if (
      !/^[A-Za-z0-9_-]{12,80}$/.test(uploadId) ||
      !Number.isInteger(index) || index < 0 ||
      !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > nyxChatAttachmentChunkCountLimit || index >= totalChunks ||
      !nyxChatAttachmentMimeTypes.has(mime) || !Number.isInteger(size) || size < 1 || size > nyxChatAttachmentFileLimit ||
      !chunk || chunk.length > nyxChatAttachmentChunkLimit || !/^[A-Za-z0-9+/=]+$/.test(chunk)
    ) {
      res.status(400).json({ error: "That chat attachment chunk is invalid." });
      return;
    }
    const id = createHash("sha256").update(`${token.uid}:${uploadId}`).digest("hex").slice(0, 40);
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const existing = await ref.get();
    const data = existing.data() || {};
    if (existing.exists && (data.ownerUid !== token.uid || data.bound === true || data.complete === true || data.mime !== mime || data.name !== name || Number(data.size) !== size || Number(data.totalChunks) !== totalChunks)) {
      res.status(409).json({ error: "That attachment upload can no longer be changed." });
      return;
    }
    const now = Date.now();
    await Promise.all([
      ref.set({ id, ownerUid: token.uid, name, mime, size, totalChunks, complete: false, bound: false, updatedAt: new Date(now).toISOString(), updatedAtMs: now, expiresAtMs: now + nyxChatAttachmentUploadTtlMs }, { merge: true }),
      ref.collection("chunks").doc(String(index).padStart(3, "0")).set({ index, chunk })
    ]);
    res.json({ id, received: index });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The attachment could not be uploaded." });
  }
});

app.post("/api/chat/attachments/:uploadId/complete", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const uploadId = String(req.params.uploadId || "").trim();
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(uploadId)) {
      res.status(400).json({ error: "That attachment upload is invalid." });
      return;
    }
    const id = createHash("sha256").update(`${token.uid}:${uploadId}`).digest("hex").slice(0, 40);
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const snapshot = await ref.get();
    const data = snapshot.data() || {};
    const totalChunks = Number(data.totalChunks || 0);
    if (!snapshot.exists || data.ownerUid !== token.uid || data.bound === true || totalChunks < 1 || totalChunks > nyxChatAttachmentChunkCountLimit) {
      res.status(404).json({ error: "That attachment upload was not found." });
      return;
    }
    if (data.complete === true) {
      res.json({ attachment: nyxChatAttachmentMetadata({ id, ...data }) });
      return;
    }
    const chunks = await Promise.all(Array.from({ length: totalChunks }, (_, index) => ref.collection("chunks").doc(String(index).padStart(3, "0")).get()));
    const encoded = chunks.map((chunkSnapshot, index) => {
      const value = chunkSnapshot.data() || {};
      if (!chunkSnapshot.exists || value.index !== index) return "";
      return String(value.chunk || "");
    }).join("");
    if (!encoded || encoded.length > nyxChatAttachmentEncodedLimit || !/^[A-Za-z0-9+/=]+$/.test(encoded) || Buffer.byteLength(encoded, "base64") !== Number(data.size)) {
      res.status(413).json({ error: "That attachment is incomplete or too large." });
      return;
    }
    await ref.set({ complete: true, completedAt: new Date().toISOString(), expiresAtMs: Date.now() + nyxChatAttachmentUploadTtlMs }, { merge: true });
    res.json({ attachment: nyxChatAttachmentMetadata({ id, ...data }) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The attachment could not be completed." });
  }
});

app.post("/api/chat/attachments/:attachmentId/ticket", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const id = String(req.params.attachmentId || "").trim();
    if (!nyxChatAttachmentIdPattern.test(id)) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    const snapshot = await firebase.firestore.collection("nyxChatAttachments").doc(id).get();
    const data = snapshot.data() || {};
    const metadata = nyxChatAttachmentMetadata({ id, ...data });
    if (!snapshot.exists || !metadata?.streamed || data.complete !== true || data.bound !== true) {
      res.status(404).json({ error: "Attachment not found." });
      return;
    }
    await nyxChatAttachmentAccess(firebase, token.uid, data);
    const ticket = randomBytes(32).toString("base64url");
    const expiresAtMs = Date.now() + nyxChatAttachmentTicketTtlMs;
    nyxChatAttachmentTickets.set(ticket, { id, uid: token.uid, expiresAtMs });
    if (nyxChatAttachmentTickets.size > 2_000) {
      const now = Date.now();
      for (const [key, value] of nyxChatAttachmentTickets) if (Number(value?.expiresAtMs || 0) < now) nyxChatAttachmentTickets.delete(key);
    }
    res.json({ url: `/api/chat/attachments/${id}/stream?ticket=${encodeURIComponent(ticket)}`, expiresAtMs });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The attachment link could not be created." });
  }
});

app.get("/api/chat/attachments/:attachmentId/stream", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const id = String(req.params.attachmentId || "").trim();
    const ticket = String(req.query.ticket || "").trim();
    const grant = nyxChatAttachmentTickets.get(ticket);
    if (!nyxChatAttachmentIdPattern.test(id) || !grant || grant.id !== id || Number(grant.expiresAtMs || 0) < Date.now()) {
      if (ticket) nyxChatAttachmentTickets.delete(ticket);
      res.status(404).end();
      return;
    }
    const firebase = await linkGeneratorFirebase();
    const snapshot = await firebase.firestore.collection("nyxChatAttachments").doc(id).get();
    const data = snapshot.data() || {};
    const metadata = nyxChatAttachmentMetadata({ id, ...data });
    const path = nyxChatAttachmentDiskPath(id);
    if (!snapshot.exists || !metadata?.streamed || data.complete !== true || data.bound !== true || !path) {
      res.status(404).end();
      return;
    }
    await nyxChatAttachmentAccess(firebase, grant.uid, data);
    const file = await stat(path);
    if (!file.isFile() || file.size !== metadata.size) {
      res.status(404).end();
      return;
    }
    nyxChatAttachmentStream(req, res, metadata, path);
  } catch {
    res.status(404).end();
  }
});

app.get("/api/chat/attachments/:attachmentId", async (req, res) => {
  res.set("Cache-Control", "private, max-age=60");
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const id = String(req.params.attachmentId || "").trim();
    if (!nyxChatAttachmentIdPattern.test(id)) {
      res.status(404).end();
      return;
    }
    const ref = firebase.firestore.collection("nyxChatAttachments").doc(id);
    const snapshot = await ref.get();
    const data = snapshot.data() || {};
    const metadata = nyxChatAttachmentMetadata({ id, ...data });
    if (!snapshot.exists || !metadata || data.complete !== true || data.bound !== true) {
      res.status(404).end();
      return;
    }
    await nyxChatAttachmentAccess(firebase, token.uid, data);
    const totalChunks = Number(data.totalChunks || 0);
    if (totalChunks < 1 || totalChunks > nyxChatAttachmentChunkCountLimit) {
      res.status(404).end();
      return;
    }
    const chunks = await Promise.all(Array.from({ length: totalChunks }, (_, index) => ref.collection("chunks").doc(String(index).padStart(3, "0")).get()));
    const encoded = chunks.map((chunkSnapshot, index) => {
      const value = chunkSnapshot.data() || {};
      if (!chunkSnapshot.exists || value.index !== index) throw new Error("Attachment is incomplete.");
      return String(value.chunk || "");
    }).join("");
    if (!encoded || encoded.length > nyxChatAttachmentEncodedLimit || !/^[A-Za-z0-9+/=]+$/.test(encoded)) {
      res.status(404).end();
      return;
    }
    const buffer = Buffer.from(encoded, "base64");
    if (buffer.length !== metadata.size) {
      res.status(404).end();
      return;
    }
    const asciiName = metadata.name.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 100) || "attachment";
    const disposition = metadata.image || metadata.audio || metadata.video ? "inline" : "attachment";
    res.set({
      "Content-Type": metadata.mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
      "X-Content-Type-Options": "nosniff"
    });
    res.end(buffer);
  } catch (error) {
    res.status(error.status === 401 ? 401 : 404).end();
  }
});

app.post("/api/chat/messages", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    await assertNyxChatCanSend(firebase, token.uid);
    const scope = await nyxChatScope(firebase, token.uid, { channel: req.body?.channel, conversationId: req.body?.conversationId });
    const text = nyxChatText(req.body?.text);
    const requestId = String(req.body?.requestId || "").trim();
    const attachmentIds = [...new Set((Array.isArray(req.body?.attachmentIds) ? req.body.attachmentIds : []).map(value => String(value || "").trim()))];
    if (!text && !attachmentIds.length) {
      res.status(400).json({ error: "Write a message or add an attachment before sending it." });
      return;
    }
    if (text.length > nyxChatMessageLimit) {
      res.status(400).json({ error: `Messages can be up to ${nyxChatMessageLimit.toLocaleString()} characters.` });
      return;
    }
    if (!/^[A-Za-z0-9_-]{12,80}$/.test(requestId)) {
      res.status(400).json({ error: "The chat request could not be verified. Refresh and try again." });
      return;
    }
    if (attachmentIds.length > nyxChatAttachmentCountLimit || attachmentIds.some(id => !nyxChatAttachmentIdPattern.test(id))) {
      res.status(400).json({ error: `You can attach up to ${nyxChatAttachmentCountLimit} files to one message.` });
      return;
    }
    nyxChatConsumeSendAttempt(token.uid);
    const identity = await nyxChatIdentity(firebase, token);
    if (nyxChatMentionHandles(text).includes("everyone") && !identity.canModerate) {
      res.status(403).json({ error: "Only moderators and staff can mention @everyone." });
      return;
    }
    const messageId = createHash("sha256").update(`${token.uid}:${requestId}`).digest("hex").slice(0, 40);
    const messageRef = scope.messages.doc(messageId);
    const existing = await messageRef.get();
    if (existing.exists) {
      res.json({ message: nyxChatMessagePayload(existing, token.uid), duplicate: true });
      return;
    }
    const attachmentRefs = attachmentIds.map(id => firebase.firestore.collection("nyxChatAttachments").doc(id));
    const attachmentSnapshots = await Promise.all(attachmentRefs.map(ref => ref.get()));
    const attachments = attachmentSnapshots.map((snapshot, index) => {
      const value = snapshot.data() || {};
      if (!snapshot.exists || value.ownerUid !== token.uid || value.complete !== true || value.bound === true || Number(value.expiresAtMs || 0) < Date.now()) return null;
      return nyxChatAttachmentMetadata({ id: attachmentIds[index], ...value });
    });
    const attachmentTotal = attachments.reduce((total, value) => total + Number(value?.size || 0), 0);
    if (attachments.some(value => !value) || attachments.some(value => value?.streamed) || attachmentTotal > nyxChatAttachmentMessageLimit) {
      res.status(400).json({ error: "One or more attachments are unavailable or the combined attachment size is too large." });
      return;
    }
    const createdAtMs = Date.now();
    const value = {
      channel: scope.type === "channel" ? scope.id : "",
      conversationId: scope.private ? scope.id : "",
      text,
      attachments,
      reactions: [],
      authorUid: token.uid,
      author: {
        uid: token.uid,
        displayName: identity.displayName,
        handle: identity.handle,
        avatarUrl: identity.avatarUrl,
        role: identity.role,
        customRole: identity.customRole,
        caffeine: identity.caffeine
      },
      createdAt: new Date(createdAtMs).toISOString(),
      createdAtMs
    };
    try {
      await firebase.firestore.runTransaction(async transaction => {
        const currentMessage = await transaction.get(messageRef);
        if (currentMessage.exists) return;
        const currentAttachments = [];
        for (const ref of attachmentRefs) currentAttachments.push(await transaction.get(ref));
        currentAttachments.forEach((snapshot, index) => {
          const attachment = snapshot.data() || {};
          if (!snapshot.exists || attachment.ownerUid !== token.uid || attachment.complete !== true || attachment.bound === true || Number(attachment.expiresAtMs || 0) < createdAtMs) {
            const error = new Error(`Attachment ${index + 1} is no longer available.`);
            error.status = 409;
            throw error;
          }
        });
        transaction.create(messageRef, value);
        attachmentRefs.forEach(ref => transaction.set(ref, { bound: true, messageId, scopeType: scope.type, scopeId: scope.id, boundAt: new Date(createdAtMs).toISOString(), expiresAtMs: 0 }, { merge: true }));
        if (scope.private) transaction.set(scope.ref, {
          updatedAt: new Date(createdAtMs).toISOString(),
          updatedAtMs: createdAtMs,
          lastMessageAtMs: createdAtMs,
          lastMessageText: text ? text.slice(0, 120) : (attachments.length === 1 ? `Attached ${attachments[0].name}` : `Attached ${attachments.length} files`),
          lastMessageAuthorUid: token.uid
        }, { merge: true });
        else transaction.set(scope.ref, {
          updatedAt: new Date(createdAtMs).toISOString(),
          updatedAtMs: createdAtMs,
          lastMessageAtMs: createdAtMs,
          lastMessageText: text.slice(0, nyxChatMessageLimit),
          lastMessageAuthorUid: token.uid
        }, { merge: true });
      });
    } catch (error) {
      if (Number(error?.code) !== 6 && String(error?.code || "") !== "6") throw error;
    }
    const saved = await messageRef.get();
    const revision = recordNyxChatRealtimeEvent({
      kind: "message",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || [],
      createdAtMs,
      lastMessageText: text,
      lastMessageAuthorUid: token.uid
    });
    emitNyxChatSocketEvent({
      kind: "message",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || [],
      createdAtMs,
      lastMessageText: text,
      lastMessageAuthorUid: token.uid,
      messageDocument: saved,
      revision
    });
    if (!scope.private) {
      const activity = new Map(nyxChatChannelActivityCache.value);
      activity.set(scope.id, createdAtMs);
      nyxChatChannelActivityCache = { ...nyxChatChannelActivityCache, value: activity };
    }
    res.status(201).json({ message: nyxChatMessagePayload(saved, token.uid) });
  } catch (error) {
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 503).json({ error: error.message || "Your message could not be sent." });
  }
});

app.delete("/api/chat/messages/:scope/:messageId", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const scope = await nyxChatScope(firebase, token.uid, { scope: req.params.scope });
    const messageId = String(req.params.messageId || "").trim();
    if (!/^[a-f0-9]{40}$/.test(messageId)) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    const messageRef = scope.messages.doc(messageId);
    const [messageSnapshot, identity] = await Promise.all([messageRef.get(), nyxChatIdentity(firebase, token)]);
    if (!messageSnapshot.exists) {
      res.status(404).json({ error: "Message not found." });
      return;
    }
    const authorUid = String(messageSnapshot.data()?.authorUid || messageSnapshot.data()?.author?.uid || "");
    if (authorUid !== token.uid && (scope.private || !identity.canModerate)) {
      res.status(403).json({ error: "You can only delete your own messages." });
      return;
    }
    const attachmentIds = (Array.isArray(messageSnapshot.data()?.attachments) ? messageSnapshot.data().attachments : []).map(value => String(value?.id || "")).filter(id => nyxChatAttachmentIdPattern.test(id));
    const attachmentRefs = attachmentIds.map(id => firebase.firestore.collection("nyxChatAttachments").doc(id));
    const [attachmentSnapshots, chunkSnapshots] = await Promise.all([
      Promise.all(attachmentRefs.map(ref => ref.get())),
      Promise.all(attachmentRefs.map(ref => ref.collection("chunks").get()))
    ]);
    const diskPaths = attachmentSnapshots.map((snapshot, index) => snapshot.data()?.storage === "disk" ? nyxChatAttachmentDiskPath(attachmentIds[index]) : "").filter(Boolean);
    const batch = firebase.firestore.batch();
    batch.delete(messageRef);
    attachmentRefs.forEach((ref, index) => {
      chunkSnapshots[index].docs.forEach(document => batch.delete(document.ref));
      batch.delete(ref);
    });
    await batch.commit();
    await Promise.allSettled(diskPaths.map(path => unlink(path)));
    const revision = recordNyxChatRealtimeEvent({
      kind: "delete",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || []
    });
    emitNyxChatSocketEvent({
      kind: "delete",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || [],
      messageId,
      revision
    });
    res.json({ ok: true, id: messageId, channel: scope.type === "channel" ? scope.id : "", conversationId: scope.private ? scope.id : "" });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The message could not be deleted." });
  }
});

app.post("/api/chat/messages/:scope/:messageId/reactions", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxChatUser(req);
    const scope = await nyxChatScope(firebase, token.uid, { scope: req.params.scope });
    const messageId = String(req.params.messageId || "").trim();
    const emoji = String(req.body?.emoji || "");
    if (!/^[a-f0-9]{40}$/.test(messageId) || !nyxChatReactionEmoji.has(emoji)) {
      res.status(400).json({ error: "That reaction is not available." });
      return;
    }
    const messageRef = scope.messages.doc(messageId);
    let reactions = [];
    await firebase.firestore.runTransaction(async transaction => {
      const snapshot = await transaction.get(messageRef);
      if (!snapshot.exists) {
        const error = new Error("Message not found.");
        error.status = 404;
        throw error;
      }
      const current = (Array.isArray(snapshot.data()?.reactions) ? snapshot.data().reactions : []).map(entry => ({
        emoji: String(entry?.emoji || ""),
        uids: [...new Set((Array.isArray(entry?.uids) ? entry.uids : []).map(uid => String(uid || "").trim()).filter(Boolean))].slice(0, 250)
      })).filter(entry => nyxChatReactionEmoji.has(entry.emoji));
      let entry = current.find(item => item.emoji === emoji);
      if (!entry) {
        entry = { emoji, uids: [] };
        current.push(entry);
      }
      const active = entry.uids.includes(token.uid);
      if (active) entry.uids = entry.uids.filter(uid => uid !== token.uid);
      else if (entry.uids.length < 250) entry.uids.push(token.uid);
      else {
        const error = new Error("That reaction has reached its limit.");
        error.status = 409;
        throw error;
      }
      reactions = current.filter(item => item.uids.length);
      transaction.set(messageRef, { reactions }, { merge: true });
    });
    const revision = recordNyxChatRealtimeEvent({
      kind: "reaction",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || []
    });
    emitNyxChatSocketEvent({
      kind: "reaction",
      scopeType: scope.private ? "conversation" : "channel",
      scopeId: scope.id,
      participants: scope.participants || [],
      messageId,
      reactions,
      revision
    });
    res.json({ reactions: nyxChatReactionPayload(reactions, token.uid) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The reaction could not be saved." });
  }
});

app.post("/api/activity/heartbeat", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const now = Date.now();
    signedInPresence.set(token.uid, now);
    const timestamp = new Date(now).toISOString();
    const lastSeenIp = nyxClientIp(req);
    const administrationRef = firebase.firestore.collection("nyxUserAdministration").doc(token.uid);
    const administration = await administrationRef.get();
    const administrationData = administration.data() || {};
    const work = [firebase.firestore.collection("nyxUserActivity").doc(token.uid).set({
        lastActiveAt: timestamp,
        lastActiveAtMs: now,
        onlineUntilMs: now + signedInOnlineWindowMs,
        updatedAt: timestamp
      }, { merge: true })];
    const recordedIpAt = Date.parse(String(administrationData.lastSeenIpAt || "")) || 0;
    if (lastSeenIp && (normalizeNyxIp(administrationData.lastSeenIp) !== lastSeenIp || now - recordedIpAt >= 24 * 60 * 60_000)) {
      work.push(administrationRef.set({ lastSeenIp, lastSeenIpAt: timestamp, updatedAt: timestamp }, { merge: true }));
    }
    await Promise.all(work);
    const role = nyxRoleForUser(token.uid, administrationData);
    const customRole = nyxAssignedCustomRole(administrationData, await nyxCustomRoles(firebase));
    const access = nyxOwnerAccessPayload({ uid: token.uid, role, customRole, permissions: customRole?.permissions || nyxRolePolicy(role).permissions });
    const subscriptionStatus = normalizeSubscriptionStatus(administrationData.subscriptionStatus || administrationData.subscription?.status);
    res.json({
      ok: true,
      onlineUntil: new Date(now + signedInOnlineWindowMs).toISOString(),
      role,
      owner: access.owner,
      dashboard: access.dashboard,
      permissions: access.permissions,
      subscriptionStatus,
      premiumAccess: hasPremiumSubscription(subscriptionStatus)
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Activity could not be updated." });
  }
});

app.post("/api/activity/event", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  try {
    const { firebase, token } = await authenticatedNyxUser(req);
    const action = String(req.body?.action || "").trim().toLowerCase();
    if (!["login", "session_start"].includes(action)) {
      res.status(400).json({ error: "That activity event is not supported." });
      return;
    }
    const lastSeenIp = nyxClientIp(req);
    if (lastSeenIp) {
      await firebase.firestore.collection("nyxUserAdministration").doc(token.uid).set({
        lastSeenIp,
        lastSeenIpAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    const key = `${token.uid}:${action}`;
    const now = Date.now();
    const lastRecorded = Number(userActivityEventTimes.get(key) || 0);
    if (now - lastRecorded >= userActivityEventWindowMs) {
      userActivityEventTimes.set(key, now);
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: token.email,
        action,
        targetUid: token.uid,
        targetEmail: token.email,
        details: { provider: String(token.firebase?.sign_in_provider || "password") }
      });
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Activity could not be recorded." });
  }
});

app.get("/api/owner-dashboard", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, actor } = await ownerDashboardActor(req, "users:view");
    const [{ users: accountUsers, truncated }, auditSnapshot, guestUsers, customRoleMap] = await Promise.all([
      ownerDashboardSnapshot(firebase),
      nyxActorHasPermission(actor, "audit:view")
        ? firebase.firestore.collection("nyxAuditLog").orderBy("createdAtMs", "desc").limit(30).get()
        : Promise.resolve(null),
      nyxActiveGuestUsers(firebase),
      nyxCustomRoles(firebase)
    ]);
    const ownerUid = founderProfileConfig().administratorUid;
    const canReviewSearchHistory = nyxActorCanReviewSearchHistory(actor);
    const accountUsersForViewer = accountUsers.map(user => ({
      ...nyxOwnerUserForViewer(user, actor.uid, ownerUid),
      canReviewSearchHistory: canReviewSearchHistory && (actor.role === "owner" || user.role !== "owner")
    }));
    const allUsers = [...accountUsersForViewer, ...guestUsers];
    const now = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const premiumStatuses = new Set(["premium", "trialing"]);
    const metrics = {
      totalUsers: accountUsers.length,
      guestUsers: guestUsers.length,
      activeToday: accountUsers.filter(user => (Date.parse(user.lastActiveAt || "") || 0) >= today.getTime()).length,
      onlineUsers: allUsers.filter(user => user.online).length,
      newSignups: accountUsers.filter(user => (Date.parse(user.createdAt || "") || 0) >= sevenDaysAgo).length,
      premiumSubscribers: accountUsers.filter(user => premiumStatuses.has(user.subscriptionStatus)).length,
      monthlyRevenueCents: accountUsers.reduce((total, user) => total + (premiumStatuses.has(user.subscriptionStatus) ? user.monthlyRevenueCents : 0), 0)
    };
    const search = String(req.query.search || "").trim().toLowerCase().slice(0, 120);
    const role = String(req.query.role || "all").trim().toLowerCase();
    const subscription = String(req.query.subscription || "all").trim().toLowerCase();
    const status = String(req.query.status || "all").trim().toLowerCase();
    const segment = String(req.query.segment || "all").trim().toLowerCase();
    let filtered = allUsers.filter(user => {
      if (search && ![user.displayName, user.username, user.email, user.uid].some(value => String(value || "").toLowerCase().includes(search))) return false;
      if (role !== "all" && user.role !== role && user.customRole?.id !== role) return false;
      if (subscription !== "all" && user.subscriptionStatus !== subscription) return false;
      if (status === "enabled" && (user.guest || user.disabled)) return false;
      if (status === "disabled" && (user.guest || !user.disabled)) return false;
      if (status === "online" && !user.online) return false;
      if (status === "offline" && user.online) return false;
      if (segment === "active_today" && (Date.parse(user.lastActiveAt || "") || 0) < today.getTime()) return false;
      if (segment === "online" && !user.online) return false;
      if (segment === "new_7d" && (user.guest || (Date.parse(user.createdAt || "") || 0) < sevenDaysAgo)) return false;
      if ((segment === "premium" || segment === "revenue") && !premiumStatuses.has(user.subscriptionStatus)) return false;
      return true;
    });
    filtered = nyxOwnerSortUsers(filtered, String(req.query.sort || ""), String(req.query.direction || "").toLowerCase());
    const pageSize = Math.max(10, Math.min(ownerDashboardPageSizeLimit, Number.parseInt(String(req.query.pageSize || "25"), 10) || 25));
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.max(1, Math.min(pages, Number.parseInt(String(req.query.page || "1"), 10) || 1));
    const offset = (page - 1) * pageSize;
    const recentActivity = (auditSnapshot?.docs || []).map(document => {
      const data = document.data() || {};
      return {
        id: document.id,
        actorUid: String(data.actorUid || ""),
        actorEmail: String(data.actorEmail || ""),
        action: String(data.action || ""),
        targetUid: String(data.targetUid || ""),
        targetEmail: String(data.targetEmail || ""),
        details: data.details && typeof data.details === "object" ? data.details : {},
        createdAt: safeDateIso(data.createdAt, new Date(Number(data.createdAtMs || 0) || now).toISOString())
      };
    });
    res.json({
      access: nyxOwnerAccessPayload(actor),
      metrics,
      users: filtered.slice(offset, offset + pageSize),
      customRoles: nyxVisibleCustomRoles(customRoleMap, actor.uid, ownerUid, actor.customRole),
      pagination: { page, pageSize, pages, total: filtered.length, scanned: allUsers.length, accounts: accountUsers.length, guests: guestUsers.length, truncated },
      recentActivity,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Owner dashboard is unavailable." });
  }
});

app.get("/api/owner-dashboard/users/:uid", async (req, res) => {
  res.set("Cache-Control", "no-store");
  const uid = String(req.params.uid || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) {
    res.status(400).json({ error: "That user ID is invalid." });
    return;
  }
  try {
    const { firebase, actor, ownerUid } = await ownerDashboardActor(req, "users:view");
    const [user, administration, profile, activity, audit, customRoles] = await Promise.all([
      firebase.auth.getUser(uid),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get(),
      firebase.firestore.collection("nyxUserProfiles").doc(uid).get(),
      firebase.firestore.collection("nyxUserActivity").doc(uid).get(),
      nyxActorHasPermission(actor, "audit:view")
        ? firebase.firestore.collection("nyxAuditLog").where("targetUid", "==", uid).orderBy("createdAtMs", "desc").limit(20).get().catch(() => null)
        : Promise.resolve(null),
      nyxCustomRoles(firebase)
    ]);
    const targetRole = nyxRoleForUser(uid, administration.data(), ownerUid);
    const capabilities = nyxOwnerUserCapabilities(actor, targetRole, uid, ownerUid);
    const record = nyxOwnerUserForViewer(
      nyxOwnerUserRecord(user, administration.data(), profile.data(), activity.data(), ownerUid, true, capabilities.canManageNetworkBans, customRoles),
      actor.uid,
      ownerUid
    );
    record.recentActivity = audit ? audit.docs.map(document => {
      const data = document.data() || {};
      return { id: document.id, action: String(data.action || ""), actorEmail: String(data.actorEmail || ""), createdAt: safeDateIso(data.createdAt), details: data.details || {} };
    }) : [];
    res.json({ user: record, access: nyxOwnerAccessPayload(actor), capabilities });
  } catch (error) {
    const status = error.code === "auth/user-not-found" ? 404 : (error.status || 503);
    res.status(status).json({ error: status === 404 ? "User not found." : (error.message || "User details are unavailable.") });
  }
});

app.get("/api/owner-dashboard/audit", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, actor } = await ownerDashboardActor(req, "audit:view");
    const limit = Math.max(10, Math.min(200, Number.parseInt(String(req.query.limit || "100"), 10) || 100));
    const snapshot = await firebase.firestore.collection("nyxAuditLog").orderBy("createdAtMs", "desc").limit(limit).get();
    res.json({
      access: nyxOwnerAccessPayload(actor),
      activity: snapshot.docs.map(document => {
        const data = document.data() || {};
        return {
          id: document.id,
          actorUid: String(data.actorUid || ""),
          actorEmail: String(data.actorEmail || ""),
          action: String(data.action || ""),
          targetUid: String(data.targetUid || ""),
          targetEmail: String(data.targetEmail || ""),
          details: data.details && typeof data.details === "object" ? data.details : {},
          createdAt: safeDateIso(data.createdAt)
        };
      })
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Audit activity is unavailable." });
  }
});

app.get("/api/owner-dashboard/custom-roles", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, actor } = await nyxFounderOwnerActor(req);
    const roles = await nyxCustomRoles(firebase);
    res.json({
      access: nyxOwnerAccessPayload(actor),
      roles: [...roles.values()].map(nyxPublicCustomRole),
      placements: nyxAssignableRoles.map(id => ({ id, label: nyxRoleLabels[id], rank: nyxRolePolicy(id).rank })),
      permissions: nyxCustomRolePermissionCatalog.map(([id, label]) => ({ id, label }))
    });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "Custom roles are unavailable." });
  }
});

app.post("/api/owner-dashboard/custom-roles", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
  try {
    const { firebase, token, actor } = await nyxFounderOwnerActor(req);
    const label = founderProfileText(req.body?.label, "", nyxCustomRoleLabelLimit);
    const id = nyxCustomRoleId(req.body?.id || label);
    const baseRole = String(req.body?.baseRole || "member").trim().toLowerCase();
    const color = nyxCustomRoleColor(req.body?.color);
    const permissions = nyxCustomRolePermissions(req.body?.permissions, baseRole);
    if (label.length < 2) return res.status(400).json({ error: "Custom role names must contain at least 2 characters." });
    if (!nyxCustomRoleIdPattern.test(id) || Object.prototype.hasOwnProperty.call(nyxRolePolicies, id)) return res.status(400).json({ error: "Choose a unique role ID containing letters, numbers, or hyphens." });
    if (!nyxAssignableRoles.includes(baseRole)) return res.status(400).json({ error: "Choose a valid role placement." });
    if (!color) return res.status(400).json({ error: "Choose a six-digit hex color or a Minecraft color code from &0 through &f." });
    const roles = await nyxCustomRoles(firebase);
    if (roles.size >= 50) return res.status(409).json({ error: "Nyx supports up to 50 custom roles." });
    const reference = firebase.firestore.collection(nyxCustomRoleCollection).doc(id);
    if ((await reference.get()).exists) return res.status(409).json({ error: "A custom role with that ID already exists." });
    const timestamp = new Date().toISOString();
    await reference.set({ id, label, color, baseRole, permissions, createdAt: timestamp, updatedAt: timestamp, createdBy: token.uid, updatedBy: token.uid });
    invalidateNyxCustomRoles();
    const role = (await nyxCustomRoles(firebase, true)).get(id);
    await recordNyxAuditSafe(firebase, { actorUid: token.uid, actorEmail: token.email, action: "custom_role_created", details: { id, label, color, baseRole, permissions } });
    res.status(201).json({ role: nyxPublicCustomRole(role), access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The custom role could not be created." });
  }
});

app.patch("/api/owner-dashboard/custom-roles/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
  const id = nyxCustomRoleId(req.params.id);
  if (!nyxCustomRoleIdPattern.test(id)) return res.status(400).json({ error: "That custom role is invalid." });
  try {
    const { firebase, token, actor } = await nyxFounderOwnerActor(req);
    const reference = firebase.firestore.collection(nyxCustomRoleCollection).doc(id);
    const existing = await reference.get();
    if (!existing.exists) return res.status(404).json({ error: "That custom role no longer exists." });
    const current = nyxCustomRoleRecord(id, existing.data());
    const label = founderProfileText(req.body?.label ?? current.label, "", nyxCustomRoleLabelLimit);
    const color = nyxCustomRoleColor(req.body?.color ?? current.color);
    const baseRole = String(req.body?.baseRole ?? current.baseRole).trim().toLowerCase();
    const permissions = nyxCustomRolePermissions(req.body?.permissions ?? current.permissions, baseRole);
    if (label.length < 2) return res.status(400).json({ error: "Custom role names must contain at least 2 characters." });
    if (!color) return res.status(400).json({ error: "Choose a six-digit hex color or a Minecraft color code from &0 through &f." });
    if (!nyxAssignableRoles.includes(baseRole)) return res.status(400).json({ error: "Choose a valid role placement." });
    const timestamp = new Date().toISOString();
    await reference.set({ label, color, baseRole, permissions, updatedAt: timestamp, updatedBy: token.uid }, { merge: true });
    const assigned = await firebase.firestore.collection("nyxUserAdministration").where("customRoleId", "==", id).limit(5000).get();
    if (baseRole !== current.baseRole) {
      for (let offset = 0; offset < assigned.docs.length; offset += 450) {
        const batch = firebase.firestore.batch();
        assigned.docs.slice(offset, offset + 450).forEach(document => batch.set(document.ref, { role: baseRole, updatedAt: timestamp }, { merge: true }));
        await batch.commit();
      }
    }
    assigned.docs.forEach(document => linkCheckerBulkAccessCache.delete(document.id));
    invalidateNyxCustomRoles();
    const role = (await nyxCustomRoles(firebase, true)).get(id);
    await recordNyxAuditSafe(firebase, { actorUid: token.uid, actorEmail: token.email, action: "custom_role_updated", details: { id, label, color, baseRole, permissions } });
    res.json({ role: nyxPublicCustomRole(role), access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The custom role could not be updated." });
  }
});

app.delete("/api/owner-dashboard/custom-roles/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
  const id = nyxCustomRoleId(req.params.id);
  if (!nyxCustomRoleIdPattern.test(id)) return res.status(400).json({ error: "That custom role is invalid." });
  try {
    const { firebase, token, actor } = await nyxFounderOwnerActor(req);
    const reference = firebase.firestore.collection(nyxCustomRoleCollection).doc(id);
    const existing = await reference.get();
    if (!existing.exists) return res.status(404).json({ error: "That custom role no longer exists." });
    const assigned = await firebase.firestore.collection("nyxUserAdministration").where("customRoleId", "==", id).limit(5000).get();
    const timestamp = new Date().toISOString();
    for (let offset = 0; offset < assigned.docs.length; offset += 450) {
      const batch = firebase.firestore.batch();
      assigned.docs.slice(offset, offset + 450).forEach(document => {
        const previousRole = normalizeNyxRole(document.data()?.customRolePreviousRole);
        batch.set(document.ref, { role: previousRole === "owner" ? "member" : previousRole, customRoleId: "", customRolePreviousRole: "", updatedAt: timestamp }, { merge: true });
      });
      await batch.commit();
    }
    assigned.docs.forEach(document => linkCheckerBulkAccessCache.delete(document.id));
    await reference.delete();
    invalidateNyxCustomRoles();
    await recordNyxAuditSafe(firebase, { actorUid: token.uid, actorEmail: token.email, action: "custom_role_deleted", details: { id, label: existing.data()?.label || id, unassignedUsers: assigned.size } });
    res.json({ removed: true, id, unassignedUsers: assigned.size, access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The custom role could not be deleted." });
  }
});

app.post("/api/owner-dashboard/custom-roles/:id/assign", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
  const id = nyxCustomRoleId(req.params.id);
  const uid = String(req.body?.uid || "").trim();
  if (!nyxCustomRoleIdPattern.test(id) || !/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return res.status(400).json({ error: "Choose a valid role and account." });
  try {
    const { firebase, token, actor, ownerUid } = await nyxFounderOwnerActor(req);
    if (uid === ownerUid) return res.status(409).json({ error: "The configured Owner account cannot be assigned a custom role." });
    const [roleSnapshot, target, administrationSnapshot] = await Promise.all([
      firebase.firestore.collection(nyxCustomRoleCollection).doc(id).get(),
      firebase.auth.getUser(uid),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get()
    ]);
    if (!roleSnapshot.exists) return res.status(404).json({ error: "That custom role no longer exists." });
    const role = nyxCustomRoleRecord(id, roleSnapshot.data());
    if (!role) return res.status(409).json({ error: "That custom role is not configured correctly." });
    const administration = administrationSnapshot.data() || {};
    const previousRole = administration.customRoleId
      ? normalizeNyxRole(administration.customRolePreviousRole)
      : normalizeNyxRole(administration.role);
    await administrationSnapshot.ref.set({
      role: role.baseRole,
      customRoleId: id,
      customRolePreviousRole: previousRole === "owner" ? "member" : previousRole,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    linkCheckerBulkAccessCache.delete(uid);
    invalidateNyxCustomRoles();
    await recordNyxAuditSafe(firebase, { actorUid: token.uid, actorEmail: token.email, action: "custom_role_assigned", targetUid: uid, targetEmail: target.email, details: { id, label: role.label, baseRole: role.baseRole } });
    res.json({ assigned: true, uid, role: nyxPublicCustomRole(role), access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.code === "auth/user-not-found" ? 404 : (error.status || 503)).json({ error: error.message || "The custom role could not be assigned." });
  }
});

app.delete("/api/owner-dashboard/custom-role-assignments/:uid", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) return res.status(403).json({ error: "Cross-origin requests are not allowed." });
  const uid = String(req.params.uid || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) return res.status(400).json({ error: "That user ID is invalid." });
  try {
    const { firebase, token, actor, ownerUid } = await nyxFounderOwnerActor(req);
    if (uid === ownerUid) return res.status(409).json({ error: "The configured Owner account cannot be changed." });
    const [target, administrationSnapshot] = await Promise.all([
      firebase.auth.getUser(uid),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get()
    ]);
    const administration = administrationSnapshot.data() || {};
    if (!administration.customRoleId) return res.status(409).json({ error: "That account does not have a custom role." });
    const restoredRole = normalizeNyxRole(administration.customRolePreviousRole);
    await administrationSnapshot.ref.set({ role: restoredRole === "owner" ? "member" : restoredRole, customRoleId: "", customRolePreviousRole: "", updatedAt: new Date().toISOString() }, { merge: true });
    linkCheckerBulkAccessCache.delete(uid);
    invalidateNyxCustomRoles();
    await recordNyxAuditSafe(firebase, { actorUid: token.uid, actorEmail: token.email, action: "custom_role_removed", targetUid: uid, targetEmail: target.email, details: { previousCustomRoleId: administration.customRoleId, restoredRole } });
    res.json({ removed: true, uid, restoredRole, access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.code === "auth/user-not-found" ? 404 : (error.status || 503)).json({ error: error.message || "The custom role could not be removed." });
  }
});

app.get("/api/owner-dashboard/ip-bans", async (req, res) => {
  res.set("Cache-Control", "no-store");
  try {
    const { firebase, actor } = await ownerDashboardActor(req, "network:bans");
    const bans = [...(await nyxIpBans(firebase, { wait: true })).values()]
      .sort((left, right) => Date.parse(right.createdAt || "") - Date.parse(left.createdAt || ""));
    res.json({ access: nyxOwnerAccessPayload(actor), bans, clientIp: nyxClientIp(req) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "IP bans are unavailable." });
  }
});

app.post("/api/owner-dashboard/ip-bans", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const ip = normalizeNyxIp(req.body?.ip);
  if (!ip) {
    res.status(400).json({ error: "Enter a valid IPv4 or IPv6 address." });
    return;
  }
  if (ip === nyxClientIp(req)) {
    res.status(409).json({ error: "You cannot block the IP address currently managing Nyx." });
    return;
  }
  try {
    const { firebase, token, actor } = await ownerDashboardActor(req, "network:bans");
    const id = nyxIpBanId(ip);
    const existing = await firebase.firestore.collection(nyxIpBanCollectionName).doc(id).get();
    const reason = String(req.body?.reason || "").trim().slice(0, 160);
    const createdAt = String(existing.data()?.createdAt || new Date().toISOString());
    await firebase.firestore.collection(nyxIpBanCollectionName).doc(id).set({
      ip,
      reason,
      createdAt,
      createdBy: String(existing.data()?.createdBy || token.email || token.uid).slice(0, 254),
      updatedAt: new Date().toISOString(),
      updatedBy: String(token.email || token.uid).slice(0, 254)
    }, { merge: true });
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email,
      action: existing.exists ? "ip_ban_updated" : "ip_banned",
      details: { ip, reason }
    });
    const ban = nyxIpBanRecord(id, (await firebase.firestore.collection(nyxIpBanCollectionName).doc(id).get()).data());
    cacheNyxIpBan(ban);
    res.status(existing.exists ? 200 : 201).json({ ban, access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The IP ban could not be saved." });
  }
});

app.delete("/api/owner-dashboard/ip-bans/:id", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const id = String(req.params.id || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(id)) {
    res.status(400).json({ error: "That IP ban is invalid." });
    return;
  }
  try {
    const { firebase, token, actor } = await ownerDashboardActor(req, "network:bans");
    const reference = firebase.firestore.collection(nyxIpBanCollectionName).doc(id);
    const snapshot = await reference.get();
    if (!snapshot.exists) {
      res.status(404).json({ error: "That IP ban no longer exists." });
      return;
    }
    const ban = nyxIpBanRecord(id, snapshot.data());
    await reference.delete();
    removeCachedNyxIpBan(ban);
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email,
      action: "ip_ban_removed",
      details: { ip: ban?.ip || "" }
    });
    res.json({ removed: true, id, access: nyxOwnerAccessPayload(actor) });
  } catch (error) {
    res.status(error.status || 503).json({ error: error.message || "The IP ban could not be removed." });
  }
});

app.patch("/api/owner-dashboard/users/:uid", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const uid = String(req.params.uid || "").trim();
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(uid)) {
    res.status(400).json({ error: "That user ID is invalid." });
    return;
  }
  try {
    const { firebase, token, actor, ownerUid } = await ownerDashboardActor(req, "dashboard:view");
    const action = String(req.body?.action || "").trim().toLowerCase();
    const [target, targetAdministration] = await Promise.all([
      firebase.auth.getUser(uid),
      uid === ownerUid
        ? Promise.resolve(null)
        : firebase.firestore.collection("nyxUserAdministration").doc(uid).get()
    ]);
    const targetRole = nyxRoleForUser(uid, targetAdministration?.data(), ownerUid);
    const capabilities = nyxOwnerUserCapabilities(actor, targetRole, uid, ownerUid);
    const capabilityByAction = {
      set_role: "canSetRole",
      set_subscription: "canSetSubscription",
      set_profile: "canEditProfile",
      disable: "canDisableAccount",
      enable: "canDisableAccount",
      verify_email: "canVerifyEmail",
      create_password_reset_link: "canResetPassword",
      send_password_reset: "canResetPassword",
      disable_with_ip_ban: "canDisableAccount",
      delete: "canDeleteAccount"
    };
    if (capabilityByAction[action]) {
      assertNyxOwnerCapability(capabilities, capabilityByAction[action], `Your ${nyxRoleLabels[actor.role] || "Member"} role cannot perform that action on this account.`);
    }
    const ownerProtectedAction = ["set_role", "disable", "disable_with_ip_ban", "delete"].includes(action);
    if (uid === ownerUid && ownerProtectedAction) {
      res.status(409).json({ error: "The configured owner account cannot be demoted, disabled, or deleted." });
      return;
    }
    let auditAction = action;
    let auditDetails = {};
    if (action === "set_role") {
      const requestedRole = String(req.body?.role || "").trim().toLowerCase();
      if (!capabilities.assignableRoles.includes(requestedRole)) {
        res.status(403).json({ error: "Your role cannot assign that account role." });
        return;
      }
      const role = normalizeNyxRole(requestedRole);
      await firebase.firestore.collection("nyxUserAdministration").doc(uid).set({ role, customRoleId: "", customRolePreviousRole: "", updatedAt: new Date().toISOString() }, { merge: true });
      linkCheckerBulkAccessCache.delete(uid);
      auditDetails = { role };
    } else if (action === "set_subscription") {
      const subscriptionStatus = normalizeSubscriptionStatus(req.body?.subscriptionStatus);
      const monthlyRevenueCents = Math.max(0, Math.min(100_000_000, Number.parseInt(String(req.body?.monthlyRevenueCents || "0"), 10) || 0));
      const premium = hasPremiumSubscription(subscriptionStatus);
      const currentAdministration = targetAdministration?.data() || (await firebase.firestore.collection("nyxUserAdministration").doc(uid).get()).data() || {};
      const currentPremium = hasPremiumSubscription(currentAdministration.subscriptionStatus || currentAdministration.subscription?.status);
      const caffeineGrantId = premium && currentPremium
        ? String(currentAdministration.caffeineGrantId || randomBytes(12).toString("hex"))
        : (premium ? randomBytes(12).toString("hex") : "");
      await firebase.firestore.collection("nyxUserAdministration").doc(uid).set({
        subscriptionStatus,
        monthlyRevenueCents,
        subscriptionSource: "owner_dashboard",
        caffeineGrantId,
        caffeineReceivedGiftId: "",
        pendingCaffeineGift: null,
        subscriptionUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      linkCheckerBulkAccessCache.delete(uid);
      auditAction = "subscription_change";
      auditDetails = { subscriptionStatus, monthlyRevenueCents };
    } else if (action === "set_profile") {
      const profileRef = firebase.firestore.collection("nyxUserProfiles").doc(uid);
      const profileSnapshot = await profileRef.get();
      const profileToken = {
        uid,
        email: target.email,
        name: target.displayName,
        picture: target.photoURL
      };
      const previousProfile = normalizeNyxUserProfile(profileSnapshot.data()?.profile, profileToken);
      const requestedProfile = req.body?.profile && typeof req.body.profile === "object" ? req.body.profile : {};
      const editableFields = [
        "displayName", "handle", "bio", "customStatus", "status",
        "accentPrimary", "accentSecondary", "bannerColor",
        "displayNameFont", "displayNameEffect",
        "displayNameColorPrimary", "displayNameColorSecondary",
        "profileEffect", "avatarDecoration"
      ];
      const profileChanges = {};
      editableFields.forEach(field => {
        if (Object.prototype.hasOwnProperty.call(requestedProfile, field)) profileChanges[field] = requestedProfile[field];
      });
      if (Object.prototype.hasOwnProperty.call(requestedProfile, "avatarUrl")) profileChanges.avatarUrl = requestedProfile.avatarUrl;
      if (Object.prototype.hasOwnProperty.call(requestedProfile, "bannerUrl")) profileChanges.bannerUrl = requestedProfile.bannerUrl;
      if (req.body?.removeAvatar === true) profileChanges.avatarUrl = "";
      if (req.body?.removeBanner === true) profileChanges.bannerUrl = "";
      const nextProfile = normalizeNyxUserProfile({ ...previousProfile, ...profileChanges }, profileToken);
      const createdAt = String(profileSnapshot.data()?.createdAt || target.metadata?.creationTime || new Date().toISOString());
      const savedProfile = await saveNyxProfileWithUsername(firebase, profileToken, nextProfile, createdAt, previousProfile);
      await firebase.auth.updateUser(uid, {
        displayName: savedProfile.displayName,
        photoURL: /^https?:\/\//i.test(savedProfile.avatarUrl) ? savedProfile.avatarUrl : null
      });
      auditAction = "profile_updated_by_owner";
      auditDetails = {
        username: nyxProfileUsername(savedProfile.handle, ""),
        displayName: savedProfile.displayName,
        avatarRemoved: req.body?.removeAvatar === true,
        bannerRemoved: req.body?.removeBanner === true
      };
    } else if (action === "disable" || action === "enable" || action === "disable_with_ip_ban") {
      if (action === "disable_with_ip_ban" && !capabilities.canManageNetworkBans) {
        res.status(403).json({ error: "Your role cannot manage IP bans for that account." });
        return;
      }
      const disabled = action === "disable" || action === "disable_with_ip_ban";
      const moderationReason = founderProfileText(req.body?.reason, "", 180);
      const lastSeenIp = action === "disable_with_ip_ban" ? normalizeNyxIp(targetAdministration?.data()?.lastSeenIp) : "";
      if (action === "disable_with_ip_ban" && !lastSeenIp) {
        res.status(409).json({ error: "Nyx has not recorded an IP address for this account yet." });
        return;
      }
      if (action === "disable_with_ip_ban" && lastSeenIp === nyxClientIp(req)) {
        res.status(409).json({ error: "You cannot block the IP address currently managing Nyx." });
        return;
      }
      await firebase.auth.updateUser(uid, { disabled });
      if (disabled) await firebase.auth.revokeRefreshTokens(uid);
      if (action === "disable_with_ip_ban") {
        const banId = nyxIpBanId(lastSeenIp);
        const banReference = firebase.firestore.collection(nyxIpBanCollectionName).doc(banId);
        const existingBan = await banReference.get();
        const timestamp = new Date().toISOString();
        await banReference.set({
          ip: lastSeenIp,
          reason: founderProfileText(moderationReason ? `${moderationReason} — blocked with account ${String(target.email || uid).slice(0, 120)}` : `Blocked with account ${String(target.email || uid).slice(0, 120)}`, "Account IP ban", 240),
          createdAt: String(existingBan.data()?.createdAt || timestamp),
          createdBy: String(existingBan.data()?.createdBy || token.email || token.uid).slice(0, 254),
          updatedAt: timestamp,
          updatedBy: String(token.email || token.uid).slice(0, 254)
        }, { merge: true });
        cacheNyxIpBan(nyxIpBanRecord(banId, {
          ip: lastSeenIp,
          reason: founderProfileText(moderationReason ? `${moderationReason} — blocked with account ${String(target.email || uid).slice(0, 120)}` : `Blocked with account ${String(target.email || uid).slice(0, 120)}`, "Account IP ban", 240),
          createdAt: String(existingBan.data()?.createdAt || timestamp),
          createdBy: String(existingBan.data()?.createdBy || token.email || token.uid).slice(0, 254)
        }));
        auditAction = "account_disabled_with_ip_ban";
        auditDetails = { disabled: true, ip: lastSeenIp, ...(moderationReason ? { reason: moderationReason } : {}) };
      } else {
        auditAction = disabled ? "account_disabled" : "account_enabled";
        auditDetails = { disabled, ...(moderationReason ? { reason: moderationReason } : {}) };
      }
    } else if (action === "verify_email") {
      if (!nyxDeliverableEmail(target.email)) {
        res.status(409).json({ error: "Username-only Nyx accounts do not have a deliverable email to verify." });
        return;
      }
      await firebase.auth.updateUser(uid, { emailVerified: true });
      auditAction = "email_verified";
    } else if (action === "create_password_reset_link") {
      const resetLink = await firebase.auth.generatePasswordResetLink(String(target.email || ""));
      auditAction = "password_reset_link_created";
      auditDetails = { delivery: nyxDeliverableEmail(target.email) ? "manual_or_email" : "manual" };
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: token.email,
        action: auditAction,
        targetUid: uid,
        targetEmail: target.email,
        details: auditDetails
      });
      res.json({ resetLink });
      return;
    } else if (action === "send_password_reset") {
      if (!nyxDeliverableEmail(target.email)) {
        res.status(409).json({ error: "This username-only account has no recovery email. Firebase cannot deliver a reset message to it." });
        return;
      }
      const apiKey = linkGeneratorFirebaseConfig().webApiKey;
      if (!apiKey) {
        res.status(503).json({ error: "Firebase email actions are not configured." });
        return;
      }
      const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestType: "PASSWORD_RESET", email: target.email })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error?.message || "Firebase could not send the reset email.").replace(/_/g, " ").toLowerCase());
      auditAction = "password_reset_sent";
    } else if (action === "delete") {
      const profileRef = firebase.firestore.collection("nyxUserProfiles").doc(uid);
      const profileSnapshot = await profileRef.get();
      const username = nyxProfileUsername(profileSnapshot.data()?.profile?.handle, nyxProfileUsername(String(target.email || "").split("@")[0], ""));
      const usernameRef = username ? firebase.firestore.collection("nyxUsernames").doc(username) : null;
      const usernameSnapshot = usernameRef ? await usernameRef.get() : null;
      await firebase.auth.deleteUser(uid);
      const batch = firebase.firestore.batch();
      ["nyxUserProfiles", "nyxUserAdministration", "nyxUserActivity"].forEach(collectionName => {
        batch.delete(firebase.firestore.collection(collectionName).doc(uid));
      });
      if (usernameRef && usernameSnapshot?.exists && String(usernameSnapshot.data()?.ownerUid || "") === uid) batch.delete(usernameRef);
      await batch.commit();
      invalidateOwnerDashboardSnapshot();
      await recordNyxAuditSafe(firebase, {
        actorUid: token.uid,
        actorEmail: token.email,
        action: "account_deleted",
        targetUid: uid,
        targetEmail: target.email,
        details: { displayName: target.displayName || "" }
      });
      res.json({ deleted: true, uid });
      return;
    } else {
      res.status(400).json({ error: "That owner action is not supported." });
      return;
    }
    invalidateOwnerDashboardSnapshot();
    await recordNyxAuditSafe(firebase, {
      actorUid: token.uid,
      actorEmail: token.email,
      action: auditAction,
      targetUid: uid,
      targetEmail: target.email,
      details: auditDetails
    });
    const [updated, administration, profile, activity, customRoles] = await Promise.all([
      firebase.auth.getUser(uid),
      firebase.firestore.collection("nyxUserAdministration").doc(uid).get(),
      firebase.firestore.collection("nyxUserProfiles").doc(uid).get(),
      firebase.firestore.collection("nyxUserActivity").doc(uid).get(),
      nyxCustomRoles(firebase)
    ]);
    const updatedTargetRole = nyxRoleForUser(uid, administration.data(), ownerUid);
    const updatedCapabilities = nyxOwnerUserCapabilities(actor, updatedTargetRole, uid, ownerUid);
    const record = nyxOwnerUserForViewer(
      nyxOwnerUserRecord(updated, administration.data(), profile.data(), activity.data(), ownerUid, true, updatedCapabilities.canManageNetworkBans, customRoles),
      actor.uid,
      ownerUid
    );
    res.json({
      user: record,
      access: nyxOwnerAccessPayload(actor),
      customRoles: nyxVisibleCustomRoles(customRoles, actor.uid, ownerUid, actor.customRole),
      capabilities: updatedCapabilities
    });
  } catch (error) {
    const status = error.code === "auth/user-not-found" ? 404 : (error.status || 503);
    res.status(status).json({ error: status === 404 ? "User not found." : (error.message || "The owner action could not be completed.") });
  }
});

app.get("/api/founder-profile", async (_req, res) => {
  res.set("Cache-Control", "no-store");
  let profile = founderProfileDefaults;
  let persistent = false;
  try {
    const firebase = await linkGeneratorFirebase();
    if (firebase) {
      const snapshot = await firebase.firestore.collection("nyxSiteSettings").doc("founderProfile").get();
      profile = normalizeFounderProfile(snapshot.data()?.profile);
      const founderUid = founderProfileConfig().administratorUid;
      if (founderUid) {
        const founderUser = await firebase.firestore.collection("nyxUserProfiles").doc(founderUid).get();
        if (founderUser.exists) {
          const userProfile = normalizeNyxUserProfile(founderUser.data()?.profile);
          profile = normalizeFounderProfile({
            ...profile,
            displayName: userProfile.displayName,
            handle: userProfile.handle,
            bio: userProfile.bio,
            avatarUrl: userProfile.avatarUrl,
            bannerUrl: userProfile.bannerUrl,
            accent: userProfile.accentPrimary,
            accentPrimary: userProfile.accentPrimary,
            accentSecondary: userProfile.accentSecondary,
            bannerColor: userProfile.bannerColor,
            displayNameFont: userProfile.displayNameFont,
            displayNameEffect: userProfile.displayNameEffect,
            displayNameColorPrimary: userProfile.displayNameColorPrimary,
            displayNameColorSecondary: userProfile.displayNameColorSecondary,
            profileEffect: userProfile.profileEffect,
            customEffectPattern: userProfile.customEffectPattern,
            customEffectColorPrimary: userProfile.customEffectColorPrimary,
            customEffectColorSecondary: userProfile.customEffectColorSecondary,
            customEffectSpeed: userProfile.customEffectSpeed,
            customEffectIntensity: userProfile.customEffectIntensity,
            avatarDecoration: userProfile.avatarDecoration,
            status: userProfile.status
          });
        }
      }
      persistent = true;
    }
  } catch (error) {
    console.error("Nyx Founder Profile could not be read:", error?.message || error);
  }
  res.json({ profile, persistent, editingEnabled: Boolean(firebaseAdminModeConfigured() && founderProfileConfig().administratorUid) });
});

app.get("/api/founder-profile/auth-config", (_req, res) => {
  const firebase = linkGeneratorFirebaseConfig();
  res.set("Cache-Control", "no-store").json({
    enabled: firebaseAccountModeConfigured(),
    ownerConfigured: Boolean(founderProfileConfig().administratorUid),
    apiKey: firebaseAccountModeConfigured() ? firebase.webApiKey : "",
    projectId: firebaseAccountModeConfigured() ? firebase.projectId : ""
  });
});

app.get("/api/founder-profile/owner", async (req, res) => {
  const access = await verifiedFounderOwner(req);
  res.set("Cache-Control", "no-store").json(access);
});

app.get("/api/founder-profile/developer-status", async (req, res) => {
  const access = await verifiedFounderOwner(req);
  if (!access.enabled) return res.status(503).json({ error: "Founder ownership has not been configured." });
  if (!access.permissions.includes("developer-console")) return res.status(403).json({ error: "Developer Console access is required." });
  res.set("Cache-Control", "no-store").json({
    owner: access.owner,
    role: access.roleLabel,
    permissions: access.permissions,
    checkedAt: new Date().toISOString()
  });
});

app.put("/api/founder-profile", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const config = founderProfileConfig();
  if (!config.administratorUid || !firebaseAdminModeConfigured()) {
    res.status(503).json({ error: "Founder Profile ownership has not been configured by the Nyx administrator yet." });
    return;
  }
  const access = await verifiedFounderOwner(req);
  if (!access.owner) {
    res.status(403).json({ error: "Only the signed-in founder account can publish this profile." });
    return;
  }
  const profile = normalizeFounderProfile(req.body?.profile);
  try {
    const firebase = await linkGeneratorFirebase();
    if (!firebase) throw new Error("Firebase is unavailable.");
    await firebase.firestore.collection("nyxSiteSettings").doc("founderProfile").set({
      profile,
      updatedAt: new Date().toISOString()
    });
    res.json({ profile, persistent: true });
  } catch (error) {
    console.error("Nyx Founder Profile could not be saved:", error?.message || error);
    res.status(503).json({ error: "Founder Profile could not be saved right now. Try again shortly." });
  }
});

app.get("/api/link-generator/status", (_req, res) => {
  const config = linkGeneratorConfig();
  res.set("Cache-Control", "no-store").json({
    available: Boolean(config.apiKey && config.origin && (config.accessCode || firebaseAccountModeConfigured())),
    administratorAccess: Boolean(config.accessCode),
    accountAccess: firebaseAccountModeConfigured(),
    origin: config.origin,
    freeDailyLimit: freeLinkDailyLimit,
    premiumBatchLimit: config.premiumBatchLimit,
    premiumImmediateCooldownAt,
    premiumAccumulatedLimit,
    premiumCooldownMinutes: premiumCooldownMs / 60_000
  });
});

app.get("/api/link-generator/auth-config", (_req, res) => {
  const config = linkGeneratorFirebaseConfig();
  res.set("Cache-Control", "no-store").json({
    enabled: firebaseAccountModeConfigured(),
    apiKey: firebaseAccountModeConfigured() ? config.webApiKey : ""
  });
});

app.post("/api/link-generator/validate-access", (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }

  const config = linkGeneratorConfig();
  if (!config.accessCode) {
    res.status(503).json({ error: "Premium access has not been configured by the Nyx administrator yet." });
    return;
  }

  const submittedAccessCode = String(req.body?.accessCode || "");
  if (!submittedAccessCode) {
    res.status(400).json({ error: "Enter your Premium access code to continue." });
    return;
  }

  const now = Date.now();
  const rate = linkGeneratorRateState(linkGeneratorClientId(req), now);
  if (!secretMatches(submittedAccessCode, config.accessCode)) {
    rate.attempts += 1;
    if (rate.attempts > linkGeneratorMaxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + linkGeneratorWindowMs - now) / 1000));
      res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many incorrect access-code attempts. Try again later." });
      return;
    }
    res.status(401).json({ error: "The Premium access code is incorrect." });
    return;
  }

  rate.attempts = 0;
  res.json({ valid: true });
});

app.post("/api/link-generator/readiness", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }
  const config = linkGeneratorConfig();
  const target = generatedBunnyUrl(req.body?.url);
  if (!config.apiKey || !config.origin) {
    res.status(503).json({ error: "Link Generator has not been configured by the Nyx administrator yet." });
    return;
  }
  if (!target) {
    res.status(400).json({ error: "Only generated Nyx CDN links can be checked." });
    return;
  }
  try {
    const zonesPayload = await bunnyRequest("/pullzone?page=1&perPage=1000", config.apiKey);
    const zones = Array.isArray(zonesPayload) ? zonesPayload : Array.isArray(zonesPayload?.Items) ? zonesPayload.Items : [];
    const zone = zones.find(item => normalizedOrigin(item?.OriginUrl) === config.origin && Array.isArray(item?.Hostnames) && item.Hostnames.some(hostname => String(hostname?.Value || "").toLowerCase() === target.hostname.toLowerCase()));
    if (!zone) {
      res.status(404).json({ error: "That hostname is not a generated Nyx CDN link." });
      return;
    }
    if (zone.Suspended === true) {
      res.json({ ready: false, state: "suspended", message: "Bunny suspended this CDN link. Check the Bunny account balance and service limits." });
      return;
    }
    if (zone.Enabled === false) {
      res.json({ ready: false, state: "disabled", message: "Bunny left this CDN link disabled. Check the Bunny account balance and pull-zone limit." });
      return;
    }
    let response;
    try {
      response = await fetch(target.href, {
        headers: { Accept: "text/html", Range: "bytes=0-32767", "Cache-Control": "no-cache" },
        redirect: "manual",
        signal: AbortSignal.timeout(8_000)
      });
    } catch {
      res.json({ ready: false, state: "provisioning", message: "Bunny is still connecting this link to Nyx." });
      return;
    }
    const sample = (await response.text()).slice(0, 40_000);
    const bunnyPlaceholder = /This server is a part of a CDN service provided by|Server Node:\s*[A-Z0-9-]+/i.test(sample);
    if (!response.ok || bunnyPlaceholder) {
      res.json({ ready: false, state: "provisioning", message: "Bunny is still provisioning this link. It will open after the CDN begins serving Nyx." });
      return;
    }
    res.json({ ready: true, state: "ready", message: "The CDN link is serving Nyx." });
  } catch (error) {
    res.status(error.status || 502).json({ error: error.status ? error.message : `Bunny readiness check failed: ${String(error?.message || "Unknown error")}` });
  }
});

app.post("/api/link-generator", async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (!sameOriginRequest(req)) {
    res.status(403).json({ error: "Cross-origin requests are not allowed." });
    return;
  }

  const config = linkGeneratorConfig();
  if (!config.apiKey || !config.origin || (!config.accessCode && !firebaseAccountModeConfigured())) {
    res.status(503).json({ error: "Link Generator has not been configured by the Nyx administrator yet." });
    return;
  }

  const clientId = linkGeneratorClientId(req);
  const now = Date.now();
  const rate = linkGeneratorRateState(clientId, now);
  const submittedAccessCode = String(req.body?.accessCode || "");
  const administrator = Boolean(submittedAccessCode && config.accessCode && secretMatches(submittedAccessCode, config.accessCode));
  if (submittedAccessCode && !administrator) {
    rate.attempts += 1;
    if (rate.attempts > linkGeneratorMaxAttempts) {
      const retryAfter = Math.max(1, Math.ceil((rate.windowStarted + linkGeneratorWindowMs - now) / 1000));
      res.set("Retry-After", String(retryAfter)).status(429).json({ error: "Too many incorrect access-code attempts. Try again later." });
      return;
    }
    res.status(401).json({ error: "The Premium access code is incorrect." });
    return;
  }

  let publicUser = null;
  try {
    if (!administrator) publicUser = await authenticatedLinkGeneratorUser(req);
  } catch (error) {
    res.status(error.status || 401).json({ error: error.message });
    return;
  }

  const premiumAccount = Boolean(publicUser?.premiumAccess);
  const premiumAccess = administrator || premiumAccount;
  const rawAmount = req.body?.amount === undefined ? 1 : Number(req.body.amount);
  const amount = premiumAccess ? rawAmount : 1;
  if (premiumAccess && (!Number.isInteger(rawAmount) || rawAmount < 1 || rawAmount > config.premiumBatchLimit)) {
    res.status(400).json({ error: `Premium batches can contain between 1 and ${config.premiumBatchLimit} links.` });
    return;
  }

  let reservation = null;
  let premiumReservation = null;
  let premiumFirebase = null;
  try {
    const zonesPayload = await bunnyRequest("/pullzone?page=1&perPage=1000", config.apiKey);
    const zones = Array.isArray(zonesPayload) ? zonesPayload : Array.isArray(zonesPayload?.Items) ? zonesPayload.Items : [];
    const generatedZones = zones.filter(zone => normalizedOrigin(zone?.OriginUrl) === config.origin);
    if (!premiumAccess && generatedZones.length >= config.maxZones) {
      res.status(409).json({ error: "The public Link Generator has reached its zone limit. Ask the Nyx administrator to remove an old generated link." });
      return;
    }

    if (publicUser && !premiumAccount) reservation = await reserveFreeLink(publicUser.firebase, publicUser.uid, clientId);
    if (premiumAccess) {
      premiumFirebase = publicUser?.firebase || await linkGeneratorFirebase();
      const premiumIdentity = premiumAccount ? `account:${publicUser.uid}` : clientId;
      premiumReservation = await reservePremiumGeneration(premiumFirebase, premiumIdentity, amount, now);
    }

    const links = [];
    let generationError = null;
    for (let index = 0; index < amount; index += 1) {
      try {
        const name = generatedPullZoneName(req.body?.label);
        const zone = await bunnyRequest("/pullzone", config.apiKey, {
          method: "POST",
          body: JSON.stringify({ Name: name, OriginUrl: config.origin })
        });
        const systemHostname = Array.isArray(zone?.Hostnames)
          ? zone.Hostnames.find(item => item?.IsSystemHostname)?.Value || zone.Hostnames[0]?.Value
          : "";
        if (!systemHostname) throw new Error("Bunny created the zone but did not return its hostname.");
        links.push({ id: zone.Id, name: zone.Name || name, url: `https://${systemHostname}` });
      } catch (error) {
        generationError = error;
        break;
      }
    }
    if (!links.length && generationError) throw generationError;
    if (premiumAccess && premiumReservation && links.length < amount) {
      premiumReservation = await adjustPremiumGeneration(premiumFirebase, premiumReservation, links.length);
    }
    const first = links[0];
    res.status(generationError ? 207 : 201).json({
      id: first.id,
      name: first.name,
      url: first.url,
      links,
      requested: amount,
      created: links.length,
      partial: Boolean(generationError),
      warning: generationError ? `Bunny stopped the batch after ${links.length} of ${amount} links: ${generationError.message}` : "",
      origin: config.origin,
      access: administrator ? "administrator" : (premiumAccount ? "premium" : "account"),
      subscriptionStatus: publicUser?.subscriptionStatus || (administrator ? "premium" : "free"),
      remaining: premiumAccess ? null : reservation?.remaining,
      premiumCooldown: premiumAccess ? {
        triggered: Boolean(premiumReservation?.cooldownTriggered),
        cooldownUntil: premiumReservation?.cooldownUntil || 0,
        accumulated: premiumReservation?.accumulated || 0,
        accumulatedLimit: premiumAccumulatedLimit,
        immediateAt: premiumImmediateCooldownAt,
        minutes: premiumCooldownMs / 60_000
      } : null
    });
  } catch (error) {
    if (publicUser && reservation) await releaseFreeLink(publicUser.firebase, reservation);
    if (premiumAccess && premiumReservation) await adjustPremiumGeneration(premiumFirebase, premiumReservation, 0);
    if (!error.status || error.status >= 500) console.error("Nyx Link Generator failed:", error?.message || error);
    if (error.retryAfter) res.set("Retry-After", String(error.retryAfter));
    res.status(error.status || 502).json({ error: error.status ? error.message : `Bunny could not create the link: ${String(error?.message || "Unknown error")}` });
  }
});
app.use((error, req, res, next) => {
  if (!String(req.path || "").startsWith("/api/")) {
    next(error);
    return;
  }
  const tooLarge = error?.type === "entity.too.large" || Number(error?.status || error?.statusCode) === 413;
  res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? "That upload chunk is too large." : "The API request could not be processed." });
});

app.use(express.static(staticRoot));
app.use("/uv/", express.static(uvPath));
app.use("/scramjet/", express.static(scramjetPath));
app.use("/controller/", express.static(scramjetControllerPath));
app.use("/baremux/", express.static(baremuxPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/libcurl/", express.static(libcurlPath));

app.use("/~/sj/", (_req, res) => {
  res.status(502).type("html").send(`<!doctype html>
<meta charset="utf-8">
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#101318;color:#f5f7fb;font:15px/1.45 Raleway,Arial,sans-serif}
  main{max-width:560px;padding:28px;text-align:center}
  h1{font-size:20px;margin:0 0 10px}
  p{margin:0;color:#c8ced8}
  button{margin-top:18px;border:1px solid #445066;border-radius:10px;background:#1b2230;color:#f5f7fb;padding:10px 15px;font:600 14px Raleway,Arial,sans-serif;cursor:pointer}
</style>
<main>
  <h1>Reconnecting Scramjet</h1>
  <p>Nyx is reconnecting this tab to the proxy service worker.</p>
  <button type="button" onclick="location.reload()">Retry now</button>
</main>
<script>
  (() => {
    const key='nyx.scramjet-claim-retry:'+location.pathname;
    const attempts=Number(sessionStorage.getItem(key)||0);
    if(attempts<2){
      sessionStorage.setItem(key,String(attempts+1));
      setTimeout(()=>location.reload(),900);
    }else{
      sessionStorage.removeItem(key);
    }
  })();
</script>`);
});

app.use((req, res, next) => {
  const path = String(req.path || "");
  const shouldNotServeNyx =
    path.startsWith("/assets/") ||
    path.startsWith("/games/") ||
    path.startsWith("/images/") ||
    path.startsWith("/js/") ||
    path.startsWith("/css/") ||
    /\.(?:avif|bmp|css|gif|html?|ico|jpe?g|js|json|mjs|mp3|mp4|ogg|opus|png|svg|wasm|wav|webm|webp|woff2?|xml)$/i.test(path);
  if (!shouldNotServeNyx) {
    next();
    return;
  }
  res.status(404).type("text/plain").send("Not found");
});

app.use((_req, res) => {
  res.sendFile(join(staticRoot, "index.html"));
});

export { app, attachNyxChatSocketServer, externalWispUrl, normalizePublicWispUrl, nyxActorCanReviewSearchHistory, nyxRolePresentation, nyxVisibleCustomRoles };

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === join(__dirname, "server.js");
if (isDirectRun) {
  const server = createServer((req, res) => app(req, res));
  const chatSocketServer = attachNyxChatSocketServer(server);

  server.on("upgrade", async (req, socket, head) => {
    const upgradePath = new URL(req.url || "/", "http://localhost").pathname;
    if (upgradePath === "/socket.io/" || upgradePath.startsWith("/socket.io/")) {
      return;
    }
    if (!externalWispUrl && (upgradePath === "/wisp/" || upgradePath === "/wisp")) {
      if (!embeddedWispOriginAllowed(req.headers.origin, req.headers.host)) {
        rejectWispUpgrade(socket);
        return;
      }
      try {
        if (await nyxRequestIpIsBanned(req)) {
          rejectWispUpgrade(socket);
          return;
        }
      } catch (error) {
        console.error("Nyx Wisp IP ban check could not be completed:", error?.message || error);
      }
      if (socket.destroyed) return;
      wisp.routeRequest(req, socket, head);
    } else {
      rejectWispUpgrade(socket, "404 Not Found");
    }
  });

  const port = Number.parseInt(process.env.PORT || "8080", 10);

  server.listen(port, "0.0.0.0", () => {
    const address = server.address();
    console.log("nyx running with Ultraviolet and Scramjet:");
    console.log(`  http://localhost:${address.port}`);
    console.log(`  http://${hostname()}:${address.port}`);
    console.log(`  wisp transport: ${externalWispUrl || "same-host /wisp/"}`);
    console.log("  chat realtime: same-host /socket.io/");
    console.log(`  static root: ${staticRoot}`);
    if (!externalWispUrl) console.log(embeddedWispAllowedOrigins.length ? `  allowed Wisp origins: ${embeddedWispAllowedOrigins.join(", ")}` : "  warning: embedded Wisp accepts every browser origin");
    const mediaWarmup = setTimeout(() => {
      void nyxifyPreferredSearch("global hits", 20).catch(() => {});
    }, 250);
    mediaWarmup.unref();
  });

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing nyx server.`);
    chatSocketServer.disconnectSockets(true);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  }
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
}
