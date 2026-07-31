import { ARLISTA_VERZIO, ENERGETIKAI_TANUSITVANY_DIJ, HOTERMELO_FELAR, KEDVEZMENY_SZAZALEK, SZOLGALTATASOK, type Szolgaltatas } from './pricing-config';
import { olvasKonfig, irKonfig, type VerzioMeta } from './config-store';

export type ArazasKonfig = {
    szolgaltatasok: Szolgaltatas[];
    hotermeloFelar: number;
    kedvezmenySzazalek: number;
    energetikaiDij: number;
    arlistaVerzio: string;
};

export type PdfSzovegek = {
    energetikaiNev: string;
    energetikaiSzoveg: string;
    tartalmazza: string[];
    nemTartalmazza: string[];
    hataridok: string[];
    ervenyesseg: string;
    adomentes: string;
};

export type SzovegKonfig = {
    muszakiNev: string;
    reszletezo: string;
    kertFejlec: string;
    pdf: PdfSzovegek;
};

export type KapcsoloKonfig = {
    pdfAdmin: boolean;
    pdfUgyfel: boolean;
    debug: boolean;
};

const ARAK_KULCS = 'config/arak';
const SZOVEGEK_KULCS = 'config/szovegek';
const KAPCSOLOK_KULCS = 'config/kapcsolok';

function klon<T>(ertek: T): T {
    return JSON.parse(JSON.stringify(ertek)) as T;
}

export const SEED_ARAK: ArazasKonfig = {
    szolgaltatasok: klon(SZOLGALTATASOK) as unknown as Szolgaltatas[],
    hotermeloFelar: HOTERMELO_FELAR,
    kedvezmenySzazalek: KEDVEZMENY_SZAZALEK,
    energetikaiDij: ENERGETIKAI_TANUSITVANY_DIJ,
    arlistaVerzio: ARLISTA_VERZIO
};

export const SEED_SZOVEGEK: SzovegKonfig = {
    muszakiNev: 'Műszaki leírás egyszerű bejelentéshez',
    reszletezo: ' (Tartalmazza: rendelet szerinti hőtechnikai számítások, gépészeti műszaki leírás, alternatív rendszerek vizsgálata és leírása, aláírólap)',
    kertFejlec: 'Kertépítészeti és öntözési tervezés (közvetített szolgáltatás):',
    pdf: {
        energetikaiNev: 'Energetikai tanúsítvány használatbavételi engedélyhez',
        energetikaiSzoveg: '(Az ár a tervezés megrendelése esetén érvényes a tervek leadásától számított maximum 2 évig.)',
        tartalmazza: ['műszaki konzultációt', 'hőtechnikai számításokat (fűtéshez-hűtéshez)', 'alaprajzi tervet', 'függőleges csőtervet', 'kapcsolási rajzot', 'árazatlan költségvetést', 'műszaki leírást'],
        nemTartalmazza: ['vezérlés/automatika (gyengeáram) terveit', 'közmű csatlakozások terveit', 'víz-csatorna közművek engedélyeztetési eljárását', 'esővíz elvezetés terveit'],
        hataridok: [
            'Tervezés várható időtartama: A megrendeléstől, illetve a végleges adatszolgáltatástól számított kb. 3 munkahét.',
            'Előleg: A tervezési munka megrendelése 30%-os előleg kifizetéssel véglegesíthető.',
            'Átadás: Az elkészült tervek a végszámla kiegyenlítését követően, elektronikusan átadásra kerülnek.'
        ],
        ervenyesseg: 'Az árajánlat a kiállítástól számított 3 hónapig érvényes.',
        adomentes: 'Az ajánlat alanyi adómentes.'
    }
};

export const SEED_KAPCSOLOK: KapcsoloKonfig = {
    pdfAdmin: true,
    pdfUgyfel: true,
    debug: false
};

export async function betoltArak(): Promise<ArazasKonfig> {
    return olvasKonfig(ARAK_KULCS, SEED_ARAK);
}

export async function mentsdArak(config: ArazasKonfig, modositotta: string, mit: string): Promise<VerzioMeta> {
    return irKonfig(ARAK_KULCS, config, modositotta, mit);
}

export async function betoltSzovegek(): Promise<SzovegKonfig> {
    return olvasKonfig(SZOVEGEK_KULCS, SEED_SZOVEGEK);
}

export async function mentsdSzovegek(config: SzovegKonfig, modositotta: string, mit: string): Promise<VerzioMeta> {
    return irKonfig(SZOVEGEK_KULCS, config, modositotta, mit);
}

export async function betoltKapcsolok(): Promise<KapcsoloKonfig> {
    return olvasKonfig(KAPCSOLOK_KULCS, SEED_KAPCSOLOK);
}

export async function mentsdKapcsolok(config: KapcsoloKonfig, modositotta: string, mit: string): Promise<VerzioMeta> {
    return irKonfig(KAPCSOLOK_KULCS, config, modositotta, mit);
}

export const KONFIG_KULCSOK = { arak: ARAK_KULCS, szovegek: SZOVEGEK_KULCS, kapcsolok: KAPCSOLOK_KULCS };
