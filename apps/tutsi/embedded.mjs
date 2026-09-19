const observed = new WeakSet();
function text(doc, selector, value) {
  const node = doc.querySelector(selector);
  if (node && node.textContent !== value) node.textContent = value;
}
function aiLabels(scope) {
  for (const node of scope.querySelectorAll(
    ".ai-message-assistant .ai-message-meta > strong",
  )) {
    if (node.textContent === "Nyx AI") node.textContent = "Tutsi AI";
  }
  const welcome = scope.querySelector("[data-ai-welcome]");
  if (welcome) {
    text(welcome, ".ai-welcome-kicker", "Tutsi Math");
    text(welcome, "h2", "What do you want to work on?");
    text(welcome, ".ai-welcome-copy", "Choose a model and send a message.");
  }
}
export function decorateEmbedded(doc, app) {
  doc.documentElement.dataset.tutsiApp = app;
  // Rebrand application chrome only, never conversations, profile fields or media titles.
  const brandSelectors = 'header,.brand,.brand-copy,.ai-brand-copy,.ai-sidebar-brand,.ai-disclaimer,.chat-brand,.catalog-head,.hero,.utility-intro,.nyx-user-profile-tabs,.nyx-profile-rail-title,.nyx-user-profile-section-title,.nyx-founder-about strong,.nyx-user-profile-meta-label,.nyx-profile-directory-empty,.nyx-founder-editor-error,.nyx-profile-member-since,.nyx-user-profile-section strong,#profile-status';
  const rebrand = () => {
    for (const root of doc.querySelectorAll(brandSelectors)) {
      const walker = doc.createTreeWalker(root, 4);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest('input,textarea,script,style,[contenteditable],.ai-message,.chat-message,.nyx-founder-bio,.nyx-user-profile-heading')) continue;
        const value = node.nodeValue.replace(/\bNyxTube\b/gi,'YouTube').replace(/\bNyxify\b/gi,'Music').replace(/\bNyx\b/gi,'Tutsi');
        if (value !== node.nodeValue) node.nodeValue = value;
      }
      for (const node of [root,...root.querySelectorAll('[aria-label],[title],[alt]')]) for(const attr of ['aria-label','title','alt']) {
        const value=node.getAttribute(attr);
        if(value && /\bnyx\b/i.test(value)) node.setAttribute(attr,value.replace(/\bnyx\b/gi,'Tutsi'));
      }
    }
  };
  rebrand();
  if(!observed.has(doc)) { observed.add(doc); new MutationObserver(rebrand).observe(doc.body,{childList:true,subtree:true}); }

  if (!doc.getElementById("tutsi-embedded-style")) {
    const link = doc.createElement("link");
    link.id = "tutsi-embedded-style";
    link.rel = "stylesheet";
    link.href = "/apps/tutsi/embedded.css?v=20260919-movie-hover";
    doc.head.append(link);
  }
  doc.title =
    "Tutsi Math - " +
    ({
      ai: "AI",
      youtube: "YouTube",
      music: "Music",
      games: "Games",
      movies: "Movies",
    }[app] || app);
  const labels = {
    chat: "Chat",
    code: "Code Sandbox",
    checker: "Link Checker",
    links: "Link Generator",
    publisher: "Publisher",
    api: "API",
    movies: "Movies",
  };
  for (const node of doc.querySelectorAll(
    ".brand-copy strong,.lc-brand strong,.chat-brand strong",
  ))
    node.textContent = app === "checker" ? "Link Checker" : "Tutsi Math";
  text(doc, ".assistant-brand small", "Tutsi workspace");
  text(doc, ".assistant-welcome .eyebrow", "Tutsi AI");
  text(
    doc,
    ".utility-intro p",
    app === "publisher" ? "SVG batch publishing" : "Links",
  );
  if (app === "api") {
    text(doc, ".hero h1", "API");
    text(doc, ".hero p", "Tutsi Math");
  }
  for (const img of doc.querySelectorAll(
    ".brand-logo,.brand-mark img,.watch-brand img,.chat-brand img",
  ))
    img.src = "/apps/tutsi/icon.png?v=2";
  for (const link of doc.querySelectorAll(".brand-lockup[href],.brand-mark[href],.utility-nav a[href],.home-link[href],.chat-brand[href],.hero > a[href]")) {
    const url = new URL(link.getAttribute("href"), doc.location.href);
    const routes = {
      "/": "home",
      "/apps/link-checker/": "checker",
      "/apps/link-generator/": "links",
      "/apps/jsdelivr-publisher/": "publisher",
    };
    if (url.origin === location.origin && routes[url.pathname]) {
      link.href = "/tutsi#" + routes[url.pathname];
      link.target = "_top";
      if (url.pathname === "/") {
        link.setAttribute("aria-label", "Back to Tutsi");
        if (link.textContent.trim() && !link.classList.contains("icon-control")) link.textContent = "Back to Tutsi";
      }
    }
  }
  if(app === "cloud"){
    text(doc,'.hero h1','Cloud Gaming');text(doc,'.hero .intro','Choose a game to start a session.');
    text(doc,'.brand small','Tutsi Math');
    if(!doc.getElementById('tutsi-local-games')){const link=doc.createElement('a');link.id='tutsi-local-games';link.href='/tutsi#games';link.textContent='Browser games';link.addEventListener('click',event=>{event.preventDefault();location.hash='games';});doc.querySelector('.catalog-heading')?.append(link);}
  }
  if (app === "movies") {
    text(doc, ".movie-brand span", "Movies");
    const watch = doc.querySelector(".watch-brand");
    if (watch)
      for (const node of watch.childNodes)
        if (node.nodeType === 3) node.textContent = "Movies";
  }
  if (labels[app]) doc.title = "Tutsi Math - " + labels[app];
  if (app === "ai") {
    text(doc, ".ai-brand-copy > span", "Tutsi Math");
    text(doc, ".ai-brand-copy h1", "AI");
    text(doc, ".ai-sidebar-brand strong", "Tutsi AI");
    text(doc, ".ai-sidebar-brand small", "Chats");
    text(
      doc,
      ".ai-disclaimer",
      "AI can make mistakes. Check important information.",
    );
    aiLabels(doc);
    const conversation = doc.getElementById("conversation");
    if (conversation && !observed.has(conversation)) {
      observed.add(conversation);
      // Update app-owned labels only; never rewrite a conversation's text.
      const observer = new MutationObserver((records) => {
        if (
          records.some((record) =>
            [...record.addedNodes].some(
              (node) =>
                node.nodeType === 1 &&
                (node.matches?.(".ai-message,[data-ai-welcome]") ||
                  node.querySelector?.(".ai-message,[data-ai-welcome]")),
            ),
          )
        )
          aiLabels(doc);
      });
      observer.observe(conversation, { childList: true, subtree: true });
    }
  }
  if (app === "youtube") {
    text(doc, ".catalog-head h1", "YouTube");
    text(doc, ".catalog-head p", "Videos and Shorts");
  }
  if (app === "music") {
    text(doc, ".nyxify-brand strong", "Music");
    text(doc, ".nyxify-brand small", "Tutsi Math");
    const brand = doc.querySelector(".nyxify-brand");
    brand?.setAttribute("aria-label", "Tutsi Math Music");
    text(doc, "#emptyTitle", "Search music");
    text(doc, "#emptySub", "Songs, artists, and albums");
    if (doc.querySelector("#nowPlayingContext")?.textContent === "Nyxify")
      text(doc, "#nowPlayingContext", "Music");
  }
  if (app === "games") {
    text(doc, ".cove-header h1", "Games");
    text(doc, ".cove-header .eyebrow", "Tutsi Math");
    text(doc, ".cove-header .subtitle", "");
  }
}
