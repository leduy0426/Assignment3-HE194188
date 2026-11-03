const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Student = require('../models/Student');
const Subject = require('../models/Subject');
const Class = require('../models/Class');
const Attendance = require('../models/Attendance');

function convertMongoJSON(obj) {
    if (Array.isArray(obj)) return obj.map(convertMongoJSON);
    if (obj && typeof obj === 'object') {
        if (obj.$oid) return new mongoose.Types.ObjectId(obj.$oid);
        if (obj.$date) return new Date(obj.$date);
        const res = {};
        for (const key of Object.keys(obj)) {
            res[key] = convertMongoJSON(obj[key]);
        }
        return res;
    }
    return obj;
}

exports.seedDatabase = async (req, res, next) => {
    try {
        const dbDir = path.join(__dirname, '..', 'database');

        const studentsRaw = JSON.parse(fs.readFileSync(path.join(dbDir, 'students.json'), 'utf-8'));
        const subjectsRaw = JSON.parse(fs.readFileSync(path.join(dbDir, 'subjects.json'), 'utf-8'));
        const classesRaw = JSON.parse(fs.readFileSync(path.join(dbDir, 'classes.json'), 'utf-8'));
        const attendancesRaw = JSON.parse(fs.readFileSync(path.join(dbDir, 'attendances.json'), 'utf-8'));

        const students = convertMongoJSON(studentsRaw);
        const subjects = convertMongoJSON(subjectsRaw);
        const classes = convertMongoJSON(classesRaw);
        const attendances = convertMongoJSON(attendancesRaw);

        await Promise.all([
            Student.deleteMany({}),
            Subject.deleteMany({}),
            Class.deleteMany({}),
            Attendance.deleteMany({})
        ]);

        await Student.insertMany(students);
        await Subject.insertMany(subjects);
        await Class.insertMany(classes);
        await Attendance.insertMany(attendances);

        res.status(200).json({
            success: true,
            message: 'Database seeded successfully from JSON files',
            counts: {
                students: students.length,
                subjects: subjects.length,
                classes: classes.length,
                attendances: attendances.length
            }
        });
    } catch (error) {
        next(error);
    }
};
