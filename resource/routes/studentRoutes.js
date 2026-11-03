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

router.route('/')
    .get(getAllStudents)
    .post(createStudent);

router.get('/:studentId/attendances', getStudentAttendanceHistory);
router.get('/:studentId/attendanceExists', getStudentAttendanceHistory);
router.get('/:id/attendances', getStudentAttendanceHistory);
router.get('/:id/attendanceExists', getStudentAttendanceHistory);

router.post('/:studentId/attendances', createOrUpdateMultipleAttendances);
router.post('/:id/attendances', createOrUpdateMultipleAttendances);

router.route('/:id')
    .get(getStudentById)
    .put(updateStudent)
    .delete(deleteStudent);

module.exports = router;
