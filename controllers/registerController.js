const User = require('../models/User');
const bcrypt = require('bcrypt');
const passport = require("passport");
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  maxAge: 60 * 60 * 1000,
};

// Register
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

    // Check if username exists
    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      errors.username = "Username already exists";
      return res.status(400).json({ errors });
    }

    // Check if email is already used
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      errors.email = "Email is already used for another account type";
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
      { id: user._id, username: user.username, email: user.email, serviceType: user.serviceType },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('jwtToken', token, cookieOptions);

    res.status(201).json({
      message: "Registered successfully",
      user: { username: user.username, email: user.email, serviceType: user.serviceType }
    });
  } catch (err) {
    // Duplicate key error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      return res.status(400).json({
        errors: {
          email: "An account with this email already exists"
        }
      });
    }
    console.error("Registration error:", err);
    res.status(500).json({ errors: { server: "Server error" } });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { username, password, serviceType } = req.body;
    let errors = {};

    if (!username) errors.username = "Username is required";
    if (!password) errors.password = "Password is required";
    if (!serviceType || !["serviceSeeker","posting"].includes(serviceType)) errors.serviceType = "Service type required";
    if (Object.keys(errors).length) return res.status(400).json({ errors });

    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ errors: { username: "User not found" } });

    // Block login if serviceType does not match
    if (user.serviceType !== serviceType) {
      return res.status(400).json({ errors: { serviceType: "This email/username is already used for another account type." } });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ errors: { password: "Incorrect password" } });

    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, serviceType: user.serviceType },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.cookie('jwtToken', token, cookieOptions);

    res.status(200).json({
      message: "Login successful",
      user: { username: user.username, email: user.email, serviceType: user.serviceType }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ errors: { server: "Server error" } });
  }
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie('jwtToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });
  res.status(200).json({ message: 'Logged out successfully.' });
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const token = req.cookies.jwtToken;
    if (!token) return res.status(200).json({ user: null });

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(200).json({ user: null });

    res.status(200).json({ user: { username: user.username, email: user.email, serviceType: user.serviceType } });
  } catch (err) {
    res.status(200).json({ user: null });
  }
};

// Google OAuth
const GoogleStrategy = require("passport-google-oauth20").Strategy;

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.API_URL
        ? `${process.env.API_URL}/api/auth/google/callback`
        : "http://localhost:5000/api/auth/google/callback",
      passReqToCallback: true,
    },
    async function (req, accessToken, refreshToken, profile, done) {
      try {
        const serviceType = req.query.state || req.query.serviceType || "serviceSeeker";
        // Block Google login/register if email used for another type
        const existingUserByEmail = await User.findOne({ email: profile.emails[0].value });
        if (existingUserByEmail && existingUserByEmail.serviceType !== serviceType) {
          return done(
            { message: "This email is already used for another account type." },
            null
          );
        }

        let user = await User.findOne({ googleId: profile.id });

        if (!user) {
          if (existingUserByEmail) {
            user = existingUserByEmail;
            user.googleId = profile.id;
            user.serviceType = serviceType;
            await user.save();
          } else {
            user = new User({
              username: profile.displayName.slice(0, 10),
              email: profile.emails[0].value,
              googleId: profile.id,
              serviceType,
            });
            await user.save();
          }
        } else {
          if (!user.serviceType) {
            user.serviceType = serviceType;
            await user.save();
          }
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id).select("-password");
  done(null, user);
});

exports.googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

exports.googleCallback = [
  function (req, res, next) {
    passport.authenticate("google", function (err, user) {
      if (err && err.message) {
        // Redirect to client with error
        return res.redirect(
          `${process.env.CLIENT_URL || "http://localhost:3000"}/?oauth_error=${encodeURIComponent(err.message)}`
        );
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  async (req, res) => {
    const serviceType = req.query.state || req.query.serviceType || "serviceSeeker";
    const user = req.user;
    if (user && user.serviceType !== serviceType) {
      user.serviceType = serviceType;
      await user.save();
    }
    const token = jwt.sign(
      { id: user._id, username: user.username, email: user.email, serviceType: user.serviceType },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.cookie("jwtToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 60 * 60 * 1000,
    });
    res.redirect(`${process.env.CLIENT_URL || "http://localhost:3000"}/`);
  },
];