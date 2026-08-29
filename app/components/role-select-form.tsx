import { useId } from "react";

import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { isRole, type Role, roleLabel } from "~/lib/roles";

type RoleSelectFormProps = {
  roles: Role[];
  selected: Role | null;
  onSelectedChange: (role: Role) => void;
  onContinue: () => void;
};

export function RoleSelectForm({
  roles,
  selected,
  onSelectedChange,
  onContinue,
}: RoleSelectFormProps) {
  const headingId = useId();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 id={headingId} className="text-2xl font-bold text-bb-gray-900">
          Choose your role
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          This only changes what you see in the app. Access is still decided by
          the server.
        </p>
      </div>
      <RadioGroup
        aria-labelledby={headingId}
        value={selected ?? undefined}
        onValueChange={(value) => {
          if (!isRole(value)) {
            return;
          }
          onSelectedChange(value);
        }}
        className="gap-1"
      >
        {roles.map((role) => {
          const inputId = `${headingId}-${role}`;
          return (
            <div
              key={role}
              className="flex min-h-11 items-center gap-3 rounded-bb-button px-2"
            >
              <RadioGroupItem value={role} id={inputId} />
              <Label
                htmlFor={inputId}
                className="text-base font-medium text-bb-gray-900"
              >
                {roleLabel(role)}
              </Label>
            </div>
          );
        })}
      </RadioGroup>
      <Button
        type="button"
        className="h-14 w-full rounded-bb-button text-lg font-bold"
        disabled={selected == null}
        onClick={onContinue}
      >
        Continue
      </Button>
    </div>
  );
}
