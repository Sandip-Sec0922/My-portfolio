# Build the SPA and serve only the static production output from Nginx.
FROM node:24-alpine AS client-build
WORKDIR /app
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY Nginx/nginx.conf /etc/nginx/nginx.conf
COPY --from=client-build /app/dist /usr/share/nginx/html
EXPOSE 8080
