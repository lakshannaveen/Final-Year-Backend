const User = require('../models/User');
const bcrypt = require('bcrypt');

exports.register = async (req, res) => {
  try {
    const { username, email, password, phone, serviceType } = req.body;

    // Validate on server as well
    let errors = {};
    if (!username || username.length > 10) errors.username = "Invalid username";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = "Invalid email";
    if (!password || !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password))
      errors.password = "Weak password";
    if (serviceType === "posting") {
      if (!phone || !/^07\d{8}$/.test(phone)) errors.phone = "Invalid phone";
    }
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    // Check if email exists
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ errors: { email: "Email already exists" } });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      username,
      email,
      password: hashed,
      phone: serviceType === "posting" ? phone : undefined,
      serviceType,
    });

    await user.save();
    res.status(201).json({ message: "Registered successfully" });
  } catch (err) {
    res.status(500).json({ errors: { server: "Server error" }, detail: err.message });
  }
};