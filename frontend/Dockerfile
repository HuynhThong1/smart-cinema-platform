FROM node:24-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN NX_DAEMON=false pnpm build
FROM node:24-alpine AS customer
WORKDIR /app
COPY --from=build /app/dist/apps/smart-customer ./
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4201
USER node
EXPOSE 4201
CMD ["node","server/server.mjs"]
FROM nginxinc/nginx-unprivileged:stable-alpine AS admin
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/smart-admin/browser /usr/share/nginx/html
EXPOSE 8080
