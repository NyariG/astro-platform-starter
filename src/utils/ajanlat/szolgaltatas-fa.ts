export type FaCsomopont =
    | { tipus: 'szolgaltatas'; kod: string }
    | { tipus: 'csoport'; kulcs: 'hutesTervAktiv' | 'kertepitesAktiv'; cimke: string };

export const SZOLGALTATAS_FA: readonly FaCsomopont[] = [
    { tipus: 'szolgaltatas', kod: 'muszaki_leiras' },
    { tipus: 'szolgaltatas', kod: 'futesi_terv' },
    { tipus: 'csoport', kulcs: 'hutesTervAktiv', cimke: 'Hűtési terv' },
    { tipus: 'szolgaltatas', kod: 'szellozteto_terv' },
    { tipus: 'szolgaltatas', kod: 'vizellatas_terv' },
    { tipus: 'szolgaltatas', kod: 'esoviz_szikkasztas' },
    { tipus: 'szolgaltatas', kod: 'kozponti_porszivo' },
    { tipus: 'csoport', kulcs: 'kertepitesAktiv', cimke: 'Kertépítés' }
];
