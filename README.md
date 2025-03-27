# SIR Backend - AI Chat Application

A robust backend service for an AI-powered chat application using Express.js, MongoDB, Redis, and LM Studio.

## Features

- 🔐 JWT Authentication
- 💬 Real-time AI chat using LM Studio
- 📝 Chat history with pagination
- 🚀 Redis caching for improved performance
- 🔒 Rate limiting and security features
- 📊 Comprehensive logging
- 👥 User management with roles
- 🧪 Input validation
- 🚦 Error handling

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- LM Studio (for local AI model)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/sir-backend.git
cd sir-backend
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
JWT_SECRET=your_secure_secret_here
MONGO_URI=your_mongodb_uri
REDIS_URL=your_redis_url
```

5. Start LM Studio and load your model (e.g., Mistral 7B)

## Running the Application

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user
- `GET /api/auth/users` - Get all users (admin only)

### Chat
- `GET /api/chat/history` - Get chat history (authenticated)
- `POST /api/chat` - Send message to AI (authenticated)

## Testing

Run tests:
```bash
npm test
```

## Security Features

- JWT Authentication
- Password hashing with bcrypt
- Rate limiting
- CORS protection
- Helmet security headers
- Input validation
- Error handling
- Request size limits

## Performance Optimizations

- Redis caching for chat history
- Pagination for large datasets
- Compression middleware
- Connection pooling
- Request timeout handling

## Monitoring

- Winston logging
- Health check endpoint
- Error tracking
- Request logging

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

ISC

## Support

For support, please open an issue in the GitHub repository. 