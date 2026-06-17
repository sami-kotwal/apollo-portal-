let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;
  return ioInstance;
};

const emitMonitoringEvent = (event, payload = {}) => {
  if (!ioInstance) return;
  ioInstance.to("admin-monitoring").emit(event, {
    ...payload,
    emittedAt: new Date().toISOString(),
  });
};

const emitUserNotification = (userId, notification) => {
  if (!ioInstance || !userId || !notification) return;
  ioInstance.to(`user:${userId}`).emit("notification:new", {
    ...notification,
    emittedAt: new Date().toISOString(),
  });
};

module.exports = {
  initSocket,
  emitMonitoringEvent,
  emitUserNotification,
};
