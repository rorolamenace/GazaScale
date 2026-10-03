# Données vivantes de GazaScale

Cette branche ne contient que des données, lues par le site à chaque visite (nginx les sert sous `/live/`).
Les modifier ne redéploie pas l'application.

- `manifest.json` : bilan OCHA en cours (`toll`) et jeux de populations remplacés (`datasets`).
- `brand/partage.png`, `brand/partage-en.png` : images de partage (réseaux sociaux).

Mises à jour automatiques :
- bilan : `.github/workflows/live-toll.yml` (branche main), quatre fois par jour ;
- populations : routine annuelle (voir `tools/live/README.md` sur main).
