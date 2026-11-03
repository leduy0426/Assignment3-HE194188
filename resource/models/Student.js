const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentCode: {
            type: String,
            required: [true, 'studentCode is required'],
            unique: true,
            trim: true,
            uppercase: true
        },
        fullName: {
            type: String,
            required: [true, 'fullName is required'],
            trim: true
        },
        email: {
            type: String,
            required: [true, 'email is required'],
            unique: true,
            trim: true,
            lowercase: true,
            match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address']
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('Student', studentSchema);

