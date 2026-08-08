import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { Button } from "~/components/ui/button";
import { ApiError } from "~/lib/api-client";
import { useAuth } from "~/lib/auth";
import { mountGoogleSignInButton } from "~/lib/google-sign-in";
import { cn } from "~/lib/utils";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return "Your Google account is not allowed for this app. Use your organisation account.";
    }
    if (error.status === 401) {
      return "Google sign-in could not be verified. Try again.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong during sign-in. Try again.";
}

type LoginFormProps = React.ComponentProps<"div"> & {
  /**
   * Test-only injectable sign-in. When set, shows the custom button instead of
   * the official Google Sign-In button.
   */
  requestIdToken?: () => Promise<string>;
};

export function LoginForm({
  className,
  requestIdToken,
  ...props
}: LoginFormProps) {
  const navigate = useNavigate();
  const { status, loginWithCredential } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleButtonError, setGoogleButtonError] = useState<string | null>(
    null,
  );
  const googleButtonRef = useRef<HTMLDivElement>(null);

  const useTestSignIn = requestIdToken != null;

  useEffect(() => {
    if (useTestSignIn || status !== "unauthenticated") {
      return;
    }

    const container = googleButtonRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void mountGoogleSignInButton(container, {
      width: Math.min(container.clientWidth || 320, 400),
      onCredential: async (idToken) => {
        setError(null);
        setIsSigningIn(true);
        try {
          await loginWithCredential(idToken);
          navigate("/jobs", { replace: true });
        } catch (err) {
          setError(authErrorMessage(err));
        } finally {
          setIsSigningIn(false);
        }
      },
      onError: (message) => {
        setError(message);
      },
    })
      .then((unmount) => {
        if (cancelled) {
          unmount();
          return;
        }
        cleanup = unmount;
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setGoogleButtonError(authErrorMessage(err));
        }
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [useTestSignIn, status, loginWithCredential, navigate]);

  if (status === "authenticated") {
    return <Navigate to="/jobs" replace />;
  }

  async function handleTestLogin() {
    if (!requestIdToken) {
      return;
    }
    setError(null);
    setIsSigningIn(true);
    try {
      const idToken = await requestIdToken();
      await loginWithCredential(idToken);
      navigate("/jobs", { replace: true });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsSigningIn(false);
    }
  }

  const displayError = error ?? googleButtonError;

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold text-bb-gray-900">
          Sign in to Plasma Controller
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          Controllers sign in with their Google account
        </p>
      </div>
      {displayError ? (
        <p
          role="alert"
          className="rounded-bb-button bg-bb-error-light px-3 py-2 text-center text-sm font-medium text-bb-error"
        >
          {displayError}
        </p>
      ) : null}
      {useTestSignIn ? (
        <Button
          variant="outline"
          type="button"
          className="h-14 w-full gap-3 rounded-bb-button text-base font-semibold"
          onClick={handleTestLogin}
          disabled={isSigningIn || status === "loading"}
        >
          <GoogleIcon className="size-5" />
          {isSigningIn ? "Signing in…" : "Login with Google"}
        </Button>
      ) : (
        <div className="flex w-full flex-col items-center gap-2">
          {isSigningIn || status === "loading" ? (
            <p className="text-sm font-medium text-bb-gray-500">
              {isSigningIn ? "Signing in…" : "Loading sign-in…"}
            </p>
          ) : null}
          <div
            ref={googleButtonRef}
            className={cn(
              "flex min-h-14 w-full justify-center [&>div]:w-full!",
              (isSigningIn || status === "loading") &&
                "pointer-events-none opacity-60",
            )}
            aria-busy={isSigningIn || status === "loading"}
          />
        </div>
      )}
    </div>
  );
}
