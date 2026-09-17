// Színtémák.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---- Színtéma: device-local preference (localStorage, NOT the profile state → no backend migrate) ----
const THEMES = [
  { id: "neutral", name: "Éjfekete", desc: "A klasszikus semleges fekete-fehér, arany akcentussal.", sw: ["#0c0d0f", "#141518", "#f5b221"] },
  { id: "midnight", name: "Éjkék", desc: "Hűvös, kékes-fekete felület. Nyugodt, tech-prémium.", sw: ["#0a0d13", "#131926", "#f3b53a"] },
  { id: "espresso", name: "Espresso", desc: "Meleg grafit-barna, meleg arany. Elegáns, otthonos.", sw: ["#0f0c0a", "#1a1512", "#eab04a"] },
  { id: "forest", name: "Erdő", desc: "Mély zöld árnyalat, lágy arany. Diszkrét, prémium.", sw: ["#080e0b", "#111a14", "#d8b45f"] },
  { id: "indigo", name: "Indigó", desc: "Semleges grafit, hideg indigó akcentus. A legmodernebb.", sw: ["#0b0c11", "#15171f", "#8b8cf7"] },
  { id: "crimson", name: "Bordó", desc: "Meleg szénfekete, mély bordó akcentus. Erőteljes.", sw: ["#100a0b", "#241719", "#e5555c"] },
  { id: "teal", name: "Tenger", desc: "Sötét pala, türkiz akcentus. Friss és tiszta.", sw: ["#08100f", "#172422", "#2fb8b0"] },
  { id: "rose", name: "Rózsa", desc: "Semleges sötét, lágy rózsaszín akcentus. Finom.", sw: ["#100b0e", "#241a20", "#f08ab0"] },
  { id: "sunset", name: "Naplemente", desc: "Meleg sötét, narancs akcentus. Élénk, barátságos.", sw: ["#120c08", "#271b15", "#f0873c"] },
  { id: "slate", name: "Pala", desc: "Hűvös szürke, ezüstös acél akcentus. Visszafogott.", sw: ["#0b0d0f", "#1c2023", "#9fb2c0"] },
  { id: "amethyst", name: "Ametiszt", desc: "Sötét lila felület, élénk viola akcentus. Karakteres.", sw: ["#0e0b12", "#201a29", "#b57cf0"] },
  { id: "emerald", name: "Smaragd", desc: "Feketés zöld, élénk smaragd akcentus. Üde.", sw: ["#07100b", "#15241b", "#35c47a"] },
];
function currentTheme() { try { return localStorage.getItem("kredit-theme") || "neutral"; } catch (e) { return "neutral"; } }
function applyTheme(id) {
  const t = THEMES.some((x) => x.id === id) ? id : "neutral";
  if (t === "neutral") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
  try { localStorage.setItem("kredit-theme", t); } catch (e) {}
}
function renderThemePage() {
  const host = $("theme-scroll"); if (!host) return;
  const cur = currentTheme();
  host.innerHTML = `<p class="hub-ed-intro">Válaszd ki az app hangulatát. Mind sötét és prémium marad, csak a felületek árnyalata változik.</p><div class="card">`
    + THEMES.map((t) => `<button class="row theme-row${t.id === cur ? " sel" : ""}" data-theme-id="${t.id}" type="button">`
      + `<span class="theme-sw">${t.sw.map((c) => `<span style="background:${c}"></span>`).join("")}</span>`
      + `<span class="row-main"><span class="row-title">${esc(t.name)}</span><span class="row-sub">${esc(t.desc)}</span></span>`
      + `<span class="row-chev theme-check">${t.id === cur ? icon("check") : ""}</span></button>`).join("")
    + `</div>`;
  host.querySelectorAll("[data-theme-id]").forEach((b) => b.onclick = () => { applyTheme(b.dataset.themeId); renderThemePage(); });
}
applyTheme(currentTheme()); // keep DOM in sync on load (the <head> inline script prevents the first-paint flash)
