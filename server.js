const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const connectDB = require("./config/db");
const { connectRedis } = require("./utils/cache");
const logger = require("./utils/logger");
require("dotenv").config();

// Initialize app
const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS configuration
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true
    })
);

// Body parser
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Connect to MongoDB
connectDB().catch((err) => {
    logger.error("Database connection failed:", err);
    process.exit(1);
});

// Connect to Redis
connectRedis().catch((err) => {
    logger.error("Redis connection failed:", err);
    process.exit(1);
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/chat", require("./routes/chatRoutes"));

// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "development" ? err.message : "Something went wrong"
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: "Not Found" });
});

// Server listener
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
});
