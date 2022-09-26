FROM node:latest as build
WORKDIR /app
COPY . .
RUN yarn install --production=true

FROM node:alpine
COPY --from=build /app /

EXPOSE 3000
CMD [ "node", "index.js" ]