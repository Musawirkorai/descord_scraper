FROM node:20-alpine AS build
WORKDIR /app

# Create React App inlines env vars at build time, so the API base has to be a
# build arg, not a runtime env var. Default "/api" is correct when nginx serves
# the API on the same origin (the docker-compose setup). For a split deploy
# (static host + separate API host) pass the absolute URL:
#   docker build --build-arg REACT_APP_API_URL=https://api.example.com/api .
ARG REACT_APP_API_URL=/api
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
