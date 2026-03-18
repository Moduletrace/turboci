#!/bin/bash

cd /app

if [ ! -f /app/package.json ]; then
    bun init -y
    cat << 'EOF' > /app/index.ts
const server = Bun.server({
    async fetch(req, server) {
        return new Response("Welcome to Bun JS")
    },
    port: 3000
})

console.log(`Server running on port ${server.port}`)
EOF
fi