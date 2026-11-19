export const KATEGORIAK = {
    'energetikai-tanusitas': {
        nev: 'Energetikai tanúsítás',
        leiras: 'Mikor kell tanúsítvány, meddig érvényes, és mire figyeljen eladás vagy bérbeadás előtt.',
        cta: {
            cim: 'Tanúsítványra van szüksége Győrben vagy környékén?',
            gomb: 'Tanúsítvány időpontot kérek',
            href: '/energetikai-tanusitvany/'
        }
    },
    'futes-hutes': {
        nev: 'Fűtés és hűtés',
        leiras: 'Hőszivattyú, padlófűtés, hűtés: gyakorlati szempontok a rendszer kiválasztásához.',
        cta: {
            cim: 'Hőszivattyút tervez? Számoljuk ki, mekkora kell valójában.',
            gomb: 'Ajánlatot kérek a tervezésre',
            href: '/ajanlat/'
        }
    },
    tamogatasok: {
        nev: 'Pályázatok és támogatások',
        leiras: 'Felújítási támogatások és hitelek: feltételek, határidők, és hogyan készüljön fel a pályázatra.',
        cta: {
            cim: 'Felújítási támogatásra készül? Tanúsítvány, pályázati anyag és gépészeti felújítás egy kézben.',
            gomb: 'Kérem a kiinduló tanúsítványt',
            href: '/energetikai-tanusitvany/#arajanlat'
        }
    },
    tervezes: {
        nev: 'Tervezés',
        leiras: 'Mit tartalmaz egy épületgépészeti terv, és hogyan készüljön fel a tervezésre.',
        cta: {
            cim: 'Nézze meg két perc alatt, mennyibe kerül a terv az Ön házára.',
            gomb: 'Ajánlatot kérek',
            href: '/ajanlat/'
        }
    }
} as const;

export const SZERZO = {
    nev: 'Nyári Gergő Mátyás',
    beosztas: 'Gépészmérnök',
    bemutatas: 'Húsz éve gépészmérnök, pályája során tervezési feladatokon dolgozott. A Nyári Terv alapítója, az Épületgépészeti ABC című könyv szerzője.'
} as const;

export type KategoriaKod = keyof typeof KATEGORIAK;

export const KATEGORIA_KODOK = Object.keys(KATEGORIAK) as [KategoriaKod, ...KategoriaKod[]];

const DATUM_FORMA = new Intl.DateTimeFormat('hu-HU', { dateStyle: 'long', timeZone: 'Europe/Budapest' });

export function datumSzoveg(datum: Date): string {
    return DATUM_FORMA.format(datum);
}

export function olvasasiIdo(szoveg: string): number {
    const szavak = szoveg.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(szavak / 200));
}
