FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node server.mjs workspace.mjs social-media.mjs package.json ./
COPY --chown=node:node public/ ./public/
COPY --chown=node:node *-LICENSE.txt ./licenses/
USER node
CMD ["node", "server.mjs"]
