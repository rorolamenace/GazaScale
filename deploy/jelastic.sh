#!/usr/bin/env bash
# Creates the Jelastic environment on first run, then redeploys it with the given image tag.
# Needs: JELASTIC_TOKEN, IMAGE (without tag), TAG. Optional: API_HOST, ENV_NAME, NODE_GROUP,
# ALT_IMAGE (same image on Docker Hub), REPLACE=true to swap a container that runs another image.
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

add_node(){
 response=$(call environment/control/rest/addnode --data-urlencode "envName=$ENV_NAME" --data-urlencode "nodeType=docker" \
  --data-urlencode "nodeGroup=$NODE_GROUP" --data-urlencode "dockerName=$IMAGE" --data-urlencode "dockerTag=$TAG" \
  --data-urlencode "fixedCloudlets=1" --data-urlencode "flexibleCloudlets=4" --data-urlencode "displayName=GazaScale")
 check "$response" "Ajout du conteneur"
 echo "Conteneur $IMAGE:$TAG ajouté au groupe $NODE_GROUP de $ENV_NAME"
}

info=$(call environment/control/rest/getenvinfo --data-urlencode "envName=$ENV_NAME")
case "$(jq -r .result <<<"$info")" in
 0)
  echo "Groupes de nœuds : $(jq -rc '[.nodes[]? | {group:.nodeGroup,image:(.customitem.dockerName // null),tag:(.customitem.dockerTag // null)}]' <<<"$info")"
  current=$(jq -r --arg g "$NODE_GROUP" 'first(.nodes[]? | select(.nodeGroup==$g) | .customitem.dockerName) // empty' <<<"$info")
  if [ -z "$current" ];then
   if [ "${REPLACE:-}" = true ];then add_node;exit 0;fi
   echo "Aucun conteneur Docker dans le groupe $NODE_GROUP de $ENV_NAME : relancez le workflow à la main avec replace=true";exit 1
  fi
  # The environment may point at the Docker Hub copy of the image (ALT_IMAGE) instead of GHCR.
  if [ -n "${ALT_IMAGE:-}" ] && [ "${current#docker.io/}" = "${ALT_IMAGE#docker.io/}" ];then IMAGE=$ALT_IMAGE;fi
  if [ "${current#docker.io/}" != "${IMAGE#docker.io/}" ];then
   if [ "${REPLACE:-}" != true ];then echo "Le groupe $NODE_GROUP utilise l'image $current, pas $IMAGE : relancez le workflow à la main avec replace=true";exit 1;fi
   # Swap the container: remove the nodes of the group, then add one with the right image.
   for id in $(jq -r --arg g "$NODE_GROUP" '.nodes[]? | select(.nodeGroup==$g) | .id' <<<"$info");do
    response=$(call environment/control/rest/removenode --data-urlencode "envName=$ENV_NAME" --data-urlencode "nodeid=$id")
    check "$response" "Suppression du nœud $id"
    echo "Nœud $id ($current) supprimé"
   done
   add_node;exit 0
  fi
  response=$(call environment/control/rest/redeploycontainersbygroup \
   --data-urlencode "envName=$ENV_NAME" --data-urlencode "nodeGroup=$NODE_GROUP" \
   --data-urlencode "tag=$TAG" --data-urlencode "useExistingVolumes=true")
  check "$response" "Redéploiement"
  echo "Redéployé : $ENV_NAME avec $IMAGE:$TAG";;
 11) create;;
 *) echo "Lecture de l'environnement : $info";exit 1;;
esac
