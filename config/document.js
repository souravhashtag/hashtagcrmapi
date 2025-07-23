const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (file.fieldname === 'profilePicture') {
      cb(null, "uploads/profilepicture/");
    } else if (file.fieldname === 'documents[]') {
      cb(null, "uploads/documents/");
    } else {
      // Default fallback
      cb(null, "uploads/documents/");
    }
  },
  filename: function (req, file, cb) {
    console.log('File being uploaded:', file.originalname, 'Field:', file.fieldname);
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, extension);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    console.log('Processing file:', file.fieldname, file.mimetype);
    
    if (file.fieldname === 'profilePicture') {
      const allowedImageTypes = [
        "image/jpeg",
        "image/png", 
        "image/jpg"
      ];
      if (!allowedImageTypes.includes(file.mimetype)) {
        return cb(new Error("Profile picture must be JPG, PNG, or JPEG"), false);
      }
    } else if (file.fieldname === 'documents[]') {
      const allowedDocumentTypes = [
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/pdf",
        "application/msword", // .doc
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" // .docx
      ];
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