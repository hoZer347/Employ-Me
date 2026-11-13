# Style

House style for this repo, taken from its settled files. It overrides any
global default.

- Two-space indent, K&R braces, double quotes (single in `.cjs`), semicolons, and trailing commas
  in multi-line literals and call arguments.
- Each module opens with a `//` paragraph saying why it exists.
- Exported functions and non-obvious interface fields get `/** */`. Exported
  types do not need one.
- Constants are SCREAMING_CASE, functions and variables camelCase, types
  PascalCase.
- Files are kebab-case: `.ts` in `src`, `.mjs` or `.cjs` in `tools` and `test`.
- Static data objects are declared `as const`. Long files are split with
  `// --- Name ---` dividers.
- `node:` imports come before local ones.
- Tests use `import test from "node:test"` and `node:assert/strict`, and test
  names are plain-English claims.
- Line width is not a rule.
