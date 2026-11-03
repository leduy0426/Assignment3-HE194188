const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const { verifyToken } = require('./middlewares/auth');

const studentRoutes = require('./routes/studentRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const seedRoutes = require('./routes/seedRoutes');
const { getStudentsInClass } = require('./controllers/studentController');

const app = express();

// Connect to MongoDB
connectDB();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

// =========================================================================
// REQUIREMENT 1: Login and JWT Authentication
// =========================================================================
// Test account information
const users = [
    {
        studentId: 'HE194188',
        email: 'he194188@fpt.edu.vn',
        password: 'he194188@123'
    }
];

/**
 * 3.1. Login:
 * endpoint: POST /api/auth/login
 * req body: {
 *     "email": "he194188@fpt.edu.vn",
 *     "password": "he194188@123"
 * }
 * require:
 * - validate the email and password using the authentication mechanism/test account configured in the project.
 * - if either field is missing or the login credentials are incorrect, return HTTP 401
 * - if login is success, generate a JWT using the pre-installed jsonwebtoken package
 * - the jwt payload must contain the user's identification information, at least studentId
 * - set the token expiration time to 1 hour
 * - return the token in JSON response:
 * {
 *     "message": "Login succesfully",
 *     "token": "<JWT_TOKEN>"
 * }
 */
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};

    // Validate if either field is missing -> HTTP 401
    if (!email || !password) {
        return res.status(401).json({
            message: 'Email and password are required'
        });
    }

    // Validate credentials with test account -> HTTP 401 if incorrect
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({
            message: 'Invalid email or password'
        });
    }

    // JWT payload contains at least studentId
    const payload = {
        studentId: user.studentId,
        email: user.email
    };

    // Generate JWT expiring in 1 hour
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'HE194188', {
        expiresIn: '1h'
    });

    return res.status(200).json({
        message: 'Login succesfully',
        token: token
    });
});

// Welcome route
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Welcome to SDN302 Practical Exam API!',
        student: 'HE194188',
        endpoints: {
            auth: 'POST /api/auth/login',
            students: '/api/students',
            subjects: '/api/subjects',
            classes: '/api/classes',
            attendances: '/api/attendances',
            seed: 'POST /api/seed (reset database)'
        }
    });
});

// =========================================================================
// REQUIREMENT 2 & 3.3: Protected Class & Student routes
// =========================================================================
// GET /api/classes/:classId/students?status=enrolled (and /student)
// Protected by verifyToken middleware
app.get('/api/classes/:classId/students', verifyToken, getStudentsInClass);
app.get('/api/classes/:classId/student', verifyToken, getStudentsInClass);

// Mount Routes
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/seed', seedRoutes);

// Catch 404 for undefined routes
app.use((req, res, next) => {
    const error = new Error(`Resource not found at ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 9999;
if (process.env.NODE_ENV !== 'test_export') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = { app, verifyToken };
