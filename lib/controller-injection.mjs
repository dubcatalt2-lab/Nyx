import { readFileSync } from 'node:fs';
import { tokenizer } from 'acorn';

// The repository owns this runtime. npm supplies only the other controller files.
export const controllerInjectionPath = new URL('../controller/controller.inject.js', import.meta.url);
export function repositoryControllerInjection() {
  const source = readFileSync(controllerInjectionPath, 'utf8');
  // Link Zaka's public engine names to the pinned engine before the production
  // runtime-name pass links both sides again. Internal identifiers stay intact.
  const hooks = new Map([
    ['$studyj3t', '$scramjet'], ['$studyj3tController', '$scramjetController'],
    ['studyj3tCLIENT', 'SCRAMJETCLIENT'], ['studyj3tCLIENTNAME', 'SCRAMJETCLIENTNAME'],
    ...['Client', 'FetchHandler', 'FetchTrackedClient', 'Headers']
      .map(suffix => ['studyj3t' + suffix, 'Scramjet' + suffix]),
  ]);
  let linked = '', end = 0;
  for (const token of tokenizer(source, { ecmaVersion: 'latest' })) {
    if (token.type.label !== 'name' || !hooks.has(token.value)) continue;
    linked += source.slice(end, token.start) + hooks.get(token.value);
    end = token.end;
  }
  return (linked + source.slice(end)).replace(/^\/\/# sourceMappingURL=.*$/gm, '');
}
