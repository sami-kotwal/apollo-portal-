const path = require("path");
const dns = require("dns");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");
const User = require("../models/User");
const CustomerRequest = require("../models/CustomerRequest");

dotenv.config({ path: path.resolve(__dirname, "..", ".env"), quiet: true });

const TEMPORARY_PASSWORD = "Customer@123456";

const customers = [
  {
    name: "Ahmed Khan",
    email: "ahmed.client@apollo.com",
    companyName: "Khan Digital Solutions",
    phone: "03001234501",
  },
  {
    name: "Sara Ali",
    email: "sara.client@apollo.com",
    companyName: "Sara Fashion Studio",
    phone: "03001234502",
  },
  {
    name: "Usman Malik",
    email: "usman.client@apollo.com",
    companyName: "Malik Business Group",
    phone: "03001234503",
  },
  {
    name: "Ayesha Noor",
    email: "ayesha.client@apollo.com",
    companyName: "Noor Creative House",
    phone: "03001234504",
  },
  {
    name: "Hamza Sheikh",
    email: "hamza.client@apollo.com",
    companyName: "Sheikh Ecommerce",
    phone: "03001234505",
  },
  {
    name: "Fatima Raza",
    email: "fatima.client@apollo.com",
    companyName: "Raza Marketing Agency",
    phone: "03001234506",
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

const seedCustomers = async () => {
  const mongoUri = (process.env.MONGO_URI || process.env.MONGODB_URI || "").trim();
  if (!mongoUri) {
    throw new Error("MONGO_URI is missing in .env");
  }

  configureDns();
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });

  for (const customer of customers) {
    const existing = await User.findOne({ email: customer.email }).select("_id");

    if (existing) {
      console.log(`customer already exists: ${customer.email}`);
      continue;
    }

    const password = await bcrypt.hash(TEMPORARY_PASSWORD, 10);
    await User.create({
      name: customer.name,
      email: customer.email,
      password,
      role: "customer",
      customerProfile: {
        companyName: customer.companyName,
        phone: customer.phone,
        clientStatus: "active",
      },
    });

    console.log(`customer created: ${customer.email}`);
  }

  const requestCustomer = await User.findOne({ email: "ahmed.client@apollo.com" }).select("_id");
  if (!requestCustomer) {
    throw new Error("Ahmed customer account was not found");
  }

  const selectedPackage = {
    packageId: "informative-professional",
    billingCycle: "monthly",
    price: "$499",
    selectedAt: new Date().toISOString(),
  };
  const customerWithPackages = await User.findById(requestCustomer._id).select("customerProfile.selectedPackages");
  const existingPackages = customerWithPackages?.customerProfile?.selectedPackages || [];
  const hasSelectedPackage = existingPackages.some((item) => {
    const packageId = typeof item === "string" ? item : item?.packageId || item?.id;
    return packageId === selectedPackage.packageId;
  });

  if (!hasSelectedPackage) {
    await User.updateOne(
      { _id: requestCustomer._id },
      { $push: { "customerProfile.selectedPackages": selectedPackage } }
    );
  }

  console.log(`package ready: ${selectedPackage.packageId}`);

  const request = await CustomerRequest.findOneAndUpdate(
    {
      customer: requestCustomer._id,
      type: "website",
      title: "Business Website Development",
    },
    {
      $setOnInsert: {
        customer: requestCustomer._id,
        type: "website",
        status: "submitted",
        priority: "high",
        title: "Business Website Development",
        details: {
          businessType: "Digital services",
          pages: "Home, About, Services, Portfolio, Contact",
          notes: "Modern responsive business website with contact form.",
        },
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  console.log(`sample request ready: ${request.title}`);

  await mongoose.disconnect();
};

seedCustomers().catch(async (error) => {
  console.error(error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
