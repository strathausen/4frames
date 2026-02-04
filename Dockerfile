FROM node:22-slim

# Install dependencies for ImageMagick 7
RUN apt-get update && apt-get install -y \
    wget \
    libpng16-16 \
    libjpeg62-turbo \
    libgomp1 \
    libfontconfig1 \
    libfreetype6 \
    && rm -rf /var/lib/apt/lists/*

# Install ImageMagick 7 from official portable release
RUN wget -q https://imagemagick.org/archive/binaries/magick -O /usr/local/bin/magick \
    && chmod +x /usr/local/bin/magick \
    && ln -s /usr/local/bin/magick /usr/local/bin/convert \
    && ln -s /usr/local/bin/magick /usr/local/bin/identify

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
