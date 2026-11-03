const mongoose = require('mongoose');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

exports.getAllClasses = async (req, res, next) => {
    try {
        const { status, subjectId, lecturerName } = req.query;

        const query = {};
        if (status) {
            if (!['OPEN', 'CLOSED'].includes(status.toUpperCase())) {
                return res.status(400).json({ message: "Invalid status. Allowed values are 'OPEN' or 'CLOSED'" });
            }
            query.status = status.toUpperCase();
        }

        if (subjectId) {
            query.subjectId = subjectId;
        }

        if (lecturerName) {
            query.lecturerName = { $regex: lecturerName, $options: 'i' };
        }

        const classes = await Class.find(query)
            .populate('subjectId', 'code name credits status')
            .populate('enrollments.studentId', 'studentCode fullName email')
            .sort({ className: 1 });

        res.status(200).json({
            success: true,
            total: classes.length,
            data: classes
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.getClassById = async (req, res, next) => {
    try {
        const classObj = await Class.findById(req.params.id)
            .populate('subjectId', 'code name credits status')
            .populate('enrollments.studentId', 'studentCode fullName email');

        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${req.params.id}` });
        }

        res.status(200).json({
            success: true,
            data: classObj
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.getStudentsInClass = async (req, res, next) => {
    try {
        const { classId } = req.params;

        if (!mongoose.isObjectIdOrHexString(classId)) {
            return res.status(400).json({ message: 'Invalid classId format' });
        }

        const classObj = await Class.findById(classId).populate('enrollments.studentId', 'studentCode fullName email');
        if (!classObj) {
            return res.status(404).json({ message: 'Class not found' });
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
                studentId: s._id,
                _id: s._id,
                getStudentById: s._id,
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

exports.getAttendanceSummary = async (req, res, next) => {
    try {
        const { classId } = req.params;

        if (!mongoose.isObjectIdOrHexString(classId)) {
            return res.status(400).json({ message: 'Invalid classId format' });
        }

        const classObj = await Class.findById(classId).populate('enrollments.studentId', 'studentCode fullName email');
        if (!classObj) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const attendances = await Attendance.find({ classId }).populate('studentId', 'studentCode fullName email');

        const distinctDates = [...new Set(attendances.map(a => new Date(a.date).toISOString().split('T')[0]))];
        const totalClassSessions = distinctDates.length;

        const enrolledItems = (classObj.enrollments || []).filter(item => {
            return item.status && item.status.toLowerCase() === 'enrolled' && item.studentId;
        });

        const summary = enrolledItems.map(item => {
            const student = item.studentId;
            const studentAttendances = attendances.filter(a => {
                const sId = a.studentId?._id ? a.studentId._id.toString() : (a.studentId ? a.studentId.toString() : '');
                return sId === student._id.toString();
            });

            if (studentAttendances.length === 0) {
                return {
                    Student: student.studentCode,
                    student: student.studentCode,
                    studentCode: student.studentCode,
                    studentId: student._id,
                    fullName: student.fullName,
                    "Total Sesions": 0,
                    "Total Sessions": 0,
                    totalSessions: 0,
                    Present: 0,
                    present: 0,
                    Absent: 0,
                    absent: 0,
                    "Attendance Rate": "0.0%",
                    attendanceRate: "0.0%",
                    Warning: true,
                    warning: true
                };
            }

            const present = studentAttendances.filter(a => a.status === 'PRESENT').length;
            const absent = studentAttendances.filter(a => a.status === 'ABSENT').length;
            const totalSessions = totalClassSessions || (present + absent);
            const rawRate = totalSessions > 0 ? (present / totalSessions) * 100 : 0;
            const roundedRate = Math.round(rawRate * 10) / 10;
            const attendanceRate = `${roundedRate.toFixed(1)}%`;
            const warning = roundedRate < 80;

            return {
                Student: student.studentCode,
                student: student.studentCode,
                studentCode: student.studentCode,
                studentId: student._id,
                fullName: student.fullName,
                "Total Sesions": totalSessions,
                "Total Sessions": totalSessions,
                totalSessions: totalSessions,
                Present: present,
                present: present,
                Absent: absent,
                absent: absent,
                "Attendance Rate": attendanceRate,
                attendanceRate: attendanceRate,
                Warning: warning,
                warning: warning
            };
        });

        summary.sort((a, b) => (a.studentCode || '').localeCompare(b.studentCode || ''));

        return res.status(200).json(summary);
    } catch (error) {
        if (next) next(error);
        else return res.status(500).json({ message: error.message });
    }
};

exports.createClass = async (req, res, next) => {
    try {
        const { className, subjectId, lecturerName, status } = req.body;

        if (!className || !subjectId || !lecturerName) {
            return res.status(400).json({ message: 'className, subjectId, and lecturerName are required' });
        }

        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({ message: `Subject not found with id ${subjectId}` });
        }
        if (subject.status !== 'ACTIVE') {
            return res.status(400).json({ message: `Cannot create class for subject '${subject.code}' because it is INACTIVE` });
        }

        const newClass = await Class.create({
            className,
            subjectId,
            lecturerName,
            status: status ? status.toUpperCase() : 'OPEN',
            enrollments: []
        });

        res.status(201).json({
            success: true,
            message: 'Class created successfully',
            data: newClass
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.updateClass = async (req, res, next) => {
    try {
        const { className, subjectId, lecturerName, status } = req.body;

        const classObj = await Class.findById(req.params.id);
        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${req.params.id}` });
        }

        if (subjectId) {
            const subject = await Subject.findById(subjectId);
            if (!subject) {
                return res.status(404).json({ message: `Subject not found with id ${subjectId}` });
            }
            classObj.subjectId = subjectId;
        }

        if (className) classObj.className = className;
        if (lecturerName) classObj.lecturerName = lecturerName;
        if (status) {
            const upperStatus = status.toUpperCase();
            if (!['OPEN', 'CLOSED'].includes(upperStatus)) {
                return res.status(400).json({ message: "Invalid status. Allowed values are 'OPEN' or 'CLOSED'" });
            }
            classObj.status = upperStatus;
        }

        const updatedClass = await classObj.save();

        res.status(200).json({
            success: true,
            message: 'Class updated successfully',
            data: updatedClass
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.deleteClass = async (req, res, next) => {
    try {
        const classId = req.params.id;

        const classObj = await Class.findById(classId);
        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${classId}` });
        }

        const attendanceExists = await Attendance.findOne({ classId });
        if (attendanceExists) {
            return res.status(400).json({ message: 'Cannot delete class: Attendance records exist for this class' });
        }

        await Class.findByIdAndDelete(classId);

        res.status(200).json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.enrollStudent = async (req, res, next) => {
    try {
        const classId = req.params.id;
        const { studentId } = req.body;

        if (!studentId) {
            return res.status(400).json({ message: 'studentId is required in request body' });
        }

        const classObj = await Class.findById(classId);
        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${classId}` });
        }

        if (classObj.status === 'CLOSED') {
            return res.status(400).json({ message: 'Cannot enroll student: Class is CLOSED' });
        }

        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: `Student not found with id ${studentId}` });
        }

        const existingEnrollment = classObj.enrollments.find(
            e => e.studentId.toString() === studentId.toString()
        );

        if (existingEnrollment) {
            if (existingEnrollment.status === 'enrolled') {
                return res.status(409).json({ message: `Student ${student.studentCode} is already enrolled in class ${classObj.className}` });
            } else {
                existingEnrollment.status = 'enrolled';
            }
        } else {
            classObj.enrollments.push({ studentId, status: 'enrolled' });
        }

        await classObj.save();

        res.status(200).json({
            success: true,
            message: `Student ${student.studentCode} successfully enrolled into class ${classObj.className}`,
            data: classObj
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.updateEnrollmentStatus = async (req, res, next) => {
    try {
        const { id: classId, studentId } = req.params;
        const { status } = req.body;

        if (!status || !['enrolled', 'dropped'].includes(status.toLowerCase())) {
            return res.status(400).json({ message: "status is required and must be either 'enrolled' or 'dropped'" });
        }

        const classObj = await Class.findById(classId);
        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${classId}` });
        }

        const enrollment = classObj.enrollments.find(
            e => e.studentId.toString() === studentId.toString()
        );

        if (!enrollment) {
            return res.status(404).json({ message: `Student with id ${studentId} is not in class ${classObj.className}` });
        }

        enrollment.status = status.toLowerCase();
        await classObj.save();

        res.status(200).json({
            success: true,
            message: `Updated student enrollment status to '${status}'`,
            data: classObj
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.removeStudentFromClass = async (req, res, next) => {
    try {
        const { id: classId, studentId } = req.params;

        const classObj = await Class.findById(classId);
        if (!classObj) {
            return res.status(404).json({ message: `Class not found with id ${classId}` });
        }

        const enrollmentIndex = classObj.enrollments.findIndex(
            e => e.studentId.toString() === studentId.toString()
        );

        if (enrollmentIndex === -1) {
            return res.status(404).json({ message: `Student with id ${studentId} is not in class ${classObj.className}` });
        }

        const hasAttendance = await Attendance.findOne({ classId, studentId });
        if (hasAttendance) {
            return res.status(400).json({
                message: "Cannot remove student who has attendance history in this class. Set status to 'dropped' instead."
            });
        }

        classObj.enrollments.splice(enrollmentIndex, 1);
        await classObj.save();

        res.status(200).json({
            success: true,
            message: `Student removed from class ${classObj.className} successfully`
        });
    } catch (error) {
        if (next) next(error);
        else res.status(500).json({ message: error.message });
    }
};

exports.createOrUpdateMultipleAttendances = async (req, res, next) => {
    try {
        const classId = req.params.classId || req.params.id || req.params.studentId;

        if (!mongoose.isObjectIdOrHexString(classId)) {
            return res.status(400).json({ message: 'Invalid classId format' });
        }

        const classObj = await Class.findById(classId);
        if (!classObj) {
            return res.status(404).json({ message: 'Class not found' });
        }

        const { date } = req.body || {};
        const rawRecords = req.body?.records || req.body?.attendances || (Array.isArray(req.body) ? req.body : null);

        if (!date) {
            return res.status(400).json({ message: 'date is required' });
        }

        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        const now = new Date();
        const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
        if (parsedDate > todayEnd) {
            return res.status(400).json({ message: 'Date cannot be in the future' });
        }

        if (!Array.isArray(rawRecords) || rawRecords.length === 0) {
            return res.status(400).json({ message: 'records must be a non-empty array' });
        }

        const enrolledEnrollments = (classObj.enrollments || []).filter(e => {
            return e.status && e.status.toLowerCase() === 'enrolled' && e.studentId;
        });

        const enrolledMap = new Map();
        enrolledEnrollments.forEach(e => {
            enrolledMap.set(e.studentId.toString(), true);
        });

        const seenStudents = new Set();
        for (const item of rawRecords) {
            if (!item.studentId || !mongoose.isObjectIdOrHexString(item.studentId)) {
                return res.status(400).json({ message: 'Invalid studentId in records' });
            }

            const sIdStr = item.studentId.toString();
            if (!enrolledMap.has(sIdStr)) {
                return res.status(400).json({ message: `Student ${sIdStr} is not currently enrolled in class` });
            }

            const status = item.status ? String(item.status).toUpperCase() : null;
            if (!status || !['PRESENT', 'ABSENT'].includes(status)) {
                return res.status(400).json({ message: 'status must be PRESENT or ABSENT' });
            }

            seenStudents.add(sIdStr);
        }

        if (seenStudents.size !== enrolledMap.size) {
            return res.status(400).json({
                message: 'The request must include attendance records for all students currently enrolled in that class'
            });
        }

        const normalizedDate = new Date(parsedDate);
        normalizedDate.setUTCHours(0, 0, 0, 0);

        const results = [];
        for (const item of rawRecords) {
            const studentId = item.studentId;
            const status = String(item.status).toUpperCase();

            const record = await Attendance.findOneAndUpdate(
                { classId: classObj._id, studentId, date: normalizedDate },
                { classId: classObj._id, studentId, date: normalizedDate, status },
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
