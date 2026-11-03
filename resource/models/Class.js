const mongoose = require('mongoose');
//a class references a buject through the subjectId field
//a class contains an enrollments array. Each enrollment entry includes studentId and status (ENROLLED or DROPPED)

const enrollmentSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: [true, 'studentId in enrollment is required']
        },
        status: {
            type: String,
            enum: {
                values: ['enrolled', 'dropped'],
                message: 'Enrollment status must be enrolled or dropped'
            },
            default: 'enrolled'
        }
    },
    { _id: false }
);

const classSchema = new mongoose.Schema(
    {
        className: {
            type: String,
            required: [true, 'className is required'],
            trim: true
        },
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject',
            required: [true, 'subjectId is required']
        },
        lecturerName: {
            type: String,
            required: [true, 'lecturerName is required'],
            trim: true
        },
        status: {
            type: String,
            enum: {
                values: ['OPEN', 'CLOSED'],
                message: 'status must be either OPEN or CLOSED'
            },
            default: 'OPEN'
        },
        enrollments: [enrollmentSchema]
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('Class', classSchema);

