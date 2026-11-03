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
        const matched = enrollments.filter(item => {
            return item.status && item.status.toLowerCase() === statusParam && item.studentId;
        });

        const students = matched.map(item => {
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

            const present = studentAttendances.filter(a => a.status === 'PRESENT').length;
            const absent = studentAttendances.filter(a => a.status === 'ABSENT').length;
            const totalSessions = totalClassSessions || (present + absent);
            const rateVal = totalSessions > 0 ? (present / totalSessions) * 100 : 0;
            const attendanceRate = `${rateVal.toFixed(1)}%`;
            const warning = totalSessions > 0 ? (absent / totalSessions > 0.2) : false;

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
