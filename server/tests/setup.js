process.env.NODE_ENV = "test";
process.env.MONGO_URI = "mongodb://localhost:27017/test";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET = "a".repeat(40);
process.env.JWT_REFRESH_SECRET = "b".repeat(40);
process.env.CSRF_SECRET = "c".repeat(40);
process.env.CORS_ORIGINS = "http://localhost:5173";
