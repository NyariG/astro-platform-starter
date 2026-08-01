const SZOLGALTATO = 'Nyári Terv';
const ERVENYESSEG_NAPOK = 30;
const KAPCSOLAT_EMAIL = 'info@nyariterv.hu';

export const JOGI_NYILATKOZAT_VERZIO = '1.0';

export const JOGI_ROVID =
    'Az ajánlatkérés díjmentes, és az Ön részéről semmilyen szerződéskötési, megrendelési vagy fizetési kötelezettséget nem keletkeztet.';

export const JOGI_TELJES: readonly string[] = [
    `Az ajánlatkérés kitöltése és elküldése díjmentes, és az Ön részéről semmilyen szerződéskötési, megrendelési, fizetési vagy egyéb kötelezettséget nem keletkeztet.`,
    `Az ajánlatkérés elküldése nem minősül szerződéskötésre irányuló, kötelezettséget keletkeztető jognyilatkozatnak, és Önt a Polgári Törvénykönyvről szóló 2013. évi V. törvény 6:64. §-a szerinti ajánlati kötöttség nem terheli. A felek között szerződés kizárólag a ${SZOLGALTATO} által kiadott írásbeli ajánlat kifejezett, írásbeli elfogadásával jön létre.`,
    `A felületen megjelenített összegek tájékoztató jellegű, a megadott adatok alapján automatikusan számított kalkulációs értékek. Ezek nem minősülnek árajánlatnak, és a ${SZOLGALTATO} részéről ajánlati kötöttséget nem keletkeztetnek. A végleges ellenérték az igényfelmérést követően kiadott egyedi írásbeli ajánlatban kerül meghatározásra, és a tájékoztató kalkulációtól eltérhet.`,
    `A ${SZOLGALTATO} által kiadott egyedi írásbeli ajánlat — eltérő rendelkezés hiányában — a kiállításától számított ${ERVENYESSEG_NAPOK} napig érvényes; ezen időtartam elteltével az ajánlat kötelezettség nélkül hatályát veszti.`,
    `Ön az ajánlatkérést a szerződés létrejöttéig indokolás nélkül, bármikor, díj- és jogkövetkezmény-mentesen visszavonhatja a ${KAPCSOLAT_EMAIL} címre küldött értesítéssel.`,
    `Az esetleges kedvezmények, kuponkódok és területi árazási tényezők alkalmazása a mindenkor hatályos feltételek szerint történik; ezek a kedvezmények egyedi elbírálás alapján, az ajánlat kiadásáig módosulhatnak vagy visszavonhatók, ami az Ön számára semmilyen hátrányos jogkövetkezménnyel nem jár.`,
    `Az ajánlatkérés során megadott személyes adatok kezelésére az Adatkezelési tájékoztató rendelkezései irányadók.`,
    `A jelen tájékoztatóban foglaltak nem érintik az Önt a fogyasztókra vonatkozó kógens jogszabályi rendelkezések alapján megillető jogokat.`
];

export const JOGI_CIM = 'Tájékoztatás az ajánlatkérés jellegéről';

export const GDPR_KONSZENT_VERZIO = '1.0';

export const GDPR_KONSZENT_SZOVEG =
    'Hozzájárulok, hogy a Nyári Terv a megadott adataimat az árajánlat elkészítése és a kapcsolatfelvétel céljából kezelje. A részletekért lásd az Adatkezelési tájékoztatót.';
