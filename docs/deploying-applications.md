---
title: Deploying applications
order: 5
summary: Deploy a Node.js app on a VPS or a Dockerfile repo on Docker hosting, with HTTPS.
updated: 2026-10-28
---

# Deploying applications

Open **Services** and click **Deploy app** (VPS) or **Deploy container** (Docker hosting). Each deployment is saved with its status and live logs, so you can watch the build.

## On a VPS (Next.js / Node.js)

1. Enter your repository URL (GitHub, GitLab or Bitbucket) and the branch.
2. Choose the **port** your app listens on (default 3000, between 1024 and 65535).
3. Choose how to run it: **Node.js with PM2**, or **Docker** (uses your repo's `Dockerfile`, or a generated Node.js one).
4. Add any **environment variables**. They are stored encrypted and never shown again; `PORT` is set for you.
5. Optionally add a **domain** and pick HTTPS.
6. Click **Deploy**.

For private repositories add a personal access token. It is used for the clone only and never stored.

### What happens on your server

The code is cloned, dependencies are installed, the app is built and started, and **nginx** is configured to serve it on ports **80 and 443** and forward traffic to your app's port. A failed build leaves the previous version running.

### HTTPS

| Option | When to use it |
| --- | --- |
| **Let's Encrypt** | You gave a domain whose DNS A record points at your server. Free, trusted certificate that renews automatically. |
| **Self-signed** | No domain yet. Works on the server's IP, but browsers show a warning. |
| **HTTP only** | Testing only. |

Only one app without a domain can use the server's bare IP on ports 80/443; give additional apps their own domain.

## On Docker hosting

1. On **Deploy container**, paste a **GitHub access token** (read-only *Contents* and *Metadata* permissions are enough). It is used for your session only.
2. Click **Load my repos** to list your repositories that contain a `Dockerfile` at the root, and pick one — or paste a repository URL.
3. Add environment variables, a port and (optionally) a domain, then **Deploy**.

The image is built from **your Dockerfile** and run as a container on **your Docker hosting only**. Your plan's limits apply: the number of containers you can run and the memory available to each.

## Managing deployments

- **Logs** — see the build and start-up output.
- **Redeploy** — pull the latest code (or switch branch / change variables) and restart.
- **Remove** — stops the app and deletes its files and nginx configuration from your server.

## Troubleshooting

| Message | What to do |
| --- | --- |
| *No Dockerfile found at the root of the repository* | Add a `Dockerfile` at the repo root and redeploy. |
| *The app did not respond on port N* | Make sure your app listens on the port you chose (it receives it as `PORT`). |
| *Could not get a certificate* | Check the domain's DNS points at your server and ports 80/443 are open, then redeploy. |
| *Your plan allows N containers* | Remove one or choose a larger plan. |
