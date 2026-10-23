// Generates lib/core/legal.dart from the storefront's legal content (frontend/src/shop/legal.ts),
// so web and app always show the same policies. Run from mobile/:
//   npx --prefix ../backend tsx tool/gen_legal.mts
import { writeFileSync } from 'node:fs';
import { DOCS, FAQS, LEGAL_ENTITY, LEGAL_UPDATED } from '../../frontend/src/shop/legal.ts';

// JSON escaping is valid inside a Dart double-quoted string; only `$` needs extra escaping.
const s = (v: string) => JSON.stringify(v).split('$').join('\\$');
const list = (a?: string[]) => (a ? `[${a.map(s).join(', ')}]` : 'null');

let out = '// GENERATED from frontend/src/shop/legal.ts by tool/gen_legal.mts. Do not edit by hand.\n\n';
out += 'class LegalSection {\n  const LegalSection(this.heading, {this.body, this.bullets});\n  final String heading;\n  final List<String>? body, bullets;\n}\n\n';
out += 'class LegalDoc {\n  const LegalDoc(this.slug, this.title, this.intro, this.sections);\n  final String slug, title, intro;\n  final List<LegalSection> sections;\n}\n\n';
out += `const legalUpdated = ${s(LEGAL_UPDATED)};\nconst legalEntityName = ${s(LEGAL_ENTITY.name)};\nconst legalEntityAddress = ${s(LEGAL_ENTITY.address)};\nconst legalEntityGstin = ${s(LEGAL_ENTITY.gstin)};\n\n`;
out += 'const legalDocs = <String, LegalDoc>{\n';
for (const [k, d] of Object.entries(DOCS)) {
  out += `  ${s(k)}: LegalDoc(${s(d.slug)}, ${s(d.title)}, ${s(d.intro)}, [\n`;
  for (const sec of d.sections) out += `    LegalSection(${s(sec.heading)}, body: ${list(sec.body)}, bullets: ${list(sec.bullets)}),\n`;
  out += '  ]),\n';
}
out += '};\n\nconst legalFaqs = <(String, String)>[\n';
out += FAQS.map(([q, a]) => `  (${s(q)}, ${s(a)}),`).join('\n');
out += '\n];\n';
writeFileSync(new URL('../lib/core/legal.dart', import.meta.url), out);
console.log('wrote lib/core/legal.dart');
