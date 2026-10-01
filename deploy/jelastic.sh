#!/usr/bin/env bash
# Creates the Jelastic environment on first run, then redeploys it with the given image tag.
# Needs: JELASTIC_TOKEN, IMAGE (without tag), TAG. Optional: API_HOST, ENV_NAME, NODE_GROUP,
# If the environment runs another image (e.g. an old Docker Hub copy), nothing is deployed and the job fails:
# redeploying that image would look successful while serving outdated code.
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
  # The environment must run the image built by CI; otherwise a redeploy would serve stale code.
  if [ "${current#docker.io/}" != "${IMAGE#docker.io/}" ];then
   echo "::error::L'environnement $ENV_NAME utilise l'image $current, pas $IMAGE produite par la CI : rien n'est déployé. Faites pointer le conteneur du groupe $NODE_GROUP sur $IMAGE (voir deploy/README.md)."
   exit 1
  fi
  response=$(call environment/control/rest/redeploycontainersbygroup \
   --data-urlencode "envName=$ENV_NAME" --data-urlencode "nodeGroup=$NODE_GROUP" \
   --data-urlencode "tag=$TAG" --data-urlencode "useExistingVolumes=true")
  check "$response" "Redéploiement"
  echo "Redéployé : $ENV_NAME avec $IMAGE:$TAG";;
 11) create;;
 *) echo "Lecture de l'environnement : $info";exit 1;;
esac
