# ── Usa Node.js 20 Alpine (leve e sem apt problemático)
FROM node:20-alpine

# Diretório de trabalho dentro do container
WORKDIR /app

# Copia dependências primeiro (cache de layers)
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --omit=dev

# Copia o restante do projeto
COPY . .

# Expõe a porta (Railway injeta via PORT env var)
EXPOSE 3000

# Inicia o servidor
CMD ["node", "server.js"]
