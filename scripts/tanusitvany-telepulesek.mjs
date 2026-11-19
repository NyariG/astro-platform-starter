import { writeFileSync } from 'node:fs';

const SUGAR_M = 100000;
const UA = { 'User-Agent': 'nyariterv.hu telepules-tavolsag szkript' };
const KIMENET = new URL('../src/data/telepulesek-abda.json', import.meta.url);

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

async function overpass(lekerdezes) {
    for (let kor = 0; kor < 3; kor++) {
        for (const vegpont of OVERPASS) {
            try {
                const valasz = await fetch(vegpont, {
                    method: 'POST',
                    headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: 'data=' + encodeURIComponent(lekerdezes)
                });
                if (valasz.ok) return (await valasz.json()).elements;
                console.log('Overpass', vegpont, valasz.status);
            } catch (hiba) {
                console.log('Overpass', vegpont, hiba.message);
            }
        }
        await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error('Overpass nem elérhető');
}

const [abda] = await overpass('[out:json];area["ISO3166-1"="HU"]->.hu;node(area.hu)["place"="village"]["name"="Abda"];out;');
if (!abda) throw new Error('Abda nem található');

const nyers = await overpass(`[out:json][timeout:120];area["ISO3166-1"="HU"]->.hu;node(area.hu)["place"~"^(city|town|village)$"](around:${SUGAR_M},${abda.lat},${abda.lon});out;`);
const telepulesek = nyers.filter((n) => n.tags?.name).map((n) => ({ nev: n.tags.name, lat: n.lat, lon: n.lon }));
console.log('települések:', telepulesek.length);

const eredmeny = [];
const CSOMAG = 90;
for (let i = 0; i < telepulesek.length; i += CSOMAG) {
    const csomag = telepulesek.slice(i, i + CSOMAG);
    const koordinatak = [abda, ...csomag].map((p) => `${p.lon.toFixed(5)},${p.lat.toFixed(5)}`).join(';');
    const valasz = await fetch(`https://router.project-osrm.org/table/v1/driving/${koordinatak}?sources=0&annotations=distance`, { headers: UA });
    if (!valasz.ok) throw new Error(`OSRM ${valasz.status}`);
    const adat = await valasz.json();
    adat.distances[0].slice(1).forEach((tav, j) => {
        if (tav != null) eredmeny.push({ nev: csomag[j].nev, km: Math.round(tav / 100) / 10 });
    });
    await new Promise((r) => setTimeout(r, 1200));
}

const nevSzerint = new Map();
for (const t of eredmeny) {
    const lista = nevSzerint.get(t.nev) ?? [];
    lista.push(t);
    nevSzerint.set(t.nev, lista);
}
const vegleges = [...nevSzerint.values()].map((lista) => lista.sort((a, b) => a.km - b.km)[0]).sort((a, b) => a.nev.localeCompare(b.nev, 'hu'));
const duplikalt = [...nevSzerint.entries()].filter(([, l]) => l.length > 1).map(([n, l]) => `${n}: ${l.map((x) => x.km).join(', ')}`);

writeFileSync(KIMENET, JSON.stringify(vegleges, null, 0).replace(/},{/g, '},\n{') + '\n');
console.log('mentve:', vegleges.length, 'település; Abda:', abda.lat, abda.lon);
if (duplikalt.length) console.log('azonos nevűek (a közelebbit tartottam meg):', duplikalt.join(' | '));
