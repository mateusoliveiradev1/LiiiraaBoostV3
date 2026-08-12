import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ajv2020 } from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const root = process.env.LIIIRAA_GENERATION_STAGING_ROOT ?? repositoryRoot;
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, 'contracts/generated/desktop/v1', name), 'utf8'));
const diagnostic = read('diagnostic-value.schema.json');
const hardwareEvidence = read('hardware-evidence.schema.json');
const shell = read('shell-message.schema.json');
const controlPlane = JSON.parse(
  fs.readFileSync(
    path.join(root, 'contracts/generated/control-plane/v1/control-plane-document.schema.json'),
    'utf8',
  ),
);
const web = JSON.parse(
  fs.readFileSync(path.join(root, 'contracts/generated/web/v1/web-document.schema.json'), 'utf8'),
);
const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  strictTypes: false,
  validateFormats: false,
  code: { esm: true, source: true },
});
ajv.addKeyword('x-liiiraa-generated');
const definitions = [
  ...Object.values(diagnostic.$defs),
  ...Object.values(hardwareEvidence.$defs),
  ...Object.values(shell.$defs),
  ...Object.values(controlPlane.$defs),
  ...Object.values(web.$defs),
];
const definitionsById = new Map(
  definitions.map((definition) => [definition.$id, definition]),
);
const registeredDefinitionIds = new Set();
const referencedDefinitionIds = (definition) => {
  const references = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (value === null || typeof value !== 'object') return;
    if (typeof value.$ref === 'string') references.add(value.$ref.split('#', 1)[0]);
    Object.values(value).forEach(visit);
  };
  visit(definition);
  return references;
};
const pendingDefinitions = [...definitionsById.values()];
while (pendingDefinitions.length > 0) {
  const readyDefinitions = pendingDefinitions.filter((definition) =>
    [...referencedDefinitionIds(definition)].every(
      (reference) =>
        reference.length === 0 ||
        !definitionsById.has(reference) ||
        registeredDefinitionIds.has(reference),
    ),
  );
  if (readyDefinitions.length === 0) {
    throw new Error(
      `Generated schema definitions contain an unresolved reference cycle: ${pendingDefinitions
        .map((definition) => definition.$id)
        .join(', ')}`,
    );
  }
  for (const definition of readyDefinitions) {
    if (ajv.getSchema(definition.$id) === undefined) ajv.addSchema(definition);
    registeredDefinitionIds.add(definition.$id);
    pendingDefinitions.splice(pendingDefinitions.indexOf(definition), 1);
  }
}
ajv.addSchema(web);
ajv.addSchema(controlPlane);
ajv.addSchema(hardwareEvidence);
const controlPlaneValidator = ajv.getSchema(controlPlane.$id);
if (controlPlaneValidator === undefined) {
  throw new Error('Generated control-plane validator is unavailable.');
}
const syntheticAccount = {
  schemaVersion: '1.0',
  kind: 'account-projection',
  aggregateVersion: '7',
  etag: 'account-etag-7',
  correlationId: 'control-plane-correlation',
  provenance: 'postgres-authority',
  accountId: 'account-0001',
  state: 'active',
  displayName: 'Synthetic account',
  emailRedacted: 's***@example.invalid',
  locale: 'pt-BR',
  createdAt: '2026-08-04T00:00:00Z',
  updatedAt: '2026-08-04T00:00:00Z',
};
const syntheticCommand = {
  schemaVersion: '1.0',
  kind: 'account-command',
  commandId: 'command-0001',
  accountId: 'account-0001',
  action: 'update-profile',
  expectedVersion: '7',
  correlationId: 'control-plane-correlation',
  requestedAt: '2026-08-04T00:00:00Z',
};
const syntheticConsent = {
  schemaVersion: '1.0',
  kind: 'diagnostic-consent',
  aggregateVersion: '2',
  etag: 'consent-etag-2',
  correlationId: 'control-plane-correlation',
  provenance: 'postgres-authority',
  consentId: 'consent-0001',
  accountId: 'account-0001',
  state: 'active',
  scopes: ['support-diagnostics'],
  purpose: 'Synthetic support diagnosis',
  grantedAt: '2026-08-04T00:00:00Z',
  expiresAt: '2026-08-04T01:00:00Z',
};
for (const valid of [syntheticAccount, syntheticCommand, syntheticConsent]) {
  if (!controlPlaneValidator(valid)) {
    throw new Error('Generated control-plane validator rejected the valid admission matrix.');
  }
}
const missingExpectedVersion = { ...syntheticCommand };
delete missingExpectedVersion.expectedVersion;
for (const invalid of [
  { ...syntheticAccount, state: 'SENSITIVE_UNKNOWN_STATE' },
  { ...syntheticAccount, provenance: 'fixture' },
  { ...syntheticAccount, accountId: 'x'.repeat(129) },
  missingExpectedVersion,
  { ...syntheticConsent, scopes: ['support-diagnostics', 'support-diagnostics'] },
]) {
  if (controlPlaneValidator(invalid)) {
    throw new Error('Generated control-plane validator admitted an invalid boundary vector.');
  }
}
const generatedCode = standaloneCode(ajv, {
  controlPlaneDocumentValidator: controlPlane.$id,
  diagnosticValueValidator: 'DiagnosticValue.json',
  hardwareEvidenceDocumentValidator: hardwareEvidence.$id,
  hostToRendererValidator: 'HostToRendererShellEvent.json',
  rendererToHostValidator: 'RendererToHostShellCommand.json',
  webDocumentValidator: web.$id,
});
const runtimeImports = [];
const code = generatedCode.replace(
  /const ([A-Za-z_$][\w$]*) = require\("([^"]+)"\)\.default;/gu,
  (_match, identifier, specifier) => {
    const runtimeModule = `${identifier}Module`;
    runtimeImports.push(
      `import * as ${runtimeModule} from '${specifier}.js';\n` +
        `const ${identifier} = typeof ${runtimeModule}.default === 'function'\n` +
        `  ? ${runtimeModule}.default\n` +
        `  : ${runtimeModule}.default.default;`,
    );
    return '';
  },
);
if (code.includes('require(')) {
  throw new Error('Ajv standalone output contains an unsupported CommonJS runtime import.');
}
fs.writeFileSync(
  path.join(root, 'packages/contracts-ts/src/generated/standalone-validators.js'),
  `/* generated by scripts/generate-standalone.mjs; do not edit */\n${[...new Set(runtimeImports)].join('\n')}\n${code}`,
);
fs.writeFileSync(
  path.join(root, 'packages/contracts-ts/src/generated/standalone-validators.d.ts'),
  `/* generated by scripts/generate-standalone.mjs; do not edit */
import type { ValidateFunction } from 'ajv';
import type {
  ControlPlaneDocument,
  DiagnosticValueJson,
  HardwareEvidenceDocument,
  HostToRendererShellEventJson,
  RendererToHostShellCommandJson,
  WebDocument,
} from './models.js';

export const controlPlaneDocumentValidator: ValidateFunction<ControlPlaneDocument>;
export const diagnosticValueValidator: ValidateFunction<DiagnosticValueJson>;
export const hardwareEvidenceDocumentValidator: ValidateFunction<HardwareEvidenceDocument>;
export const hostToRendererValidator: ValidateFunction<HostToRendererShellEventJson>;
export const rendererToHostValidator: ValidateFunction<RendererToHostShellCommandJson>;
export const webDocumentValidator: ValidateFunction<WebDocument>;
`,
);
