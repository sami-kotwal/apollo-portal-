const User = require("../models/User");
const { createNotification } = require("../utills/Notify");

const DAY_MS = 24 * 60 * 60 * 1000;
const getDateKey = (date = new Date(), timeZone = process.env.APP_TIMEZONE || "Asia/Karachi") => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const addDays = (dateKey, days) => {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const reminderForCustomer = (customer, today) => {
  const paymentReceiveDate = customer.customerProfile?.paymentReceiveDate || "";
  const paymentStatus = customer.customerProfile?.paymentStatus || "";
  if (!paymentReceiveDate || paymentStatus === "collected") return null;

  if (paymentReceiveDate === addDays(today, 2)) {
    return {
      type: "payment_reminder",
      action: "payment_reminder",
      message: `Payment Reminder: ${customer.name} payment is due in 2 days.`,
    };
  }

  if (paymentReceiveDate === today) {
    return {
      type: "payment_due_today",
      action: "payment_due_today",
      message: `Payment Due Today: ${customer.name} payment should be collected today.`,
    };
  }

  return null;
};

const processPaymentReminders = async ({ customerId, date = new Date() } = {}) => {
  const today = getDateKey(date);
  const customerQuery = {
    role: "customer",
    "customerProfile.paymentReceiveDate": { $ne: "" },
    "customerProfile.paymentStatus": { $ne: "collected" },
    ...(customerId ? { _id: customerId } : {}),
  };
  const [customers, projectManagers] = await Promise.all([
    User.find(customerQuery).select("name customerProfile").lean(),
    User.find({ role: "pm" }).select("_id").lean(),
  ]);

  if (!projectManagers.length) return { processed: 0 };

  let processed = 0;
  for (const customer of customers) {
    const reminder = reminderForCustomer(customer, today);
    if (!reminder) continue;

    const paymentReceiveDate = customer.customerProfile.paymentReceiveDate;
    const reminderKey = `${reminder.type}:${paymentReceiveDate}`;
    const claim = await User.updateOne(
      {
        _id: customer._id,
        "customerProfile.paymentFollowUpHistory": {
          $not: { $elemMatch: { reminderKey } },
        },
      },
      {
        $push: {
          "customerProfile.paymentFollowUpHistory": {
            reminderKey,
            type: reminder.type,
            paymentReceiveDate,
            paymentStatus: customer.customerProfile.paymentStatus || "",
            message: reminder.message,
            createdAt: new Date(),
          },
        },
      }
    );

    if (!claim.modifiedCount) continue;

    await Promise.all(
      projectManagers.map((pm) =>
        createNotification(pm._id, reminder.message, {
          entityType: "system",
          entityId: customer._id,
          action: reminder.action,
          metadata: {
            customerId: customer._id,
            customerName: customer.name,
            paymentReceiveDate,
            reminderKey,
          },
        })
      )
    );
    processed += 1;
  }

  return { processed };
};

const startPaymentReminderScheduler = () => {
  const run = () =>
    processPaymentReminders().catch((error) => {
      console.error(`Payment reminder scheduler failed: ${error.message}`);
    });

  run();
  const timer = setInterval(run, Math.min(DAY_MS, 15 * 60 * 1000));
  timer.unref?.();
  return timer;
};

module.exports = {
  getDateKey,
  processPaymentReminders,
  startPaymentReminderScheduler,
};
