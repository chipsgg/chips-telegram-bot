FROM node:latest as build
WORKDIR /app
RUN yarn install --production=true
COPY . .

FROM node:alpine
COPY --from=build /app /

#EXPOSE 3000 4000
CMD ["dumb-init", "node", "./src/index.js" ]