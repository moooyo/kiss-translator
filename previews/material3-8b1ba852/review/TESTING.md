# Material 3 PR preview verification

Source: `8b1ba852773a13be928a7d164a914bba19084dda`.
Upstream comparison base: `4c8f09e8d7157131651d4f60f650d8414f4bc8b3`.

The full committed Jest suite ran on a fresh exact-source snapshot with Node.js 22.23.2 and matching dependency manifests on the remote test environment.

| Check | Result |
| --- | --- |
| Full Jest run | 130 suites: 128 passed, 2 failed; 1,886 tests: 1,884 passed, 2 failed |
| Explicit submission integration suite | 17 passed, including 6 LaTeX cases across Popup, selection and Playground with conversion on/off and streaming/final output |
| Merge-related formatting | Passed for all 10 checked files |
| Chrome, Firefox and userscript/web production builds | All passed with CI=true |
| Source identity | Exact archive matched before and after verification |

The full Jest command exits 1. Its two failed assertions were independently reproduced on the exact current upstream base:

- `src/libs/batchQueue.test.js`: the test expects serial default scheduling, while the unchanged implementation defaults to concurrency 10.
- `src/apis/trans.dict.test.js`: the test expects the old Chinese prompt label, while the unchanged fallback uses an English label.

Those two upstream suites ran 10 tests: 8 passed and the same 2 failed. Relevant source and test blobs match between base and preview; no additional failure was classified as inherited.

The final build was used for the accompanying screenshots with a disposable Chromium profile and default settings. Any visible sample translation is synthetic and its response is mocked for reproducible UI capture. Screenshots do not prove live provider availability.

Earlier installed Chrome acceptance covered page and Popup translation, selection/default dictionary, explicit input replacement, nested same-origin frames, dynamic open shadow content, settings round trips and YouTube bilingual playback/seeking. It is separate evidence from this final commit's full automated run. Credential-dependent requests, configured remote synchronization, Firefox runtime behavior, userscript-manager installation, audible TTS and the complete fullscreen/physical-shortcut matrix remain outside the completed acceptance scope.

The pull request discloses the remaining overview synchronization race and inherited favorite-word limitations. These preview builds are intended to support maintainer review, not to assert universal conformance or an all-green upstream baseline.
