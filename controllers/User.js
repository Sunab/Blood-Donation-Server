import { User } from "../models/users.js";
import { sendMail } from "../utils/sendMail.js";
import { sendToken } from "../utils/sendToken.js";
import cloudinary from "cloudinary";
import fs from "fs";
export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const avatar = req.files.avatar.tempFilePath;

    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });
    }
    const otp = Math.floor(Math.random() * 1000000);

    // uploading to cloudinary
    const myUpload = await cloudinary.v2.uploader.upload(avatar, {
      folder: "Images",
    });

    // delete tmp folder and files
    fs.rmSync("./tmp", { recursive: true });
    // After successfull search created a new user
    user = await User.create({
      name,
      email,
      password,
      avatar: {
        public_id: myUpload.public_id,
        url: myUpload.secure_url,
      },
      otp,
      otp_expiry: new Date(Date.now() + process.env.OTP_EXPIRE * 60 * 1000),
    });

    await sendMail(email, "Verify your Account", `Your Otp is ${otp}`);

    sendToken(
      res,
      user,
      201,
      "OTP send to your email, Please verify your account"
    );
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const verify = async (req, res) => {
  try {
    const otp = Number(req.body.otp);
    const user = await User.findById(req.user._id);
    if (user.otp !== otp || user.otp_expiry < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or Your OTP has been  Expired",
      });
    }
    user.verified = true;
    user.otp = null;
    user.otp_expiry = null;
    await user.save();
    sendToken(res, user, 200, "account Verified");
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide email and password" });
    }
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Email or Password" });
    }

    const isMatched = await user.comparePassword(password);

    if (!isMatched) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Credentials" });
    }
    sendToken(res, user, 200, "Login Successful");
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    res
      .status(200)
      .cookie("token", null, {
        expires: new Date(Date.now()),
      })
      .json({
        success: true,
        message: "Logged out successful",
      });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addTask = async (req, res) => {
  try {
    const { title, description, hospitalName, bloodType } = req.body;
    const user = await User.findById(req.user._id);
    user.tasks.push({
      title,
      description,
      hospitalName,
      bloodType,
      completed: false,
      createdAt: new Date(Date.now()),
    });
    await user.save();
    return res
      .status(200)
      .json({ success: true, message: "Task added successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
export const removeTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const user = await User.findById(req.user._id);

    user.tasks = user.tasks.filter(
      (task) => task._id.toString() !== taskId.toString()
    );

    await user.save();

    res.status(200).json({
      success: true,
      message: "Task removed successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    const user = await User.findById(req.user._id);

    user.task = user.tasks.find(
      (task) => task._id.toString() === taskId.toString()
    );

    user.task.completed = !user.task.completed;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Task updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const myProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // sending token as response
    sendToken(res, user, 200, `Welcome Back ${user.name}`);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const { name } = req.body;
    const avatar = req.files.avatar.tempFilePath;

    if (name) user.name = name;

    if (avatar) {
      // first destroy previous avatar
      await cloudinary.v2.uploader.destroy(user.avatar.public_id);

      // uploading to cloudinary
      const myUpload = await cloudinary.v2.uploader.upload(avatar, {
        folder: "images",
      });

      // delete tmp folder and files
      fs.rmSync("./tmp", { recursive: true });

      user.avatar = {
        public_id: myUpload.public_id,
        url: myUpload.secure_url,
      };
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const updatePassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+password");
    const { oldPassword, newPassword, confirmPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: "Please provide all fields" });
    }
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid Password" });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password doesnot matched.",
      });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const forgetPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid Email" });
    }
    // create a otp
    const otp = Math.floor(Math.random() * 1000000);

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

    await user.save();

    const message = `Your OTP is ${otp}. If you did not request it please ignore it.`;
    // Sending otp in mail to verify
    await sendMail(email, "Request to resetting password", message);

    res.status(200).json({
      success: true,
      message: `OTP sent to ${email}`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { otp, newPassword, confirmPassword } = req.body;

    const user = await User.findOne({
      resetPasswordOtp: otp,
      resetPasswordOtpExpiry: { $gt: Date.now() },
    }).select("+password");

    if (!user) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid OTP or has been expired." });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Password didn't matched.",
      });
    }

    user.password = newPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpiry = null; // 15 minutes expiry
    await user.save();

    res.status(200).json({
      success: true,
      message: `Password changed successfully`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
