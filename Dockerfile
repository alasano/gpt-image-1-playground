FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Create the generated-images directory with proper permissions
RUN mkdir -p /app/generated-images && \
    chown -R node:node /app/generated-images

# Build the Next.js application
RUN npm run build

# Switch to non-root user
USER node

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
