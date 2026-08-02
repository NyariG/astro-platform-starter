import {
    ARLISTA_VERZIO,
    ENERGETIKAI_TANUSITVANY_DIJ,
    FUTESI_TERV,
    HOTERMELO_FELAR,
    KEDVEZMENY_SZAZALEK,
    LAKOEPULET_MAX_ALAPTERULET,
    SZOLGALTATASOK,
    type Szolgaltatas,
    type TeruletFajta
} from './pricing-config';
import { TERULETI_SZORZOK, alkalmazModosito, modositoLeiras, type AreaModifier } from './pricing-modifiers';
import type { ArazasKonfig } from './admin-config';

const ALAP_ARAK: ArazasKonfig = {
    szolgaltatasok: SZOLGALTATASOK as unknown as Szolgaltatas[],
    hotermeloFelar: HOTERMELO_FELAR,
    kedvezmenySzazalek: KEDVEZMENY_SZAZALEK,
    energetikaiDij: ENERGETIKAI_TANUSITVANY_DIJ,
    arlistaVerzio: ARLISTA_VERZIO
};

export type TetelStatus = 'PRICED' | 'CUSTOM_QUOTE' | 'INCOMPLETE';

export type QuoteInput = {

    szolgaltatasok: readonly string[];

    epuletTerulet: number | null;
    telekMeret: number | null;
    ontozendoTerulet: number | null;

    hotermelok: readonly string[];

    nincsHutes: boolean;

    ingatlanJelleg?: string;
};

export type Tetel = {
    kod: string;
    megnevezes: string;

    terulet: number | null;

    savLabel: string | null;
    egysegar: number | null;
    mennyiseg: number;

    alapAr: number | null;

    teruletiSzorzo: string | null;

    osszeg: number | null;
    status: TetelStatus;

    uzenet: string | null;
};

export type Kedvezmeny = {

    tipus: 'mennyezet_hutes' | 'kupon';

    cimke: string;
    alap: number;
    szazalek: number;
    osszeg: number;

    kuponKod: string | null;
};

export type AlkalmazottKupon = {
    kod: string;
    szazalek: number;

    hatokorSzolgaltatasok?: readonly string[];
};

export type QuoteResult = {
    tetelek: Tetel[];
    kedvezmeny: Kedvezmeny | null;

    reszosszeg: number;

    vegosszeg: number | null;
    vanEgyediArazas: boolean;

    figyelmeztetesek: string[];
    arlistaVerzio: string;
};

function forintra(ertek: number): number {
    return Math.round(ertek);
}

function ervenyesTerulet(ertek: number | null): ertek is number {
    return typeof ertek === 'number' && Number.isFinite(ertek) && Number.isInteger(ertek) && ertek > 0;
}

function teruletErtek(input: QuoteInput, fajta: TeruletFajta): number | null {
    const nyers = fajta === 'epulet' ? input.epuletTerulet : fajta === 'telek' ? input.telekMeret : input.ontozendoTerulet;
    return ervenyesTerulet(nyers) ? nyers : null;
}

function savLabel(max: number): string {
    return `≤ ${max} m²`;
}

/**
 * Egy szolgáltatás tételsorának előállítása.
 * Hiányzó vagy érvénytelen terület esetén a tétel `INCOMPLETE` — nem egyedi
 * árazás, csak még nincs mit számolni. A validáció gondoskodik arról, hogy
 * ilyen állapotban ne lehessen beküldeni.
 */
function tetelt(kod: string, input: QuoteInput, szorzok: Record<TeruletFajta, AreaModifier>, arak: ArazasKonfig): Tetel | null {
    const szolgaltatas = arak.szolgaltatasok.find((sz) => sz.kod === kod);
    if (!szolgaltatas) return null;

    const alap = {
        kod: szolgaltatas.kod,
        megnevezes: szolgaltatas.megnevezes,
        terulet: null as number | null,
        savLabel: null as string | null,
        egysegar: null as number | null,
        mennyiseg: 1,
        alapAr: null as number | null,
        teruletiSzorzo: null as string | null,
        uzenet: null as string | null
    };

    const arazas = szolgaltatas.arazas;

    // A fix díjas tételekre a területi szorzó NEM hat (D1-A3).
    if (arazas.tipus === 'fix') {
        const ar = forintra(arazas.ar);
        return { ...alap, alapAr: ar, osszeg: ar, status: 'PRICED' };
    }

    const terulet = teruletErtek(input, arazas.teruletFajta);
    const modosito = szorzok[arazas.teruletFajta];
    const szorzottAr = (alapAr: number) => alkalmazModosito(alapAr, modosito);
    const valtoztat = szorzottAr(1000) !== 1000; // van-e tényleges hatása

    // A területi szorzó ráültetése egy alapárra, a bontáshoz szükséges
    // mezőkkel együtt. A szorzó a kerekített alapárra hat, majd újra kerekítünk.
    const szorzottMezok = (alapAr: number) => ({
        alapAr,
        osszeg: szorzottAr(alapAr),
        teruletiSzorzo: valtoztat ? modositoLeiras(modosito) : null
    });

    if (arazas.tipus === 'egysegar') {
        if (terulet === null) {
            return { ...alap, osszeg: null, status: 'INCOMPLETE', uzenet: null };
        }
        // Sorrend: számol → kerekít → minimumot alkalmaz → területi szorzó.
        const alapAr = Math.max(arazas.minimumDij, forintra(terulet * arazas.egysegar));
        return {
            ...alap,
            terulet,
            egysegar: arazas.egysegar,
            mennyiseg: terulet,
            ...szorzottMezok(alapAr),
            status: 'PRICED'
        };
    }

    // Sávos árazás
    if (terulet === null) {
        return { ...alap, osszeg: null, status: 'INCOMPLETE', uzenet: null };
    }

    const sav = arazas.savok.find((s) => terulet <= s.max);
    if (!sav) {
        return {
            ...alap,
            terulet,
            osszeg: null,
            status: 'CUSTOM_QUOTE',
            uzenet: arazas.egyediUzenet
        };
    }

    return {
        ...alap,
        terulet,
        savLabel: savLabel(sav.max),
        ...szorzottMezok(forintra(sav.ar)),
        status: 'PRICED'
    };
}

/**
 * A hőtermelő felár tételsora.
 *
 * A felár a fűtési terv felára, ezért osztozik annak sorsán: ha a fűtési terv
 * egyedi árazású, a felár is oda kerül (D1 döntés).
 */
function hotermeloTetel(input: QuoteInput, futesiTerv: Tetel | undefined, arak: ArazasKonfig): Tetel | null {
    if (!futesiTerv) return null;
    const darab = input.hotermelok.length;
    if (darab === 0) return null;

    const alap = {
        kod: 'hotermelo_felar',
        megnevezes: darab === 1 ? 'Hőtermelő felár' : `Hőtermelő felár (${darab} db)`,
        terulet: null,
        savLabel: null,
        egysegar: arak.hotermeloFelar,
        mennyiseg: darab,
        alapAr: null as number | null,
        teruletiSzorzo: null as string | null,
        uzenet: null
    };

    if (futesiTerv.status !== 'PRICED') {
        return { ...alap, osszeg: null, status: futesiTerv.status };
    }

    const ar = forintra(darab * arak.hotermeloFelar);
    return { ...alap, alapAr: ar, osszeg: ar, status: 'PRICED' };
}

/**
 * Árajánlat kiszámítása.
 *
 * A tételek a konfigurációban rögzített megjelenítési sorrendben kerülnek be,
 * függetlenül attól, milyen sorrendben választotta ki őket az ügyfél.
 */
export function calculateQuote(
    input: QuoteInput,
    szorzok: Record<TeruletFajta, AreaModifier> = TERULETI_SZORZOK,
    kupon: AlkalmazottKupon | null = null,
    arak: ArazasKonfig = ALAP_ARAK
): QuoteResult {
    const valasztott = new Set(input.szolgaltatasok);
    const tetelek: Tetel[] = [];

    for (const szolgaltatas of arak.szolgaltatasok) {
        if (!valasztott.has(szolgaltatas.kod)) continue;
        const tetel = tetelt(szolgaltatas.kod, input, szorzok, arak);
        if (tetel) tetelek.push(tetel);

        if (szolgaltatas.kod === FUTESI_TERV) {
            const felar = hotermeloTetel(input, tetel ?? undefined, arak);
            if (felar) tetelek.push(felar);
        }
    }

    const arazott = tetelek.filter((t): t is Tetel & { osszeg: number } => t.status === 'PRICED' && t.osszeg !== null);
    const reszosszeg = arazott.reduce((osszeg, t) => osszeg + t.osszeg, 0);

    // A kedvezmény alapja kizárólag a fűtési blokk: a fűtési terv díja és a
    // hőtermelő felár. Bármelyik hiánya vagy egyedi árazása esetén nincs
    // kedvezménysor — nem mutatunk olyan levonást, amit nem tudunk kiszámolni.
    const futesiTerv = tetelek.find((t) => t.kod === FUTESI_TERV);
    const hotermelo = tetelek.find((t) => t.kod === 'hotermelo_felar');

    // Kedvezmény-jelöltek. A jóváhagyott szabály (C7) szerint csak a
    // legkedvezőbb érvényesül: a mennyezethűtés-kedvezmény és a kupon közül a
    // nagyobb forintösszegű. Mindkettő a területi szorzó UTÁNI árakra épül.
    const jeloltek: Kedvezmeny[] = [];

    if (input.nincsHutes && futesiTerv?.status === 'PRICED' && futesiTerv.osszeg !== null) {
        const hotermeloOsszeg = hotermelo?.status === 'PRICED' && hotermelo.osszeg !== null ? hotermelo.osszeg : 0;
        const alap = futesiTerv.osszeg + hotermeloOsszeg;
        if (alap > 0) {
            jeloltek.push({
                tipus: 'mennyezet_hutes',
                cimke: `Kedvezmény (nem kér mennyezet hűtést): −${arak.kedvezmenySzazalek}%`,
                alap,
                szazalek: arak.kedvezmenySzazalek,
                osszeg: forintra((alap * arak.kedvezmenySzazalek) / 100),
                kuponKod: null
            });
        }
    }

    if (kupon && kupon.szazalek > 0) {
        // A kupon alapja a hatóköre szerinti árazott tételek összege.
        // Üres hatókör = a teljes részösszeg.
        const hatokor = kupon.hatokorSzolgaltatasok;
        const alap =
            !hatokor || hatokor.length === 0
                ? reszosszeg
                : arazott.filter((t) => hatokor.includes(t.kod)).reduce((osszeg, t) => osszeg + t.osszeg, 0);
        if (alap > 0) {
            jeloltek.push({
                tipus: 'kupon',
                cimke: `Kuponkedvezmény (${kupon.kod}): −${kupon.szazalek}%`,
                alap,
                szazalek: kupon.szazalek,
                osszeg: forintra((alap * kupon.szazalek) / 100),
                kuponKod: kupon.kod
            });
        }
    }

    // A nagyobb forintösszegű kedvezmény nyer; azonos összegnél az első (mennyezethűtés).
    const kedvezmeny = jeloltek.reduce<Kedvezmeny | null>((legjobb, jelolt) => (legjobb === null || jelolt.osszeg > legjobb.osszeg ? jelolt : legjobb), null);

    const nagyLakoepulet = input.ingatlanJelleg === 'lakoepulet' && ervenyesTerulet(input.epuletTerulet) && input.epuletTerulet > LAKOEPULET_MAX_ALAPTERULET;
    const vanEgyediArazas = nagyLakoepulet || tetelek.some((t) => t.status === 'CUSTOM_QUOTE');
    const figyelmeztetesek = tetelek.map((t) => t.uzenet).filter((uzenet): uzenet is string => Boolean(uzenet));

    return {
        tetelek,
        kedvezmeny,
        reszosszeg,
        // Egyedi árazású tétel esetén nem mutatunk végösszeget (D1/S4.1).
        vegosszeg: vanEgyediArazas ? null : reszosszeg - (kedvezmeny?.osszeg ?? 0),
        vanEgyediArazas,
        figyelmeztetesek,
        arlistaVerzio: arak.arlistaVerzio
    };
}
