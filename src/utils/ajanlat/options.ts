import { SZOLGALTATASOK } from './pricing-config';

export type Option = {
    value: string;
    label: string;
};

export const INGATLAN_JELLEG = [
    { value: 'lakoepulet', label: 'Lakóépület' },
    { value: 'ipari', label: 'Ipari épület' },
    { value: 'egyeb', label: 'Egyéb' }
] as const satisfies readonly Option[];

export const TERV_CELJA = [
    { value: 'felujitas', label: 'Felújítás' },
    { value: 'uj_epites', label: 'Új építés' }
] as const satisfies readonly Option[];

export const MENNYEZET_HUTES = [
    { value: 'igen', label: 'Igen' },
    { value: 'nem', label: 'Nem' }
] as const satisfies readonly Option[];

export const MENNYEZET_HUTES_VALUES = MENNYEZET_HUTES.map((o) => o.value);

export const PINCE = [
    { value: 'van', label: 'Van' },
    { value: 'nincs', label: 'Nincs' }
] as const satisfies readonly Option[];

export const PINCE_VALUES = PINCE.map((o) => o.value);

export const SZOLGALTATAS_OPCIOK = SZOLGALTATASOK.map((sz) => ({
    value: sz.kod,
    label: sz.megnevezes
})) satisfies readonly Option[];

export const HOTERMELOK = [
    { value: 'hoszivattyu', label: 'Hőszivattyú' },
    { value: 'gazkazan', label: 'Gázkazán' },
    { value: 'vegyestuzelesu', label: 'Vegyestüzelésű kazán' },
    { value: 'elektromos', label: 'Elektromos fűtés' },
    { value: 'napkollektor', label: 'Napkollektor' },
    { value: 'egyeb', label: 'Egyéb' }
] as const satisfies readonly Option[];

export const HUTES_OPCIOK = [
    { value: 'fan_coil', label: 'Fan-coil' },
    { value: 'mennyezet', label: 'Mennyezethűtés' }
] as const satisfies readonly Option[];

export const HUTES_OPCIOK_VALUES = HUTES_OPCIOK.map((o) => o.value);

export const INGATLAN_JELLEG_VALUES = INGATLAN_JELLEG.map((o) => o.value);
export const TERV_CELJA_VALUES = TERV_CELJA.map((o) => o.value);
export const SZOLGALTATAS_VALUES = SZOLGALTATAS_OPCIOK.map((o) => o.value);
export const HOTERMELOK_VALUES = HOTERMELOK.map((o) => o.value);

export function labelOf(options: readonly { value: string; label: string }[], value: string): string {
    return options.find((o) => o.value === value)?.label ?? value;
}

export function labelsOf(options: readonly { value: string; label: string }[], values: readonly string[]): string[] {
    return values.map((v) => labelOf(options, v));
}
