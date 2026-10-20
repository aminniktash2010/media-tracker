#!/usr/bin/env bash
set -eo pipefail

PROJECT_ID="${GCP_PROJECT:-project-51459e90-fbb3-471f-9f9}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="media-tracker-ai"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

echo "=========================================================="
echo " Deploying Media Tracker Vertex AI Backend to Cloud Run"
echo " Project: ${PROJECT_ID}"
echo " Region:  ${REGION}"
echo " Service: ${SERVICE_NAME}"
echo "=========================================================="

# Check for gcloud path
GCLOUD_BIN=$(which gcloud || echo "/home/amin/google-cloud-sdk/bin/gcloud")
if [ ! -f "$GCLOUD_BIN" ]; then
  echo "Error: gcloud CLI not found at $GCLOUD_BIN"
  exit 1
fi

echo "--> Setting GCP active project..."
"$GCLOUD_BIN" config set project "$PROJECT_ID"

echo "--> Building container image with Google Cloud Build..."
"$GCLOUD_BIN" builds submit --tag "$IMAGE_NAME" .

echo "--> Deploying service to Cloud Run..."
"$GCLOUD_BIN" run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT="$PROJECT_ID",GCP_REGION="$REGION",GEMINI_MODEL="gemini-1.5-flash" \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5

echo "=========================================================="
echo " Deployment Complete!"
SERVICE_URL=$("$GCLOUD_BIN" run services describe "$SERVICE_NAME" --platform managed --region "$REGION" --format 'value(status.url)')
echo " Service URL: $SERVICE_URL"
echo " Health check: ${SERVICE_URL}/health"
echo "=========================================================="
