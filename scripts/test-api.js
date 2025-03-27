const axios = require('axios');
const logger = require('../utils/logger');
require('dotenv').config();

const BASE_URL = 'http://localhost:8001/api';
const LM_STUDIO_URL = process.env.LM_STUDIO_API_URL;
let authToken = '';

// Test LM Studio API connection
async function testLMStudioConnection() {
    try {
        logger.info('Testing LM Studio API connection...');
        logger.info(`Using URL: ${LM_STUDIO_URL}`);

        // First test the models endpoint
        const modelsResponse = await axios.get(`${LM_STUDIO_URL}/v1/models`);
        logger.info('✅ Models endpoint working');
        logger.info('Available models:', JSON.stringify(modelsResponse.data, null, 2));

        // Then test the chat completions endpoint
        const chatResponse = await axios.post(
            `${LM_STUDIO_URL}/v1/chat/completions`,
            {
                model: process.env.LM_STUDIO_MODEL,
                messages: [{ role: "user", content: "Hello" }],
                temperature: 0.7,
                max_tokens: 100
            }
        );
        logger.info('✅ Chat completions endpoint working');
        logger.info('Response:', JSON.stringify(chatResponse.data, null, 2));
        return true;
    } catch (error) {
        logger.error('❌ LM Studio API test failed:', error.message);
        if (error.response) {
            logger.error('Response data:', error.response.data);
            logger.error('Response status:', error.response.status);
            logger.error('Response headers:', error.response.headers);
        }
        return false;
    }
}

const testEndpoints = async () => {
    try {
        // Test environment variables
        logger.info('Testing environment variables...');
        const envResponse = await axios.get(`${BASE_URL}/chat/test-env`);
        logger.info('Environment test response:', JSON.stringify(envResponse.data, null, 2));

        // First try to login with test credentials
        logger.info('Attempting to login with test credentials...');
        try {
            const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
                email: 'test@example.com',
                password: 'Test123!'
            });
            authToken = loginResponse.data.token;
            logger.info('Login successful with existing test user');
        } catch (loginError) {
            // If login fails, proceed with registration
            logger.info('Login failed, proceeding with registration...');

            // Test user registration
            logger.info('Testing user registration...');
            const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
                name: 'Test User',
                email: 'test@example.com',
                password: 'Test123!'
            });
            logger.info('Registration response:', JSON.stringify(registerResponse.data, null, 2));
            authToken = registerResponse.data.token;
        }

        // Test get user profile
        logger.info('Testing get user profile...');
        const profileResponse = await axios.get(`${BASE_URL}/auth/me`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        logger.info('Profile response:', JSON.stringify(profileResponse.data, null, 2));

        // Test chat endpoints only if LM Studio is running
        logger.info('Checking if LM Studio is running...');
        const isLMStudioRunning = await testLMStudioConnection();
        
        if (isLMStudioRunning) {
            // Test create chat
            logger.info('Testing create chat...');
            const createChatResponse = await axios.post(`${BASE_URL}/chat`, {
                message: 'Hello, this is a test message'
            }, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            logger.info('Create chat response:', JSON.stringify(createChatResponse.data, null, 2));

            // Test get all chats
            logger.info('Testing get all chats...');
            const getAllChatsResponse = await axios.get(`${BASE_URL}/chat/history`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            logger.info('Get all chats response:', JSON.stringify(getAllChatsResponse.data, null, 2));

            // Test get specific chat
            if (createChatResponse.data.chat) {
                logger.info('Testing get specific chat...');
                const getChatResponse = await axios.get(`${BASE_URL}/chat/${createChatResponse.data.chat._id}`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                logger.info('Get specific chat response:', JSON.stringify(getChatResponse.data, null, 2));

                // Test delete chat
                logger.info('Testing delete chat...');
                const deleteChatResponse = await axios.delete(`${BASE_URL}/chat/${createChatResponse.data.chat._id}`, {
                    headers: { Authorization: `Bearer ${authToken}` }
                });
                logger.info('Delete chat response:', JSON.stringify(deleteChatResponse.data, null, 2));
            }
        } else {
            logger.warn('Skipping chat tests due to LM Studio not being available');
        }

        logger.info('All tests completed successfully!');
    } catch (error) {
        if (error.response) {
            logger.error('Error response:', {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers
            });
        } else if (error.request) {
            logger.error('No response received:', error.request);
        } else {
            logger.error('Error setting up request:', error.message);
        }
        logger.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
    }
};

testEndpoints(); 