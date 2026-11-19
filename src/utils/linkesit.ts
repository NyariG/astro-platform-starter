const MINTA = /([a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+)|(https?:\/\/[^\s<]+)|\b((?:[a-z0-9-]+\.)+(?:hu|com|org|eu|net)(?:\/[^\s<]*)?)/gi;
const VEGI_IRASJEL = /[.,;:!?)]+$/;

function escape(szoveg: string): string {
    return szoveg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function linkesit(szoveg: string): string {
    let eredmeny = '';
    let utolso = 0;
    for (const talalat of szoveg.matchAll(MINTA)) {
        const index = talalat.index ?? 0;
        let nyers = talalat[0];
        const vege = nyers.match(VEGI_IRASJEL)?.[0] ?? '';
        nyers = nyers.slice(0, nyers.length - vege.length);
        eredmeny += escape(szoveg.slice(utolso, index));
        if (talalat[1]) {
            eredmeny += `<a href="mailto:${escape(nyers)}">${escape(nyers)}</a>`;
        } else {
            const href = talalat[2] ? nyers : `https://${nyers}`;
            const kulso = !/^(https?:\/\/)?(www\.)?nyariterv\.hu/i.test(nyers);
            eredmeny += `<a href="${escape(href)}"${kulso ? ' target="_blank" rel="noopener"' : ''}>${escape(nyers)}</a>`;
        }
        eredmeny += escape(vege);
        utolso = index + talalat[0].length;
    }
    return eredmeny + escape(szoveg.slice(utolso));
}
