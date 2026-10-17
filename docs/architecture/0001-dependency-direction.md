# Decision 0001: dependency direction and ownership

Status: proposed in [issue #2](https://github.com/dineshkorukonda/TerminalOne/issues/2).

## Context

The bootstrap opened a React window with window construction and application lifecycle in one Electron entry point. Native terminal sessions will introduce process ownership, shell discovery, and streaming. Those responsibilities need explicit boundaries before they grow.

## Decision

`src/main/index.ts` is the composition root. It chooses development or built content, supplies absolute asset paths, and manages application lifecycle. It wires concrete adapters to application ports when those ports become necessary. It does not own window configuration or terminal business rules.

`src/infrastructure/window/create-desktop-window.ts` owns the Electron window adapter. It receives content and preload paths explicitly, configures the window and its security defaults, and loads the chosen content. It does not choose development versus production or read environment variables. The extraction preserves the bootstrap's behavior.

`src/renderer/` owns React presentation and browser assets. `src/preload/` owns the sandboxed transport boundary and exposes only the named capabilities documented in `docs/ipc-security.md`. These are separate runtime entry points: neither imports main-process code or the other's implementation. Renderer capabilities use the typed bridge introduced in #3.

Reserve `src/domain/<feature>/` for framework-independent models, invariants, and domain ports. Reserve `src/application/<feature>/` for use cases and application ports, depending only on domain and application code. Infrastructure implements those ports; the composition root supplies implementations through explicit function arguments or constructors. Interfaces describe actual consumers' needs. Do not add a dependency injection container, generic service locator, placeholder use cases, or empty layer directories.

Only the window feature currently needs an infrastructure directory. Domain and application directories will appear with real behavior. Future platform adapters belong under `src/infrastructure/<feature>/`; React components stay with their renderer feature. Prefer named modules with clear ownership over catch-all utilities or barrel exports that hide dependencies. Cross-feature collaboration should use small, explicit contracts owned by the consuming core layer, rather than reaching into platform adapters.

## Enforced dependencies

- Domain imports domain code only. It has no third-party, Node, Electron, or React imports.
- Application imports application and domain code only, with the same platform restrictions.
- Infrastructure imports infrastructure, application, domain, and contract code, plus platform packages. It cannot import main, preload, or renderer implementations, or React.
- Main imports main, infrastructure, application, and domain code, plus platform packages. It cannot import renderer/preload implementations or React. Asset paths passed to Electron are not code imports.
- Preload imports preload modules, contracts, and Electron only, using static ES module imports. Its bundle remains sandbox-compatible.
- Renderer imports renderer modules, contracts, and browser-compatible packages. Node built-ins and Electron are forbidden.

Source modules must belong to one of these layers. Production source cannot import tests, tooling, documentation, or the independent website. Local restrictions check resolved paths, including type-only imports, re-exports, and literal dynamic imports; unresolved imports fail. Use relative imports in the core. CommonJS imports, TypeScript inline import types, and computed dynamic module specifiers are rejected so they cannot evade the checks. Use named `import type` statements instead. Common Node globals are also rejected in the core.

These are engineering dependency checks, not a runtime security boundary. Renderer isolation still depends on Electron's configuration. `src/contracts/` now holds inert IPC types/constants introduced in #3, shared only by the transport and presentation layers. Its lint policy forbids platform dependencies.

## Verification and limits

Run `npm run lint:boundaries` against production TypeScript source. `npm run test:architecture` exercises the real ESLint configuration with temporary targets and importers. It checks allowed inward imports and forbidden reverse, platform, type-only, re-export, and dynamic imports. It removes its fixtures and any otherwise-empty domain/application directories afterward. Run these checks sequentially with typecheck/build so temporary negative fixtures are not compiled.

`npm run typecheck`, `npm run build`, and `npm run test:smoke` continue to verify the desktop application. Broad lint/formatting policy belongs to #4, IPC/security work to #3, and CI integration to #6. The website retains its own toolchain.

The flat ESLint configuration uses the TypeScript resolver and [import-x's resolved-path restrictions](https://github.com/un-ts/eslint-plugin-import-x/blob/master/docs/rules/no-restricted-paths.md). Its dependency list is explicit so new edges require a reviewable policy change.
