FROM node:17-alpine@sha256:993bdfb0da7ae8fa4dad7282f797e3e26e88f810d410e0b0409d132d1fb17af3 as build
WORKDIR /app
RUN yarn install --production=true
COPY . .

FROM node:17-alpine@sha256:993bdfb0da7ae8fa4dad7282f797e3e26e88f810d410e0b0409d132d1fb17af3
COPY --from=build /app /

#EXPOSE 3000 4000
CMD ["dumb-init", "node", "index.js" ]