FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p uploads logs
EXPOSE 4000
CMD ["node", "src/server.js"]
