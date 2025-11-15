const Contact = require("../models/Contact");

// Submit contact inquiry
const submitContact = async (req, res) => {
  try {
    const { name, email, message, phone } = req.body;

    console.log("Contact submission:", { name, email, message, phone });

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ error: "Name, email and message are required." });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    }

    if (name.trim().length > 30) {
      return res.status(400).json({ error: "Name must not exceed 30 characters." });
    }

    const wordCount = message.trim().split(/\s+/).length;
    if (wordCount < 2) {
      return res.status(400).json({ error: "Message must be at least 2 words." });
    }
    if (wordCount > 50) {
      return res.status(400).json({ error: "Message must not exceed 50 words." });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    // Create contact inquiry
    const contact = await Contact.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      phone: phone ? phone.trim() : undefined,
      status: 'pending'
    });

    res.status(201).json({
      message: "Contact inquiry submitted successfully!",
      contact: {
        _id: contact._id,
        name: contact.name,
        email: contact.email,
        message: contact.message,
        phone: contact.phone,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (err) {
    console.error("Submit contact error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all contact inquiries
const getAllContacts = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, search } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query = {};
    if (status && ['pending', 'reviewed', 'resolved'].includes(status)) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const total = await Contact.countDocuments(query);
    const totalPages = Math.ceil(total / limitNum);

    res.json({
      contacts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalContacts: total,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (err) {
    console.error("Get contacts error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get contact stats
const getContactStats = async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Contact.countDocuments();
    
    // Get today's inquiries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = await Contact.countDocuments({
      createdAt: { $gte: today }
    });

    // Get this week's inquiries
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekCount = await Contact.countDocuments({
      createdAt: { $gte: weekStart }
    });

    const statsObj = {
      total,
      today: todayCount,
      thisWeek: weekCount,
      pending: 0,
      reviewed: 0,
      resolved: 0
    };

    stats.forEach(stat => {
      statsObj[stat._id] = stat.count;
    });

    res.json(statsObj);
  } catch (err) {
    console.error("Get contact stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Update contact status
const updateContactStatus = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { status } = req.body;

    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const contact = await Contact.findById(contactId);

    if (!contact) {
      return res.status(404).json({ error: "Contact inquiry not found." });
    }

    contact.status = status;
    await contact.save();

    res.json({
      message: "Contact status updated successfully!",
      contact: {
        _id: contact._id,
        name: contact.name,
        email: contact.email,
        message: contact.message,
        phone: contact.phone,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (err) {
    console.error("Update contact status error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Delete contact inquiry
const deleteContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact inquiry not found." });
    }

    await Contact.findByIdAndDelete(contactId);

    res.json({ message: "Contact inquiry deleted successfully!" });
  } catch (err) {
    console.error("Delete contact error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get single contact by ID
const getContactById = async (req, res) => {
  try {
    const { contactId } = req.params;

    const contact = await Contact.findById(contactId);
    if (!contact) {
      return res.status(404).json({ error: "Contact inquiry not found." });
    }

    res.json({ contact });
  } catch (err) {
    console.error("Get contact by ID error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  submitContact,
  getAllContacts,
  getContactStats,
  updateContactStatus,
  deleteContact,
  getContactById
};