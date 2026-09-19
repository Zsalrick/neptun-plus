// Partnerajánlatok a Kezdőlap alján (a belépősáv fölött). Az admin.kreditplus.hu-n vehetők fel, egyetemenként
// célozva; az app a nyilvános végpontról kéri le (WEBSITE-ADMIN-PROMO.md). A szerver csak az egyetem nevét kapja,
// a tárgy szerinti célzás (pl. csak akinek matek tárgya van) a telefonon történik.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

const PROMO_API = "https://kreditplus.hu/api/promos";
const PROMO_TTL = 6 * 3600e3; // alapból 6 óránként kérdezzük le újra (a szerver "ttl"-je felülírja)
let promoBusy = false;

// state.promoCache = { at, uni, ttl, list }; state.promoHidden = { [id]: true } (a "Nem érdekel")
async function promoFetch(force) {
  if (promoBusy || !state.setupComplete || !state.university) return;
  const c = state.promoCache;
  if (!force && c && c.uni === state.university && Date.now() - c.at < (c.ttl || PROMO_TTL)) return;
  promoBusy = true;
  try {
    const j = await bookGetJson(PROMO_API + "?uni=" + encodeURIComponent(state.university) + "&v=" + encodeURIComponent(APP_VERSION));
    const list = Array.isArray(j && j.promos) ? j.promos.filter(promoValid).slice(0, 5) : [];
    state.promoCache = { at: Date.now(), uni: state.university, ttl: Math.max(600e3, Math.min(24 * 3600e3, ((j && j.ttl) || 0) * 1000 || PROMO_TTL)), list };
    saveState();
    promoRender();
  } catch (e) { /* nincs net vagy még nincs végpont: marad a régi (vagy semmi) */ }
  finally { promoBusy = false; }
}
// Csak értelmes, biztonságos ajánlat jelenhet meg (https link, van cím).
function promoValid(p) {
  return p && typeof p.id === "string" && p.id && typeof p.title === "string" && p.title.trim()
    && typeof p.url === "string" && /^https:\/\//.test(p.url);
}
function promoActive(p) {
  const now = Date.now(), from = p.from ? Date.parse(p.from) : 0, until = p.until ? Date.parse(p.until) : Infinity;
  if (!(now >= (from || 0) && now <= (until || Infinity))) return false;
  if ((state.promoHidden || {})[p.id]) return false;
  // Tárgy-kulcsszavak: csak annak, akinek az aktuális félévben van ilyen tárgya (a telefonon döntjük el).
  const kw = Array.isArray(p.subjects) ? p.subjects.map((k) => searchNorm(k).trim()).filter(Boolean) : [];
  if (kw.length) {
    const sem = currentSemesterKey();
    const names = ((state.courses && state.courses.list) || []).filter((c) => !c.semester || c.semester === sem).map((c) => searchNorm(c.name || ""));
    if (!names.some((n) => kw.some((k) => n.includes(k)))) return false;
  }
  return true;
}
function promoRender() {
  const host = $("home-promos"); if (!host) return;
  const list = ((state.promoCache && state.promoCache.uni === state.university && state.promoCache.list) || []).filter(promoActive);
  if (!list.length) { host.innerHTML = ""; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = `<div class="promo-track" id="promo-track">` + list.map((p, i) => {
    const deal = [p.discount, p.code ? "kód: " + p.code : ""].filter(Boolean).join(" · ");
    return `<div class="promo" data-pid="${esc(p.id)}">`
      + `<div class="promo-top"><span class="promo-lab">Partnerajánlat${p.partner ? " · " + esc(p.partner) : ""}</span>`
      + `<button class="iconbtn plain promo-x" type="button" data-hide="${i}" aria-label="Nem érdekel">${icon("x")}</button></div>`
      + `<div class="promo-t">${esc(p.title)}</div>`
      + (p.text ? `<div class="promo-d">${esc(p.text)}</div>` : "")
      + `<div class="promo-row">${deal ? `<button class="promo-deal" type="button" data-code="${i}"${p.code ? "" : " disabled"}>${esc(deal)}${p.code ? icon("copy") : ""}</button>` : "<span></span>"}`
      + `<button class="btn tonal narrow promo-go" type="button" data-go="${i}">${esc(p.cta || "Megnézem")}</button></div></div>`;
  }).join("") + `</div>`
    + (list.length > 1 ? `<div class="promo-dots" aria-hidden="true">${list.map((_, i) => `<i${i ? "" : ` class="on"`}></i>`).join("")}</div>` : "");
  host.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => openWeb(list[+b.dataset.go].url));
  host.querySelectorAll("[data-code]").forEach((b) => b.onclick = async () => {
    const p = list[+b.dataset.code]; if (!p.code) return;
    try { await navigator.clipboard.writeText(p.code); toast("Kuponkód kimásolva: " + p.code); } catch (e) { toast("Kuponkód: " + p.code); }
  });
  host.querySelectorAll("[data-hide]").forEach((b) => b.onclick = async () => {
    const p = list[+b.dataset.hide];
    const ok = await ask({ title: "Elrejted ezt az ajánlatot?", okText: "Elrejtés", cancelText: "Mégse", body: `<b>${esc(p.title)}</b><br>Ez az ajánlat többet nem jelenik meg.` });
    if (!ok) return;
    (state.promoHidden = state.promoHidden || {})[p.id] = true; saveState(); promoRender();
  });
  const track = $("promo-track"), dots = host.querySelectorAll(".promo-dots i");
  if (track && dots.length) track.addEventListener("scroll", () => {
    const k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    dots.forEach((d, i) => d.classList.toggle("on", i === k));
  }, { passive: true });
}
