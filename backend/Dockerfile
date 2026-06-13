# Parent image is a lean Node.JS image
FROM node:22-alpine

# Set working dir
WORKDIR /usr/src/app

# Copy pckg manager files
COPY package*.json ./

# Install dependencies
RUN npm install

# COPY rest of source code 
COPY . .

# Expose on backend port 300
EXPOSE 3000

# Run npm app in dev mode
CMD ["npm", "run", "dev"]