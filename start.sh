#!/bin/bash

# Configuration
CONDA_ENV="toby"
BACKEND_PORT=8000
FRONTEND_PORT=5173

echo "🚀 Starting n8n Factory..."

# Ensure we're in the right directory
cd "$(dirname "$0")"

# Start Backend in the background using conda run
echo "📦 Starting Backend (FastAPI) on port $BACKEND_PORT..."
conda run -n $CONDA_ENV python backend/main.py &
BACKEND_PID=$!

# Start Frontend in the background
echo "🎨 Starting Frontend (Vite) on port $FRONTEND_PORT..."
cd frontend
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ n8n Factory is running!"
echo "📍 Dashboard: http://localhost:$FRONTEND_PORT"
echo "📍 Backend API: http://localhost:$BACKEND_PORT"
echo "📍 Live Logs: Check the Dashboard"
echo ""
echo "Press Ctrl+C to stop all services."

# Handle termination
trap "kill $BACKEND_PID $FRONTEND_PID; exit" INT TERM
wait
