import { getGoogleClientId } from "~/lib/env";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    ux_mode?: "popup" | "redirect";
    context?: "signin" | "signup" | "use";
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: "standard" | "icon";
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
      logo_alignment?: "left" | "center";
      width?: number;
    },
  ) => void;
  cancel: () => void;
};

type GoogleAccounts = {
  id: GoogleAccountsId;
};

declare global {
  interface Window {
    google?: {
      accounts: GoogleAccounts;
    };
  }
}

const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let scriptLoadPromise: Promise<void> | null = null;

function loadGisScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Google Sign-In is only available in the browser"),
    );
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-In")),
      );
      if (window.google?.accounts?.id) {
        resolve();
      }
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load Google Sign-In"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export type MountGoogleSignInButtonOptions = {
  onCredential: (idToken: string) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Button width in CSS pixels (GIS expects a number). */
  width?: number;
};

/**
 * Mounts the official Google Sign-In button (popup UX) into `container`.
 * Returns a cleanup function that clears the container.
 *
 * Prefer this over One Tap `prompt()` for an explicit "Login with Google" CTA.
 */
export async function mountGoogleSignInButton(
  container: HTMLElement,
  { onCredential, onError, width = 320 }: MountGoogleSignInButtonOptions,
): Promise<() => void> {
  await loadGisScript();

  const clientId = getGoogleClientId();
  const google = window.google;
  if (!google?.accounts?.id) {
    throw new Error("Google Sign-In is unavailable");
  }

  container.replaceChildren();

  google.accounts.id.initialize({
    client_id: clientId,
    ux_mode: "popup",
    context: "signin",
    auto_select: false,
    callback: (response) => {
      if (!response.credential) {
        onError?.("Google did not return a sign-in credential");
        return;
      }
      void Promise.resolve(onCredential(response.credential)).catch(
        (error: unknown) => {
          const message =
            error instanceof Error
              ? error.message
              : "Something went wrong during sign-in. Try again.";
          onError?.(message);
        },
      );
    },
  });

  google.accounts.id.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "rectangular",
    logo_alignment: "left",
    width,
  });

  return () => {
    container.replaceChildren();
  };
}
