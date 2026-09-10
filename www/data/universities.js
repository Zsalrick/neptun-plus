// Hungarian higher-education institutions with their Neptun student login URLs.
// Verified 2026-09: every host below resolves to a real Neptun server (connectivity
// tested via the public api/General/EnvironmentData endpoint + DNS). Guessed hosts that
// did not exist were dropped — those institutions use the "custom URL" option in Settings.
// Names follow the official OH/FIR institution list.
export const UNIVERSITIES = [
  { name: "Pannon Egyetem", city: "Veszprém", alias: "pannon veszprem uni-pannon", servers: [
    { label: "SZERVER1", url: "https://neptun-ws01.uni-pannon.hu/hallgato/login" },
    { label: "SZERVER2", url: "https://neptun-ws02.uni-pannon.hu/hallgato/login" },
    { label: "SZERVER3", url: "https://neptun-ws03.uni-pannon.hu/hallgato/login" },
  ] },
  { name: "Eötvös Loránd Tudományegyetem", city: "Budapest", alias: "elte eotvos lorand", servers: [
    { label: "Neptun", url: "https://neptun.elte.hu/hallgato/login" } ] },
  { name: "Budapesti Műszaki és Gazdaságtudományi Egyetem", city: "Budapest", alias: "bme muegyetem muszaki", servers: [
    { label: "Neptun", url: "https://neptun.bme.hu/hallgato/login" } ] },
  { name: "Szegedi Tudományegyetem", city: "Szeged", alias: "szte szeged", servers: [
    { label: "Neptun", url: "https://neptun.szte.hu/hallgato/login" } ] },
  { name: "Debreceni Egyetem", city: "Debrecen", alias: "de debrecen unideb", servers: [
    { label: "Neptun", url: "https://neptun.unideb.hu/hallgato/login" } ] },
  { name: "Pécsi Tudományegyetem", city: "Pécs", alias: "pte pecs", servers: [
    { label: "WEB1", url: "https://neptun-web1.tr.pte.hu/hallgato/login.aspx" },
    { label: "WEB2", url: "https://neptun-web2.tr.pte.hu/hallgato/login.aspx" },
    { label: "WEB3", url: "https://neptun-web3.tr.pte.hu/hallgato/login.aspx" },
  ] },
  { name: "Budapesti Corvinus Egyetem", city: "Budapest", alias: "corvinus bce", servers: [
    { label: "Neptun", url: "https://neptun.uni-corvinus.hu/hallgato/login" } ] },
  { name: "Budapesti Gazdaságtudományi Egyetem", city: "Budapest", alias: "bge gazdasagi", servers: [
    { label: "Neptun", url: "https://neptun.uni-bge.hu/hallgato/login" } ] },
  { name: "Óbudai Egyetem", city: "Budapest", alias: "obuda obudai", servers: [
    { label: "Neptun", url: "https://neptun.uni-obuda.hu/hallgato/login.aspx" } ] },
  { name: "Széchenyi István Egyetem", city: "Győr", alias: "sze szechenyi gyor", servers: [
    { label: "Neptun", url: "https://neptun-hweb.sze.hu/hallgato_ng/login" } ] },
  { name: "Miskolci Egyetem", city: "Miskolc", alias: "me miskolc uni-miskolc", servers: [
    { label: "Neptun", url: "https://neptun.uni-miskolc.hu/hallgato/login" } ] },
  { name: "Magyar Agrár- és Élettudományi Egyetem", city: "Gödöllő", alias: "mate agrar godollo kaposvar", servers: [
    { label: "Neptun", url: "https://hallgato.uni-mate.hu/hallgato_ng/login" } ] },
  { name: "Semmelweis Egyetem", city: "Budapest", alias: "semmelweis se orvosi", servers: [
    { label: "Neptun", url: "https://neptun.semmelweis.hu/hallgato/login" } ] },
  { name: "Nemzeti Közszolgálati Egyetem", city: "Budapest", alias: "nke kozszolgalati", servers: [
    { label: "Neptun", url: "https://neptunweb.uni-nke.hu/hallgato/login" } ] },
  { name: "Neumann János Egyetem", city: "Kecskemét", alias: "nje neumann kecskemet", servers: [
    { label: "Neptun", url: "https://neptun.uni-neumann.hu/hallgato/login" } ] },
  { name: "Nyíregyházi Egyetem", city: "Nyíregyháza", alias: "nye nyiregyhaza", servers: [
    { label: "Neptun", url: "https://neptunweb.nye.hu/hallgato/login" } ] },
  { name: "Soproni Egyetem", city: "Sopron", alias: "soproni sopron nyme", servers: [
    { label: "Neptun", url: "https://neptun3r.nyme.hu/hallgato/login.aspx" } ] },
  { name: "Eszterházy Károly Katolikus Egyetem", city: "Eger", alias: "eszterhazy eger", servers: [
    { label: "Neptun", url: "https://neptunh.uni-eszterhazy.hu/hallgatoangular/login" } ] },
  { name: "Magyar Testnevelési és Sporttudományi Egyetem", city: "Budapest", alias: "tf testnevelesi te sport", servers: [
    { label: "Neptun", url: "https://neptun.tf.hu/hallgato/login" } ] },
  { name: "Tokaj-Hegyalja Egyetem", city: "Sárospatak", alias: "the tokaj sarospatak", servers: [
    { label: "Neptun", url: "https://neptun.unithe.hu/hallgato/login" } ] },
  { name: "Moholy-Nagy Művészeti Egyetem", city: "Budapest", alias: "mome moholy", servers: [
    { label: "Neptun", url: "https://neptun.mome.hu/hallgato/login" } ] },
  { name: "Liszt Ferenc Zeneművészeti Egyetem", city: "Budapest", alias: "lfze zeneakademia zene", servers: [
    { label: "Neptun", url: "https://neptun.lfze.hu/hallgato/login" } ] },
  { name: "Károli Gáspár Református Egyetem", city: "Budapest", alias: "karoli kre reformatus", servers: [
    { label: "Neptun", url: "https://neptun.kre.hu/hallgato/login" } ] },
  { name: "Pázmány Péter Katolikus Egyetem", city: "Budapest", alias: "ppke pazmany katolikus", servers: [
    { label: "Neptun", url: "https://neptun.ppke.hu/hallgato/login" } ] },
  { name: "Wesley János Lelkészképző Főiskola", city: "Budapest", alias: "wesley", servers: [
    { label: "Neptun", url: "https://neptun.wesley.hu/hallgato/login" } ] },
  { name: "A Tan Kapuja Buddhista Főiskola", city: "Budapest", alias: "tkbf buddhista tan kapuja", servers: [
    { label: "Neptun", url: "https://neptun.tkbf.hu/hallgato/login" } ] },
  { name: "Sárospataki Református Teológiai Akadémia", city: "Sárospatak", alias: "srta sarospatak reformatus", servers: [
    { label: "Neptun", url: "https://neptun.srta.hu/hallgato/login" } ] },
  { name: "Adventista Teológiai Főiskola", city: "Pécel", alias: "atf adventista", servers: [
    { label: "Neptun", url: "https://neptun.atf.hu/hallgato/login" } ] },
  { name: "Veszprémi Érseki Hittudományi Főiskola", city: "Veszprém", alias: "vehf veszpremi erseki", servers: [
    { label: "Neptun", url: "https://neptun.vef.hu/hallgato/login" } ] },
  { name: "Budapesti Metropolitan Egyetem", city: "Budapest", alias: "metropolitan metu", servers: [
    { label: "Neptun", url: "https://neptun.metropolitan.hu/hallgato/login" } ] },
  { name: "Kodolányi János Egyetem", city: "Székesfehérvár", alias: "kje kodolanyi", servers: [
    { label: "Neptun", url: "https://neptun.kodolanyi.hu/hallgato/login" } ] },
  { name: "Gábor Dénes Egyetem", city: "Budapest", alias: "gde gabor denes", servers: [
    { label: "Neptun", url: "https://neptun.gde.hu/hallgato/login" } ] },
  { name: "Milton Friedman Egyetem", city: "Budapest", alias: "mfe milton friedman", servers: [
    { label: "Neptun", url: "https://neptun.uni-milton.hu/hallgato/login" } ] },
  { name: "International Business School", city: "Budapest", alias: "ibs international business", servers: [
    { label: "Neptun", url: "https://neptun.ibs-b.hu/hallgato/login" } ] },
];
