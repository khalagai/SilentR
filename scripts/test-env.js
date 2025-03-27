require('dotenv').config();
const mongoose = require('mongoose');
const Redis = require('redis');

async function testEnvironment() {
    console.log('Testing environment variables...\n');

    // Test MongoDB connection
    console.log('Testing MongoDB connection...');
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connection successful');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error.message);
    }

    // Test Redis connection
    console.log('\nTesting Redis connection...');
    try {
        const redisClient = Redis.createClient({
            url: process.env.REDIS_URL
        });
        await redisClient.connect();
        console.log('✅ Redis connection successful');
        await redisClient.disconnect();
    } catch (error) {
        console.error('❌ Redis connection failed:', error.message);
    }

    // Display other environment variables
    console.log('\nEnvironment Variables Status:');
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    console.log('JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Not set');

    // Cleanup
    await mongoose.disconnect();
}

testEnvironment().catch(console.error); 