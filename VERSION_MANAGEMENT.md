# Versioning, CI, and Release Guide

## Runtime baseline

- Node.js 24 or newer
- pnpm 9.14.4 (declared in `package.json` and `.pnpm-version`)
- The committed `pnpm-lock.yaml` must be installed with `--frozen-lockfile`

Run the same quality gates as CI before opening a pull request:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test:ci
pnpm build:ci
```

`pnpm check` verifies formatting and confirms that all version-bearing files are
synchronized. `pnpm build:ci` builds every distribution target without modifying
tracked source files and validates the generated artifacts.

## Continuous integration

`.github/workflows/ci.yml` runs for every pull request targeting `dev`, every
push to `dev`, and manual dispatches. It provides these independent gates:

1. GitHub Actions workflow validation with `actionlint`.
2. Version and formatting checks on Ubuntu.
3. The complete unit-test suite on Ubuntu and Windows.
4. A native Safari Web Extension conversion on macOS.
5. A full multi-target build after all earlier gates pass.

Superseded runs on the same branch or pull request are cancelled automatically.
Successful non-PR builds are retained as short-lived smoke-build artifacts.

Repository administrators should protect `dev` and require the
`Build all distribution targets` check before merging. That job depends on the
workflow lint, quality, complete Ubuntu/Windows test matrix, and the macOS
Safari conversion, so requiring it also enforces every earlier gate.

## Version source of truth

`package.json` is the only version source. The following files must match it:

- `.env` (`REACT_APP_VERSION`)
- `public/manifest.json`
- `public/manifest.firefox.json`
- `public/manifest.thunderbird.json`

Use one of the version commands instead of editing all files manually:

```sh
pnpm version:patch
pnpm version:minor
pnpm version:major
pnpm version:set -- 2.1.0
```

To synchronize after a manual `package.json` edit, run:

```sh
pnpm sync-version
```

CI uses `pnpm check:version`, which is read-only and fails when metadata differs.

## Release preparation

The repository's default and integration branch is `dev`. Prepare releases on
that branch through a reviewed pull request:

1. Update the version with a `pnpm version:*` command.
2. Add the new release as the first `## vX.Y.Z` section in `CHANGELOG.md`.
3. Run `pnpm check`, `pnpm test:ci`, and `pnpm build+zip`.
4. Commit the version, changelog, and related product changes.
5. Merge the pull request into `dev` after CI passes.

`pnpm build+zip` is the local end-to-end release rehearsal. It builds Chrome,
Edge, Safari Web Extension output, Firefox, Thunderbird, web, and userscript
outputs; creates the iOS userscript variant and static rule files; generates
release ZIP files named `kiss-translator_vX.Y.Z_<target>.zip`; and verifies
their contents and versions. The native Safari Xcode conversion is verified by
the macOS CI job.

## Publishing a release

Create an annotated tag on the tested `dev` commit and push it:

```sh
git switch dev
git pull --ff-only origin dev
git tag -a v2.1.0 -m "Release v2.1.0"
git push origin v2.1.0
```

The release workflow rejects the tag unless all three values match exactly:

- Git tag: `v2.1.0`
- `package.json`: `2.1.0`
- First changelog heading: `## v2.1.0`

After validation, the workflow reruns quality checks and tests, builds and
verifies every release target, publishes or updates the GitHub release assets,
and deploys `build/web` through the official GitHub Pages workflow.

The workflow can also be dispatched manually for an existing tag. Reruns are
idempotent: existing release assets are replaced rather than duplicated.

## Relevant files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `.github/dependabot.yml`
- `src/scripts/sync-version.mjs`
- `src/scripts/build-task.mjs`
- `src/scripts/archive.mjs`
- `src/scripts/verify-build.mjs`
