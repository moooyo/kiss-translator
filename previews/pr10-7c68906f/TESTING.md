# Testing coverage

The source commit previously passed 39 related Jest suites (534 tests), changed-file Prettier checks, and production builds in the isolated remote test-env environment. The source files in the published build are checked against the exact Git archive before and after compilation.

This artifact run builds Chrome, Firefox, and web/userscript with CI=true. ZIP structure, CRC integrity, entry files, manifest equality, versions, userscript metadata, and matching settings URLs are checked remotely. The standalone script and the script in the website package must be byte-identical.

Earlier real Chromium 153 checks on this commit covered the 396 x 467 default toolbar popup, Advanced options disclosure, text submission and continued editing, standalone-window and normal-tab close behavior, narrow Selection Shadow DOM layouts, and unavailable-page wording. These checks do not establish full runtime compatibility with every browser, translation provider, or userscript manager. Firefox is provided as an unsigned temporary test package.

## Suggested checks

- Open the default toolbar popup and expand Advanced options. Confirm that all moved controls remain reachable.
- Compare the selection panel, popup text tab, and separate window. Try narrow widths, light/dark mode, service selection, editing, copying, and reading aloud.
- Open the text window both as a separate window and as a normal tab; closing it should only close its own tab.
- Open a browser-restricted page. The popup should show the new availability explanation and retain the text translation entry.

This PR intentionally leaves inherited upstream navigation invalidation, page-action confirmation/rollback, and child-frame capability handling unchanged.
