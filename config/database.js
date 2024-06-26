import mongoose, { mongo } from "mongoose";
import Express from "express";

export const connectDatabase = async () => {
  try {
    const connection = mongoose.connect(process.env.MONGO_URL, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB connected: ${connection.host}`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
