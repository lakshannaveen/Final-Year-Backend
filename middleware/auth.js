const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

exports.requireAuth = (req, res, next) => {
  // Try to get token from Authorization header first (Bearer <token>)
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwtToken) {
    // Fallback to cookie
    token = req.cookies.jwtToken;
  }

  if (!token) {
    return res.status(401).json({ errors: { auth: "Not authenticated" } });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ errors: { auth: "Invalid token" } });
  }
};