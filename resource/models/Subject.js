const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
    {
        code: {
            type: String,
            required: [true, 'code is required'],
            unique: true,
            trim: true,
            uppercase: true
        },
        name: {
            type: String,
            required: [true, 'name is required'],
            trim: true
        },
        credits: {
            type: Number,
            required: [true, 'credits is required'],
            min: [1, 'credits must be at least 1']
        },
        status: {
            type: String,
            enum: {
                values: ['ACTIVE', 'INACTIVE'],
                message: 'status must be either ACTIVE or INACTIVE'
            },
            default: 'ACTIVE'
        }
    },
    {
        timestamps: true,
        versionKey: false
    }
);

module.exports = mongoose.model('Subject', subjectSchema);

