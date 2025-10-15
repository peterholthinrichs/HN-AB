// Auth utility functions

export const getAuthToken = (): string | null => {
  return localStorage.getItem("auth_token");
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem("auth_token", token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem("auth_token");
};

export const isAuthenticated = (): boolean => {
  const token = getAuthToken();
  if (!token) return false;

  try {
    // Decode JWT to check expiry (simple check without verification)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is expired
    if (payload.exp && payload.exp < now) {
      removeAuthToken();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Error checking authentication:", error);
    removeAuthToken();
    return false;
  }
};

export const logout = (): void => {
  removeAuthToken();
};
