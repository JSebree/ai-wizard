FROM node:20-bullseye-slim

# Install FFMPEG (required for audio/thumbnail processing)
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (DO App Platform binds to 8080 by default usually, but we set PORT env)
EXPOSE 3001

# Start
CMD ["npm", "start"]
