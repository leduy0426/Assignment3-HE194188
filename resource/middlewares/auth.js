const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Access denied. Token missing or invalid format (Bearer <token> required)'
        });
    }

    const token = authHeader.substring(7).trim();
    if (!token) {
        return res.status(401).json({
            message: 'Access denied. Token is missing'
        });
    }

    try {
        const secret = process.env.JWT_SECRET || 'HE194188';
        const decoded = jwt.verify(token, secret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            message: 'Invalid or expired token'
        });
    }
};

module.exports = { verifyToken };
