import { Clock, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AssignBikeDrawer } from "~/components/assign-bike-drawer";
import { LogoffShiftDrawer } from "~/components/logoff-shift-drawer";
import { LogonShiftDrawer } from "~/components/logon-shift-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useAuth } from "~/lib/auth";
import type { BikeAssignment } from "~/lib/bike-assignment";
import { Role } from "~/lib/roles";
import {
  type ActiveShift,
  assignShiftBike,
  type Bike,
  errorMessage,
  fetchActiveShifts,
  fetchBikes,
  fetchVolunteers,
  formatShiftStartedAt,
  type LogoffShiftPayload,
  logoffShift,
  logonShift,
  type RiderOption,
} from "~/lib/shifts";

import type { Route } from "./+types/shifts";

const MANAGE_ROLES = new Set<Role>([Role.Admin, Role.Controller]);

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Shifts — Plasma Controller" }];
}

function ActiveShiftCard({
  shift,
  canManage,
  onLogoff,
  onAssignBike,
}: {
  shift: ActiveShift;
  canManage: boolean;
  onLogoff: () => void;
  onAssignBike: () => void;
}) {
  return (
    <Card className="h-full rounded-bb-card border-0 bg-bb-white py-5 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
            {shift.riderName}
          </span>
          <Badge className="border-bb-status-active-border bg-bb-status-active-bg text-bb-status-active-text dark:bg-bb-navy-light/30 dark:text-blue-200">
            On duty
          </Badge>
        </div>

        <div className="space-y-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
          {shift.bikeRegistration ? (
            <>
              <p>
                Bike{" "}
                <span className="font-mono font-medium text-bb-gray-900 dark:text-bb-gray-100">
                  {shift.bikeRegistration}
                </span>
              </p>
              <p>Start mileage: {shift.startMileage}</p>
              {shift.mileageVarianceReason ? (
                <p className="text-bb-warning">
                  Mileage variance: {shift.mileageVarianceReason}
                </p>
              ) : null}
            </>
          ) : (
            <p>No bike assigned</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
          <div className="flex items-center gap-1.5 text-sm text-bb-gray-500 dark:text-bb-gray-400">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            <span>Since {formatShiftStartedAt(shift.startedAt)}</span>
          </div>
          {canManage ? (
            <div className="flex items-center gap-2">
              {shift.bikeId === null ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 px-3"
                  onClick={onAssignBike}
                >
                  Assign bike
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 px-3"
                onClick={onLogoff}
              >
                Log off
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ShiftsPage() {
  const { user } = useAuth();
  const canManage = user?.roles.some((role) => MANAGE_ROLES.has(role)) ?? false;

  const [bikes, setBikes] = useState<Bike[]>([]);
  const [riders, setRiders] = useState<RiderOption[]>([]);
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogonOpen, setIsLogonOpen] = useState(false);
  const [logoffShiftId, setLogoffShiftId] = useState<string | null>(null);
  const [assignShiftId, setAssignShiftId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [nextShifts, nextBikes, nextRiders] = await Promise.all([
      fetchActiveShifts(),
      fetchBikes(),
      fetchVolunteers(),
    ]);
    setActiveShifts(nextShifts);
    setBikes(nextBikes);
    setRiders(nextRiders);
  }, []);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(errorMessage(caught, "Unable to load shifts."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [load]);

  const onShiftRiderIds = useMemo(
    () => new Set(activeShifts.map((shift) => shift.riderId)),
    [activeShifts],
  );
  const onShiftBikeIds = useMemo(
    () =>
      new Set(
        activeShifts.flatMap((shift) =>
          shift.bikeId === null ? [] : [shift.bikeId],
        ),
      ),
    [activeShifts],
  );

  const availableRiders = riders.filter(
    (rider) => !onShiftRiderIds.has(rider.id),
  );
  const availableBikes = bikes.filter((bike) => !onShiftBikeIds.has(bike.id));
  const shiftToLogoff = activeShifts.find(
    (shift) => shift.id === logoffShiftId,
  );
  const shiftToAssign = activeShifts.find(
    (shift) => shift.id === assignShiftId,
  );
  const assignRider = riders.find(
    (rider) => rider.id === shiftToAssign?.riderId,
  );

  async function handleLogon(input: {
    riderId: string;
    bikeId?: string;
    startMileage?: number;
    mileageVarianceReason?: string;
  }) {
    setError(null);
    try {
      const shift = await logonShift({
        riderId: input.riderId,
        bikeId: input.bikeId,
        startMileage: input.startMileage,
        mileageVarianceReason: input.mileageVarianceReason,
      });
      setActiveShifts((current) => [...current, shift]);
      setIsLogonOpen(false);
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Unable to log the rider on."));
    }
  }

  async function handleAssignBike(shiftId: string, assignment: BikeAssignment) {
    setError(null);
    try {
      const updated = await assignShiftBike(shiftId, {
        bikeId: assignment.bikeId,
        startMileage: assignment.startMileage,
        mileageVarianceReason: assignment.mileageVarianceReason,
      });
      setActiveShifts((current) =>
        current.map((item) => (item.id === shiftId ? updated : item)),
      );
      setAssignShiftId(null);
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Unable to assign the bike."));
    }
  }

  async function handleLogoff(shiftId: string, result: LogoffShiftPayload) {
    setError(null);
    try {
      await logoffShift(shiftId, result);
      const shift = activeShifts.find((item) => item.id === shiftId);
      if (shift?.bikeId && result.endMileage !== undefined) {
        const { endMileage } = result;
        // This log off is now the bike's latest shift: its faults replace the
        // old note, and no faults clears it (the API trims and drops blanks).
        const lastShiftNote = result.faults?.trim() || null;
        const lastShiftNoteAt = lastShiftNote ? new Date().toISOString() : null;
        setBikes((current) =>
          current.map((bike) =>
            bike.id === shift.bikeId
              ? {
                  ...bike,
                  lastRecordedMileage: endMileage,
                  lastShiftNote,
                  lastShiftNoteAt,
                }
              : bike,
          ),
        );
      }
      setActiveShifts((current) =>
        current.filter((item) => item.id !== shiftId),
      );
      setLogoffShiftId(null);
    } catch (caught: unknown) {
      setError(errorMessage(caught, "Unable to log the rider off."));
    }
  }

  return (
    <>
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
              Shifts
            </h1>
            <Badge className="bg-bb-navy text-bb-white dark:bg-bb-navy-light">
              {activeShifts.length} on duty
            </Badge>
          </div>
          {canManage ? (
            <Button
              type="button"
              className="h-11 gap-2 rounded-bb-button px-5 text-base font-bold sm:h-12"
              onClick={() => setIsLogonOpen(true)}
              disabled={isLoading}
            >
              <UserPlus aria-hidden="true" />
              Log on rider
            </Button>
          ) : null}
        </header>

        {error ? (
          <p className="text-sm text-bb-warning" role="alert">
            {error}
          </p>
        ) : null}

        <section aria-label="Active shifts">
          {isLoading ? (
            <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
              Loading shifts…
            </p>
          ) : activeShifts.length > 0 ? (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeShifts.map((shift) => (
                <li key={shift.id}>
                  <ActiveShiftCard
                    shift={shift}
                    canManage={canManage}
                    onLogoff={() => setLogoffShiftId(shift.id)}
                    onAssignBike={() => setAssignShiftId(shift.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-12 text-center text-base text-bb-gray-500 dark:text-bb-gray-400">
              No riders are currently on shift.
            </p>
          )}
        </section>
      </div>

      <LogonShiftDrawer
        open={isLogonOpen}
        onOpenChange={setIsLogonOpen}
        riders={availableRiders}
        bikes={availableBikes}
        onLogon={handleLogon}
      />
      <AssignBikeDrawer
        open={assignShiftId !== null}
        onOpenChange={(open) => {
          if (!open) setAssignShiftId(null);
        }}
        shift={
          shiftToAssign
            ? { id: shiftToAssign.id, riderName: shiftToAssign.riderName }
            : undefined
        }
        rider={assignRider}
        bikes={availableBikes}
        onAssign={handleAssignBike}
      />
      <LogoffShiftDrawer
        open={logoffShiftId !== null}
        onOpenChange={(open) => {
          if (!open) setLogoffShiftId(null);
        }}
        shift={
          shiftToLogoff
            ? {
                id: shiftToLogoff.id,
                riderName: shiftToLogoff.riderName,
                bikeRegistration: shiftToLogoff.bikeRegistration,
                startMileage: shiftToLogoff.startMileage,
                startedAt: formatShiftStartedAt(shiftToLogoff.startedAt),
              }
            : undefined
        }
        onLogoff={handleLogoff}
      />
    </>
  );
}
