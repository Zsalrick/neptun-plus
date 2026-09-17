// Kereső (Kezdőlap és külön oldal).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Keresés: az appon belül már lementett adatokban (tárgyak, jegyek, üzenetek) ----
let searchQ = "";
// Ékezet-független: á→a, é→e, ő→o stb., hogy "beallitas" is találjon a "Beállítások"-ra.
function searchNorm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); }
// Kereshető oldalak / beállítások: [cím, kulcsszavak, cél]. A cél tab id, vagy "__dlc" a Kiegészítőkhöz.
const NAV_TARGETS = [
  ["Kezdőlap", "fooldal kezdolap home dashboard", "tab-home"],
  ["Órarend", "orarend naptar ora het", "tab-timetable"],
  ["Vizsgák", "vizsga zh szamonkeres kollokvium", "tab-exams"],
  ["Tárgyak", "targyak felvett mintatanterv kurzus", "tab-courses"],
  ["Kredit / Diploma-haladás", "kredit diploma halad elorehaladas felev", "tab-credit"],
  ["Jegyek", "jegyek atlag kreditindex eredmeny osztondij", "tab-grades"],
  ["Kalkulátor", "kalkulator atlag cel szamitas becsles", "tab-calc"],
  ["Időszakok", "idoszak periodus hatarido targyfelvetel", "tab-periods"],
  ["Pénzügyek", "penzugy egyenleg befizetes tartozas szamla tranzakcio", "tab-finance"],
  ["Üzenetek", "uzenet level inbox posta", "tab-messages"],
  ["Beállítások", "beallitas settings opcio konfiguracio", "tab-settings"],
  ["Téma / megjelenés", "tema szin megjelenes sotet vilagos kinezet", "tab-set-theme"],
  ["Értesítések", "ertesites emlekezteto reggeli osszefoglalo valtozas noti push", "tab-set-notify"],
  ["Üzenetfogadás", "uzenetfogadas fogadok mindenkitol beallitas", "tab-set-messages"],
  ["Kétlépcsős hitelesítés", "2fa ketlepcsos totp hitelesites kod authenticator", "tab-set-2fa"],
  ["Fiók", "fiok belepes felhasznalo jelszo azonosito neptun kod", "tab-set-account"],
  ["Egyetem és szerver", "egyetem szerver intezmeny valtas", "tab-set-university"],
  ["Órarend beállítás", "orarend feliratkozas ical link", "tab-set-timetable"],
  ["Védelem", "vedelem biztonsag zar pin biometria ujjlenyomat jelkod", "tab-set-security"],
  ["Alkalmazás", "alkalmazas app frissites verzio ota hangok", "tab-set-app"],
  ["Dokumentumok", "dokumentum aszf adatkezeles jogi tajekoztato", "tab-set-docs"],
  ["Adatok", "adatok export mentes torles biztonsagi profil", "tab-set-data"],
  ["Kiegészítők", "kiegeszito dlc letoltes szak", "__dlc"],
];
function searchGo(tab) { if (tab === "__dlc") { try { openDlc(); } catch (e) {} return; } openTab(tab); }
function renderSearch() {
  const inp = $("search-input"); if (inp) { inp.value = searchQ; inp.oninput = () => { searchQ = inp.value; renderSearchResults(); }; setTimeout(() => { try { inp.focus(); } catch (e) {} }, 60); }
  renderSearchResults();
}
function searchGroups(q) {
  const hit = (...vals) => vals.some((v) => searchNorm(v).indexOf(q) >= 0);
  const groups = [];
  const subjSeen = {}, subj = [];
  ((state.courses && state.courses.list) || []).forEach((c) => { if (hit(c.name, c.code)) { const k = c.code || c.name; if (!subjSeen[k]) { subjSeen[k] = 1; subj.push({ title: c.name || c.code, sub: [c.code, c.semester].filter(Boolean).join(" · "), tab: "tab-courses" }); } } });
  [...((state.curriculum && state.curriculum.required) || []), ...((state.curriculum && state.curriculum.free) || [])].forEach((c) => { if (hit(c.name, c.code)) { const k = c.code || c.name; if (!subjSeen[k]) { subjSeen[k] = 1; subj.push({ title: c.name || c.code, sub: [c.code, c.completed ? "teljesített" : ""].filter(Boolean).join(" · "), tab: "tab-courses" }); } } });
  if (subj.length) groups.push(["Tárgyak", subj.slice(0, 12)]);
  const gr = [];
  ((state.grades && state.grades.terms) || []).forEach((t) => (t.subjects || []).forEach((s) => { if (hit(s.subject, s.code, s.result)) gr.push({ title: s.subject || s.code, sub: [s.result, t.termName].filter(Boolean).join(" · "), tab: "tab-grades" }); }));
  if (gr.length) groups.push(["Jegyek", gr.slice(0, 12)]);
  const ms = [];
  [...((state.messages && state.messages.received) || []), ...((state.messages && state.messages.sent) || [])].forEach((m) => { if (hit(m.subject, m.from, m.to)) ms.push({ title: m.subject || "(nincs tárgy)", sub: [m.from || m.to, m.date ? fmtWhen(m.date) : ""].filter(Boolean).join(" · "), tab: "tab-messages" }); });
  if (ms.length) groups.push(["Üzenetek", ms.slice(0, 12)]);
  const per = [];
  ((state.periods && state.periods.items) || []).forEach((p) => { if (hit(p.name, p.type)) per.push({ title: p.name || p.type || "Időszak", sub: p.type || "", tab: "tab-periods" }); });
  if (per.length) groups.push(["Időszakok", per.slice(0, 8)]);
  const nav = NAV_TARGETS.filter((t) => hit(t[0], t[1])).map((t) => ({ title: t[0], sub: "Megnyitás", tab: t[2] }));
  if (nav.length) groups.push(["Oldalak", nav.slice(0, 10)]);
  return groups;
}
function searchGroupsHtml(groups) {
  return groups.map(([label, items]) => `<div class="dash-label">${esc(label)}</div><div class="card">`
    + items.map((it) => `<button class="row" data-go="${esc(it.tab)}" type="button"><span class="row-main"><span class="row-title">${esc(it.title)}</span>${it.sub ? `<span class="row-sub">${esc(it.sub)}</span>` : ""}</span><span class="row-chev">${icon("chev")}</span></button>`).join("")
    + `</div>`).join("");
}
function renderSearchResults() {
  const host = $("search-scroll"); if (!host) return;
  const q = searchNorm(searchQ).trim();
  if (q.length < 2) { host.innerHTML = `<div class="dash-empty" style="padding:24px 16px">Írj be legalább 2 karaktert. Tárgyra, jegyre és üzenetre kereshetsz a lementett adataidban.</div>`; return; }
  const groups = searchGroups(q);
  host.innerHTML = groups.length ? searchGroupsHtml(groups) : `<div class="dash-empty" style="padding:24px 16px">Nincs találat erre: „${esc(searchQ)}".</div>`;
  host.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => searchGo(b.dataset.go));
}
// Kezdőlapi kereső: a bejelentkezés fölötti sávban. Fókuszban jelennek meg a találatok alatta,
// kikattintva eltűnnek (a 180 ms késleltetés engedi, hogy egy találat koppintása még beérkezzen).
function wireHubSearch() {
  const inp = $("hub-search-input"); if (!inp || inp.__wired) return; inp.__wired = true;
  inp.addEventListener("input", renderHubSearch);
}
// A mező TARTALMA vezérel: ha van benne szöveg → kereső nézet (a kezdőlap többi része elrejtve, csak a
// találatok látszanak); ha üres → vissza a főmenü (hero + widgetek).
function renderHubSearch() {
  const box = $("hub-search-results"), inp = $("hub-search-input"); if (!box || !inp) return;
  const active = inp.value.trim().length > 0;
  const hide = [document.querySelector("#tab-home .hero"), $("hub-widgets"), $("version-tag")];
  hide.forEach((el) => { if (el) el.style.display = active ? "none" : ""; });
  if (!active) { box.hidden = true; box.innerHTML = ""; return; }
  box.hidden = false; box.style.marginTop = "8px";
  const q = searchNorm(inp.value).trim();
  if (q.length < 2) { box.innerHTML = `<div class="dash-empty" style="padding:20px 6px">Írj be legalább 2 karaktert. Tárgyra, jegyre, üzenetre és oldalakra kereshetsz.</div>`; return; }
  const groups = searchGroups(q);
  box.innerHTML = groups.length ? searchGroupsHtml(groups) : `<div class="dash-empty" style="padding:20px 6px">Nincs találat erre: „${esc(inp.value)}".</div>`;
  box.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => { inp.value = ""; renderHubSearch(); searchGo(b.dataset.go); });
}
