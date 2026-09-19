# Kredit+ Quiz formátum (v1)

Ez a formátum egyetlen hivatalos leírása. Erre épül:
- az app beolvasója (`www/js/quiz.js`: `quizParse`, `quizNormQ`);
- az app által generált AI-prompt (`quizPrompt`);
- a kreditplus.hu/quiz/ oldal, lásd WEBSITE-QUIZ.md.

Ha itt valami változik, mindhármat frissíteni kell.

A quiz egy JSON-objektum. Egy 100 kérdéses quiz kb. 60 KB.

```json
{
  "kreditplus_quiz": 1,
  "title": "Mikroökonómia 1. ZH",
  "subject": "Mikroökonómia",
  "questions": [ … ]
}
```

| Mező | Kötelező | Leírás |
|---|---|---|
| `kreditplus_quiz` | ajánlott | A formátum verziója, most `1`. |
| `title` | ajánlott | A quiz címe, legfeljebb 120 karakter. |
| `subject` | nem | A tárgy neve. Az app ehhez a tárgyhoz menti. |
| `questions` | igen | 1 és 300 közötti számú kérdés. |

## Kérdések

Minden kérdés közös mezői:

| Mező | Kötelező | Leírás |
|---|---|---|
| `type` | ajánlott | `single`, `multi`, `number`, `truefalse` vagy `text`. |
| `q` | igen | A kérdés (igaz-hamisnál az állítás), legfeljebb 2000 karakter. |
| `explain` | ajánlott | Rövid magyarázat, hogy miért ez a helyes válasz. |
| `page` | ajánlott | A PDF-fájl oldalszáma, ahol a válasz található. Az 1 a fájl első oldala, nem a nyomtatott oldalszám. Az app ide ugrik a „Megnézem” gombbal. |

### `single`: egy helyes válasz (A, B, C, D)

- `options`: 2-8 válaszlehetőség, csak a szöveg, betű nélkül.
- `answer`: a helyes válasz **betűje**: `"A"`, `"B"` és így tovább.

```json
{ "type": "single", "q": "Mit mutat a kereslet árrugalmassága?",
  "options": ["A jövedelem hatását", "A keresett mennyiség %-os változását az ár 1%-os változására", "A kínálat változását", "A költséget"],
  "answer": "B", "explain": "Definíció szerint.", "page": 12 }
```

### `multi`: több helyes válasz

- `options`: 2-8 válaszlehetőség.
- `answer`: a helyes válaszok betűi, pl. `["A", "C"]`.
- Csak akkor helyes, ha pontosan ezek vannak bejelölve.

### `number`: számos válasz

- `answer`: szám tizedesponttal, pl. `12.5`.
- `tolerance`: nem kötelező. A megengedett eltérés, pl. `0.1` a kerekítés miatt. Alapból 0.
- `unit`: nem kötelező. A mértékegység, pl. `"Ft"` vagy `"%"`. Az app a beviteli mező mellé írja.
- Az app a tizedesvesszőt is elfogadja a felhasználótól, pl. `12,5`.

### `truefalse`: igaz vagy hamis

- `q`: maga az állítás.
- `answer`: `true` vagy `false`.

### `text`: rövid szöveges válasz

- `answer`: az elfogadott válaszok listája, pl. `["Pareto-hatékonyság", "Pareto-optimum"]`. Legfeljebb 20 elem.
- Az összehasonlításnál nem számít:
  - a kis- és nagybetű;
  - az ékezet;
  - a kötőjel;
  - az írásjelek.

## Amit az app elnézően kezel (az AI-k tipikus hibái)

- **A JSON körüli szöveg:** a kódblokkot (` ```json `) és az előtte vagy utána álló magyarázó szöveget is elfogadja, a quizt kikeresi belőle.
- **Csak kérdéstömb:** ha az AI csak a `[ … ]` kérdéslistát adja, az is jó.
- **Záró vessző** az utolsó elem után.
- **Válaszlehetőség betűvel:** az `"A) szöveg"` alakról levágja a betűt. A helyes válasz megadható a válasz szövegével is.
- **Más mezőnevek:**
  - `question` = `q`;
  - `choices` = `options`;
  - `correct` = `answer`;
  - `explanation` = `explain`.
- **Más típusnevek:**
  - `abcd`, `mc` = `single`;
  - `tf`, `boolean` = `truefalse`;
  - `numeric` = `number`.
- **Hiányzó `type`:** a mezőkből kitalálja.
- **Igaz-hamis szöveggel:** az `"igaz"` és a `"hamis"` is elfogadott.
- **Szám szövegként:** a `"4,0"` is elfogadott.

**Nem elfogadott:** ha a `single` vagy a `multi` típusnál a helyes válasz számmal van megadva (`"answer": 1`). Nem egyértelmű, hogy 0-tól vagy 1-től számol. Az app ilyenkor kihagyja a kérdést, és megírja, miért.

A hibás kérdéseket az app kihagyja és felsorolja („6. kérdés: 2 és 8 közötti számú válasz kell”), a többit betölti. Ha a válasz félbeszakadt (több a nyitó zárójel, mint a záró), azt külön jelzi.

## JSON Schema

A weboldalon `kreditplus.hu/quiz/schema.json` címen kell közzétenni.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://kreditplus.hu/quiz/schema.json",
  "title": "Kredit+ Quiz v1",
  "type": "object",
  "required": ["questions"],
  "properties": {
    "kreditplus_quiz": { "const": 1 },
    "title": { "type": "string", "maxLength": 120 },
    "subject": { "type": "string", "maxLength": 120 },
    "questions": {
      "type": "array", "minItems": 1, "maxItems": 300,
      "items": {
        "type": "object",
        "required": ["type", "q", "answer"],
        "properties": {
          "type": { "enum": ["single", "multi", "number", "truefalse", "text"] },
          "q": { "type": "string", "minLength": 1, "maxLength": 2000 },
          "options": { "type": "array", "minItems": 2, "maxItems": 8, "items": { "type": "string", "minLength": 1 } },
          "answer": {},
          "tolerance": { "type": "number", "minimum": 0 },
          "unit": { "type": "string", "maxLength": 20 },
          "explain": { "type": "string", "maxLength": 3000 },
          "page": { "type": "integer", "minimum": 1 }
        },
        "allOf": [
          { "if": { "properties": { "type": { "const": "single" } } }, "then": { "required": ["options"], "properties": { "answer": { "type": "string", "pattern": "^[A-H]$" } } } },
          { "if": { "properties": { "type": { "const": "multi" } } }, "then": { "required": ["options"], "properties": { "answer": { "type": "array", "minItems": 1, "items": { "type": "string", "pattern": "^[A-H]$" } } } } },
          { "if": { "properties": { "type": { "const": "number" } } }, "then": { "properties": { "answer": { "type": "number" } } } },
          { "if": { "properties": { "type": { "const": "truefalse" } } }, "then": { "properties": { "answer": { "type": "boolean" } } } },
          { "if": { "properties": { "type": { "const": "text" } } }, "then": { "properties": { "answer": { "type": "array", "minItems": 1, "maxItems": 20, "items": { "type": "string", "minLength": 1 } } } } }
        ]
      }
    }
  }
}
```

## Az általános AI-utasítás (prompt)

A weboldalon `kreditplus.hu/quiz/prompt.txt` címen, UTF-8 sima szövegként kell közzétenni. Az app ugyanezt állítja össze, a felhasználó beállításaival kiegészítve (tárgy, kérdésszám, típusok, nehézség, külön kérés).

**Szöveges változat (v0.315).** Ha az appban anyagot választanak, a PDF szövegét az app olvassa ki. A szöveget a prompt után illeszti be `ANYAG:` címkével, oldalanként `=== 12. oldal ===` jelöléssel (ez a PDF-fájl oldalszáma), a felhasználó saját szövegdobozait pedig `[Saját jegyzet]` jelöléssel. Ilyenkor a prompt 1. mondata és 4. szabálya erre a jelölésre hivatkozik, csatolni nem kell. Szkennelt PDF-nél (az oldalak kevesebb mint 30%-án van szöveg) marad a csatolás.

```text
Készíts egy gyakorló quizt a Kredit+ egyetemi app számára a csatolt anyagból.

Ha nem mondtam mást: 20 kérdés, "single" típusú (A, B, C, D), közepes nehézség.

Szabályok:
1. Csak a csatolt anyag tartalmából kérdezz, ne találj ki tényeket. A kérdések a teljes anyagot fedjék le, ne csak az elejét.
2. Minden kérdésnek egyértelmű, az anyag alapján ellenőrizhető helyes válasza legyen.
3. A rossz válaszok legyenek hihetők, de egyértelműen rosszak. A helyes válasz betűje legyen változatos.
4. Minden kérdéshez írj rövid magyarázatot ("explain"), és add meg a PDF-fájl oldalszámát ("page", az 1 a fájl első oldala), ahol a válasz megtalálható.
5. A válaszod CSAK egy JSON kódblokk legyen, pontosan az alábbi formátumban, előtte és utána semmilyen szöveg nélkül.
6. Ha nem tudsz ennyi jó kérdést írni az anyagból, írj kevesebbet.

Kérdéstípusok:
- "single": egy helyes válasz. "options": 4 válaszlehetőség (csak a szöveg, betű nélkül), "answer": a helyes válasz betűje ("A", "B", "C" vagy "D").
- "multi": több helyes válasz. "options": 4-6 válaszlehetőség, "answer": a helyes válaszok betűi, pl. ["A", "C"].
- "number": a válasz egy szám. "answer": szám tizedesponttal (pl. 12.5), "tolerance": megengedett eltérés (pl. 0.1, kerekítéshez), "unit": mértékegység, ha van (pl. "Ft", "%").
- "truefalse": igaz vagy hamis állítás. "q": maga az állítás, "answer": true vagy false.
- "text": rövid, egy-három szavas válasz (fogalom, név). "answer": az elfogadott válaszok listája, pl. ["Pareto-hatékony", "Pareto-optimális"].
Minden kérdés mezői: "type", "q" (a kérdés), a típus mezői, "explain", "page".

Formátum (példa):
{
  "kreditplus_quiz": 1,
  "title": "Tárgy gyakorló quiz",
  "questions": [
    { "type": "single", "q": "Mit mutat a kereslet árrugalmassága?", "options": ["A kereslet változását a jövedelem változására", "A keresett mennyiség százalékos változását az ár 1%-os változására", "Az ár változását a kínálat változására", "A termelési költség változását"], "answer": "B", "explain": "Az árrugalmasság a keresett mennyiség relatív változása osztva az ár relatív változásával.", "page": 12 },
    { "type": "truefalse", "q": "A tökéletesen rugalmatlan kereslet görbéje vízszintes.", "answer": false, "explain": "Függőleges: a mennyiség nem változik az árral.", "page": 13 }
  ]
}

A formátum teljes leírása: https://kreditplus.hu/quiz/
```

## Tárolás az appban

- **Metaadat:** a `state.quizzes` mezőben, profilonként. Ide kerül a cím, a kérdések száma, a típusok száma, a tárgyak, a forrás PDF azonosítója (`mid`), az eredmények (`stats`) és az utolsó kör hibás kérdései (`wrong`).
- **Kérdések:** az anyagok IndexedDB `docs` tárolójában, `q…` azonosítóval.
- **Mentés:** az Anyagok .zip mentése a quizeket is tartalmazza (`quizzes` lista).
- **Megosztás most:** „Másolás megosztáshoz” (a quiz szövegként a vágólapra), a másik fél beillesztéssel veszi fel.
- **Linkes megosztás** (`kreditplus.hu/q/…`): később, szerverrel és APK-val.
