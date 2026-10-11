# Fabrication des unités « monde » et États-Unis

Ces scripts ont produit `dist/wd/` (reste du monde) et `dist/us/` (États-Unis), ainsi que les fichiers de
recherche `dist/wd/index.json`, `dist/wd/countries.json` et `dist/wd/places/`. Ils ne tournent pas en CI : ils
servent à refaire ou corriger ces données lors d'une release. Les populations se mettent à jour sans eux
(`tools/live/update-populations.py`) ; ils ne sont nécessaires que pour changer des **contours**.

Les fichiers source (plusieurs Go) ne sont pas versionnés : chaque étape dit où les prendre. On travaille dans
un dossier de travail hors du dépôt ; les scripts écrivent directement dans `dist/` du dépôt.

Dépendances Python : `shapely`, `pyproj`, `numpy`, `openpyxl`, `pyshp` (Australie), `pykakasi` (Japon).

## 1. Base Kontur (tous les pays)

Source : [Kontur Boundaries](https://data.humdata.org/dataset/kontur-boundaries), fichier GeoPackage `kb.gpkg`.

1. `assign.py` : rattache chaque unité administrative à son pays, écrit `feat.tsv` et `countries.json`.
2. `choose.py` : choisit, pays par pays, le niveau administratif le plus fin qui couvre au moins 90 % de la
   population du pays en 40 000 unités au plus ; écrit `choice.json`. Les pays couverts ailleurs (France, Suisse, Europe LAU, Israël, Palestine, États-Unis,
   outre-mer) sont exclus.
3. `build.py` : écrit les tuiles `dist/wd/CC-x_y.json` (2° × 2°), avec la bande de Gaza (5 gouvernorats,
   total PCBS fin 2025) ; écrit `wd_index.json` et `wd_places.json` dans le dossier de travail.
4. `extra.py` : comble les trous (territoires insulaires américains, nord de Chypre, plateau du Golan).

## 2. Pays aux unités officielles

Chaque script produit un GeoJSON dont les propriétés sont `nom`, `code`, `population`, `populationYear` et
éventuellement `estimated`, puis `override.py CC fichier.geojson` remplace les unités Kontur du pays.

| Pays | Script | Sources |
|---|---|---|
| Canada | `canada-fetch.py` puis `canada-build.py` | StatCan, limites cartographiques 2021 (ArcGIS MapServer, couche 9) ; tableau 17-10-0155 |
| Japon | `japan-build.py` | MLIT N03 au 1er janvier 2025 ; registre des résidents (soumu.go.jp) au 1er janvier 2026 |
| Indonésie, Nigeria, Philippines, Afrique du Sud, Australie | `five-countries-build.py CC` | COD-AB et COD-PS (HDX) ; StatsSA recensement 2022 ; ABS SA2 2021 et 32180DS0001 |
| Mexique, Turquie | script non conservé | COD-AB admin2 + COD-PS (HDX : CONAPO 2024, TÜİK 2022), même schéma de propriétés, puis `override.py` |
| Brésil | script non conservé | municipalités IBGE ; populations tenues à jour par la routine mensuelle |

Pour l'Afrique du Sud, `za-census2022.json` (total par municipalité) vient de l'API de diffusion de StatsSA :
`api/Municipalities/listByProvince/{1..9}`, puis `api/DsPopulationGroups/getDsPopulationGroupsReport/1/3/{muniCode}`.

## 3. États-Unis

1. `us-getpl.sh` : extrait les populations 2020 par subdivision de comté des fichiers PL 94-171 du Census.
2. `us-build.py` : subdivisions de comté 2024 (`cs_s.geojson`) et estimations `sub-est2024.csv` ; écrit
   `dist/us/` ainsi que `us_index.json` et `us_places.json`.

## 4. Royaume-Uni (dossier `dist/eu/`)

`uk-merge.py` : quartiers électoraux (ONS 2021, Écosse 2024, Irlande du Nord 2021) regroupés par région NUTS.

## 5. Index et recherche

`finish.py` (variable `WORK` = dossier de travail contenant `world/`, `us/` et `geonames/cities15000.txt` de
[GeoNames](https://download.geonames.org/export/dump/)) : écrit `dist/wd/index.json`, `dist/wd/countries.json`
et `dist/wd/places/<xx>.json`.

Ensuite : `node --test tests/*.test.mjs` vérifie que chaque entrée de l'index a son fichier, puis monter la
version (`?v=`) dans `dist/index.html`, `dist/app.js` et lancer `node tools/make-en.mjs`.
