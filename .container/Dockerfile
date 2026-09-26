FROM oven/bun:1.4.2-alpine
WORKDIR /app
COPY dist/server.js /app/server.js
COPY dist/public/ /app/public/
ENV HOME=/app/data
EXPOSE 3000
CMD ["bun", "/app/server.js"]
