# 1. Base Image: Use a Node.js LTS version
# Using bullseye-slim for smaller size, includes basic libraries
FROM node:20-bullseye-slim

# Puppeteer dependencies (Check Puppeteer docs for latest required libs)
# Ref: https://pptr.dev/troubleshooting#running-puppeteer-in-docker
RUN apt-get update && apt-get install -y \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
# Copying these first leverages Docker cache if dependencies don't change
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
# This will download Chromium for Puppeteer inside the image
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the TypeScript code
RUN npm run build

# Expose the port the application runs on (should match src/server.ts)
# Assuming your server listens on 3000, adjust if different
EXPOSE 3000 

# Command to run the application
# Uses the compiled JavaScript output
CMD ["node", "dist/server.js"] 