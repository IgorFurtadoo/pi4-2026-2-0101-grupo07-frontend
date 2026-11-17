# Estágio 1: instala as dependências exatas do lock e gera o dist.
FROM node:26.13.1-trixie-slim AS build
WORKDIR /app

# Dependências antes do código, para o Docker reaproveitar a camada enquanto
# o package-lock.json não mudar.
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .

# URL do Core API vista pelo navegador. Entra no bundle: nunca é segredo.
ARG VITE_API_URL=http://localhost:8080
RUN echo "$VITE_API_URL" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]+)?$' \
    || { echo "VITE_API_URL inválida: use esquema://host[:porta], sem barra final" >&2; exit 1; }
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# Estágio 2: nginx sem root (uid 101), servindo só o dist.
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24

# A mesma URL entra no connect-src da CSP. O entrypoint da imagem aplica o
# envsubst no template ao subir, só com as variáveis de ambiente definidas.
ARG VITE_API_URL=http://localhost:8080
ENV API_ORIGIN=$VITE_API_URL

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
