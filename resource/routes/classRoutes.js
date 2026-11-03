const express = require('express');
const router = express.Router();
const {
    getAllClasses,
    getClassById,
    getStudentsInClass,
    getAttendanceSummary,
    createOrUpdateMultipleAttendances,
    createClass,
    updateClass,
    deleteClass,
    enrollStudent,
    updateEnrollmentStatus,
    removeStudentFromClass
} = require('../controllers/classController');
const { verifyToken } = require('../middlewares/auth');

router.route('/')
    .get(getAllClasses)
    .post(createClass);

router.get('/:classId/students', verifyToken, getStudentsInClass);
router.get('/:classId/student', verifyToken, getStudentsInClass);

router.get('/:classId/attendance-summary', getAttendanceSummary);
router.get('/:id/attendance-summary', getAttendanceSummary);

router.post('/:studentId/attendances', createOrUpdateMultipleAttendances);
router.post('/:classId/attendances', createOrUpdateMultipleAttendances);
router.post('/:id/attendances', createOrUpdateMultipleAttendances);

router.route('/:id')
    .get(getClassById)
    .put(updateClass)
    .delete(deleteClass);

router.post('/:id/enroll', enrollStudent);
router.patch('/:id/enrollments/:studentId', updateEnrollmentStatus);
router.delete('/:id/enrollments/:studentId', removeStudentFromClass);

module.exports = router;
