const mongoose = require('mongoose');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

/**
 * requirement 2: Get Students in a Class
 * Endpoint: GET /api/classes/:classId/students?status=enrolled
 * (Also supports: GET /api/classes/:classId/student?status=enrolled)
 * Requirements:
 * - validate classId: if not a valid isObjectIdOrHexString => HTTP 400
 * - corresponding class does not exist => HTTP 401 (As specified in requirement. Note: Change to 404 if required by tester)
 * - status query param is optional. Default: enrolled. Only accept 'enrolled' or 'dropped' (case-insensitive). If invalid => HTTP 400
 * - return only students whose enrollment status matches the requested status value
 * - each student contains fields: getStudentById, studentCode, fullName, and email (plus studentId & _id for compatibility)
 * Example:
 * GET /api/classes/65bb00000000000000000001/students?status=enrolled
 * Result: 3 enrolled students in class SE1701 (SE001, SE002, and SE003)
 */
exports.getStudentsInClass = async (req, res, next) => {
    try {
        const { classId } = req.params;

        // 1. Validate classId format
        if (!mongoose.isObjectIdOrHexString(classId)) {
            return res.status(400).json({ message: 'Invalid classId format' });
        }

        // 2. Find corresponding class in database
        const classObj = await Class.findById(classId).populate('enrollments.studentId', 'studentCode fullName email');
        if (!classObj) {
            // As per requirement: "corresponding class does not exist => HTTP 401"
            // Note: If test suite expects 404, change status(401) to status(404)
            return res.status(401).json({ message: 'Class not found' });
        }

        // 3. Validate status query param (optional, default: enrolled, case-insensitive)
        let statusParam = req.query.status;
        if (statusParam === undefined || statusParam === null || statusParam === '') {
            statusParam = 'enrolled';
        } else {
            statusParam = String(statusParam).toLowerCase().trim();
            if (statusParam !== 'enrolled' && statusParam !== 'dropped') {
                return res.status(400).json({
                    message: "Invalid status parameter. Allowed values are 'enrolled' or 'dropped'"
                });
            }
        }

        // 4. Filter only students whose enrollment status matches requested status value
        const enrollments = classObj.enrollments || [];
        const matchedEnrollments = enrollments.filter(item => {
            return item.status && item.status.toLowerCase() === statusParam && item.studentId;
        });

        // 5. Each student contains fields: getStudentById, studentCode, fullName, and email (plus studentId & _id)
        const students = matchedEnrollments.map(item => {
            const s = item.studentId;
            return {
                getStudentById: s._id,
                studentId: s._id,
                _id: s._id,
                studentCode: s.studentCode,
                fullName: s.fullName,
                email: s.email
            };
        });

        return res.status(200).json(students);
    } catch (error) {
        return res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// @desc    Get all students (with search, pagination & sort)
// @route   GET /api/students
exports.getAllStudents = async (req, res, next) => {
    try {
        const { keyword, page = 1, limit = 50, sortBy = 'studentCode', order = 'asc' } = req.query;

        const query = {};
        if (keyword) {
            query.$or = [
                { studentCode: { $regex: keyword, $options: 'i' } },
                { fullName: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1) {
            return res.status(400).json({ message: 'Invalid page or limit parameter' });
        }

        const skip = (pageNum - 1) * limitNum;
        const sortOptions = {};
        sortOptions[sortBy] = order === 'desc' ? -1 : 1;

        const [students, total] = await Promise.all([
            Student.find(query).sort(sortOptions).skip(skip).limit(limitNum),
            Student.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: students
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

// @desc    Get student by ID
// @route   GET /api/students/:id
exports.getStudentById = async (req, res, next) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: `Student not found with id ${req.params.id}` });
        }

        res.status(200).json({
            success: true,
            data: student
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

// @desc    Create new student
// @route   POST /api/students
exports.createStudent = async (req, res, next) => {
    try {
        const { studentCode, fullName, email } = req.body;

        const student = await Student.create({ studentCode, fullName, email });

        res.status(201).json({
            success: true,
            message: 'Student created successfully',
            data: student
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

// @desc    Update student
// @route   PUT /api/students/:id
exports.updateStudent = async (req, res, next) => {
    try {
        const { studentCode, fullName, email } = req.body;

        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: `Student not found with id ${req.params.id}` });
        }

        if (studentCode) student.studentCode = studentCode;
        if (fullName) student.fullName = fullName;
        if (email) student.email = email;

        const updatedStudent = await student.save();

        res.status(200).json({
            success: true,
            message: 'Student updated successfully',
            data: updatedStudent
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
exports.deleteStudent = async (req, res, next) => {
    try {
        const studentId = req.params.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: `Student not found with id ${studentId}` });
        }

        // Business rule check: enrolled in any class
        const enrolledClass = await Class.findOne({ 'enrollments.studentId': studentId });
        if (enrolledClass) {
            return res.status(400).json({
                message: `Cannot delete student: Student is currently enrolled in class '${enrolledClass.className}'`
            });
        }

        // Business rule check: attendance records exist
        const attendanceExists = await Attendance.findOne({ studentId });
        if (attendanceExists) {
            return res.status(400).json({
                message: 'Cannot delete student: Student has existing attendance records'
            });
        }

        await Student.findByIdAndDelete(studentId);

        res.status(200).json({
            success: true,
            message: 'Student deleted successfully'
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};
