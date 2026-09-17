// Üzenetek: lista, olvasás, válasz, csatolmányok, fogadási beállítás.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Üzenetek: list (Beérkezett / Elküldött) + on-demand message view. All from state.messages. ----
let msgTab = "received"; // "received" | "sent"
let msgOpen = null; // the message currently shown in tab-msg-view
let msgQuery = "", msgSem = "all"; // list search text + semester filter (derived from message dates)
let msgAutoAt = 0; // throttle auto-load retries so a failing fetch can't tight-loop
function renderMessages() {
  const host = $("messages-scroll"); if (!host) return;
  const m = state.messages;
  if (!m || !m.fetchedAt) {
    // No data yet → auto-load silently on open (token is kept warm, so it's quick). Throttled so a
    // failed fetch shows the manual button instead of looping.
    if (isNative && canAutoLogin() && !refreshingMsg && Date.now() - msgAutoAt > 15000) {
      msgAutoAt = Date.now();
      host.innerHTML = `<div class="dash-empty" style="padding:40px 4px">Üzenetek betöltése…</div>`;
      refreshMessages(false); // re-renders when done
      return;
    }
    host.innerHTML = `<div class="empty" style="flex:none;padding:52px 32px 8px"><div class="empty-ic">${icon("mail")}</div>`
      + `<h2>Nincs még üzenet</h2><p>Olvasd be a Neptun beérkezett és elküldött üzeneteidet.</p>`
      + `<button class="btn primary narrow" id="msg-read" style="margin-top:4px">${icon("mail")} Beolvasás</button></div>`;
    const b = $("msg-read"); if (b) b.onclick = () => refreshMessages(true);
    return;
  }
  // Have (possibly stale) data → show it immediately, refresh in the background if older than 3 min.
  if (isNative && canAutoLogin() && !refreshingMsg && (Date.now() - new Date(m.fetchedAt).getTime() > 3 * 60 * 1000)) refreshMessages(false);
  const baseList = msgTab === "sent" ? (m.sent || []) : (m.received || []);
  const seg = (id, label, n) => `<button class="seg-btn${msgTab === id ? " active" : ""}" data-mtab="${id}" type="button">${label}${n ? ` <span class="seg-n">${n}</span>` : ""}</button>`;
  const sems = Array.from(new Set(baseList.map((x) => x.date ? semObj(new Date(x.date)).key : null).filter(Boolean)));
  if (msgSem !== "all" && sems.indexOf(msgSem) < 0) msgSem = "all";
  let html = `<div class="seg" style="margin-bottom:10px">`
    + seg("received", "Beérkezett", m.unread || 0)
    + seg("sent", "Elküldött", 0) + `</div>`;
  html += `<div class="msg-controls">`
    + `<div class="uni-search field-ic msg-search"><span class="ic-left" data-icon="search"></span>`
    +   `<input class="input" id="msg-search" placeholder="Keresés tárgy vagy feladó" autocomplete="off" value="${esc(msgQuery)}" /></div>`
    + `</div>`;
  html += `<div id="msg-list"></div>`;
  html += `<div class="hint center" style="margin-top:16px">${esc(freshText(m.fetchedAt))}</div>`;
  host.innerHTML = html;
  host.querySelectorAll("[data-mtab]").forEach((b) => b.onclick = () => { msgTab = b.dataset.mtab; msgQuery = ""; msgSem = "all"; renderMessages(); });
  const search = $("msg-search"); if (search) search.oninput = (e) => { msgQuery = e.target.value; renderMsgList(); };
  // Semester filter lives in the top bar, next to refresh.
  const semTop = $("msg-sem-top");
  if (semTop) {
    semTop.classList.toggle("on", msgSem !== "all");
    semTop.onclick = () => openList({ title: "Félév", selected: msgSem,
      items: [{ value: "all", label: "Minden félév" }].concat(sems.map((s) => ({ value: s, label: s }))),
      onPick: (v) => { msgSem = v; renderMessages(); } });
  }
  const subEl = $("messages-sub"); if (subEl) subEl.textContent = msgSem === "all" ? "Neptun üzenetek" : ("Félév: " + msgSem);
  renderMsgList();
}
// Fill just the list (keeps the search input focused while typing). Reads msgTab/msgQuery/msgSem.
function renderMsgList() {
  const wrap = $("msg-list"); if (!wrap) return;
  const m = state.messages; if (!m) return;
  let list = msgTab === "sent" ? (m.sent || []) : (m.received || []);
  const q = msgQuery.trim().toLowerCase();
  if (q) list = list.filter((x) => (x.subject || "").toLowerCase().includes(q) || (x.from || "").toLowerCase().includes(q));
  if (msgSem !== "all") list = list.filter((x) => x.date && semObj(new Date(x.date)).key === msgSem);
  if (!list.length) {
    const base = msgTab === "sent" ? "Nincs elküldött üzenet." : "Nincs beérkezett üzenet.";
    wrap.innerHTML = `<div class="dash-empty" style="padding:22px 4px">${(q || msgSem !== "all") ? "Nincs találat." : base}</div>`;
    return;
  }
  let html = `<div class="card">`;
  list.forEach((x) => {
    const who = x.sent ? (x.to ? "Címzett: " + esc(x.to) : "Elküldött") : (x.isSystem ? "Rendszerüzenet" : esc(x.from || "Ismeretlen"));
    html += `<button class="row msg-row${x.unread ? " unread" : ""}" data-msg="${esc(x.id)}" type="button">`
      + `<span class="msg-dot"></span>`
      + `<span class="row-main"><span class="row-title">${esc(x.subject)}</span>`
      + `<span class="row-sub">${[who, esc(ftDate(x.date))].filter(Boolean).join(" · ")}</span></span>`
      + `${x.hasAttachment ? `<span class="msg-clip">${icon("doc")}</span>` : ""}`
      + `<span class="row-chev">${icon("chev")}</span></button>`;
  });
  html += `</div>`;
  wrap.innerHTML = html;
  wrap.querySelectorAll("[data-msg]").forEach((b) => b.onclick = () => {
    msgOpen = list.find((x) => x.id === b.dataset.msg) || null;
    pushScreen("tab-msg-view");
  });
}
async function renderMsgView() {
  const host = $("msg-view-scroll"); if (!host) return;
  const composeHost = $("msg-view-compose"); if (composeHost) composeHost.innerHTML = ""; // reset the floor bar each render
  const x = msgOpen;
  const sub = $("msg-view-sub");
  if (!x) { host.innerHTML = `<div class="dash-empty" style="padding:22px 4px">Nincs megnyitott üzenet.</div>`; return; }
  const party = x.sent ? (x.to || "Címzett") : (x.isSystem ? "Rendszerüzenet" : (x.from || "Neptun"));
  if (sub) sub.textContent = party;
  host.innerHTML = `<div class="card msg-head"><div class="msg-subj">${esc(x.subject)}</div>`
    + `<div class="row-sub" style="margin-top:7px">${esc(party)}</div></div>`
    + `<div id="msg-body"><div class="dash-empty" style="padding:8px 2px">Betöltés…</div></div>`;
  const body = $("msg-body");
  const res = await apiReadMessagePosts(x.id);
  if (!res) { body.innerHTML = `<div class="dash-empty" style="padding:8px 2px">Az üzenet szövege nem tölthető be.</div>`; return; }
  const posts = res.posts;
  // Mark read locally, and in the background tell Neptun we've seen it (so the web/other devices agree).
  if (x.unread && !x.sent) {
    x.unread = false;
    if (state.messages) { state.messages.unread = Math.max(0, (state.messages.unread || 1) - 1); saveState(); }
    apiMarkMessageRead(x.id, posts); // fire-and-forget; don't block the view
  }
  // Pick the text field robustly: known names first, else the longest string field that looks like a body.
  const META = { postId: 1, parentPostId: 1, senderUserId: 1, sendDate: 1, expectedAttachmentsDeletionDate: 1, plainTextPreview: 1 };
  const pickText = (p) => {
    const known = p.htmlText || p.text || p.content || p.body || p.messageText || p.postText || p.messageBody || p.htmlBody || p.htmlContent || p.messageContent || p.description || p.plainTextPreview;
    if (known) return known;
    let best = "";
    for (const k in p) { const v = p[k]; if (typeof v === "string" && v && !META[k] && !/^https?:/.test(v) && v.length > best.length) best = v; }
    return best;
  };
  // Chat bubbles: my posts (senderUserId === my id) align right; the other party's align left with their
  // name. Posts come oldest→newest, so newest sits at the bottom like a chat app (we scroll there).
  const meId = (state.messages && state.messages.meId) || "";
  const names = {}; (res.recipients || []).forEach((r) => { if (r.userId) names[r.userId] = r.printName || ""; });
  body.className = "chat";
  body.innerHTML = posts.map((p) => {
    const txt = pickText(p);
    const when = p.sendDate || p.created || p.sentDate || p.creationDate || p.postDate || p.date || null;
    const mine = !!(meId && p.senderUserId === meId);
    const name = mine ? "Te" : (names[p.senderUserId] || (x.sent ? "" : x.from) || "");
    const inner = txt ? sanitizeHtml(txt)
      : `<span style="opacity:.7">Nincs szöveg.</span> <pre style="white-space:pre-wrap;font-size:11px;color:var(--ink-3)">${esc(JSON.stringify(p, null, 1).slice(0, 800))}</pre>`;
    // Attachments after the text — each a tappable chip (download on confirm).
    const atts = (p.attachments || []).map((a) => {
      const did = a.documentationId || a.documentId || a.id || "";
      const fn = a.fileName || a.name || "Melléklet";
      const sz = a.fileSize ? " · " + fmtBytes(a.fileSize) : "";
      return `<button class="att" type="button" data-att="${esc(p.postId || "")}" data-did="${esc(did)}" data-fn="${esc(fn)}">`
        + `${icon("doc")}<span class="att-n">${esc(fn)}${sz}</span>${icon("download")}</button>`;
    }).join("");
    return `<div class="msg-bubble${mine ? " mine" : ""}">`
      + `${!mine && name ? `<div class="b-name">${esc(name)}</div>` : ""}`
      + `<div class="b-text">${inner}</div>`
      + `${atts ? `<div class="b-atts">${atts}</div>` : ""}`
      + `${when ? `<div class="b-time">${esc(ftDate(when))}</div>` : ""}</div>`;
  }).join("");
  // Attachment tap → confirm → download to Documents/neptunplus/letoltesek.
  body.querySelectorAll("[data-att]").forEach((b) => b.onclick = async () => {
    const fn = b.dataset.fn || "melléklet", postId = b.dataset.att, did = b.dataset.did;
    if (!did) { toast("Ismeretlen melléklet."); return; }
    const ok = await ask({ title: "Letöltöd a mellékletet?", okText: "Letöltés", cancelText: "Mégse", body: esc(fn) });
    if (!ok) return;
    toast("Letöltés…");
    const r = await downloadAttachment(postId, [did], fn);
    if (!r.ok) { toast("Nem sikerült letölteni" + (r.detail ? ": " + r.detail : ".")); return; }
    if (r.native) {
      const open = await ask({ title: "Letöltve", okText: "Megnyitás", cancelText: "Bezár",
        body: `A(z) <b>${esc(r.name)}</b> a <b>Letöltések</b> mappába került.` });
      if (open) { try { await DLP().open({ uri: r.uri, mime: r.mime }); } catch (e) { toast("Nem sikerült megnyitni."); } }
    } else {
      await ask({ title: "Letöltve", okText: "OK",
        body: `Elmentve ide:<br><b>${esc(r.path)}</b><br><br>Megnyitáshoz frissítsd az appot (új verzió kell a Letöltésekbe mentéshez és a megnyitáshoz).` });
    }
  });
  // Reply — a persistent chat composer pinned to the bottom, shown whenever this thread's own reply flag
  // is on (messageData.isReplyEnabled). Automated / no-reply Neptun messages have it false → no composer.
  if (res.replyEnabled) {
    const last = posts[posts.length - 1] || {};
    const lastPostId = last.postId || last.id || "";
    const MAX_FILES = 5;
    const pending = []; // { file, name }
    const bar = document.createElement("div");
    bar.className = "msg-compose";
    bar.innerHTML = `<div class="mc-files" id="mc-files" hidden></div>`
      + `<div class="mc-row">`
      + `<button class="iconbtn mc-attach" id="msg-attach" type="button" title="Csatolás">${icon("clip")}</button>`
      + `<textarea class="input" id="msg-reply-text" rows="1" placeholder="Írj üzenetet…"></textarea>`
      + `<button class="iconbtn send" id="msg-reply-send" type="button" title="Küldés">${icon("send")}</button>`
      + `</div><input type="file" id="msg-file-input" multiple hidden>`;
    (composeHost || host).appendChild(bar); // pinned to the tab floor, outside the scroll (Messenger-style)
    const ta = $("msg-reply-text"), send = $("msg-reply-send"), fileInput = $("msg-file-input"), filesWrap = $("mc-files");
    const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; };
    ta.oninput = grow;
    const renderPending = () => {
      filesWrap.hidden = !pending.length;
      filesWrap.innerHTML = pending.map((p, i) =>
        `<span class="mc-file">${icon("doc")}<span class="mc-file-n">${esc(p.name)}</span><button class="mc-file-x" data-rm="${i}" type="button">${icon("x")}</button></span>`).join("");
      filesWrap.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { pending.splice(+b.dataset.rm, 1); renderPending(); });
    };
    $("msg-attach").onclick = () => fileInput.click();
    fileInput.onchange = () => {
      for (const f of Array.from(fileInput.files || [])) {
        if (pending.length >= MAX_FILES) { toast("Legfeljebb " + MAX_FILES + " fájl."); break; }
        pending.push({ file: f, name: f.name });
      }
      fileInput.value = ""; renderPending();
    };
    const doSend = async () => {
      const text = ta.value.trim();
      if (!text && !pending.length) return;               // need text or at least a file
      if (secOn("confirmSend")) {
        const fileList = pending.length ? `<br><b>Csatolmány:</b> ${pending.map((p) => esc(p.name)).join(", ")}` : "";
        const ok = await ask({ title: "Biztosan elküldöd?", okText: "Küldés", cancelText: "Mégse",
          body: `<b>Címzett:</b> ${esc(party)}${fileList}<br><br>${esc(text).replace(/\n/g, "<br>")}` });
        if (!ok) return;
      }
      ta.disabled = send.disabled = true;
      let fileIds = [];
      try {
        for (let i = 0; i < pending.length; i++) { send.textContent = ""; toast("Feltöltés… (" + (i + 1) + "/" + pending.length + ")"); fileIds.push(await apiUploadFile(pending[i].file)); }
      } catch (e) {
        ta.disabled = send.disabled = false;
        await ask({ title: "Feltöltés nem sikerült", okText: "OK", body: esc(e && e.message ? e.message : String(e)) });
        return;
      }
      const r = await apiSendReply(x.id, text, lastPostId, fileIds);
      if (r.ok) { toast("Elküldve."); renderMsgView(); }               // reload thread → shows the new reply at the bottom
      else { ta.disabled = send.disabled = false; toast("Nem sikerült elküldeni" + (r.detail ? ": " + r.detail : ".")); }
    };
    send.onclick = doSend;
    // Enter sends, Shift+Enter makes a new line (desktop-style chat convenience).
    ta.onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); } };
  }
  // Chat-style: land at the newest message (bottom), like opening a chat thread.
  requestAnimationFrame(() => { host.scrollTop = host.scrollHeight; });
}
// Message post bodies are HTML from Neptun. Allow only basic inline formatting; strip scripts/attrs.
function sanitizeHtml(s) {
  if (!s) return "";
  const div = document.createElement("div");
  div.innerHTML = String(s);
  div.querySelectorAll("script,style,iframe,object,embed").forEach((el) => el.remove());
  div.querySelectorAll("*").forEach((el) => {
    [...el.attributes].forEach((a) => { if (!/^href$/i.test(a.name) || /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name); });
    if (el.tagName === "A") { el.setAttribute("target", "_blank"); el.setAttribute("rel", "noopener"); }
  });
  return div.innerHTML;
}
let refreshingMsg = false;
async function refreshMessages(viaButton) {
  if (isOffline()) { toast("Nincs internet. A mentett adatokat látod."); return; }
  if (refreshingMsg) return;
  refreshingMsg = true;
  if (viaButton) showBusy("Üzenetek frissítése…", true);
  let r; try { await totpTick(); r = await syncMessages(); } catch (e) { r = { ok: false }; }
  finally { refreshingMsg = false; if (viaButton) hideBusy(); }
  renderMessages();
  toast(r && r.ok ? "Üzenetek frissítve." : "Nem sikerült frissíteni.");
}
// Read one message's posts (body) on demand. REST-style path (id is a path segment, controller is
// plural `Messages`): GET api/Messages/<id>/Posts → {data:{posts:[…], recipients:[…]}}.
async function apiReadMessagePosts(id) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return null;
  try {
    const r = await apiGet(sess, "Messages/" + encodeURIComponent(id) + "/Posts");
    const d = r && r.data && r.data.data;
    const posts = d && (Array.isArray(d) ? d : (d.posts || d.messagePosts));
    if (!posts || !posts.length) return null;
    // messageData.isReplyEnabled is the authoritative per-message reply flag (the Neptun web gates the
    // compose form on exactly this). Most automated messages have it false.
    const replyEnabled = !!(d && d.messageData && d.messageData.isReplyEnabled);
    const recipients = (d && d.recipients) || [];
    return { posts, replyEnabled, recipients };
  } catch (e) { return null; }
}
// Mark a message's posts read on the Neptun server (fire-and-forget): POST Messages/<id>/Posts/Processed {postIds}.
async function apiMarkMessageRead(id, posts) {
  const ids = (posts || []).map((p) => p.postId || p.id || p.messagePostId).filter(Boolean);
  if (!ids.length) return false;
  try {
    const sess = await getApiSession();
    if (!sess || !sess.token) return false;
    const r = await apiPost(sess, "Messages/" + encodeURIComponent(id) + "/Posts/Processed", { postIds: ids });
    return !!(r && r.status >= 200 && r.status < 300);
  } catch (e) { return false; }
}
// Send a reply into a message thread: POST Message/ReplyToPost {messageIdToReply, postIdToReply, text,
// temporaryFileIds}. postId = the post we answer (last one), "" is accepted. Returns {ok, detail}.
async function apiSendReply(messageId, text, postId, fileIds) {
  const sess = await getApiSession();
  if (!sess || !sess.token) return { ok: false, detail: "nincs munkamenet" };
  try {
    const r = await apiPost(sess, "Message/ReplyToPost", { messageIdToReply: messageId, postIdToReply: postId || "", text: String(text || ""), temporaryFileIds: fileIds || [] });
    if (r && r.status >= 200 && r.status < 300) return { ok: true };
    let d = r && r.data; if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) {} }
    const msg = d && (d.message || (d.modelStateErrors && d.modelStateErrors[0] && d.modelStateErrors[0].errors && d.modelStateErrors[0].errors[0]));
    return { ok: false, detail: msg || ("hiba (" + (r && r.status) + ")") };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
// Upload one File to Neptun's temp store → returns its temporaryFileId (guid) or throws. Protocol from
// the JS bundle: FileUpStart {maxChunkSize,chunkCount,fileName,fileSize,documentationTypeId,languageId,
// description} → {guid}; FileUp multipart {chunkFile, tempFileGUID} per 1MB chunk; FileUpEnd {tempFileGUID}.
// The multipart POST uses fetch (CapacitorHttp intercepts fetch → routes native, no CORS).
const UP_CHUNK = 1048576;
let msgDocTypeId = ""; // Neptun's allowed documentation type for a new message attachment (server constant)
async function getMsgDocTypeId(sess) {
  if (msgDocTypeId) return msgDocTypeId;
  try { const r = await apiGet(sess, "Message/GetDocumentationsTypeIds"); const d = r && r.data && r.data.data; msgDocTypeId = (d && d.allowedDocumentationTypeForNewFile) || ""; } catch (e) {}
  return msgDocTypeId;
}
async function apiUploadFile(file) {
  const sess = await getApiSession();
  if (!sess || !sess.token) throw new Error("nincs munkamenet");
  const auth = "Bearer " + sess.token, base = sess.base;
  const docType = await getMsgDocTypeId(sess); // required — null type → server rejects ("nincs engedélyezve")
  const start = { maxChunkSize: UP_CHUNK, chunkCount: Math.max(1, Math.ceil(file.size / UP_CHUNK)),
    fileName: file.name, fileSize: file.size, documentationTypeId: docType || null, languageId: null, description: "" };
  const r0 = await apiPost(sess, "FileHandler/FileUpStart", start);
  let d0 = r0 && r0.data; if (typeof d0 === "string") { try { d0 = JSON.parse(d0); } catch (e) {} }
  // The guid may sit at various depths / names depending on the server; try the common ones, else the
  // body's `data` if it's itself the id string.
  const dd = d0 && d0.data;
  const guid = (d0 && (d0.guid || d0.tempFileGUID || d0.tempFileGuid || d0.id))
    || (dd && (typeof dd === "string" ? dd : (dd.guid || dd.tempFileGUID || dd.tempFileGuid || dd.id)))
    || (typeof d0 === "string" ? d0 : "");
  if (!guid) throw new Error("FileUpStart(" + (r0 && r0.status) + "): " + JSON.stringify(d0).slice(0, 260));
  for (let pos = 0; pos < file.size || pos === 0; pos += UP_CHUNK) {
    const fd = new FormData();
    fd.append("chunkFile", new File([file.slice(pos, pos + UP_CHUNK)], file.name));
    fd.append("tempFileGUID", guid);
    const rc = await fetch(base + "FileHandler/FileUp", { method: "POST", headers: { Authorization: auth }, body: fd });
    if (!rc.ok) throw new Error("FileUp hiba (" + rc.status + ")");
    if (file.size === 0) break;
  }
  await apiPost(sess, "FileHandler/FileUpEnd", { tempFileGUID: guid });
  return guid;
}
function DLP() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Downloads; }
const MIMES = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", csv: "text/csv", zip: "application/zip", rar: "application/vnd.rar", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif" };
function guessMime(name) { const e = (name.split(".").pop() || "").toLowerCase(); return MIMES[e] || "application/octet-stream"; }
// Download a message attachment: POST Message/DownloadAttachments {documentationIds, postId} → blob
// (CapacitorHttp returns base64). Save to the phone's public Downloads via the native Downloads plugin
// (returns a content uri, openable); if that plugin isn't in this build, fall back to Documents/neptunplus.
async function downloadAttachment(postId, documentationIds, fileName) {
  if (!isNative) return { ok: false, detail: "csak a telefonos appban" };
  const sess = await getApiSession(); const CH = CHTTP();
  if (!sess || !sess.token || !CH) return { ok: false, detail: "nincs munkamenet" };
  try {
    const res = await CH.post({ url: sess.base + "Message/DownloadAttachments",
      headers: { Authorization: "Bearer " + sess.token, "Content-Type": "application/json" },
      data: { documentationIds: documentationIds, postId: postId }, responseType: "blob" });
    if (!res || res.status < 200 || res.status >= 300) return { ok: false, detail: "hiba (" + (res && res.status) + ")" };
    let b64 = res.data; if (b64 == null || b64 === "") return { ok: false, detail: "üres fájl" };
    if (typeof b64 !== "string") b64 = String(b64);
    const cd = res.headers && (res.headers["content-disposition"] || res.headers["Content-Disposition"]) || "";
    const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
    const name = ((m && decodeURIComponent(m[1])) || fileName || ("melleklet-" + Date.now())).replace(/[\\/:*?"<>|]/g, "_");
    const mime = guessMime(name);
    // Preferred: native → public Letöltések (Downloads), openable.
    const dl = DLP();
    if (dl && dl.saveToDownloads) {
      const r2 = await dl.saveToDownloads({ base64: b64, fileName: name, mime });
      return { ok: true, native: true, uri: r2 && r2.uri, name, mime };
    }
    // Fallback (old APK without the plugin): app Documents folder.
    const fs = FSP(); if (!fs) return { ok: false, detail: "nincs fájlrendszer" };
    const path = BACKUP_DIR + "/letoltesek/" + name;
    await fs.writeFile({ path, data: b64, directory: "DOCUMENTS", recursive: true });
    return { ok: true, native: false, path: "Dokumentumok/" + path, mime };
  } catch (e) { return { ok: false, detail: String(e && e.message || e) }; }
}
function fmtBytes(n) {
  n = +n || 0; if (n < 1024) return n + " B";
  if (n < 1048576) return (n / 1024).toFixed(0) + " KB";
  return (n / 1048576).toFixed(1) + " MB";
}
// ---- Üzenetfogadás: ki írhat nekem (allowedIncomingMessageType: FromEveryone=1 / OnlyFromEmployees=2) ----
// Live Neptun account setting. We READ the whole settings object and, on toggle, echo it back with ONLY
// that one field changed (safest — never guesses/clears the rest). WRITE endpoint unverified on live.
let msgRecvCache = null;
async function apiMsgSettingsGet() {
  const sess = await getApiSession(); if (!sess || !sess.token) return null;
  try { const r = await apiGet(sess, "Message/GetMessageRelatedSettings"); return (r && r.data && r.data.data) || null; } catch (e) { return null; }
}
function msgReceivesEveryone(s) { const t = s && s.messageReceptionSettings && s.messageReceptionSettings.allowedIncomingMessageType; return ((t | 0) & 1) === 1; }
async function msgReceiveRefresh() {
  const b = $("msg-receive-all"); if (!b) return;
  const sub = $("msg-receive-sub");
  if (!isNative || !canAutoLogin() || isOffline()) return; // leave the toggle as-is if we can't check
  const s = await apiMsgSettingsGet(); if (!s) return;
  msgRecvCache = s; b.classList.toggle("on", msgReceivesEveryone(s));
  if (sub) sub.textContent = msgReceivesEveryone(s) ? "Bekapcsolva. A hallgatótársaid is írhatnak neked a Neptunban." : "Most csak az oktatók írhatnak neked. Kapcsold be, hogy a hallgatótársaid is tudjanak.";
}
async function msgReceiveToggle() {
  const b = $("msg-receive-all"); if (!b) return;
  if (!isNative || !canAutoLogin()) { toast("Előbb állítsd be a Neptun belépést."); return; }
  if (isOffline()) { toast("Nincs internet."); return; }
  spinOn(); // pörgő töltő (szöveg nélkül) a hálózati késleltetés idejére
  try {
    const s = await apiMsgSettingsGet(); // mindig friss objektumot írunk vissza
    if (!s || !s.messageReceptionSettings) { toast("Nem sikerült beolvasni a beállítást."); return; }
    const turnOn = !msgReceivesEveryone(s);
    s.messageReceptionSettings.allowedIncomingMessageType = turnOn ? 1 : 2;
    const sess = await getApiSession(); if (!sess || !sess.token) { toast("Nincs munkamenet."); return; }
    const r = await apiPost(sess, "Message/UpdateMessageRelatedSettings", s);
    if (r && r.status >= 200 && r.status < 300) { msgRecvCache = null; await msgReceiveRefresh(); toast(turnOn ? "Mostantól bárki írhat neked." : "Mostantól csak oktatók írhatnak neked."); }
    else { let d = r && r.data; const msg = d && (d.message || (d.modelStateErrors && d.modelStateErrors[0] && d.modelStateErrors[0].errors && d.modelStateErrors[0].errors[0])); toast(msg || "Nem sikerült menteni a beállítást."); }
  } catch (e) { toast("Hiba a mentéskor."); }
  finally { spinOff(); }
}
