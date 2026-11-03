const express = require('express');
const router = express.Router();
const {
    getAllClasses,
    getClassById,
    getStudentsInClass,
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

// Requirement 2: GET /api/classes/:classId/students?status=enrolled
// Protected with verifyToken middleware as required by 3.3
router.get('/:classId/students', verifyToken, getStudentsInClass);
router.get('/:classId/student', verifyToken, getStudentsInClass);

router.route('/:id')
    .get(getClassById)
    .put(updateClass)
    .delete(deleteClass);

// Enrollment operations
router.post('/:id/enroll', enrollStudent);
router.patch('/:id/enrollments/:studentId', updateEnrollmentStatus);
router.delete('/:id/enrollments/:studentId', removeStudentFromClass);

module.exports = router;

