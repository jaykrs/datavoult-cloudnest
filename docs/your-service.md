---
title: Your service and access details
order: 4
summary: How you receive and view server details, and how CloudOps works.
updated: 2026-10-28
---

# Your service and access details

## Receiving your details

After your payment is confirmed our team sets up your server and records its details. As soon as that is done:

- you receive an **email** with the IP address, hostname, region, operating system, SSH port, **username** and **password** (or a **key file** attached to the email), plus a ready-to-use `ssh` command;
- the same details appear in your dashboard under **Services**.

Until then your service shows as *Pending* and a note tells you the details are on their way.

## Viewing them in the dashboard

On **Services**, each service shows its hostname, IP address and region. Under **Server access** you see your username; click **Show password** (or **Show access key**) to reveal the secret on demand. For key-based logins you can **download the key file**. Secrets are fetched only when you ask, only for you, and are hidden again when you click *Hide*.

## Logging in

For a VPS:

```bash
ssh your-username@your-server-ip
# with a key file
chmod 600 server-key.pem
ssh -i server-key.pem your-username@your-server-ip
```

If your server uses a non-standard SSH port the email and dashboard show it and the command includes `-p <port>`.

> **Security tip:** change the password after your first login and delete the email once you have saved the details somewhere safe.

## CloudOps

Under **Services → CloudOps** you can install common software on your VPS (Node.js, Python, Docker, nginx, databases and more) without opening a terminal. CloudOps uses the same credentials we recorded for your server.

## Renewals and expiry

Your service runs until the end of the days you paid for. Renew from **Services** before it expires to avoid suspension.
