# Neptun Auto-Login

Egyszerű app, ami a Neptun tanulmányi rendszerbe automatikusan bejelentkezik:
kitölti az azonosítót, a jelszót és a **kétlépcsős (2FA) hitelesítő kódot**, majd belép.

- **Szerverek**: több login-URL tárolható, kiválasztható az aktív (alapból a Pannon Egyetem 3 szervere).
- **2FA**: a hitelesítő kulcs megadható kézzel (Base32), vagy feltölthető a **Google Authenticator
  exportált QR-képe**, amiből az app kiolvassa a kulcso(ka)t. A 6 jegyű kód élőben, helyben generálódik
  (RFC 6238 TOTP), semmi nem megy külső szerverre.
- **Adatvédelem**: minden csak az eszközön tárolódik (a webes előnézetben `localStorage`, az APK-ban
  az Android biztonságos tárolójában).

## 1. Webes előnézet (gépen)

```bash
node server.js
```

Böngészőben: <http://localhost:5178>

A ⚙ ikonnal éred el a beállításokat (szerverek, belépési adatok, 2FA / QR-feltöltés).

> A böngészős előnézet **nem tud** ténylegesen belépni a Neptunba (a böngésző CORS-védelme +
> a Neptun Angular-alkalmazása miatt) — ez csak a felületet és a valós 2FA kódot mutatja.
> A tényleges automatikus belépés az **APK-ban** történik.

Modulok gyors tesztje (TOTP + Google Auth export-olvasó):

```bash
node test.mjs
```

## 2. APK készítése (Capacitor)

Előfeltétel: **Node**, **Android Studio** (Android SDK + JDK 17).

```bash
# projekt gyökeréből
npm init -y
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Neptun Auto-Login" hu.neptun.autologin --web-dir=www

# a beépített böngésző (autofill) plugin
npm install cordova-plugin-inappbrowser

# android platform + build
npx cap add android
npx cap sync
npx cap open android      # Android Studioban: Build > Build APK(s)
```

A kész APK: `android/app/build/outputs/apk/debug/app-debug.apk` — ezt másold a telefonra és telepítsd
(„ismeretlen forrás" engedélyezése kell).

### Hogyan lép be az APK (WebView + autofill)

A `www/app.js` `nativeLogin()` függvénye a `cordova-plugin-inappbrowser` beépített böngészőjét
nyitja meg az aktív szerver URL-jén, majd minden oldalbetöltéskor beinjektálja a `buildInjectScript()`
által előállított scriptet. Ez a Neptun oldalán (a valós, ellenőrzött mező-azonosítókkal):

1. elfogadja a süti-sávot (`#notification-bar-0-notification-button-accept`),
2. kitölti az azonosítót (`#userName`) és a jelszót (`#password-form-password`),
3. rákattint a belépés gombra (`#login-button`),
4. megvárja a 2FA kód mezőt (rugalmas kereséssel), beírja az aktuális kódot és elküldi.

Mivel WebView-ben fut (ugyanazon az origin-en, mint a Neptun oldal), nincs CORS-akadály.

### Titkosított tárolás (ajánlott bővítés)

Alapból `localStorage`-ot használ. Éles használatra érdemes a jelszót az Android Keystore-ba tenni:

```bash
npm install @capacitor-community/secure-storage-plugin
```

…és a `saveState()`/`loadState()` a jelszó mezőre ezt használja `localStorage` helyett.

## Fájlok

| Fájl | Szerep |
|------|--------|
| `www/index.html` | Felület (telefon-keret az előnézethez) |
| `www/styles.css` | Stílus (világos/sötét téma) |
| `www/app.js` | Logika: állapot, élő TOTP, QR-feltöltés, belépés (WebView autofill + előnézet) |
| `www/lib/totp.js` | Base32 + TOTP (Web Crypto, RFC 6238) |
| `www/lib/gauth.js` | Google Authenticator export (`otpauth-migration`) protobuf-olvasó |
| `www/lib/jsQR.js` | QR-kód beolvasás képből |
| `server.js` | Statikus szerver az előnézethez |
| `test.mjs` | Modulok headless tesztje |
