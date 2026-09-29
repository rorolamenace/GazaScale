# Déploiement sur Jelastic (Infomaniak)

Le site est une image Docker nginx qui sert `dist/` (voir `Dockerfile` et `deploy/nginx.conf`).

## Automatique, à chaque push sur `main`

Le workflow `.github/workflows/deploy.yml` :

1. lance les tests (`node --test tests/*.test.mjs`) ;
2. construit l'image et vérifie qu'elle répond (page d'accueil, type des fichiers JS, page 404) ;
3. la publie sur `ghcr.io/rorolamenace/gazascale`, avec deux étiquettes : le commit et `latest` ;
4. redéploie l'environnement Jelastic avec l'image du commit.

À configurer une fois dans GitHub, onglet Settings du dépôt :

- Secret `JELASTIC_TOKEN_GAZASCALE` : jeton d'accès personnel Jelastic (tableau de bord Infomaniak Jelastic, Settings > Access Tokens), avec au minimum le droit `environment.control.RedeployContainersByGroup`.
- Variables facultatives : `JELASTIC_API_HOST` (défaut `app.jpe.infomaniak.com`), `JELASTIC_ENV_NAME` (défaut `gazascale`), `JELASTIC_NODE_GROUP` (défaut `cp`).
- Le paquet `gazascale` sur GHCR doit être public, ou l'environnement Jelastic doit avoir des identifiants de registre pour le télécharger.

## Première création de l'environnement

Dans le tableau de bord Jelastic : New Environment > Custom Container Images, image `ghcr.io/rorolamenace/gazascale:latest`, nom d'environnement `gazascale`. Le conteneur écoute sur le port 80. Rattacher ensuite le domaine `gazascale.org` et activer le certificat Let's Encrypt de Jelastic.

## À la main

```sh
docker build -t ghcr.io/rorolamenace/gazascale:latest .
docker push ghcr.io/rorolamenace/gazascale:latest
curl -fsS "https://app.jpe.infomaniak.com/1.0/environment/control/rest/redeploycontainersbygroup" \
  --data-urlencode "session=$JELASTIC_TOKEN_GAZASCALE" \
  --data-urlencode "envName=gazascale" --data-urlencode "nodeGroup=cp" --data-urlencode "tag=latest"
```
