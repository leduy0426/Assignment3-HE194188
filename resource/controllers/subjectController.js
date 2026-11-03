const Subject = require('../models/Subject');
const Class = require('../models/Class');

// @desc    Get all subjects (filter by status, search keyword)
// @route   GET /api/subjects
exports.getAllSubjects = async (req, res, next) => {
    try {
        const { status, keyword } = req.query;

        const query = {};
        if (status) {
            if (!['ACTIVE', 'INACTIVE'].includes(status.toUpperCase())) {
                const err = new Error("Invalid status. Allowed values are 'ACTIVE' or 'INACTIVE'");
                err.statusCode = 400;
                return next(err);
            }
            query.status = status.toUpperCase();
        }

        if (keyword) {
            query.$or = [
                { code: { $regex: keyword, $options: 'i' } },
                { name: { $regex: keyword, $options: 'i' } }
            ];
        }

        const subjects = await Subject.find(query).sort({ code: 1 });

        res.status(200).json({
            success: true,
            total: subjects.length,
            data: subjects
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get subject by ID
// @route   GET /api/subjects/:id
exports.getSubjectById = async (req, res, next) => {
    try {
        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            const err = new Error(`Subject not found with id ${req.params.id}`);
            err.statusCode = 404;
            return next(err);
        }

        res.status(200).json({
            success: true,
            data: subject
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new subject
// @route   POST /api/subjects
exports.createSubject = async (req, res, next) => {
    try {
        const { code, name, credits, status } = req.body;

        const subject = await Subject.create({
            code,
            name,
            credits,
            status: status ? status.toUpperCase() : 'ACTIVE'
        });

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: subject
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update subject
// @route   PUT /api/subjects/:id
exports.updateSubject = async (req, res, next) => {
    try {
        const { code, name, credits, status } = req.body;

        const subject = await Subject.findById(req.params.id);
        if (!subject) {
            const err = new Error(`Subject not found with id ${req.params.id}`);
            err.statusCode = 404;
            return next(err);
        }

        if (code) subject.code = code.toUpperCase();
        if (name) subject.name = name;
        if (credits !== undefined) subject.credits = credits;
        if (status) subject.status = status.toUpperCase();

        const updatedSubject = await subject.save();

        res.status(200).json({
            success: true,
            message: 'Subject updated successfully',
            data: updatedSubject
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete subject
// @route   DELETE /api/subjects/:id
exports.deleteSubject = async (req, res, next) => {
    try {
        const subjectId = req.params.id;

        const subject = await Subject.findById(subjectId);
        if (!subject) {
            const err = new Error(`Subject not found with id ${subjectId}`);
            err.statusCode = 404;
            return next(err);
        }

        // Check if referenced by any Class
        const classUsingSubject = await Class.findOne({ subjectId });
        if (classUsingSubject) {
            const err = new Error(`Cannot delete subject: It is being taught in class '${classUsingSubject.className}'`);
            err.statusCode = 400;
            return next(err);
        }

        await Subject.findByIdAndDelete(subjectId);

        res.status(200).json({
            success: true,
            message: 'Subject deleted successfully'
        });
    } catch (error) {
        next(error);
    }
};

