import { readFileSync } from 'node:fs';

const locales = ['en', 'pt-BR'];

const evidenceSources = [
  {
    id: 'PHASE3-D90',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-90',
    scope: 'Free Essential Mode, local operation, history, and restoration',
  },
  {
    id: 'PHASE3-D92',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-92',
    scope: 'launch pricing, payment methods, cancellation, and refund decision',
  },
  {
    id: 'PHASE3-D93',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-93',
    scope: 'device identity, reset window, offline period, and Premium fallback',
  },
  {
    id: 'PHASE3-D94',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-94',
    scope: 'support priority and response expectations',
  },
  {
    id: 'PHASE3-D95',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-95',
    scope: 'local-first data, optional telemetry, diagnostics, and cloud AI',
  },
  {
    id: 'PHASE3-D96',
    reference: '.planning/phases/03-complete-web-experience/03-CONTEXT.md#D-96',
    scope: 'web and desktop responsibility boundary',
  },
  {
    id: 'PROJECT-CONSTRAINTS',
    reference: '.planning/PROJECT.md',
    scope: 'product, platform, security, privacy, accessibility, and commercial constraints',
  },
  {
    id: 'STACK-SECURITY',
    reference: '.planning/research/STACK.md',
    scope: 'approved security, signing, update, isolation, and local-first architecture',
  },
  {
    id: 'PLAN-03-46-PREFLIGHT',
    reference: '.planning/phases/03-complete-web-experience/03-46-PLAN.md',
    scope: 'publication, provider identity, contact, artifact, and evidence preflight',
  },
  {
    id: 'TEMPORAL-FUTURE-GATE',
    reference: '.planning/ROADMAP.md',
    scope: 'explicit marker that the linked assertion describes a gated future capability',
  },
  {
    id: 'LAW-LGPD',
    reference: 'https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm',
    scope: 'Brazilian data protection principles, transparency, rights, security, and transfers',
  },
  {
    id: 'LAW-CDC',
    reference: 'https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm',
    scope: 'consumer information, offers, withdrawal, warranties, and mandatory remedies',
  },
  {
    id: 'LAW-ECOMMERCE-BR',
    reference: 'https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm',
    scope: 'supplier identification, checkout information, support, and withdrawal',
  },
  {
    id: 'GUIDE-ANPD-COOKIES',
    reference:
      'https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/view',
    scope: 'necessary storage, optional cookies, consent, rejection, and withdrawal',
  },
  {
    id: 'LAW-GDPR',
    reference: 'https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng',
    scope: 'international privacy transparency, rights, security, and transfers',
  },
  {
    id: 'GUIDE-CISA-VDP',
    reference:
      'https://www.cisa.gov/resources-tools/resources/vulnerability-disclosure-policy-template',
    scope: 'responsible disclosure scope, safe testing, reporting, and coordination',
  },
];

const futurePattern =
  /\b(?:before|if|may|shall|will|would|when|after preflight|antes|ap[oó]s o preflight|caso|dever[aá]|dever[aã]o|estar[aá]|estar[aã]o|exigir[aá]|exigir[aã]o|far[aá]|far[aã]o|haver[aá]|poder[aá]|poder[aã]o|receber[aá]|receber[aã]o|ser[aá]|ser[aã]o|ter[aá]|ter[aã]o)\b/iu;

const splitSentences = (value) =>
  value
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const collectNarratives = (policies) => {
  const narratives = [];
  for (const document of policies.documents) {
    narratives.push([`document:${document.kind}:summary`, document.summary]);
    for (const section of document.sections) {
      narratives.push([`document:${document.kind}:section:${section.id}`, section.body]);
    }
    if (document.kind !== 'privacy') continue;
    const details = document.privacyDetails;
    narratives.push([
      'document:privacy:controller:formal-identity',
      details.controller.formalIdentityStatus,
    ]);
    for (const practice of details.practices) {
      for (const field of ['purpose', 'data', 'legalBasis', 'retention', 'sharing', 'revocation']) {
        narratives.push([`document:privacy:practice:${practice.id}:${field}`, practice[field]]);
      }
    }
    narratives.push(['document:privacy:processors', details.processors]);
    narratives.push(['document:privacy:international-transfers', details.internationalTransfers]);
    details.rights.forEach((right, index) => {
      narratives.push([`document:privacy:right:${index + 1}`, right]);
    });
  }
  narratives.push(['disclosure:summary', policies.disclosure.summary]);
  narratives.push(['disclosure:response', policies.disclosure.response]);
  policies.disclosure.scope.forEach((entry, index) => {
    narratives.push([`disclosure:scope:${index + 1}`, entry]);
  });
  policies.disclosure.prohibitedContent.forEach((entry, index) => {
    narratives.push([`disclosure:prohibited:${index + 1}`, entry]);
  });
  return narratives;
};

const evidenceFor = (location) => {
  if (location.startsWith('document:privacy')) {
    return ['PHASE3-D95', 'PHASE3-D96', 'LAW-LGPD', 'LAW-GDPR'];
  }
  if (location.startsWith('document:terms:section:free-and-premium')) return ['PHASE3-D90'];
  if (
    location.startsWith('document:terms:section:device-license') ||
    location.startsWith('document:terms:section:offline-and-availability')
  ) {
    return ['PHASE3-D93', 'LAW-CDC'];
  }
  if (
    location.startsWith('document:terms:section:prices-and-payment') ||
    location.startsWith('document:terms:section:cancellation-and-refund')
  ) {
    return ['PHASE3-D92', 'LAW-CDC', 'LAW-ECOMMERCE-BR'];
  }
  if (location.startsWith('document:terms')) {
    return ['PROJECT-CONSTRAINTS', 'STACK-SECURITY', 'PLAN-03-46-PREFLIGHT', 'LAW-CDC'];
  }
  if (location.startsWith('document:storage')) {
    return ['PHASE3-D96', 'GUIDE-ANPD-COOKIES', 'LAW-LGPD', 'LAW-GDPR'];
  }
  if (location.startsWith('document:security')) {
    return ['PHASE3-D95', 'STACK-SECURITY', 'PLAN-03-46-PREFLIGHT'];
  }
  return ['PLAN-03-46-PREFLIGHT', 'GUIDE-CISA-VDP', 'LAW-LGPD'];
};

const sourcePolicies = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(`apps/web/src/content/public/policies.${locale}.json`, 'utf8')),
  ]),
);

const narratives = Object.fromEntries(
  locales.map((locale) => [locale, collectNarratives(sourcePolicies[locale])]),
);

if (narratives.en.length !== narratives['pt-BR'].length) {
  throw new Error('POLICY_CLAIM_LOCATION_PARITY');
}

const claimLedgers = { en: [], 'pt-BR': [] };
for (let locationIndex = 0; locationIndex < narratives.en.length; locationIndex += 1) {
  const [englishLocation, englishText] = narratives.en[locationIndex];
  const [portugueseLocation, portugueseText] = narratives['pt-BR'][locationIndex];
  if (englishLocation !== portugueseLocation) throw new Error('POLICY_CLAIM_LOCATION_PARITY');
  const sentencePairs = [splitSentences(englishText), splitSentences(portugueseText)];
  if (sentencePairs[0].length !== sentencePairs[1].length) {
    throw new Error(`POLICY_CLAIM_SENTENCE_PARITY:${englishLocation}`);
  }
  for (let sentenceIndex = 0; sentenceIndex < sentencePairs[0].length; sentenceIndex += 1) {
    const statements = [sentencePairs[0][sentenceIndex], sentencePairs[1][sentenceIndex]];
    const temporal = statements.some((statement) => futurePattern.test(statement))
      ? 'future'
      : 'current';
    const id = `${englishLocation}:${sentenceIndex + 1}`;
    for (const [index, locale] of locales.entries()) {
      claimLedgers[locale].push({
        id,
        location: englishLocation,
        statement: statements[index],
        temporal,
        evidenceIds:
          temporal === 'future'
            ? [...new Set([...evidenceFor(englishLocation), 'TEMPORAL-FUTURE-GATE'])]
            : evidenceFor(englishLocation),
      });
    }
  }
}

const requestedLocale = process.argv[2];
const outputLocales = requestedLocale === undefined ? locales : [requestedLocale];
if (!outputLocales.every((locale) => locales.includes(locale))) {
  throw new Error('POLICY_CLAIM_LOCALE_INVALID');
}

for (const locale of outputLocales) {
  const output = {
    schemaVersion: 1,
    locale,
    reviewedAt: '2026-08-03',
    reviewScope:
      'Every narrative sentence in Privacy, Terms, Essential Storage, Security, and Responsible Disclosure',
    evidenceSources,
    claims: claimLedgers[locale],
  };
  process.stdout.write(`@@POLICY_CLAIMS:${locale}@@\n${JSON.stringify(output, null, 2)}\n`);
}
