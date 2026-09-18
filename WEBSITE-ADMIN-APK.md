# Legújabb APK az admin oldalon (leírás a website agentnek)

Cél: az admin.kreditplus.hu-n legyen egy **Alkalmazás** rész, ahol a tulajdonos (és a D1 `admins` táblában
lévők) látják a legújabb Android APK adatait, és letölthetik. Régebbi verziók is letölthetők.

Az APK a Cloudflare **R2**-ben van, egy **privát** tárolóban. Nyilvános címe nincs, csak a Worker olvassa,
a már meglévő Access + `admins` ellenőrzés mögött. **Soha ne kapcsold be a tároló nyilvános elérését
(r2.dev vagy custom domain)**, mert akkor bárki letölthetné.

---

## 0. Amit a MAIN (backend) szál csinál, erre építesz

- Tároló neve: **`kreditplus-apk`** (a MAIN hozza létre, amint a tulajdonos bekapcsolta az R2-t).
- Feltöltés: `node scripts/apk.mjs` a fő repóból (APK-építés után automatikusan). Ez tölti fel:

```
apk/KreditPlus-v0.308.apk      maga az APK (Content-Type: application/vnd.android.package-archive)
apk/KreditPlus-v0.308.json     a verzió adatai
apk/latest.json                a legfrissebb verzió adatai (ugyanaz a formátum)
```

- A `.json` formátuma (manifest):

```json
{
  "versionName": "0.308",
  "versionCode": 18,
  "appVersion": "v0.308",
  "file": "KreditPlus-v0.308.apk",
  "size": 16931531,
  "sha256": "37c2c5c0…",
  "builtAt": "2026-09-18T09:06:18.733Z",
  "uploadedAt": "2026-09-18T09:14:20.326Z",
  "signing": "debug",
  "notes": "Új widget-megjelenés"
}
```

A mezőkre építhetsz, de légy elnéző: ha egy mező hiányzik (pl. `notes`), ne törjön el a felület.

## 1. Binding (`website/wrangler.jsonc`)

```jsonc
"r2_buckets": [
  { "binding": "APK", "bucket_name": "kreditplus-apk" }
]
```

Élesítés előtt a tárolónak léteznie kell (különben a deploy hibát ad). Ha még nincs, szólj a MAIN-nak.

## 2. Admin végpontok (`src/admin.js`, a `handleAdmin` GET ágában, a meglévő `adminEmail` ellenőrzés után)

| Végpont | Mit ad |
|---|---|
| `GET /api/admin/apk` | `{ latest, versions }`. `latest` = az `apk/latest.json` tartalma (vagy `null`). `versions` = az `apk/` alatti összes `KreditPlus-v*.json` beolvasva, `versionCode` szerint csökkenő sorrendben, legfeljebb 20. (`env.APK.list({ prefix: "apk/" })`, majd a `.json` kulcsokra `env.APK.get(key)` → `.json()`.) |
| `GET /api/admin/apk/download/<fájlnév>` | Maga az APK letöltése. A fájlnév csak `^KreditPlus-v[0-9.]+\.apk$` lehet, minden más `404`. `env.APK.get("apk/" + név)`, nem létezőnél `404`. Válasz: az objektum `body`-ja streamként, fejlécek: `Content-Type: application/vnd.android.package-archive`, `Content-Disposition: attachment; filename="<név>"`, `Content-Length` (az objektum mérete), `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`. Naplózás: `log(env, me, "apk.download", <versionName>)`. |

- A letöltés GET, mert a böngésző így tudja fájlként menteni. A fájlnév nem személyes adat, mehet az URL-be.
- A választ **streameld** (`new Response(obj.body, …)`), ne olvasd be a memóriába (17 MB).
- Minden más admin-válaszhoz hasonlóan `no-store`, és csak az admin hoston létezik
  (`kreditplus.hu/api/admin/apk…` → `404`).

## 3. A felület: „Alkalmazás” rész

Új fül vagy blokk az admin oldalon (a meglévő stílusban, telefonon is használhatóan):

- **Legújabb verzió** kártya:
  - nagyban: `v0.308` (versionName), mellette halványan `build 18` (versionCode);
  - adatsorok: Méret (MB, egy tizedessel: 16,9 MB), Készült (dátum, magyar formátum), Megjegyzés (ha van),
    Ellenőrzőkód (SHA-256 első 12 karaktere + másolás gomb a teljeshez);
  - **Letöltés** gomb (sima `<a href="/api/admin/apk/download/KreditPlus-v0.308.apk">`, `download` attribútummal).
- **Korábbi verziók** lista: verzió, dátum, méret, megjegyzés, soronként egy letöltés link.
- Rövid tájékoztató a kártya alatt (fix szöveg, a DESIGN.md szerint gondolatjel nélkül):
  „Telefonon: töltsd le, majd nyisd meg a fájlt. Első alkalommal engedélyezni kell a telepítést ebből az
  alkalmazásból (Beállítások, Ismeretlen alkalmazások telepítése). A régi verziót felülírja, adat nem vész el.”
- Ha `signing` értéke `"debug"`, egy halvány megjegyzés: „Fejlesztői aláírás. Csak a saját és a tesztelők
  készülékeire, a Google Play-kiadás más kulccsal készül.”
- Üres állapot (még nincs feltöltött APK): „Még nincs feltöltött APK.”

## 4. Elfogadási feltételek

1. Belépés nélkül az `admin.kreditplus.hu/api/admin/apk` és a letöltés: Access belépő oldal, adat nem.
2. Belépve, de nem admin (nincs az `admins` táblában): `403`.
3. `GET /api/admin/apk` a legújabb és a korábbi verziókat adja, `versionCode` szerint csökkenőben.
4. A letöltés telefonon is működik, a fájl neve `KreditPlus-v0.308.apk`, mérete egyezik a manifestben lévővel.
5. `../`, más kiterjesztés, nem létező fájlnév: `404`.
6. Minden letöltés bekerül az `admin_log`-ba (`apk.download`, verzió).
7. A tároló nyilvános elérése KI van kapcsolva (Cloudflare irányítópult, R2, a tároló beállításai).
8. `kreditplus.hu` (publikus host) alól az APK-végpontok `404`-et adnak.

## 5. Helyi teszt

`wrangler dev` alatt az R2 binding helyben szimulált (üres). Tölts bele egy próbafájlt:
`npx wrangler r2 object put kreditplus-apk/apk/latest.json --file <valami.json> --local`
(és ugyanígy egy kis `.apk`-t), majd a meglévő `ACCESS_DEV_BYPASS` módszerrel teszteld.
