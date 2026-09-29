FROM node:20-alpine

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Ensure uploads directory exists
RUN mkdir -p uploads

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "src/server.js"]
