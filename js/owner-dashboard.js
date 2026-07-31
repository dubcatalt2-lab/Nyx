(() => {
  "use strict";

  const esc = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
  const roleLabel = value => ({ owner: "Owner", admin: "Admin", developer: "Developer", moderator: "Moderator", member: "Member" }[value] || "Member");
  const roleIcon = role => `<img class="nyx-owner-role-icon" src="/assets/icons/roles/${esc(role)}.png" alt="" aria-hidden="true">`;
  const subscriptionLabel = value => ({
    free: "Free", premium: "Premium", trialing: "Trial", past_due: "Past due", canceled: "Canceled"
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
      activity: '<path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/>'
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
      loading: false,
      controller: null,
      searchTimer: 0,
      selectedUser: null
    };
    const overlay = document.createElement("section");
    overlay.className = "nyx-owner-dashboard-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "nyxOwnerDashboardTitle");
    overlay.innerHTML = `
      <main class="nyx-owner-dashboard">
        <header class="nyx-owner-header">
          <div><span class="nyx-owner-eyebrow">NYX CONTROL CENTER</span><h1 id="nyxOwnerDashboardTitle">Owner Dashboard</h1><p>Manage accounts, subscriptions, security, and activity.</p></div>
          <div class="nyx-owner-header-actions">
            <button type="button" data-owner-refresh>${dashboardIcon("refresh")}<span>Refresh</span></button>
            <button class="nyx-owner-close" type="button" data-owner-close aria-label="Close owner dashboard">${dashboardIcon("close")}</button>
          </div>
        </header>
        <section class="nyx-owner-metrics" data-owner-metrics aria-label="Account metrics"></section>
        <section class="nyx-owner-workspace">
          <div class="nyx-owner-users-panel">
            <header class="nyx-owner-panel-head">
              <div><h2>Users</h2><span data-owner-user-count>Loading accounts…</span></div>
              <div class="nyx-owner-quick-actions">
                <button type="button" data-owner-online-only>${dashboardIcon("online")}Online users</button>
                <button type="button" data-owner-export>${dashboardIcon("download")}Export page</button>
              </div>
            </header>
            <form class="nyx-owner-filters" data-owner-filters>
              <label class="nyx-owner-search">${dashboardIcon("search")}<input type="search" name="search" placeholder="Search name, username, email, or UID" autocomplete="off"></label>
              <select name="role" aria-label="Filter by role"><option value="all">All roles</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="developer">Developer</option><option value="moderator">Moderator</option><option value="member">Member</option></select>
              <select name="subscription" aria-label="Filter by subscription"><option value="all">All subscriptions</option><option value="free">Free</option><option value="premium">Premium</option><option value="trialing">Trial</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select>
              <select name="status" aria-label="Filter by account status"><option value="all">All accounts</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option><option value="online">Online now</option><option value="offline">Offline</option></select>
            </form>
            <div class="nyx-owner-table-wrap" data-owner-table aria-live="polite"></div>
            <footer class="nyx-owner-pagination" data-owner-pagination></footer>
          </div>
          <aside class="nyx-owner-activity-panel">
            <header><div><h2>Recent activity</h2><span>Security and account events</span></div>${dashboardIcon("activity")}</header>
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
      if (!token) throw new Error("Your owner session has expired. Sign in again.");
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
      overlay.querySelector("[data-owner-user-count]").textContent = `${data.pagination.total.toLocaleString()} matching · ${data.pagination.scanned.toLocaleString()} total${data.pagination.truncated ? " (scan capped)" : ""}`;
      if (!users.length) {
        tableHost.innerHTML = '<div class="nyx-owner-empty"><strong>No users found</strong><span>Try changing the search or filters.</span></div>';
      } else {
        tableHost.innerHTML = `<table class="nyx-owner-table">
          <thead><tr><th>${sortButton("displayName", "User")}</th><th>${sortButton("role", "Role")}</th><th>${sortButton("subscriptionStatus", "Subscription")}</th><th>${sortButton("createdAt", "Created")}</th><th>${sortButton("lastSignInAt", "Last sign-in")}</th><th>${sortButton("lastActiveAt", "Last active")}</th><th>Email verified</th><th>${sortButton("status", "Status")}</th><th><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>${users.map(user => `<tr data-owner-user-row="${esc(user.uid)}">
            <td><button class="nyx-owner-user-cell" type="button" data-owner-view-user="${esc(user.uid)}"><span class="nyx-owner-avatar">${user.photoUrl ? `<img src="${esc(user.photoUrl)}" alt="">` : esc((user.displayName || "?").slice(0, 1).toUpperCase())}<i class="${user.online ? "online" : ""}"></i></span><span><span class="nyx-owner-user-name-row"><strong>${esc(user.displayName)}</strong><span class="nyx-owner-presence-state ${user.online ? "online" : "offline"}"><i></i>${user.online ? "Online" : "Offline"}</span></span><small>@${esc(user.username)} · ${esc(user.email || "No email")}</small></span></button></td>
            <td><span class="nyx-owner-badge role-${esc(user.role)}">${roleIcon(user.role)}${esc(roleLabel(user.role))}</span></td>
            <td><span class="nyx-owner-badge subscription-${esc(user.subscriptionStatus)}">${esc(subscriptionLabel(user.subscriptionStatus))}</span></td>
            <td><span title="${esc(dateLabel(user.createdAt))}">${esc(relativeLabel(user.createdAt))}</span></td>
            <td><span title="${esc(dateLabel(user.lastSignInAt))}">${esc(relativeLabel(user.lastSignInAt))}</span></td>
            <td><span title="${esc(dateLabel(user.lastActiveAt))}">${esc(relativeLabel(user.lastActiveAt))}</span></td>
            <td><span class="nyx-owner-verified ${user.deliverableEmail && user.emailVerified ? "verified" : ""}">${user.deliverableEmail ? (user.emailVerified ? "Verified" : "Unverified") : "N/A"}</span></td>
            <td><span class="nyx-owner-account-state ${user.disabled ? "disabled" : "enabled"}"><i></i>${user.disabled ? "Disabled" : "Enabled"}</span></td>
            <td><button class="nyx-owner-row-action" type="button" data-owner-view-user="${esc(user.uid)}" aria-label="View ${esc(user.displayName)}">${dashboardIcon("chevron")}</button></td>
          </tr>`).join("")}</tbody></table>`;
      }
      const pagination = data.pagination || {};
      paginationHost.innerHTML = `<span>Page ${pagination.page || 1} of ${pagination.pages || 1}</span><div><label>Rows <select data-owner-page-size><option value="10">10</option><option value="25">25</option><option value="50">50</option><option value="100">100</option></select></label><button type="button" data-owner-page="${Math.max(1, (pagination.page || 1) - 1)}" ${(pagination.page || 1) <= 1 ? "disabled" : ""}>Previous</button><button type="button" data-owner-page="${Math.min(pagination.pages || 1, (pagination.page || 1) + 1)}" ${(pagination.page || 1) >= (pagination.pages || 1) ? "disabled" : ""}>Next</button></div>`;
      paginationHost.querySelector("[data-owner-page-size]").value = String(state.pageSize);
    }

    function renderActivity(activity = []) {
      activityHost.innerHTML = activity.length ? activity.map(event => `<article class="nyx-owner-activity-item"><i class="nyx-owner-activity-dot"></i><div><strong>${esc(actionLabel(event.action))}</strong><p>${esc(event.targetEmail || event.actorEmail || event.targetUid || "System event")}</p><span title="${esc(dateLabel(event.createdAt))}">${esc(relativeLabel(event.createdAt))}${event.actorEmail && event.actorEmail !== event.targetEmail ? ` · by ${esc(event.actorEmail)}` : ""}</span></div></article>`).join("") : '<div class="nyx-owner-empty compact"><strong>No activity yet</strong><span>Owner and account events will appear here.</span></div>';
    }

    function renderError(error) {
      tableHost.innerHTML = `<div class="nyx-owner-error"><strong>Dashboard could not load</strong><span>${esc(error.message || "Try again.")}</span><button type="button" data-owner-refresh>Try again</button></div>`;
      metricsHost.innerHTML = "";
      activityHost.innerHTML = "";
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
      const avatar = profile.avatarUrl
        ? `<img src="${esc(profile.avatarUrl)}" alt="${esc(profile.displayName || user.displayName)}">`
        : `<span>${esc((profile.displayName || user.displayName || "?").slice(0, 1).toUpperCase())}</span>`;
      const banner = profile.bannerUrl ? `<img src="${esc(profile.bannerUrl)}" alt="">` : "";
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
      return `<form class="nyx-owner-profile-editor" data-owner-profile-form>
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
          <label class="wide">Replace avatar from URL<input name="avatarUrl" type="url" placeholder="Leave blank to keep the current image" value="${esc(remoteAvatar)}"></label>
          <label class="wide">Replace banner from URL<input name="bannerUrl" type="url" placeholder="Leave blank to keep the current image" value="${esc(remoteBanner)}"></label>
        </div>
        <div class="nyx-owner-media-removal">
          <label><input name="removeAvatar" type="checkbox"> Remove current avatar</label>
          <label><input name="removeBanner" type="checkbox"> Remove current banner</label>
        </div>
        <p>Owner edits use the same unique-username check as normal profile settings. Blank image URL fields keep uploaded images unchanged.</p>
        <div class="nyx-owner-detail-actions"><button type="submit">Save profile</button></div>
      </form>`;
    }

    async function openUser(uid) {
      drawer.hidden = false;
      drawer.classList.remove("show");
      drawer.innerHTML = '<div class="nyx-owner-drawer-loading"><i></i><i></i><i></i></div>';
      requestAnimationFrame(() => drawer.classList.add("show"));
      try {
        const { user } = await api(`/api/owner-dashboard/users/${encodeURIComponent(uid)}`);
        state.selectedUser = user;
        const avatar = user.photoUrl ? `<img src="${esc(user.photoUrl)}" alt="">` : esc((user.displayName || "?").slice(0, 1).toUpperCase());
        drawer.innerHTML = `<header><div class="nyx-owner-detail-avatar">${avatar}<i class="${user.online ? "online" : ""}"></i></div><div><span>${roleIcon(user.role)}${esc(roleLabel(user.role))} account</span><h2>${esc(user.displayName)}</h2><p class="nyx-owner-drawer-identity">@${esc(user.username)} <span class="nyx-owner-presence-state ${user.online ? "online" : "offline"}"><i></i>${user.online ? "Online" : "Offline"}</span></p></div><button type="button" data-owner-drawer-close aria-label="Close user details">${dashboardIcon("close")}</button></header>
          <div class="nyx-owner-drawer-scroll">
            <section class="nyx-owner-detail-grid">${detailValue("Email", user.deliverableEmail ? user.email : "No email added")}${detailValue("Firebase UID", user.uid, "uid")}${detailValue("Presence", user.online ? "Online now" : "Offline")}${detailValue("Created", dateLabel(user.createdAt))}${detailValue("Last sign-in", dateLabel(user.lastSignInAt))}${detailValue("Last active", dateLabel(user.lastActiveAt))}${detailValue("Email verified", user.deliverableEmail ? (user.emailVerified ? "Verified" : "Not verified") : "Not applicable · username-only")}</section>
            <section class="nyx-owner-detail-section nyx-owner-profile-management"><h3>Public profile</h3>${ownerProfilePreview(user)}<details><summary>Edit this profile</summary>${ownerProfileEditor(user)}</details></section>
            <section class="nyx-owner-detail-section"><h3>Access</h3><label>Role<select data-owner-detail-role ${user.role === "owner" ? "disabled" : ""}><option value="member">Member</option><option value="moderator">Moderator</option><option value="developer">Developer</option><option value="admin">Admin</option><option value="owner" ${user.role === "owner" ? "selected" : "disabled"}>Owner</option></select></label><label>Subscription<select data-owner-detail-subscription><option value="free">Free</option><option value="premium">Premium</option><option value="trialing">Trial</option><option value="past_due">Past due</option><option value="canceled">Canceled</option></select></label><label>Monthly revenue <input data-owner-detail-revenue type="number" min="0" step="0.01" value="${((user.monthlyRevenueCents || 0) / 100).toFixed(2)}"></label><div class="nyx-owner-detail-actions"><button type="button" data-owner-save-access>Save access</button></div></section>
            <section class="nyx-owner-detail-section"><h3>Account actions</h3>${!user.deliverableEmail ? '<p class="nyx-owner-action-note">This username-only account has no inbox. Create a secure reset link and give it directly to the account owner.</p>' : ""}<div class="nyx-owner-action-grid"><button type="button" data-owner-user-action="create_password_reset_link">Create reset link</button><button type="button" data-owner-user-action="send_password_reset" ${!user.deliverableEmail ? "disabled" : ""}>Email reset link</button><button type="button" data-owner-user-action="verify_email" ${user.emailVerified || !user.deliverableEmail ? "disabled" : ""}>Verify email</button><button type="button" data-owner-user-action="${user.disabled ? "enable" : "disable"}" ${user.role === "owner" ? "disabled" : ""}>${user.disabled ? "Re-enable account" : "Disable account"}</button><button class="danger" type="button" data-owner-user-action="delete" ${user.role === "owner" ? "disabled" : ""}>Delete account</button></div></section>
            <section class="nyx-owner-detail-section"><h3>Recent user activity</h3><div class="nyx-owner-user-activity">${(user.recentActivity || []).length ? user.recentActivity.map(event => `<p><strong>${esc(actionLabel(event.action))}</strong><span>${esc(relativeLabel(event.createdAt))}</span></p>`).join("") : "<span>No recorded account actions.</span>"}</div></section>
          </div>`;
        drawer.querySelector("[data-owner-detail-role]").value = user.role;
        drawer.querySelector("[data-owner-detail-subscription]").value = user.subscriptionStatus;
      } catch (error) {
        drawer.innerHTML = `<div class="nyx-owner-error"><strong>User details could not load</strong><span>${esc(error.message)}</span><button type="button" data-owner-drawer-close>Close</button></div>`;
      }
    }

    function closeDrawer() {
      drawer.classList.remove("show");
      setTimeout(() => { drawer.hidden = true; drawer.innerHTML = ""; }, 180);
      state.selectedUser = null;
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
      const columns = ["uid", "displayName", "username", "email", "role", "subscriptionStatus", "createdAt", "lastSignInAt", "lastActiveAt", "emailVerified", "disabled"];
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
      const uid = event.target.closest("[data-owner-view-user]")?.dataset.ownerViewUser;
      if (uid) return void openUser(uid);
      if (event.target.closest("[data-owner-drawer-close]")) return closeDrawer();
      const userAction = event.target.closest("[data-owner-user-action]")?.dataset.ownerUserAction;
      if (userAction) return void mutateUser(userAction);
      if (event.target.closest("[data-owner-save-access]")) {
        const role = drawer.querySelector("[data-owner-detail-role]")?.value;
        const subscriptionStatus = drawer.querySelector("[data-owner-detail-subscription]")?.value;
        const monthlyRevenueCents = Math.round((Number(drawer.querySelector("[data-owner-detail-revenue]")?.value) || 0) * 100);
        const roleChanged = role !== state.selectedUser?.role;
        const subscriptionChanged = subscriptionStatus !== state.selectedUser?.subscriptionStatus || monthlyRevenueCents !== state.selectedUser?.monthlyRevenueCents;
        return void (async () => {
          if (roleChanged) {
            const confirmed = await confirmAction({ title: "Change account role?", message: `${state.selectedUser.email || state.selectedUser.displayName} will become ${roleLabel(role)}.`, confirmLabel: "Change role" });
            if (!confirmed) return;
            await mutateUser("set_role", { role });
          }
          if (subscriptionChanged) await mutateUser("set_subscription", { subscriptionStatus, monthlyRevenueCents });
          if (!roleChanged && !subscriptionChanged) notify("No access changes to save.", "error");
        })();
      }
    }

    function onChange(event) {
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
      const form = event.target.closest("[data-owner-profile-form]");
      if (!form) return;
      event.preventDefault();
      if (!form.reportValidity()) return;
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
      const avatarUrl = String(values.get("avatarUrl") || "").trim();
      const bannerUrl = String(values.get("bannerUrl") || "").trim();
      if (avatarUrl) profile.avatarUrl = avatarUrl;
      if (bannerUrl) profile.bannerUrl = bannerUrl;
      const submit = form.querySelector('[type="submit"]');
      submit.disabled = true;
      submit.textContent = "Saving…";
      void mutateUser("set_profile", {
        profile,
        removeAvatar: values.get("removeAvatar") === "on",
        removeBanner: values.get("removeBanner") === "on"
      }).finally(() => {
        if (submit.isConnected) {
          submit.disabled = false;
          submit.textContent = "Save profile";
        }
      });
    }

    function onInput(event) {
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
