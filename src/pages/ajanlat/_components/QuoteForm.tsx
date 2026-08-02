import { useEffect, useMemo, useRef, useState } from 'react';
import { LEPESEK, LEPES_MEZOK, StepAttekintes, StepIngatlan, StepKapcsolat, StepSzolgaltatasok, URES_URLAP, type FormValues } from './FormSteps';
import type { AlkalmazottKupon } from './CouponField';
import { DebugPanel } from './DebugPanel';
import { Stepper } from './FormControls';
import { ResultPanel, type Eredmeny } from './ResultPanel';
import { fieldErrors, quoteInputSchema, teruletSzam } from '../../../utils/ajanlat/schema';
import { calculateQuote } from '../../../utils/ajanlat/pricing';
import { effektivUrlap, kliensExtraHibak, normalizalAllapot } from '../../../utils/ajanlat/lathatosag';

const VEGPONT = '/api/ajanlat';

const PISZKOZAT_KULCS = 'nyariterv-ajanlat-piszkozat-v1';

function ujratoltesVolt(): boolean {
    try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav?.type) return nav.type === 'reload';

        return performance.navigation?.type === 1;
    } catch {
        return false;
    }
}

function piszkozatBetoltes(): FormValues | null {
    try {
        const nyers = sessionStorage.getItem(PISZKOZAT_KULCS);
        if (!nyers) return null;
        const mentett = JSON.parse(nyers) as Partial<FormValues>;
        if (!mentett || typeof mentett !== 'object') return null;

        const urlap = { ...URES_URLAP, ...Object.fromEntries(Object.entries(mentett).filter(([kulcs]) => kulcs in URES_URLAP)) } as FormValues;

        const szolg = new Set(urlap.szolgaltatasok);
        if (['kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'].some((k) => szolg.has(k))) urlap.kertepitesAktiv = true;

        return normalizalAllapot(urlap);
    } catch {
        return null;
    }
}

export default function QuoteForm() {
    const [values, setValues] = useState<FormValues>(URES_URLAP);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [step, setStep] = useState(0);
    const [kuldes, setKuldes] = useState(false);
    const [eredmeny, setEredmeny] = useState<Eredmeny | null>(null);

    const [kupon, setKupon] = useState<AlkalmazottKupon | null>(null);
    const [mutatDebug, setMutatDebug] = useState<boolean>(import.meta.env.DEV);
    const tetejeRef = useRef<HTMLDivElement>(null);
    const startElkuldve = useRef(false);

    useEffect(() => {
        if (import.meta.env.DEV) return;
        if (!new URLSearchParams(window.location.search).has('debug')) return;
        let ervenyes = true;
        fetch('/api/debug-allapot')
            .then((valasz) => (valasz.ok ? valasz.json() : null))
            .then((adat) => {
                if (ervenyes && adat && adat.debug === true) setMutatDebug(true);
            })
            .catch(() => {});
        return () => {
            ervenyes = false;
        };
    }, []);

    useEffect(() => {
        if (ujratoltesVolt()) {
            try {
                sessionStorage.removeItem(PISZKOZAT_KULCS);
            } catch {

            }
            return;
        }
        const mentett = piszkozatBetoltes();
        if (mentett) setValues(mentett);
    }, []);

    useEffect(() => {
        if (eredmeny) return;
        try {
            const { _cegnev, ...menteni } = values;
            sessionStorage.setItem(PISZKOZAT_KULCS, JSON.stringify(menteni));
        } catch {

        }
    }, [values, eredmeny]);

    const arazas = useMemo(() => {
        const eff = effektivUrlap(values);
        return calculateQuote(
            {
                szolgaltatasok: eff.szolgaltatasok,
                epuletTerulet: teruletSzam(eff.alapterulet),
                telekMeret: teruletSzam(eff.telekMeret),
                ontozendoTerulet: teruletSzam(eff.ontozendoTerulet),
                hotermelok: eff.hotermelok,
                nincsHutes: eff.mennyezetHutes === 'nem',
                ingatlanJelleg: values.ingatlanJelleg
            },
            undefined,
            kupon ? { kod: kupon.kod, szazalek: kupon.szazalek, hatokorSzolgaltatasok: kupon.hatokorSzolgaltatasok } : null
        );
    }, [values, kupon]);

    const set = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
        setValues((elozo) => normalizalAllapot({ ...elozo, [field]: value }));

        setErrors((elozo) => {
            const maradek = { ...elozo };
            delete maradek[field as string];

            if (field === 'szolgaltatasok') delete maradek.kertepites;
            return maradek;
        });
    };

    const ellenorzes = (mezok?: readonly string[]): Record<string, string> => {
        const eff = effektivUrlap(values);
        const sema = quoteInputSchema.safeParse(eff);
        const semaHibak = sema.success ? {} : fieldErrors(sema.error);
        const osszes: Record<string, string> = { ...semaHibak, ...kliensExtraHibak(values) };
        if (!mezok) return osszes;
        return Object.fromEntries(Object.entries(osszes).filter(([mezo]) => mezok.includes(mezo)));
    };

    const blurEllenorzes = (field: keyof FormValues) => {
        setErrors((elozo) => ({ ...elozo, ...ellenorzes([field]) }));
    };

    const gorgetesFel = () => tetejeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const tovabb = () => {
        const hibak = ellenorzes(LEPES_MEZOK[step]);
        setErrors(hibak);
        if (Object.keys(hibak).length > 0) return;
        if (step === 0 && !startElkuldve.current) {
            startElkuldve.current = true;
            window.ntTrack?.('StartQuote', { content_category: 'arajanlat' });
        }
        if (step === 1) {
            const eff = effektivUrlap(values);
            window.ntTrack?.('SelectServices', {
                content_category: 'arajanlat',
                szolgaltatasok: eff.szolgaltatasok,
                hotermelok: eff.hotermelok,
                mennyezet_hutes: eff.mennyezetHutes
            });
        }
        setStep((s) => Math.min(s + 1, LEPESEK.length - 1));
        gorgetesFel();
    };

    const vissza = () => {
        setErrors({});
        setStep((s) => Math.max(s - 1, 0));
        gorgetesFel();
    };

    const bekuldes = async () => {
        const hibak = ellenorzes();
        if (Object.keys(hibak).length > 0) {
            setErrors(hibak);
            const elsoHibasLepes = LEPES_MEZOK.findIndex((mezok) => mezok.some((mezo) => mezo in hibak));
            if (elsoHibasLepes >= 0) setStep(elsoHibasLepes);
            gorgetesFel();
            return;
        }

        setKuldes(true);
        try {

            const valasz = await fetch(VEGPONT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(effektivUrlap(values))
            });
            const test = await valasz.json().catch(() => null);

            if (valasz.ok && test?.ok) {
                try {
                    sessionStorage.removeItem(PISZKOZAT_KULCS);
                } catch {

                }
                if (typeof test.id === 'string') {
                    const nevDarabok = values.nev.trim().split(/\s+/).filter(Boolean);
                    const illesztes: Record<string, string> = { country: 'hu' };
                    if (values.email.trim()) illesztes.em = values.email;
                    if (values.telefon.trim()) illesztes.ph = values.telefon;
                    if (values.varos.trim()) illesztes.ct = values.varos;
                    if (nevDarabok[0]) illesztes.ln = nevDarabok[0];
                    if (nevDarabok.length > 1) illesztes.fn = nevDarabok.slice(1).join(' ');
                    window.ntAdvancedMatch?.(illesztes);
                    const leadParam: Record<string, unknown> = { content_category: 'arajanlat' };
                    if (typeof test.vegosszeg === 'number') {
                        leadParam.value = test.vegosszeg;
                        leadParam.currency = 'HUF';
                    }
                    window.ntTrack?.('Lead', leadParam, { eventID: test.id });
                }
                setEredmeny({
                    tipus: 'siker',
                    id: typeof test.id === 'string' ? test.id : null,
                    branch: test.branch ?? null,
                    emailSent: test.emailSent !== false,
                    pdfElerheto: test.pdfElerheto === true,
                    vegosszeg: typeof test.vegosszeg === 'number' ? test.vegosszeg : null,
                    vanEgyediArazas: test.vanEgyediArazas === true
                });
                gorgetesFel();
                return;
            }

            if (valasz.status === 400 && test?.fields) {
                setErrors(test.fields);
                const elsoHibasLepes = LEPES_MEZOK.findIndex((mezok) => mezok.some((mezo) => mezo in test.fields));
                setStep(elsoHibasLepes >= 0 ? elsoHibasLepes : 0);
                gorgetesFel();
                return;
            }

            if (valasz.status === 429 && test?.error === 'daily_limit') {
                setEredmeny({ tipus: 'limit', uzenet: test.message });
                gorgetesFel();
                return;
            }

            if (valasz.status === 429 && test?.error === 'ip_limit') {
                setEredmeny({ tipus: 'ip_limit' });
                gorgetesFel();
                return;
            }

            setEredmeny({ tipus: 'hiba' });
            gorgetesFel();
        } catch {
            setEredmeny({ tipus: 'hiba' });
            gorgetesFel();
        } finally {
            setKuldes(false);
        }
    };

    const ujrakezdes = () => {
        setEredmeny(null);
        setErrors({});
        setStep(0);
        setValues(URES_URLAP);
        setKupon(null);
        gorgetesFel();
    };

    const lepesProps = { values, errors, set, onBlur: blurEllenorzes };
    const utolsoLepes = step === LEPESEK.length - 1;
    const hibaSzam = Object.keys(errors).length;
    if (eredmeny) {
        return (
            <div ref={tetejeRef} className="scroll-mt-24">
                {mutatDebug && <DebugPanel values={values} arazas={arazas} kupon={kupon} />}
                <ResultPanel eredmeny={eredmeny} onUjra={ujrakezdes} />
            </div>
        );
    }

    return (
        <div ref={tetejeRef} className="scroll-mt-24">
            {mutatDebug && <DebugPanel values={values} arazas={arazas} kupon={kupon} />}
            <div>
                <form
                    noValidate
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (utolsoLepes) void bekuldes();
                        else tovabb();
                    }}
                    className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10"
                >
                    <Stepper steps={LEPESEK} current={step} />

                    {}
                    <div className="hidden" aria-hidden="true">
                        <label htmlFor="_cegnev">Cégnév</label>
                        <input id="_cegnev" name="_cegnev" type="text" tabIndex={-1} autoComplete="off" value={values._cegnev} onChange={(e) => set('_cegnev', e.target.value)} />
                    </div>

                    {step === 0 && <StepIngatlan {...lepesProps} />}
                    {step === 1 && <StepSzolgaltatasok {...lepesProps} />}
                    {step === 2 && <StepAttekintes {...lepesProps} onKuponBevaltva={setKupon} />}
                    {step === 3 && <StepKapcsolat {...lepesProps} />}

                    <p aria-live="polite" className="sr-only">
                        {hibaSzam > 0 ? `${hibaSzam} mező javításra szorul ezen a lépésen.` : ''}
                    </p>

                    {hibaSzam > 0 && (
                        <p className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                            {hibaSzam === 1 ? 'Egy mező javításra szorul.' : `${hibaSzam} mező javításra szorul.`}
                        </p>
                    )}

                    <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-between">
                        {step > 0 ? (
                            <button type="button" onClick={vissza} disabled={kuldes} className="btn btn-secondary min-h-11 sm:w-auto">
                                Vissza
                            </button>
                        ) : (
                            <span className="hidden sm:block" />
                        )}

                        <button type="submit" disabled={kuldes} className="btn min-h-11 sm:w-auto">
                            {kuldes ? 'Küldés folyamatban…' : utolsoLepes ? 'Ajánlatkérés elküldése' : 'Tovább'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
