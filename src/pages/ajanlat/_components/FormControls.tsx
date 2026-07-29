import { useState, type ReactNode } from 'react';
import { csakSzamjegy, ezresekkel } from '../../../utils/ajanlat/format';

export type OptionItem = { value: string; label: string };

type FieldProps = {
    label: string;
    htmlFor?: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
};

export function Field({ label, htmlFor, error, required, children }: FieldProps) {
    const errorId = htmlFor ? `${htmlFor}-error` : undefined;

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
                {label}
                {required && (
                    <span className="text-primary" aria-hidden="true">
                        {' *'}
                    </span>
                )}
            </label>
            {children}
            {error && (
                <p id={errorId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}

type TextInputProps = {
    id: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    type?: 'text' | 'email' | 'tel' | 'number';
    placeholder?: string;
    error?: string;
    inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
    min?: number;
    max?: number;
    autoComplete?: string;
};

export function TextInput({ id, name, value, onChange, onBlur, type = 'text', placeholder, error, inputMode, min, max, autoComplete }: TextInputProps) {
    return (
        <input
            id={id}
            name={name}
            type={type}
            value={value}
            placeholder={placeholder}
            inputMode={inputMode}
            autoComplete={autoComplete}
            min={min}
            max={max}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className="field-input"
        />
    );
}

type TeruletInputProps = {
    id: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string;
    placeholder?: string;
};

/**
 * Négyzetméter-mező.
 *
 * Szándékosan `type="text"`, nem `type="number"`: a számmező görgetéssel
 * véletlenül átírható, és elfogadna `1e5`, `-5`, `1.5` alakot is. Itt minden
 * nem számjegy azonnal eldobódik — gépelésnél és beillesztésnél egyaránt.
 * Az ezres csoportosítás csak a mezőből kilépve jelenik meg, hogy ne ugráljon
 * a kurzor gépelés közben.
 */
export function TeruletInput({ id, name, value, onChange, onBlur, error, placeholder }: TeruletInputProps) {
    const [fokuszban, setFokuszban] = useState(false);
    const megjelenites = fokuszban || value === '' ? value : ezresekkel(value);

    return (
        <div className="relative">
            <input
                id={id}
                name={name}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={megjelenites}
                placeholder={placeholder}
                onFocus={() => setFokuszban(true)}
                onChange={(e) => onChange(csakSzamjegy(e.target.value))}
                onBlur={() => {
                    setFokuszban(false);
                    onBlur?.();
                }}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                className="field-input pr-12"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500" aria-hidden="true">
                m²
            </span>
        </div>
    );
}

type RadioGroupProps = {
    name: string;
    legend: string;
    options: readonly OptionItem[];
    value: string;
    onChange: (value: string) => void;
    error?: string;
    columns?: 2 | 3;
    /** Kötelező mező-e; a csillagot ez vezérli. Alapból igen, a meglévő hívók viselkedése változatlan. */
    required?: boolean;
};

/** Szegmentált választó — vizuálisan gombsor, technikailag rádiócsoport. */
export function RadioGroup({ name, legend, options, value, onChange, error, columns = 3, required = true }: RadioGroupProps) {
    const errorId = `${name}-error`;
    return (
        <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
            <legend className="block text-sm font-medium text-slate-700 mb-2">
                {legend}
                {required && (
                    <span className="text-primary" aria-hidden="true">
                        {' *'}
                    </span>
                )}
            </legend>
            <div className={`grid gap-3 ${columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {options.map((option) => {
                    const id = `${name}-${option.value}`;
                    const selected = value === option.value;
                    return (
                        <label
                            key={option.value}
                            htmlFor={id}
                            className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-center text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                                selected ? 'border-primary bg-primary text-white shadow-sm' : 'border-slate-300 bg-white text-slate-700 hover:border-primary hover:bg-slate-50'
                            }`}
                        >
                            <input
                                id={id}
                                type="radio"
                                name={name}
                                value={option.value}
                                checked={selected}
                                onChange={() => onChange(option.value)}
                                aria-invalid={error ? true : undefined}
                                className="sr-only"
                            />
                            {option.label}
                        </label>
                    );
                })}
            </div>
            {error && (
                <p id={errorId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

type CheckboxGroupProps = {
    name: string;
    legend: string;
    hint?: string;
    options: readonly OptionItem[];
    value: readonly string[];
    onChange: (value: string[]) => void;
    error?: string;
    required?: boolean;
};

export function CheckboxGroup({ name, legend, hint, options, value, onChange, error, required }: CheckboxGroupProps) {
    const errorId = `${name}-error`;
    const toggle = (option: string) => {
        onChange(value.includes(option) ? value.filter((v) => v !== option) : [...value, option]);
    };

    return (
        <fieldset className="flex flex-col gap-2" aria-describedby={error ? errorId : undefined}>
            <legend className="block text-sm font-medium text-slate-700">
                {legend}
                {required && (
                    <span className="text-primary" aria-hidden="true">
                        {' *'}
                    </span>
                )}
            </legend>
            {hint && <p className="mb-2 text-sm text-slate-500">{hint}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
                {options.map((option) => {
                    const id = `${name}-${option.value}`;
                    const checked = value.includes(option.value);
                    return (
                        <label
                            key={option.value}
                            htmlFor={id}
                            className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                                checked ? 'border-primary bg-blue-50 text-slate-900' : 'border-slate-300 bg-white text-slate-700 hover:border-primary hover:bg-slate-50'
                            }`}
                        >
                            <input
                                id={id}
                                type="checkbox"
                                name={name}
                                value={option.value}
                                checked={checked}
                                onChange={() => toggle(option.value)}
                                aria-invalid={error ? true : undefined}
                                className="h-5 w-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            <span className="font-medium">{option.label}</span>
                        </label>
                    );
                })}
            </div>
            {error && (
                <p id={errorId} className="field-error" role="alert">
                    {error}
                </p>
            )}
        </fieldset>
    );
}

type SingleCheckboxProps = {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    description?: string;
    /** Csak olvasható előkitöltés jelzése (nem tiltja le, csak informál). */
    readOnlyHint?: string;
};

/** Egyetlen jelölőnégyzet-sor — a CheckboxGroup elemeivel azonos stílusban. */
export function SingleCheckbox({ id, checked, onChange, label, description, readOnlyHint }: SingleCheckboxProps) {
    return (
        <div className="flex flex-col gap-1">
            <label
                htmlFor={id}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
                    checked ? 'border-primary bg-blue-50 text-slate-900' : 'border-slate-300 bg-white text-slate-700 hover:border-primary hover:bg-slate-50'
                }`}
            >
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChange(e.target.checked)}
                    className="h-5 w-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="font-medium">{label}</span>
                {readOnlyHint && <span className="ml-auto text-xs font-normal text-slate-500">{readOnlyHint}</span>}
            </label>
            {description && <p className="pl-1 text-xs text-slate-500">{description}</p>}
        </div>
    );
}

/** Beágyazott, behúzott blokk egy szülőelem alatt — bal vezetővonallal elkülönítve. */
export function NestedBlock({ children }: { children: ReactNode }) {
    return <div className="mt-3 flex flex-col gap-5 border-l-2 border-slate-200 pl-3 sm:pl-5">{children}</div>;
}

type StepperProps = {
    steps: readonly string[];
    current: number;
};

export function Stepper({ steps, current }: StepperProps) {
    return (
        <nav aria-label="Az űrlap lépései" className="mb-10">
            <p className="sr-only" aria-live="polite">
                {`${current + 1}. lépés a(z) ${steps.length}-ból: ${steps[current]}`}
            </p>
            <ol className="grid grid-cols-4 gap-2">
                {steps.map((label, index) => {
                    const allapot = index < current ? 'kesz' : index === current ? 'aktiv' : 'hatra';
                    return (
                        <li key={label} className="flex flex-col gap-2">
                            <span
                                className={`h-1 rounded-full transition-colors ${allapot === 'hatra' ? 'bg-slate-200' : 'bg-primary'}`}
                                aria-hidden="true"
                            />
                            <span className={`text-[11px] leading-tight font-semibold break-words sm:text-xs ${allapot === 'hatra' ? 'text-slate-400' : 'text-slate-900'}`}>
                                <span className="hidden sm:inline">{index + 1}. </span>
                                {label}
                            </span>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}

/**
 * Feltételes blokk, animált ki-/becsúszással.
 *
 * A tartalom zárt állapotban is a DOM-ban marad, hogy a becsukódás is
 * animálható legyen — ezért kap `inert` jelölést: így sem billentyűzettel
 * nem érhető el, sem a képernyőolvasó nem olvassa fel.
 * A `prefers-reduced-motion` kezelése a CSS-ben van.
 */
export function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
    return (
        <div className={`collapsible ${open ? 'is-open' : ''}`}>
            <div className="collapsible-inner" inert={!open}>
                {children}
            </div>
        </div>
    );
}
