import { CEG } from '../data/ceg';

export type Morzsa = { nev: string; utvonal: string };
export type GyikElem = { kerdes: string; valasz: string };

export function kanonikusUrl(utvonal: string): string {
    const veggel = utvonal.endsWith('/') ? utvonal : `${utvonal}/`;
    return new URL(veggel, CEG.url).href;
}

export function jsonLd(adat: unknown): string {
    return JSON.stringify(adat).replace(/</g, '\\u003c');
}

export function szervezetSema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'ProfessionalService',
        '@id': `${CEG.url}/#szervezet`,
        name: CEG.nev,
        legalName: CEG.jogiNev,
        url: `${CEG.url}/`,
        logo: `${CEG.url}/images/nt-logo.png`,
        image: `${CEG.url}/images/og-nyariterv.png`,
        telephone: CEG.telefon.replace(/\s/g, ''),
        email: CEG.email,
        address: {
            '@type': 'PostalAddress',
            streetAddress: CEG.utca,
            postalCode: CEG.iranyitoszam,
            addressLocality: CEG.varos,
            addressCountry: 'HU'
        },
        areaServed: [
            { '@type': 'Country', name: 'Magyarország' },
            { '@type': 'AdministrativeArea', name: 'Győr-Moson-Sopron vármegye' }
        ],
        knowsAbout: ['Épületgépészeti tervezés', 'Energetikai tanúsítás', 'Hőszivattyús rendszerek']
    };
}

export function webhelySema() {
    return {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        '@id': `${CEG.url}/#webhely`,
        name: CEG.nev,
        url: `${CEG.url}/`,
        inLanguage: 'hu-HU',
        publisher: { '@id': `${CEG.url}/#szervezet` }
    };
}

export function szolgaltatasSema(szolgaltatas: { nev: string; leiras: string; utvonal: string; terulet: string[] }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Service',
        name: szolgaltatas.nev,
        description: szolgaltatas.leiras,
        url: kanonikusUrl(szolgaltatas.utvonal),
        provider: { '@id': `${CEG.url}/#szervezet` },
        areaServed: szolgaltatas.terulet.map((nev) => ({ '@type': 'Place', name: nev }))
    };
}

export function morzsaSema(morzsak: Morzsa[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: morzsak.map((morzsa, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: morzsa.nev,
            item: kanonikusUrl(morzsa.utvonal)
        }))
    };
}

export function gyikSema(elemek: readonly GyikElem[]) {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: elemek.map((elem) => ({
            '@type': 'Question',
            name: elem.kerdes,
            acceptedAnswer: { '@type': 'Answer', text: elem.valasz }
        }))
    };
}

export function cikkSema(cikk: { cim: string; leiras: string; utvonal: string; megjelent: Date; frissitve?: Date; kep?: string; szerzo: { nev: string; beosztas: string } }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: cikk.cim,
        description: cikk.leiras,
        mainEntityOfPage: kanonikusUrl(cikk.utvonal),
        datePublished: cikk.megjelent.toISOString(),
        dateModified: (cikk.frissitve ?? cikk.megjelent).toISOString(),
        inLanguage: 'hu-HU',
        image: cikk.kep ? new URL(cikk.kep, CEG.url).href : `${CEG.url}/images/og-nyariterv.png`,
        author: {
            '@type': 'Person',
            name: cikk.szerzo.nev,
            jobTitle: cikk.szerzo.beosztas,
            url: `${CEG.url}/`,
            worksFor: { '@id': `${CEG.url}/#szervezet` }
        },
        publisher: { '@id': `${CEG.url}/#szervezet`, '@type': 'Organization', name: CEG.nev }
    };
}
