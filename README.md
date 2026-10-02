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

## Sessions cloud (claude.ai/code)

Les sessions cloud ignorent les plugins déclarés dans le `.claude/settings.json` d'un dépôt.
Il faut les installer depuis le **script de configuration** de l'environnement cloud :

1. claude.ai/code → icône nuage (nom de l'environnement) au-dessus de la zone de saisie → engrenage sur l'environnement.
2. Coller le contenu de [`cloud-setup.sh`](cloud-setup.sh) dans **Setup script**, enregistrer.
3. Ouvrir une nouvelle session : le mod est chargé, quel que soit le dépôt.

Le script tourne avant Claude Code, puis l'environnement est mis en cache (~7 jours).
Pour pousser une nouvelle version d'un mod dans le cloud : modifier la ligne `# version:` du script dans l'environnement.

## En local

```bash
claude plugin marketplace add "D:\Projets V2\MODS - CLI Statusline\claude-mods"
claude plugin install usage-band@luma-mods
```

Le catalogue local est chargé en place : une modification ici s'applique avec `/reload-plugins`.
