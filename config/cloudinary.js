const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");




cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});




// local temporary storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads");
    },
    filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});


const uploadMulter = multer({
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }
});



module.exports = { cloudinary, uploadMulter };