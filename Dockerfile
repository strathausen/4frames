FROM node:22-alpine

# Install ImageMagick 7
RUN apk add --no-cache imagemagick

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
