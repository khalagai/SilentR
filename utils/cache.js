const Redis = require("redis");
const logger = require("./logger");

const redisClient = Redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379"
});

redisClient.on("error", (err) => {
    logger.error("Redis Client Error:", err);
});

redisClient.on("connect", () => {
    logger.info("Redis Client Connected");
});

const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        logger.error("Redis Connection Error:", error);
        process.exit(1);
    }
};

const getCache = async (key) => {
    try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        logger.error("Redis Get Error:", error);
        return null;
    }
};

const setCache = async (key, value, expireTime = 3600) => {
    try {
        await redisClient.set(key, JSON.stringify(value), {
            EX: expireTime
        });
    } catch (error) {
        logger.error("Redis Set Error:", error);
    }
};

const deleteCache = async (key) => {
    try {
        await redisClient.del(key);
    } catch (error) {
        logger.error("Redis Delete Error:", error);
    }
};

module.exports = {
    connectRedis,
    getCache,
    setCache,
    deleteCache
}; 