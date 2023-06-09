FROM ubuntu:22.04

# Install system dependencies
RUN apt-get update \
    && apt-get install -y \
        libxerces-c-dev \
        p7zip-full \
        wget \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN wget -qO- https://deb.nodesource.com/setup_16.x | bash - \
    && apt-get install -y nodejs


# Set the working directory
WORKDIR /app

# Download and extract Boost
RUN wget https://boostorg.jfrog.io/artifactory/main/release/1.82.0/source/boost_1_82_0.7z \
    && 7z x boost_1_82_0.7z -o./seshat \
    && rm boost_1_82_0.7z

# Copy the folders to the image
COPY whiteboard /app/whiteboard
COPY seshat /app/seshat
COPY Express-Server /app/Express-Server

# Set the environment variables
ENV WHITEBOARD_PORT=8080
ENV EXPRESS_SERVER_PORT=4000

# Set up entry point script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose the required ports
EXPOSE $WHITEBOARD_PORT $EXPRESS_SERVER_PORT

# Set the working directory for Express-Server
WORKDIR /app/Express-Server

# Install Node.js dependencies for Express-Server
RUN npm ci &

# Build whiteboard and clean up unnecessary dependencies
WORKDIR /app/whiteboard
RUN npm ci \
    && npm run build

# Define the entry point
CMD ["/app/entrypoint.sh"]
