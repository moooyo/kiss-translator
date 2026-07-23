# Versioning and Release Guide

## Runtime baseline

- Node.js 24 or newer
- pnpm 9.14.4 (pinned in `.pnpm-version`)
- The committed `pnpm-lock.yaml` must be installed with `--frozen-lockfile`

Install dependencies before running the release checks described below:

```sh
pnpm install --frozen-lockfile
```

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

`pnpm check:version` is read-only and fails when version metadata differs.

## Release preparation

The repository's default and integration branch is `dev`. Prepare releases on
that branch through a reviewed pull request:

1. Update the version with a `pnpm version:*` command.
2. Add the new release as the first `## vX.Y.Z` section in `CHANGELOG.md`.
3. Run `pnpm check`, `pnpm test:ci`, and `pnpm build+zip`.
4. Commit the version, changelog, and related product changes.
5. Merge the pull request into `dev` after review and the local release checks pass.

`pnpm build+zip` is the local end-to-end release rehearsal. It builds Chrome,
Edge, Safari Web Extension output, Firefox, Thunderbird, web, and userscript
outputs; creates the iOS userscript variant and static rule files; generates
release ZIP files named `kiss-translator_vX.Y.Z_<target>.zip`; and verifies
their contents and versions. Native Safari Xcode conversion requires macOS and
can be checked separately with `pnpm build:safari`.

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

The tagged source must also contain the current `releaseContract` marker from
`package.json`. This fail-closed check prevents the current workflow from
running against legacy tags whose build and archive behavior does not satisfy
the current release contract.

After validation, the workflow reruns quality checks and tests, builds and
verifies every release target, publishes or updates the GitHub release assets,
and publishes `build/web` by committing it to the `gh-pages` branch. Repository
Pages settings serve that branch; this repository does not use the official
GitHub Pages Actions deployment flow.

The workflow can also be dispatched manually for an existing compatible tag.
Reruns are idempotent: existing release assets are replaced rather than
duplicated. Manual dispatch publishes only the GitHub release and never updates
`gh-pages`, so rerunning an older compatible release cannot roll back the live
website. Legacy releases without the current contract marker are intentionally
rejected; arbitrary historical reconciliation belongs in a separate future
workflow.

## Relevant files

- `.github/workflows/release.yml`
- `src/scripts/sync-version.mjs`
- `src/scripts/build-task.mjs`
- `src/scripts/archive.mjs`
- `src/scripts/verify-build.mjs`
