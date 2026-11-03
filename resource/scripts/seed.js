const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected for seeding...');

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

        console.log(`Seeding complete:`);
        console.log(` - Students:    ${students.length}`);
        console.log(` - Subjects:    ${subjects.length}`);
        console.log(` - Classes:     ${classes.length}`);
        console.log(` - Attendances: ${attendances.length}`);

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();

