FROM node:20-bullseye-slim

# Install FFmpeg 7.x (static build for modern syntax support)
RUN apt-get update && apt-get install -y wget xz-utils && \
    wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xf ffmpeg-release-amd64-static.tar.xz && \
    mv ffmpeg-*-amd64-static/ffmpeg /usr/local/bin/ && \
    mv ffmpeg-*-amd64-static/ffprobe /usr/local/bin/ && \
    rm -rf ffmpeg-* && \
    apt-get remove -y wget xz-utils && apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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
