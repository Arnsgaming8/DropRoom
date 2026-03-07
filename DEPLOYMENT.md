# 🚀 DropRoom Deployment Guide

This guide will help you deploy the DropRoom backend to make it always online.

## 📋 Prerequisites

- GitHub repository with DropRoom code
- Node.js 14+ installed locally
- Git installed and configured

## 🎯 Recommended: Render (Free & Always Online)

Render offers a free tier that keeps your backend running 24/7.

### Step 1: Push to GitHub

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com)
2. Sign up with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure the service:

**Basic Settings:**
- **Name**: `droproom-backend`
- **Region**: Choose nearest to you
- **Branch**: `main`
- **Root Directory**: `.` (root)
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Advanced Settings:**
- **Instance Type**: `Free`
- **Health Check Path**: `/health`

### Step 3: Set Environment Variables

In Render dashboard → Environment → Add Environment Variable:

```
NODE_ENV=production
PORT=10000
FRONTEND_URL=https://yourusername.github.io/DropRoom
MAX_FILE_SIZE=104857600
```

### Step 4: Deploy

Click **"Create Web Service"** - Render will automatically deploy!

### Step 5: Update Frontend URL

Edit `script.js` line 11:
```javascript
this.apiBaseUrl = 'https://droproom-backend.onrender.com'; // Your Render URL
```

## 🚂 Alternative: Railway (Free with Sleep)

Railway is free but puts your app to sleep after inactivity.

### Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"Deploy from GitHub repo"**
4. Select your DropRoom repository
5. Railway will auto-detect Node.js and deploy

### Set Environment Variables

In Railway dashboard → Variables:
```
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourusername.github.io/DropRoom
```

## 🐳 Docker Deployment (Self-hosted)

For full control, deploy with Docker.

### Build and Run

```bash
# Build image
docker build -t droproom-backend .

# Run container
docker run -d \
  --name droproom-backend \
  -p 3000:3000 \
  -v $(pwd)/storage:/app/storage \
  -e NODE_ENV=production \
  -e PORT=3000 \
  droproom-backend
```

### Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  droproom-backend:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./storage:/app/storage
    environment:
      - NODE_ENV=production
      - PORT=3000
    restart: always
```

Run with:
```bash
docker-compose up -d
```

## ⚡ Vercel Serverless (Advanced)

Convert to serverless functions for Vercel.

### Install Vercel CLI

```bash
npm i -g vercel
```

### Create API Routes

Create `api/upload/[roomId].js`:
```javascript
// Move upload logic here as serverless function
export default function handler(req, res) {
  // Your upload logic
}
```

### Deploy

```bash
vercel --prod
```

## 🔧 Configuration Files

Your project includes pre-configured deployment files:

- `render.yaml` - Render configuration
- `railway.toml` - Railway configuration  
- `Dockerfile` - Docker configuration
- `.env.example` - Environment variables template

## 📊 Monitoring Your Backend

### Health Check

Always available at: `https://your-backend-url/health`

### Logs

- **Render**: Dashboard → Logs
- **Railway**: Dashboard → Logs
- **Docker**: `docker logs droproom-backend`

## 🔒 Security Considerations

1. **Environment Variables**: Never commit `.env` files
2. **CORS**: Only allow your frontend domain
3. **File Uploads**: Limit file sizes and types
4. **Storage**: Regular backups of uploaded files

## 🌍 Custom Domains

### For Backend

Most platforms support custom domains:

- **Render**: Dashboard → Custom Domains
- **Railway**: Dashboard → Settings → Domains
- **Docker**: Use Nginx reverse proxy

### For Frontend

GitHub Pages supports custom domains:
1. Add `CNAME` file to root
2. Configure in repository settings

## 🔄 Auto-Deployment

### Render & Railway

Both support automatic deployment:
- Push to GitHub → Auto-deploy
- Environment variables sync
- Zero-downtime deployments

### Manual Updates

```bash
git add .
git commit -m "Update features"
git push origin main
# Auto-deploys to your platform
```

## 📱 Testing Your Deployment

1. **Frontend**: Visit your GitHub Pages site
2. **Backend**: Check `/health` endpoint
3. **Integration**: Upload a test file
4. **Cross-platform**: Test on mobile devices

## 🆘 Troubleshooting

### Common Issues

**CORS Errors:**
```javascript
// Update FRONTEND_URL environment variable
FRONTEND_URL=https://yourusername.github.io/DropRoom
```

**File Upload Fails:**
```javascript
// Check MAX_FILE_SIZE limit
MAX_FILE_SIZE=104857600  // 100MB
```

**Backend Not Starting:**
```bash
# Check logs for errors
# Verify package.json scripts
# Ensure all dependencies installed
```

**Storage Issues:**
```bash
# Ensure storage directory exists
mkdir -p storage
# Check permissions
chmod 755 storage
```

## 💰 Cost Comparison

| Platform | Free Tier | Paid Plans | Always Online |
|----------|-----------|------------|--------------|
| Render | ✅ 750h/month | $7/month+ | ✅ Yes |
| Railway | ✅ 500h/month | $5/month+ | ❌ Sleeps |
| Vercel | ✅ 100GB bandwidth | $20/month+ | ✅ Yes |
| Docker | 💻 Self-hosted | Varies | ✅ Yes |

## 🎉 Success Checklist

- [ ] Backend deployed and running
- [ ] Health check passing
- [ ] Frontend connected to backend
- [ ] File upload working
- [ ] File download working
- [ ] CORS properly configured
- [ ] Environment variables set
- [ ] Custom domains configured (optional)
- [ ] Monitoring setup (optional)

## 📞 Support

If you encounter issues:

1. Check platform-specific documentation
2. Review environment variables
3. Check application logs
4. Test with curl commands
5. Create GitHub issue for help

---

**Happy Deploying! 🚀**

Your DropRoom backend will be running 24/7, serving files to users worldwide!
