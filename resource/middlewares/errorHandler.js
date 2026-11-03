const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';
    let errors = err.errors || null;

    if (err.name === 'CastError') {
        statusCode = 400;
        message = `Invalid format for field '${err.path}': value '${err.value}' is not a valid ObjectId`;
    }

    if (err.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation failed';
        errors = Object.values(err.errors).map(e => e.message);
    }

    if (err.code === 11000) {
        statusCode = 409;
        const field = Object.keys(err.keyValue || {})[0];
        const val = err.keyValue ? err.keyValue[field] : '';
        message = `Duplicate key error: '${field}' with value '${val}' already exists.`;
    }

    res.status(statusCode).json({
        success: false,
        statusCode,
        message,
        errors
    });
};

module.exports = errorHandler;
