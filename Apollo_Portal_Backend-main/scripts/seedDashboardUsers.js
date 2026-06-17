const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const dashboardUsers = [
  {
    name: "Admin User",
    email: "admin@apollo.com",
    password: "Admin@123456",
    role: "admin",
  },
  {
    name: "Project Manager",
    email: "pm@apollo.com",
    password: "Pm@123456",
    role: "pm",
  },
  {
    name: "Development Team Leader",
    email: "devlead@apollo.com",
    password: "DevLead@123456",
    role: "teamleader_dev",
    department: "development",
  },
  {
    name: "Design Team Leader",
    email: "designlead@apollo.com",
    password: "DesignLead@123456",
    role: "teamleader_design",
    department: "designing",
  },
  {
    name: "Developer User",
    email: "developer@apollo.com",
    password: "Developer@123456",
    role: "developer",
    department: "development",
  },
  {
    name: "Designer User",
    email: "designer@apollo.com",
    password: "Designer@123456",
    role: "designer",
    department: "designing",
  },
  {
    name: "Expense Manager",
    email: "expense@apollo.com",
    password: "Expense@123456",
    role: "expense_manager",
  },
  {
    name: "Customer User",
    email: "customer@apollo.com",
    password: "Customer@123456",
    role: "customer",
    customerProfile: {
      companyName: "Apollo Test Customer",
      phone: "03000000000",
    },
  },
];

const configureDns = () => {
  const servers = (process.env.MONGO_DNS_SERVERS || "")
    .split(",")
    .map((server) => server.trim())
    .filter(Boolean);

  if (servers.length > 0) {
    dns.setServers(servers);
  }
};

const seedUsers = async () => {
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  configureDns();
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });

  for (const seed of dashboardUsers) {
    const hashedPassword = await bcrypt.hash(seed.password, 10);
    const $set = {
      name: seed.name,
      email: seed.email,
      password: hashedPassword,
      role: seed.role,
    };
    const update = { $set };

    if (seed.department) {
      $set.department = seed.department;
    } else {
      update.$unset = { department: "" };
    }

    if (seed.customerProfile) {
      $set.customerProfile = seed.customerProfile;
    }

    await User.updateOne({ email: seed.email }, update, {
      upsert: true,
      runValidators: true,
    });

    console.log(`${seed.role} ready: ${seed.email}`);
  }

  await mongoose.disconnect();
};

seedUsers().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
