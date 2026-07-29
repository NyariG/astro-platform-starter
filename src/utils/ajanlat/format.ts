const FORINT = new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0,
    useGrouping: true
});

export function forint(ertek: number): string {
    return `${FORINT.format(Math.round(ertek)).replace(/\s/g, ' ')} Ft`;
}

/** Terület megjelenítése: `153 m²`. */
export function negyzetmeter(ertek: number): string {
    return `${FORINT.format(Math.round(ertek)).replace(/\s/g, ' ')} m²`;
}

/**
 * Nyers beviteli szöveg számjegyekre szűrése.
 *
 * Gépelésnél és beillesztésnél is ez fut le: minden nem számjegy azonnal
 * eldobódik, a vezető nullák eltűnnek, és a hossz hat számjegyre korlátozódik
 * (a 100 000-es felső határ miatt ennél többre soha nincs szükség).
 */
export function csakSzamjegy(nyers: string): string {
    const szamjegyek = nyers.replace(/\D/g, '').slice(0, 6);
    if (szamjegyek === '') return '';
    const nullakNelkul = szamjegyek.replace(/^0+/, '');
    return nullakNelkul === '' ? '0' : nullakNelkul;
}

/** Ezres csoportosítás megjelenítéshez, mezőből kilépés után. */
export function ezresekkel(nyers: string): string {
    if (nyers === '') return '';
    const szam = Number.parseInt(nyers, 10);
    if (!Number.isFinite(szam)) return nyers;
    return FORINT.format(szam).replace(/\s/g, ' ');
}
