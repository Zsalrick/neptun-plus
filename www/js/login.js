// Belépés a Neptunba (natív böngésző + előnézet).
// Sima szkript, KÖZÖS hatókörrel: a www/index.html tölti be sorrendben. Lásd PROJECT.md "Fájlok".
"use strict";

// =====================================================================
//  LOGIN ENGINE (unchanged behaviour)
// =====================================================================
$("btn-login").onclick = async () => {
  if (!state.username || !state.password) return toast("Hiányoznak a belépési adatok.");
  await totpTick();
  const srv = activeServer();
  if (isNative) return nativeLogin(srv, apiSessionValid(60000) ? apiSession.token : "");
  return browserPreviewLogin(srv);
};
const BROWSER_UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36";
function nativeLogin(srv, token) {
  const code = state.no2fa ? "" : lastCode;
  // API-first login (new Neptun): authenticate via the API, drop the token in, and load the
  // dashboard already logged in — independent of the login page's layout. Falls back to filling
  // the form (works on the standard Angular login) if the API isn't there / doesn't return a token.
  // If we already hold a still-valid warm token, inject it straight in → instant, no re-auth / no 2FA.
  const script = buildLoginScript(state.username, state.password, code, token || "");
  // A saját, app-témájú böngésző (BrowserActivity) — ha elérhető. Egyébként a stock InAppBrowser.
  const AB = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AppBrowser;
  if (AB) { try { AB.open({ url: srv.url, script, ua: BROWSER_UA }); toast(token ? "Belépés (aktív munkamenet)…" : "Belépés folyamatban…"); return; } catch (e) { /* fall through to IAB */ } }
  const iab = window.cordova && window.cordova.InAppBrowser;
  if (!iab) { toast("InAppBrowser plugin hiányzik (lásd README)."); return; }
  // Letisztult sáv: URL és előre/vissza nyilak elrejtve, csak a "Kész" gomb marad. A lapozás a
  // telefon vissza gombjával megy (hardwareback). Sötét, app-témájú toolbar.
  const opts = ["location=yes", "hideurlbar=yes", "hidenavigationbuttons=yes", "zoom=yes", "hardwareback=yes", "footer=no",
    "toolbarcolor=#141518", "navigationbuttoncolor=#ecedee", "closebuttoncolor=#ecedee", "closebuttoncaption=Kész"].join(",");
  const ref = iab.open(srv.url, "_blank", opts);
  ref.addEventListener("loadstop", () => { try { ref.executeScript({ code: script }); } catch (e) { /* ignore */ } });
  toast(token ? "Belépés (aktív munkamenet)…" : "Belépés folyamatban…");
}
// Combined login: reuse a warm token if given, else try the Neptun API (Account/Authenticate),
// then fall back to filling the form.
function buildLoginScript(username, password, code, token) {
  const u = JSON.stringify(username), p = JSON.stringify(password), c = JSON.stringify(code || ""), t = JSON.stringify(token || "");
  return `(function(){
  if(window.__npLoginRan) return; window.__npLoginRan=true;
  function setVal(el,val){ if(!el) return false; var proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,val); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); return true; }
  function click(el){ if(el){ el.click(); return true;} return false; }
  function visible(el){ return el && el.offsetParent!==null && !el.disabled; }
  function waitFor(sel,timeout){ return new Promise(function(res){ var t0=Date.now(); (function poll(){ var el=(typeof sel==='function')?sel():document.querySelector(sel); if(el&&visible(el)) return res(el); if(Date.now()-t0>timeout) return res(null); setTimeout(poll,250); })(); }); }
  function findCodeField(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){ if(!visible(el)||el.value) return false; var t=(el.type||'').toLowerCase(); if(['text','tel','number','password'].indexOf(t)===-1) return false; var hay=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase(); if(/code|otp|token|kod|kód|hitelesít|authent|2fa|mfa|one-time/.test(hay)) return true; var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0&&ml<=8; }); }
  function findSubmit(){ return Array.prototype.slice.call(document.querySelectorAll('button, input[type=submit]')).find(function(b){ if(!visible(b)) return false; var hay=((b.id||'')+' '+(b.innerText||b.value||'')+' '+(b.getAttribute('aria-label')||'')).toLowerCase(); return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|confirm|submit|login/.test(hay); }); }
  // Username / password / submit — work on both the new Angular (#userName …) and classic MVC (#LoginName …) pages.
  function findUser(){ var el=document.querySelector('#userName, #LoginName, input[name=LoginName], input[name=UserName], input[name=userName]'); if(el&&visible(el)) return el;
    return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(i){ if(!visible(i)) return false; var t=(i.type||'text').toLowerCase(); if(['text','email','tel'].indexOf(t)===-1) return false; var h=((i.id||'')+' '+(i.name||'')+' '+(i.placeholder||'')+' '+(i.getAttribute('aria-label')||'')).toLowerCase(); if(/keres|search/.test(h)) return false; var ml=parseInt(i.getAttribute('maxlength')||'0',10); if(ml>0&&ml<=8) return false; return true; }); }
  function findPass(){ return document.querySelector('#password-form-password, #Password, input[name=Password], input[type=password]'); }
  function findLoginBtn(){ return document.querySelector('#login-button') || findSubmit(); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function domLogin(){ click(document.querySelector('#notification-bar-0-notification-button-accept')); var user=await waitFor(findUser,10000); if(user){ setVal(user, ${u}); var pw=findPass(); if(pw) setVal(pw, ${p}); await sleep(200); var sb=findLoginBtn(); if(sb) click(sb); } var CODE=${c}; if(CODE){ var codeEl=await waitFor(findCodeField,12000); if(codeEl){ setVal(codeEl,CODE); await sleep(250); setVal(codeEl,CODE); await sleep(1000); var btn=await waitFor(findSubmit,8000); if(btn){ btn.click(); await sleep(700); if(visible(btn)) btn.click(); } } } }
  (async function(){
    try{
      if(sessionStorage.getItem('__npLogged')){ return; } // already logged in via API on a previous load
      var base=document.baseURI;
      var TOKEN=${t};
      if(TOKEN){ // warm token from the app → land on the dashboard instantly, no auth round-trip
        try{ sessionStorage.setItem('access_token',TOKEN); }catch(e){}
        try{ sessionStorage.setItem('__npLogged','1'); }catch(e){}
        location.href=base; return;
      }
      var authUrl=new URL('api/Account/Authenticate', base).href;
      var r=await fetch(authUrl,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'include',body:JSON.stringify({userName:${u},password:${p},captcha:"",captchaIdentifier:"",token:${c}||"",LCID:1038})});
      if(r && r.ok){ var d=null; try{ d=await r.json(); }catch(e){}
        var tok=d&&(d.accessToken||(d.data&&d.data.accessToken));
        if(tok){ try{ sessionStorage.setItem('access_token',tok); }catch(e){}
          var exp=d&&(d.accessTokenExpiration||d.accessTokenExpirationDate||(d.data&&(d.data.accessTokenExpiration||d.data.accessTokenExpirationDate))); if(exp){ try{ sessionStorage.setItem('access_token_expiration_date',exp); }catch(e){} }
          try{ sessionStorage.setItem('__npLogged','1'); }catch(e){}
          location.href=base; return; // load the dashboard, logged in — no buttons to press
        }
      }
      await domLogin(); // API not available or no token → fill the form the old way
    }catch(e){ try{ await domLogin(); }catch(_){} }
  })();
})();`;
}
function browserPreviewLogin(srv) {
  const code = state.no2fa ? "" : lastCode;
  $("login-modal-body").innerHTML = `A böngészős előnézet nem tud közvetlenül belépni, mert a böngésző ezt biztonsági okból nem engedi. A kész alkalmazás ezt automatikusan elvégzi:
    <ol style="padding-left:18px;line-height:1.7;margin:8px 0 0">
      <li>Megnyitja ezt a címet: <span class="mono">${esc(srv.url)}</span></li>
      <li>Kitölti az azonosítót, ${esc(state.username)}, és a jelszót</li>
      <li>Belép, majd beírja a 2FA kódot: <b class="mono">${code || "nincs"}</b></li>
      <li>Megnyomja a Bejelentkezést</li></ol>`;
  $("login-modal").classList.remove("hidden");
  $("lm-open").onclick = async () => { try { await navigator.clipboard.writeText(code || state.password); toast(code ? "2FA kód a vágólapon: " + code : "Jelszó a vágólapon."); } catch { /* ignore */ } window.open(srv.url, "_blank", "noopener"); };
}
$("login-modal-close").onclick = () => $("login-modal").classList.add("hidden");

function buildInjectScript(username, password, code) {
  const u = JSON.stringify(username), p = JSON.stringify(password), c = JSON.stringify(code || "");
  return `(function(){
  function setVal(el, val){ if(!el) return false;
    var proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(el, val);
    el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); el.dispatchEvent(new Event('blur',{bubbles:true})); return true; }
  function click(el){ if(el){ el.click(); return true;} return false; }
  function visible(el){ return el && el.offsetParent !== null && !el.disabled; }
  function waitFor(sel, timeout){ return new Promise(function(res){ var t0=Date.now();
    (function poll(){ var el=(typeof sel==='function')?sel():document.querySelector(sel);
      if(el && visible(el)) return res(el); if(Date.now()-t0>timeout) return res(null); setTimeout(poll,250); })(); }); }
  function findCodeField(){ return Array.prototype.slice.call(document.querySelectorAll('input')).find(function(el){
    if(!visible(el)||el.value) return false; var t=(el.type||'').toLowerCase();
    if(['text','tel','number','password'].indexOf(t)===-1) return false;
    var hay=((el.id||'')+' '+(el.name||'')+' '+(el.getAttribute('formcontrolname')||'')+' '+(el.getAttribute('aria-label')||'')+' '+(el.getAttribute('autocomplete')||'')+' '+(el.placeholder||'')).toLowerCase();
    if(/code|otp|token|kod|kód|hitelesít|authent|2fa|mfa|one-time/.test(hay)) return true;
    var ml=parseInt(el.getAttribute('maxlength')||'0',10); return ml>0 && ml<=8; }); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function findSubmit(){ return Array.prototype.slice.call(document.querySelectorAll('button, input[type=submit]')).find(function(b){
    if(!visible(b)) return false; var hay=((b.id||'')+' '+(b.innerText||b.value||'')+' '+(b.getAttribute('aria-label')||'')).toLowerCase();
    return /bejelentkez|bel[eé]p|tov[aá]bb|meger[oő]s|hiteles[ií]t|ellen[oő]r|verify|confirm|submit|login/.test(hay); }); }
  (async function(){
    click(document.querySelector('#notification-bar-0-notification-button-accept'));
    var user = await waitFor('#userName', 8000);
    if(user){ setVal(user, ${u}); setVal(document.querySelector('#password-form-password'), ${p}); await sleep(150); click(document.querySelector('#login-button')); }
    var CODE = ${c};
    if(CODE){ var codeEl = await waitFor(findCodeField, 12000);
      if(codeEl){ setVal(codeEl, CODE); await sleep(250); setVal(codeEl, CODE); await sleep(1000);
        var btn = await waitFor(findSubmit, 8000);
        if(btn){ btn.click(); await sleep(700); if(visible(btn)) btn.click(); } } }
  })();
})();`;
}
window.buildNeptunInjectScript = buildInjectScript;
