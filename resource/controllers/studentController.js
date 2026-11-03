const mongoose = require('mongoose');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

exports.getStudentsInClass = async (req, res, next) => {
    try {
        const { classId } = req.params;

        if (!mongoose.isObjectIdOrHexString(classId)) {
            return res.status(400).json({ message: 'Invalid classId format' });
        }

        const classObj = await Class.findById(classId).populate('enrollments.studentId', 'studentCode fullName email');
        if (!classObj) {
            return res.status(401).json({ message: 'Class not found' });
        }

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

        const enrollments = classObj.enrollments || [];
        const matchedEnrollments = enrollments.filter(item => {
            return item.status && item.status.toLowerCase() === statusParam && item.studentId;
        });

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

exports.getStudentAttendanceHistory = async (req, res, next) => {
    try {
        const studentId = req.params.studentId || req.params.id;

        if (!mongoose.isObjectIdOrHexString(studentId)) {
            return res.status(400).json({ message: 'Invalid studentId format' });
        }

        const student = await Student.findById(studentId);
        const classObj = !student ? await Class.findById(studentId) : null;

        if (!student && !classObj) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const query = student ? { studentId } : { classId: studentId };
        const attendances = await Attendance.find(query)
            .populate('classId', 'className status lecturerName subjectId')
            .populate('studentId', 'studentCode fullName email')
            .sort({ date: -1 });

        const history = attendances.map(a => {
            const cls = a.classId;
            const stu = a.studentId;
            return {
                _id: a._id,
                attendanceId: a._id,
                studentId: stu?._id || a.studentId,
                studentCode: stu?.studentCode,
                fullName: stu?.fullName,
                email: stu?.email,
                classId: cls?._id || a.classId,
                className: cls?.className,
                class: cls,
                student: stu,
                date: a.date,
                status: a.status,
                createdAt: a.createdAt,
                updatedAt: a.updatedAt
            };
        });

        return res.status(200).json(history);
    } catch (error) {
        if (next) next(error);
        else return res.status(500).json({ message: error.message });
    }
};

exports.createOrUpdateMultipleAttendances = async (req, res, next) => {
    try {
        const paramId = req.params.studentId || req.params.classId || req.params.id;

        if (paramId && !mongoose.isObjectIdOrHexString(paramId)) {
            return res.status(400).json({ message: 'Invalid ID format' });
        }

        let classObj = null;
        let studentObj = null;
        if (paramId) {
            classObj = await Class.findById(paramId);
            if (!classObj) {
                studentObj = await Student.findById(paramId);
            }
            if (!classObj && !studentObj) {
                return res.status(404).json({ message: 'Class or Student not found' });
            }
        }

        let rawList = [];
        if (Array.isArray(req.body)) {
            rawList = req.body;
        } else if (req.body && Array.isArray(req.body.attendances)) {
            rawList = req.body.attendances.map(item => ({
                ...item,
                date: item.date || req.body.date,
                classId: item.classId || req.body.classId,
                studentId: item.studentId || req.body.studentId
            }));
        } else if (req.body && Array.isArray(req.body.records)) {
            rawList = req.body.records.map(item => ({
                ...item,
                date: item.date || req.body.date,
                classId: item.classId || req.body.classId,
                studentId: item.studentId || req.body.studentId
            }));
        } else if (req.body && req.body.status) {
            rawList = [req.body];
        }

        if (rawList.length === 0) {
            return res.status(400).json({ message: 'Attendance records are required' });
        }

        const results = [];
        for (const item of rawList) {
            const studentId = item.studentId || (studentObj ? studentObj._id.toString() : null) || (!classObj ? paramId : null) || req.body.studentId;
            const classId = item.classId || (classObj ? classObj._id.toString() : null) || (!studentObj ? paramId : null) || req.body.classId;
            const dateStr = item.date || req.body.date;
            const status = item.status ? String(item.status).toUpperCase() : null;

            if (!studentId || !classId || !dateStr || !status) {
                return res.status(400).json({ message: 'studentId, classId, date, and status are required for each record' });
            }

            if (!mongoose.isObjectIdOrHexString(studentId) || !mongoose.isObjectIdOrHexString(classId)) {
                return res.status(400).json({ message: 'Invalid studentId or classId format' });
            }

            if (!['PRESENT', 'ABSENT'].includes(status)) {
                return res.status(400).json({ message: 'status must be PRESENT or ABSENT' });
            }

            const parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ message: 'Invalid date format' });
            }
            const normalizedDate = new Date(parsedDate);
            normalizedDate.setUTCHours(0, 0, 0, 0);

            const record = await Attendance.findOneAndUpdate(
                { studentId, classId, date: normalizedDate },
                { studentId, classId, date: normalizedDate, status },
                { new: true, upsert: true, setDefaultsOnInsert: true }
            );
            results.push(record);
        }

        return res.status(200).json(results);
    } catch (error) {
        if (next) next(error);
        else return res.status(500).json({ message: error.message });
    }
};

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

exports.deleteStudent = async (req, res, next) => {
    try {
        const studentId = req.params.id;

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: `Student not found with id ${studentId}` });
        }

        const enrolledClass = await Class.findOne({ 'enrollments.studentId': studentId });
        if (enrolledClass) {
            return res.status(400).json({
                message: `Cannot delete student: Student is currently enrolled in class '${enrolledClass.className}'`
            });
        }

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
