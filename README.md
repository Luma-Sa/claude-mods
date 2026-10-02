# claude-mods

Mods Claude Code de Luma-Sa.

## Activer dans un dépôt

Ajouter dans `.claude/settings.json` du dépôt :

```json
{
  "extraKnownMarketplaces": {
    "luma-mods": { "source": { "source": "github", "repo": "Luma-Sa/claude-mods" } }
  },
  "enabledPlugins": { "usage-band@luma-mods": true }
}
```

## Mods

- `usage-band` : bandeau au-dessus du prompt (limites 5h/7j, coût session/jour/mois, tokens).
