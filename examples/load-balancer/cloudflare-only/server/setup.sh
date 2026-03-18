#!/bin/bash

cd /app

if [ ! -f /app/package.json ]; then
    bun init -y
fi

cat << 'EOF' > /app/index.ts
const server = Bun.serve({
    async fetch(req, server) {
        return new Response("Welcome to Bun JS")
    },
    port: 3000
})

console.log(`Server running on port ${server.port}`)
EOF