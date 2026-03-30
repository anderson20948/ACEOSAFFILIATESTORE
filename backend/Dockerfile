FROM node:18-alpine

# Set working directory inside the container
WORKDIR /app

# Force production environment for Express optimizations
ENV NODE_ENV=production

# Copy package configuration files
COPY package*.json ./

# Install ONLY production dependencies and clear cache to minimize image size
RUN npm install --omit=dev && npm cache clean --force

# Copy the rest of the application code
COPY . .

# Secure the container by assigning folder ownership to the non-root 'node' user
RUN chown -R node:node /app

# Switch execution context to the non-root 'node' user (Least Privilege)
USER node

# Expose the application port
EXPOSE 3000

# Health monitoring so hosting platforms know if the Express server actually crashed
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application efficiently
CMD ["npm", "start"]
