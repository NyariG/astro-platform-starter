function szoveg(node) {
    if (node.type === 'text') return node.value;
    return (node.children ?? []).map(szoveg).join('');
}

export function ekezetmentesSlug(bemenet) {
    return bemenet
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

export default function rehypeEkezetmentesId() {
    return (fa) => {
        const hasznalt = new Map();
        const bejar = (node) => {
            if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
                const alap = ekezetmentesSlug(szoveg(node)) || 'fejezet';
                const db = hasznalt.get(alap) ?? 0;
                hasznalt.set(alap, db + 1);
                node.properties = { ...node.properties, id: db ? `${alap}-${db}` : alap };
            }
            (node.children ?? []).forEach(bejar);
        };
        bejar(fa);
    };
}
