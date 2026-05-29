FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN mkdir -p logs

EXPOSE 4000
CMD ["node", "src/index.js"]
 