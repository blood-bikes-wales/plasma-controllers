import { Clock, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LogoffShiftDrawer } from "~/components/logoff-shift-drawer";
import { LogonShiftDrawer } from "~/components/logon-shift-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useAuth } from "~/lib/auth";
import { Role } from "~/lib/roles";
import {
  type ActiveShift,
  type Bike,
  errorMessage,
  fetchActiveShifts,
  fetchBikes,
  fetchVolunteers,
  formatShiftStartedAt,
  logoffShift,
  logonShift,
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
}: {
  shift: ActiveShift;
  canManage: boolean;
  onLogoff: () => void;
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
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-bb-gray-100 pt-4 dark:border-bb-gray-700">
          <div className="flex items-center gap-1.5 text-sm text-bb-gray-500 dark:text-bb-gray-400">
            <Clock className="size-4 shrink-0" aria-hidden="true" />
            <span>Since {formatShiftStartedAt(shift.startedAt)}</span>
          </div>
          {canManage ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={onLogoff}
            >
              Log off
            </Button>
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
  const [riders, setRiders] = useState<{ id: string; name: string }[]>([]);
  const [activeShifts, setActiveShifts] = useState<ActiveShift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLogonOpen, setIsLogonOpen] = useState(false);
  const [logoffShiftId, setLogoffShiftId] = useState<string | null>(null);

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
    () => new Set(activeShifts.map((shift) => shift.bikeId)),
    [activeShifts],
  );

  const availableRiders = riders.filter(
    (rider) => !onShiftRiderIds.has(rider.id),
  );
  const availableBikes = bikes.filter((bike) => !onShiftBikeIds.has(bike.id));
  const shiftToLogoff = activeShifts.find(
    (shift) => shift.id === logoffShiftId,
  );

  async function handleLogon(input: {
    riderId: string;
    bikeId: string;
    startMileage: number;
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

  async function handleLogoff(
    shiftId: string,
    result: { endMileage: number; faults?: string },
  ) {
    setError(null);
    try {
      await logoffShift(shiftId, result);
      const shift = activeShifts.find((item) => item.id === shiftId);
      if (shift) {
        setBikes((current) =>
          current.map((bike) =>
            bike.id === shift.bikeId
              ? { ...bike, lastRecordedMileage: result.endMileage }
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
