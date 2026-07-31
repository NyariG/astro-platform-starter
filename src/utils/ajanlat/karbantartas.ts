import { auditHozzaad, listaKerelmek, patchRequest } from './store';
import { betoltKuponokBiztonsagos } from './kupon-store';
import { kuponNormalizal, kuponTeljesKod } from './coupons';
import { listAdmins } from './telegram-store';
import { sendMessage, telegramKonfiguralva } from './telegram';

const LEJARAT_NAP = 90;
const KUPON_ELORE_NAP = 3;
const NAP_MS = 24 * 60 * 60 * 1000;

async function ertesitsAdminokat(szoveg: string): Promise<void> {
    if (!telegramKonfiguralva()) return;
    const adminok = await listAdmins();
    for (const admin of adminok) {
        try {
            await sendMessage(admin.chatId, szoveg);
        } catch (hiba) {
            console.error('[karbantartas] admin-értesítés sikertelen', { chatId: admin.chatId, uzenet: hiba instanceof Error ? hiba.message : String(hiba) });
        }
    }
}

export async function futtatKarbantartast(): Promise<{ lejartAjanlat: number; lejaroKupon: number }> {
    const most = Date.now();

    const rekordok = await listaKerelmek(500);
    let lejartAjanlat = 0;
    for (const r of rekordok) {
        const kor = most - new Date(r.createdAt).getTime();
        if ((r.status === 'sent' || r.status === 'megtekintve') && kor > LEJARAT_NAP * NAP_MS) {
            await patchRequest(r.id, { status: 'lejart' });
            await auditHozzaad(r.id, 'rendszer', `automatikus lejárat (${LEJARAT_NAP} napnál régebbi)`);
            lejartAjanlat += 1;
        }
    }
    if (lejartAjanlat > 0) {
        await ertesitsAdminokat(`⏰ <b>Automatikus lejárat</b>\n${lejartAjanlat} ajánlat „lejárt" állapotba került (${LEJARAT_NAP} napnál régebbi).`);
    }

    const kuponok = await betoltKuponokBiztonsagos();
    const maStr = new Date(most).toISOString().slice(0, 10);
    const kuszob = new Date(most + KUPON_ELORE_NAP * NAP_MS).toISOString().slice(0, 10);
    const lejaroak = kuponok.filter((k) => k.aktiv && k.ervenyesIg && k.ervenyesIg >= maStr && k.ervenyesIg <= kuszob);
    if (lejaroak.length > 0) {
        const sorok = lejaroak.map((k) => `• <code>${kuponNormalizal(kuponTeljesKod(k))}</code> — lejár: ${k.ervenyesIg}`);
        await ertesitsAdminokat(`🏷️ <b>Hamarosan lejáró kuponok</b>\n${sorok.join('\n')}`);
    }

    return { lejartAjanlat, lejaroKupon: lejaroak.length };
}
