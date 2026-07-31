import type { Config } from '@netlify/functions';
import { futtatKarbantartast } from '../../src/utils/ajanlat/karbantartas';

export default async (): Promise<Response> => {
    const eredmeny = await futtatKarbantartast();
    return new Response(JSON.stringify({ ok: true, ...eredmeny }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const config: Config = {
    schedule: '@daily'
};
