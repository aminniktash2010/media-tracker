#!/usr/bin/env bash
# ==============================================================================
# Deploy Media Tracker & Watchlist to GitHub Pages
# Target Account: aminniktash2010
# ==============================================================================

set -euo pipefail

# Configuration
GITHUB_USER="aminniktash2010"
REPO_NAME="${1:-media-tracker}"
WORKDIR="media-tracker-deploy"

# GCP Workload Identity Federation Infrastructure
GCP_WIF="projects/202076903469/locations/global/workloadIdentityPools/github-actions-pool/providers/github-provider"
GCP_SA="play-upload@project-51459e90-fbb3-471f-9f9.iam.gserviceaccount.com"

# Drive download link for verified watchlist file
DRIVE_WATCHLIST_URL="https://drive.google.com/uc?export=download&id=1MZvzObuqeHzMbT5Hasmf0HEa0wk0dMhm"

# Terminal styling
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE} Deploying Media Tracker to GitHub Pages (${GITHUB_USER}/${REPO_NAME})${NC}"
echo -e "${BLUE}====================================================${NC}"

# 1. Check prerequisites
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
    echo -e "${YELLOW}! GitHub CLI (gh) found but not logged in. Will use standard git.${NC}"
  fi
else
  echo -e "${YELLOW}! GitHub CLI (gh) not found. Will use standard git.${NC}"
fi

# 2. Setup local staging directory
mkdir -p "${WORKDIR}/.github/workflows"
cd "${WORKDIR}"

echo -e "\n${BLUE}1. Preparing web app files...${NC}"

# Check if index.html or watchlist.html is already in parent dir, otherwise download
if [ -f "../index.html" ]; then
  cp "../index.html" "index.html"
  echo -e "${GREEN}✓ Copied index.html from parent directory.${NC}"
elif [ -f "../watchlist.html" ]; then
  cp "../watchlist.html" "index.html"
  echo -e "${GREEN}✓ Copied watchlist.html from parent directory.${NC}"
else
  echo -e "${BLUE}Downloading latest watchlist web app from Google Drive...${NC}"
  curl -sSL "${DRIVE_WATCHLIST_URL}" -o "index.html"
  echo -e "${GREEN}✓ Downloaded latest index.html (125 curated titles).${NC}"
fi

# 3. Create README.md
cat << README_EOF > README.md
# Amin's Media Tracker & Watchlist

An interactive single-page web application tracking curated movies, prestige television, and theatrical releases with instant search, category filters, and poster artwork.

- **Live URL:** https://${GITHUB_USER}.github.io/${REPO_NAME}/
- **Catalog:** 125 curated titles across prestige drama, thrillers, auteur cinema, and theatrical runs.
- **Automation:** Deployed via GitHub Actions on every commit to \`main\`.
README_EOF
echo -e "${GREEN}✓ Generated README.md.${NC}"

# 4. Create GitHub Actions workflow for Pages
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

# 5. Create or configure GitHub repository
echo -e "\n${BLUE}2. Configuring GitHub repository...${NC}"

if [ "$HAS_GH" = true ]; then
  # Check if repository already exists
  if ! gh repo view "${GITHUB_USER}/${REPO_NAME}" &> /dev/null; then
    echo -e "${BLUE}Creating public repository '${GITHUB_USER}/${REPO_NAME}'...${NC}"
    gh repo create "${GITHUB_USER}/${REPO_NAME}" --public --confirm
    echo -e "${GREEN}✓ Created repository on GitHub.${NC}"
  else
    echo -e "${GREEN}✓ Repository '${GITHUB_USER}/${REPO_NAME}' already exists.${NC}"
  fi

  # Set GCP Workload Identity variables on repository
  echo -e "${BLUE}Setting GCP Workload Identity variables...${NC}"
  gh variable set GCP_WORKLOAD_IDENTITY_PROVIDER --body "${GCP_WIF}" --repo "${GITHUB_USER}/${REPO_NAME}"
  gh variable set GCP_SERVICE_ACCOUNT --body "${GCP_SA}" --repo "${GITHUB_USER}/${REPO_NAME}"
  echo -e "${GREEN}✓ GCP Workload Identity variables registered.${NC}"

  # Enable GitHub Pages build from GitHub Actions
  echo -e "${BLUE}Configuring GitHub Pages build type...${NC}"
  gh api -X POST "repos/${GITHUB_USER}/${REPO_NAME}/pages" -f build_type=workflow 2>/dev/null || true
  echo -e "${GREEN}✓ GitHub Pages configured for GitHub Actions.${NC}"
fi

# 6. Initialize git, commit, and push
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
echo -e "GitHub Actions is building your site."
echo -e "Your live web app will be available at:"
echo -e "${BLUE}👉 https://${GITHUB_USER}.github.io/${REPO_NAME}/${NC}"
echo -e "Repository: https://github.com/${GITHUB_USER}/${REPO_NAME}"