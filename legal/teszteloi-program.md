# Tesztelői program — jogi rögzítés

> A tesztelői program **csak a weboldalon** él, az appba nincs beágyazva. A teljes,
> jogilag hatályos szöveg a publikált oldalakon van, azok a mértékadók:
>
> - Tesztelői Feltételek: https://kreditplus.hu/teszteles/feltetelek/
>   (fájl: `website/teszteles/feltetelek/index.html`, `LEGAL:TESZT-ASZF-*` markerek közt)
> - Tesztelői adatkezelés: https://kreditplus.hu/teszteles/adatkezeles/
>   (fájl: `website/teszteles/adatkezeles/index.html`, `LEGAL:TESZT-ADATKEZELES-*` markerek közt)
>
> Ez a fájl azokat a **döntéseket** rögzíti, amiket a szöveg tartalmaz, hogy ne
> vesszenek el, és hogy a két hely ne csússzon szét. Ha a szöveget módosítod,
> itt is vezesd át.

Hatályos: 2026. szeptember 15.

---

## Mit gyűjt a jelentkezés (a tényleges D1 séma szerint)

A `testers` tábla: `name`, `email`, `university`, `android`, `accepted_terms`,
`created_at`. Neptun azonosítót, jelszót, hallgatói azonosítót **nem** kérünk, és
a tájékoztató ezt kifejezetten ki is mondja.

## Rögzített döntések

1. **Jogalap: hozzájárulás.** A jelentkezéskor kötelező pipa hivatkozik mindkét
   dokumentumra. Ezért a két oldal soha nem maradhat üresen, különben a
   hozzájárulás érvénytelen.
2. **Megőrzés.** Aki nem kerül be: a program lezárásáig, legfeljebb 12 hónap.
   Aki bekerül: amíg az örökös prémium jogosultságot nyilván kell tartani.
3. **A név nem nyilvános.** A jelenlegi jelentkezés nem jogosít fel arra, hogy a
   tesztelők nevét az appban vagy a weboldalon közzétegyük. Ha ilyen lista
   készül, ahhoz **külön, utólagos hozzájárulást** kell kérni.
4. **Google Play továbbítás.** Aki bekerül, annak az e-mail-címe felkerül a Play
   zárt tesztelői listájára. Ezt a tájékoztató néven nevezi.
5. **Örökös prémium, pontos határokkal:**
   - feltétele a teszt tényleges végigvitele (telepítés, használat, legalább egy
     érdemi visszajelzés),
   - az e-mail-címhez kötődik, nem ruházható át, nem váltható pénzre,
   - addig tart, **amíg a szolgáltatás működik**. Az „örökös" azt jelenti, hogy
     nincs lejárati ideje, nem azt, hogy a szolgáltatás örökké fog működni,
   - visszaélés esetén visszavonható,
   - az adatok törlésének kérése megszünteti, mert a jogosultság nem igazolható.
6. **Visszajelzés felhasználása.** A beküldött ötlet és hibajelentés szabadon
   felhasználható, ellenszolgáltatás nélkül. Ez a pont védi a fejlesztést egy
   későbbi „az én ötletem volt" igénnyel szemben.
7. **Nincs munkaviszony.** A feltételek kimondják, hogy a tesztelés nem
   munkaviszony és nem megbízás, díjazás a prémiumon kívül nem jár.
8. **Korhatár.** 16 év. 18 alatt szülői beleegyezés kérése.

## Kapcsolódó

- Az ÁSZF 8. pontja hivatkozik a tesztelői prémiumra, lásd [aszf.md](aszf.md).
- A fő adatkezelési tájékoztató 6. pontja továbbmutat ide, lásd
  [adatkezeles.md](adatkezeles.md).
