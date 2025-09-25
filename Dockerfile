FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl ca-certificates

COPY package*.json ./
RUN npm install

COPY . .

CMD ["node", "index.js"]
