# Kredit+ — Design guide

A cél: **prémium, letisztult, szerkesztőségi** érzet. Fekete-fehér alap, **egyetlen visszafogott
arany akcentus** (a „+" a logóban). Ha egy elem „okosnak/AI-generáltnak" néz ki, valószínűleg az is.
Kevesebb dekoráció, több tipográfia és tér.

## Referenciák (ezekből dolgozz)
- **Linear** — állapot tipográfiával és csoportosítással, nem dekorációval; hajszálvékony elválasztók.
- **Things 3 / Apple Reminders, Calendar** — nyugodt listák, világos hierarchia, halk másodlagos szöveg.
- **Notion, Stripe Dashboard, Vercel** — sok tér, kevés szín, rács-fegyelem, mértéktartó kontraszt.

Mielőtt kártyát/badge-et/ikont raksz be: nézd meg, hogy csinálná ezt a Linear vagy a Things.

## TILTOTT (AI-slop jegyek — NE használd)
- **Világító / pulzáló pöttyök**, színes glow-gyűrű (`box-shadow: 0 0 0 Npx <szín>`), „notification dot" halo.
- **Pill-badge minden apró infóra** — kerekített, körberajzolt (`border-radius:999px` + border) állapot-címkék tömkelege.
- **Gradiens, neon, glow, dobozárnyék hangsúlyként.** Sík felület + hajszál-border a helyes.
- **Az arany akcentus túlhasználata.** Az arany 1 akcentus (a „+"), nem minden aktív elem kerete/pöttye/szövege.
- **Szivárvány szín-kód, telített kitöltések** (neonzöld/sárga/piros dobozok). Ha szín kell, tompított és ritka.
- **ALL-CAPS adat** nyersen a UI-ban (a Neptun így küldi) — lágyítsd sentence-case-re.
- **Kártya a kártyában**, mindenütt border, azonos súlyú „kártya-fal" (minden elem egyforma nagy doboz).
- **Középre zárt tartalom** listáknál; **emoji**; ikon-özön; felesleges „chip"-ek.
- **Felkiáltó mikro-szövegek** („✨ Szuper!", „Nézd meg!") — tárgyilagos, magyar, kötőjel (—) és emoji nélkül.

## HELYETTE (mit csinálj)
- **Állapotot csoportosítással + tipográfiával jelezz** (szekciócím, betűsúly, `--ink`/`--ink-2`/`--ink-3`
  fokozatok), nem pöttyel/pillel. Lezárult = halkabb szöveg (`--ink-2`), nem opacity-fátyol.
- **Másodlagos infó = halk, jobbra zárt sima szöveg** (pl. „még 91 nap"), nem badge.
- **Hajszál-elválasztók** (`1px var(--line)`) sorok között; egy `.card` per csoport, nem doboz-per-elem.
- **Tipó-skála:** cím 14–16px / 600, másodlagos 12.5–13px `--ink-3`. Címekre Bricolage, számokra
  IBM Plex Mono (`--font-mono`), törzsre Hanken (`--font-body`).
- **Szín takarékosan:** alap monokróm; a `--brand-plus` aranyat csak igazi kiemelésre, egyszer egy nézetben.
  Veszélyre `--danger`. Jegyekhez tompított, gyűrűs (nem tömör-neon) jelölés.
- **Tér:** nagyvonalú padding/margó; ne zsúfolj. Üres állapotok barátságos, rövid szöveggel.

## Meglévő tokenek (styles.css `:root`)
- Felületek: `--bg`, `--surface`, `--surface-2/3`; szöveg `--ink`, `--ink-2`, `--ink-3`; vonal `--line`, `--line-2`.
- Akcentus: `--brand-plus` (arany, ritkán), `--accent` (porcelán, primer gomb), `--danger`.
- Font: `--font-brand` (Bricolage, címek), `--font-body` (Hanken), `--font-mono` (IBM Plex Mono, számok).

## Takarítandó (meglévő AI-slop, cseréld amikor arra jársz)
- Pulzáló „most zajlik" animációk és unread glow-gyűrűk (`nc-now` pulse, `msg-avatar.unread` shadow-ring).
- Bárhol maradt outline-pill state-badge vagy glow-pötty.
