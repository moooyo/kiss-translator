# Project Instructions

## Repository boundaries

- Treat `moooyo/kiss-translator-m3` (`origin`) as the default writable repository and the default pull request destination.
- Treat `fishjar/kiss-translator` (`upstream`) as read-only unless the user explicitly approves the exact upstream mutation.
- Never create, update, comment on, review, label, close, merge, or otherwise modify upstream pull requests or issues without that approval.
- Never push branches, commits, tags, releases, or other changes to upstream without that approval.
- Read-only upstream inspection and fetching are allowed.
- Before any upstream mutation, state the exact repository, target, and action, then ask for explicit approval.
- A general request to push changes or open a pull request refers to `origin`, not `upstream`.
- Prepare and validate changes in the fork before proposing any upstream action.
- **`gh` resolves to `upstream` by default in this checkout.** `gh repo view` returns
  `fishjar/kiss-translator`, so any `gh` invocation without an explicit `-R moooyo/kiss-translator-m3`
  targets upstream. This is harmless for reads but means a mutating `gh` command would breach the
  boundary above without anything looking wrong. Always pass `-R` explicitly.
