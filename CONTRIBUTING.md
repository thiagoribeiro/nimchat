# Contributing

Issues and pull requests are welcome.

```sh
npm ci
npm test
npm run typecheck
```

- Shared logic belongs in `packages/` (`sdk`, `brian`, `i18n`); keep `apps/web` and `apps/mobile` thin.
- Every user-visible string goes through `t()` from `@nimchat/i18n`, in English, with a pt-BR entry in `packages/i18n/src/pt-BR.ts`.
- BRIAN schemas in `packages/brian/schemas` are copies of the [BRIAN](https://github.com/thiagoribeiro/brian) schemas. Change them there first, then run `npm run schemas --workspace @nimchat/brian` to regenerate `src/validators.js`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/).
- By contributing you agree that your contributions are licensed under the Apache License 2.0.

Security issues: see [SECURITY.md](SECURITY.md).
