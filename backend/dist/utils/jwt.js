import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'prestaci-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
export function generateToken(payload) {
    return jwt.sign({ userId: payload.userId, email: payload.email, role_id: payload.role_id }, JWT_SECRET, { expiresIn: '7d' });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new Error('Token invalide');
    }
}
export function extractTokenFromHeader(authHeader) {
    if (!authHeader)
        return null;
    // Support pour "Bearer TOKEN" et "TOKEN"
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return authHeader;
}
