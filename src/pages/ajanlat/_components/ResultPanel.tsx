const EMAIL = 'info@nyariterv.hu';
const TELEFON = '+36 70 318 7843';
const TELEFON_HIVAS = '+36703187843';

export type Eredmeny =
    | { tipus: 'siker'; id: string | null; branch: string | null; emailSent: boolean; pdfElerheto: boolean; vegosszeg: number | null; vanEgyediArazas: boolean }
    | { tipus: 'limit'; uzenet?: string }
    | { tipus: 'ip_limit' }
    | { tipus: 'hiba' };

const ALAP_LIMIT_UZENET = 'Naponta csak 1 árajánlat kérhető. Kérjük, próbálja meg holnap újra, vagy vegye fel velünk a kapcsolatot közvetlenül.';

function Elerhetosegek() {
    return (
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={`tel:${TELEFON_HIVAS}`} className="btn min-h-11 sm:w-auto">
                {TELEFON}
            </a>
            <a href={`mailto:${EMAIL}`} className="btn btn-secondary min-h-11 sm:w-auto">
                {EMAIL}
            </a>
        </div>
    );
}

function Ikon({ valtozat }: { valtozat: 'siker' | 'figyelem' | 'hiba' }) {
    const szin = valtozat === 'siker' ? 'bg-green-100 text-green-700' : valtozat === 'figyelem' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

    const path =
        valtozat === 'siker'
            ? 'M4.5 12.75l6 6 9-13.5'
            : valtozat === 'figyelem'
              ? 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z'
              : 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z';

    return (
        <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-full ${szin}`}>
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d={path} />
            </svg>
        </div>
    );
}

export function ResultPanel({ eredmeny, onUjra }: { eredmeny: Eredmeny; onUjra: () => void }) {
    if (eredmeny.tipus === 'siker') {
        const lakoepulet = eredmeny.branch === 'lakoepulet';
        const zaras = lakoepulet ? 'Tervezőnk hamarosan felveszi Önnel a kapcsolatot az árajánlat véglegesítése céljából.' : 'Tervezőnk hamarosan felveszi Önnel a kapcsolatot.';
        const pdfLetoltheto = eredmeny.pdfElerheto && eredmeny.id !== null;

        return (
            <section role="status" className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
                <Ikon valtozat="siker" />
                <h2 className="mb-4 text-2xl font-bold text-slate-900">Köszönjük, megkaptuk az ajánlatkérését</h2>

                <p className="max-w-prose text-slate-600">
                    {eredmeny.emailSent ? `Az adatait rögzítettük, és a visszaigazolást elküldtük a megadott e-mail címre. ${zaras}` : `Az adatait rögzítettük. ${zaras}`}
                </p>
                {eredmeny.emailSent ? (
                    <p className="mt-4 max-w-prose text-sm text-slate-500">Ha nem találja a levelet, érdemes a levélszemét mappát is megnéznie.</p>
                ) : (
                    <p className="mt-4 max-w-prose text-sm text-slate-500">
                        A visszaigazoló levelet most nem tudtuk kiküldeni, de a megkeresése rögzült és eljutott hozzánk. Ha sürgős, hívjon minket nyugodtan.
                    </p>
                )}

                {pdfLetoltheto && (
                    <a
                        href={`/api/ajanlat-pdf?id=${encodeURIComponent(eredmeny.id as string)}`}
                        className="btn mt-6 inline-flex min-h-11 items-center gap-2 sm:w-auto"
                        download
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        Árajánlat letöltése (PDF)
                    </a>
                )}

                <Elerhetosegek />
            </section>
        );
    }

    if (eredmeny.tipus === 'limit') {
        return (
            <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm sm:p-12">
                <Ikon valtozat="figyelem" />
                <h2 className="mb-4 text-2xl font-bold text-slate-900">Ma már érkezett Öntől ajánlatkérés</h2>
                <p className="max-w-prose text-slate-700">{eredmeny.uzenet ?? ALAP_LIMIT_UZENET}</p>
                <p className="mt-4 max-w-prose text-sm text-slate-600">Kollégánk értesült a megkereséséről, így elképzelhető, hogy magától is jelentkezni fog.</p>
                <Elerhetosegek />
            </section>
        );
    }

    if (eredmeny.tipus === 'ip_limit') {
        return (
            <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-8 shadow-sm sm:p-12">
                <Ikon valtozat="figyelem" />
                <h2 className="mb-4 text-2xl font-bold text-slate-900">Túl sok kérés érkezett erről a hálózatról</h2>
                <p className="max-w-prose text-slate-700">Kérjük, próbálja meg később, vagy vegye fel velünk a kapcsolatot közvetlenül — szívesen segítünk telefonon is.</p>
                <Elerhetosegek />
            </section>
        );
    }

    return (
        <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-8 shadow-sm sm:p-12">
            <Ikon valtozat="hiba" />
            <h2 className="mb-4 text-2xl font-bold text-slate-900">Az elküldés nem sikerült</h2>
            <p className="max-w-prose text-slate-700">
                Váratlan hiba történt, és az ajánlatkérését nem tudtuk fogadni. Kérjük, próbálja meg újra — ha ismét nem sikerül, keressen minket közvetlenül.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onUjra} className="btn min-h-11 sm:w-auto">
                    Újrapróbálom
                </button>
                <a href={`tel:${TELEFON_HIVAS}`} className="btn btn-secondary min-h-11 sm:w-auto">
                    {TELEFON}
                </a>
            </div>
        </section>
    );
}
