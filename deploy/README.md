# Déploiement sur Jelastic (Infomaniak)

Le site est une image Docker nginx qui sert `dist/` (voir `Dockerfile` et `deploy/nginx.conf`).

## Automatique, à chaque push sur `main`

Le workflow `.github/workflows/deploy.yml` :

1. lance les tests (`node --test tests/*.test.mjs`) ;
2. construit l'image et vérifie qu'elle répond (page d'accueil, type des fichiers JS, page 404) ;
3. la publie sur `ghcr.io/rorolamenace/gazascale`, avec deux étiquettes : le commit et `latest` ;
4. lance `deploy/jelastic.sh` : crée l'environnement `gazascale` s'il n'existe pas (un conteneur Docker, 1 cloudlet réservé, 4 dynamiques), sinon le redéploie avec l'image du commit. Le script refuse de redéployer si le conteneur du groupe `cp` utilise une autre image.

Adresse Jelastic : https://gazascale.jcloud-ver-jpe.ik-server.com/

À configurer une fois dans GitHub, onglet Settings du dépôt :

- Secret `JELASTIC_TOKEN_GAZASCALE` : jeton d'accès personnel Jelastic (tableau de bord Infomaniak Jelastic, Settings > Access Tokens), avec au minimum le droit `environment.control.RedeployContainersByGroup`.
- Variables facultatives : `JELASTIC_API_HOST` (défaut `app.jpe.infomaniak.com`), `JELASTIC_ENV_NAME` (défaut `gazascale`), `JELASTIC_NODE_GROUP` (défaut `cp`).
- Facultatif : secrets `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN` (jeton d'accès Docker Hub, droit Read & Write). L'image est alors aussi publiée sous `rorolamenace/gazascale`, et un environnement Jelastic créé avec ce nom Docker Hub est redéployé normalement.
- Le paquet `gazascale` sur GHCR doit être public, ou l'environnement Jelastic doit avoir des identifiants de registre pour le télécharger.

## Domaine

Le conteneur écoute sur le port 80. Pour servir `gazascale.org`, rattacher le domaine à l'environnement dans Jelastic et activer le certificat Let's Encrypt.

## À la main

```sh
docker build -t ghcr.io/rorolamenace/gazascale:latest .
docker push ghcr.io/rorolamenace/gazascale:latest
curl -fsS "https://app.jpe.infomaniak.com/1.0/environment/control/rest/redeploycontainersbygroup" \
  --data-urlencode "session=$JELASTIC_TOKEN_GAZASCALE" \
  --data-urlencode "envName=gazascale" --data-urlencode "nodeGroup=cp" --data-urlencode "tag=latest"
```
