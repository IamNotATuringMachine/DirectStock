# CODEX.md

## Purpose
This file is a Codex compatibility adapter.

Codex natively uses `AGENTS.md` as the primary project instruction file. This file exists only for interoperability and local team clarity.

## Canonical Rule
- `AGENTS.md` is the source of truth.
- Nested `AGENTS.md` files apply to their directory scope.
- This file should stay short and tool-specific.

## Optional Codex Config Pattern
If your team uses fallback filenames, keep `AGENTS.md` first and add fallbacks in `~/.codex/config.toml`:

```toml
project_doc_fallback_filenames = ["CODEX.md"]
project_doc_max_bytes = 65536
```

Use fallbacks only for compatibility. Do not move core policy out of `AGENTS.md`.
