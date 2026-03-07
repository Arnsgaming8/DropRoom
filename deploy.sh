#!/bin/bash

# DropRoom Deployment Script
# This script helps deploy the backend to various platforms

echo "🚀 DropRoom Deployment Script"
echo "=============================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests if available
if [ -f "test" ]; then
    echo "🧪 Running tests..."
    npm test
fi

# Build for production
echo "🔨 Building for production..."
npm run build 2>/dev/null || echo "No build script found, continuing..."

echo "✅ Build complete!"
echo ""
echo "🌐 Choose your deployment platform:"
echo "1. Render (Recommended - Always Free)"
echo "2. Railway (Free with sleep)"
echo "3. Docker (Self-hosted)"
echo "4. Vercel (Serverless)"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        echo "🎯 Deploying to Render..."
        echo "1. Push your code to GitHub"
        echo "2. Go to https://render.com"
        echo "3. Connect your repository"
        echo "4. Use render.yaml configuration"
        echo "5. Set environment variables"
        echo ""
        echo "📋 Required Environment Variables for Render:"
        echo "- NODE_ENV=production"
        echo "- PORT=10000"
        echo "- FRONTEND_URL=https://yourusername.github.io/DropRoom"
        ;;
    2)
        echo "🚂 Deploying to Railway..."
        echo "1. Push your code to GitHub"
        echo "2. Go to https://railway.app"
        echo "3. Connect your repository"
        echo "4. Use railway.toml configuration"
        echo ""
        echo "📋 Required Environment Variables for Railway:"
        echo "- NODE_ENV=production"
        echo "- PORT=3000"
        echo "- FRONTEND_URL=https://yourusername.github.io/DropRoom"
        ;;
    3)
        echo "🐳 Docker deployment..."
        echo "Building Docker image..."
        docker build -t droproom-backend .
        echo "To run: docker run -p 3000:3000 droproom-backend"
        ;;
    4)
        echo "⚡ Vercel deployment..."
        echo "Install Vercel CLI: npm i -g vercel"
        echo "Run: vercel --prod"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment setup complete!"
echo "📖 See DEPLOYMENT.md for detailed instructions"
