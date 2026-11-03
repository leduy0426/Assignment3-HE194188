const jwt = require('jsonwebtoken');

/**
 * 3.2. Implement JWT Authentication Middleware
 * - extract the token from the request's Authorization header
 * - the token must follow format: Bearer <token>
 * - use the JWT_SECRET already configured to verify token
 * - if the token missing, invalid, expired, return HTTP 401 and deny access to the API
 * - if the token is validated, store the decoded payload in req.user and call next() to proceed
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    // Check if header is present and starts with 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Access denied. Token missing or invalid format (Bearer <token> required)'
        });
    }

    // Extract token
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

