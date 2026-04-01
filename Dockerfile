# Use Ubuntu 22.04 as strictly required
FROM ubuntu:22.04

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install Python, Node.js, and build tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    curl \
    gnupg \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Install Node dependencies
RUN npm install

# Copy source code
COPY . .

# Build React frontend
RUN npm run build

# Expose port 8000 as strictly required
EXPOSE 8000

# Bind to 0.0.0.0 and port 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
