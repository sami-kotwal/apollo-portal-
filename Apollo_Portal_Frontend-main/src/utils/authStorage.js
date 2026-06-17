export const getStoredToken = () => sessionStorage.getItem("token") || localStorage.getItem("token");

export const getStoredUser = () => {
  const rawUser = sessionStorage.getItem("user") || localStorage.getItem("user");
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
};

export const saveAuthSession = (token, user) => {
  const serializedUser = JSON.stringify(user);
  sessionStorage.setItem("token", token);
  sessionStorage.setItem("user", serializedUser);
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};

export const clearAuthSession = () => {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("user");
  localStorage.removeItem("token");
  localStorage.removeItem("user");
};
