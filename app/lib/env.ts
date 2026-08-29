function requiredEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getApiBaseUrl(): string {
  return (
    import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ??
    "http://localhost/api"
  );
}

export function getGoogleClientId(): string {
  return requiredEnv(
    "VITE_GOOGLE_CLIENT_ID",
    import.meta.env.VITE_GOOGLE_CLIENT_ID,
  );
}

export function getGoogleMapsApiKey(): string {
  return requiredEnv(
    "VITE_GOOGLE_MAPS_API_KEY",
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  );
}
