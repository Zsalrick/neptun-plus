// Böngészős Neptun folyamatok (beépített böngésző + befecskendezett szkriptek).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// Shared runner: open a (debug-visible) InAppBrowser, inject an in-page routine on each
// load, and poll `window.<gvar>` for a {done:true,...} result while surfacing its live log.
let flowActive = false; // only one Neptun InAppBrowser flow at a time
function runNeptunFlow(buildScript, gvar, onPartial) {
  return new Promise((resolve, reject) => {
    const iab = window.cordova && window.cordova.InAppBrowser;
    if (!iab) return reject(new Error("InAppBrowser plugin hiányzik"));
    if (flowActive) return reject(new Error("Már fut egy Neptun folyamat"));
    flowActive = true;
    const srv = activeServer();
    const loginScript = buildInjectScript(state.username, state.password, state.no2fa ? "" : lastCode);
    const script = buildScript(state.username, state.password, state.no2fa ? "" : lastCode);
    dbg("Böngésző megnyitása…");
    // Same base options as the working hub login (nativeLogin) — but hidden=yes so the user only
    // sees the busy spinner (the "Kész" vs "Mégse" opts difference was what made login work).
    const opts = ["location=yes", "hidden=yes", "hideurlbar=no", "hidenavigationbuttons=no", "zoom=yes", "hardwareback=yes", "footer=no",
      "toolbarcolor=#141518", "navigationbuttoncolor=#ecedee", "closebuttoncolor=#ecedee", "closebuttoncaption=Kész"].join(",");
    const ref = iab.open(srv.url, "_blank", opts);
    let done = false, polling = false, iv = null;
    const finish = (err, data) => { if (done) return; done = true; flowActive = false; flowCancel = null; clearTimeout(to); if (iv) clearInterval(iv); try { ref.close(); } catch (e) {} err ? reject(err) : resolve(data); };
    flowCancel = () => finish(new Error("Megszakítva")); // wired to the busy "Mégse" button
    const to = setTimeout(() => finish(new Error("időtúllépés (90s)")), 90000);
    const startPoll = () => {
      if (polling) return; polling = true;
      iv = setInterval(() => {
        ref.executeScript({ code: "(function(){return JSON.stringify({v:window." + gvar + "||'',log:window.__ncLog||''});})()" }, (r) => {
          const s = Array.isArray(r) ? r[0] : r; if (!s || typeof s !== "string") return;
          let o; try { o = JSON.parse(s); } catch (e) { return; }
          if (o.log) { const parts = o.log.split("\n"); courseLog = parts; $("busy-text").textContent = parts[parts.length - 1] || "Beolvasás…"; }
          if (o.v) { let res; try { res = JSON.parse(o.v); } catch (e) { return; }
            if (res && res.done) { if (res.log) courseLog = res.log.split("\n"); finish(null, res); }
            else if (res && onPartial) { try { onPartial(res); } catch (_) {} } }
        });
      }, 700);
    };
    // Reliable result channel: the injected script navigates to a sentinel URL carrying the payload.
    const onNav = (ev) => {
      const u = (ev && ev.url) || "";
      if (u.indexOf("neptunplus.done") < 0) return;
      let data = {};
      try { const q = (u.split("?d=")[1] || u.split("#d=")[1] || ""); data = JSON.parse(decodeURIComponent(q)); } catch (e) {}
      if (data && data.log) courseLog = String(data.log).split("\n");
      finish(null, Object.assign({ done: true, url: "", log: "", raw: "" }, data));
    };
    ref.addEventListener("loadstart", onNav);
    ref.addEventListener("loaderror", (ev) => { onNav(ev); dbg("Betöltési hiba: " + ((ev && ev.message) || "")); });
    ref.addEventListener("exit", () => finish(new Error("a böngészőt bezárták")));
    ref.addEventListener("loadstop", (ev) => {
      onNav(ev); dbg("Betöltött: " + ((ev && ev.url) || "").replace(srv.url, ""));
      try { ref.executeScript({ code: loginScript }); } catch (e) {} // 1:1 hub login
      try { ref.executeScript({ code: script }); } catch (e) {}       // flow waits for login then navigates
      startPoll();
    });
  });
}
function neptunReadCourses() { return runNeptunFlow(buildFullReadScript, "__nc"); }
function neptunReadIcsLink() { return runNeptunFlow(buildIcsGrabScript, "__ics"); }
function neptunReadSemesters() { return runNeptunFlow(buildSemesterScript, "__sems"); }
// Read just the semester list: login → Menü → Tárgyak → Felvett tárgyak → Szűrő → Félév dropdown.
function buildSemesterScript(username, password, code) {
  return `(function(){
  if(window.__semRunning) return "running"; window.__semRunning=true; window.__sems=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(sems){ try{ window.__sems=JSON.stringify({done:true,sems:sems||[],log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({sems:sems||[],log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,200); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  var RE=/\\d{4}\\/\\d{2}\\/\\d/;
  function semTriggers(){ return nodes().filter(function(el){ return vis(el) && RE.test(el.textContent||'') && (el.textContent||'').length<48; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); }
  function collect(){ var labels=[]; nodes().forEach(function(el){ if(!vis(el)||el.children.length>1) return; var t=el.textContent||''; if(t.length>48) return; var m=t.match(RE); if(m&&labels.indexOf(m[0])<0) labels.push(m[0]); }); return labels; }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver([]); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(120);}
      log("Tárgyak"); var t=await waitFor(function(){return pick("Tárgyak");},8000); if(t){ t.click(); await sleep(120);}
      log("Felvett tárgyak"); var f=await waitFor(function(){return pick("Felvett tárgyak");},8000); if(f){ f.click(); }
      await waitFor(function(){ return /Felvett t[aá]rgyak/i.test(T()); }, 12000); await sleep(400);
      log("Szűrő"); var sz=await waitFor(function(){return pick("Szűrő");},8000); if(sz){ sz.click(); await sleep(500);}
      // open the Félév dropdown (its trigger shows a YYYY/YY/S value)
      var tr=await waitFor(function(){ var a=semTriggers(); return a.length?a[0]:null; }, 8000); if(tr){ tr.click(); await sleep(500);}
      var sems=await waitFor(function(){ var l=collect(); return l.length>=2?l:null; }, 6000); if(!sems) sems=collect();
      log("Félévek: "+(sems.join(", ")||"—"));
      deliver(sems);
    }catch(e){ log("HIBA: "+String(e)); deliver([]); }
  })();
  return "started";
})();`;
}
async function grabSemesters() {
  if (!isNative) { toast("A félévek beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let sems = [], terms = null, cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) { $("busy-text").textContent = "Félévek lekérése…"; try { terms = await apiReadTerms(sess); if (terms && terms.length) { sems = terms.map((t) => t.label); viaApi = true; } } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); } }
    // Fallback: DOM scraping.
    if (!sems.length) { const res = await neptunReadSemesters(); if (res && res.log) courseLog = res.log.split("\n"); sems = (res && res.sems) || []; }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (sems.length) {
    state.semesters = terms ? { fetchedAt: new Date().toISOString(), list: sems, terms } : { fetchedAt: new Date().toISOString(), list: sems };
    saveState(); syncSemStatus(); renderTimetable(); renderExams(); renderCourses();
    toast(sems.length + " félév beolvasva" + (viaApi ? " (API)" : "") + "."); return;
  }
  await ask({ title: "Félév lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") });
}
function neptunReadProgress() { return runNeptunFlow(buildProgressScript, "__prog"); }
// Read credit progress: login → Menü → Tanulmányok → Előrehaladás → parse X/Y + szabadon választható.
function buildProgressScript(username, password, code) {
  return `(function(){
  if(window.__progRunning) return "running"; window.__progRunning=true; window.__prog=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(p){ try{ window.__prog=JSON.stringify({done:true,progress:p||null,log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({progress:p||null,log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,200); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  function parseProg(){
    var t=T(); var done=null,total=null,free=null;
    var mc=t.match(/(\\d{1,3})\\s*\\/\\s*(\\d{2,4})\\s*kredit/i); if(mc){ done=parseInt(mc[1],10); total=parseInt(mc[2],10); }
    var mf=t.match(/szabadon\\s*v[aá]laszthat[oó][^0-9]{0,30}(\\d+)/i); if(mf) free=parseInt(mf[1],10);
    if(done!=null && total!=null) return {done:done,total:total,free:(free==null?0:free)};
    return null;
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver(null); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(120);}
      log("Tanulmányok"); var t=await waitFor(function(){return pick("Tanulmányok");},8000); if(t){ t.click(); await sleep(120);}
      log("Előrehaladás"); var e=await waitFor(function(){return pick("Előrehaladás");},8000); if(e){ e.click(); }
      await waitFor(function(){ return /El[oő]rehalad[aá]s/i.test(T()) && /[oö]sszkredit|kredit/i.test(T()); }, 12000); await sleep(500);
      var p=await waitFor(parseProg, 6000); if(!p) p=parseProg();
      log(p?("Kredit: "+p.done+"/"+p.total+" (szabad: "+p.free+")"):"Nem találtam kredit adatot");
      deliver(p);
    }catch(err){ log("HIBA: "+String(err)); deliver(null); }
  })();
  return "started";
})();`;
}
// Grab { token, base } by logging in (browser) and reading sessionStorage.access_token.
function neptunGetSession() { return runNeptunFlow(buildTokenGrabScript, "__tok"); }
function buildTokenGrabScript(username, password, code) {
  return `(function(){
  if(window.__tokRunning) return "running"; window.__tokRunning=true; window.__tok=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(o){ o=o||{}; try{ window.__tok=JSON.stringify(Object.assign({done:true,log:LOG.slice(-20).join("\\n")},o)); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({token:o.token||"",base:o.base||"",code:o.code||"",log:LOG.slice(-12).join("\\n")})); }catch(e){} }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  // Find the immutable Neptun code from the logged-in page: JWT claims first, then a scan of
  // session/localStorage (the SDA app stashes user data there). Returns "" if nothing code-shaped.
  function findCode(tok){
    try{ var b=tok.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'); var p=JSON.parse(decodeURIComponent(escape(atob(b))));
      var prefer=['neptunCode','NeptunCode','neptun_code','NeptunKod','code','Login','login','preferred_username','unique_name','nameid','sub','name'];
      for(var i=0;i<prefer.length;i++){ var v=p[prefer[i]]; if(v && /^[A-Za-z0-9]{6}$/.test(String(v))) return String(v).toUpperCase(); }
      for(var k in p){ if(/^[A-Za-z0-9]{6}$/.test(String(p[k]))) return String(p[k]).toUpperCase(); }
    }catch(e){}
    try{ var stores=[window.sessionStorage,window.localStorage];
      for(var s=0;s<stores.length;s++){ var st=stores[s]; for(var j=0;j<st.length;j++){ var kk=st.key(j)||''; var val=st.getItem(kk)||'';
        if(/neptun|code|kod|login/i.test(kk) && /^[A-Za-z0-9]{6}$/.test(val)) return val.toUpperCase();
        if(val.length<8000){ var m=val.match(/"(?:neptunCode|NeptunCode|neptun_code|NeptunKod|code|login)"\\s*:\\s*"([A-Za-z0-9]{6})"/i); if(m) return m[1].toUpperCase(); }
      }}
    }catch(e){}
    return "";
  }
  (async function(){
    try{
      log("Bejelentkezés…");
      var tok=await waitFor(function(){ try{ return window.sessionStorage.getItem('access_token'); }catch(e){ return null; } }, 60000);
      var base=""; try{ base=new URL('api/', document.baseURI).href; }catch(e){ base=location.origin+'/hallgato/api/'; }
      log(tok?("Token megvan ("+tok.length+" kar.)"):"Nincs token a sessionStorage-ban");
      var nc=tok?findCode(tok):""; log(nc?("Neptun kód: "+nc):"Neptun kód nem található");
      deliver({token:tok||"", base:base, code:nc});
    }catch(err){ log("HIBA: "+String(err)); deliver({}); }
  })();
  return "started";
})();`;
}

let grabbingProgress = false;
async function grabProgress() {
  if (!isNative) { toast("A kredit beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (grabbingProgress) return; // silently ignore a second trigger (e.g. double pull-to-refresh)
  grabbingProgress = true;
  try { await grabProgressInner(); } finally { grabbingProgress = false; }
}
async function grabProgressInner() {
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let prog = null, cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) {
      $("busy-text").textContent = "Kredit lekérése…";
      try {
        const r = await apiGet(sess, "advancement/creditprogress");
        const d = r && r.data && r.data.data;
        if (d && (d.requiredCredit || d.completedCredit)) {
          prog = { done: d.completedCredit || 0, total: d.requiredCredit || 0, free: d.completedOptionalSubjectCredit || 0 };
          viaApi = true;
        } else { dbg("API válasz nem tartalmazott kredit adatot (status " + (r && r.status) + ")"); }
      } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); }
    } else { dbg("Nem sikerült token — visszaesés a régi módszerre"); }
    // Fallback: DOM scraping.
    if (!prog) {
      $("busy-text").textContent = "Beolvasás…";
      const res = await neptunReadProgress();
      if (res && res.log) courseLog = res.log.split("\n");
      const p = (res && res.progress) || null;
      if (p && p.total) prog = { done: p.done, total: p.total, free: p.free || 0 };
    }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (prog && prog.total) {
    state.progress = { fetchedAt: new Date().toISOString(), done: prog.done, total: prog.total, free: prog.free || 0 };
    saveState(); syncProgStatus(); renderHome();
    { const act = document.querySelector(".tabscreen.active"); if (act && act.id === "tab-credit") renderCreditPage(); else if (act && act.id === "tab-more") renderMore(); }
    toast("Kredit beolvasva: " + prog.done + "/" + prog.total + (viaApi ? " (API)" : "")); return;
  }
  await ask({ title: "Kredit lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") });
}
// Read the curriculum (Hierarchikus mintatanterv): login → Menü → Tanulmányok → Előrehaladás →
// switch to the hierarchy view → read program name, expand the groups, parse the subject cards.
// Returns { program, required:[...], free:[...] } — "Szabadon választható" cards go to `free`.
function neptunReadCurriculum() { return runNeptunFlow(buildCurriculumScript, "__curr"); }
function buildCurriculumScript(username, password, code) {
  return `(function(){
  if(window.__currRunning) return "running"; window.__currRunning=true; window.__curr=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  // Deliver via the polling channel only (window.__curr) so the large raw HTML survives; the
  // sentinel-URL channel can't carry it, and would otherwise win the race with a raw-less payload.
  function deliver(o){ o=o||{}; try{ window.__curr=JSON.stringify(Object.assign({done:true,log:LOG.join("\\n")},o)); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,220); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button],[role=tab]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  var CODE=/\\b[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]{1,}\\b/;
  function findProgram(){
    // Preferred: the hierarchy card title (Angular: advancement-hierarchy-curriculum-card__header__data__title).
    var h=document.querySelector('.advancement-hierarchy-curriculum-card__header__data__title'); if(h && (h.innerText||'').trim()) return (h.innerText||'').trim();
    var best=""; nodes().forEach(function(el){ if(!vis(el)||el.children.length>2) return; var t=(el.textContent||'').trim();
      if(t.length<6||t.length>70) return;
      if(/\\b(BA|BSc|BProf|MA|MSc|osztatlan|szakir[aá]ny)\\b/i.test(t) && /\\d{4}/.test(t) && !/kredit|teljes/i.test(t)){ if(t.length>best.length) best=t; } });
    return best;
  }
  // Group expanders: the blue chevron buttons that open a curriculum group (id like "curriculum-1-toggle-header-btn").
  function groupToggles(){ return Array.prototype.slice.call(document.querySelectorAll('button[id*="toggle-header-btn"]')).filter(vis); }
  function collapsedToggles(){ return groupToggles().filter(function(b){ return b.getAttribute('aria-expanded')==='false'; }); }
  function spinning(){ return !!document.querySelector('.spinner, .loading-placeholder-wrapper'); }
  // The subject cards render (lazy) inside the opened group content. A card carries a code + "kredit".
  function groupTitleFor(el){ var g=el; for(var k=0;k<12&&g;k++){ g=g.parentElement; if(g&&g.classList&&g.classList.contains('advancement-hierarchy-curriculum-card')){ var tt=g.querySelector('.advancement-hierarchy-curriculum-card__header__data__title'); return tt?(tt.innerText||''):''; } } return ''; }
  function parseCards(){
    var out=[]; var seen={};
    var leaves=Array.prototype.slice.call(document.querySelectorAll('div,span,p,li,td,a')).filter(function(el){ return el.children.length===0 && CODE.test((el.textContent||'').trim()); });
    leaves.forEach(function(le){
      var codeM=(le.textContent||'').match(CODE); if(!codeM) return; var codev=codeM[0];
      var card=le; for(var k=0;k<9&&card.parentElement;k++){ card=card.parentElement; var rt=(card.innerText||''); if(/kredit/i.test(rt)&&rt.split('\\n').filter(Boolean).length>=2 && rt.length<500) break; }
      var txt=(card.innerText||''); if(!/kredit/i.test(txt)) return; var key=codev; if(seen[key]) return; seen[key]=1;
      var lines=txt.split('\\n').map(function(s){return s.trim();}).filter(Boolean);
      // name = the longest line that is not the code, not the meta (bullet-separated) line, not a lone status/credit.
      var name=''; lines.forEach(function(l){ if(l===codev) return; if(l.indexOf('•')>=0||l.indexOf('·')>=0) return; if(/^\\d+\\s*kredit/i.test(l)) return; if(/^(r[eé]szletek|t[uú]lteljes[ií]tett|teljes[ií]tett|nem teljes[ií]tett|folyamatban|akt[ií]v|hi[aá]nyz)/i.test(l)) return; if(l.length>name.length) name=l; });
      if(!name) name=lines[0]||codev;
      var crM=txt.match(/(\\d+)\\s*kredit/i); var credits=crM?parseInt(crM[1],10):0;
      var gt=groupTitleFor(le);
      var free=/szabadon\\s*v[aá]laszthat/i.test(txt) || /szabadon\\s*v[aá]laszthat/i.test(gt);
      var type=''; var tm=txt.match(/(folyamatos sz[aá]monk[eé]r[eé]s|vizsga|gyakorlati jegy|koll[oó]kvium|al[aá][ií]r[aá]s|beugr[oó])/i); if(tm) type=tm[1];
      var completed=(/t[uú]lteljes[ií]tett/i.test(txt) || /teljes[ií]tve/i.test(txt) || (/teljes[ií]tett/i.test(txt) && !/nem teljes[ií]tett/i.test(txt)));
      out.push({code:codev,name:name,credits:credits,type:type,completed:completed,free:free});
    });
    return out;
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre…");
      var inOk=await waitFor(loggedIn, 60000); log(inOk?"Bejelentkezve":"Nem sikerült bejelentkezni");
      if(!inOk){ deliver({}); return; }
      log("Menü"); var m=await waitFor(function(){return pick("Menü");},8000); if(m){ m.click(); await sleep(150);}
      log("Tanulmányok"); var t=await waitFor(function(){return pick("Tanulmányok");},8000); if(t){ t.click(); await sleep(150);}
      log("Előrehaladás"); var e=await waitFor(function(){return pick("Előrehaladás");},8000); if(e){ e.click(); }
      await waitFor(function(){ return /El[oő]rehalad[aá]s/i.test(T()); }, 12000); await sleep(700);
      // Switch to the "Hierarchikus mintatanterv" view tab.
      var tab=Array.prototype.slice.call(document.querySelectorAll('button.tab-group__button,[role=tab],button')).filter(function(b){ return vis(b) && /Hierarchikus mintatanterv/i.test(b.textContent||''); })[0];
      if(tab){ log("Hierarchikus nézet"); try{ tab.click(); }catch(_){} await sleep(800); }
      await waitFor(function(){ return document.querySelector('.advancement-hierarchy-curriculum-card'); }, 10000);
      var program=findProgram(); log("Képzés: "+(program||"—"));
      // Expand every group; content loads lazily (spinner), and new groups appear as we scroll.
      log("Csoportok kinyitása…");
      for(var pass=0; pass<10; pass++){
        try{ window.scrollTo(0, document.body.scrollHeight); }catch(_){} await sleep(350);
        var togs=collapsedToggles(); if(!togs.length) break;
        for(var i=0;i<togs.length;i++){ try{ togs[i].scrollIntoView({block:'center'}); }catch(_){} try{ togs[i].click(); }catch(_){}
          await waitFor(function(){ return !spinning(); }, 9000); await sleep(450); }
      }
      log("Nyitott csoportok: "+groupToggles().filter(function(b){return b.getAttribute('aria-expanded')==='true';}).length+"/"+groupToggles().length);
      try{ window.scrollTo(0,0); }catch(_){}
      await sleep(500);
      var cards=await waitFor(function(){ var c=parseCards(); return c.length?c:null; }, 10000) || parseCards();
      var required=[],free=[]; cards.forEach(function(c){ (c.free?free:required).push({code:c.code,name:c.name,credits:c.credits,type:c.type,completed:c.completed}); });
      log("Tárgyak: "+required.length+" összes/kötelező, "+free.length+" szabadon választható");
      deliver({program:program, required:required, free:free, raw:(document.querySelector('main')||document.body).outerHTML.slice(0,120000)});
    }catch(err){ log("HIBA: "+String(err)); deliver({raw:(document.querySelector('main')||document.body).outerHTML.slice(0,120000)}); }
  })();
  return "started";
})();`;
}
function hasCurriculum() { return !!(state.curriculum && ((state.curriculum.required && state.curriculum.required.length) || (state.curriculum.free && state.curriculum.free.length))); }
async function scrapeCurriculum() {
  if (!isNative) { toast("A mintatanterv beolvasása a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let ok = false, rawOut = "", cancelled = false, viaApi = false;
  try {
    // Preferred: direct API.
    const sess = await getApiSession();
    if (sess && sess.token) {
      $("busy-text").textContent = "Mintatanterv lekérése…";
      try {
        const cur = await apiReadCurriculum(sess);
        if (cur && (cur.required.length || cur.free.length)) {
          state.curriculum = { fetchedAt: new Date().toISOString(), program: cur.program || "", required: cur.required, free: cur.free };
          saveState(); renderCourses(); ok = true; viaApi = true;
        }
      } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); }
    }
    // Fallback: DOM scraping.
    if (!ok) {
      $("busy-text").textContent = "Beolvasás…";
      const res = await neptunReadCurriculum();
      rawOut = (res && res.raw) || "";
      if (res && res.log) courseLog = res.log.split("\n");
      const req = (res && res.required) || [], fr = (res && res.free) || [];
      if (req.length || fr.length) {
        state.curriculum = { fetchedAt: new Date().toISOString(), program: (res && res.program) || "", required: req, free: fr };
        saveState(); renderCourses(); ok = true; dbg("Siker: " + (req.length + fr.length) + " tárgy");
      } else { dbg("Betöltött, de 0 tárgyat ismertem fel a mintatantervben."); }
    }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (ok) { toast((state.curriculum.required.length + state.curriculum.free.length) + " tárgy beolvasva" + (viaApi ? " (API)" : "") + "."); return; }
  try { if (rawOut) await navigator.clipboard.writeText(rawOut); } catch (e) { /* ignore */ }
  await ask({ title: "Mintatanterv napló", okText: "OK",
    body: courseLog.map((l) => esc(l)).join("<br>") + (rawOut ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
// ---- API diagnostics: hook fetch/XHR in the logged-in webview, visit the study pages,
// and report the JSON API calls Neptun makes (auth values redacted) so we can call them directly. ----
function neptunSniffApi(onPartial) { return runNeptunFlow(buildApiSniffScript, "__apidiag", onPartial); }
function buildApiSniffScript(username, password, code) {
  return `(function(){
  if(window.__apidiagRunning) return "running"; window.__apidiagRunning=true; window.__apidiag=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  // Keep the payload small enough for the InAppBrowser executeScript bridge to return in one shot.
  function deliver(o){ o=o||{};
    function build(obj){ try{ return JSON.stringify(Object.assign({done:true,log:LOG.slice(-40).join("\\n")},obj)); }catch(e){ return ""; } }
    var LIM=35000, s=build(o);
    // Secondary data first: drop the captured-call response samples, then storage.
    if(s.length>LIM && o.calls){ o.calls.forEach(function(c){ c.resp=''; }); s=build(o); }
    if(s.length>LIM){ o.storage=[]; s=build(o); }
    // Then, if still too big, trim the direct-fetch bodies (the primary payload) progressively.
    if(s.length>LIM && o.direct){ o.direct.forEach(function(d){ if(d.body) d.body=d.body.slice(0,2000); }); s=build(o); }
    if(s.length>LIM && o.direct){ o.direct.forEach(function(d){ if(d.body) d.body=d.body.slice(0,1000); }); s=build(o); }
    if(!s) s=JSON.stringify({done:true,error:"serialize",log:LOG.slice(-20).join("\\n")});
    window.__apidiag=s; }
  // Progressive snapshot (done:false) — surfaced to the native side via onPartial so each captured
  // finance call is written to file immediately; a later hang then can't lose what already came in.
  function snap(){ try{ var o={done:false,log:LOG.slice(-40).join("\\n"),calls:collect(),storage:tokenKeys()};
    var s=JSON.stringify(o); if(s.length>35000){ o.calls.forEach(function(c){ c.resp=''; }); s=JSON.stringify(o); } if(s.length>35000){ o.storage=[]; s=JSON.stringify(o); } window.__apidiag=s; }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,220); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button],[role=tab]')); }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  // ---- install the network hook once, as early as possible ----
  function redact(v){ v=String(v||''); if(v.length<=10) return '['+v.length+' kar.]'; return v.slice(0,10)+'…['+v.length+' kar.]'; }
  // Never capture a request body that carries credentials (login, or anything with a password field).
  function redactBody(url,b){ if(!b) return ''; b=String(b); if(/authenticate|login|password|jelsz/i.test(url||'') || /password|jelsz/i.test(b)) return '[kitakarva]'; return b.slice(0,500); }
  function redH(h){ var o={}; try{ if(h&&h.forEach){ h.forEach(function(v,k){ if(/^authorization$/i.test(k)){ window.__bearer=v; if(window.__maybeStart)window.__maybeStart(); } o[k]=/authorization|cookie|token/i.test(k)?redact(v):v; }); } else if(h&&typeof h==='object'){ Object.keys(h).forEach(function(k){ if(/^authorization$/i.test(k)){ window.__bearer=h[k]; if(window.__maybeStart)window.__maybeStart(); } o[k]=/authorization|cookie|token/i.test(k)?redact(h[k]):h[k]; }); } }catch(e){} return o; }
  if(!window.__apiHook){ window.__apiHook=true; window.__apiCalls=[]; window.__lastApi=Date.now();
    function rec(e){ try{ if(/\\/api\\//.test(e.url||'')) window.__lastApi=Date.now(); if(window.__apiCalls.length<120) window.__apiCalls.push(e); }catch(_){} }
    var of=window.fetch;
    if(of){ window.fetch=function(input,init){ init=init||{}; var url=(typeof input==='string')?input:((input&&input.url)||''); var method=(init.method||(input&&input.method)||'GET'); var reqH=redH(init.headers||(input&&input.headers)); var body=redactBody(url,init.body);
      return of.apply(this,arguments).then(function(res){ try{ var c=res.clone(); c.text().then(function(t){ rec({t:'fetch',url:url,method:method,headers:reqH,body:body,status:res.status,ct:(res.headers&&res.headers.get('content-type'))||'',resp:(t||'').slice(0,2500)}); },function(){}); }catch(e){ rec({t:'fetch',url:url,method:method,headers:reqH,body:body,status:res.status}); } return res; }); }; }
    var oOpen=XMLHttpRequest.prototype.open, oSend=XMLHttpRequest.prototype.send, oSet=XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.open=function(m,u){ this.__m=m; this.__u=u; this.__h={}; return oOpen.apply(this,arguments); };
    XMLHttpRequest.prototype.setRequestHeader=function(k,v){ try{ if(/^authorization$/i.test(k)){ window.__bearer=v; if(window.__maybeStart)window.__maybeStart(); } this.__h[k]=/authorization|cookie|token/i.test(k)?redact(v):v; }catch(e){} return oSet.apply(this,arguments); };
    XMLHttpRequest.prototype.send=function(b){ var self=this; try{ this.addEventListener('load',function(){ try{ var e={t:'xhr',url:self.__u,method:self.__m,headers:self.__h,body:redactBody(self.__u,b),status:self.status,ct:self.getResponseHeader('content-type')||'',resp:(self.responseText||'').slice(0,2500)}; rec(e); if(/\\/api\\//.test(self.__u||'')) log("API: "+self.__m+" "+String(self.__u).split('/api/')[1]); }catch(_){} }); }catch(e){} return oSend.apply(this,arguments); };
    log("Hálózat-figyelő telepítve");
  }
  function tokenKeys(){ var out=[]; [['local',window.localStorage],['session',window.sessionStorage]].forEach(function(pair){ try{ var st=pair[1]; for(var i=0;i<st.length;i++){ var k=st.key(i); var v=st.getItem(k)||''; var looksTok=/token|auth|oidc|msal|bearer|jwt|access/i.test(k) || (/^ey[A-Za-z0-9_-]+\\./.test(v)); if(looksTok) out.push({store:pair[0],key:k,len:v.length,preview:redact(v)}); } }catch(e){} }); return out; }
  function interesting(c){ var u=(c.url||''); if(/\\.(js|css|png|jpe?g|svg|woff2?|ttf|ico|gif|map)(\\?|$)/i.test(u)) return false; var ct=(c.ct||''); return /json/i.test(ct) || /\\/api\\/|hallgato|kreptn|neptun|advancement|curriculum|subject|targ/i.test(u); }
  var KEYCTRL=/curriculum|credit|advancement|training|subject|myTrainings|progress|kredit|targ|finance|payment|invoice|p[eé]nz|befizet|sz[aá]ml|t[eé]tel|d[ií]j|balance|egyenleg|transaction|tranzak/i;
  function collect(){ var seen={}, out=[]; (window.__apiCalls||[]).forEach(function(c){ if(!interesting(c)) return; var key=c.method+' '+c.url; if(seen[key]) return; seen[key]=1;
    // Finance discovery: keep the response for EVERY captured /api/ call (low volume here), so each
    // finance controller's shape is visible. deliver()/snap() trim if the payload gets too big.
    out.push({method:c.method,url:c.url,status:c.status,ct:c.ct,headers:c.headers,body:c.body,resp:(c.resp||'').slice(0,1800)}); }); return out.slice(0,80); }
  // Each fetch is capped at 12s so a hanging endpoint can't stall the whole run.
  function hit(ep){ var url=new URL('api/'+ep, document.baseURI).href; var ctrl=window.AbortController?new AbortController():null; var timer;
    var run=(async function(){ try{ var r=await fetch(url,{headers: window.__bearer?{Authorization:window.__bearer}:{}, credentials:'include', signal:ctrl?ctrl.signal:undefined}); var t=await r.text(); return {ep:ep,url:url,status:r.status,ct:(r.headers&&r.headers.get('content-type'))||'',body:(t||'').slice(0,9000)}; }catch(e){ return {ep:ep,url:url,error:String(e)}; } })();
    var to=new Promise(function(res){ timer=setTimeout(function(){ if(ctrl){try{ctrl.abort();}catch(_){}} res({ep:ep,url:url,error:"timeout(12s)"}); },12000); });
    return Promise.race([run,to]).then(function(out){ try{clearTimeout(timer);}catch(_){}; log("Direct "+ep+" → "+(out.status||out.error)); return out; }); }
  // Event-driven: fire the direct study calls the moment a Bearer token is captured (active network),
  // instead of polling for login/token which the throttled hidden webview can freeze.
  // Navigate the logged-in UI into Pénzügyek and its sub-tabs so the network hook captures the real
  // finance XHRs (endpoint URLs + response shapes) — the reliable way to discover them.
  async function navFinance(){
    // Clicking a Pénzügyek sub-tab navigates and CLOSES the menu, so re-open Menü → Pénzügyek before
    // EACH tab. snap() after each so the incremental file gets every tab even if a later one stalls.
    var subs=["Áttekintés","Befizetendő","Számlák","Tranzakciók","Ösztöndíjak és kifizetések","Jóváírások"];
    for(var i=0;i<subs.length;i++){
      try{
        var m=await waitFor(function(){return pick("Menü");},6000); if(m){ m.click(); await sleep(250); }
        var pz=await waitFor(function(){return pick("Pénzügyek");},5000); if(pz){ pz.click(); await sleep(450); } else log("nincs 'Pénzügyek'");
        var s=await waitFor(function(){return pick(subs[i]);},5000); if(s){ log("→ "+subs[i]); try{ s.click(); }catch(_){} await sleep(1500); snap(); } else log("nincs: "+subs[i]);
      }catch(e){ log("nav "+subs[i]+" hiba: "+String(e)); }
    }
    await sleep(400); snap();
  }
  async function runDirect(){
    try{
      log("Bejelentkezve — Pénzügyek felderítése…");
      var direct=[]; // finance-only: no study probes, straight to the finance navigation
      await navFinance(); // triggers the real finance XHRs → captured by the hook (collect())
      log("Kész — rögzített hívások: "+((window.__apiCalls||[]).length));
      deliver({origin:location.origin, base:document.baseURI, bearer: window.__bearer?("["+String(window.__bearer).length+" kar.]"):"nincs", direct:direct, calls:collect(), storage:tokenKeys()});
    }catch(err){ log("HIBA: "+String(err)); deliver({calls:collect(),storage:tokenKeys()}); }
  }
  function maybeStart(){ if(window.__bearer && !window.__directStarted){ window.__directStarted=true; runDirect(); } }
  window.__maybeStart=maybeStart;
  log("Figyelés indul — token bevárása (eseményvezérelt)");
  maybeStart(); // in case a bearer is already available
  return "started";
})();`;
}

// Grab the timetable subscription (iCal) link: login → Menü → Naptár → Naptár kezelése → read link.
async function grabIcsLink() {
  if (!isNative) { toast("Az automatikus lekérés a telefonos alkalmazásban működik."); return; }
  if (!state.username || !state.password) { toast("Előbb add meg a belépési adatokat."); return; }
  if (flowActive) { toast("Már fut egy Neptun folyamat, várj."); return; }
  await totpTick();
  courseLog = []; showBusy("Bejelentkezés…", true);
  let url = "", raw = "", cancelled = false, viaApi = false;
  try {
    // Preferred: direct API — returns the subscription link straight away.
    const sess = await getApiSession();
    if (sess && sess.token) { $("busy-text").textContent = "Naptár link lekérése…"; try { url = await apiReadIcsUrl(sess); if (url) viaApi = true; } catch (e) { dbg("API hiba: " + (e && e.message ? e.message : e)); } }
    // Fallback: DOM scraping.
    if (!url) { const res = await neptunReadIcsLink(); raw = (res && res.raw) || ""; if (res && res.log) courseLog = res.log.split("\n"); if (res && res.url) { url = res.url; dbg("Link: " + url); } else dbg("Nem találtam feliratkozási linket."); }
  } catch (e) { if (e && /Megszakítva/.test(e.message)) cancelled = true; else dbg("HIBA: " + (e && e.message ? e.message : e)); }
  finally { hideBusy(); }
  if (cancelled) { toast("Megszakítva"); return; }
  if (url) {
    const clean = url.replace(/^webcal:\/\//i, "https://");
    if (viaApi) { // API link is trustworthy → save + fetch automatically.
      state.icsUrl = clean; saveState(); updateIcsStatus(); $("ics-sheet").classList.add("hidden");
      renderTimetable(); renderExams(); await fetchTimetable(); return;
    }
    // Scraped link: fill the field, user presses Mentés.
    if ($("ics-input")) $("ics-input").value = clean;
    $("ics-sheet").classList.remove("hidden");
    toast("Link beírva. Nyomd meg a Mentést."); return;
  }
  try { if (raw) await navigator.clipboard.writeText(raw); } catch (e) { /* ignore */ }
  await ask({ title: "Lekérés napló", okText: "OK", body: courseLog.map((l) => esc(l)).join("<br>") + (raw ? "<br><br><b>A nyers oldalt a vágólapra másoltam</b> — illeszd be a beszélgetésbe." : "") });
}
$("ics-auto").onclick = grabIcsLink;
function buildIcsGrabScript(username, password, code) {
  const U = JSON.stringify(username), P = JSON.stringify(password), C = JSON.stringify(code || "");
  return `(function(){
  if(window.__icsRunning) return "running"; window.__icsRunning=true; window.__ics=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function deliver(u){ try{ window.__ics=JSON.stringify({done:true,url:u||"",log:LOG.join("\\n")}); }catch(e){} try{ window.location.href="https://neptunplus.done/?d="+encodeURIComponent(JSON.stringify({url:u||"",log:LOG.slice(-25).join("\\n")})); }catch(e){} }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function setVal(el,val){ if(!el) return; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=button]')); }
  function clickText(txt){ var el=pick(txt); if(el){ el.click(); return true; } return false; }
  function pick(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); return els[0]||null; }
  function loggedIn(){ return !document.querySelector('#userName') && !anyCode() && /Men[üu]/i.test(T()); }
  function anyCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).some(function(el){ if(!vis(el)) return false; var ml=parseInt(el.getAttribute('maxlength')||'0',10); var h=((el.id||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); return /code|otp|kod|k[oó]d|hiteles|authent|2fa|mfa/.test(h) || (ml>0&&ml<=8); }); }
  function findIcsUrl(){
    var urls=[]; var html=document.body.innerHTML||''; var m=html.match(/(webcal:\\/\\/|https?:\\/\\/)[^\\s"'<>\\\\)]+/gi); if(m) urls=urls.concat(m);
    Array.prototype.slice.call(document.querySelectorAll('input,textarea,[data-clipboard-text]')).forEach(function(el){ if(el.value) urls.push(el.value); var c=el.getAttribute&&el.getAttribute('data-clipboard-text'); if(c) urls.push(c); });
    var pri=urls.filter(function(u){ return /webcal:|\\.ics|ical|icalendar|calendar|napt[aá]r|feed|subscri/i.test(u); });
    return pri[0]||"";
  }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre (a hub-login intézi)…");
      var inOk=await waitFor(loggedIn, 60000);
      log(inOk?"Bejelentkezve":"Nem sikerült időben bejelentkezni");
      if(!inOk){ deliver(""); return; }
      // Faster than fixed sleeps: click each target the moment it becomes clickable (poll, no long waits).
      log("Menü"); var mEl=await waitFor(function(){return pick("Menü");},8000); if(mEl){ mEl.click(); await sleep(120);} else log("Nem találom: Menü");
      log("Naptár"); var nEl=await waitFor(function(){return pick("Naptár");},8000); if(nEl){ nEl.click(); await sleep(120);} else log("Nem találom: Naptár");
      log("Naptár kezelése"); var kEl=await waitFor(function(){return pick("Naptár kezelése");},8000); if(kEl){ kEl.click(); await sleep(120);} else log("Nem találom: Naptár kezelése");
      log("Feliratkozás link másolása"); var fEl=await waitFor(function(){return pick("Feliratkozás link másolása");},8000); if(fEl){ fEl.click();} else log("Nem találom: Feliratkozás link másolása");
      var url=await waitFor(findIcsUrl,8000); if(!url) url=findIcsUrl(); log(url?("Talált link"):("Nincs link a modalban"));
      try{ clickText("Bezárás"); }catch(e){}
      deliver(url);
    }catch(e){ log("HIBA: "+String(e)); deliver(""); }
  })();
  return "started";
})();`;
}
// One in-page routine: log in, click through Menü→Tárgyak→Felvett tárgyak, iterate the FÉLÉV filter, scrape.
function buildFullReadScript(username, password, code) {
  const U = JSON.stringify(username), P = JSON.stringify(password), C = JSON.stringify(code || "");
  return `(function(){
  if(window.__ncRunning) return "running"; window.__ncRunning=true; window.__nc=""; window.__ncLog="";
  var LOG=[]; function log(m){ LOG.push(m); window.__ncLog=LOG.join("\\n"); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function vis(el){ return el && el.offsetParent!==null && !el.disabled; }
  function T(){ return (document.body&&document.body.innerText)||""; }
  function setVal(el,val){ if(!el) return; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); }
  function waitFor(fn,ms){ return new Promise(function(res){ var t0=Date.now(); (function p(){ var v; try{v=fn();}catch(e){v=null;} if(v) return res(v); if(Date.now()-t0>ms) return res(null); setTimeout(p,300); })(); }); }
  function nodes(){ return Array.prototype.slice.call(document.querySelectorAll('a,button,span,div,li,[role=menuitem],[role=option],[role=button]')); }
  function clickText(txt){ txt=txt.toLowerCase(); var els=nodes().filter(function(el){ return vis(el) && (el.textContent||'').trim().toLowerCase()===txt; }); if(!els.length) els=nodes().filter(function(el){ var t=(el.textContent||'').trim().toLowerCase(); return vis(el) && t.indexOf(txt)>=0 && t.length<txt.length+24; }); els.sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); if(els[0]){ els[0].click(); return true; } return false; }
  function findSubmit(){ return nodes().filter(function(b){ if(!vis(b)) return false; var h=((b.id||'')+' '+(b.innerText||b.value||'')).toLowerCase(); return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|submit|login/.test(h); })[0]; }
  function findCode(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){ if(!vis(el)||el.value) return false; var t=(el.type||'').toLowerCase(); if(['text','tel','number','password'].indexOf(t)===-1) return false; var h=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); if(/code|otp|token|kod|k[oó]d|hiteles[ií]t|authent|2fa|mfa/.test(h)) return true; var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0&&ml<=8; }); }
  function parseRows(sem){ var main=document.querySelector('main')||document.body; var out=[],seen={};
    var ces=Array.prototype.slice.call(main.querySelectorAll('*')).filter(function(el){ return el.children.length===0 && /^[A-Z]{2,}[A-Z0-9]*\\d[A-Z0-9]*$/.test((el.textContent||'').trim()); });
    ces.forEach(function(ce){ var codev=(ce.textContent||'').trim(); if(seen[codev]) return; var row=ce;
      for(var k=0;k<8&&row.parentElement;k++){ row=row.parentElement; var rt=(row.innerText||''); if(rt.length>codev.length+8 && rt.split('\\n').length>=2) break; }
      var parts=(row.innerText||'').split('\\n').map(function(s){return s.trim();}).filter(Boolean); var ci=parts.indexOf(codev); if(ci<0) return;
      var name=parts[0]||codev; var status=(parts.find(function(s){return /^(teljes|nem teljes|al[aá][ií]r|folyamatban|akt[ií]v)/i.test(s);})||'');
      var credit=0; for(var j=ci+1;j<parts.length;j++){ if(/^\\d{1,2}$/.test(parts[j])){ credit=parseInt(parts[j],10); break; } }
      var req=(parts.find(function(s){return /(jegy|kollokvium|vizsga|al[aá][ií]r[aá]s|sz[aá]monk[eé]r[eé]s)/i.test(s);})||'');
      seen[codev]=1; out.push({code:codev,name:name,credits:credit,completed:/^teljes/i.test(status),semester:sem||'',teacher:'',type:req});
    }); return out; }
  function curSem(){ var m=T().match(/\\d{4}\\/\\d{2}\\/\\d/); return m?m[0]:''; }
  function semTriggers(){ return nodes().filter(function(el){ return vis(el) && /\\d{4}\\/\\d{2}\\/\\d/.test(el.textContent||'') && (el.textContent||'').length<44; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); }
  async function readSemesters(){ clickText("Szűrő"); await sleep(700); var tr=semTriggers(); if(tr[0]){ tr[0].click(); await sleep(600); } var opts=nodes().filter(function(el){ return vis(el)&&el.children.length<=1&&/\\d{4}\\/\\d{2}\\/\\d/.test(el.textContent||'')&&(el.textContent||'').length<44; }); var labels=[]; opts.forEach(function(el){ var m=(el.textContent||'').match(/\\d{4}\\/\\d{2}\\/\\d/); if(m&&labels.indexOf(m[0])<0) labels.push(m[0]); }); if(tr[0]) tr[0].click(); await sleep(300); return labels; }
  async function selectSem(key){ clickText("Szűrő"); await sleep(600); var tr=semTriggers(); if(tr[0]){ tr[0].click(); await sleep(600); } var opt=nodes().filter(function(el){ return vis(el)&&el.children.length<=1&&(el.textContent||'').indexOf(key)>=0&&(el.textContent||'').length<44; }).sort(function(a,b){return (a.textContent||'').length-(b.textContent||'').length;}); if(!opt[0]) return false; opt[0].click(); await sleep(400); clickText("Lista szűrése"); await sleep(1500); return true; }
  (async function(){
    try{
      log("Várakozás a bejelentkezésre (a hub-login intézi)…");
      var inOk=await waitFor(function(){ return !document.querySelector('#userName') && /Men[üu]/i.test(T()); }, 60000);
      log(inOk?"Bejelentkezve":"Nem sikerült időben bejelentkezni");
      if(!inOk){ window.__nc=JSON.stringify({done:true,courses:[],log:LOG.join("\\n"),raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)}); return; }
      await sleep(900);
      log("Menü megnyitása");
      if(!clickText("Menü")) log("Nem találom: Menü"); await sleep(900);
      log("Tárgyak menü"); if(!clickText("Tárgyak")) log("Nem találom: Tárgyak"); await sleep(900);
      log("Felvett tárgyak"); if(!clickText("Felvett tárgyak")) log("Nem találom: Felvett tárgyak"); await sleep(1500);
      var loaded=await waitFor(function(){ return /Felvett tárgyak/i.test(T()) && parseRows("").length>0; }, 15000);
      if(!loaded) log("A Felvett tárgyak lista nem jelent meg");
      var all=[]; var cs=curSem(); var first=parseRows(cs); log("Aktuális ("+cs+"): "+first.length+" tárgy"); all=all.concat(first);
      var sems=[]; try{ sems=await readSemesters(); }catch(e){ log("Félév-olvasás hiba: "+e); }
      log("Félévek: "+(sems.join(", ")||"—"));
      for(var i=0;i<sems.length;i++){ if(sems[i]===cs) continue; log("Váltás: "+sems[i]); var ok=false; try{ ok=await selectSem(sems[i]); }catch(e){ log("hiba: "+e); } if(!ok){ log("Sikertelen: "+sems[i]); continue; } var rows=parseRows(sems[i]); log(sems[i]+": "+rows.length+" tárgy"); all=all.concat(rows); }
      var seen={}, ded=[]; all.forEach(function(c){ var k=c.code+"|"+c.semester; if(c.code&&!seen[k]){ seen[k]=1; ded.push(c); } });
      window.__nc=JSON.stringify({done:true, courses:ded, semesters:sems.length?sems:(cs?[cs]:[]), log:LOG.join("\\n"), raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)});
    }catch(e){ window.__nc=JSON.stringify({done:true, courses:[], error:String(e), log:LOG.join("\\n"), raw:(document.querySelector('main')||document.body).outerHTML.slice(0,50000)}); }
  })();
  return "started";
})();`;
}
