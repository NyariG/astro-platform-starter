import { useState } from 'react';
import type { FormValues } from './FormSteps';
import type { AlkalmazottKupon } from './CouponField';
import type { QuoteResult } from '../../../utils/ajanlat/pricing';
import { forint } from '../../../utils/ajanlat/format';
import { ENERGETIKAI_TANUSITVANY_DIJ } from '../../../utils/ajanlat/pricing-config';

function Sor({ cimke, ertek, kiemelt }: { cimke: string; ertek: string; kiemelt?: boolean }) {
    return (
        <div className="flex justify-between gap-3 border-b border-slate-700 py-1">
            <span className="text-slate-400">{cimke}</span>
            <span className={`text-right font-mono ${kiemelt ? 'font-bold text-amber-300' : 'text-slate-100'}`}>{ertek || '—'}</span>
        </div>
    );
}

export function DebugPanel({ values, arazas, kupon }: { values: FormValues; arazas: QuoteResult; kupon: AlkalmazottKupon | null }) {
    const [nyitva, setNyitva] = useState(false);
    const [letoltes, setLetoltes] = useState<'docx' | 'pdf' | null>(null);
    const [hiba, setHiba] = useState<string | null>(null);

    async function letoltArajanlat(formatum: 'docx' | 'pdf') {
        setLetoltes(formatum);
        setHiba(null);
        try {
            const valasz = await fetch(`/api/ajanlat-debug?format=${formatum}&debug=1`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values)
            });
            if (!valasz.ok) {
                setHiba(`${valasz.status}: ${await valasz.text().catch(() => 'ismeretlen hiba')}`);
                return;
            }
            const blob = await valasz.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `arajanlat-debug.${formatum}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            setHiba(e instanceof Error ? e.message : String(e));
        } finally {
            setLetoltes(null);
        }
    }

    return (
        <div className="fixed left-4 top-24 z-50 max-w-[92vw] print:hidden">
            <button
                type="button"
                onClick={() => setNyitva((e) => !e)}
                className="flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-amber-300 shadow-lg ring-1 ring-amber-400/40"
            >
                🐞 Debug {nyitva ? '▲' : '▼'}
            </button>

            {nyitva && (
                <div className="mt-2 max-h-[70vh] w-96 max-w-[92vw] overflow-y-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100 shadow-2xl ring-1 ring-slate-700">
                    <p className="mb-2 font-bold text-amber-300">Kiküldendő árajánlat (előnézet)</p>
                    <p className="mb-2 text-[11px] text-slate-400">A jelenlegi űrlapadatokkal kitöltött árajánlat — pontosan ez menne ki az ügyfélnek. A DOCX mindig elérhető; a PDF-hez CloudConvert-kulcs kell.</p>
                    <div className="mb-2 flex gap-2">
                        <button
                            type="button"
                            onClick={() => letoltArajanlat('docx')}
                            disabled={letoltes !== null}
                            className="flex-1 rounded-md bg-amber-400 px-3 py-2 font-semibold text-slate-900 disabled:opacity-50"
                        >
                            {letoltes === 'docx' ? 'Készül…' : '⬇ DOCX'}
                        </button>
                        <button
                            type="button"
                            onClick={() => letoltArajanlat('pdf')}
                            disabled={letoltes !== null}
                            className="flex-1 rounded-md bg-slate-700 px-3 py-2 font-semibold text-amber-200 ring-1 ring-amber-400/40 disabled:opacity-50"
                        >
                            {letoltes === 'pdf' ? 'Készül…' : '⬇ PDF'}
                        </button>
                    </div>
                    {hiba && <p className="mb-3 rounded bg-red-950 p-2 text-[11px] text-red-300 ring-1 ring-red-800">{hiba}</p>}

                    <p className="mb-2 mt-4 font-bold text-amber-300">Űrlap állapota (kiválasztott értékek)</p>
                    <Sor cimke="ingatlanJelleg" ertek={values.ingatlanJelleg} />
                    <Sor cimke="tervCelja" ertek={values.tervCelja} />
                    <Sor cimke="szintek" ertek={values.szintek} />
                    <Sor cimke="pince" ertek={values.pince} />
                    <Sor cimke="szolgaltatasok" ertek={values.szolgaltatasok.join(', ')} />
                    <Sor cimke="alapterulet" ertek={values.alapterulet} />
                    <Sor cimke="telekMeret" ertek={values.telekMeret} />
                    <Sor cimke="ontozendoTerulet" ertek={values.ontozendoTerulet} />
                    <Sor cimke="hotermelok" ertek={values.hotermelok.join(', ')} />
                    <Sor cimke="mennyezetHutes" ertek={values.mennyezetHutes} />
                    <Sor cimke="hutesOpciok" ertek={values.hutesOpciok.join(', ')} />
                    <Sor cimke="kertepitesAktiv" ertek={String(values.kertepitesAktiv)} />
                    <Sor cimke="kuponKod (beírt)" ertek={values.kuponKod} />
                    <Sor cimke="nev" ertek={values.nev} />
                    <Sor cimke="email" ertek={values.email} />
                    <Sor cimke="telefon" ertek={values.telefon} />
                    <Sor cimke="varos" ertek={values.varos} />
                    <Sor cimke="gdprConsent" ertek={String(values.gdprConsent)} />

                    <p className="mb-2 mt-4 font-bold text-amber-300">Beváltott kupon (szerver validált)</p>
                    <Sor cimke="kód" ertek={kupon?.kod ?? '—'} />
                    <Sor cimke="százalék" ertek={kupon ? `${kupon.szazalek}%` : '—'} />

                    <p className="mb-2 mt-4 font-bold text-amber-300">Árbontás (a motor kimenete)</p>
                    {arazas.tetelek.map((t) => (
                        <div key={t.kod} className="border-b border-slate-700 py-1">
                            <div className="flex justify-between gap-2">
                                <span className="text-slate-300">{t.kod}</span>
                                <span className="font-mono text-slate-100">{t.status === 'PRICED' ? forint(t.osszeg ?? 0) : t.status}</span>
                            </div>
                            {(t.alapAr !== null && t.alapAr !== t.osszeg) || t.teruletiSzorzo ? (
                                <div className="text-[11px] text-slate-500">
                                    alapár: {t.alapAr !== null ? forint(t.alapAr) : '—'}
                                    {t.teruletiSzorzo ? ` · szorzó: ${t.teruletiSzorzo}` : ''}
                                </div>
                            ) : null}
                        </div>
                    ))}
                    {arazas.kedvezmeny && <Sor cimke={arazas.kedvezmeny.tipus} ertek={`−${forint(arazas.kedvezmeny.osszeg)}`} />}
                    <Sor cimke="részösszeg" ertek={forint(arazas.reszosszeg)} />
                    <Sor cimke="egyedi árazás?" ertek={String(arazas.vanEgyediArazas)} />
                    <Sor cimke="VÉGÖSSZEG" ertek={arazas.vegosszeg !== null ? forint(arazas.vegosszeg) : 'egyedi'} kiemelt />
                    <Sor cimke="energetikai tanúsítvány díja" ertek={forint(ENERGETIKAI_TANUSITVANY_DIJ)} />
                    <Sor cimke="VÉGÖSSZEG energetikával" ertek={arazas.vegosszeg !== null ? forint(arazas.vegosszeg + ENERGETIKAI_TANUSITVANY_DIJ) : 'egyedi'} kiemelt />
                    <Sor cimke="árlista verzió" ertek={arazas.arlistaVerzio} />
                </div>
            )}
        </div>
    );
}
