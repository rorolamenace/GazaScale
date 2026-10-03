# Données vivantes

Le site lit `/live/manifest.json` à chaque visite. nginx relaie `/live/` vers la branche `live-data`
du dépôt (`deploy/nginx.conf`), avec un cache de 10 minutes et une copie de secours si GitHub ne répond pas.
Modifier `live-data` met le site à jour **sans redéploiement**.

## Bilan OCHA

`.github/workflows/live-toll.yml` tourne quatre fois par jour :

1. `tools/live/fetch-toll.mjs` cherche la dernière fiche « Reported impact snapshot | Gaza Strip »,
   lit le PDF et met à jour `toll` dans `manifest.json` ;
2. `tools/og/render.mjs` redessine `brand/partage.png` et `brand/partage-en.png` ;
3. le tout est poussé sur `live-data`.

En cas de lecture impossible (mise en page changée, chiffre ambigu), rien n'est publié et un ticket
« Bilan OCHA : mise à jour automatique impossible » est ouvert. Pour corriger à la main, modifier
`manifest.json` sur la branche `live-data` (date, killed, injured, source).

Le site garde des chiffres de secours écrits dans la page (`dist/live.js`, `tools/toll.json`) ; ils ne
servent que si `/live/` est injoignable.

## Populations

Voir `tools/live/update-populations.py` et `.github/workflows/live-populations.yml`.
