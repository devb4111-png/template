import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/quotation_db";

  try {
    // Attempt connecting with 2s timeout
    mongoose.set("strictQuery", false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log("Connected to MongoDB at", uri);
  } catch (err) {
    console.warn("External MongoDB not reachable. Initializing embedded in-memory MongoDB...");
    try {
      memoryServer = await MongoMemoryServer.create();
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log("Connected to embedded in-memory MongoDB at", memUri);
    } catch (memErr) {
      console.error("Failed to start in-memory MongoDB:", memErr);
      throw memErr;
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
  }
}
