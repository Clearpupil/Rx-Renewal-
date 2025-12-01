# Stage 1: Build the React application
FROM node:20-alpine AS builder

# Build argument for API key (passed from Cloud Build)
ARG GEMINI_API_KEY
ENV GEMINI_API_KEY=$GEMINI_API_KEY

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (GEMINI_API_KEY is available during build)
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Cloud Run uses port 8080
EXPOSE 8080

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
