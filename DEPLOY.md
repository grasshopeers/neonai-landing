# GitHub Actions deploys `main` to Cloudflare Pages (neonai-landing).
#
# One-time setup in GitHub repo settings → Secrets → Actions:
#   CLOUDFLARE_API_TOKEN = Cloudflare API token with "Cloudflare Pages — Edit"
#
# Live URLs after deploy:
#   https://neonai-landing.pages.dev
#   https://neonai-landing.pages.dev/verify
#
# Custom domain neonai.app:
#   Cloudflare dashboard → Workers & Pages → neonai-landing → Custom domains
#   Add neonai.app ONLY if the domain zone is on your Cloudflare account.
#   (If neonai.app redirects elsewhere, fix DNS/registrar first.)
