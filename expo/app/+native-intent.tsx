type RedirectSystemPathInput = {
  path: string;
  initial: boolean;
};

function normalizePath(value: string) {
  if (!value) return "/";

  try {
    const decoded = decodeURIComponent(value);
    return decoded.trim();
  } catch {
    return value.trim();
  }
}

function getTokenFromUrl(value: string) {
  try {
    const parsed = new URL(value);

    return (
      parsed.searchParams.get("token") ||
      parsed.searchParams.get("reset_token") ||
      parsed.searchParams.get("code") ||
      ""
    );
  } catch {
    const tokenMatch =
      value.match(/[?&]token=([^&]+)/) ||
      value.match(/[?&]reset_token=([^&]+)/) ||
      value.match(/[?&]code=([^&]+)/);

    return tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : "";
  }
}

function toResetPasswordPath(path: string) {
  const token = getTokenFromUrl(path);

  if (!token) {
    return "/(auth)/reset-password";
  }

  return `/(auth)/reset-password?token=${encodeURIComponent(token)}`;
}

export function redirectSystemPath({ path }: RedirectSystemPathInput) {
  const normalizedPath = normalizePath(path);
  const lowerPath = normalizedPath.toLowerCase();

  if (
    lowerPath.includes("reset-password") ||
    lowerPath.includes("reset_password") ||
    lowerPath.includes("forgot-password") ||
    lowerPath.includes("password-reset")
  ) {
    return toResetPasswordPath(normalizedPath);
  }

  if (
    lowerPath.startsWith("coachflow://reset-password") ||
    lowerPath.startsWith("coachflow://reset_password") ||
    lowerPath.startsWith("coachflow://forgot-password")
  ) {
    return toResetPasswordPath(normalizedPath);
  }

  if (
    lowerPath.includes("/api/v1/auth/reset-password") ||
    lowerPath.includes("/auth/reset-password")
  ) {
    return toResetPasswordPath(normalizedPath);
  }

  if (
    lowerPath === "/" ||
    lowerPath === "" ||
    lowerPath === "coachflow://" ||
    lowerPath === "coachflow:///"
  ) {
    return "/";
  }

  if (normalizedPath.startsWith("/")) {
    return normalizedPath;
  }

  return "/";
}
