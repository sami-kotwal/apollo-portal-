const Notification = require("../models/Notification");
const { emitUserNotification } = require("../utils/socket");

exports.createNotification = async (userId, message, options = {}) => {
  if (!userId || !message) return null;
  const targetUserId = userId.toString();
  const actorId = options.metadata?.actorId?.toString();
  if (actorId && targetUserId === actorId) return null;

  const recentDuplicate = await Notification.findOne({
    user: targetUserId,
    message,
    ...(options.entityType ? { entityType: options.entityType } : {}),
    ...(options.entityId ? { entityId: options.entityId } : {}),
    ...(options.action ? { action: options.action } : {}),
    read: false,
    createdAt: { $gte: new Date(Date.now() - 60 * 1000) },
  });

  if (recentDuplicate) return recentDuplicate;

  const notification = await Notification.create({
    user: targetUserId,
    message,
    entityType: options.entityType || null,
    entityId: options.entityId,
    action: options.action,
    metadata: options.metadata,
  });

  emitUserNotification(targetUserId, notification.toObject());
  return notification;
};
