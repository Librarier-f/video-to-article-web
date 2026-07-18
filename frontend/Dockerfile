# Stage 1: Build Frontend
FROM node:20-slim AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# We can pass API URL as build arg if needed, but in our docker-compose Nginx proxy setup,
# we will use an empty string so it hits the same origin (/api -> backend)
# Vite handles VITE_ env variables at build time.
ENV VITE_API_BASE_URL=""
RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Provide a custom Nginx config for SPA routing (fallback to index.html)
# and reverse proxying /api to the backend.
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

