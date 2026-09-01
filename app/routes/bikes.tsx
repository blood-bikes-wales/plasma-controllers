import { Bike, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";

import { BikeFormDrawer } from "~/components/bike-form-drawer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { useAuth } from "~/lib/auth";
import {
  areaLabel,
  bikeErrorMessage,
  type FleetBike,
  fetchManagedBikes,
  retireBike,
  statusLabel,
} from "~/lib/bikes";
import { canManageBikes } from "~/lib/capabilities";
import { SERVICE_AREAS } from "~/lib/jobs";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/bikes";

type StatusFilter = "all" | "active" | "retired";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "retired", label: "Retired" },
];

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Bikes — Plasma Controller" }];
}

function statusBadgeClass(status: FleetBike["status"]) {
  if (status === "retired") {
    return "bg-bb-gray-100 text-bb-gray-700 dark:bg-muted dark:text-bb-gray-300";
  }

  return "bg-bb-success-light text-bb-success dark:bg-bb-success/20 dark:text-green-300";
}

function filterTabClass(isActive: boolean) {
  if (isActive) {
    return "bg-bb-cta text-bb-white dark:bg-primary";
  }

  return "bg-bb-white text-bb-gray-700 ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:bg-card dark:text-bb-gray-300 dark:ring-bb-gray-700 dark:hover:bg-muted/50";
}

function BikeCard({
  bike,
  confirmingRetire,
  onConfirmRetire,
  onCancelRetire,
  onEdit,
  onRetire,
  retiring,
}: {
  bike: FleetBike;
  confirmingRetire: boolean;
  onConfirmRetire: () => void;
  onCancelRetire: () => void;
  onEdit: () => void;
  onRetire: () => void;
  retiring: boolean;
}) {
  const canEdit = bike.status === "active";

  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
              {bike.registration}
            </h2>
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              {areaLabel(bike.area)} ·{" "}
              {bike.lastRecordedMileage.toLocaleString()} miles
            </p>
          </div>
          <Badge className={statusBadgeClass(bike.status)}>
            {statusLabel(bike.status)}
          </Badge>
        </div>

        {bike.purchasedAt ? (
          <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
            Purchased {bike.purchasedAt}
          </p>
        ) : null}

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-bb-button px-4"
              onClick={onEdit}
            >
              Edit
            </Button>
            {confirmingRetire ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-10 rounded-bb-button px-4"
                  disabled={retiring}
                  onClick={onConfirmRetire}
                >
                  {retiring ? "Retiring…" : "Confirm retire"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 px-4"
                  disabled={retiring}
                  onClick={onCancelRetire}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="h-10 px-4 text-bb-error hover:text-bb-error"
                onClick={onRetire}
              >
                Retire
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function BikesPage() {
  const { activeRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const canManage = canManageBikes(activeRole);

  const [bikes, setBikes] = useState<FleetBike[]>([]);
  const [areaFilter, setAreaFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmRetireId, setConfirmRetireId] = useState<string | null>(null);
  const [retiringId, setRetiringId] = useState<string | null>(null);

  const isNewOpen = location.pathname === "/bikes/new";
  const editingBikeId = params.bikeId;
  const editingBike = useMemo(
    () => bikes.find((bike) => bike.id === editingBikeId) ?? null,
    [bikes, editingBikeId],
  );
  const isEditOpen =
    Boolean(editingBikeId) &&
    location.pathname !== "/bikes/new" &&
    editingBike !== null;

  const load = useCallback(async () => {
    const next = await fetchManagedBikes({
      area: areaFilter || undefined,
      status: statusFilter,
    });
    setBikes(next);
  }, [areaFilter, statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    void load()
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(bikeErrorMessage(caught, "Unable to load bikes."));
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

  function handleSaved(saved: FleetBike) {
    setBikes((current) => {
      const index = current.findIndex((bike) => bike.id === saved.id);
      if (index === -1) {
        return [...current, saved].sort((a, b) =>
          a.registration.localeCompare(b.registration),
        );
      }

      const next = [...current];
      next[index] = saved;
      return next.sort((a, b) => a.registration.localeCompare(b.registration));
    });
  }

  async function handleConfirmRetire(bikeId: string) {
    setRetiringId(bikeId);
    setError(null);

    try {
      const retired = await retireBike(bikeId);
      handleSaved(retired);
      setConfirmRetireId(null);
    } catch (caught: unknown) {
      setError(bikeErrorMessage(caught, "Unable to retire bike."));
    } finally {
      setRetiringId(null);
    }
  }

  if (!canManage) {
    return (
      <div className="space-y-4 px-5 py-6">
        <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
          Bikes
        </h1>
        <p className="text-sm text-bb-gray-600 dark:text-bb-gray-300">
          You do not have permission to manage the bike fleet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 px-5 pb-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Bike className="size-6 text-bb-cta dark:text-primary" />
              <h1 className="text-2xl font-extrabold text-bb-gray-900 dark:text-bb-gray-100">
                Bikes
              </h1>
            </div>
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Manage motorbikes by area. Retired bikes are hidden from shift
              logon.
            </p>
          </div>
          <Button
            render={<Link to="/bikes/new" />}
            nativeButton={false}
            className="h-11 gap-2 rounded-bb-button px-4 text-base font-bold"
          >
            <Plus className="size-4" aria-hidden="true" />
            Add bike
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition-opacity",
                filterTabClass(statusFilter === filter.value),
              )}
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="bike-area-filter"
            className="text-sm font-medium text-bb-gray-700 dark:text-bb-gray-300"
          >
            Filter by area
          </label>
          <select
            id="bike-area-filter"
            className="h-11 w-full rounded-md border border-bb-gray-300 bg-bb-white px-3 text-base dark:border-bb-gray-600 dark:bg-input/30"
            value={areaFilter}
            onChange={(event) => setAreaFilter(event.target.value)}
          >
            <option value="">All areas</option>
            {SERVICE_AREAS.map((area) => (
              <option key={area.value} value={area.value}>
                {area.label}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-bb-error">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            Loading bikes…
          </p>
        ) : null}

        {!isLoading && bikes.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            No bikes match the current filters.
          </p>
        ) : null}

        <div className="space-y-3">
          {bikes.map((bike) => (
            <BikeCard
              key={bike.id}
              bike={bike}
              confirmingRetire={confirmRetireId === bike.id}
              retiring={retiringId === bike.id}
              onEdit={() => navigate(`/bikes/${bike.id}`)}
              onRetire={() => setConfirmRetireId(bike.id)}
              onCancelRetire={() => setConfirmRetireId(null)}
              onConfirmRetire={() => {
                void handleConfirmRetire(bike.id);
              }}
            />
          ))}
        </div>
      </div>

      <BikeFormDrawer
        mode="create"
        open={isNewOpen}
        onOpenChange={(open) => {
          if (!open) {
            navigate("/bikes");
          }
        }}
        onSaved={handleSaved}
      />

      <BikeFormDrawer
        mode="edit"
        open={isEditOpen}
        bike={editingBike}
        onOpenChange={(open) => {
          if (!open) {
            navigate("/bikes");
          }
        }}
        onSaved={handleSaved}
      />

      <Outlet />
    </div>
  );
}
