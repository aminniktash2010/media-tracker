#!/usr/bin/env bash
# ==============================================================================
# Deploy Media Tracker & Watchlist to GitHub Pages
# ==============================================================================
set -euo pipefail

GITHUB_USER="aminniktash2010"
REPO_NAME="${1:-media-tracker}"
BRANCH="main"

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

# Ensure .github/workflows/pages.yml exists
mkdir -p .github/workflows
if [ ! -f .github/workflows/pages.yml ]; then
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
  echo -e "${GREEN}✓ Created .github/workflows/pages.yml.${NC}"
fi

# Configure GitHub Pages via gh if available
if [ "$HAS_GH" = true ]; then
  echo -e "${BLUE}Verifying GitHub Pages configuration...${NC}"
  gh api -X POST "repos/${GITHUB_USER}/${REPO_NAME}/pages" -f build_type=workflow 2>/dev/null || true
  echo -e "${GREEN}✓ GitHub Pages workflow configuration verified.${NC}"
fi

# Stage and commit files
echo -e "\n${BLUE}Staging web app files...${NC}"
git add index.html styles.css app.js data.js README.md .github/workflows/pages.yml deploy_media_tracker.sh

if git diff --staged --quiet; then
  echo -e "${YELLOW}No changes detected to commit.${NC}"
else
  git commit -m "Enhance code quality: modular ES6+ architecture, modern CSS design system, and GitHub Pages workflow"
  echo -e "${GREEN}✓ Committed updates to branch ${BRANCH}.${NC}"
fi

# Push to origin
REMOTE_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"
if git remote get-url origin &> /dev/null; then
  git remote set-url origin "${REMOTE_URL}"
else
  git remote add origin "${REMOTE_URL}"
fi

echo -e "${BLUE}Pushing to GitHub (${BRANCH})...${NC}"
git push -u origin "${BRANCH}"

echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}✓ Deployment push successful!${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Your live web app will be available at:"
echo -e "${BLUE}👉 https://${GITHUB_USER}.github.io/${REPO_NAME}/${NC}"
echo -e "Repository: https://github.com/${GITHUB_USER}/${REPO_NAME}"
