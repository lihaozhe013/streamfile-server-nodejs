FROM oven/bun:1.4.2-alpine
WORKDIR /app
COPY dist/ /app/
EXPOSE 3000
CMD ["bun", "/app/server.js"]