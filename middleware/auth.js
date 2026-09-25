const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.header('Authorization');

  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.split(' ')[1] 
      : authHeader;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // ডিকোডের যেকোনো ফরম্যাট থেকে ID বের করা (_id বা id বা userId)
    const userId = decoded.id || decoded._id || decoded.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload: User ID missing' });
    }

    req.user = { id: userId }; 
    next();
  } catch (err) {
    res.status(400).json({ error: 'Invalid or expired token.' });
  }
};