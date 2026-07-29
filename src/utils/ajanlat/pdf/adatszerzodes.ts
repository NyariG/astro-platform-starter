import type { QuoteRecord } from '../store';
import type { Tetel } from '../pricing';
import { ENERGETIKAI_TANUSITVANY_DIJ } from '../pricing-config';
import { kuponNormalizal } from '../coupons';
import { HOTERMELOK, HUTES_OPCIOK, INGATLAN_JELLEG, MENNYEZET_HUTES, SZOLGALTATAS_OPCIOK, TERV_CELJA, labelOf, labelsOf } from '../options';
import { negyzetmeter } from '../format';
import { arSzoveg, datumMagyar, ezresPont, fixArSzoveg, ingatlanJellegSzoveg, kerekitEzresre, negyzetmeterErtek, szintekSzoveg } from './format';

const MUSZAKI = 'muszaki_leiras';
const FUTESI = 'futesi_terv';
const HOTERMELO_FELAR = 'hotermelo_felar';
const EGYEDI_SZOVEG = 'egyedi árajánlat szerint';
const MUSZAKI_NEV = 'Műszaki leírás egyszerű bejelentéshez';
const RESZLETEZO =
    ' (Tartalmazza: rendelet szerinti hőtechnikai számítások, gépészeti műszaki leírás, alternatív rendszerek vizsgálata és leírása, aláírólap)';
const KERT_FEJLEC = 'Kertépítészeti és öntözési tervezés (közvetített szolgáltatás):';

const TOVABBI_KODOK = new Set(['futesi_terv', 'hotermelo_felar', 'klimaterv', 'szellozteto_terv', 'vizellatas_terv']);
const EGYEB_KODOK = new Set(['esoviz_szikkasztas', 'kozponti_porszivo']);

type LoopTetel = Record<string, string>;
type Sor = { cimke: string; ertek: string };

export type SablonAdat = {
    UGYFELNEV: string;
    SZINTEK_SZAMA: string;
    NEGYZETMETER_ERTEK: string;
    INGATLAN_JELLEGE: string;
    AKTUALIS_DATUM: string;
    reszletek: Sor[];
    muszakiVan: boolean;
    MUSZAKI_LEIRAS: string;
    MUSZAKI_LEIRAS_ARA: string;
    RESZLETEZO_SZOVEG: string;
    tovabbi: LoopTetel[];
    egyeb: LoopTetel[];
    kertVan: boolean;
    KERTTEL_KAPCSOLATOS_TERVEK: string;
    kertKoncepcio: LoopTetel[];
    kertKiviteles: LoopTetel[];
    ontozo: LoopTetel[];
    kuponVan: boolean;
    KUPON_KEDVEZMENY: string;
    KUPON_KEDVEZMENY_ARA: string;
    VEGOSSZEG_ARA_ENERGETIKA_NELKUL: string;
    VEGOSSZEG_ARA_ENERGETIKAVAL: string;
};

type Osszesito = {
    kuponVan: boolean;
    KUPON_KEDVEZMENY: string;
    KUPON_KEDVEZMENY_ARA: string;
    VEGOSSZEG_ARA_ENERGETIKA_NELKUL: string;
    VEGOSSZEG_ARA_ENERGETIKAVAL: string;
};

function osszesito(record: QuoteRecord): Osszesito {
    const kupon = record.kedvezmeny && record.kedvezmeny.tipus === 'kupon' ? record.kedvezmeny : null;
    const vegosszeg = record.vegosszeg === null ? null : Math.max(0, record.vegosszeg);
    const vegSzoveg = vegosszeg === null ? EGYEDI_SZOVEG : fixArSzoveg(vegosszeg);
    const vegEnergetika = vegosszeg === null ? EGYEDI_SZOVEG : fixArSzoveg(vegosszeg + ENERGETIKAI_TANUSITVANY_DIJ);
    return {
        kuponVan: kupon !== null,
        KUPON_KEDVEZMENY: kupon ? `Kupon (${kuponNormalizal(kupon.kuponKod ?? '')} – ${kupon.szazalek}%)` : '',
        KUPON_KEDVEZMENY_ARA: kupon ? `−${ezresPont(kerekitEzresre(kupon.osszeg))},- Ft` : '',
        VEGOSSZEG_ARA_ENERGETIKA_NELKUL: vegSzoveg,
        VEGOSSZEG_ARA_ENERGETIKAVAL: vegEnergetika
    };
}

function loopTetel(tetel: Tetel, artokenKulcs: string): LoopTetel {
    return { nev: tetel.megnevezes, [artokenKulcs]: arSzoveg(tetel) };
}

function futesiArSzoveg(futesi: Tetel, felar: Tetel | undefined, mennyezetKedvezmeny: number): string {
    if (futesi.status !== 'PRICED' || futesi.osszeg === null) return arSzoveg(futesi);
    const felarOsszeg = felar && felar.status === 'PRICED' && felar.osszeg !== null ? felar.osszeg : 0;
    return fixArSzoveg(futesi.osszeg + felarOsszeg - mennyezetKedvezmeny);
}

function reszletekSorok(record: QuoteRecord): Sor[] {
    const sorok: Sor[] = [];
    sorok.push({ cimke: 'Ingatlan jellege', ertek: labelOf(INGATLAN_JELLEG, record.ingatlanJelleg) });
    sorok.push({ cimke: 'Terv célja', ertek: labelOf(TERV_CELJA, record.tervCelja) });
    if (record.szintek !== null) sorok.push({ cimke: 'Szintek száma', ertek: String(record.szintek) });
    if (record.pince !== null) sorok.push({ cimke: 'Pince', ertek: record.pince ? 'Van' : 'Nincs' });
    if (record.alapterulet !== null) sorok.push({ cimke: 'Épület alapterülete', ertek: negyzetmeter(record.alapterulet) });
    if (record.telekMeret !== null) sorok.push({ cimke: 'Telekméret', ertek: negyzetmeter(record.telekMeret) });
    if (record.ontozendoTerulet !== null) sorok.push({ cimke: 'Öntözendő terület', ertek: negyzetmeter(record.ontozendoTerulet) });
    if (record.szolgaltatasok.length > 0) sorok.push({ cimke: 'Kért szolgáltatások', ertek: labelsOf(SZOLGALTATAS_OPCIOK, record.szolgaltatasok).join(', ') });
    if (record.hotermelok.length > 0) sorok.push({ cimke: 'Hőtermelők', ertek: labelsOf(HOTERMELOK, record.hotermelok).join(', ') });
    if (record.mennyezetHutes) sorok.push({ cimke: 'Mennyezet hűtés', ertek: labelOf(MENNYEZET_HUTES, record.mennyezetHutes) });
    if ((record.hutesOpciok ?? []).length > 0) sorok.push({ cimke: 'Hűtési igények', ertek: labelsOf(HUTES_OPCIOK, record.hutesOpciok).join(', ') });
    return sorok;
}

export function buildTemplateData(record: QuoteRecord): SablonAdat {
    const muszaki = record.tetelek.find((t) => t.kod === MUSZAKI);
    const felar = record.tetelek.find((t) => t.kod === HOTERMELO_FELAR);
    const mennyezetKedvezmeny = record.kedvezmeny && record.kedvezmeny.tipus === 'mennyezet_hutes' ? record.kedvezmeny.osszeg : 0;
    const tovabbi: LoopTetel[] = [];
    const egyeb: LoopTetel[] = [];
    const kertKoncepcio: LoopTetel[] = [];
    const kertKiviteles: LoopTetel[] = [];
    const ontozo: LoopTetel[] = [];

    for (const tetel of record.tetelek) {
        if (tetel.kod === MUSZAKI || tetel.kod === HOTERMELO_FELAR) continue;
        if (tetel.kod === FUTESI) tovabbi.push({ nev: tetel.megnevezes, TOVABBI_KIVITELEZESI_TERVEK_ARAI: futesiArSzoveg(tetel, felar, mennyezetKedvezmeny) });
        else if (TOVABBI_KODOK.has(tetel.kod)) tovabbi.push(loopTetel(tetel, 'TOVABBI_KIVITELEZESI_TERVEK_ARAI'));
        else if (EGYEB_KODOK.has(tetel.kod)) egyeb.push(loopTetel(tetel, 'EGYEB_KIVITELEZESI_TERVEK_ARAI'));
        else if (tetel.kod === 'kert_koncepcio') kertKoncepcio.push(loopTetel(tetel, 'KERT_KONCEPCIO_TERVEK_ARAI'));
        else if (tetel.kod === 'kert_kiviteli') kertKiviteles.push(loopTetel(tetel, 'KERT_KIVITELEZESI_TERVEK_ARAI'));
        else if (tetel.kod === 'ontozorendszer') ontozo.push(loopTetel(tetel, 'AUTOMATA_ONTOZORENDSZER_TERVEK_ARAI'));
    }

    const kertVan = kertKoncepcio.length + kertKiviteles.length + ontozo.length > 0;

    return {
        UGYFELNEV: record.nev,
        SZINTEK_SZAMA: szintekSzoveg(record.szintek, record.pince),
        NEGYZETMETER_ERTEK: record.alapterulet !== null ? negyzetmeterErtek(record.alapterulet) : '—',
        INGATLAN_JELLEGE: ingatlanJellegSzoveg(record.ingatlanJelleg),
        AKTUALIS_DATUM: datumMagyar(record.createdAt),
        reszletek: reszletekSorok(record),
        muszakiVan: Boolean(muszaki),
        MUSZAKI_LEIRAS: muszaki ? MUSZAKI_NEV : '',
        MUSZAKI_LEIRAS_ARA: muszaki && muszaki.osszeg !== null ? ezresPont(kerekitEzresre(muszaki.osszeg)) : '',
        RESZLETEZO_SZOVEG: muszaki ? RESZLETEZO : '',
        tovabbi,
        egyeb,
        kertVan,
        KERTTEL_KAPCSOLATOS_TERVEK: kertVan ? KERT_FEJLEC : '',
        kertKoncepcio,
        kertKiviteles,
        ontozo,
        ...osszesito(record)
    };
}
