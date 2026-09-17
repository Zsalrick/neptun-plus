// Barátok: diákok gyűjtése, önfelismerés, hallgató adatlap.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Barátok (helyi, profilonként; a névsor stabil id-jét használjuk, ha van, különben normalizált név) ----
function friendId(s) {
  const raw = s.studentNeptunCode || s.neptunCode || s.contactId || s.studentId || s.id;
  if (raw != null && String(raw).trim()) return "id:" + String(raw).trim();
  return "nm:" + searchNorm(studentName(s));
}
function studentName(s) { return s.printname || s.name || s.studentName || s.fullName || s.nickname || "Hallgató"; }
// A névsorok ugyanarra az emberre kurzusonként MÁS studentId-t adhatnak, ezért a kulcs mellett
// névre is illesztünk, különben egy másik óra névsorában nem ismernénk fel a barátot.
let friendNamesCache = null;
function friendNames() {
  if (friendNamesCache) return friendNamesCache;
  const set = new Set(), f = state.friends || {};
  for (const k in f) { const n = searchNorm(f[k] || ""); if (n) set.add(n); }
  return (friendNamesCache = set);
}
function isFriend(s) {
  if (state.friends && state.friends[friendId(s)]) return true;
  const nk = searchNorm(studentName(s));
  return !!nk && friendNames().has(nk);
}
function toggleFriendKey(k, name) {
  state.friends = state.friends || {};
  if (state.friends[k]) delete state.friends[k];
  else {
    state.friends[k] = name || "";
    // ugyanazon név más kulcsain lévő bejegyzéseket nem duplázzuk
  }
  friendNamesCache = null;
  saveState();
}
// Barát levétele mindenhonnan: a név alatt futó összes kulcsot törli, különben a név-illesztés
// miatt barát maradna akkor is, ha az egyik kulcsát levettük.
function removeFriendByName(name) {
  const nk = searchNorm(name || ""), f = state.friends || {};
  for (const k of Object.keys(f)) if (searchNorm(f[k] || "") === nk) delete f[k];
  friendNamesCache = null;
  saveState();
}
function toggleFriend(s) {
  if (isFriend(s)) removeFriendByName(studentName(s));
  else toggleFriendKey(friendId(s), studentName(s));
}
function friendsInRoster(list) { let n = 0; for (const s of (list || [])) if (isFriend(s)) n++; return n; }
// A saját nevünk kinyerése egy már lekért válaszból. Csak nevesített SZEMÉLYNÉV-mezők, semmi
// heurisztika: a trainingName/programName is tartalmaz szóközt, azt nem szabad névnek nézni.
function harvestMyName(o) {
  if (!o) return;
  // A képzés nevét eltesszük: ezzel szűrünk, ha több "én" jelölt akad a névsorokban.
  if (o.trainingName && o.trainingName !== state.myTraining) { state.myTraining = o.trainingName; saveState(); }
  if (state.myName) return;
  for (const k of ["studentName", "studentPrintName", "printName", "studentFullName", "fullName"]) {
    const v = o[k];
    if (typeof v === "string" && v.trim().length >= 4 && v.length <= 80 && /\s/.test(v.trim()) && !/szak|képzés|training|program|tagozat/i.test(v)) {
      state.myName = v.trim(); saveState(); return;
    }
  }
}
// Magunk felismerése a névsorban: elsőként Neptun-kód egyezés, különben a tokenből mentett név.
function isMe(s) {
  const sid = s.studentId || s.id;
  if (state.myId && sid && String(sid) === state.myId) return true; // a legerősebb: stabil studentId
  const code = String(state.neptunCode || "").toUpperCase();
  if (code) { const raw = s.studentNeptunCode || s.neptunCode; if (raw && String(raw).trim().toUpperCase() === code) return true; }
  const mn = searchNorm(state.myName || "");
  return !!mn && searchNorm(studentName(s)) === mn;
}
// Magunk automatikus felismerése: MINDEN kurzusunk névsorában ott vagyunk, a többiek csak
// egy részében. Ha több jelölt marad (egy csoportba járók), a képzés nevével szűrünk.
async function identifyMe(people, tally, rosters) {
  if (state.myId || state.myName || rosters < 2) return;
  let cand = Object.keys(tally).filter((k) => tally[k] === rosters);
  if (!cand.length) return;
  if (cand.length > 1 && state.myTraining) {
    const sess = await getApiSession();
    const mine = searchNorm(state.myTraining), keep = [];
    for (const k of cand.slice(0, 8)) {
      const id = people[k] && people[k].id; if (!id || !sess) continue;
      try {
        const u = await apiGet(sess, "UserSearch/GetUserData", { userId: id });
        const d = (u.data && u.data.data) || {};
        const tn = (d.additionalStudentData && d.additionalStudentData.trainingNames) || [];
        if (tn.some((x) => searchNorm(x) === mine)) keep.push(k);
      } catch (e) {}
    }
    if (keep.length) cand = keep;
  }
  if (cand.length !== 1) return; // bizonytalan → marad a kézi megadás
  const me = people[cand[0]];
  state.myName = me.n; state.myId = me.id || ""; saveState();
  toast("Felismertelek: " + me.n);
}
// Az összes kurzusom névsorának összegyűjtése egy kereshető listába (state.people).
// Kurzusonként egy hívás, ezért folyamatjelzővel megy és csak kérésre indul.
let friendsBusy = null;
async function collectPeople() {
  if (friendsBusy) return;
  const sess = await getApiSession();
  if (!sess || !sess.token) { toast("Nincs kapcsolat a Neptunnal."); return; }
  const evs = await apiCalendarEvents();
  const termId = await getActualTermId(sess);
  const seen = new Set(), courses = [];
  for (const ev of evs || []) {
    if (!ev.courseId || !ev.subjectId) continue;
    const k = ev.courseId + "|" + ev.subjectId;
    if (seen.has(k)) continue;
    seen.add(k); courses.push(ev);
  }
  if (!courses.length) { toast("Nem találtam kurzust az órarendedben."); return; }
  friendsBusy = { done: 0, total: courses.length }; renderFriends();
  const tally = {}; // k → hány névsorban szerepel EBBEN a futásban (a felismeréshez)
  const subjMap = {}; // subjectId → tárgynév, a már letöltött tárgylistából
  ((state.courses && state.courses.list) || []).forEach((c) => { if (c.subjectId && c.name) subjMap[c.subjectId] = c.name; });
  // Ugyanaz a név ne szerepeljen két kulcson (a névsorok nem mindig adják ugyanazt az azonosítót).
  // Egyben összevonjuk a korábbi gyűjtésekből maradt azonos nevű duplikátumokat is.
  const people = {}, byName = {};
  for (const k of Object.keys(state.people || {})) {
    const p = state.people[k], nk = searchNorm(p.n || "");
    const ex = byName[nk];
    if (ex) { const t = people[ex]; (p.c || []).forEach((x) => { if (t.c.indexOf(x) < 0) t.c.push(x); }); if (!t.id && p.id) t.id = p.id; continue; }
    // A korábbi futásokból bekerült kurzuskódokat (ONVH_N1 alak) eldobjuk, nem tárgynevek.
    byName[nk] = k; people[k] = { n: p.n, c: (p.c || []).filter((x) => !/^[A-Z]{2,6}_[A-Z0-9]{1,4}$/.test(x)), id: p.id || "", nk: p.nk || "" };
  }
  let rosters = 0;
  for (const ev of courses) {
    // A tárgy neve elsősorban a MÁR MEGLÉVŐ tárgylistából (ingyen, és minden félévre megvan).
    // Tartalék a GetSubjectDetails. Az esemény title-je NEM jó: az a kurzus kódja (pl. ONVH_N1),
    // nem a tárgykód, ezért inkább semmit nem írunk ki, mint azt.
    let cn = subjMap[ev.subjectId] || "";
    if (!cn) { try { const d = await apiGet(sess, "SubjectCourse/GetSubjectDetails", { courseId: ev.courseId, subjectId: ev.subjectId, termId }); cn = (d && d.data && d.data.data && d.data.data.subjectName) || ""; } catch (e) {} }
    try {
      const r = await apiGet(sess, "SubjectCourse/GetSubjectCourseStudents", { courseId: ev.courseId, subjectId: ev.subjectId, selectedTermId: termId, firstRow: 0, lastRow: 500 });
      const list = (r && r.data && r.data.data) || [];
      if (list.length) {
        rosters++;
        for (const s of list) {
          const nm = studentName(s), nk = searchNorm(nm);
          let k = friendId(s);
          if (byName[nk] && byName[nk] !== k) k = byName[nk]; // azonos név → egy bejegyzés
          byName[nk] = k;
          tally[k] = (tally[k] || 0) + 1;
          const p = people[k] || (people[k] = { n: nm, c: [], id: s.studentId || s.id || "" });
          if (!p.id && (s.studentId || s.id)) p.id = s.studentId || s.id;
          if (!p.nk && s.nickname) p.nk = s.nickname;
          if (cn && p.c.indexOf(cn) < 0) p.c.push(cn);
        }
      }
    } catch (e) {}
    friendsBusy.done++; renderFriends();
  }
  friendsBusy = null;
  await identifyMe(people, tally, rosters);
  for (const k of Object.keys(people)) { // magunkat kivesszük a diáklistából
    const p = people[k];
    if ((state.myId && p.id === state.myId) || (state.myName && searchNorm(p.n) === searchNorm(state.myName))) delete people[k];
  }
  state.people = people; saveState(); renderFriends();
  toast(Object.keys(people).length + " diák a listádban.");
}

// ---- Egy hallgató részletei (nyílra koppintva) ----
let personKey = "", personTmp = null;
function openPerson(k, seed) {
  personKey = k;
  personTmp = ((state.people || {})[k]) ? null : (seed || null);
  pushScreen("tab-person");
}
function personRec() {
  const p = (state.people || {})[personKey];
  if (p) return p;
  if (personTmp) return personTmp;
  const nm = state.friends && state.friends[personKey];
  return nm ? { n: nm, c: [] } : null;
}
async function renderPerson() {
  const host = $("person-scroll"); if (!host) return;
  const p = personRec();
  const ttl = $("person-title");
  if (!p) { if (ttl) ttl.textContent = "Hallgató"; host.innerHTML = `<div class="dash-empty" style="padding:24px 2px">Nincs adat erről a hallgatóról.</div>`; return; }
  if (ttl) ttl.textContent = p.n || "Hallgató";
  const isF = !!(state.friends && state.friends[personKey]) || (!!searchNorm(p.n || "") && friendNames().has(searchNorm(p.n || "")));
  const courses = p.c || [];
  const rows = [["Név", p.n || "—"]];
  if (p.nk && searchNorm(p.nk) !== searchNorm(p.n || "")) rows.push(["Becenév", p.nk]);
  if (p.tr && p.tr.length) rows.push(["Képzés", p.tr.join(", ")]);
  rows.push(["Közös órák", String(courses.length)]);
  rows.push(["Kapcsolat", isF ? "Barát" : "Nem barát"]);
  let h = `<div class="card kv">` + rows.map(([k, v]) => `<div class="kv-row"><span class="kv-k">${esc(k)}</span><span class="kv-v">${esc(v)}</span></div>`).join("") + `</div>`;
  h += `<div class="detail-add" style="margin-top:14px"><button class="btn tonal friend-btn${isF ? " rm" : ""}" id="person-fr">${isF ? icon("x") + " Barát törlése" : icon("plus") + " Barát hozzáadása"}</button></div>`;
  if (courses.length) h += `<div class="dash-label">Közös órák</div><div class="card">` + courses.map((c) => `<div class="row"><span class="row-ic">${icon("book")}</span><span class="row-main"><span class="row-title">${esc(c)}</span></span></div>`).join("") + `</div>`;
  else h += `<div class="dash-empty" style="padding:18px 2px">Nincs ismert közös órád vele. Gyűjtsd össze a diákokat a Barátok oldalon.</div>`;
  host.innerHTML = h;
  $("person-fr").onclick = () => {
    if (isF) removeFriendByName(p.n); else toggleFriendKey(personKey, p.n || "");
    renderPerson();
  };
  // A képzést csak igény szerint kérjük le, és eltesszük, hogy egyszer fusson.
  if (!p.tr && p.id && isNative) {
    try {
      const sess = await getApiSession();
      const u = await apiGet(sess, "UserSearch/GetUserData", { userId: p.id });
      const d = (u && u.data && u.data.data) || {};
      p.tr = (d.additionalStudentData && d.additionalStudentData.trainingNames) || [];
      if (!p.nk && d.nickname) p.nk = d.nickname;
      saveState(); renderPerson();
    } catch (e) { p.tr = []; }
  }
}
let friendsQuery = "";
function renderFriends() {
  const host = $("friends-scroll"); if (!host) return;
  const q = $("friends-q");
  if (q && !q.dataset.wired) { q.dataset.wired = "1"; q.oninput = () => { friendsQuery = q.value; renderFriends(); }; }
  const people = state.people || {}, fr = state.friends || {};
  const norm = searchNorm(friendsQuery);
  const entries = Object.keys(people).map((k) => ({ k, n: people[k].n || "", c: people[k].c || [] }));
  // A barátok azok is, akiket még nem gyűjtöttünk be (pl. egy óra névsorából jelölted).
  // Névre is nézünk, hogy ugyanaz az ember ne jelenjen meg kétszer másik kulcson.
  const seenNames = new Set(entries.map((e) => searchNorm(e.n)));
  Object.keys(fr).forEach((k) => {
    const n = fr[k] || "", nk = searchNorm(n);
    if (!people[k] && nk && !seenNames.has(nk)) { seenNames.add(nk); entries.push({ k, n, c: [] }); }
  });
  const isFriendEntry = (e) => !!fr[e.k] || (!!searchNorm(e.n) && friendNames().has(searchNorm(e.n)));
  const hit = (e) => !norm || searchNorm(e.n).includes(norm);
  const friends = entries.filter(isFriendEntry).filter(hit).sort((a, b) => a.n.localeCompare(b.n, "hu"));
  const others = entries.filter((e) => !isFriendEntry(e)).filter(hit).sort((a, b) => a.n.localeCompare(b.n, "hu"));
  const row = (e, isF) => `<div class="row fr-row" data-fk="${esc(e.k)}" style="cursor:pointer"><span class="row-ic">${icon("user")}</span>`
    + `<span class="row-main"><span class="row-title">${isF ? `<span style="color:#5fa878">● </span>` : ""}${esc(e.n)}</span>`
    + (e.c.length ? `<span class="row-sub">${esc(e.c.slice(0, 2).join(" · "))}${e.c.length > 2 ? " · +" + (e.c.length - 2) : ""}</span>` : "")
    + `</span>${icon("chev")}</div>`;
  let h = `<div class="dash-label">Én</div><div class="card"><div class="row" id="fr-me" style="cursor:pointer"><span class="row-ic">${icon("user")}</span>`
    + `<span class="row-main"><span class="row-title">${esc(state.myName || "Ismeretlen név")}</span>`
    + `<span class="row-sub">${state.myName ? esc(state.neptunCode || "") + (state.neptunCode ? " · " : "") + "koppints a módosításhoz" : "Koppints, és add meg a neved"}</span></span>${icon("chev")}</div></div>`;
  if (friendsBusy) h += `<div class="hint" style="margin:12px 2px">Összegyűjtés… ${friendsBusy.done} / ${friendsBusy.total} kurzus</div>`;
  else h += `<div class="detail-add" style="margin-top:12px"><button class="btn tonal" id="fr-collect">${entries.length ? "Frissítés az óráimból" : "Diákok összegyűjtése az óráimból"}</button></div>`;
  h += `<div class="dash-label">Barátok${friends.length ? " · " + friends.length : ""}</div>`;
  h += friends.length ? `<div class="card">` + friends.map((e) => row(e, true)).join("") + `</div>`
    : `<div class="dash-empty" style="padding:18px 2px">Még nincs barátod. Gyűjtsd össze a diákokat, vagy jelöld őket egy óra névsorából.</div>`;
  if (others.length) h += `<div class="dash-label">Hallgatók · ${others.length}</div><div class="card">` + others.map((e) => row(e, false)).join("") + `</div>`;
  else if (entries.length && norm) h += `<div class="dash-empty" style="padding:18px 2px">Nincs találat.</div>`;
  host.innerHTML = h;
  const cb = $("fr-collect"); if (cb) cb.onclick = collectPeople;
  const mb = $("fr-me"); if (mb) mb.onclick = async () => {
    const v = await askText({ title: "A te neved", value: state.myName || "", placeholder: "Például: Kovács Anna",
      body: "Írd be a neved úgy, ahogy a Neptun névsoraiban szerepel. Ez alapján ismerlek fel a diáklistákban, és kerülsz az „Én” csoportba." });
    if (v != null) { state.myName = v.trim(); saveState(); renderFriends(); }
  };
  host.querySelectorAll(".fr-row").forEach((b) => b.onclick = () => openPerson(b.dataset.fk));
}
