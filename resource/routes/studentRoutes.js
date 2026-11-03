const express = require('express');
const router = express.Router();
const {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getStudentAttendanceHistory,
    createOrUpdateMultipleAttendances
} = require('../controllers/studentController');
const { verifyToken } = require('../middlewares/auth');

router.route('/')
    .get(getAllStudents)
    .post(createStudent);

router.get('/:studentId/attendances', verifyToken, getStudentAttendanceHistory);
router.get('/:studentId/attendanceExists', verifyToken, getStudentAttendanceHistory);
router.get('/:id/attendances', verifyToken, getStudentAttendanceHistory);
router.get('/:id/attendanceExists', verifyToken, getStudentAttendanceHistory);

router.post('/:classId/attendances', createOrUpdateMultipleAttendances);
router.post('/:studentId/attendances', createOrUpdateMultipleAttendances);
router.post('/:id/attendances', createOrUpdateMultipleAttendances);

router.route('/:id')
    .get(getStudentById)
    .put(updateStudent)
    .delete(deleteStudent);

module.exports = router;
