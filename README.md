# GazaScale

Carte interactive pour comparer les 365 km² de la bande de Gaza aux territoires français et suisses. On place Gaza n'importe où, sous forme de contour géographique ou de cercle de même surface, et la carte montre les communes touchées, les bâtiments détruits et l'équivalence en habitants des bilans humains.

Site : https://gazascale.org · contact : contact@gazascale.org

## Lancer en local

Node.js 18 ou plus récent, sans dépendance à installer :

```sh
node serve.mjs
```

Ouvrir http://127.0.0.1:4187. Le serveur local compresse les réponses en gzip et renvoie `dist/404.html` pour les adresses inconnues. Le fond de carte et les communes hors Haute-Savoie demandent une connexion Internet.

## Tests

```sh
node --test tests/*.test.mjs
```

Ils vérifient la surface de 365 km² après déplacement et rotation, l'arrêt exact de la sélection au bilan, la séparation entre vies perdues et blessés, et la cohérence des fichiers chargés à la demande.

## Déployer avec Docker

L'image sert `dist/` avec nginx, en gzip, avec un cache long pour les données et les en-têtes de sécurité (voir `deploy/nginx.conf`) :

```sh
docker build -t gazascale .
docker run -p 8080:80 gazascale
```

Le déploiement sur Jelastic (Infomaniak) est décrit dans `deploy/README.md`.

## Fonctionnement

- À l'ouverture, Gaza est placée au sud de Genève avec son contour réel, et les destructions visibles. Un bouton la remplace par un cercle de même surface.
- Un double-clic sur la carte, ou un appui long sur mobile, place Gaza à cet endroit. Les flèches du clavier la déplacent d'un kilomètre. En mode contour, la poignée ronde la fait pivoter.
- La surface reste exacte grâce à une projection azimutale équivalente ; la rotation se fait dans un plan local.
- Le panneau de comparaison se ferme pendant un déplacement et se rouvre quand le calcul est prêt.
- On compare par commune, par département ou canton, ou par région française.

## Lire les chiffres

Les communes françaises et suisses touchées par la forme sont classées de la plus proche du centre à la plus éloignée. Leurs populations s'additionnent jusqu'à atteindre le bilan des vies perdues ; la dernière commune peut ne compter que pour une fraction de sa population. Si les communes touchées ne suffisent pas, le manque est affiché. Le rouge est une équivalence en habitants : il ne situe pas les vies perdues.

La population de référence est celle de la commune entière, même si la forme n'en couvre qu'une partie. Ce n'est pas une estimation de la population à l'intérieur du cercle.

Le cercle intérieur gris représente une proportion de bâtiments détruits ou endommagés, et non une surface de terrain détruit.

Le bilan humain est un instantané : 73 922 vies palestiniennes perdues au 23 septembre 2026 selon le ministère de la Santé de Gaza, repris par OCHA. Il ne comprend pas toute la mortalité indirecte. Aucun chiffre ne se met à jour automatiquement. Les dates de chaque statistique sont affichées dans l'interface et détaillées dans « Sources & méthode ».

## Blessés

La même fiche OCHA rapporte 174 995 blessés. La couche jaune part de la population restante de la dernière commune utilisée pour les vies perdues, couvre ensuite les autres communes touchées par la forme de Gaza, par proximité du centre, puis s'étend de commune voisine en commune voisine (tolérance de contact de 30 m). Les communes entièrement réservées aux vies perdues sont exclues. La recherche s'arrête à 40 km autour de Gaza ; un manque éventuel est affiché. Les deux bilans ne sont jamais additionnés, car rien ne garantit que les deux groupes soient distincts.

Les communes voisines se chargent après celles qui sont sous la forme : les vies perdues s'affichent même si ce second chargement échoue, et un bouton permet de réessayer.

## Suisse

Les 2 110 communes et 26 cantons de `dist/swiss.js` viennent de swissBOUNDARIES3D (© swisstopo, janvier 2026), avec les populations de l'OFS au 31 décembre 2024. Les géométries LV95 ont été converties en WGS84, simplifiées à 20 m et arrondies à six décimales. Les surfaces officielles sont converties d'hectares en km². Seuls les objets Commune du pays CH sont candidats ; leurs codes sont préfixés par `CH-` pour ne pas entrer en collision avec les codes INSEE. La frontière ne coupe pas la sélection : communes françaises et suisses sont classées ensemble.

## Mesure d'audience

Le site est mesuré avec [zstats](https://github.com/rorolamenace/ZStats), un outil sans cookie auto-hébergé sur `https://www.zstats.fr` (`data-site="gazascale.org"`). La politique de sécurité (`dist/index.html` et `deploy/nginx.conf`) autorise ce domaine dans `script-src` et `connect-src`.

- Les boutons et liens sont suivis automatiquement ; les outils de la carte et les filtres portent un libellé `data-zstats`.
- `app.js` signale deux actions sans bouton : « Gaza placée sur la carte » (double-clic ou appui long) et « Population de référence : 2023/2025 ».
- La rubrique « Cookies et données » de « Sources & méthode » décrit ce qui est mesuré. Elle doit rester à jour si la mesure change.

## Sources et bibliothèques

- [OpenFreeMap](https://openfreemap.org/) (style Liberty) et [OpenStreetMap](https://www.openstreetmap.org/copyright) : fond de carte, avec repli sur les tuiles OpenStreetMap si le fond vectoriel ne charge pas.
- [Leaflet 1.9.4](https://leafletjs.com/), [MapLibre GL JS](https://maplibre.org/) et [Turf 7.2.0](https://turfjs.org/) : carte et calculs géographiques.
- [API Découpage administratif](https://geo.api.gouv.fr/) : communes, populations et surfaces. La Haute-Savoie est enregistrée dans le site (29 septembre 2026) ; les autres départements sont chargés à la demande.
- [france-geojson](https://github.com/gregoiredavid/france-geojson) : contours simplifiés des départements et régions.
- [Palestine geodata](https://github.com/sepans/palestine_geodata) : contour de Gaza, normalisé à 365 km².
- [PCBS](https://www.pcbs.gov.ps/statisticsIndicatorsTables.aspx?lang=en&table_id=1949) : populations datées.
- [UNOSAT, 11 octobre 2025](https://www.un.org/unispal/document/unosat-gaza-strip-damage-assessment-31oct25/) : bâtiments détruits et endommagés.
- [OCHA, 23 septembre 2026](https://www.ochaopt.org/sites/default/files/Gaza_Reported_Impact_Snapshot_23_September_2026.pdf) : bilan humain rapporté.
- Polices DM Sans et Manrope (SIL Open Font License), servies depuis `dist/fonts/`.

Les données et bibliothèques tierces restent soumises à leurs licences respectives.

## Structure

`dist/` contient le site statique prêt à servir :

- `app.js` : interactions, chargement des données et comparaisons ; `map-extras.js` : recherche, outre-mer, légende, géolocalisation.
- `geometry.js` : projections ; `selection.js` et `neighbors.js` : sélection des communes pour les vies perdues et les blessés.
- `data.js`, `communes.js`, `swiss.js` : données chargées au démarrage (départements, Haute-Savoie, Suisse).
- `regions.json` et `overseas.js` : chargés seulement quand on compare par région ou qu'on place Gaza outre-mer. `overseas-index.js` contient les icônes du menu et les noms pour la recherche ; il se régénère avec `node tools/build-overseas-index.mjs`.

`.openai/hosting.json` identifie l'hébergement Sites existant ; il ne contient aucun secret. Pour un autre hébergeur statique, servir le dossier `dist/`.

## Identité

Nom : GazaScale · domaine : gazascale.org · contact : contact@gazascale.org. Le raccordement DNS et la boîte e-mail se configurent chez le fournisseur du domaine. Le logo `dist/gazascale.svg` est un disque aux couleurs du drapeau palestinien ; le pack graphique complet est dans `dist/brand/`.
