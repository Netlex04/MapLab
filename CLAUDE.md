- When implementing something, ALYWAYS look at the architecture in @docs/architecture first and keep it in mind!
- When creating new pages or components, ALYWAYS reference the design system @docs/design-system and consider using shadcn components @packages/ui
- Code must be production ready, no sketches

## Coding Guidelines
- **No machine-specific or absolute paths.** Import packages by bare name (`import x from 'pkg'`); resolve repo files relative to the current file (`import.meta.url` / `__dirname`). Never hardcode a path tied to one checkout (e.g. `/Users/<name>/...`).
- **Declare every dependency you import.** Any package referenced in code must be listed in the consuming package's `package.json`. Never rely on a transitively-installed or hoisted package being resolvable — it breaks on a clean install.
- **No hardcoded context-dependent values.** Values that vary per ECU / file / environment (file sizes, offsets, ROM sizes, URLs) belong in parameters or config, not as literals. Reserve literals for true constants.
- **Tooling must be portable.** Scripts must run unchanged in CI and on any teammate's machine — no assumptions about a specific OS, user, or install location. Sanity-check with `node --check` or a dry run before committing.