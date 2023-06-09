#!/bin/bash

# Run whiteboard
cd /app/whiteboard
npm run start:prod &

# Run Express-Server
cd /app/Express-Server
if [ ! -d "node_modules" ]; then
  npm ci
else
  npm run prod
fi
