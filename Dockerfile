FROM node:latest AS build
WORKDIR /app
COPY . .
RUN yarn install
RUN npm run build
RUN yarn install --production

FROM node:alpine
COPY --from=build /app /

EXPOSE 80
CMD [ "node", "dist/index.js" ]