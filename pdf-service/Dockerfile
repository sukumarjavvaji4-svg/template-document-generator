FROM node:20-bookworm-slim

# Install LibreOffice and required font packages
RUN apt-get update && apt-get install -y \
    libreoffice \
    libreoffice-writer \
    fonts-liberation \
    fonts-dejavu \
    fonts-noto \
    fonts-croscore \
    curl \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages pymupdf

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --production

COPY server.js normalize_borders.py ./

EXPOSE 3000

CMD ["node", "server.js"]
