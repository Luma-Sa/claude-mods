#!/bin/bash
# Script de configuration des environnements cloud Claude Code (claude.ai/code).
# Installe les mods du catalogue Luma-Sa/claude-mods avant le lancement de Claude Code.
# Pour forcer la mise à jour des mods dans le cloud, change la ligne ci-dessous (le cache de l'environnement est reconstruit).
# version: 2

export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1

if ! command -v claude >/dev/null 2>&1; then
  echo "luma-mods: CLI claude introuvable, mods non installés"
  exit 0
fi

claude plugin marketplace add Luma-Sa/claude-mods || true
claude plugin marketplace update luma-mods || true
claude plugin install usage-band@luma-mods || true
exit 0
