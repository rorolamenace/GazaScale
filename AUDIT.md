# Audit de GazaScale · 11 octobre 2026

Branche : `audit/2026-10-11`, partie de `claude/serene-mendel-j2m6t6` (identique à `main` pour le code du site).

## Ce qu'est l'application

- Site **entièrement statique** (`dist/`) : HTML, JavaScript sans framework ni étape de build, Leaflet 1.9.4, MapLibre GL 5.24.0, Turf 7.2.0, tous recopiés dans le dépôt.
- Servi par **nginx dans une image Docker** (`Dockerfile`, `deploy/nginx.conf`), déployée sur Jelastic (Infomaniak) par GitHub Actions à chaque push sur `main`.
- **Pas de back-end, pas de base de données, pas de compte ni de connexion.** Les seules entrées extérieures sont : l'adresse de la page (`#v=…`, `?lang=`), le fichier `live/manifest.json` (branche `live-data`), les réponses de `geo.api.gouv.fr`.
- Deux tâches planifiées écrivent sur la branche `live-data` : bilan OCHA (4 fois par jour) et populations (mensuel). nginx relaie `/live/` vers `raw.githubusercontent.com`.

## État de départ

| Vérification | Résultat |
|---|---|
| `node --test tests/*.test.mjs` | 12 tests, tous verts |
| `docker build .` | réussit, nginx 1.27.5 |
| Conteneur : `/`, `/app.js`, `/introuvable` | 200, 200, 404 comme attendu |
| `npm audit` | sans objet : aucune dépendance npm, bibliothèques recopiées à leur dernière version |
| Secrets dans le code et l'historique Git | aucun trouvé (jetons GitHub, clés AWS, clés privées, mots de passe) |

## Rubriques sans objet

- **Authentification, sessions, MFA** : le site n'a aucun compte.
- **Base de données** (schéma, migrations, index, N+1, RLS, sauvegardes) : il n'y en a pas. Les « données » sont des fichiers JSON versionnés dans Git ; la sauvegarde, c'est le dépôt GitHub et la branche `live-data`.
- **CORS** : le site n'expose aucune API ; nginx retire l'en-tête `Access-Control-Allow-Origin` de GitHub sur `/live/`.

## Constats

Gravité : **Critique** = faille exploitable ou perte de données ; **Important** = chiffre faux affiché, panne probable ou risque réel ; **Mineur** = hygiène, confort, dette.
Effort : S (moins d'une heure), M (quelques heures), L (plus).

### Critique

Aucun constat critique.

### Important

- [x] **I1. Le bilan en direct peut réécrire la population d'une commune.** `dist/live.js` · effort S.
  Quand un nouveau bilan OCHA arrive, `live.js` remplace partout l'ancien chiffre par le nouveau, par simple recherche de texte, y compris dans les valeurs passées à `t()`. Une commune de 173 922 habitants s'affiche alors avec 174 032 habitants, car « 73 922 » est contenu dans « 173 922 ». Le bilan actuel de `live-data` (30 septembre) déclenche déjà ce remplacement.
  *Correctif* : ne corriger que les phrases du site, pas les valeurs calculées, et exiger que le nombre ne soit pas collé à d'autres chiffres. Test : `tests/live.test.mjs`.

- [x] **I2. La recherche européenne cassera à la prochaine mise à jour Eurostat.** `dist/live.js` · effort S.
  Quand un dossier entier est mis à jour (`eu`, `it`, `us`, sans liste `files`), `dataUrl()` envoie aussi `eu/places.json` vers `live/`. Or la routine des populations ne copie pas ce fichier. La recherche des villes européennes renverrait alors une erreur 404 et ne trouverait plus rien.
  *Correctif* : ne rediriger vers `live/` que les fichiers de communes, jamais `index.json`, `countries.json`, `places.json` ni `places/`. Test : `tests/live.test.mjs`.

- [x] **I3. `/live/` relaie n'importe quel fichier du dépôt.** `deploy/nginx.conf` · effort S.
  `https://gazascale.org/live/<n'importe quoi>` interroge GitHub, par exemple `/live/README.md`. Chaque adresse inventée part chez GitHub (le 404 n'est gardé qu'une minute). Quelqu'un peut ainsi épuiser le quota de requêtes du serveur vers GitHub, et le bilan en direct cesse alors de se mettre à jour.
  *Correctif* : n'accepter que `manifest.json`, les deux images de partage et les fichiers JSON des six dossiers de données ; le reste répond 404 sans sortir du serveur.

- [x] **I4. L'image repose sur nginx 1.27, qui ne reçoit plus de correctifs.** `Dockerfile` · effort S.
  La branche 1.27 s'est arrêtée au printemps 2025. La branche stable maintenue est 1.28.
  *Correctif* : `nginx:1.28-alpine`. Même configuration, simple montée de version mineure.

- [x] **I5. Le lecteur de fiches OCHA publie des chiffres sans aucun test.** `tools/live/fetch-toll.mjs` · effort M.
  Ce script lit un PDF et publie le bilan sur le site sans relecture humaine. Sa logique de lecture n'était testable qu'en ligne.
  *Correctif* : sortir la lecture dans une fonction pure (`tools/live/parse-toll.mjs`) et la tester sur une fiche type, sur une mise en page changée et sur des chiffres invraisemblables.

- [x] **I6. Une source de population cassée ne prévient jamais.** `tools/live/update-populations.py`, `.github/workflows/live-populations.yml` · effort S.
  Le script attrape toutes les erreurs et termine toujours avec succès. Si une adresse change (cas déjà vécu avec HDX), la mise à jour s'arrête en silence et aucun ticket n'est ouvert.
  *Correctif* : publier ce qui a réussi, puis terminer en erreur si une source a échoué, ce qui ouvre le ticket existant.

- [x] **I7. La routine des populations n'a aucun test.** `tools/live/update-populations.py` · effort M.
  `apply()` réécrit des milliers de fichiers servis en production.
  *Correctif* : rendre le script importable sans l'exécuter, tester `apply()` sur un petit jeu de fichiers, lancer ces tests dans la CI.

- [x] **I8. La fabrication des données « monde » n'est pas dans le dépôt.** `dist/wd/` (179 Mo) · effort S.
  Les scripts qui ont produit les unités du Canada, du Japon, de l'Indonésie, du Nigeria, des Philippines, de l'Afrique du Sud, de l'Australie, des États-Unis et du reste du monde n'existent que dans un dossier temporaire de session. Ils seront perdus, et `dist/wd/` deviendra impossible à refaire ou à corriger.
  *Correctif* : les versionner dans `tools/world/` avec une notice (sources, ordre d'exécution, limites).

- [ ] **I9. Pas de mentions légales.** `dist/index.html` · **attend votre décision**.
  La loi française (LCEN, art. 6-III) demande d'identifier l'éditeur et l'hébergeur d'un site, même associatif ou personnel ; un particulier peut garder l'anonymat en donnant les coordonnées de son hébergeur. Le site ne donne qu'une adresse e-mail. Je n'écris pas votre identité à votre place.

### Mineur

- [ ] **M1. Code mort : comparaison par département et par région.** `dist/app.js` (branche `level !== 'communes'`), `dist/regions.json` (1,4 Mo), `loadRegions()`. Aucun bouton n'y mène plus ; ses textes ne sont pas traduits. Supprimer est une décision à prendre (suppression de fonctionnalité). Effort S.
- [ ] **M2. nginx annonce sa version** (`Server: nginx/1.27.5`). Ajouter `server_tokens off;`. Effort S.
- [ ] **M3. Pas d'interdiction d'affichage dans un cadre** (`frame-ancestors`). Le site n'a pas d'action sensible, le risque de détournement de clic est faible. Effort S.
- [ ] **M4. HSTS absent à l'origine.** Il dépend de la terminaison TLS chez Jelastic (configuration SSL : à décider chez vous). Effort S.
- [ ] **M5. Les en-têtes de sécurité ne sont posés que sur les pages HTML.** Les règles `add_header` des blocs `location` remplacent celles du serveur. Sans effet pratique pour du JS, du JSON ou des images servis avec `nosniff`. Effort S.
- [ ] **M6. Actions GitHub épinglées par étiquette** (`actions/checkout@v4`) **et `playwright@1` non figé.** Épingler par empreinte de commit réduit le risque de chaîne d'approvisionnement. Effort S.
- [ ] **M7. Permissions CI trop larges.** `packages: write` s'applique aussi au job de tests et aux pull requests. Le donner au seul job `image`. Effort S.
- [ ] **M8. `style-src 'unsafe-inline'`** dans la CSP, imposé par Leaflet et MapLibre. Effort L.
- [ ] **M9. Code JavaScript compacté à la main** (fonctions sur une ligne, `app.js` de 345 lignes pour 52 ko). Difficile à relire et à tester. Effort L.
- [ ] **M10. 321 Mo de données dans Git et dans l'image.** Chaque déploiement repousse 320 Mo. Voir les recommandations. Effort L.
- [ ] **M11. Mexique, Turquie, Indonésie, Nigeria, Philippines, Afrique du Sud hors de la routine annuelle** : leurs adresses HDX changent à chaque édition. Effort M.
- [ ] **M12. Aucune surveillance de disponibilité.** Une panne de Jelastic ou de `/live/` ne prévient personne. Effort S (sonde externe gratuite).
- [ ] **M14. Le serveur local relaie encore tout `/live/`.** `serve.mjs` ne reprend pas la liste de nginx (I3). Sans risque : il n'écoute que sur 127.0.0.1. Effort S.
- [ ] **M15. Le Brésil injoignable ouvre désormais un ticket.** Conséquence voulue de I6 ; l'API SIDRA est parfois lente. Le ticket n'est ouvert qu'une fois tant qu'il reste ouvert. Effort S.
- [ ] **M13. Textes français en dur** dans la branche morte de M1 (`Chargement des territoires…`, `habitants / km²`). Disparaît avec M1.

## Données personnelles et RGPD

- Pas de cookie. Le navigateur garde la langue, la visite guidée vue et les vignettes repliées (`localStorage`), sans envoi : c'est du stockage fonctionnel, sans consentement requis.
- Mesure d'audience zstats auto-hébergée : IP tronquée, code visiteur renouvelé chaque jour, conservation 13 mois, rubrique « Cookies et données » à jour. Cela correspond aux conditions d'exemption de consentement de la CNIL.
- La géolocalisation reste dans le navigateur et n'est demandée qu'au clic sur « Ma position ».
- Reste I9 (mentions légales).

## Suivi des corrections

| Constat | Commit | Vérification |
|---|---|---|
| I1 | `bc0e9f7` | `tests/live.test.mjs` ; Chromium avec le bilan réel du 30 septembre : 16 remplacements, 0 ancien chiffre restant, comme avant |
| I2 | `ef297ff` | `tests/live.test.mjs` |
| I3 | `b0de175` | conteneur : `/live/README.md` et `/live/wd/places/pa.json` en 404 ; manifeste, images et fichiers de communes en 200 ; contrôle ajouté à la CI |
| I4 | `f57b279` | `docker build`, contrôles de la CI, healthcheck « healthy », nginx 1.28.3 |
| I5 | `d260590` | `tests/toll.test.mjs` ; script lancé contre ochaopt.org |
| I6 | `9b37734` | `tests/test_update_populations.py` |
| I7 | `8ed23be` | 5 tests Python, lancés par la CI |
| I8 | `25557cc` | relecture des chemins et des dépendances |

## Deuxième tour

Relecture du code modifié : aucun nouveau constat critique ou important. Deux constats mineurs ajoutés (M14, M15).
La nouvelle correction du bilan donne exactement le même résultat que l'ancienne sur les 629 textes du site
(page française, page anglaise, `en.js`, `app.js`, `tour.js`) : elle ne change que les nombres collés à d'autres chiffres.

## Release 1.14.0

Le numéro de version est passé à 1.14.0 : les navigateurs rechargent `live.js` et les autres scripts modifiés.
