const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour
};

exports.register = async (req, res) => {
  try {
    const { username, email, password, phone, serviceType } = req.body;
    let errors = {};
    
    // Validation
    if (!username || username.length > 10) errors.username = "Invalid username";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Invalid email";
    if (!password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password))
      errors.password = "Weak password";
    if (serviceType === "posting") {
      if (!phone || !/^07\d{8}$/.test(phone)) errors.phone = "Invalid phone";
    }
    
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    // Check if user exists
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      if (existingUser.email === email) errors.email = "Email already exists";
      if (existingUser.username === username) errors.username = "Username already exists";
      return res.status(400).json({ errors });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      phone: serviceType === "posting" ? phone : undefined,
      serviceType,
    });
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set JWT in cookie
    res.cookie('jwtToken', token, cookieOptions);

    res.status(201).json({
      message: "Registered successfully",
      user: { username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ errors: { server: "Server error" } });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    let errors = {};
    
    // Validation
    if (!username) errors.username = "Username is required";
    if (!password) errors.password = "Password is required";
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    // Find user
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ errors: { username: "User not found" } });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ errors: { password: "Incorrect password" } });

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Set JWT in cookie
    res.cookie('jwtToken', token, cookieOptions);

    res.status(200).json({
      message: "Login successful",
      user: { username: user.username, email: user.email }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ errors: { server: "Server error" } });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('jwtToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.status(200).json({ message: 'Logged out successfully.' });
};

exports.getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.jwtToken;
    if (!token) return res.status(200).json({ user: null });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return res.status(200).json({ user: null });
    
    res.status(200).json({ user: { username: user.username, email: user.email } });
  } catch (err) {
    res.status(200).json({ user: null });
  }
};