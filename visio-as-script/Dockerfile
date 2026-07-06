# Visio-as-Script — self-contained image.
# The app has NO runtime npm dependencies and bundles NO copy of Mermaid: it's a
# static file server plus the Visio-export extension (vendor/mermaid-to-visio).
# The browser loads the official Mermaid from the CDN. Make sure the extension is
# vendored before building:  npm run vendor
# (For an offline image, run `npm run fetch-mermaid` first and COPY public/mermaid.)
FROM node:20-alpine

WORKDIR /app

# Copy only what the server needs at runtime.
COPY package.json server.js ./
COPY public ./public
COPY vendor ./vendor

# Azure App Service for Containers / Container Apps detect the EXPOSEd port.
ENV PORT=8080
EXPOSE 8080

# Drop root.
USER node

CMD ["node", "server.js"]
