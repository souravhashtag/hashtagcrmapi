const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Role = require("../models/Role");
const ScreenShot = require("../models/ScreenShot");
const fs = require('fs').promises;
const fss = require('fs');
const os = require('os');
const path = require('path');
const Department = require("../models/Department");

let refreshTokens = [];
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'your_access_token_secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';

function generateAccessToken(payload) {
  // return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: "1d" });
  return jwt.sign(payload, ACCESS_TOKEN_SECRET);
}

function generateRefreshToken(payload) {
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET);
  refreshTokens.push(refreshToken);
  return refreshToken;
}

class UserController {
  static register = async (req, res) => {
    try {
      const { username, email, password } = req.body;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: "User already exists with this email." });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = new User({ username, email, password: hashedPassword });
      await user.save();
      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  static login = async (req, res) => {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ email });
      //res.status(200).json({ user });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ error: "Invalid credentials" });
      }
      const role = await Role.findById(user.role);
      const accessToken = generateAccessToken({ menu: role?.menulist, id: user._id });
      const refreshToken = generateRefreshToken({ menu: role?.menulist, id: user._id });
      //const tokenFilePath = path.join(os.homedir(), 'electron-user-token.txt');
      //fss.writeFileSync(tokenFilePath, accessToken);


      res.status(200).json({ accessToken, refreshToken });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  static ScreenShotUpload = async (req, res) => {
    try {
      //console.log(req.file)
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const image = req.file ? req.file.filename : null;
      const screenshot = new ScreenShot({ userid: req.user.id, image });
      const saveimage = await screenshot.save();

      res.status(200).json({ message: "Images uploaded successfully", data: saveimage });
    } catch (err) {
      console.log(err)
    }
  }
  static GetScreenShot = async (req, res) => {
    try {
      // Get page and limit from query params (default: page=1, limit=10)
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const skip = (page - 1) * limit;

      // Count total documents
      const total = await ScreenShot.countDocuments();

      // Fetch paginated data
      const screenshots = await ScreenShot.find()
        .populate('userid', 'firstName email')
        .skip(skip)
        .limit(limit)
        .sort({ _id: -1 }); // instead of reverse(), sort by newest first

      res.status(200).json({
        total,
        page,
        pages: Math.ceil(total / limit),
        limit,
        data: screenshots
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  }
  static DeleteScreenShot = async (req, res) => {
    try {
      const screenshots = await ScreenShot.find();
      const errors = [];

      await Promise.all(
        screenshots.map(async (item) => {
          const filePath = path.join(process.cwd(), 'uploads/screenshort', item.image);
          console.log('Trying to delete:', filePath);
          try {
            // await fs.access(filePath);
            await fs.unlink(filePath);
          } catch (err) {
            console.error(`Failed to delete: ${filePath}`, err.message);
          }
        })
      );
      return res.status(200).send('All files deleted successfully');
    } catch (err) {
      console.error('Fatal error:', err);
      return res.status(500).send('Internal server error');
    }
  };
  static verifyToken = async (req, res, next) => {
    try {
      const token = req.headers["authorization"];
      //console.log(token)
      if (!token) {
        return res.status(403).json({ error: "Access denied, no token provided" });
      }

      const decoded = jwt.verify(token.split(" ")[1], process.env.JWT_SECRET);
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: "Invalid or expired token" });
    }
  };
  // static tokenProtected = async (req, res, next) => {
  //   const authHeader = req.headers["authorization"];
  //   const token = authHeader && authHeader.split(' ')[1];

  //   if (!token) return res.sendStatus(401);

  //   jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
  //     if (err) return res.sendStatus(403);
  //     res.json({ message: 'This is protected data', user });
  //   });
  // };
  static getUserData = async (req, res) => {
    try {

      const user = await User.findOne({ _id: req.user.id });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      if (user && user.profilePicture) {
        const baseUrl = process.env.FRONT_BASE_URL || 'http://localhost:5000';
        user.profilePicture = `${baseUrl}/${user.profilePicture}`;
      }
      const role = await Role.findById(user.role);


      // resolve department
      let department = null;
      if (user.department) {
        department = await Department.findById(user.department);
      }
      const userObj = user.toObject();
      userObj.role = role;
      userObj.department = department;


      res.status(200).json({ user: userObj });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
  static userLogout = async (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];

      if (token) {
        const decoded = jwt.decode(token);
        // await BlacklistedToken.create({
        //     token: token,
        //     expiresAt: new Date(decoded.exp * 1000)
        // });
      }
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Logout failed'
      });
    }
  }
}

module.exports = UserController;
