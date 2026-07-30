const BASE = (process.argv[2] || '').replace(/\/+$/, '');
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const PATH = process.env.TELEGRAM_WEBHOOK_PATH;

if (!BASE) {
    console.error('Használat: TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... TELEGRAM_WEBHOOK_PATH=... node scripts/telegram-setwebhook.mjs https://nyariterv.hu');
    process.exit(1);
}
if (!TOKEN || !SECRET || !PATH) {
    console.error('Hiányzó env: TELEGRAM_BOT_TOKEN / TELEGRAM_WEBHOOK_SECRET / TELEGRAM_WEBHOOK_PATH');
    process.exit(1);
}

const url = `${BASE}/api/telegram/${PATH}`;

async function main() {
    const valasz = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            url,
            secret_token: SECRET,
            allowed_updates: ['message', 'callback_query'],
            drop_pending_updates: true
        })
    });
    const json = await valasz.json();
    console.log(`setWebhook → ${url}`);
    console.log(JSON.stringify(json, null, 2));
    process.exit(json.ok ? 0 : 1);
}

main();
