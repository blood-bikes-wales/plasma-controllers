import { CircleUser, LogOut, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";

import { StatusBadge } from "~/components/status-badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useAuth } from "~/lib/auth";
import { primaryRoleLabel, roleLabel } from "~/lib/roles";

function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  if (at === -1) {
    return email;
  }
  return email.slice(0, at);
}

export function UserMenu() {
  const { user, activeRole, logout } = useAuth();
  const navigate = useNavigate();

  const displayName = user?.name ?? "Controller";
  const handle = user?.email ? emailLocalPart(user.email) : "—";
  const badgeLabel = activeRole
    ? roleLabel(activeRole)
    : primaryRoleLabel(user?.roles);
  const canChangeRole = (user?.roles.length ?? 0) > 1;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-lg"
            className="size-11 shrink-0 text-bb-navy hover:bg-bb-gray-100"
            aria-label="Open user menu"
          />
        }
      >
        <CircleUser className="size-6" strokeWidth={1.75} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[min(calc(100vw-2.5rem),18rem)] min-w-48 sm:w-56"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2 text-sm font-semibold text-bb-gray-900">
            {displayName}
          </DropdownMenuLabel>
          <div className="flex flex-wrap items-center gap-1.5 px-2 pt-0 pb-2">
            <span className="text-xs font-normal text-bb-gray-500">
              {handle}
            </span>
            <StatusBadge variant="active">{badgeLabel}</StatusBadge>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 gap-2 px-2 py-2.5 text-base sm:min-h-0 sm:py-1.5 sm:text-sm"
          disabled={!canChangeRole}
          onClick={() => navigate("/select-role")}
        >
          <RefreshCw className="size-5 sm:size-4" strokeWidth={1.75} />
          Change Role
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 gap-2 px-2 py-2.5 text-base sm:min-h-0 sm:py-1.5 sm:text-sm"
          onClick={logout}
        >
          <LogOut className="size-5 sm:size-4" strokeWidth={1.75} />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
