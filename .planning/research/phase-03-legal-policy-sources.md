# Phase 3 legal-policy research record

Access date for every source below: **2026-08-03**.

## Publication posture

The policies are written for the real pre-launch state of Liiiraa Boost and for the announced Windows 10/11 service. They are publishable product copy, not placeholders. Because no legal name, registration number, postal address, payment processor, or formal data-protection-officer appointment is documented in the project, the text does not invent any of them. Instead, it makes account activation and commercial checkout conditional on displaying the legally required provider/controller identification and transaction details. This keeps the public site truthful while preventing a sale before mandatory information exists.

The policies also distinguish present processing from announced features. Local desktop history, diagnostics, and recovery remain on the PC by default. Optional telemetry, cloud AI, and remote support diagnostics remain off until the user receives purpose-specific information and gives a separate consent. No text claims a certification, external audit, fixed security-response SLA, bounty, or absolute security.

## Brazilian law and ANPD guidance

### Lei Geral de Proteção de Dados Pessoais — LGPD

- Official text: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Applied topics: principles and transparency (arts. 6 and 9), lawful bases (arts. 7 and 11), children and adolescents (art. 14), termination and retention (arts. 15 and 16), data-subject rights (arts. 17–22), controller/processor duties and records (arts. 37–41), security and incident duties (arts. 46–49), international transfers (arts. 33–36), and consent withdrawal (art. 8 §5).
- Drafting consequence: each processing purpose states the data category, purpose, basis or basis criteria, retention criteria, sharing boundary, and user choice. Consent is reserved for genuinely optional telemetry, support diagnostics, and cloud AI; it is never inferred from browsing.

### ANPD guidance on cookies and personal-data protection

- Official publication: https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/guia-orientativo-cookies-e-protecao-de-dados-pessoais.pdf/view
- Applied topics: purpose limitation, necessity, transparency, distinction between strictly necessary and optional cookies, granular consent where consent is the basis, ability to reject non-essential cookies, and easy withdrawal.
- Drafting consequence: the Essential Storage Policy identifies necessary locale/session/security storage separately. The product does not show a performative cookie banner while only necessary storage is active. Any later analytics, advertising, or cross-site tracking must remain off until the policy and interface identify it and provide a real reject/withdraw choice.

### ANPD guidance on legitimate interest

- Official publication hub: https://www.gov.br/anpd/pt-br/documentos-e-publicacoes
- Applied topic: legitimate interest requires a purpose, necessity, balancing/safeguards, transparency, and an objection channel; it is not a catch-all basis.
- Drafting consequence: security and service-delivery processing is described narrowly and remains subject to a documented balancing assessment before production activation.

### Marco Civil da Internet — Law 12,965/2014

- Official text: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Applied topics: privacy, information and consent duties, application-provider records, security, access to records, and the six-month application-access-log rule when art. 15 applies.
- Drafting consequence: the privacy policy states that application access records are retained for six months only where art. 15 applies, protected and separated from optional product telemetry. Additional retention requires a lawful need or order.

### Decree 8,771/2016 (Marco Civil regulation)

- Official text: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2016/decreto/d8771.htm
- Applied topics: security standards, restricted access to stored data, authentication of access, inventory of access, encryption or equivalent protection, and deletion after the retention period.
- Drafting consequence: security copy commits to least privilege, access records, secret redaction, purpose-limited retention, and safe deletion without claiming that an unaudited control is certified.

### Consumer Protection Code — Law 8,078/1990

- Official consolidated text: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Applied topics: clear and adequate information, binding offers, protection against misleading claims, service/product quality, contractual transparency, non-waivable consumer protections, and the seven-day statutory withdrawal right for remote contracting (art. 49).
- Drafting consequence: performance gains are never guaranteed; price, renewal, device restrictions, cancellation, refund, and material limitations must appear before confirmation. The announced full refund within seven days of the first subscription does not reduce any broader mandatory right.

### Brazilian e-commerce decree — Decree 7,962/2013

- Official text: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm
- Applied topics: prominent supplier identification, clear offer conditions, contract summary before purchase, error correction, confirmation, support, security, and facilitated withdrawal.
- Drafting consequence: checkout is contractually blocked until the supplier's legal identity, registration/address where applicable, final price, payment operator, renewal, cancellation, and withdrawal channel are displayed. The policy does not invent these details during pre-launch.

## International privacy baseline

### EU General Data Protection Regulation — Regulation (EU) 2016/679

- Official text: https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng
- Applied topics: principles (art. 5), lawful bases (art. 6), consent (art. 7), information duties (arts. 12–14), data-subject rights (arts. 15–22), privacy by design/default (art. 25), processor governance (art. 28), records and security (arts. 30 and 32), breach duties (arts. 33–34), and international transfers (Chapter V).
- Drafting consequence: the English policy preserves the same purpose ledger and rights as PT-BR, uses retention criteria where an exact period is not yet lawfully confirmed, and conditions international processing on identifying destinations, recipients, safeguards, and transfer mechanisms before activation.

### EDPB Guidelines 05/2020 on consent

- Official page: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en
- Applied topics: freely given, specific, informed and unambiguous consent; granular choices; no pre-ticked or silent consent; easy withdrawal; and avoiding conditionality for unnecessary processing.
- Drafting consequence: telemetry, support diagnostic upload, and personalized cloud AI are separate opt-ins and may be withdrawn without losing Free safety, history, restoration, documentation, or essential account functions.

### ePrivacy Directive 2002/58/EC, as amended

- Official text: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219
- Applied topic: storing or accessing information on terminal equipment generally requires clear information and consent, except where strictly necessary to transmit a communication or provide a service explicitly requested by the user.
- Drafting consequence: locale, session, anti-forgery, and security storage are explained as essential; optional analytics/advertising cannot reuse that exception.

## Security and vulnerability disclosure baselines

### CISA Vulnerability Disclosure Policy Template

- Official resource: https://www.cisa.gov/resources-tools/resources/vulnerability-disclosure-policy-template
- Applied topics: explicit scope, safe testing rules, a clear reporting channel, minimum data exposure, coordinated disclosure, response expectations, and limited good-faith authorization.
- Drafting consequence: the Responsible Disclosure Policy limits authorization to identified Liiiraa Boost assets and compliant research, excludes destructive activity and third-party systems, and promises neither a fixed remediation deadline nor payment.

### CERT/CC Vulnerability Disclosure Guidance

- Official resource: https://vuls.cert.org/confluence/display/Wiki/Vulnerability+Disclosure+Guidance
- Applied topics: reproducible reporting, coordination, minimizing harm, protecting affected users, and disclosing only after remediation coordination or a justified safe window.
- Drafting consequence: reports request minimum proof, versions, steps, impact, and a secure return channel; secrets and unrelated personal data must not be submitted.

### ISO/IEC 29147 and ISO/IEC 30111

- Official ISO pages: https://www.iso.org/standard/72311.html and https://www.iso.org/standard/69725.html
- Applied topics: receiving and coordinating vulnerability reports (29147) and handling/remediating vulnerabilities through a repeatable process (30111).
- Drafting consequence: the security and disclosure texts use intake, triage, validation, remediation, communication, and closure as process concepts. They do **not** claim ISO certification, conformity assessment, audit, or implementation maturity.

## Product facts carried into the final policies

- Windows 10/11 desktop app; the website does not deeply inspect a PC.
- Local-first diagnostics, optimization history, and restoration.
- No arbitrary remotely supplied scripts or general-purpose privileged registry/file/service commands.
- Free Essential Mode: no trial, card, ads, or artificial daily limits; manual safe optimization, one active profile, diagnostics/benchmark, history and restoration.
- Premium Competitive Mode: hardware calibration, advanced optimization, unlimited profiles, automatic per-game activation, advanced comparisons, personalized assistance, and priority support.
- One Premium subscription activates one PC. Device identity is derived and protected; raw HWID is not stored. A transfer/reset is normally available once every 30 days, with legitimate exceptions reviewed by support. Reinstallation and minor upgrades do not consume a reset; a motherboard-level change normally creates a new device.
- Premium can operate offline for up to 30 days before falling back to Free; history and restoration remain accessible.
- Announced launch prices: R$ 29.90 monthly or R$ 249.90 annually; US$ 6.99 monthly or US$ 59.99 annually. Card supports monthly/annual; Pix is annual in Brazil; no boleto at launch.
- Cancellation at any time preserves access through the paid cycle. A full refund is announced within seven days of the first subscription, without reducing mandatory consumer rights.
- Optional telemetry, cloud AI, and support diagnostic uploads require distinct, purpose-bound consent. Personal files, passwords, browsing history, and high-frequency game-time telemetry are excluded by default.

## Items that must be completed before activating the affected feature

These are operational launch gates, not wording placeholders in the public policy:

1. Display the supplier/controller's formal legal identity, registration and address wherever legally required before account collection or checkout.
2. Name actual hosting, identity, payment, support, analytics, and AI processors before they receive personal data; record their purpose, location, retention terms, subprocessors, and transfer safeguards.
3. Publish the production retention schedule and implement deletion/anonymization jobs before optional cloud processing begins.
4. Verify that the email channels shown in the policies are provisioned, monitored, authenticated, and protected against impersonation.
5. Bind checkout copy and receipts to the final payment operator, tax treatment, renewal mechanics, and legally required withdrawal workflow.
6. Validate security statements against the implemented production architecture. No certification, audit, bounty, or SLA may be inferred from these policy pages.
