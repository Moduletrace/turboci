const server = Bun.serve({
    async fetch(req, server) {
        return new Response("Welcome to Bun JS");
    },
    port: 3000,
});

console.log(`Server running on port ${server.port}`);
