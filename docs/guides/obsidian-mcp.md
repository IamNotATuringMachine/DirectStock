# Obsidian MCP Setup (Stand: 2026-02-17)

## Ziel
Ein einheitlicher Obsidian-MCP-Setup fuer dieses Projekt (`DirectStock`) in:
- Codex
- Claude Code
- Gemini CLI

## Verifizierte Basis in dieser Umgebung
- Obsidian Local REST API laeuft im Secure Mode auf `https://127.0.0.1:27124`.
- Deshalb ist fuer API-Zugriff der Stack `obsidian-api-mcp` korrekt.
- Empfehlung fuer Secure Mode:
  - `OBSIDIAN_PROTOCOL=https`
  - `OBSIDIAN_HOST=127.0.0.1`
  - `OBSIDIAN_PORT=27124`
  - `OBSIDIAN_VERIFY_SSL=false` (lokales self-signed Zertifikat)

## 1) Codex

```bash
codex mcp remove obsidian
codex mcp add obsidian \
  --env OBSIDIAN_API_KEY=<DEIN_KEY> \
  --env OBSIDIAN_PROTOCOL=https \
  --env OBSIDIAN_HOST=127.0.0.1 \
  --env OBSIDIAN_PORT=27124 \
  --env OBSIDIAN_VERIFY_SSL=false \
  -- uvx --from obsidian-api-mcp obsidian-api-mcp
```

Pruefen:

```bash
codex mcp get obsidian
```

## 2) Claude Code

```bash
claude mcp remove obsidian -s local
claude mcp add-json --scope local obsidian '{"type":"stdio","command":"uvx","args":["--from","obsidian-api-mcp","obsidian-api-mcp"],"env":{"OBSIDIAN_API_KEY":"<DEIN_KEY>","OBSIDIAN_PROTOCOL":"https","OBSIDIAN_HOST":"127.0.0.1","OBSIDIAN_PORT":"27124","OBSIDIAN_VERIFY_SSL":"false"}}'
```

Pruefen:

```bash
claude mcp list
claude mcp get obsidian
```

## 3) Gemini CLI

```bash
gemini mcp remove --scope user obsidian
gemini mcp add --scope user \
  -e OBSIDIAN_API_KEY=<DEIN_KEY> \
  -e OBSIDIAN_PROTOCOL=https \
  -e OBSIDIAN_HOST=127.0.0.1 \
  -e OBSIDIAN_PORT=27124 \
  -e OBSIDIAN_VERIFY_SSL=false \
  obsidian uvx --from obsidian-api-mcp obsidian-api-mcp
```

Pruefen:

```bash
gemini mcp list
```

## Wo die Config landet
- Codex: `~/.codex/config.toml`
- Claude Code (`--scope local`): `~/.claude.json` projektspezifisch
- Gemini CLI (`--scope user`): `~/.gemini/settings.json`

## Troubleshooting
- Wenn `Disconnected`: pruefen, ob Obsidian geoeffnet ist und das Local REST API Plugin laeuft.
- Endpoint-Test:

```bash
curl -k https://127.0.0.1:27124/
```

Bei laufendem Plugin muss JSON mit `service: "Obsidian Local REST API"` kommen.
