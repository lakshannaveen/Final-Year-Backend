const Verification = require('../models/Verification');
const User = require('../models/User');
const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APPLICATION_KEY,
});

// Upload file to Backblaze B2
const uploadToB2 = async (file, folder = 'verification') => {
  try {
    const auth = await b2.authorize();
    const downloadUrl = auth.data.downloadUrl;

    const uploadUrlResponse = await b2.getUploadUrl({
      bucketId: process.env.B2_BUCKET_ID,
    });

    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    // Generate unique file name with folder structure
    const fileName = `${folder}/${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;

    await b2.uploadFile({
      uploadUrl,
      uploadAuthToken,
      fileName,
      data: file.buffer,
      contentType: file.mimetype,
    });

    return `${downloadUrl}/file/${process.env.B2_BUCKET_NAME}/${fileName}`;
  } catch (error) {
    console.error('B2 Upload Error:', error);
    throw new Error('File upload failed');
  }
};

// Submit verification request
exports.submitVerification = async (req, res) => {
  try {
    const userId = req.user.id;
    const { docType } = req.body;

    console.log('Verification submission started for user:', userId);
    console.log('Document type:', docType);
    console.log('Files received:', req.files);

    // Check if user already has a verification request
    const existingVerification = await Verification.findOne({ user: userId });
    if (existingVerification) {
      return res.status(400).json({
        errors: { message: 'You already have a pending verification request' }
      });
    }

    // Validate required files based on docType
    let nicFrontUrl = "";
    let nicBackUrl = "";
    let dlFrontUrl = "";
    let dlBackUrl = "";
    let businessCertUrl = "";

    // Upload NIC files if docType is nic
    if (docType === 'nic') {
      if (!req.files?.nicFront || !req.files?.nicBack) {
        return res.status(400).json({
          errors: { message: 'Both NIC front and back are required' }
        });
      }
      nicFrontUrl = await uploadToB2(req.files.nicFront[0], 'verification/nic');
      nicBackUrl = await uploadToB2(req.files.nicBack[0], 'verification/nic');
    }

    // Upload DL files if docType is dl
    if (docType === 'dl') {
      if (!req.files?.dlFront || !req.files?.dlBack) {
        return res.status(400).json({
          errors: { message: 'Both Driving License front and back are required' }
        });
      }
      dlFrontUrl = await uploadToB2(req.files.dlFront[0], 'verification/dl');
      dlBackUrl = await uploadToB2(req.files.dlBack[0], 'verification/dl');
    }

    // Upload business certificate (required)
    if (!req.files?.businessCert) {
      return res.status(400).json({
        errors: { message: 'Business registration certificate is required' }
      });
    }
    businessCertUrl = await uploadToB2(req.files.businessCert[0], 'verification/business');

    // Create verification record
    const verification = new Verification({
      user: userId,
      docType,
      nicFront: nicFrontUrl,
      nicBack: nicBackUrl,
      dlFront: dlFrontUrl,
      dlBack: dlBackUrl,
      businessCert: businessCertUrl,
      status: 'pending'
    });

    await verification.save();

    console.log('Verification submitted successfully for user:', userId);

    res.status(201).json({
      message: 'Verification request submitted successfully',
      verification: {
        id: verification._id,
        status: verification.status,
        submittedAt: verification.submittedAt
      }
    });

  } catch (err) {
    console.error('Verification submission error:', err);
    res.status(500).json({
      errors: { server: 'Server error during verification submission' }
    });
  }
};

// Get verification status for current user
exports.getVerificationStatus = async (req, res) => {
  try {
    const userId = req.user.id;

    const verification = await Verification.findOne({ user: userId })
      .select('-nicFront -nicBack -dlFront -dlBack -businessCert');

    if (!verification) {
      return res.status(404).json({
        errors: { message: 'No verification request found' }
      });
    }

    res.status(200).json({ verification });
  } catch (err) {
    console.error('Get verification status error:', err);
    res.status(500).json({
      errors: { server: 'Server error' }
    });
  }
};

// Get all verification requests (for testing - no auth required)
exports.getAllVerifications = async (req, res) => {
  try {
    const verifications = await Verification.find()
      .populate('user', 'username email serviceType profilePic')
      .sort({ createdAt: -1 });

    res.status(200).json({ verifications });
  } catch (err) {
    console.error('Get all verifications error:', err);
    res.status(500).json({
      errors: { server: 'Server error' }
    });
  }
};

// Update verification status (for testing - no auth required)
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { verificationId } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        errors: { message: 'Invalid status' }
      });
    }

    const verification = await Verification.findById(verificationId);
    if (!verification) {
      return res.status(404).json({
        errors: { message: 'Verification request not found' }
      });
    }

    // Update verification
    verification.status = status;
    verification.reviewedAt = new Date();

    await verification.save();

    // Update user's verified status if approved
    if (status === 'approved') {
      await User.findByIdAndUpdate(verification.user, { isVerified: true });
      console.log('User verified:', verification.user);
    } else {
      await User.findByIdAndUpdate(verification.user, { isVerified: false });
    }

    res.status(200).json({
      message: `Verification ${status} successfully`,
      verification
    });

  } catch (err) {
    console.error('Update verification status error:', err);
    res.status(500).json({
      errors: { server: 'Server error' }
    });
  }
};