const mongoose = require('mongoose');
//An attendance record references a student through studentId and a class through classId. It also contains date and status (PRESENT or ABSENT)
//Use MongoDB ObjectId values for references between documents
const attendanceSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: [true, 'studentId is required']
        },
        classId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Class',
            required: [true, 'classId is required']
        },
        date: {
            type: Date,
            required: [true, 'date is required']
        },
        status: {
            type: String,
            required: [true, 'status is required'],
            enum: {
                values: ['PRESENT', 'ABSENT'],
                message: 'status must be either PRESENT or ABSENT'
            }
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

// Unique compound index: a student can have only one attendance record per class per date
attendanceSchema.index({ studentId: 1, classId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);

