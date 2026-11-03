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
const { getAttendanceSummary, createOrUpdateMultipleAttendances } = require('../controllers/classController');
const { getStudentAttendanceHistory } = require('../controllers/studentController');

router.get('/report/class/:classId', getClassAttendanceReport);
router.get('/report/student/:studentId', getStudentAttendanceReport);

router.get('/classes/:classId/attendance-summary', getAttendanceSummary);
router.get('/students/:studentId/attendances', getStudentAttendanceHistory);
router.get('/students/:studentId/attendanceExists', getStudentAttendanceHistory);

router.post('/bulk', recordBulkAttendance);
router.post('/classes/:studentId/attendances', createOrUpdateMultipleAttendances);
router.post('/classes/:classId/attendances', createOrUpdateMultipleAttendances);

router.route('/')
    .get(getAllAttendances)
    .post(recordAttendance);

router.route('/:id')
    .get(getAttendanceById)
    .put(updateAttendance)
    .delete(deleteAttendance);

module.exports = router;
