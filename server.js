const { createServer } = require("http");
const next = require("next");

const port = parseInt(process.env.PORT || "3001", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer((req, res) => {
        handle(req, res);
    });
    server.keepAliveTimeout = 5000;
    server.headersTimeout = 8000;
    server.maxConnections = 50;

    server.listen(port, () => {
        console.log(`> Ready on http://localhost:${port}`);
    });

    let isShuttingDown = false;
    const gracefulShutdown = (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`> Received ${signal}. Shutting down gracefully...`);

        server.close((err) => {
            if (err) {
                console.error("> Error during server close:", err);
                process.exit(1);
            }
            console.log("> HTTP server closed.");
            process.exit(0);
        });

        setTimeout(() => {
            console.error("> Forceful shutdown after 10s timeout.");
            process.exit(1);
        }, 10000).unref();
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});
