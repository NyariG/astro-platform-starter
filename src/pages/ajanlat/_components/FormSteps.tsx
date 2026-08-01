import { useRef, useState, type ReactNode } from 'react';
import { CheckboxGroup, Collapsible, Field, NestedBlock, RadioGroup, SingleCheckbox, TeruletInput, TextInput } from './FormControls';
import { CouponField, type AlkalmazottKupon } from './CouponField';
import { HOTERMELOK, HUTES_OPCIOK, INGATLAN_JELLEG, MENNYEZET_HUTES, PINCE, SZOLGALTATAS_OPCIOK, TERV_CELJA, labelOf, labelsOf } from '../../../utils/ajanlat/options';
import { effektivUrlap, mezoLathato } from '../../../utils/ajanlat/lathatosag';
import { SZOLGALTATAS_FA } from '../../../utils/ajanlat/szolgaltatas-fa';
import { negyzetmeter } from '../../../utils/ajanlat/format';
import { GDPR_KONSZENT_SZOVEG, JOGI_CIM, JOGI_ROVID, JOGI_TELJES } from '../../../utils/ajanlat/legal-notice';

function jogiPontLinkkel(pont: string): ReactNode {
    const kulcs = 'Adatkezelési tájékoztató';
    const i = pont.indexOf(kulcs);
    if (i === -1) return pont;
    return (
        <>
            {pont.slice(0, i)}
            <a href="/adatkezelesi" target="_blank" rel="noopener" className="font-medium text-primary underline hover:text-primary/80">
                {kulcs}
            </a>
            {pont.slice(i + kulcs.length)}
        </>
    );
}

function JogiNyilatkozat() {
    const [nyitva, setNyitva] = useState(false);
    return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-relaxed text-slate-700">{JOGI_ROVID}</p>
            <button
                type="button"
                onClick={() => setNyitva((elozo) => !elozo)}
                aria-expanded={nyitva}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
                {nyitva ? 'Részletek elrejtése' : 'Részletek'}
                <svg className={`h-4 w-4 transition-transform ${nyitva ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
            </button>
            {nyitva && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                    <h3 className="mb-2 text-sm font-bold text-slate-900">{JOGI_CIM}</h3>
                    <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-relaxed text-slate-600">
                        {JOGI_TELJES.map((pont, index) => (
                            <li key={index}>{jogiPontLinkkel(pont)}</li>
                        ))}
                    </ol>
                </div>
            )}
        </div>
    );
}

export type FormValues = {
    nev: string;
    email: string;
    telefon: string;
    varos: string;
    ingatlanJelleg: string;
    tervCelja: string;
    szintek: string;
    pince: string;
    szolgaltatasok: string[];
    alapterulet: string;
    telekMeret: string;
    ontozendoTerulet: string;
    hotermelok: string[];
    mennyezetHutes: string;
    /** Informatív hűtési alopciók (Hőszivattyú / Fan-coil / Mennyezethűtés). */
    hutesOpciok: string[];
    /** A „Kertépítés" vizuális csoport nyitott állapota (UI-only). */
    kertepitesAktiv: boolean;
    kuponKod: string;
    gdprConsent: boolean;
    _cegnev: string;
};

export const URES_URLAP: FormValues = {
    nev: '',
    email: '',
    telefon: '',
    varos: '',
    ingatlanJelleg: '',
    tervCelja: '',
    szintek: '',
    pince: '',
    szolgaltatasok: [],
    alapterulet: '',
    telekMeret: '',
    ontozendoTerulet: '',
    hotermelok: [],
    mennyezetHutes: '',
    hutesOpciok: [],
    kertepitesAktiv: false,
    kuponKod: '',
    gdprConsent: false,
    _cegnev: ''
};

export const LEPESEK = ['Ingatlan', 'Szolgáltatások', 'Áttekintés', 'Kapcsolat'] as const;

/**
 * Melyik lépéshez mely mezők tartoznak — a hibák ez alapján kerülnek a helyükre.
 * A kapcsolati adatok és a hozzájárulás az utolsó lépésen, közvetlenül a
 * beküldés előtt kerülnek bekérésre; az Áttekintésnek nincs saját kötelező mezője.
 */
// A mezőnevek közt szerepelhet szintetikus kulcs is (pl. `kertepites`), ami nem
// FormValues-mező, hanem a Kertépítés-csoport kliensoldali hibájának a helye.
export const LEPES_MEZOK: readonly (readonly string[])[] = [
    ['ingatlanJelleg', 'tervCelja', 'szintek'],
    ['szolgaltatasok', 'alapterulet', 'telekMeret', 'ontozendoTerulet', 'hotermelok', 'mennyezetHutes', 'hutesOpciok', 'kertepites'],
    [],
    ['nev', 'email', 'telefon', 'varos', 'gdprConsent']
];

type StepProps = {
    values: FormValues;
    errors: Record<string, string>;
    set: <K extends keyof FormValues>(field: K, value: FormValues[K]) => void;
    onBlur: (field: keyof FormValues) => void;
};

export function StepKapcsolat({ values, errors, set, onBlur }: StepProps) {
    return (
        <div className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2">
                <Field label="Név" htmlFor="nev" error={errors.nev} required>
                    <TextInput
                        id="nev"
                        name="nev"
                        autoComplete="name"
                        value={values.nev}
                        onChange={(v) => set('nev', v)}
                        onBlur={() => onBlur('nev')}
                        error={errors.nev}
                        placeholder="Az Ön neve"
                    />
                </Field>
                <Field label="Telefonszám (nem kötelező)" htmlFor="telefon" error={errors.telefon}>
                    <TextInput
                        id="telefon"
                        name="telefon"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={values.telefon}
                        onChange={(v) => set('telefon', v)}
                        onBlur={() => onBlur('telefon')}
                        error={errors.telefon}
                        placeholder="+36 20 123 4567"
                    />
                </Field>
            </div>
            <Field label="E-mail cím" htmlFor="email" error={errors.email} required>
                <TextInput
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={values.email}
                    onChange={(v) => set('email', v)}
                    onBlur={() => onBlur('email')}
                    error={errors.email}
                    placeholder="pelda@email.com"
                />
            </Field>
            <Field label="Település" htmlFor="varos" error={errors.varos} required>
                <TextInput
                    id="varos"
                    name="varos"
                    autoComplete="address-level2"
                    value={values.varos}
                    onChange={(v) => set('varos', v)}
                    onBlur={() => onBlur('varos')}
                    error={errors.varos}
                    placeholder="Győr"
                />
            </Field>

            <div className="flex flex-col gap-2">
                <label
                    htmlFor="gdprConsent"
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-300 bg-white p-4 transition hover:border-primary has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                >
                    <input
                        id="gdprConsent"
                        name="gdprConsent"
                        type="checkbox"
                        checked={values.gdprConsent}
                        onChange={(e) => set('gdprConsent', e.target.checked)}
                        aria-invalid={errors.gdprConsent ? true : undefined}
                        aria-describedby={errors.gdprConsent ? 'gdprConsent-error' : undefined}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">
                        {GDPR_KONSZENT_SZOVEG.replace('Adatkezelési tájékoztatót.', '')}
                        <a href="/adatkezelesi" target="_blank" rel="noopener" className="font-medium text-primary underline hover:text-primary/80" onClick={(e) => e.stopPropagation()}>
                            Adatkezelési tájékoztatót
                        </a>
                        .
                        <span className="text-primary" aria-hidden="true">
                            {' *'}
                        </span>
                    </span>
                </label>
                {errors.gdprConsent && (
                    <p id="gdprConsent-error" className="field-error" role="alert">
                        {errors.gdprConsent}
                    </p>
                )}
            </div>

            <JogiNyilatkozat />
        </div>
    );
}

export function StepIngatlan({ values, errors, set, onBlur }: StepProps) {
    return (
        <div className="flex flex-col gap-8">
            <RadioGroup
                name="ingatlanJelleg"
                legend="Az ingatlan jellege"
                options={INGATLAN_JELLEG}
                value={values.ingatlanJelleg}
                onChange={(v) => set('ingatlanJelleg', v)}
                error={errors.ingatlanJelleg}
            />
            <RadioGroup
                name="tervCelja"
                legend="A terv célja"
                options={TERV_CELJA}
                value={values.tervCelja}
                onChange={(v) => set('tervCelja', v)}
                error={errors.tervCelja}
                columns={2}
            />
            {/* Az épület szintjei és a pince egy csoportban — logikailag összetartoznak. */}
            <fieldset className="flex flex-col gap-6 rounded-lg border border-slate-200 p-4 sm:p-5">
                <legend className="px-1 text-sm font-semibold text-slate-500">Az épület további adatai</legend>
                <div className="sm:max-w-xs">
                    <Field label="Szintek száma (nem kötelező)" htmlFor="szintek" error={errors.szintek}>
                        <TextInput
                            id="szintek"
                            name="szintek"
                            inputMode="numeric"
                            value={values.szintek}
                            onChange={(v) => set('szintek', v.replace(/\D/g, '').slice(0, 2))}
                            onBlur={() => onBlur('szintek')}
                            error={errors.szintek}
                            placeholder="2"
                        />
                    </Field>
                </div>
                <RadioGroup
                    name="pince"
                    legend="Pince (nem kötelező)"
                    options={PINCE}
                    value={values.pince}
                    onChange={(v) => set('pince', v)}
                    columns={2}
                    required={false}
                />
            </fieldset>
        </div>
    );
}

function HutesBlokk({ values, errors, set, toggleHutes }: StepProps & { toggleHutes: (opcio: string, be: boolean) => void }) {
    const latszik = mezoLathato(values);
    return (
        <div className="flex flex-col gap-3">
            <RadioGroup
                name="mennyezetHutes"
                legend="Szeretne hűtést?"
                options={MENNYEZET_HUTES}
                value={values.mennyezetHutes}
                onChange={(v) => set('mennyezetHutes', v)}
                error={errors.mennyezetHutes}
                columns={2}
            />

            <Collapsible open={latszik.hutesAlopciok}>
                <NestedBlock>
                    <SingleCheckbox id="hutes-fan_coil" checked={values.hutesOpciok.includes('fan_coil')} onChange={(b) => toggleHutes('fan_coil', b)} label={labelOf(HUTES_OPCIOK, 'fan_coil')} />
                    <SingleCheckbox id="hutes-mennyezet" checked={values.hutesOpciok.includes('mennyezet')} onChange={(b) => toggleHutes('mennyezet', b)} label={labelOf(HUTES_OPCIOK, 'mennyezet')} />
                    {errors.hutesOpciok && (
                        <p className="field-error" role="alert">
                            {errors.hutesOpciok}
                        </p>
                    )}
                </NestedBlock>
            </Collapsible>
        </div>
    );
}

/** A Kertépítés csoport tartalma: három szolgáltatás + a hozzájuk tartozó területmezők. */
function KertBlokk({ values, errors, set, onBlur, toggleSzolg }: StepProps & { toggleSzolg: (kod: string, be: boolean) => void }) {
    const latszik = mezoLathato(values);
    const kertKodok = ['kert_koncepcio', 'kert_kiviteli', 'ontozorendszer'] as const;
    return (
        <>
            <div className="flex flex-col gap-3">
                {kertKodok.map((kod) => (
                    <SingleCheckbox key={kod} id={`kert-${kod}`} checked={values.szolgaltatasok.includes(kod)} onChange={(b) => toggleSzolg(kod, b)} label={labelOf(SZOLGALTATAS_OPCIOK, kod)} />
                ))}
            </div>
            {errors.kertepites && (
                <p className="field-error" role="alert">
                    {errors.kertepites}
                </p>
            )}

            <Collapsible open={latszik.telekMeret}>
                <div className="sm:max-w-xs">
                    <Field label="Telekméret" htmlFor="telekMeret" error={errors.telekMeret} required>
                        <TeruletInput id="telekMeret" name="telekMeret" value={values.telekMeret} onChange={(v) => set('telekMeret', v)} onBlur={() => onBlur('telekMeret')} error={errors.telekMeret} placeholder="800" />
                    </Field>
                </div>
            </Collapsible>

            <Collapsible open={latszik.ontozendoTerulet}>
                <div className="sm:max-w-xs">
                    <Field label="Öntözendő terület" htmlFor="ontozendoTerulet" error={errors.ontozendoTerulet} required>
                        <TeruletInput id="ontozendoTerulet" name="ontozendoTerulet" value={values.ontozendoTerulet} onChange={(v) => set('ontozendoTerulet', v)} onBlur={() => onBlur('ontozendoTerulet')} error={errors.ontozendoTerulet} placeholder="400" />
                    </Field>
                </div>
            </Collapsible>
        </>
    );
}

export function StepSzolgaltatasok({ values, errors, set, onBlur }: StepProps) {
    const panelRef = useRef<Record<string, HTMLDivElement | null>>({});

    // Mobilon a frissen megnyílt panelhez finoman odagörgetünk, hogy a
    // beágyazott tartalmat ne kelljen keresgélni. `prefers-reduced-motion`
    // esetén a böngésző a simítást úgyis elhagyja.
    const gorgetMobil = (id: string, be: boolean) => {
        if (!be || typeof window === 'undefined') return;
        if (!window.matchMedia('(max-width: 640px)').matches) return;
        window.setTimeout(() => panelRef.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 180);
    };

    const toggleSzolg = (kod: string, be: boolean) => {
        set('szolgaltatasok', be ? [...values.szolgaltatasok, kod] : values.szolgaltatasok.filter((s) => s !== kod));
    };
    const toggleHutes = (opcio: string, be: boolean) => {
        set('hutesOpciok', be ? [...values.hutesOpciok, opcio] : values.hutesOpciok.filter((o) => o !== opcio));
    };

    const latszik = mezoLathato(values);

    return (
        <div className="flex flex-col gap-6">
            {/* Az épület alapterülete MINDIG látható, a szolgáltatáslista fölött. */}
            <div className="sm:max-w-xs">
                <Field label="Az épület alapterülete" htmlFor="alapterulet" error={errors.alapterulet} required>
                    <TeruletInput id="alapterulet" name="alapterulet" value={values.alapterulet} onChange={(v) => set('alapterulet', v)} onBlur={() => onBlur('alapterulet')} error={errors.alapterulet} placeholder="120" />
                </Field>
            </div>

            <fieldset className="flex flex-col gap-2">
                <legend className="block text-sm font-medium text-slate-700">
                Milyen tervezési munkát kér?
                <span className="text-primary" aria-hidden="true">
                    {' *'}
                </span>
            </legend>
            <p className="mb-2 text-sm text-slate-500">Több lehetőség is választható. Kerttel kapcsolatos tervek lentebb, a lenyíló menüben, a Kertépítés témában.</p>

            <div className="flex flex-col gap-3">
                {SZOLGALTATAS_FA.map((cs) => {
                    if (cs.tipus === 'szolgaltatas') {
                        const kivalasztva = values.szolgaltatasok.includes(cs.kod);
                        const controlsId = cs.kod === 'futesi_terv' ? 'blokk-futesi_terv' : undefined;
                        return (
                            <div key={cs.kod} ref={(el) => void (panelRef.current[cs.kod] = el)}>
                                <SingleCheckbox
                                    id={`szolg-${cs.kod}`}
                                    checked={kivalasztva}
                                    onChange={(b) => {
                                        toggleSzolg(cs.kod, b);
                                        if (cs.kod === 'futesi_terv') gorgetMobil(cs.kod, b);
                                    }}
                                    label={labelOf(SZOLGALTATAS_OPCIOK, cs.kod)}
                                />
                                {cs.kod === 'futesi_terv' && (
                                    <div id={controlsId}>
                                        <Collapsible open={kivalasztva}>
                                            <NestedBlock>
                                                <CheckboxGroup
                                                    name="hotermelok"
                                                    legend="Milyen hőtermelőt tervez?"
                                                    hint="Fűtési terv esetén legalább egy megadása kötelező."
                                                    options={HOTERMELOK}
                                                    value={values.hotermelok}
                                                    onChange={(v) => set('hotermelok', v)}
                                                    error={errors.hotermelok}
                                                    required
                                                />
                                                <Collapsible open={latszik.hutesKerdes}>
                                                    <HutesBlokk values={values} errors={errors} set={set} onBlur={onBlur} toggleHutes={toggleHutes} />
                                                </Collapsible>
                                            </NestedBlock>
                                        </Collapsible>
                                    </div>
                                )}
                            </div>
                        );
                    }

                    const nyitva = values[cs.kulcs];
                    return (
                        <div key={cs.kulcs} ref={(el) => void (panelRef.current[cs.kulcs] = el)}>
                            <SingleCheckbox
                                id={`csoport-${cs.kulcs}`}
                                checked={nyitva}
                                onChange={(b) => {
                                    set(cs.kulcs, b);
                                    gorgetMobil(cs.kulcs, b);
                                }}
                                label={cs.cimke}
                            />
                            <Collapsible open={nyitva}>
                                <NestedBlock>
                                    <KertBlokk values={values} errors={errors} set={set} onBlur={onBlur} toggleSzolg={toggleSzolg} />
                                </NestedBlock>
                            </Collapsible>
                        </div>
                    );
                })}
            </div>

            {errors.szolgaltatasok && (
                <p id="szolgaltatasok-error" className="field-error" role="alert">
                    {errors.szolgaltatasok}
                </p>
            )}
            </fieldset>
        </div>
    );
}

export function StepAttekintes({ values, set, onKuponBevaltva }: StepProps & { onKuponBevaltva: (kupon: AlkalmazottKupon | null) => void }) {
    // A kapcsolati adatokat a következő lépésen kérjük be, ezért itt csak az
    // ingatlan és a szolgáltatások összegzése jelenik meg.
    const sorok: [string, string][] = [
        ['Ingatlan jellege', labelOf(INGATLAN_JELLEG, values.ingatlanJelleg)],
        ['Terv célja', labelOf(TERV_CELJA, values.tervCelja)]
    ];

    // A rejtett (bezárt csoportokhoz tartozó) kiválasztásokat itt sem mutatjuk.
    const eff = effektivUrlap(values);

    if (values.szintek) sorok.push(['Szintek száma', values.szintek]);
    if (values.pince) sorok.push(['Pince', labelOf(PINCE, values.pince)]);
    if (eff.szolgaltatasok.some((k) => ['muszaki_leiras', 'futesi_terv', 'klimaterv', 'szellozteto_terv', 'vizellatas_terv', 'esoviz_szikkasztas', 'kozponti_porszivo'].includes(k)) && values.alapterulet)
        sorok.push(['Épület alapterülete', negyzetmeter(Number(values.alapterulet))]);
    if (eff.szolgaltatasok.some((k) => ['kert_koncepcio', 'kert_kiviteli'].includes(k)) && values.telekMeret) sorok.push(['Telekméret', negyzetmeter(Number(values.telekMeret))]);
    if (eff.szolgaltatasok.includes('ontozorendszer') && values.ontozendoTerulet) sorok.push(['Öntözendő terület', negyzetmeter(Number(values.ontozendoTerulet))]);

    sorok.push(['Kért szolgáltatások', labelsOf(SZOLGALTATAS_OPCIOK, eff.szolgaltatasok).join(', ') || '—']);
    if (eff.hotermelok.length > 0) sorok.push(['Hőtermelők', labelsOf(HOTERMELOK, eff.hotermelok).join(', ')]);
    if (eff.mennyezetHutes) sorok.push(['Hűtés', labelOf(MENNYEZET_HUTES, eff.mennyezetHutes)]);
    if (eff.hutesOpciok.length > 0) sorok.push(['Hűtési igények', labelsOf(HUTES_OPCIOK, eff.hutesOpciok).join(', ')]);

    return (
        <div className="flex flex-col gap-8">
            <CouponField ertek={values.kuponKod} onValtozik={(kod) => set('kuponKod', kod)} onBevaltva={onKuponBevaltva} />

            <div>
                <h2 className="mb-4 text-xl font-bold text-slate-900">A megadott adatok</h2>
                <dl className="overflow-hidden rounded-lg border border-slate-200">
                    {sorok.map(([cimke, ertek], index) => (
                        <div key={cimke} className={`grid gap-1 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4 ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
                            <dt className="text-sm text-slate-500">{cimke}</dt>
                            <dd className="text-sm font-semibold text-slate-900">{ertek}</dd>
                        </div>
                    ))}
                </dl>
            </div>

            <p className="text-sm text-slate-600">A következő lépésben elkérjük az elérhetőségeit, hogy elküldhessük Önnek az ajánlatot.</p>
        </div>
    );
}
