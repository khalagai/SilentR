const express = require("express");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
const Chat = require("../models/Chat");
const { auth } = require("../middleware/auth");
const { getCache, setCache, deleteCache } = require("../utils/cache");
const logger = require("../utils/logger");
require("dotenv").config();

const router = express.Router();

// API configuration
const PRIMARY_MODEL = "mistralai/Mistral-7B-Instruct-v0.2";
const FALLBACK_MODEL = "meta-llama/Llama-2-7b-chat-hf";
const HUGGINGFACE_API_URL = `https://api-inference.huggingface.co/models/${PRIMARY_MODEL}`;
const FALLBACK_API_URL = `https://api-inference.huggingface.co/models/${FALLBACK_MODEL}`;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// Rate limiting configuration
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000; // 15 minutes
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100;
const rateLimitCache = new Map();

// Rate limiting middleware
const rateLimit = async (req, res, next) => {
    const userId = req.user._id;
    const now = Date.now();
    
    // Clean up old entries
    for (const [key, value] of rateLimitCache.entries()) {
        if (now - value.timestamp > RATE_LIMIT_WINDOW) {
            rateLimitCache.delete(key);
        }
    }

    // Check rate limit
    const userLimit = rateLimitCache.get(userId);
    if (userLimit) {
        if (userLimit.count >= MAX_REQUESTS) {
            return res.status(429).json({
                error: "Rate limit exceeded",
                message: `Please wait ${Math.ceil((RATE_LIMIT_WINDOW - (now - userLimit.timestamp)) / 1000)} seconds before trying again`
            });
        }
        userLimit.count++;
    } else {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
    }

    next();
};

// Validation middleware
const validateChatRequest = [
    body("message").trim().notEmpty().withMessage("Message cannot be empty")
];

// Error handling middleware
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};

// Test endpoint to verify environment variables
router.get("/test-env", async (req, res) => {
    try {
        const envStatus = {
            mongodb: {
                connected: false,
                error: null
            },
            redis: {
                connected: false,
                error: null
            },
            huggingface: {
                connected: false,
                error: null,
                url: HUGGINGFACE_API_URL,
                fallbackUrl: FALLBACK_API_URL
            },
            environment: process.env.NODE_ENV,
            frontendUrl: process.env.FRONTEND_URL,
            timestamp: new Date().toISOString()
        };

        // Test MongoDB connection
        try {
            await Chat.findOne().limit(1);
            envStatus.mongodb.connected = true;
        } catch (error) {
            envStatus.mongodb.error = error.message;
        }

        // Test Redis connection
        try {
            await getCache("test");
            envStatus.redis.connected = true;
        } catch (error) {
            envStatus.redis.error = error.message;
        }

        // Test HuggingFace connection
        try {
            await axios.post(HUGGINGFACE_API_URL, {
                inputs: "Hello",
                parameters: {
                    max_new_tokens: 10
                }
            }, {
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_KEY}`
                }
            });
            envStatus.huggingface.connected = true;
        } catch (error) {
            envStatus.huggingface.error = error.message;
        }

        res.json(envStatus);
    } catch (error) {
        logger.error("Environment test error:", error);
        res.status(500).json({ error: "Failed to test environment" });
    }
});

// ✅ Fetch chat history for a user
router.get("/history", auth, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const userId = req.user._id;
        
        // Try to get from cache first
        const cacheKey = `chat_history:${userId}:${page}:${limit}`;
        const cachedData = await getCache(cacheKey);
        
        if (cachedData) {
            return res.status(200).json(cachedData);
        }

        const chatHistory = await Chat.find({ user_id: userId })
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .exec();

        const total = await Chat.countDocuments({ user_id: userId });

        const response = {
            chats: chatHistory,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        };

        // Cache the response for 5 minutes
        await setCache(cacheKey, response, 300);

        res.status(200).json(response);
    } catch (error) {
        logger.error("Error fetching chat history:", error);
        res.status(500).json({ 
            error: "Internal server error",
            message: error.message 
        });
    }
});

// Chat endpoint for AI responses with streaming
router.post("/", auth, validateChatRequest, handleValidationErrors, rateLimit, async (req, res) => {
    const { message } = req.body;
    const userId = req.user._id;

    try {
        logger.info(`New chat request from user ${userId}`);

        // Set headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        // Retrieve past chat history (last 5 messages for context)
        const chatHistory = await Chat.find({ user_id: userId })
            .sort({ timestamp: -1 })
            .limit(5);

        // Format chat history for LLM
        const messages = chatHistory.map(chat => [
            { role: "user", content: chat.message },
            { role: "assistant", content: chat.response }
        ]).flat();

        // Add the current message
        messages.push({ role: "user", content: message });

        // Format prompt for Mistral
        const prompt = messages.map(msg => 
            `${msg.role === "user" ? "<s>[INST] " : ""}${msg.content}${msg.role === "user" ? " [/INST]" : ""}`
        ).join("\n");

        // Try primary model first
        try {
            const response = await axios.post(
                HUGGINGFACE_API_URL,
                {
                    inputs: prompt,
                    parameters: {
                        max_new_tokens: 1000,
                        temperature: 0.7,
                        top_p: 0.95,
                        return_full_text: false,
                        stream: true
                    }
                },
                {
                    headers: {
                        Authorization: `Bearer ${HUGGINGFACE_API_KEY}`
                    },
                    responseType: "stream"
                }
            );

            await handleStreamResponse(response, res, userId, message);
        } catch (primaryError) {
            logger.warn("Primary model failed, trying fallback:", primaryError.message);
            
            // Try fallback model
            try {
                const fallbackResponse = await axios.post(
                    FALLBACK_API_URL,
                    {
                        inputs: prompt,
                        parameters: {
                            max_new_tokens: 1000,
                            temperature: 0.7,
                            top_p: 0.95,
                            return_full_text: false,
                            stream: true
                        }
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${HUGGINGFACE_API_KEY}`
                        },
                        responseType: "stream"
                    }
                );

                await handleStreamResponse(fallbackResponse, res, userId, message);
            } catch (fallbackError) {
                logger.error("Both models failed:", fallbackError.message);
                throw fallbackError;
            }
        }
    } catch (error) {
        logger.error("Chat error:", error);
        
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                error: "Request timeout",
                message: "AI service took too long to respond" 
            });
        }
        
        if (error.response) {
            return res.status(error.response.status).json({ 
                error: "AI service error",
                message: error.response.data 
            });
        }
        
        res.status(500).json({ 
            error: "Server error",
            message: error.message 
        });
    }
});

// Helper function to handle stream response
async function handleStreamResponse(response, res, userId, message) {
    let fullResponse = "";

    response.data.on("data", chunk => {
        const lines = chunk.toString().split("\n");
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));
                    if (data.generated_text) {
                        const content = data.generated_text;
                        fullResponse += content;
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
                    }
                } catch (error) {
                    logger.error("Error parsing streaming data:", error);
                }
            }
        }
    });

    response.data.on("end", async () => {
        try {
            // Save chat to MongoDB
            const chatEntry = new Chat({ 
                user_id: userId, 
                message, 
                response: fullResponse 
            });
            await chatEntry.save();

            // Invalidate user's chat history cache
            await deleteCache(`chat_history:${userId}:*`);

            res.write("data: [DONE]\n\n");
            res.end();
        } catch (error) {
            logger.error("Error saving chat:", error);
            res.write(`data: ${JSON.stringify({ error: "Error saving chat" })}\n\n`);
            res.end();
        }
    });

    response.data.on("error", error => {
        logger.error("Stream error:", error);
        res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
        res.end();
    });
}

module.exports = router;
