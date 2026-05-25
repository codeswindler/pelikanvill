# Pelikan Village

Next.js admin and public menu app for Pelikan Village.

Production URL: https://pelikan.theleasemaster.com

Repository: https://github.com/codeswindler/pelikanvill.git

## Production Server

The app is configured to run behind a reverse proxy with PM2:

- PM2 app name: `pelikanvill`
- Local app URL: `http://127.0.0.1:3000`
- Public URL: `https://pelikan.theleasemaster.com`
- Runtime: Node.js 20+ recommended
- Database: MySQL via Prisma

The PM2 process uses `ecosystem.config.cjs`.

## Static QR Codes

Printed QR codes should use these permanent URLs:

```text
https://pelikan.theleasemaster.com/menu
https://pelikan.theleasemaster.com/review
```

The menu QR points to `/menu`, and `/menu` loads the currently active uploaded PDF. Uploading or activating a new menu does not change the QR code, so printed codes do not need to be replaced.

The review QR points to `/review`, which redirects to the configured Google review URL. If the Google review destination changes later, update `NEXT_PUBLIC_GOOGLE_REVIEW_URL` and keep the printed QR code unchanged.

## First Deploy

Clone the repository:

```bash
git clone https://github.com/codeswindler/pelikanvill.git
cd pelikanvill
```

Install dependencies:

```bash
npm ci
```

Create the production environment file:

```bash
cp .env.example .env.production
```

Update `.env.production` with the real MySQL URL, session secret, Google review URL, SMS credentials, and initial admin credentials.

Run database migrations:

```bash
npm run migrate:deploy
```

Seed the first admin user if needed:

```bash
npm run seed
```

Build and start with PM2:

```bash
npm run build
npm run pm2:start
pm2 save
```

Enable PM2 startup after reboot:

```bash
pm2 startup
```

Run the command printed by PM2, then run:

```bash
pm2 save
```

## Updates

From the server project directory:

```bash
git pull origin main
npm ci
npm run migrate:deploy
npm run build
npm run pm2:reload
```

## Nginx Reverse Proxy

Use Nginx or another reverse proxy to send the public domain to the local Next.js process:

```nginx
server {
    server_name pelikan.theleasemaster.com;

    client_max_body_size 120M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After creating the site config, reload Nginx and issue an SSL certificate for `pelikan.theleasemaster.com`.

## Persistent Files

Uploaded menu PDFs are stored in:

```text
uploads/menus
```

Keep this directory outside disposable release folders or back it up regularly. Do not commit uploaded files to Git.

## Useful Commands

```bash
npm run lint
npm run build
npm run pm2:logs
pm2 status pelikanvill
pm2 restart pelikanvill
```
