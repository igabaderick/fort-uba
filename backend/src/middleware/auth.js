const jwt = require("jsonwebtoken");

function authMiddleware(allowedTypes = ["rider", "driver", "admin"]) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }
    const token = header.slice(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (!allowedTypes.includes(decoded.type)) {
        return res.status(403).json({ error: "Access denied for this user type" });
      }
      req.user = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

module.exports = { authMiddleware };
