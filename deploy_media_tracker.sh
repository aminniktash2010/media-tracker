#!/usr/bin/env bash
set -euo pipefail

GITHUB_USER="aminniktash2010"
REPO_NAME="${1:-media-tracker}"
WORKDIR="media-tracker-deploy"

GCP_WIF="projects/202076903469/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
GCP_SA="play-upload@project-51459e90-fbb3-471f-9f9.iam.gserviceaccount.com"
DRIVE_WATCHLIST_URL="https://drive.google.com/uc?export=download&id=1MZvzObuqeHzMbT5Hasmf0HEa0wk0dMhm"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE} Deploying Media Tracker to GitHub Pages (${GITHUB_USER}/${REPO_NAME})${NC}"
echo -e "${BLUE}====================================================${NC}"

if ! command -v git &> /dev/null; then
  echo -e "${RED}Error: 'git' is not installed or not in PATH.${NC}"
  exit 1
fi

HAS_GH=false
if command -v gh &> /dev/null; then
  if gh auth status &> /dev/null; then
    HAS_GH=true
    echo -e "${GREEN}✓ GitHub CLI (gh) authenticated as ${GITHUB_USER}.${NC}"
  else
    echo -e "${YELLOW}! GitHub CLI (gh) found but not logged in. Using git directly.${NC}"
  fi
else
  echo -e "${YELLOW}! GitHub CLI (gh) not found. Using git directly.${NC}"
fi

mkdir -p "${WORKDIR}/.github/workflows"
cd "${WORKDIR}"

echo -e "\n${BLUE}1. Preparing web app files...${NC}"

FOUND_LOCAL=false
if [ -f "../index.html" ]; then
  cp "../index.html" "index.html"
  FOUND_LOCAL=true
  echo -e "${GREEN}✓ Using index.html from parent folder.${NC}"
elif [ -f "../watchlist.html" ]; then
  cp "../watchlist.html" "index.html"
  FOUND_LOCAL=true
  echo -e "${GREEN}✓ Using watchlist.html from parent folder.${NC}"
elif [ -f "${HOME}/Downloads/watchlist.html" ]; then
  cp "${HOME}/Downloads/watchlist.html" "index.html"
  FOUND_LOCAL=true
  echo -e "${GREEN}✓ Copied watchlist.html from ~/Downloads.${NC}"
elif [ -f "${HOME}/Downloads/media-tracker-github-pages.zip" ]; then
  unzip -qo "${HOME}/Downloads/media-tracker-github-pages.zip" -d .
  FOUND_LOCAL=true
  echo -e "${GREEN}✓ Extracted files from ~/Downloads/media-tracker-github-pages.zip.${NC}"
fi

if [ "$FOUND_LOCAL" = false ] && [ ! -f "index.html" ]; then
  echo -e "${BLUE}Fetching latest watchlist web app from Google Drive...${NC}"
  curl -sSL "${DRIVE_WATCHLIST_URL}" -o "index.html"
  echo -e "${GREEN}✓ Downloaded latest index.html (125 curated titles).${NC}"
fi

cat << README_EOF > README.md
# Amin's Media Tracker & Watchlist

An interactive single-page web application tracking curated movies, prestige television, and theatrical releases with instant search, category filters, and poster artwork.

- **Live URL:** https://${GITHUB_USER}.github.io/${REPO_NAME}/
- **Catalog:** 125 curated titles across prestige drama, thrillers, auteur cinema, and theatrical runs.
- **Automation:** Deployed via GitHub Actions on every commit to \`main\`.
README_EOF
echo -e "${GREEN}✓ Generated README.md.${NC}"

cat << 'WORKFLOW_EOF' > .github/workflows/pages.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Pages
        uses: actions/configure-pages@v5
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: '.'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
WORKFLOW_EOF
echo -e "${GREEN}✓ Generated .github/workflows/pages.yml.${NC}"

echo -e "\n${BLUE}2. Configuring GitHub repository...${NC}"

if [ "$HAS_GH" = true ]; then
  if ! gh repo view "${GITHUB_USER}/${REPO_NAME}" &> /dev/null; then
    echo -e "${BLUE}Creating public repository '${GITHUB_USER}/${REPO_NAME}'...${NC}"
    gh repo create "${GITHUB_USER}/${REPO_NAME}" --public --confirm
    echo -e "${GREEN}✓ Created repository on GitHub.${NC}"
  else
    echo -e "${GREEN}✓ Repository '${GITHUB_USER}/${REPO_NAME}' already exists.${NC}"
  fi

  echo -e "${BLUE}Registering GCP Workload Identity variables...${NC}"
  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "${GCP_WIF}" --repo "${GITHUB_USER}/${REPO_NAME}"
  gh variable set GCP_SERVICE_ACCOUNT --body "${GCP_SA}" --repo "${GITHUB_USER}/${REPO_NAME}"
  echo -e "${GREEN}✓ GCP Workload Identity variables registered.${NC}"

  echo -e "${BLUE}Configuring GitHub Pages build type...${NC}"
  gh api -X POST "repos/${GITHUB_USER}/${REPO_NAME}/pages" -f build_type=workflow 2>/dev/null || true
  echo -e "${GREEN}✓ GitHub Pages configured for GitHub Actions.${NC}"
fi

echo -e "\n${BLUE}3. Committing and pushing files...${NC}"

if [ ! -d ".git" ]; then
  git init -b main
else
  git branch -M main
fi

REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
if git remote get-url origin &> /dev/null; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi

git add index.html README.md .github/workflows/pages.yml
git commit -m "Deploy media tracker web app with automated GitHub Actions" || echo "No changes to commit"

echo -e "${BLUE}Pushing to GitHub (origin/main)...${NC}"
git push -u origin main

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}✓ Deployment push successful!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Live URL: https://${GITHUB_USER}.github.io/${REPO_NAME}/"
echo -e "Repository: https://github.com/${GITHUB_USER}/${REPO_NAME}"
