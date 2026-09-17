// A külső könyvtárak ES modulok. A többi app-fájl sima szkript közös hatókörrel,
// ezért ezeket globálisan tesszük elérhetővé. Az index.html-ben a többi fájl ELŐTT kell lennie.
import { generateTOTP } from "../lib/totp.js";
import { parseMigrationUri } from "../lib/gauth.js";
import { UNIVERSITIES } from "../data/universities.js";
import { parseICS } from "../lib/ical.js";
Object.assign(window, { generateTOTP, parseMigrationUri, UNIVERSITIES, parseICS });
