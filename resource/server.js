const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const errorHandler = require('./middlewares/errorHandler');
const { verifyToken } = require('./middlewares/auth');

const studentRoutes = require('./routes/studentRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const classRoutes = require('./routes/classRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const seedRoutes = require('./routes/seedRoutes');
const { getStudentsInClass, getStudentAttendanceHistory } = require('./controllers/studentController');
const { getAttendanceSummary, createOrUpdateMultipleAttendances } = require('./controllers/classController');

const app = express();

connectDB();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
}

const users = [
    {
        studentId: 'HE194188',
        email: 'he194188@fpt.edu.vn',
        password: 'he194188@123'
    }
];

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(401).json({
            message: 'Email and password are required'
        });
    }

    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
        return res.status(401).json({
            message: 'Invalid email or password'
        });
    }

    const payload = {
        studentId: user.studentId,
        email: user.email
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'HE194188', {
        expiresIn: '1h'
    });

    return res.status(200).json({
        message: 'Login succesfully',
        token: token
    });
});

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

app.get('/api/classes/:classId/students', verifyToken, getStudentsInClass);
app.get('/api/classes/:classId/student', verifyToken, getStudentsInClass);

app.get('/api/classes/:classId/attendance-summary', getAttendanceSummary);
app.get('/api/students/:studentId/attendances', getStudentAttendanceHistory);
app.get('/api/students/:studentId/attendanceExists', getStudentAttendanceHistory);
app.post('/api/classes/:studentId/attendances', createOrUpdateMultipleAttendances);
app.post('/api/classes/:classId/attendances', createOrUpdateMultipleAttendances);
app.post('/api/students/:studentId/attendances', createOrUpdateMultipleAttendances);

app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/attendances', attendanceRoutes);
app.use('/api/seed', seedRoutes);

app.use((req, res, next) => {
    const error = new Error(`Resource not found at ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
});

app.use(errorHandler);

const PORT = process.env.PORT || 9999;
if (process.env.NODE_ENV !== 'test_export') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = { app, verifyToken };
