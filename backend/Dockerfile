FROM oven/bun

# Install curl
RUN apt-get update && apt-get install -y curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN bun install
COPY . .

ENV NODE_ENV production

CMD [ "bun", "start" ]