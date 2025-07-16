#!/bin/bash

# GPT-IMAGE-1 Playground Docker Setup Script

echo "🐳 GPT-IMAGE-1 Playground Docker Setup"
echo "======================================"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local file not found!"
    echo "   Please create a .env.local file with your OpenAI API key:"
    echo "   OPENAI_API_KEY=your_openai_api_key_here"
    echo ""
    echo "   You can copy .env.local.example as a starting point:"
    echo "   cp .env.local.example .env.local"
    echo ""
    read -p "Do you want to create .env.local from the example file? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cp .env.local.example .env.local
        echo "✅ Created .env.local from example file."
        echo "   Please edit .env.local and add your OpenAI API key before continuing."
        exit 0
    else
        echo "   Please create .env.local manually and run this script again."
        exit 1
    fi
fi

echo "✅ Docker is installed"
echo "✅ .env.local file exists"

# Determine which docker compose command to use
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

echo ""
echo "🚀 Starting GPT-IMAGE-1 Playground..."
echo "   Using: $DOCKER_COMPOSE"

# Build and start the container
$DOCKER_COMPOSE up -d --build

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Success! The application is starting up..."
    echo "   📱 Application URL: http://localhost:3000"
    echo "   📊 View logs: $DOCKER_COMPOSE logs -f"
    echo "   🛑 Stop application: $DOCKER_COMPOSE down"
    echo ""
    echo "   Generated images will be persisted in a Docker volume."
    echo "   The application may take a few moments to fully start."
else
    echo ""
    echo "❌ Failed to start the application."
    echo "   Check the logs with: $DOCKER_COMPOSE logs"
fi
