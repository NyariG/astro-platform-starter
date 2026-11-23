import adat from '../../data/tagtartalyok.json';

export type Alkalmazas = 'futes' | 'ivoviz';

export type Tartaly = {
    id: string;
    marka: string;
    sorozat: string;
    alkalmazas: Alkalmazas;
    terfogat: number;
    ps: number;
    p0Gyari: number | null;
    tMembran: number | null;
    tRendszer: number | null;
    atmero: number | null;
    magassag: number | null;
    atfolyasos: boolean | null;
    magyar: string;
    forras: string | null;
    megjegyzes: string | null;
};

export const TARTALYOK = adat.tartalyok as Tartaly[];
export const ADAT_FRISSITVE = adat.frissitve;

export type Kovetelmeny = { alkalmazas: Alkalmazas; vMin: number; psv: number; tMax: number };

export type Ajanlas = {
    legjobb: Tartaly | null;
    alternativak: Tartaly[];
    nincsTalalat: string | null;
};

export function alkalmas(t: Tartaly, k: Kovetelmeny): boolean {
    if (t.alkalmazas !== k.alkalmazas) return false;
    if (t.terfogat < k.vMin) return false;
    if (t.ps < k.psv) return false;
    if (k.alkalmazas === 'futes' && t.tRendszer !== null && t.tRendszer < k.tMax) return false;
    return true;
}

export function ajanl(k: Kovetelmeny, lista: Tartaly[] = TARTALYOK, alternativakSzama = 4): Ajanlas {
    const alkalmasak = lista
        .filter((t) => alkalmas(t, k))
        .sort((a, b) => {
            if (a.terfogat !== b.terfogat) return a.terfogat - b.terfogat;
            if (a.atfolyasos !== b.atfolyasos) return a.atfolyasos ? -1 : 1;
            return a.marka.localeCompare(b.marka, 'hu') || a.sorozat.localeCompare(b.sorozat, 'hu');
        });

    if (alkalmasak.length === 0) {
        const legnagyobb = lista.filter((t) => t.alkalmazas === k.alkalmazas && t.ps >= k.psv).reduce((m, t) => Math.max(m, t.terfogat), 0);
        const uzenet =
            legnagyobb > 0 && k.vMin > legnagyobb
                ? `Egyetlen tartály sem elég a listánkból (a szükséges ${k.vMin.toLocaleString('hu-HU')} liter a legnagyobb ${legnagyobb} literes típusnál is több). Párhuzamosan kötött tartályok vagy kompresszoros nyomástartó rendszer jöhet szóba.`
                : `Nincs a feltételeknek megfelelő tartály a listánkban (legalább ${k.psv} bar megengedett nyomás kell).`;
        return { legjobb: null, alternativak: [], nincsTalalat: uzenet };
    }

    const [legjobb, ...tobbi] = alkalmasak;
    const masSorozat = tobbi.filter((t, i, lt) => lt.findIndex((x) => x.marka === t.marka && x.sorozat === t.sorozat) === i);
    const alternativak = masSorozat.filter((t) => !(t.marka === legjobb.marka && t.sorozat === legjobb.sorozat)).slice(0, alternativakSzama);
    return { legjobb, alternativak, nincsTalalat: null };
}

export function tartalyNev(t: Tartaly): string {
    return `${t.marka} ${t.sorozat} ${t.terfogat} l`;
}
