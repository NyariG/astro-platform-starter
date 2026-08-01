export type FaCsomopont =
    | { tipus: 'szolgaltatas'; kod: string }
    | { tipus: 'csoport'; kulcs: 'kertepitesAktiv'; cimke: string };

export const SZOLGALTATAS_FA: readonly FaCsomopont[] = [
    { tipus: 'szolgaltatas', kod: 'muszaki_leiras' },
    { tipus: 'szolgaltatas', kod: 'futesi_terv' },
    { tipus: 'szolgaltatas', kod: 'klimaterv' },
    { tipus: 'szolgaltatas', kod: 'szellozteto_terv' },
    { tipus: 'szolgaltatas', kod: 'vizellatas_terv' },
    { tipus: 'szolgaltatas', kod: 'esoviz_szikkasztas' },
    { tipus: 'szolgaltatas', kod: 'kozponti_porszivo' },
    { tipus: 'csoport', kulcs: 'kertepitesAktiv', cimke: 'Kertépítés' }
];
