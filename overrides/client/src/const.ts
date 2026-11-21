export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Start first-party Google Sign-In. Navigation happens only from a user action.
export const startLogin = () => {
  window.location.assign("/api/oauth/google");
};
