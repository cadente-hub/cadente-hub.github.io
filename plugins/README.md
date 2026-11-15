# Plugin index inputs (ADR 0077 §2.9)

The `plugin-index` workflow lists every public repository with the `cadente-plugin` topic whose
latest release has a valid `.cdb`, signs the list and publishes `public/plugins/index.json`.

- `blocklist.json`: `{"owners": [], "packages": ["owner/name"], "sha256": []}`. What is here
  does not enter the next index. There is no quarantine: a version that passes enters on its own.
- `revoked.json`: `[{"package": "owner/name", "version": "1.0.0", "sha256": "…", "reason": "…"}]`.
  Each field but `reason` is optional (no version means every version; a sha256 covers a file
  from any source). Every app switches the revoked version off, warns and offers to remove it.
