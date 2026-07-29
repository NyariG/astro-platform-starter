export const KUPON_ELOTAG_MIN = 3;
export const KUPON_ELOTAG_MAX = 12;
export const KUPON_SZAZALEK_MAX = 100;

export type Coupon = {

    elotag: string;

    szazalek: number;
    aktiv: boolean;

    ervenyesTol?: string;
    ervenyesIg?: string;

    osszesBevaltasMax?: number;

    emailenkentiMax?: number;

    hatokorSzolgaltatasok?: string[];
};

export const KUPONOK: Coupon[] = [];

const ELOTAG_REGEX = /^[A-Z0-9]+$/;

export function kuponTeljesKod(kupon: Coupon): string {
    return `${kupon.elotag}${kupon.szazalek}`;
}

/** Beírt kód normalizálása: trim + nagybetűsítés. Kis/nagybetűre nem érzékeny. */
export function kuponNormalizal(nyers: string): string {
    return (nyers ?? '').trim().toUpperCase();
}

/**
 * Egy kupon konfigurációs hibája, vagy null. A betöltéskor ellenőrizzük, hogy
 * egy elgépelt kupon ne csendben viselkedjen rosszul.
 */
export function kuponHiba(kupon: Coupon): string | null {
    const elotag = kupon.elotag ?? '';
    if (elotag.length < KUPON_ELOTAG_MIN || elotag.length > KUPON_ELOTAG_MAX) {
        return `A kupon előtagja ${KUPON_ELOTAG_MIN}–${KUPON_ELOTAG_MAX} karakter lehet.`;
    }
    if (!ELOTAG_REGEX.test(elotag)) return 'A kupon előtagja csak A–Z és 0–9 karaktert tartalmazhat.';
    if (!Number.isInteger(kupon.szazalek) || kupon.szazalek < 0 || kupon.szazalek > KUPON_SZAZALEK_MAX) {
        return `A kupon százaléka 0 és ${KUPON_SZAZALEK_MAX} között lehet.`;
    }
    if (kupon.ervenyesTol && kupon.ervenyesIg && kupon.ervenyesTol > kupon.ervenyesIg) {
        return 'A kupon kezdő dátuma nem lehet későbbi a záró dátumnál.';
    }
    return null;
}

/**
 * A kuponlista egészének ellenőrzése: minden kupon érvényes-e, és nincs-e
 * két azonos (kis/nagybetűtől független) teljes kód. A hibás vagy ütköző
 * listát a hívó a betöltéskor elutasíthatja.
 */
export function kuponListaHiba(kuponok: readonly Coupon[] = KUPONOK): string | null {
    const kodok = new Set<string>();
    for (const kupon of kuponok) {
        const hiba = kuponHiba(kupon);
        if (hiba) return `${kupon.elotag ?? '?'}: ${hiba}`;
        const kod = kuponNormalizal(kuponTeljesKod(kupon));
        if (kodok.has(kod)) return `Ismétlődő kuponkód: ${kod}`;
        kodok.add(kod);
    }
    return null;
}

export type KuponAllapot = 'ervenyes' | 'ismeretlen' | 'inaktiv' | 'lejart' | 'meg_nem_aktiv';

/**
 * Egy beírt kód megkeresése és időbeli érvényességének ellenőrzése.
 *
 * A beváltási limiteket (összes/e-mailenkénti) NEM ellenőrzi — azok a Blobs
 * számlálóiban élnek, és csak a szerveroldali beküldéskor dőlnek el. Ez a
 * függvény tiszta, így a kliens előnézete és a szerver is hívhatja.
 */
export function kuponKeres(nyersKod: string, ma: string, kuponok: readonly Coupon[] = KUPONOK): { kupon: Coupon | null; allapot: KuponAllapot } {
    const kod = kuponNormalizal(nyersKod);
    if (!kod) return { kupon: null, allapot: 'ismeretlen' };

    const talalt = kuponok.find((k) => kuponNormalizal(kuponTeljesKod(k)) === kod);
    if (!talalt) return { kupon: null, allapot: 'ismeretlen' };
    if (!talalt.aktiv) return { kupon: talalt, allapot: 'inaktiv' };
    if (talalt.ervenyesTol && ma < talalt.ervenyesTol) return { kupon: talalt, allapot: 'meg_nem_aktiv' };
    if (talalt.ervenyesIg && ma > talalt.ervenyesIg) return { kupon: talalt, allapot: 'lejart' };

    return { kupon: talalt, allapot: 'ervenyes' };
}
