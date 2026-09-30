#!/usr/bin/env bash
# Creates the Jelastic environment on first run, then redeploys it with the given image tag.
# Needs: JELASTIC_TOKEN, IMAGE (without tag), TAG. Optional: API_HOST, ENV_NAME, NODE_GROUP,
# ALT_IMAGE (same image on Docker Hub). An environment that runs another image is redeployed with that image.
set -euo pipefail
: "${JELASTIC_TOKEN:?Secret JELASTIC_TOKEN_GAZASCALE manquant}" "${IMAGE:?}" "${TAG:?}"
API="https://${API_HOST:-app.jpe.infomaniak.com}/1.0"
ENV_NAME="${ENV_NAME:-gazascale}" NODE_GROUP="${NODE_GROUP:-cp}"

call(){ local path=$1;shift;curl -fsS "$API/$path" --data-urlencode "session=$JELASTIC_TOKEN" "$@"; }
check(){ local response=$1 step=$2;if [ "$(jq -r .result <<<"$response")" != 0 ];then echo "$step : $response";exit 1;fi; }

create(){
 env=$(jq -nc --arg name "$ENV_NAME" '{shortdomain:$name,displayName:"GazaScale"}')
 nodes=$(jq -nc --arg image "$IMAGE:$TAG" --arg group "$NODE_GROUP" \
  '[{nodeType:"docker",nodeGroup:$group,count:1,fixedCloudlets:1,flexibleCloudlets:4,displayName:"GazaScale",docker:{image:$image}}]')
 response=$(call environment/environment/rest/createenvironment --data-urlencode "env=$env" --data-urlencode "nodes=$nodes")
 check "$response" "Création"
 echo "Environnement créé : $ENV_NAME avec $IMAGE:$TAG"
}

info=$(call environment/control/rest/getenvinfo --data-urlencode "envName=$ENV_NAME")
case "$(jq -r .result <<<"$info")" in
 0)
  echo "Groupes de nœuds : $(jq -rc '[.nodes[]? | {group:.nodeGroup,image:(.customitem.dockerName // null),tag:(.customitem.dockerTag // null)}]' <<<"$info")"
  current=$(jq -r --arg g "$NODE_GROUP" 'first(.nodes[]? | select(.nodeGroup==$g) | .customitem.dockerName) // empty' <<<"$info")
  if [ -z "$current" ];then echo "Aucun conteneur Docker dans le groupe $NODE_GROUP de $ENV_NAME (variable JELASTIC_NODE_GROUP)";exit 1;fi
  # The environment may point at the Docker Hub copy of the image (ALT_IMAGE) instead of GHCR.
  if [ -n "${ALT_IMAGE:-}" ] && [ "${current#docker.io/}" = "${ALT_IMAGE#docker.io/}" ];then IMAGE=$ALT_IMAGE;fi
  # The environment runs its own image (e.g. a private Docker Hub copy): redeploy it with its current tag.
  if [ "${current#docker.io/}" != "${IMAGE#docker.io/}" ];then
   IMAGE=$current;TAG=$(jq -r --arg g "$NODE_GROUP" 'first(.nodes[]? | select(.nodeGroup==$g) | .customitem.dockerTag) // "latest"' <<<"$info")
   echo "L'environnement utilise sa propre image : redéploiement de $IMAGE:$TAG"
  fi
  response=$(call environment/control/rest/redeploycontainersbygroup \
   --data-urlencode "envName=$ENV_NAME" --data-urlencode "nodeGroup=$NODE_GROUP" \
   --data-urlencode "tag=$TAG" --data-urlencode "useExistingVolumes=true")
  check "$response" "Redéploiement"
  echo "Redéployé : $ENV_NAME avec $IMAGE:$TAG";;
 11) create;;
 *) echo "Lecture de l'environnement : $info";exit 1;;
esac
