# Production Deployment Guide

## 1. Server Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| API | 2 vCPU, 2GB RAM | 4 vCPU, 4GB RAM |
| MongoDB | 2 vCPU, 4GB RAM | Replica set 3 nodes |
| Admin | 1 vCPU, 1GB RAM | 2 instances behind LB |
| Redis | 1 vCPU, 512MB | For sockets + cache |

## 2. Environment Variables

Copy `.env.example` to `.env` on the server. **Required production values:**

```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster/techsan
JWT_ACCESS_SECRET=<64-char-random>
JWT_REFRESH_SECRET=<64-char-random>
CORS_ORIGINS=https://admin.yourdomain.com
API_BASE_URL=https://api.yourdomain.com
STORAGE_DRIVER=s3
RAZORPAY_KEY_ID=rzp_live_xxx
FIREBASE_PROJECT_ID=your-project
```

## 3. Deploy API with PM2

```bash
cd apps/backend
npm ci --omit=dev
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

## 4. Deploy Admin (Next.js)

```bash
cd apps/admin
npm ci
npm run build
pm2 start npm --name techsan-admin -- start
```

Or use Docker:

```bash
docker compose build admin api
docker compose up -d
```

## 5. Nginx SSL

Place certificates in `nginx/ssl/` and extend `nginx/nginx.conf`:

```nginx
server {
  listen 443 ssl;
  ssl_certificate /etc/nginx/ssl/fullchain.pem;
  ssl_certificate_key /etc/nginx/ssl/privkey.pem;
  # ... proxy blocks from nginx.conf
}
```

## 6. MongoDB Production

- Enable authentication
- Create application user with readWrite on `techsan_restaurant`
- Enable backups (mongodump cron or Atlas)
- Create indexes (already defined in models)

## 7. CI/CD

GitHub Actions workflow at `.github/workflows/ci.yml` runs lint/build on push.

Extend with deploy job:

```yaml
deploy:
  needs: [backend, admin]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: actions/checkout@v4
    - run: rsync -avz ./ user@server:/opt/techsan/
    - run: ssh user@server 'cd /opt/techsan/apps/backend && pm2 reload techsan-api'
```

## 8. Health Checks

- `GET /api/v1/health` – API liveness
- MongoDB: `mongosh --eval "db.adminCommand('ping')"`
- Monitor PM2: `pm2 monit`

## 9. Post-Deploy Checklist

- [ ] Run `npm run seed` only on fresh DB (not production with data)
- [ ] Verify Swagger at `/api/docs`
- [ ] Test login for each role
- [ ] Test Socket.IO from Flutter/web
- [ ] Configure Razorpay webhook URL
- [ ] Upload Firebase service account for push
- [ ] Set up log rotation (`logs/` directory)
- [ ] Configure firewall (443, 22 only)
