import { CircleUser, LogOut, RefreshCw } from "lucide-react";

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

function emailLocalPart(email: string): string {
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}

export function UserMenu() {
  const { user, logout } = useAuth();

  const displayName = user?.name ?? "Controller";
  const handle = user?.email ? emailLocalPart(user.email) : "—";

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
            <StatusBadge variant="active">Controller</StatusBadge>
          </div>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="min-h-11 gap-2 px-2 py-2.5 text-base sm:min-h-0 sm:py-1.5 sm:text-sm"
          disabled
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
