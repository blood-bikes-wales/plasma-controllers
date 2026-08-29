import { useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { RoleSelectForm } from "~/components/role-select-form";
import { useAuth } from "~/lib/auth";
import { homePathForRole } from "~/lib/capabilities";
import { primaryRole, type Role } from "~/lib/roles";

import type { Route } from "./+types/select-role";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Choose role — Plasma Controller" }];
}

export default function SelectRolePage() {
  const { user, activeRole, setActiveRole, status } = useAuth();
  const navigate = useNavigate();
  const roles = user?.roles ?? [];
  const [picked, setPicked] = useState<Role | null>(null);
  const selected = picked ?? activeRole ?? primaryRole(roles);

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bb-gray-50">
        <p className="text-base font-medium text-bb-gray-500">
          Checking sign-in…
        </p>
      </div>
    );
  }

  if (roles.length < 2) {
    return <Navigate to={homePathForRole(activeRole)} replace />;
  }

  function handleContinue() {
    if (!selected) {
      return;
    }
    setActiveRole(selected);
    navigate(homePathForRole(selected), { replace: true });
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-bb-gray-50 p-6 md:p-10">
      <div className="w-full max-w-xs">
        <RoleSelectForm
          roles={roles}
          selected={selected}
          onSelectedChange={setPicked}
          onContinue={handleContinue}
        />
      </div>
    </div>
  );
}
