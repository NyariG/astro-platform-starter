import { olvasKonfig, irKonfig, type VerzioMeta } from './config-store';
import type { Coupon } from './coupons';

const KUPONOK_KULCS = 'config/kuponok';

export const SEED_KUPONOK: Coupon[] = [];

export async function betoltKuponok(): Promise<Coupon[]> {
    return olvasKonfig(KUPONOK_KULCS, SEED_KUPONOK);
}

export async function betoltKuponokBiztonsagos(): Promise<Coupon[]> {
    try {
        return await betoltKuponok();
    } catch {
        return [];
    }
}

export async function mentsdKuponok(kuponok: Coupon[], modositotta: string, mit: string): Promise<VerzioMeta> {
    return irKonfig(KUPONOK_KULCS, kuponok, modositotta, mit);
}
