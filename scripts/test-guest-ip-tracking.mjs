import assert from "node:assert/strict";
import { nyxActiveGuestUsers, nyxClientIp, recordLocalPresence } from "../server.js";

const now = Date.now();
process.env.NYX_TRUST_PROXY = "true";
assert.equal(nyxClientIp({
  get: name => name === "cf-connecting-ip" ? "198.51.100.19" : "",
  socket: { remoteAddress: "127.0.0.1" }
}), "198.51.100.19", "Trusted proxy client IP was not selected");

recordLocalPresence("guest-network-test-1234", "", "Network Guest", now, "203.0.113.24");

const protectedView = await nyxActiveGuestUsers(null, now, false);
const protectedGuest = protectedView.find(user => user.displayName === "Network Guest");
assert.ok(protectedGuest, "The active guest was not recorded");
assert.equal(protectedGuest.lastSeenIp, "", "Guest IP leaked without network-ban permission");
assert.equal(protectedGuest.lastSeenIpAt, "", "Guest IP timestamp leaked without network-ban permission");

const networkView = await nyxActiveGuestUsers(null, now, true);
const networkGuest = networkView.find(user => user.displayName === "Network Guest");
assert.equal(networkGuest?.lastSeenIp, "203.0.113.24", "Authorized network view did not receive the guest IP");
assert.equal(networkGuest?.lastSeenIpAt, new Date(now).toISOString(), "Authorized network view did not receive the IP timestamp");

recordLocalPresence("signed-in-test-12345", "account-user-123", "Signed In", now, "203.0.113.25");
const afterAccountHeartbeat = await nyxActiveGuestUsers(null, now, true);
assert.equal(afterAccountHeartbeat.some(user => user.displayName === "Signed In"), false, "Signed-in presence appeared as a guest");

console.log("Guest IP tracking test: authorized visibility, privacy boundary, and account exclusion passed");
