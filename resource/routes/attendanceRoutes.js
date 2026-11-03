const express = require('express');
const router = express.Router();
const {
    getAllAttendances,
    getAttendanceById,
    recordAttendance,
    recordBulkAttendance,
    updateAttendance,
    deleteAttendance,
    getClassAttendanceReport,
    getStudentAttendanceReport
} = require('../controllers/attendanceController');

// Reports
router.get('/report/class/:classId', getClassAttendanceReport);
router.get('/report/student/:studentId', getStudentAttendanceReport);

// Bulk attendance
router.post('/bulk', recordBulkAttendance);

// General CRUD
router.route('/')
    .get(getAllAttendances)
    .post(recordAttendance);

router.route('/:id')
    .get(getAttendanceById)
    .put(updateAttendance)
    .delete(deleteAttendance);

module.exports = router;

