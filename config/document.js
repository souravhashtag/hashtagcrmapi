const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log('File fieldname:', file.fieldname);
    if (file.fieldname === 'profilePicture') {
      cb(null, "uploads/profilepicture/");
    }else if (file.fieldname === 'documents[]' || file.fieldname === 'attachments') {
      cb(null, "uploads/documents/");
    } else {
      cb(new Error("Invalid field name"), false);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedImageTypes = ["image/jpeg", "image/png", "image/jpg"];
    const allowedDocumentTypes = [
      ...allowedImageTypes,
      "application/pdf",
      "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (file.fieldname === 'profilePicture') {
      if (!allowedImageTypes.includes(file.mimetype)) {
        return cb(new Error("Profile picture must be JPG, PNG, or JPEG"), false);
      }
    } else if (file.fieldname === 'documents[]' || file.fieldname === 'attachments') {
      if (!allowedDocumentTypes.includes(file.mimetype)) {
        return cb(new Error("Documents must be JPG, PNG, JPEG, PDF, DOC, or DOCX"), false);
      }
    } else {
      return cb(new Error("Invalid field name"), false);
    }
    
    cb(null, true);
  },
  limits: {
    fileSize: 5 * 1024 * 1024, 
    files: 15 
  }
});


module.exports = upload;