FROM node:22-alpine

# Install ImageMagick 7 with JPEG support
RUN apk add --no-cache imagemagick imagemagick-jpeg

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
