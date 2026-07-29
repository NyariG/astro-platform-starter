import { useState } from 'react';

export type AlkalmazottKupon = {
    kod: string;
    szazalek: number;
    hatokorSzolgaltatasok: string[];
};

type Allapot = 'ures' | 'ellenoriz' | 'ervenyes' | 'ervenytelen' | 'rate_limit' | 'halozati_hiba';

export function CouponField({ ertek, onValtozik, onBevaltva }: { ertek: string; onValtozik: (kod: string) => void; onBevaltva: (kupon: AlkalmazottKupon | null) => void }) {
    const [allapot, setAllapot] = useState<Allapot>('ures');
    const [szazalek, setSzazalek] = useState<number | null>(null);

    const bevalt = async () => {
        const kod = ertek.trim();
        if (kod === '') return;

        setAllapot('ellenoriz');
        try {
            const valasz = await fetch('/api/kupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kod })
            });

            if (valasz.status === 429) {
                setAllapot('rate_limit');
                onBevaltva(null);
                return;
            }

            const test = await valasz.json().catch(() => null);
            if (test?.ervenyes) {
                setAllapot('ervenyes');
                setSzazalek(test.szazalek);
                onBevaltva({ kod: test.kod, szazalek: test.szazalek, hatokorSzolgaltatasok: test.hatokorSzolgaltatasok ?? [] });
            } else {
                setAllapot('ervenytelen');
                onBevaltva(null);
            }
        } catch {
            setAllapot('halozati_hiba');
            onBevaltva(null);
        }
    };

    const torol = () => {
        onValtozik('');
        setAllapot('ures');
        onBevaltva(null);
    };

    const beir = (kod: string) => {
        onValtozik(kod.toUpperCase());
        if (allapot !== 'ures') {
            setAllapot('ures');
            onBevaltva(null);
        }
    };

    const bevaltva = allapot === 'ervenyes';
    const uzenetId = 'kupon-uzenet';

    return (
        <div className="flex flex-col gap-2">
            <label htmlFor="kuponKod" className="block text-sm font-medium text-slate-700">
                Van kuponkódja? <span className="font-normal text-slate-500">(nem kötelező)</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
                <input
                    id="kuponKod"
                    name="kuponKod"
                    type="text"
                    autoComplete="off"
                    value={ertek}
                    onChange={(e) => beir(e.target.value)}
                    disabled={bevaltva}
                    placeholder="PL. NYAR15"
                    aria-invalid={allapot === 'ervenytelen' || undefined}
                    aria-describedby={allapot !== 'ures' ? uzenetId : undefined}
                    className="field-input uppercase disabled:bg-slate-50 disabled:text-slate-500"
                />
                {bevaltva ? (
                    <button type="button" onClick={torol} className="btn btn-secondary min-h-11 shrink-0 sm:w-auto">
                        Törlés
                    </button>
                ) : (
                    <button type="button" onClick={bevalt} disabled={allapot === 'ellenoriz' || ertek.trim() === ''} className="btn min-h-11 shrink-0 sm:w-auto">
                        {allapot === 'ellenoriz' ? 'Ellenőrzés…' : 'Beváltás'}
                    </button>
                )}
            </div>

            <p id={uzenetId} aria-live="polite" className="min-h-5 text-sm">
                {allapot === 'ervenyes' && <span className="font-medium text-green-700">Kupon beváltva: −{szazalek}% kedvezmény érvényesítve.</span>}
                {allapot === 'ervenytelen' && <span className="text-slate-600">Ez a kód nem érvényes.</span>}
                {allapot === 'rate_limit' && <span className="text-slate-600">Túl sok próbálkozás. Kérjük, próbálja meg később.</span>}
                {allapot === 'halozati_hiba' && <span className="text-slate-600">A kód ellenőrzése most nem sikerült. Kérjük, próbálja újra.</span>}
            </p>
        </div>
    );
}
