const Attendance = require('../models/Attendance');
const Class = require('../models/Class');
const Student = require('../models/Student');

// @desc    Get all attendances (filter by classId, studentId, date, status)
// @route   GET /api/attendances
exports.getAllAttendances = async (req, res, next) => {
    try {
        const { classId, studentId, date, status } = req.query;

        const query = {};
        if (classId) query.classId = classId;
        if (studentId) query.studentId = studentId;
        if (status) {
            const upperStatus = status.toUpperCase();
            if (!['PRESENT', 'ABSENT'].includes(upperStatus)) {
                const err = new Error("Invalid status query. Allowed values: 'PRESENT', 'ABSENT'");
                err.statusCode = 400;
                return next(err);
            }
            query.status = upperStatus;
        }
        if (date) {
            const targetDate = new Date(date);
            if (isNaN(targetDate.getTime())) {
                const err = new Error('Invalid date query format. Use YYYY-MM-DD');
                err.statusCode = 400;
                return next(err);
            }
            // Match the whole day (UTC)
            const startOfDay = new Date(targetDate);
            startOfDay.setUTCHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setUTCHours(23, 59, 59, 999);
            query.date = { $gte: startOfDay, $lte: endOfDay };
        }

        const attendances = await Attendance.find(query)
            .populate('studentId', 'studentCode fullName email')
            .populate('classId', 'className lecturerName status')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            total: attendances.length,
            data: attendances
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendance by ID
// @route   GET /api/attendances/:id
exports.getAttendanceById = async (req, res, next) => {
    try {
        const attendance = await Attendance.findById(req.params.id)
            .populate('studentId', 'studentCode fullName email')
            .populate('classId', 'className lecturerName status');

        if (!attendance) {
            const err = new Error(`Attendance not found with id ${req.params.id}`);
            err.statusCode = 404;
            return next(err);
        }

        res.status(200).json({
            success: true,
            data: attendance
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Record single attendance
// @route   POST /api/attendances
exports.recordAttendance = async (req, res, next) => {
    try {
        const { studentId, classId, date, status } = req.body;

        if (!studentId || !classId || !date || !status) {
            const err = new Error('studentId, classId, date, and status are all required');
            err.statusCode = 400;
            return next(err);
        }

        const upperStatus = status.toUpperCase();
        if (!['PRESENT', 'ABSENT'].includes(upperStatus)) {
            const err = new Error("status must be either 'PRESENT' or 'ABSENT'");
            err.statusCode = 400;
            return next(err);
        }

        const attendanceDate = new Date(date);
        if (isNaN(attendanceDate.getTime())) {
            const err = new Error('Invalid date format');
            err.statusCode = 400;
            return next(err);
        }

        // Validate Class
        const classObj = await Class.findById(classId);
        if (!classObj) {
            const err = new Error(`Class not found with id ${classId}`);
            err.statusCode = 404;
            return next(err);
        }

        if (classObj.status === 'CLOSED') {
            const err = new Error('Cannot record attendance: Class is CLOSED');
            err.statusCode = 400;
            return next(err);
        }

        // Validate Student exists
        const student = await Student.findById(studentId);
        if (!student) {
            const err = new Error(`Student not found with id ${studentId}`);
            err.statusCode = 404;
            return next(err);
        }

        // Validate Student is enrolled in Class
        const enrollment = classObj.enrollments.find(
            e => e.studentId.toString() === studentId.toString()
        );

        if (!enrollment) {
            const err = new Error(`Student ${student.studentCode} is not enrolled in class ${classObj.className}`);
            err.statusCode = 400;
            return next(err);
        }

        if (enrollment.status === 'dropped') {
            const err = new Error(`Student ${student.studentCode} has dropped class ${classObj.className}`);
            err.statusCode = 400;
            return next(err);
        }

        // Normalize date to midnight UTC for standard daily comparison
        const normalizedDate = new Date(attendanceDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        // Check if attendance already exists on that day
        const existingRecord = await Attendance.findOne({
            studentId,
            classId,
            date: normalizedDate
        });

        if (existingRecord) {
            const err = new Error(
                `Attendance for student ${student.studentCode} in class ${classObj.className} on ${normalizedDate.toISOString().split('T')[0]} has already been recorded`
            );
            err.statusCode = 409;
            return next(err);
        }

        const newAttendance = await Attendance.create({
            studentId,
            classId,
            date: normalizedDate,
            status: upperStatus
        });

        res.status(201).json({
            success: true,
            message: 'Attendance recorded successfully',
            data: newAttendance
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Record bulk attendance for an entire class on a given date
// @route   POST /api/attendances/bulk
exports.recordBulkAttendance = async (req, res, next) => {
    try {
        const { classId, date, attendances } = req.body;

        if (!classId || !date || !Array.isArray(attendances) || attendances.length === 0) {
            const err = new Error('classId, date, and a non-empty attendances array are required');
            err.statusCode = 400;
            return next(err);
        }

        const attendanceDate = new Date(date);
        if (isNaN(attendanceDate.getTime())) {
            const err = new Error('Invalid date format');
            err.statusCode = 400;
            return next(err);
        }
        const normalizedDate = new Date(attendanceDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const classObj = await Class.findById(classId);
        if (!classObj) {
            const err = new Error(`Class not found with id ${classId}`);
            err.statusCode = 404;
            return next(err);
        }

        if (classObj.status === 'CLOSED') {
            const err = new Error('Cannot record attendance: Class is CLOSED');
            err.statusCode = 400;
            return next(err);
        }

        const createdRecords = [];
        const errors = [];

        for (const item of attendances) {
            const { studentId, status } = item;
            const upperStatus = status ? status.toUpperCase() : null;

            if (!studentId || !['PRESENT', 'ABSENT'].includes(upperStatus)) {
                errors.push({ studentId, error: "Invalid studentId or status (must be PRESENT or ABSENT)" });
                continue;
            }

            const isEnrolled = classObj.enrollments.some(
                e => e.studentId.toString() === studentId.toString() && e.status === 'enrolled'
            );

            if (!isEnrolled) {
                errors.push({ studentId, error: 'Student is not actively enrolled in this class' });
                continue;
            }

            const existing = await Attendance.findOne({ studentId, classId, date: normalizedDate });
            if (existing) {
                errors.push({ studentId, error: 'Attendance already recorded for this date' });
                continue;
            }

            const record = await Attendance.create({
                studentId,
                classId,
                date: normalizedDate,
                status: upperStatus
            });
            createdRecords.push(record);
        }

        res.status(201).json({
            success: true,
            totalCreated: createdRecords.length,
            errorsCount: errors.length,
            data: createdRecords,
            errors: errors.length > 0 ? errors : undefined
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update attendance status (PRESENT <-> ABSENT)
// @route   PUT /api/attendances/:id
exports.updateAttendance = async (req, res, next) => {
    try {
        const { status } = req.body;

        if (!status) {
            const err = new Error('status is required');
            err.statusCode = 400;
            return next(err);
        }

        const upperStatus = status.toUpperCase();
        if (!['PRESENT', 'ABSENT'].includes(upperStatus)) {
            const err = new Error("status must be either 'PRESENT' or 'ABSENT'");
            err.statusCode = 400;
            return next(err);
        }

        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) {
            const err = new Error(`Attendance not found with id ${req.params.id}`);
            err.statusCode = 404;
            return next(err);
        }

        attendance.status = upperStatus;
        const updatedAttendance = await attendance.save();

        res.status(200).json({
            success: true,
            message: 'Attendance updated successfully',
            data: updatedAttendance
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendances/:id
exports.deleteAttendance = async (req, res, next) => {
    try {
        const attendance = await Attendance.findById(req.params.id);
        if (!attendance) {
            const err = new Error(`Attendance not found with id ${req.params.id}`);
            err.statusCode = 404;
            return next(err);
        }

        await Attendance.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Attendance record deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendance report & exam eligibility for a class
// @route   GET /api/attendances/report/class/:classId
exports.getClassAttendanceReport = async (req, res, next) => {
    try {
        const { classId } = req.params;

        const classObj = await Class.findById(classId)
            .populate('subjectId', 'code name credits')
            .populate('enrollments.studentId', 'studentCode fullName email');

        if (!classObj) {
            const err = new Error(`Class not found with id ${classId}`);
            err.statusCode = 404;
            return next(err);
        }

        // Get all attendance records of this class
        const attendances = await Attendance.find({ classId });

        // Total distinct dates in this class
        const distinctDates = [...new Set(attendances.map(a => a.date.toISOString().split('T')[0]))];
        const totalSessions = distinctDates.length;

        // Group attendance by student
        const studentReports = classObj.enrollments.map(item => {
            const student = item.studentId;
            if (!student) {
                return null;
            }

            const studentAttendances = attendances.filter(
                a => a.studentId.toString() === student._id.toString()
            );

            const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
            const absentCount = studentAttendances.filter(a => a.status === 'ABSENT').length;
            const recordedCount = presentCount + absentCount;

            const absentPercentage = totalSessions > 0 ? ((absentCount / totalSessions) * 100).toFixed(1) : 0;
            const isEligible = parseFloat(absentPercentage) <= 20.0;

            return {
                studentId: student._id,
                studentCode: student.studentCode,
                fullName: student.fullName,
                email: student.email,
                enrollmentStatus: item.status,
                totalClassSessions: totalSessions,
                attendedSessions: recordedCount,
                presentCount,
                absentCount,
                absentPercentage: `${absentPercentage}%`,
                examEligibility: isEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
            };
        }).filter(Boolean);

        res.status(200).json({
            success: true,
            classInfo: {
                _id: classObj._id,
                className: classObj.className,
                subject: classObj.subjectId,
                lecturerName: classObj.lecturerName,
                status: classObj.status,
                totalSessionsRecorded: totalSessions
            },
            report: studentReports
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get attendance report for a specific student
// @route   GET /api/attendances/report/student/:studentId
exports.getStudentAttendanceReport = async (req, res, next) => {
    try {
        const { studentId } = req.params;
        const { classId } = req.query;

        const student = await Student.findById(studentId);
        if (!student) {
            const err = new Error(`Student not found with id ${studentId}`);
            err.statusCode = 404;
            return next(err);
        }

        const classQuery = { 'enrollments.studentId': studentId };
        if (classId) classQuery._id = classId;

        const classes = await Class.find(classQuery).populate('subjectId', 'code name credits');

        const reports = [];

        for (const cls of classes) {
            const allClassAttendances = await Attendance.find({ classId: cls._id });
            const distinctDates = [...new Set(allClassAttendances.map(a => a.date.toISOString().split('T')[0]))];
            const totalSessions = distinctDates.length;

            const studentAttendances = allClassAttendances.filter(
                a => a.studentId.toString() === studentId.toString()
            );

            const presentCount = studentAttendances.filter(a => a.status === 'PRESENT').length;
            const absentCount = studentAttendances.filter(a => a.status === 'ABSENT').length;
            const absentPercentage = totalSessions > 0 ? ((absentCount / totalSessions) * 100).toFixed(1) : 0;
            const isEligible = parseFloat(absentPercentage) <= 20.0;

            reports.push({
                classId: cls._id,
                className: cls.className,
                subject: cls.subjectId,
                lecturerName: cls.lecturerName,
                totalSessions,
                presentCount,
                absentCount,
                absentPercentage: `${absentPercentage}%`,
                examEligibility: isEligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE'
            });
        }

        res.status(200).json({
            success: true,
            student: {
                _id: student._id,
                studentCode: student.studentCode,
                fullName: student.fullName,
                email: student.email
            },
            classesReport: reports
        });
    } catch (error) {
        next(error);
    }
};

