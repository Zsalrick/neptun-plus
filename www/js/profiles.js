// Több profil: váltás, hozzáadás, törlés.
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// ---------- profiles (multiple Neptun identities, one per university) ----------
function resetProfileCaches() { apiSession = null; lastCode = ""; coFilter = null; exSubjSem = null; ttFilter = "upcoming"; exFilter = "upcoming"; coSeg = "aktualis"; semLoading = false; dataSyncOffered = false; }
function switchProfile(id) {
  if (id === state.activeProfileId) return;
  const target = (state.profiles || []).find((p) => p.id === id); if (!target) return;
  syncActiveToProfiles();
  state.activeProfileId = id; loadProfileToTop(target);
  resetProfileCaches(); saveState();
  updateIcsStatus(); renderHome(); renderTimetable(); renderExams(); renderCourses();
  totpTick(); rescheduleNotifications();
  toast("Profil: " + profileLabel(target));
  warmSession("profile"); // pre-authenticate the new identity so login/reads are instant
}
function startAddProfile() {
  syncActiveToProfiles();
  const p = { id: uid() }; PROFILE_FIELDS.forEach((k) => p[k] = defaultState()[k]);
  state.profiles.push(p); state.activeProfileId = p.id; loadProfileToTop(p);
  resetProfileCaches();
  // Clear onboarding inputs for the fresh identity.
  ["ob-username", "ob-password", "ob-uni-search", "ob-secret", "ob-custom-label", "ob-custom-url"].forEach((id) => { const el = $(id); if (el) el.value = ""; });
  obSel = null; ob2faChoice = null;
  obMode = "add"; obSeq = [1, 2, 5]; obPos = 0; obStep = obSeq[0]; // university → credentials → 2FA (legal/PIN/biometrics are global)
  showOnboardingScreen(); renderOb();
}
function cancelAddProfile() {
  const cur = state.activeProfileId;
  state.profiles = state.profiles.filter((p) => p.id !== cur);
  const back = state.profiles[state.profiles.length - 1];
  state.activeProfileId = back ? back.id : null;
  if (back) loadProfileToTop(back);
  obMode = ""; obSeq = [0, 1, 2, 3, 4, 5, 6]; obPos = 0; obStep = 0;
  resetProfileCaches(); saveState();
  enterApp(); showTab("tab-home"); renderHome();
}
// Full-screen profile page (replaces the old bottom-sheet picker): switch, add, delete.
function openProfilePicker() { pushScreen("tab-profile"); }
function renderProfilePage() {
  const host = $("profile-scroll"); if (!host) return;
  const profiles = state.profiles || [];
  const multi = profiles.length > 1;
  const rows = profiles.map((p) => {
    const active = p.id === state.activeProfileId;
    const label = profileLabel(p);
    const init = (label.trim()[0] || "K").toUpperCase();
    const right = active
      ? `<span class="row-chev pf-check">${icon("check")}</span>`
      : (multi ? `<span class="pf-del" data-del="${p.id}" title="Törlés">${icon("trash")}</span>` : `<span class="row-chev">${icon("chev")}</span>`);
    return `<button class="row" data-pf="${p.id}" type="button">`
      + `<span class="row-ic pf-badge">${esc(init)}</span>`
      + `<span class="row-main"><span class="row-title">${esc(label)}</span><span class="row-sub">${esc(p.username || "Nincs azonosító")}</span></span>`
      + right + `</button>`;
  }).join("");
  host.innerHTML = `<div class="section-label">Profilok</div><div class="card">${rows}</div>`
    + `<div class="card" style="margin-top:14px"><button class="row" id="pf-add" type="button">`
    + `<span class="row-ic">${icon("plus")}</span>`
    + `<span class="row-main"><span class="row-title">Új profil hozzáadása</span><span class="row-sub">Másik egyetem vagy Neptun azonosító</span></span>`
    + `<span class="row-chev">${icon("chev")}</span></button></div>`;
  host.querySelectorAll("[data-pf]").forEach((b) => b.onclick = () => {
    const id = b.dataset.pf;
    if (id !== state.activeProfileId) switchProfile(id);
    popScreen();
  });
  host.querySelectorAll("[data-del]").forEach((el) => el.onclick = async (e) => {
    e.stopPropagation();
    await deleteProfile(el.dataset.del);
    renderProfilePage();
  });
  const add = $("pf-add"); if (add) add.onclick = startAddProfile;
}
async function deleteProfile(id) {
  if ((state.profiles || []).length <= 1) { toast("Az utolsó profilt nem lehet törölni."); return; }
  const p = (state.profiles || []).find((x) => x.id === id); if (!p) return;
  if (!(await requireAuth())) return; // PIN / biometrics (skipped if no app-lock set)
  const ok = await askConfirmText({
    title: "Profil törlése",
    body: `Biztosan törlöd ezt a profilt?<br><b>${esc(profileLabel(p))}</b>${p.username ? " · " + esc(p.username) : ""}<br><br>Minden hozzá tartozó adat (tárgyak, órarend, kredit, félévek…) törlődik erről az eszközről. A többi profilod megmarad.<br><br>A megerősítéshez írd be: <b>törlés</b>`,
    mustType: "törlés", okText: "Törlés",
  });
  if (!ok) return;
  const wasActive = id === state.activeProfileId;
  // A profil anyagfájljai IndexedDB-ben vannak, nem a profil adatai között: azokat külön töröljük.
  for (const m of ((wasActive ? state.materials : p.materials) || []).concat((wasActive ? state.books : p.books) || [])) { try { await matDeleteData(m.id); } catch (e) {} }
  state.profiles = state.profiles.filter((x) => x.id !== id);
  if (wasActive) { const nx = state.profiles[0]; state.activeProfileId = nx.id; loadProfileToTop(nx); resetProfileCaches(); }
  saveState();
  renderHome();
  if (wasActive) { updateIcsStatus(); renderTimetable(); renderExams(); renderCourses(); totpTick(); rescheduleNotifications(); }
  toast("Profil törölve.");
}
