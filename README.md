# Gaza ici

Carte interactive pour comparer les 365 km² de la bande de Gaza aux territoires français. L’application affiche un contour géographique ou un cercle de même superficie, déplaçable et pivotable.

## Lancer en local

Node.js 18 ou plus récent, sans installation de dépendances :

```sh
node serve.mjs
```

Ouvrir http://127.0.0.1:4187. Les tuiles OpenStreetMap et les données communales hors Haute-Savoie nécessitent une connexion Internet.

## Fonctionnement

- Ouverture au sud de Genève, en mode cercle, avec les destructions visibles.
- Superficie conservée par projection azimutale équivalente ; rotation du contour dans un plan local.
- Panneau fermé pendant le déplacement, rouvert au relâchement. Croix et bouton de réouverture, affichage adapté aux petits écrans.
- Comparaison des superficies et populations par département ou région.
- Communes françaises touchées par la forme : sélection par proximité au centre, arrêt lorsque la population cumulée atteint le bilan humain. La dernière commune peut ne contribuer que pour une fraction de sa population. Si le cercle ne contient pas assez d’habitants, le manque est indiqué.
- Seules les communes retenues sont colorées. Le rouge est une équivalence démographique, pas une localisation de décès.

## Lire les chiffres

Les habitants d’une commune partiellement touchée sont pris comme référence sur la commune entière. Il ne s’agit pas d’une estimation fine de la population dans le cercle. Les communes françaises et suisses sont couvertes.

Le cercle intérieur traduit une proportion de structures détruites ou endommagées, et non une surface de terrain détruit. Les statistiques ont des dates distinctes, affichées dans l’interface et détaillées dans « Sources & méthode ».

Le bilan humain est un instantané : 73 922 morts palestiniens rapportés au 23 septembre 2026 par le ministère de la Santé de Gaza, repris par OCHA. Il ne constitue pas une estimation exhaustive des morts indirectes. Aucun chiffre ne se met à jour automatiquement.

## Sources et bibliothèques

- [OpenStreetMap](https://www.openstreetmap.org/copyright) : fond de carte, attribution conservée.
- [Leaflet 1.9.4](https://leafletjs.com/) et [Turf 7.2.0](https://turfjs.org/) : carte et calculs géographiques.
- [API Découpage administratif](https://geo.api.gouv.fr/) : communes, populations et surfaces. Haute-Savoie enregistrée le 29 septembre 2026 ; autres départements chargés à la demande et gardés en mémoire pendant la session.
- [france-geojson](https://github.com/gregoiredavid/france-geojson) : contours simplifiés des départements et régions.
- [Palestine geodata](https://github.com/sepans/palestine_geodata) : contour de Gaza, normalisé à 365 km².
- [PCBS](https://www.pcbs.gov.ps/statisticsIndicatorsTables.aspx?lang=en&table_id=1949) : populations datées.
- [UNOSAT, 11 octobre 2025](https://www.un.org/unispal/document/unosat-gaza-strip-damage-assessment-31oct25/) : structures détruites et endommagées.
- [OCHA, 23 septembre 2026](https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_23_September_2026.pdf) : bilan humain rapporté.

Les données et bibliothèques tierces restent soumises à leurs licences respectives.

## Structure

`dist/` contient le site statique prêt à servir. `app.js` gère les interactions, `geometry.js` les projections et `selection.js` l’arrêt de la sélection des communes. `.openai/hosting.json` identifie l’hébergement Sites existant ; il ne contient aucun secret.

Pour un autre hébergeur statique, servir le dossier `dist/`. Ce dépôt n’active pas automatiquement GitHub Pages.

## Suisse

Les 2 110 communes et 26 cantons de `dist/swiss.js` proviennent de © swisstopo, swissBOUNDARIES3D (janvier 2026). Populations OFS au 31 décembre 2024. Source : https://www.swisstopo.admin.ch/fr/modele-du-territoire-swissboundaries3d. Géométries LV95 converties en WGS84 et simplifiées à 20 m, coordonnées arrondies à six décimales. Les surfaces officielles sont converties de ha en km². Seuls les objets Commune de pays CH sont candidats ; les codes CH préfixés évitent les collisions avec les codes INSEE. Les frontières ne coupent pas la sélection : communes françaises et suisses sont classées ensemble. Cantons accessibles dans Dépt. / canton ; régions uniquement françaises.

## Blessés

174 995 blessés rapportés au 23 septembre 2026, MoH via la même fiche OCHA que les décès. Couche jaune activable indépendamment : voisins au bord de Gaza ou des communes réservées aux décès, puis expansion par voisinage (tolérance 30 m), priorité à la proximité au centre. Communes entièrement intérieures et communes réservées aux décès exclues. Recherche bornée à 40 km du contour ; déficit affiché si nécessaire. Dernière commune fractionnée démographiquement. Aucun total décès + blessés : les catégories ne sont pas garanties disjointes.
