# Media Tracker - Cloud Run Vertex AI Microservice

Enterprise AI backend for **Amin's Media Tracker**, powered by **Google Cloud Vertex AI Gemini 1.5** and containerized on **Google Cloud Run**.

## Architecture & Features
- **Framework:** FastAPI (Python 3.11 asynchronous)
- **AI Model:** Google Cloud Vertex AI `gemini-1.5-flash` / `gemini-1.5-pro`
- **GCP Project:** `project-51459e90-fbb3-471f-9f9`
- **Region:** `us-central1`
- **Endpoints:**
  - `POST /api/chat`: Context-aware cinema curator chat with user's active watchlist, ratings, and unwatched backlog analysis. Emits structured JSON recommendations with verified TMDB posters.
  - `GET /health`: Health check and Vertex AI initialization status.

## 1-Command Deployment to Cloud Run
From this directory, run:
```bash
./deploy.sh
```

Or execute via Google Cloud SDK:
```bash
gcloud builds submit --tag gcr.io/project-51459e90-fbb3-471f-9f9/media-tracker-ai:latest .

gcloud run deploy media-tracker-ai \
  --image gcr.io/project-51459e90-fbb3-471f-9f9/media-tracker-ai:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GCP_PROJECT=project-51459e90-fbb3-471f-9f9,GCP_REGION=us-central1,GEMINI_MODEL=gemini-1.5-flash
```

## Mapping Your Existing Custom Domain
To map your custom domain (e.g. `api.yourdomain.com` or `tracker.yourdomain.com`) to this Cloud Run service:

```bash
gcloud beta run domain-mappings create \
  --service=media-tracker-ai \
  --domain=YOUR_DOMAIN_OR_SUBDOMAIN \
  --region=us-central1
```

Then configure the DNS records provided by Google in your domain registrar (Cloudflare, Google Domains, Route53, Namecheap):
- **Record Type:** `CNAME`
- **Name:** `api` (or `@` for apex)
- **Target:** `ghs.googlehosted.com.`
Google automatically provisions and manages free auto-renewing SSL certificates!
