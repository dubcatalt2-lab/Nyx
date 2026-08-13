(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const ownerRoleLabels = Object.freeze({
    owner: "Owner",
    co_owner: "Co-owner",
    admin: "Admin",
    manager: "Manager",
    developer: "Developer",
    moderator: "Moderator",
    support: "Support",
    tester: "Tester",
    contributor: "Contributor",
    member: "Member",
    guest: "Guest"
  });
  const ownerRoleIcons = Object.freeze({ co_owner: "owner", manager: "admin", support: "moderator", tester: "developer", contributor: "developer", guest: "member" });
  const ownerAssignableRoles = Object.freeze(["member", "contributor", "tester", "support", "moderator", "developer", "manager", "admin", "co_owner"]);
  const roleLabel = value => ownerRoleLabels[value] || "Member";
  const userRoleLabel = user => user?.customRole?.label || roleLabel(user?.role);
  const userRoleColor = user => /^#[0-9a-f]{6}$/i.test(String(user?.customRole?.color || "")) ? user.customRole.color : "";
  const roleIcon = role => `<img class="nyx-owner-role-icon" src="/assets/icons/roles/${esc(ownerRoleIcons[role] || role)}.png" alt="" aria-hidden="true">`;
  const roleOptions = (currentRole, allowedRoles = []) => {
    const allowed = new Set(allowedRoles);
    const roles = ownerAssignableRoles.filter(role => allowed.has(role) || role === currentRole);
    return `<div class="nyx-owner-role-options" role="radiogroup" aria-label="Account role">${roles.map(role => `<button class="role-${esc(role)}${currentRole === role ? " active" : ""}" type="button" role="radio" aria-checked="${currentRole === role}" data-owner-role-option="${esc(role)}" ${allowed.has(role) ? "" : "disabled"}>${roleIcon(role)}<span>${esc(roleLabel(role))}</span></button>`).join("")}${currentRole === "owner" ? `<button class="role-owner active" type="button" role="radio" aria-checked="true" disabled>${roleIcon("owner")}<span>Owner</span></button>` : ""}</div>`;
  };
  const syncRoleOptions = (root, selectedRole) => root?.querySelectorAll?.("[data-owner-role-option]").forEach(button => {
    const active = button.dataset.ownerRoleOption === selectedRole;
    button.classList.toggle("active", active);
    button.setAttribute("aria-checked", String(active));
  });
  const subscriptionLabel = value => ({
    none: "No account", free: "Free", premium: "Premium", trialing: "Trial", past_due: "Past due", canceled: "Canceled"
  }[value] || "Free");
  const actionLabel = value => String(value || "").replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
  const dateLabel = value => {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "Never" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
  };
  const relativeLabel = value => {
    const time = Date.parse(value || "");
    if (!time) return "Never";
    const seconds = Math.round((time - Date.now()) / 1000);
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
    return formatter.format(Math.round(hours / 24), "day");
  };
  const moneyLabel = cents => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
  const activityDayLabel = value => {
    const date = new Date(value || "");
    if (Number.isNaN(date.getTime())) return "Recent";
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const difference = Math.round((startOfToday - startOfEvent) / 86400000);
    if (difference === 0) return "Today";
    if (difference === 1) return "Yesterday";
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  };
  const activityIconName = action => {
    const value = String(action || "").toLowerCase();
    if (/(sign.?in|login|session|online)/.test(value)) return "online";
    if (/(sign.?up|create|invite|register)/.test(value)) return "signup";
    if (/(premium|subscription|payment|revenue|billing)/.test(value)) return "premium";
    if (/(user|account|profile|role)/.test(value)) return "users";
    return "activity";
  };
  const ownerProfileImageDataLimit = 850_000;
  const ownerProfileMediaDataLimit = 11_250_000;
  const ownerProfileMediaPlaceholder = "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";
  const ownerProfileMediaResolved = new Map();
  const ownerProfileMediaPending = new Map();

  function ownerProfileMediaPath(value) {
    const source = String(value || "").trim();
    return /^\/api\/profile-media\/[A-Za-z0-9_-]{8,128}\/(?:avatar|banner)\/[A-Za-z0-9_-]{12,80}$/.test(source) ? source : "";
  }

  async function resolveOwnerProfileMedia(source) {
    const path = ownerProfileMediaPath(source);
    if (!path) return null;
    if (ownerProfileMediaResolved.has(path)) return ownerProfileMediaResolved.get(path);
    if (ownerProfileMediaPending.has(path)) return ownerProfileMediaPending.get(path);
    const pending = (async () => {
      const manifestResponse = await fetch(`${path}/manifest`, { cache: "force-cache" });
      const manifest = await manifestResponse.json().catch(() => ({}));
      const mime = String(manifest.mime || "").toLowerCase();
      const totalChunks = Number(manifest.totalChunks || 0);
      if (!manifestResponse.ok || !/^image\/(?:gif|png|jpeg|webp)$/.test(mime) || !Number.isInteger(totalChunks) || totalChunks < 1 || totalChunks > 32) {
        throw new Error("That saved profile image is unavailable.");
      }
      const encodedChunks = await Promise.all(Array.from({ length: totalChunks }, async (_, index) => {
        const response = await fetch(`${path}/chunks/${index}`, { cache: "force-cache" });
        const encoded = (await response.text()).trim();
        if (!response.ok || !encoded || !/^[a-z0-9+/=]+$/i.test(encoded)) throw new Error("That saved profile image is incomplete.");
        return encoded;
      }));
      const parts = encodedChunks.map(encoded => {
        const decoded = atob(encoded);
        const bytes = new Uint8Array(decoded.length);
        for (let index = 0; index < decoded.length; index += 1) bytes[index] = decoded.charCodeAt(index);
        return bytes;
      });
      const blob = new Blob(parts, { type: mime });
      if (Number(manifest.byteLength || 0) > 0 && blob.size !== Number(manifest.byteLength)) {
        throw new Error("That saved profile image did not pass its size check.");
      }
      const result = { url: URL.createObjectURL(blob), mime, size: blob.size };
      ownerProfileMediaResolved.set(path, result);
      return result;
    })().finally(() => ownerProfileMediaPending.delete(path));
    ownerProfileMediaPending.set(path, pending);
    return pending;
  }

  function ownerProfileImageMarkup(source, alt = "", fallback = "") {
    const path = ownerProfileMediaPath(source);
    if (path) return `<img src="${ownerProfileMediaPlaceholder}" data-owner-profile-media="${esc(path)}" data-owner-media-fallback="${esc(fallback)}" alt="${esc(alt)}">`;
    return source ? `<img src="${esc(source)}" alt="${esc(alt)}">` : esc(fallback);
  }

  async function hydrateOwnerProfileMedia(root) {
    const images = [...(root?.querySelectorAll?.("img[data-owner-profile-media]") || [])];
    await Promise.all(images.map(async image => {
      const fallback = String(image.dataset.ownerMediaFallback || "");
      try {
        const media = await resolveOwnerProfileMedia(image.dataset.ownerProfileMedia);
        if (media && image.isConnected) image.src = media.url;
      } catch {
        if (!image.isConnected) return;
        if (fallback) image.replaceWith(document.createTextNode(fallback));
        else image.remove();
      }
    }));
  }

  function readOwnerProfileFile(file, errorMessage) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error(errorMessage));
      reader.readAsDataURL(file);
    });
  }

  async function prepareOwnerProfileImage(file, maxWidth, maxHeight) {
    if (!file || !/^image\/(?:png|jpe?g|webp|gif)$/i.test(String(file.type || ""))) {
      throw new Error("Choose a PNG, JPG, WebP, or GIF image.");
    }
    if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB.");
    if (/^image\/gif$/i.test(String(file.type || ""))) {
      const signature = await file.slice(0, 6).text();
      if (!/^GIF8[79]a$/.test(signature)) throw new Error("That file is not a valid GIF.");
      const dataUrl = await readOwnerProfileFile(file, "That GIF could not be opened.");
      if (!/^data:image\/gif;base64,/i.test(dataUrl) || dataUrl.length > ownerProfileMediaDataLimit) {
        throw new Error("Choose a valid GIF smaller than 8 MB.");
      }
      return dataUrl;
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const preview = new Image();
        preview.onload = () => resolve(preview);
        preview.onerror = () => reject(new Error("That image could not be opened."));
        preview.src = objectUrl;
      });
      let scale = Math.min(1, maxWidth / Math.max(1, image.naturalWidth), maxHeight / Math.max(1, image.naturalHeight));
      for (let pass = 0; pass < 4; pass += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/webp", Math.max(0.52, 0.86 - pass * 0.1));
        if (dataUrl.length <= ownerProfileImageDataLimit) return dataUrl;
        scale *= 0.72;
      }
      throw new Error("That image is too detailed to save. Try a smaller image.");
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  let activeDashboard = null;

  function closeExisting() {
    activeDashboard?.destroy?.();
    activeDashboard = null;
  }

  function dashboardIcon(name) {
    const paths = {
      users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      active: '<path d="M3 12h4l2.5-7 5 14 2.5-7h4"/>',
      online: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
      signup: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8" cy="7" r="4"/><path d="M19 8v6M16 11h6"/>',
      premium: '<path d="m12 3 3 6 6 .9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.9 9 9l3-6Z"/>',
      revenue: '<circle cx="12" cy="12" r="9"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8M12 5v14"/>',
      search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
      refresh: '<path d="M20 11a8 8 0 1 0-2.35 5.65"/><path d="M20 4v7h-7"/>',
      download: '<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 21h14"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      chevron: '<path d="m9 18 6-6-6-6"/>',
      activity: '<path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/>',
      shield: '<path d="M12 3 4.5 6v5c0 4.7 3.1 8.9 7.5 10 4.4-1.1 7.5-5.3 7.5-10V6L12 3Z"/><path d="m9 12 2 2 4-4"/>',
      key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l3 3M18 5l2 2"/>',
      mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      userOff: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 0 0 2.9-6.8M3 3l18 18"/>',
      userCheck: '<path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M8 11a4 4 0 1 0 0-8M16 11l2 2 4-4"/>',
      ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M18 7l-1 14H7L6 7M10 11v6M14 11v6"/>',
      save: '<path d="M5 3h12l2 2v16H5z"/><path d="M8 3v6h8V3M8 21v-7h8v7"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
  }

  function createDashboard({ getToken, toast: externalToast } = {}) {
    if (typeof getToken !== "function") throw new Error("Owner authentication is unavailable.");
    const state = {
      page: 1,
      pageSize: 25,
      search: "",
      role: "all",
      subscription: "all",
      status: "all",
      segment: "all",
      sort: "createdAt",
      direction: "desc",
      data: null,
      access: null,
      loading: false,
      controller: null,
      searchTimer: 0,
      selectedUser: null,
      selectedCapabilities: null,
      ipBans: [],
      ipBanClientIp: "",
      customRoles: [],
      customRolePlacements: [],
      customRolePermissions: [],
      customRoleEditorId: ""
    };
    const overlay = document.createElement("section");
    overlay.className = "nyx-owner-dashboard-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "nyxOwnerDashboardTitle");
    overlay.innerHTML = `
      <main class="nyx-owner-dashboard">
        <header class="nyx-owner-header">
          <div><span class="nyx-owner-eyebrow">${dashboardIcon("shield")}NYX ADMINISTRATION</span><h1 id="nyxOwnerDashboardTitle">Owner Dashboard</h1><p data-owner-access-copy>Loading your role permissions…</p></div>
          <div class="nyx-owner-header-actions">
            <button type="button" data-owner-refresh>${dashboardIcon("refresh")}<span>Refresh</span></button>
            <button class="nyx-owner-close" type="button" data-owner-close aria-label="Close owner dashboard">${dashboardIcon("close")}</button>
          </div>
        </header>
        <section class="nyx-owner-metrics" data-owner-metrics aria-label="Account metrics"></section>
        <section class="nyx-owner-workspace">
          <div class="nyx-owner-users-panel">
            <header class="nyx-owner-panel-head">
              <div><h2>${dashboardIcon("users")}Users</h2><span data-owner-user-count>Loading accounts…</span></div>
              <div class="nyx-owner-quick-actions">
                <button type="button" data-owner-online-only>${dashboardIcon("online")}Online users</button>
                <button type="button" data-owner-export>${dashboardIcon("download")}Export page</button>
                <button type="button" data-owner-custom-roles hidden>${dashboardIcon("users")}Custom roles</button>
                <button type="button" data-owner-ip-bans hidden>${dashboardIcon("shield")}IP bans</button>
              </div>
            </header>
            <form class="nyx-owner-filters" data-owner-filters>
              <label class="nyx-owner-search">${dashboardIcon("search")}<input type="search" name="search" placeholder="Search name, username, email, or UID" autocomplete="off"></label>
              <select name="role" aria-label="Filter by role"><option value="all">All roles</option><option value="guest">Guest</option><option value="owner">Owner</option><option value="co_owner">Co-owner</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="developer">Developer</option><option value="moderator">Moderator</option><option value="support">Support</option><option value="tester">Tester</option><option value="contributor">Contributor</option><option value="member">Member</option></select>
              <select name="subscription" aria-label="Filter by subscription"><option value="all">All subscriptions</option><option value="none">No account</option><option value="free">Free</option><option value="premium">Premium</option><option value="trialing">Trial</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select>
              <select name="status" aria-label="Filter by account status"><option value="all">All accounts</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="online">Online now</option><option value="offline">Offline</option></select>
            </form>
            <div class="nyx-owner-table-wrap" data-owner-table aria-live="polite"></div>
            <footer class="nyx-owner-pagination" data-owner-pagination></footer>
          </div>
          <aside class="nyx-owner-activity-panel">
            <header><div><h2>${dashboardIcon("activity")}Activity logs</h2><span>Security and account events</span></div></header>
            <div class="nyx-owner-activity-list" data-owner-activity></div>
          </aside>
        </section>
      </main>
      <aside class="nyx-owner-user-drawer" data-owner-user-drawer hidden></aside>
      <section class="nyx-owner-confirm" data-owner-confirm hidden></section>
      <div class="nyx-owner-toasts" data-owner-toasts aria-live="polite"></div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));

    const metricsHost = overlay.querySelector("[data-owner-metrics]");
    const tableHost = overlay.querySelector("[data-owner-table]");
    const paginationHost = overlay.querySelector("[data-owner-pagination]");
    const activityHost = overlay.querySelector("[data-owner-activity]");
    const drawer = overlay.querySelector("[data-owner-user-drawer]");
    const confirmHost = overlay.querySelector("[data-owner-confirm]");

    function notify(message, type = "success") {
      externalToast?.(message);
      const item = document.createElement("div");
      item.className = `nyx-owner-toast nyx-owner-toast-${type}`;
      item.textContent = message;
      overlay.querySelector("[data-owner-toasts]").appendChild(item);
      requestAnimationFrame(() => item.classList.add("show"));
      setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 180); }, 3200);
    }

    async function api(path, options = {}) {
      const token = await getToken();
      if (!token) throw new Error("Your staff session has expired. Sign in again.");
      const response = await fetch(path, {
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {})
        },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload.error || "The owner request failed.");
        error.status = response.status;
        throw error;
      }
      return payload;
    }

    async function uploadProfileMedia(uid, kind, dataUrl, onProgress = () => {}) {
      const match = String(dataUrl || "").match(/^data:(image\/(?:gif|png|jpeg|webp));base64,([a-z0-9+/=]+)$/i);
      if (!match) throw new Error(`The selected ${kind} could not be prepared.`);
      if (dataUrl.length > ownerProfileMediaDataLimit) throw new Error("Choose an image smaller than 8 MB.");
      const encoded = match[2];
      const chunks = [];
      for (let offset = 0; offset < encoded.length; offset += 420_000) chunks.push(encoded.slice(offset, offset + 420_000));
      if (!chunks.length || chunks.length > 32) throw new Error("That image is too large to upload.");
      const uploadId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-z0-9_-]/gi, "");
      const base = `/api/owner-dashboard/users/${encodeURIComponent(uid)}/profile-media/${kind}/${uploadId}`;
      for (let index = 0; index < chunks.length; index += 1) {
        onProgress(Math.round((index / chunks.length) * 90));
        await api(`${base}/${index}`, {
          method: "PUT",
          body: JSON.stringify({ mime: match[1].toLowerCase(), totalChunks: chunks.length, chunk: chunks[index] })
        });
      }
      const data = await api(`${base}/complete`, { method: "POST", body: "{}" });
      if (!data.url) throw new Error(`The ${kind} image could not be completed.`);
      onProgress(100);
      return data.url;
    }

    function renderLoading() {
      metricsHost.innerHTML = Array.from({ length: 6 }, () => '<article class="nyx-owner-metric loading"><i></i><div><span></span><strong></strong></div></article>').join("");
      tableHost.innerHTML = '<div class="nyx-owner-table-loading"><i></i><i></i><i></i><i></i><i></i></div>';
      activityHost.innerHTML = '<div class="nyx-owner-activity-loading"><i></i><i></i><i></i><i></i></div>';
    }

    function renderMetrics(metrics = {}) {
      const definitions = [
        ["users", "Total users", metrics.totalUsers ?? 0, "all"],
        ["active", "Active today", metrics.activeToday ?? 0, "active_today"],
        ["online", "Online now", metrics.onlineUsers ?? 0, "online"],
        ["signup", "New signups · 7d", metrics.newSignups ?? 0, "new_7d"],
        ["premium", "Premium", metrics.premiumSubscribers ?? 0, "premium"],
        ["revenue", "Monthly revenue", moneyLabel(metrics.monthlyRevenueCents), "revenue"]
      ];
      metricsHost.innerHTML = definitions.map(([icon, label, value, segment]) => {
        const active = state.segment === segment;
        return `<button class="nyx-owner-metric${active ? " active" : ""}" type="button" data-owner-segment="${segment}" aria-pressed="${active}" aria-label="Show ${esc(label)}">${dashboardIcon(icon)}<div><span>${esc(label)}</span><strong>${esc(value)}</strong></div></button>`;
      }).join("");
    }

    function sortButton(key, label) {
      const active = state.sort === key;
      return `<button type="button" data-owner-sort="${key}" class="${active ? "active" : ""}">${label}${active ? `<span aria-label="${state.direction === "asc" ? "ascending" : "descending"}">${state.direction === "asc" ? "↑" : "↓"}</span>` : ""}</button>`;
    }

    function renderUsers(data) {
      const users = data.users || [];
      const pagination = data.pagination || {};
      const accounts = Number(pagination.accounts ?? pagination.scanned ?? 0);
      const guests = Number(pagination.guests || 0);
      overlay.querySelector("[data-owner-user-count]").textContent = `${Number(pagination.total || 0).toLocaleString()} matching · ${accounts.toLocaleString()} accounts · ${guests.toLocaleString()} guest${guests === 1 ? "" : "s"} online${pagination.truncated ? " (scan capped)" : ""}`;
      if (!users.length) {
        tableHost.innerHTML = '<div class="nyx-owner-empty"><strong>No users found</strong><span>Try changing the search or filters.</span></div>';
      } else {
        tableHost.innerHTML = `<table class="nyx-owner-table">
          <thead><tr><th>${sortButton("displayName", "User")}</th><th>${sortButton("role", "Role")}</th><th>${sortButton("subscriptionStatus", "Subscription")}</th><th>${sortButton("createdAt", "Created")}</th><th>${sortButton("lastSignInAt", "Last sign-in")}</th><th>${sortButton("lastActiveAt", "Last active")}</th><th>Email verified</th><th>${sortButton("status", "Status")}</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${users.map(user => {
            const guest = Boolean(user.guest);
            const canReviewSearches = !guest && user.canReviewSearchHistory === true;
            return `<tr data-owner-user-row="${esc(user.uid)}"${guest ? ' data-owner-guest-row="true"' : ""}>
            <td><div class="nyx-owner-user-entry"><button class="nyx-owner-user-cell" type="button" data-owner-view-user="${esc(user.uid)}"><span class="nyx-owner-avatar">${ownerProfileImageMarkup(user.photoUrl, "", (user.displayName || "?").slice(0, 1).toUpperCase())}<i class="${user.online ? "online" : ""}"></i></span><span><span class="nyx-owner-user-name-row"><strong>${esc(user.displayName)}</strong><span class="nyx-owner-presence-state ${user.online ? "online" : "offline"}"><i></i>${user.online ? "Online" : "Offline"}</span></span><small>@${esc(user.username)} · ${esc(user.email || (guest ? "No account" : "No email"))}</small><span class="nyx-owner-mobile-access"><span class="nyx-owner-badge role-${esc(user.role)}${user.customRole ? " custom-role" : ""}"${userRoleColor(user) ? ` style="--owner-custom-role:${esc(userRoleColor(user))}"` : ""}>${roleIcon(user.role)}${esc(userRoleLabel(user))}</span><span class="nyx-owner-badge subscription-${esc(user.subscriptionStatus)}">${esc(subscriptionLabel(user.subscriptionStatus))}</span></span></span></button>${canReviewSearches ? `<button class="nyx-owner-search-shield" type="button" data-owner-search-history="${esc(user.uid)}" aria-label="Review search history for ${esc(user.displayName)}" title="Review search history">${dashboardIcon("shield")}</button>` : ""}</div></td>
            <td><span class="nyx-owner-badge role-${esc(user.role)}${user.customRole ? " custom-role" : ""}"${userRoleColor(user) ? ` style="--owner-custom-role:${esc(userRoleColor(user))}"` : ""}>${roleIcon(user.role)}${esc(userRoleLabel(user))}</span></td>
            <td><span class="nyx-owner-badge subscription-${esc(user.subscriptionStatus)}">${esc(subscriptionLabel(user.subscriptionStatus))}</span></td>
            <td><span title="${esc(dateLabel(user.createdAt))}">${esc(relativeLabel(user.createdAt))}</span></td>
            <td><span title="${esc(guest ? "No account" : dateLabel(user.lastSignInAt))}">${esc(guest ? "Not signed in" : relativeLabel(user.lastSignInAt))}</span></td>
            <td><span title="${esc(dateLabel(user.lastActiveAt))}">${esc(relativeLabel(user.lastActiveAt))}</span></td>
            <td><span class="nyx-owner-verified ${user.deliverableEmail && user.emailVerified ? "verified" : ""}">${guest ? "Guest" : (user.deliverableEmail ? (user.emailVerified ? "Verified" : "Unverified") : "N/A")}</span></td>
            <td><span class="nyx-owner-account-state ${guest ? "guest" : (user.disabled ? "disabled" : "enabled")}"><i></i>${guest ? "Guest" : (user.disabled ? "Disabled" : "Enabled")}</span></td>
            <td><button class="nyx-owner-row-action" type="button" data-owner-view-user="${esc(user.uid)}" aria-label="View ${esc(user.displayName)}">${dashboardIcon("chevron")}</button></td>
          </tr>`;
          }).join("")}</tbody></table>`;
      }
      paginationHost.innerHTML = `<span>Page ${pagination.page || 1} of ${pagination.pages || 1}</span><div><label>Rows <select data-owner-page-size><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><button type="button" data-owner-page="${Math.max(1, (pagination.page || 1) - 1)}" ${(pagination.page || 1) <= 1 ? "disabled" : ""}>Previous</button><button type="button" data-owner-page="${Math.min(pagination.pages || 1, (pagination.page || 1) + 1)}" ${(pagination.page || 1) >= (pagination.pages || 1) ? "disabled" : ""}>Next</button></div>`;
      paginationHost.querySelector("[data-owner-page-size]").value = String(state.pageSize);
      void hydrateOwnerProfileMedia(tableHost);
    }

    function renderActivity(activity = []) {
      if (state.access && !state.access.permissions?.includes("audit:view")) {
        activityHost.innerHTML = '<div class="nyx-owner-empty compact"><strong>Activity is protected</strong><span>Your assigned role can manage its permitted account tasks without viewing the full audit log.</span></div>';
        return;
      }
      if (!activity.length) {
        activityHost.innerHTML = '<div class="nyx-owner-empty compact"><strong>No activity yet</strong><span>Owner and account events will appear here.</span></div>';
        return;
      }
      const groups = activity.reduce((result, event) => {
        const label = activityDayLabel(event.createdAt);
        const group = result.find(entry => entry.label === label);
        if (group) group.events.push(event);
        else result.push({ label, events: [event] });
        return result;
      }, []);
      activityHost.innerHTML = groups.map(group => `<section class="nyx-owner-activity-group"><header><strong>${esc(group.label)}</strong><span>${group.events.length} event${group.events.length === 1 ? "" : "s"}</span></header>${group.events.map(event => `<article class="nyx-owner-activity-item" data-owner-activity-type="${esc(activityIconName(event.action))}"><i class="nyx-owner-activity-dot">${dashboardIcon(activityIconName(event.action))}</i><div><strong>${esc(actionLabel(event.action))}</strong><p>${esc(event.targetEmail || event.actorEmail || event.targetUid || "System event")}</p><span title="${esc(dateLabel(event.createdAt))}">${esc(relativeLabel(event.createdAt))}${event.actorEmail && event.actorEmail !== event.targetEmail ? ` · by ${esc(event.actorEmail)}` : ""}</span></div></article>`).join("")}</section>`).join("");
    }

    function renderError(error) {
      tableHost.innerHTML = `<div class="nyx-owner-error"><strong>Dashboard could not load</strong><span>${esc(error.message || "Try again.")}</span><button type="button" data-owner-refresh>Try again</button></div>`;
      metricsHost.innerHTML = "";
      activityHost.innerHTML = "";
    }

    function renderIpBans() {
      const bans = state.ipBans || [];
      const clientNote = state.ipBanClientIp ? ` Your current IP is ${state.ipBanClientIp}; Nyx will not let you block it from this session.` : "";
      drawer.innerHTML = `<header><div><span>${dashboardIcon("shield")}</span><h2>Network access</h2><p>IP bans apply to Nyx server and function requests.</p></div><button type="button" data-owner-drawer-close aria-label="Close IP bans">${dashboardIcon("close")}</button></header>
        <div class="nyx-owner-drawer-scroll nyx-owner-ip-ban-drawer">
          <section class="nyx-owner-detail-section"><h3>Block an IP address</h3><p class="nyx-owner-action-note">Use a full IPv4 or IPv6 address. This does not configure Cloudflare's edge firewall.${esc(clientNote)}</p><form class="nyx-owner-ip-ban-form" data-owner-ip-ban-form><label>IP address<input name="ip" inputmode="text" autocomplete="off" maxlength="45" required placeholder="203.0.113.10 or 2001:db8::10"></label><label>Reason <input name="reason" maxlength="160" autocomplete="off" placeholder="Optional internal note"></label><div class="nyx-owner-detail-actions"><button type="submit">${dashboardIcon("shield")}Block IP</button></div></form></section>
          <section class="nyx-owner-detail-section"><h3>Blocked IP addresses</h3>${bans.length ? `<div class="nyx-owner-ip-ban-list">${bans.map(ban => `<article><div><strong>${esc(ban.ip)}</strong><span>${esc(ban.reason || "No reason recorded")}</span><small>Blocked ${esc(relativeLabel(ban.createdAt))}${ban.createdBy ? ` by ${esc(ban.createdBy)}` : ""}</small></div><button class="danger" type="button" data-owner-unban="${esc(ban.id)}">${dashboardIcon("refresh")}Unblock</button></article>`).join("")}</div>` : '<p class="nyx-owner-action-note">No IP addresses are blocked.</p>'}</section>
        </div>`;
    }

    async function openIpBans() {
      drawer.hidden = false;
      drawer.classList.remove("show");
      drawer.innerHTML = '<div class="nyx-owner-drawer-loading"><i></i><i></i><i></i></div>';
      requestAnimationFrame(() => drawer.classList.add("show"));
      state.selectedUser = null;
      state.selectedCapabilities = null;
      try {
        const data = await api("/api/owner-dashboard/ip-bans");
        state.ipBans = data.bans || [];
        state.ipBanClientIp = data.clientIp || "";
        state.access = data.access || state.access;
        renderIpBans();
      } catch (error) {
        drawer.innerHTML = `<div class="nyx-owner-error"><strong>IP bans could not load</strong><span>${esc(error.message)}</span><button type="button" data-owner-drawer-close>Close</button></div>`;
      }
    }

    async function removeIpBan(id) {
      const ban = state.ipBans.find(entry => entry.id === id);
      if (!ban) return;
      const confirmed = await confirmAction({ title: "Unblock this IP address?", message: `${ban.ip} will regain access to Nyx server requests.`, confirmLabel: "Unblock", requireText: ban.ip });
      if (!confirmed) return;
      try {
        await api(`/api/owner-dashboard/ip-bans/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.ipBans = state.ipBans.filter(entry => entry.id !== id);
        renderIpBans();
        notify("IP address unblocked.");
        await load({ preserveLoading: true });
      } catch (error) {
        notify(error.message || "The IP address could not be unblocked.", "error");
      }
    }

    async function load({ preserveLoading = false } = {}) {
      state.controller?.abort();
      state.controller = new AbortController();
      state.loading = true;
      if (!preserveLoading) renderLoading();
      const parameters = new URLSearchParams({
        page: state.page,
        pageSize: state.pageSize,
        search: state.search,
        role: state.role,
        subscription: state.subscription,
        status: state.status,
        segment: state.segment,
        sort: state.sort,
        direction: state.direction
      });
      try {
        const data = await api(`/api/owner-dashboard?${parameters}`, { signal: state.controller.signal });
        state.data = data;
        state.access = data.access || state.access;
        state.customRoles = Array.isArray(data.customRoles) ? data.customRoles : state.customRoles;
        const ipBansButton = overlay.querySelector("[data-owner-ip-bans]");
        if (ipBansButton) ipBansButton.hidden = !state.access?.permissions?.includes("network:bans");
        const customRolesButton = overlay.querySelector("[data-owner-custom-roles]");
        if (customRolesButton) customRolesButton.hidden = state.access?.role !== "owner";
        const roleFilter = overlay.querySelector('[name="role"]');
        if (roleFilter) {
          roleFilter.querySelectorAll("option[data-custom-role]").forEach(option => option.remove());
          state.customRoles.forEach(role => roleFilter.insertAdjacentHTML("beforeend", `<option data-custom-role value="${esc(role.id)}">${esc(role.label)}</option>`));
          roleFilter.value = state.role;
        }
        const accessCopy = overlay.querySelector("[data-owner-access-copy]");
        if (accessCopy && state.access) accessCopy.textContent = `${state.access.roleLabel || roleLabel(state.access.role)} access · controls are limited to this role's permissions.`;
        renderMetrics(data.metrics);
        renderUsers(data);
        renderActivity(data.recentActivity);
      } catch (error) {
        if (error.name !== "AbortError") renderError(error);
      } finally {
        state.loading = false;
      }
    }

    function detailValue(label, value, className = "") {
      return `<div class="nyx-owner-detail-value ${className}"><span>${esc(label)}</span><strong>${esc(value || "Not available")}</strong></div>`;
    }

    function profileColor(value, fallback) {
      return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? String(value).toLowerCase() : fallback;
    }

    function selected(value, expected) {
      return value === expected ? " selected" : "";
    }

    function ownerProfilePreview(user) {
      const profile = user.profile || {};
      const primary = profileColor(profile.accentPrimary, "#5865f2");
      const secondary = profileColor(profile.accentSecondary, "#8ea1ff");
      const bannerColor = profileColor(profile.bannerColor, secondary);
      const namePrimary = profileColor(profile.displayNameColorPrimary, "#ffffff");
      const nameSecondary = profileColor(profile.displayNameColorSecondary, secondary);
      const customPrimary = profileColor(profile.customEffectColorPrimary, "#ffffff");
      const customSecondary = profileColor(profile.customEffectColorSecondary, secondary);
      const effect = String(profile.profileEffect || "none").toLowerCase();
      const decoration = String(profile.avatarDecoration || "none").toLowerCase();
      const nameFont = String(profile.displayNameFont || "gg-sans").toLowerCase();
      const nameEffect = String(profile.displayNameEffect || "solid").toLowerCase();
      const customSpeed = Math.max(2, Math.min(18, Number(profile.customEffectSpeed) || 7));
      const customIntensity = Math.max(20, Math.min(100, Number(profile.customEffectIntensity) || 70));
      const avatar = ownerProfileImageMarkup(profile.avatarUrl, profile.displayName || user.displayName, (profile.displayName || user.displayName || "?").slice(0, 1).toUpperCase());
      const banner = ownerProfileImageMarkup(profile.bannerUrl, "");
      return `<article class="nyx-owner-public-profile nyx-owner-effect-${esc(effect)}" style="--profile-primary:${primary};--profile-secondary:${secondary};--profile-banner:${bannerColor};--profile-name-primary:${namePrimary};--profile-name-secondary:${nameSecondary};--profile-custom-primary:${customPrimary};--profile-custom-secondary:${customSecondary};--profile-effect-speed:${customSpeed}s;--profile-effect-opacity:${customIntensity / 100}">
        <i class="nyx-owner-public-effect" aria-hidden="true"></i>
        <div class="nyx-owner-public-banner">${banner}</div>
        <div class="nyx-owner-public-avatar nyx-owner-decoration-${esc(decoration)}">${avatar}<em aria-hidden="true"></em><i class="${user.online ? "online" : ""}"></i></div>
        <div class="nyx-owner-public-body">
          <strong class="nyx-owner-name-font-${esc(nameFont)} nyx-owner-name-effect-${esc(nameEffect)}">${esc(profile.displayName || user.displayName)}</strong>
          <span>${esc(profile.handle || `@${user.username}`)}</span>
          ${profile.customStatus ? `<p class="status">${esc(profile.customStatus)}</p>` : ""}
          <div><b>About me</b><p>${esc(profile.bio || "No bio yet.")}</p></div>
          <small>${roleIcon(user.role)}${esc(roleLabel(user.role))} · ${user.online ? "Online" : "Offline"}</small>
        </div>
      </article>`;
    }

    function ownerProfileEditor(user) {
      const profile = user.profile || {};
      const remoteAvatar = /^https?:\/\//i.test(String(profile.avatarUrl || "")) ? profile.avatarUrl : "";
      const remoteBanner = /^https?:\/\//i.test(String(profile.bannerUrl || "")) ? profile.bannerUrl : "";
      const avatarPreview = ownerProfileImageMarkup(profile.avatarUrl, "Current avatar", (profile.displayName || user.displayName || "?").slice(0, 1).toUpperCase());
      const bannerPreview = ownerProfileImageMarkup(profile.bannerUrl, "Current banner");
      const avatarInputId = `nyx-owner-avatar-${esc(user.uid)}`;
      const bannerInputId = `nyx-owner-banner-${esc(user.uid)}`;
      return `<form class="nyx-owner-profile-editor" data-owner-profile-form>
        <div class="nyx-owner-media-editors">
          <article class="nyx-owner-media-editor">
            <div class="nyx-owner-media-preview avatar" data-owner-media-preview="avatar">${avatarPreview}</div>
            <div><strong>Profile avatar</strong><span data-owner-media-name="avatar">PNG, JPG, WebP, or animated GIF · 8 MB max</span></div>
            <label class="nyx-owner-media-button" for="${avatarInputId}">Choose avatar</label>
            <input class="nyx-owner-media-input" id="${avatarInputId}" name="avatarFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          </article>
          <article class="nyx-owner-media-editor banner">
            <div class="nyx-owner-media-preview banner" data-owner-media-preview="banner" style="--owner-banner-preview:${profileColor(profile.bannerColor, "#8ea1ff")}">${bannerPreview}</div>
            <div><strong>Profile banner</strong><span data-owner-media-name="banner">PNG, JPG, WebP, or animated GIF · 8 MB max</span></div>
            <label class="nyx-owner-media-button" for="${bannerInputId}">Choose banner</label>
            <input class="nyx-owner-media-input" id="${bannerInputId}" name="bannerFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif">
          </article>
        </div>
        <p class="nyx-owner-media-error" data-owner-media-error role="alert"></p>
        <div class="nyx-owner-profile-fields">
          <label>Display name<input name="displayName" maxlength="48" required value="${esc(profile.displayName || user.displayName)}"></label>
          <label>Username<span class="nyx-owner-prefixed-input"><i>@</i><input name="handle" maxlength="32" required value="${esc(String(profile.handle || user.username).replace(/^@/, ""))}"></span></label>
          <label class="wide">About me<textarea name="bio" maxlength="280" rows="4">${esc(profile.bio || "")}</textarea></label>
          <label class="wide">Custom status<input name="customStatus" maxlength="80" value="${esc(profile.customStatus || "")}"></label>
          <label>Status<select name="status"><option value="online"${selected(profile.status, "online")}>Online</option><option value="idle"${selected(profile.status, "idle")}>Idle</option><option value="dnd"${selected(profile.status, "dnd")}>Do not disturb</option><option value="offline"${selected(profile.status, "offline")}>Offline</option></select></label>
          <label>Name style<select name="displayNameFont"><option value="gg-sans"${selected(profile.displayNameFont, "gg-sans")}>Default</option><option value="headline"${selected(profile.displayNameFont, "headline")}>Headline</option><option value="rounded"${selected(profile.displayNameFont, "rounded")}>Rounded</option><option value="wide"${selected(profile.displayNameFont, "wide")}>Wide</option><option value="slab"${selected(profile.displayNameFont, "slab")}>Slab</option><option value="condensed"${selected(profile.displayNameFont, "condensed")}>Condensed</option><option value="mono-block"${selected(profile.displayNameFont, "mono-block")}>Mono block</option><option value="tempo"${selected(profile.displayNameFont, "tempo")}>Tempo</option><option value="sakura"${selected(profile.displayNameFont, "sakura")}>Sakura</option><option value="jellybean"${selected(profile.displayNameFont, "jellybean")}>Jellybean</option><option value="modern"${selected(profile.displayNameFont, "modern")}>Modern</option><option value="medieval"${selected(profile.displayNameFont, "medieval")}>Medieval</option><option value="eight-bit"${selected(profile.displayNameFont, "eight-bit")}>Eight bit</option><option value="vampyre"${selected(profile.displayNameFont, "vampyre")}>Vampyre</option></select></label>
          <label>Primary color<input name="accentPrimary" type="color" value="${profileColor(profile.accentPrimary, "#5865f2")}"></label>
          <label>Accent color<input name="accentSecondary" type="color" value="${profileColor(profile.accentSecondary, "#8ea1ff")}"></label>
          <label>Banner fallback<input name="bannerColor" type="color" value="${profileColor(profile.bannerColor, "#8ea1ff")}"></label>
          <label>Name effect<select name="displayNameEffect"><option value="solid"${selected(profile.displayNameEffect, "solid")}>Solid</option><option value="gradient"${selected(profile.displayNameEffect, "gradient")}>Gradient</option><option value="neon"${selected(profile.displayNameEffect, "neon")}>Neon</option><option value="toon"${selected(profile.displayNameEffect, "toon")}>Toon</option><option value="pop"${selected(profile.displayNameEffect, "pop")}>Pop</option></select></label>
          <label>Profile effect<select name="profileEffect"><option value="none"${selected(profile.profileEffect, "none")}>None</option><option value="glow"${selected(profile.profileEffect, "glow")}>Glow</option><option value="sparkle"${selected(profile.profileEffect, "sparkle")}>Sparkle</option><option value="aurora"${selected(profile.profileEffect, "aurora")}>Aurora</option><option value="holographic"${selected(profile.profileEffect, "holographic")}>Holographic</option><option value="fireflies"${selected(profile.profileEffect, "fireflies")}>Fireflies</option><option value="cosmic-dust"${selected(profile.profileEffect, "cosmic-dust")}>Cosmic dust</option><option value="electric-storm"${selected(profile.profileEffect, "electric-storm")}>Electric storm</option><option value="meteor-shower"${selected(profile.profileEffect, "meteor-shower")}>Meteor shower</option><option value="cyber-grid"${selected(profile.profileEffect, "cyber-grid")}>Cyber grid</option><option value="plasma"${selected(profile.profileEffect, "plasma")}>Plasma</option><option value="snowfall"${selected(profile.profileEffect, "snowfall")}>Snowfall</option><option value="embers"${selected(profile.profileEffect, "embers")}>Embers</option><option value="bubbles"${selected(profile.profileEffect, "bubbles")}>Bubbles</option><option value="custom"${selected(profile.profileEffect, "custom")}>Custom</option></select></label>
          <label>Avatar decoration<select name="avatarDecoration"><option value="none"${selected(profile.avatarDecoration, "none")}>None</option><option value="starfall"${selected(profile.avatarDecoration, "starfall")}>Starfall</option><option value="orbit"${selected(profile.avatarDecoration, "orbit")}>Orbit</option><option value="laurel"${selected(profile.avatarDecoration, "laurel")}>Laurel</option><option value="neon-wings"${selected(profile.avatarDecoration, "neon-wings")}>Neon wings</option></select></label>
          <label class="wide">Avatar URL (optional)<input name="avatarUrl" type="url" placeholder="Leave blank to keep the current image" value="${esc(remoteAvatar)}"></label>
          <label class="wide">Banner URL (optional)<input name="bannerUrl" type="url" placeholder="Leave blank to keep the current image" value="${esc(remoteBanner)}"></label>
        </div>
        <div class="nyx-owner-media-removal">
          <label><input name="removeAvatar" type="checkbox"> Remove current avatar</label>
          <label><input name="removeBanner" type="checkbox"> Remove current banner</label>
        </div>
        <p>File uploads preserve animated GIFs. A selected file takes priority over its URL field, and blank fields keep the current media unchanged.</p>
        <div class="nyx-owner-detail-actions"><button type="submit">Save profile</button></div>
      </form>`;
    }

    async function openUser(uid) {
      drawer.hidden = false;
      drawer.classList.remove("show");
      const guest = (state.data?.users || []).find(user => user.uid === uid && user.guest);
      if (guest) {
        state.selectedUser = guest;
        state.selectedCapabilities = {};
        const avatar = ownerProfileImageMarkup("", "", (guest.displayName || "G").slice(0, 1).toUpperCase());
        drawer.innerHTML = `<header><div class="nyx-owner-detail-avatar">${avatar}<i class="online"></i></div><div><span>${roleIcon("guest")}Guest session</span><h2>${esc(guest.displayName)}</h2><p class="nyx-owner-drawer-identity">@${esc(guest.username)} <span class="nyx-owner-presence-state online"><i></i>Online</span></p></div><button type="button" data-owner-drawer-close aria-label="Close guest details">${dashboardIcon("close")}</button></header>
          <div class="nyx-owner-drawer-scroll">
            <section class="nyx-owner-detail-grid">${detailValue("Identity", guest.displayName)}${detailValue("Guest ID", `@${guest.username}`)}${detailValue("Account", "No account created")}${detailValue("Presence", "Online now")}${detailValue("First seen", dateLabel(guest.createdAt))}${detailValue("Last active", dateLabel(guest.lastActiveAt))}</section>
            <section class="nyx-owner-detail-section"><h3>Guest visitor</h3><p class="nyx-owner-action-note">Nyx uses the username saved by this browser's startup wizard. If the visitor skipped it, Nyx assigns a stable random guest name instead. Account, role, subscription, profile, and account-management controls become available only after the visitor signs in or creates an account.</p></section>
          </div>`;
        requestAnimationFrame(() => drawer.classList.add("show"));
        return;
      }
      drawer.innerHTML = '<div class="nyx-owner-drawer-loading"><i></i><i></i><i></i></div>';
      requestAnimationFrame(() => drawer.classList.add("show"));
      try {
        const { user, access, capabilities = {} } = await api(`/api/owner-dashboard/users/${encodeURIComponent(uid)}`);
        state.selectedUser = user;
        state.selectedCapabilities = capabilities;
        state.access = access || state.access;
        const avatar = ownerProfileImageMarkup(user.photoUrl, "", (user.displayName || "?").slice(0, 1).toUpperCase());
        const assignableRoles = access?.assignableRoles || [];
        const roleSelectOptions = assignableRoles.map(role => `<option value="${esc(role)}"${selected(user.role, role)}>${esc(roleLabel(role))}</option>`).join("");
        const customRoleOptions = access?.role === "owner" ? state.customRoles.map(role => `<option value="custom:${esc(role.id)}"${user.customRole?.id === role.id ? " selected" : ""}>${esc(role.label)} · ${esc(roleLabel(role.baseRole))} placement</option>`).join("") : "";
        const currentRoleValue = user.customRole ? `custom:${user.customRole.id}` : user.role;
        const currentRoleOption = !user.customRole && !assignableRoles.includes(user.role) ? `<option value="${esc(user.role)}" selected disabled>${esc(roleLabel(user.role))}</option>` : "";
        const accessSection = capabilities.canSetRole || capabilities.canSetSubscription ? `<section class="nyx-owner-detail-section"><h3>Access</h3>
          ${capabilities.canSetRole ? `<label>Current role<select data-owner-detail-role>${roleSelectOptions}${customRoleOptions}${currentRoleOption}</select></label>${roleOptions(user.role, assignableRoles)}` : `<p class="nyx-owner-action-note">Role: ${esc(userRoleLabel(user))}</p>`}
          ${capabilities.canSetSubscription ? `<label>Subscription<select data-owner-detail-subscription><option value="free">Free</option><option value="premium">Premium</option><option value="trialing">Trial</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label><p class="nyx-owner-premium-note">Premium and Trial accounts receive Premium benefits automatically when they sign in. They do not need a Premium access code.</p><label>Monthly revenue <input data-owner-detail-revenue type="number" min="0" step="0.01" value="${((user.monthlyRevenueCents || 0) / 100).toFixed(2)}"></label>` : `<p class="nyx-owner-action-note">Subscription: ${esc(subscriptionLabel(user.subscriptionStatus))}</p>`}
          <div class="nyx-owner-detail-actions"><button type="button" data-owner-save-access>${dashboardIcon("save")}Save access</button></div></section>` : "";
        const accountActions = [
          capabilities.canResetPassword ? `<button type="button" data-owner-user-action="create_password_reset_link">${dashboardIcon("key")}Create reset link</button>` : "",
          capabilities.canResetPassword ? `<button type="button" data-owner-user-action="send_password_reset" ${!user.deliverableEmail ? "disabled" : ""}>${dashboardIcon("mail")}Email reset link</button>` : "",
          capabilities.canVerifyEmail ? `<button type="button" data-owner-user-action="verify_email" ${user.emailVerified || !user.deliverableEmail ? "disabled" : ""}>${dashboardIcon("check")}Verify email</button>` : "",
          capabilities.canDisableAccount ? `<button type="button" data-owner-user-action="${user.disabled ? "enable" : "disable"}">${dashboardIcon(user.disabled ? "userCheck" : "userOff")}${user.disabled ? "Re-enable account" : "Disable account"}</button>` : "",
          capabilities.canDisableAccount && capabilities.canManageNetworkBans && !user.disabled && user.lastSeenIp ? `<button class="danger" type="button" data-owner-user-action="disable_with_ip_ban">${dashboardIcon("ban")}Disable + block IP</button>` : "",
          capabilities.canDeleteAccount ? `<button class="danger" type="button" data-owner-user-action="delete">${dashboardIcon("trash")}Delete account</button>` : ""
        ].filter(Boolean).join("");
        const ipBanNote = capabilities.canManageNetworkBans ? (user.lastSeenIp ? `<p class="nyx-owner-action-note">Last seen IP: ${esc(user.lastSeenIp)} · ${esc(dateLabel(user.lastSeenIpAt))}. IP addresses can be shared or change over time.</p>` : '<p class="nyx-owner-action-note">No IP has been recorded for this account yet. Nyx records one after its next authenticated activity.</p>') : "";
        const accountActionsSection = accountActions ? `<section class="nyx-owner-detail-section"><h3>Account actions</h3>${!user.deliverableEmail && capabilities.canResetPassword ? '<p class="nyx-owner-action-note">This username-only account has no inbox. Create a secure reset link and give it directly to the account owner.</p>' : ""}${ipBanNote}<div class="nyx-owner-action-grid">${accountActions}</div></section>` : "";
        const recentActivitySection = capabilities.canViewAudit ? `<section class="nyx-owner-detail-section"><h3>Recent user activity</h3><div class="nyx-owner-user-activity">${(user.recentActivity || []).length ? user.recentActivity.map(event => `<p><strong>${esc(actionLabel(event.action))}</strong><span>${esc(relativeLabel(event.createdAt))}</span></p>`).join("") : "<span>No recorded account actions.</span>"}</div></section>` : "";
        drawer.innerHTML = `<header><div class="nyx-owner-detail-avatar">${avatar}<i class="${user.online ? "online" : ""}"></i></div><div><span>${roleIcon(user.role)}${esc(userRoleLabel(user))} account</span><h2>${esc(user.displayName)}</h2><p class="nyx-owner-drawer-identity">@${esc(user.username)} <span class="nyx-owner-presence-state ${user.online ? "online" : "offline"}"><i></i>${user.online ? "Online" : "Offline"}</span></p></div><button type="button" data-owner-drawer-close aria-label="Close user details">${dashboardIcon("close")}</button></header>
          <div class="nyx-owner-drawer-scroll">
            <section class="nyx-owner-detail-grid">${detailValue("Email", user.deliverableEmail ? user.email : "No email added")}${detailValue("Firebase UID", user.uid, "uid")}${detailValue("Presence", user.online ? "Online now" : "Offline")}${detailValue("Created", dateLabel(user.createdAt))}${detailValue("Last sign-in", dateLabel(user.lastSignInAt))}${detailValue("Last active", dateLabel(user.lastActiveAt))}${capabilities.canManageNetworkBans ? detailValue("Last seen IP", user.lastSeenIp || "Not recorded yet") : ""}${capabilities.canManageNetworkBans && user.lastSeenIp ? detailValue("IP last seen", dateLabel(user.lastSeenIpAt)) : ""}${detailValue("Email verified", user.deliverableEmail ? (user.emailVerified ? "Verified" : "Not verified") : "Not applicable · username-only")}</section>
            <section class="nyx-owner-detail-section nyx-owner-profile-management"><h3>Public profile</h3>${ownerProfilePreview(user)}${capabilities.canEditProfile ? `<details><summary>Edit this profile</summary>${ownerProfileEditor(user)}</details>` : ""}</section>
            ${accessSection}
            ${accountActionsSection}
            ${recentActivitySection}
          </div>`;
        const roleSelect = drawer.querySelector("[data-owner-detail-role]");
        const subscriptionSelect = drawer.querySelector("[data-owner-detail-subscription]");
        const profileEffectSelect = drawer.querySelector('[name="profileEffect"]');
        profileEffectSelect?.querySelector('[value="custom"]')?.insertAdjacentHTML("beforebegin", '<option value="starlight-ribbon">Starlight ribbon</option><option value="cherry-bloom">Cherry bloom</option><option value="ocean-caustics">Ocean caustics</option>');
        if (profileEffectSelect) profileEffectSelect.value = user.profile?.profileEffect || "none";
        const decorationSelect = drawer.querySelector('[name="avatarDecoration"]');
        decorationSelect?.insertAdjacentHTML("beforeend", '<option value="crystal-crown">Crystal crown</option><option value="lunar-halo">Lunar halo</option><option value="rose-vines">Rose vines</option>');
        if (decorationSelect) decorationSelect.value = user.profile?.avatarDecoration || "none";
        if (roleSelect) roleSelect.value = currentRoleValue;
        if (subscriptionSelect) subscriptionSelect.value = user.subscriptionStatus;
        syncRoleOptions(drawer, currentRoleValue);
        void hydrateOwnerProfileMedia(drawer);
      } catch (error) {
        drawer.innerHTML = `<div class="nyx-owner-error"><strong>User details could not load</strong><span>${esc(error.message)}</span><button type="button" data-owner-drawer-close>Close</button></div>`;
      }
    }

    function customRolePlacementOptions(current = "member") {
      return (state.customRolePlacements.length ? state.customRolePlacements : ownerAssignableRoles.map(id => ({ id, label: roleLabel(id) })))
        .map(role => `<option value="${esc(role.id)}"${role.id === current ? " selected" : ""}>${esc(role.label)} placement</option>`).join("");
    }

    function customRolePermissionOptions(selectedPermissions = []) {
      const selected = new Set(selectedPermissions);
      return `<details class="nyx-owner-custom-role-permission-editor"><summary>${selected.size} permission${selected.size === 1 ? "" : "s"} selected</summary><fieldset class="nyx-owner-custom-role-permissions"><legend>Permissions</legend>${state.customRolePermissions.map(permission => `<label><input type="checkbox" name="permissions" value="${esc(permission.id)}"${selected.has(permission.id) ? " checked" : ""}><span>${esc(permission.label)}</span><small>${esc(permission.id)}</small></label>`).join("")}</fieldset></details>`;
    }

    function customRoleColorInput(color = "#8ea1ff") {
      const value = /^#[0-9a-f]{6}$/i.test(String(color || "")) ? String(color).toLowerCase() : "#8ea1ff";
      return `<label>Color / code<span class="nyx-owner-custom-role-color-control"><span class="nyx-owner-custom-role-swatch" style="--owner-custom-role:${esc(value)}"></span><input name="color" type="text" value="${esc(value)}" maxlength="7" pattern="(?:#[0-9A-Fa-f]{6}|&amp;[0-9A-Fa-f])" title="Use a six-digit hex color or a Minecraft code from &amp;0 through &amp;f" placeholder="&amp;d or #ff55ff" required></span><small>Use #RRGGBB or &amp;0–&amp;f.</small></label>`;
    }

    function renderCustomRoles() {
      const editingId = state.customRoleEditorId;
      const editor = role => `<form class="nyx-owner-custom-role-editor" data-owner-custom-role-update="${esc(role.id)}"><label>Name<input name="label" maxlength="32" minlength="2" required value="${esc(role.label)}"></label>${customRoleColorInput(role.color)}<label>Placement<select name="baseRole">${customRolePlacementOptions(role.baseRole)}</select></label>${customRolePermissionOptions(role.permissions)}<div class="nyx-owner-custom-role-editor-actions"><button type="submit">${dashboardIcon("save")}Save changes</button><button type="button" data-owner-custom-role-cancel>Cancel</button></div></form>`;
      const createEditor = `<form class="nyx-owner-custom-role-form nyx-owner-custom-role-editor" data-owner-custom-role-create><label>Name<input name="label" maxlength="32" minlength="2" required placeholder="Night Watch"></label><label>Role ID<input name="id" maxlength="32" pattern="[a-z0-9][a-z0-9-]{1,31}" placeholder="night-watch"></label>${customRoleColorInput()}<label>Placement<select name="baseRole">${customRolePlacementOptions("member")}</select></label>${customRolePermissionOptions([])}<div class="nyx-owner-custom-role-editor-actions"><button type="submit">${dashboardIcon("save")}Create role</button><button type="button" data-owner-custom-role-cancel>Cancel</button></div></form>`;
      drawer.innerHTML = `<header class="nyx-owner-custom-role-header"><div><span>${dashboardIcon("users")}</span><div><h2>Custom roles</h2><p>Colors, hierarchy, permissions, and assignments.</p></div></div><button type="button" data-owner-drawer-close aria-label="Close custom roles">${dashboardIcon("close")}</button></header>
        <div class="nyx-owner-drawer-scroll nyx-owner-custom-role-drawer">
          <section class="nyx-owner-detail-section nyx-owner-custom-role-section"><div class="nyx-owner-custom-role-toolbar"><div><h3>Configured roles</h3><p class="nyx-owner-action-note">Placement controls hierarchy; selected permissions control access.</p></div><button type="button" data-owner-custom-role-new>${dashboardIcon("users")}New role</button></div>${editingId === "new" ? createEditor : ""}${state.customRoles.length ? `<div class="nyx-owner-custom-role-list">${state.customRoles.map(role => `<article class="nyx-owner-custom-role-item${editingId === role.id ? " editing" : ""}"><div class="nyx-owner-custom-role-row"><span class="nyx-owner-custom-role-dot" style="--owner-custom-role:${esc(role.color)}"></span><span class="nyx-owner-custom-role-copy"><strong>${esc(role.label)}</strong><small>${esc(role.id)}</small></span><span class="nyx-owner-custom-role-placement">${esc(roleLabel(role.baseRole))}</span><span class="nyx-owner-custom-role-permission-count">${Number(role.permissions?.length || 0)} perms</span><button type="button" data-owner-custom-role-edit="${esc(role.id)}">Edit</button><button class="danger" type="button" data-owner-custom-role-delete="${esc(role.id)}" aria-label="Delete ${esc(role.label)}">${dashboardIcon("trash")}</button></div>${editingId === role.id ? editor(role) : ""}</article>`).join("")}</div>` : '<p class="nyx-owner-action-note">No custom roles have been created yet.</p>'}</section>
        </div>`;
    }

    async function openCustomRoles() {
      drawer.hidden = false;
      drawer.classList.remove("show");
      drawer.innerHTML = '<div class="nyx-owner-drawer-loading"><i></i><i></i><i></i></div>';
      requestAnimationFrame(() => drawer.classList.add("show"));
      state.selectedUser = null;
      state.selectedCapabilities = null;
      try {
        const data = await api("/api/owner-dashboard/custom-roles");
        state.customRoles = data.roles || [];
        state.customRolePlacements = data.placements || [];
        state.customRolePermissions = data.permissions || [];
        state.access = data.access || state.access;
        renderCustomRoles();
      } catch (error) {
        drawer.innerHTML = `<div class="nyx-owner-error"><strong>Custom roles could not load</strong><span>${esc(error.message)}</span><button type="button" data-owner-drawer-close>Close</button></div>`;
      }
    }

    async function deleteCustomRole(id) {
      const role = state.customRoles.find(entry => entry.id === id);
      if (!role) return;
      const confirmed = await confirmAction({ title: "Delete this custom role?", message: `${role.label} will be removed from every assigned account. Those accounts will return to their previous built-in role.`, confirmLabel: "Delete role", requireText: role.label, danger: true });
      if (!confirmed) return;
      try {
        await api(`/api/owner-dashboard/custom-roles/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.customRoles = state.customRoles.filter(entry => entry.id !== id);
        renderCustomRoles();
        notify("Custom role deleted.");
        await load({ preserveLoading: true });
      } catch (error) {
        notify(error.message || "The custom role could not be deleted.", "error");
      }
    }

    async function openSearchHistory(user) {
      if (!user || user.guest) return;
      drawer.hidden = false;
      drawer.classList.remove("show");
      state.selectedUser = user;
      const avatar = ownerProfileImageMarkup(user.photoUrl, "", (user.displayName || "?").slice(0, 1).toUpperCase());
      drawer.innerHTML = `<header><div class="nyx-owner-detail-avatar">${avatar}<i class="${user.online ? "online" : ""}"></i></div><div><span>${dashboardIcon("shield")}Search review</span><h2>${esc(user.displayName)}</h2><p class="nyx-owner-drawer-identity">@${esc(user.username)}</p></div><button type="button" data-owner-drawer-close aria-label="Close search history">${dashboardIcon("close")}</button></header>
        <div class="nyx-owner-drawer-scroll"><section class="nyx-owner-detail-section nyx-owner-flagged-searches"><div class="nyx-owner-search-history-heading"><h3>Search history</h3><button type="button" data-owner-clear-search-history="${esc(user.uid)}" hidden>${dashboardIcon("trash")}Clear history</button></div><p class="nyx-owner-action-note">Searches made through Nyx while this account is signed in are retained for 30 days. Policy-classified searches are highlighted, but a match is a moderation signal rather than proof.</p><div class="nyx-owner-flagged-search-list"><div class="nyx-owner-drawer-loading"><i></i><i></i><i></i></div></div></section></div>`;
      requestAnimationFrame(() => drawer.classList.add("show"));
      void hydrateOwnerProfileMedia(drawer);
      const list = drawer.querySelector(".nyx-owner-flagged-search-list");
      try {
        const result = await api(`/api/chat/moderation/search-history?uid=${encodeURIComponent(user.uid)}`);
        if (!list?.isConnected || state.selectedUser?.uid !== user.uid) return;
        const searches = Array.isArray(result.searches) ? result.searches : [];
        const clearButton = drawer.querySelector("[data-owner-clear-search-history]");
        if (clearButton) clearButton.hidden = !(result.canClear && searches.length);
        list.innerHTML = searches.length
          ? searches.map(search => `<article class="${search.flagged ? "policy" : ""}"><header><strong>${esc(search.category || "Standard search")}</strong><time datetime="${esc(search.createdAt)}" title="${esc(dateLabel(search.createdAt))}">${esc(relativeLabel(search.createdAt))}</time></header><p>${esc(search.query)}</p></article>`).join("")
          : '<div class="nyx-owner-empty compact"><strong>No retained searches</strong><span>This account has no Nyx searches from the last 30 days.</span></div>';
      } catch (error) {
        if (!list?.isConnected) return;
        list.innerHTML = `<div class="nyx-owner-error"><strong>Search history could not load</strong><span>${esc(error.message)}</span></div>`;
      }
    }

    async function clearSearchHistory(user) {
      if (!user || user.guest) return;
      const confirmed = await confirmAction({
        title: "Clear this search history?",
        message: `All retained Nyx searches for ${user.displayName} will be permanently deleted. This cannot be undone.`,
        confirmLabel: "Clear history",
        danger: true
      });
      if (!confirmed) return;
      const button = drawer.querySelector("[data-owner-clear-search-history]");
      if (button) button.disabled = true;
      try {
        const result = await api(`/api/chat/moderation/search-history?uid=${encodeURIComponent(user.uid)}`, { method: "DELETE" });
        notify(`${Number(result.deletedCount || 0).toLocaleString()} search${Number(result.deletedCount || 0) === 1 ? "" : "es"} cleared.`);
        await openSearchHistory(user);
      } catch (error) {
        notify(error.message || "Search history could not be cleared.", "error");
        if (button?.isConnected) button.disabled = false;
      }
    }

    function closeDrawer() {
      drawer.classList.remove("show");
      setTimeout(() => { drawer.hidden = true; drawer.innerHTML = ""; }, 180);
      state.selectedUser = null;
      state.selectedCapabilities = null;
    }

    function confirmAction({ title, message, confirmLabel = "Continue", danger = false, requireText = "" }) {
      return new Promise(resolve => {
        confirmHost.hidden = false;
        confirmHost.innerHTML = `<form><h2>${esc(title)}</h2><p>${esc(message)}</p>${requireText ? `<label>Type <strong>${esc(requireText)}</strong> to confirm<input name="confirmation" autocomplete="off"></label>` : ""}<div><button type="button" data-owner-confirm-cancel>Cancel</button><button class="${danger ? "danger" : ""}" type="submit" ${requireText ? "disabled" : ""}>${esc(confirmLabel)}</button></div></form>`;
        const form = confirmHost.querySelector("form");
        const input = form.elements.confirmation;
        const submit = form.querySelector('[type="submit"]');
        const finish = value => { confirmHost.hidden = true; confirmHost.innerHTML = ""; resolve(value); };
        input?.addEventListener("input", () => { submit.disabled = input.value.trim() !== requireText; });
        form.addEventListener("submit", event => { event.preventDefault(); finish(true); });
        form.querySelector("[data-owner-confirm-cancel]").addEventListener("click", () => finish(false));
        setTimeout(() => (input || form.querySelector("button"))?.focus(), 0);
      });
    }

    function showResetLink(resetLink) {
      confirmHost.hidden = false;
      confirmHost.innerHTML = `<form><h2>Password reset link</h2><p>Give this one-time Firebase link directly to the account owner. Nyx never reveals or stores their password.</p><label>Reset link<input name="resetLink" value="${esc(resetLink)}" readonly></label><div><button type="button" data-owner-reset-close>Close</button><button type="button" data-owner-reset-copy>Copy link</button></div></form>`;
      const input = confirmHost.querySelector('[name="resetLink"]');
      const close = () => { confirmHost.hidden = true; confirmHost.innerHTML = ""; };
      confirmHost.querySelector("[data-owner-reset-close]").addEventListener("click", close);
      confirmHost.querySelector("[data-owner-reset-copy]").addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(resetLink);
          notify("Password reset link copied.");
        } catch {
          input.focus();
          input.select();
          notify("Select and copy the reset link.", "error");
        }
      });
      setTimeout(() => { input.focus(); input.select(); }, 0);
    }

    async function mutateUser(action, body = {}) {
      const user = state.selectedUser;
      if (!user) return;
      const confirmations = {
        disable: ["Disable account?", `${user.email || user.displayName} will immediately lose access until re-enabled.`, "Disable", true],
        disable_with_ip_ban: ["Disable account and block its IP?", `${user.email || user.displayName} will lose access, and ${user.lastSeenIp} will be blocked from Nyx server requests. Shared or changing IPs can affect other people.`, "Disable and block", true],
        enable: ["Re-enable account?", `${user.email || user.displayName} will be able to sign in again.`, "Re-enable", false],
        verify_email: ["Verify this email?", `Mark ${user.email} as verified in Firebase Authentication.`, "Verify", false],
        create_password_reset_link: ["Create a password reset link?", "The current password will remain private. Give the generated one-time link only to the account owner.", "Create link", false],
        send_password_reset: ["Send password reset?", `Firebase will email a password-reset link to ${user.email}.`, "Send email", false]
      };
      if (action === "delete") {
        const phrase = user.email || user.uid;
        const confirmed = await confirmAction({ title: "Permanently delete account?", message: "This removes the Firebase Authentication account and its Nyx profile data. Audit history is retained.", confirmLabel: "Delete permanently", danger: true, requireText: phrase });
        if (!confirmed) return;
      } else if (confirmations[action]) {
        const [title, message, confirmLabel, danger] = confirmations[action];
        if (!await confirmAction({ title, message, confirmLabel, danger })) return;
      }
      try {
        const result = await api(`/api/owner-dashboard/users/${encodeURIComponent(user.uid)}`, { method: "PATCH", body: JSON.stringify({ action, ...body }) });
        if (result.deleted) {
          notify("Account deleted.");
          closeDrawer();
        } else if (result.resetLink) {
          showResetLink(result.resetLink);
          notify("Secure password reset link created.");
        } else {
          state.selectedUser = result.user;
          state.selectedCapabilities = result.capabilities || state.selectedCapabilities;
          state.access = result.access || state.access;
          notify(action === "send_password_reset" ? "Password reset email sent." : "Account updated.");
          await openUser(user.uid);
        }
        await load({ preserveLoading: true });
      } catch (error) {
        notify(error.message || "The account action failed.", "error");
      }
    }

    function exportCurrentPage() {
      const users = state.data?.users || [];
      if (!users.length) return notify("There are no users on this page to export.", "error");
      const columns = ["uid", "accountType", "displayName", "username", "email", "role", "subscriptionStatus", "createdAt", "lastSignInAt", "lastActiveAt", "emailVerified", "disabled"];
      const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
      const csv = [columns.join(","), ...users.map(user => columns.map(column => quote(user[column])).join(","))].join("\r\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `nyx-users-page-${state.page}.csv`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("User page exported.");
    }

    function onClick(event) {
      if (event.target === overlay || event.target.closest("[data-owner-close]")) return destroy();
      if (event.target.closest("[data-owner-refresh]")) return void load();
      if (event.target.closest("[data-owner-export]")) return exportCurrentPage();
      if (event.target.closest("[data-owner-custom-roles]")) return void openCustomRoles();
      if (event.target.closest("[data-owner-ip-bans]")) return void openIpBans();
      if (event.target.closest("[data-owner-custom-role-new]")) {
        state.customRoleEditorId = "new";
        renderCustomRoles();
        drawer.querySelector('[data-owner-custom-role-create] input[name="label"]')?.focus();
        return;
      }
      const customRoleEdit = event.target.closest("[data-owner-custom-role-edit]")?.dataset.ownerCustomRoleEdit;
      if (customRoleEdit) {
        state.customRoleEditorId = customRoleEdit;
        renderCustomRoles();
        drawer.querySelector(`[data-owner-custom-role-update="${CSS.escape(customRoleEdit)}"] input[name="label"]`)?.focus();
        return;
      }
      if (event.target.closest("[data-owner-custom-role-cancel]")) {
        state.customRoleEditorId = "";
        renderCustomRoles();
        return;
      }
      const customRoleDelete = event.target.closest("[data-owner-custom-role-delete]")?.dataset.ownerCustomRoleDelete;
      if (customRoleDelete) return void deleteCustomRole(customRoleDelete);
      const unbanId = event.target.closest("[data-owner-unban]")?.dataset.ownerUnban;
      if (unbanId) return void removeIpBan(unbanId);
      const segment = event.target.closest("[data-owner-segment]")?.dataset.ownerSegment;
      if (segment) {
        state.segment = segment;
        state.search = "";
        state.role = "all";
        state.subscription = "all";
        state.status = "all";
        state.page = 1;
        const filters = overlay.querySelector("[data-owner-filters]");
        filters.elements.search.value = "";
        filters.elements.role.value = "all";
        filters.elements.subscription.value = "all";
        filters.elements.status.value = "all";
        return void load();
      }
      if (event.target.closest("[data-owner-online-only]")) {
        state.segment = "";
        state.status = state.status === "online" ? "all" : "online";
        overlay.querySelector('[name="status"]').value = state.status;
        state.page = 1;
        return void load();
      }
      const sort = event.target.closest("[data-owner-sort]")?.dataset.ownerSort;
      if (sort) {
        if (state.sort === sort) state.direction = state.direction === "asc" ? "desc" : "asc";
        else { state.sort = sort; state.direction = "asc"; }
        return void load({ preserveLoading: true });
      }
      const page = event.target.closest("[data-owner-page]")?.dataset.ownerPage;
      if (page) { state.page = Number(page) || 1; return void load({ preserveLoading: true }); }
      const searchHistoryUid = event.target.closest("[data-owner-search-history]")?.dataset.ownerSearchHistory;
      if (searchHistoryUid) {
        const user = (state.data?.users || []).find(item => item.uid === searchHistoryUid);
        if (user) return void openSearchHistory(user);
      }
      const clearSearchHistoryUid = event.target.closest("[data-owner-clear-search-history]")?.dataset.ownerClearSearchHistory;
      if (clearSearchHistoryUid && state.selectedUser?.uid === clearSearchHistoryUid) return void clearSearchHistory(state.selectedUser);
      const uid = event.target.closest("[data-owner-view-user]")?.dataset.ownerViewUser;
      if (uid) return void openUser(uid);
      if (event.target.closest("[data-owner-drawer-close]")) return closeDrawer();
      const selectedRole = event.target.closest("[data-owner-role-option]")?.dataset.ownerRoleOption;
      if (selectedRole) {
        const select = drawer.querySelector("[data-owner-detail-role]");
        if (!select || select.disabled) return;
        select.value = selectedRole;
        syncRoleOptions(drawer, selectedRole);
        return;
      }
      const userAction = event.target.closest("[data-owner-user-action]")?.dataset.ownerUserAction;
      if (userAction) return void mutateUser(userAction);
      if (event.target.closest("[data-owner-save-access]")) {
        const roleField = drawer.querySelector("[data-owner-detail-role]");
        const subscriptionField = drawer.querySelector("[data-owner-detail-subscription]");
        const revenueField = drawer.querySelector("[data-owner-detail-revenue]");
        const role = roleField?.value || (state.selectedUser?.customRole ? `custom:${state.selectedUser.customRole.id}` : state.selectedUser?.role);
        const subscriptionStatus = subscriptionField?.value || state.selectedUser?.subscriptionStatus;
        const monthlyRevenueCents = revenueField ? Math.round((Number(revenueField.value) || 0) * 100) : state.selectedUser?.monthlyRevenueCents;
        const previousRole = state.selectedUser?.customRole ? `custom:${state.selectedUser.customRole.id}` : state.selectedUser?.role;
        const roleChanged = Boolean(roleField && role !== previousRole);
        const subscriptionChanged = Boolean(subscriptionField && (subscriptionStatus !== state.selectedUser?.subscriptionStatus || monthlyRevenueCents !== state.selectedUser?.monthlyRevenueCents));
        return void (async () => {
          if (roleChanged) {
            const customRole = role.startsWith("custom:") ? state.customRoles.find(entry => entry.id === role.slice(7)) : null;
            const nextLabel = customRole?.label || roleLabel(role);
            const confirmed = await confirmAction({ title: "Change account role?", message: `${state.selectedUser.email || state.selectedUser.displayName} will become ${nextLabel}.`, confirmLabel: "Change role" });
            if (!confirmed) return;
            if (customRole) {
              await api(`/api/owner-dashboard/custom-roles/${encodeURIComponent(customRole.id)}/assign`, { method: "POST", body: JSON.stringify({ uid: state.selectedUser.uid }) });
              notify(`${customRole.label} assigned.`);
              await openUser(state.selectedUser.uid);
              await load({ preserveLoading: true });
            } else await mutateUser("set_role", { role });
          }
          if (subscriptionChanged) await mutateUser("set_subscription", { subscriptionStatus, monthlyRevenueCents });
          if (!roleChanged && !subscriptionChanged) notify("No access changes to save.", "error");
        })();
      }
    }

    function onChange(event) {
      if (event.target.matches(".nyx-owner-media-input")) {
        const input = event.target;
        const form = input.closest("[data-owner-profile-form]");
        const kind = input.name === "avatarFile" ? "avatar" : "banner";
        const file = input.files?.[0];
        const name = form?.querySelector(`[data-owner-media-name="${kind}"]`);
        const preview = form?.querySelector(`[data-owner-media-preview="${kind}"]`);
        const errorHost = form?.querySelector("[data-owner-media-error]");
        input._nyxOwnerDataUrl = "";
        input._nyxOwnerMediaError = null;
        if (!file) return;
        if (name) name.textContent = `Preparing ${file.name}...`;
        if (errorHost) errorHost.textContent = "";
        const removeInput = form?.querySelector(`[name="remove${kind[0].toUpperCase()}${kind.slice(1)}"]`);
        if (removeInput) removeInput.checked = false;
        const preparation = prepareOwnerProfileImage(file, kind === "avatar" ? 512 : 1200, kind === "avatar" ? 512 : 480);
        input._nyxOwnerPreparation = preparation;
        void preparation.then(dataUrl => {
          if (input._nyxOwnerPreparation !== preparation) return;
          input._nyxOwnerDataUrl = dataUrl;
          if (name) name.textContent = file.name;
          if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Selected ${kind}">`;
        }).catch(error => {
          if (input._nyxOwnerPreparation !== preparation) return;
          input._nyxOwnerMediaError = error;
          input.value = "";
          if (name) name.textContent = "Choose a different image";
          if (errorHost) errorHost.textContent = error.message || "That image could not be used.";
        }).finally(() => {
          if (input._nyxOwnerPreparation === preparation) input._nyxOwnerPreparation = null;
        });
        return;
      }
      if (event.target.matches("[data-owner-page-size]")) {
        state.pageSize = Number(event.target.value) || 25;
        state.page = 1;
        void load();
        return;
      }
      if (!event.target.closest("[data-owner-filters]")) return;
      if (event.target.name === "role") state.role = event.target.value;
      if (event.target.name === "subscription") state.subscription = event.target.value;
      if (event.target.name === "status") state.status = event.target.value;
      if (event.target.name !== "search") {
        state.segment = "";
        state.page = 1;
        void load();
      }
    }

    function onSubmit(event) {
      const customRoleForm = event.target.closest("[data-owner-custom-role-create], [data-owner-custom-role-update]");
      if (customRoleForm) {
        event.preventDefault();
        if (!customRoleForm.reportValidity()) return;
        const values = new FormData(customRoleForm);
        const id = customRoleForm.dataset.ownerCustomRoleUpdate || "";
        const body = { label: values.get("label"), color: values.get("color"), baseRole: values.get("baseRole"), permissions: values.getAll("permissions") };
        if (!id) body.id = values.get("id");
        const submit = customRoleForm.querySelector('[type="submit"]');
        submit.disabled = true;
        void (async () => {
          try {
            const result = await api(id ? `/api/owner-dashboard/custom-roles/${encodeURIComponent(id)}` : "/api/owner-dashboard/custom-roles", { method: id ? "PATCH" : "POST", body: JSON.stringify(body) });
            state.customRoles = id ? state.customRoles.map(role => role.id === id ? result.role : role) : [...state.customRoles, result.role];
            state.customRoles.sort((left, right) => Number(right.rank || 0) - Number(left.rank || 0) || left.label.localeCompare(right.label));
            state.customRoleEditorId = "";
            renderCustomRoles();
            notify(id ? "Custom role updated." : "Custom role created.");
            await load({ preserveLoading: true });
          } catch (error) {
            notify(error.message || "The custom role could not be saved.", "error");
          }
        })().finally(() => { if (submit.isConnected) submit.disabled = false; });
        return;
      }
      const ipBanForm = event.target.closest("[data-owner-ip-ban-form]");
      if (ipBanForm) {
        event.preventDefault();
        if (!ipBanForm.reportValidity()) return;
        const submit = ipBanForm.querySelector('[type="submit"]');
        submit.disabled = true;
        void (async () => {
          try {
            const values = new FormData(ipBanForm);
            const result = await api("/api/owner-dashboard/ip-bans", { method: "POST", body: JSON.stringify({ ip: values.get("ip"), reason: values.get("reason") }) });
            state.ipBans = [result.ban, ...state.ipBans.filter(entry => entry.id !== result.ban.id)];
            renderIpBans();
            notify("IP address blocked.");
            await load({ preserveLoading: true });
          } catch (error) {
            notify(error.message || "The IP address could not be blocked.", "error");
          }
        })().finally(() => { if (submit.isConnected) submit.disabled = false; });
        return;
      }
      const form = event.target.closest("[data-owner-profile-form]");
      if (!form) return;
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      const originalLabel = submit.textContent;
      void (async () => {
        try {
          const mediaInputs = [...form.querySelectorAll(".nyx-owner-media-input")];
          const pending = mediaInputs.map(input => input._nyxOwnerPreparation).filter(Boolean);
          if (pending.length) {
            submit.textContent = "Preparing media…";
            await Promise.all(pending);
          }
          const mediaError = mediaInputs.find(input => input._nyxOwnerMediaError)?._nyxOwnerMediaError;
          if (mediaError) throw mediaError;
          const values = new FormData(form);
          const profile = {
            displayName: values.get("displayName"),
            handle: values.get("handle"),
            bio: values.get("bio"),
            customStatus: values.get("customStatus"),
            status: values.get("status"),
            accentPrimary: values.get("accentPrimary"),
            accentSecondary: values.get("accentSecondary"),
            bannerColor: values.get("bannerColor"),
            displayNameFont: values.get("displayNameFont"),
            displayNameEffect: values.get("displayNameEffect"),
            profileEffect: values.get("profileEffect"),
            avatarDecoration: values.get("avatarDecoration")
          };
          const removals = {
            avatar: values.get("removeAvatar") === "on",
            banner: values.get("removeBanner") === "on"
          };
          for (const kind of ["avatar", "banner"]) {
            const input = form.querySelector(`[name="${kind}File"]`);
            const url = String(values.get(`${kind}Url`) || "").trim();
            if (input?.files?.[0]) {
              if (!input._nyxOwnerDataUrl) throw new Error(`The selected ${kind} is not ready. Choose it again.`);
              removals[kind] = false;
              submit.textContent = `Uploading ${kind}…`;
              profile[`${kind}Url`] = await uploadProfileMedia(state.selectedUser.uid, kind, input._nyxOwnerDataUrl, progress => {
                submit.textContent = `Uploading ${kind} ${progress}%`;
              });
            } else if (url) {
              profile[`${kind}Url`] = url;
            }
          }
          submit.textContent = "Saving…";
          await mutateUser("set_profile", {
            profile,
            removeAvatar: removals.avatar,
            removeBanner: removals.banner
          });
        } catch (error) {
          const errorHost = form.querySelector("[data-owner-media-error]");
          if (errorHost) errorHost.textContent = error.message || "Profile media could not be saved.";
          notify(error.message || "Profile media could not be saved.", "error");
        }
      })().finally(() => {
        if (submit.isConnected) {
          submit.disabled = false;
          submit.textContent = originalLabel;
        }
      });
    }

    function updateCustomRoleColorPreview(event) {
      const color = event.target.closest('[name="color"]');
      const control = color?.closest(".nyx-owner-custom-role-color-control");
      if (control) {
        const codes = { "0": "#000000", "1": "#0000aa", "2": "#00aa00", "3": "#00aaaa", "4": "#aa0000", "5": "#aa00aa", "6": "#ffaa00", "7": "#aaaaaa", "8": "#555555", "9": "#5555ff", a: "#55ff55", b: "#55ffff", c: "#ff5555", d: "#ff55ff", e: "#ffff55", f: "#ffffff" };
        const raw = String(color.value || "").trim().toLowerCase();
        const preview = /^#[0-9a-f]{6}$/.test(raw) ? raw : codes[raw.match(/^&([0-9a-f])$/)?.[1]];
        if (preview) control.querySelector(".nyx-owner-custom-role-swatch")?.style.setProperty("--owner-custom-role", preview);
      }
    }

    function onInput(event) {
      updateCustomRoleColorPreview(event);
      if (event.target.name !== "search" || !event.target.closest("[data-owner-filters]")) return;
      clearTimeout(state.searchTimer);
      state.searchTimer = setTimeout(() => {
        state.segment = "";
        state.search = event.target.value.trim();
        state.page = 1;
        void load();
      }, 280);
    }

    function onKeydown(event) {
      if (event.key !== "Escape") return;
      if (!confirmHost.hidden) {
        (confirmHost.querySelector("[data-owner-confirm-cancel]") || confirmHost.querySelector("[data-owner-reset-close]"))?.click();
      } else if (!drawer.hidden) {
        closeDrawer();
      } else {
        destroy();
      }
    }

    function destroy() {
      state.controller?.abort();
      clearTimeout(state.searchTimer);
      overlay.classList.remove("show");
      document.removeEventListener("keydown", onKeydown);
      setTimeout(() => overlay.remove(), 180);
      if (activeDashboard?.overlay === overlay) activeDashboard = null;
    }

    overlay.addEventListener("click", onClick);
    overlay.addEventListener("change", onChange);
    overlay.addEventListener("input", onInput);
    overlay.addEventListener("submit", onSubmit);
    document.addEventListener("keydown", onKeydown);
    renderLoading();
    void load();
    return { overlay, destroy, refresh: load };
  }

  globalThis.NyxOwnerDashboard = Object.freeze({
    open(options) {
      closeExisting();
      activeDashboard = createDashboard(options);
      return activeDashboard;
    },
    close: closeExisting
  });
})();
