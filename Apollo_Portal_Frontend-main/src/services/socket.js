import { io } from "socket.io-client";
import { getStoredToken } from "../utils/authStorage";

const getSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api\/?$/, "");
};

let socket;

export const getSocket = () => {
  const token = getStoredToken();
  if (!token) return null;

  if (!socket) {
    socket = io(getSocketUrl(), {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};
