import { Bike, Search, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  type DirectoryBike,
  type DirectoryBikeDetail,
  type DirectoryVolunteer,
  directoryErrorMessage,
  fetchBikeDetail,
  hasBikeSearch,
  hasVolunteerSearch,
  searchBikes,
  searchVolunteers,
} from "~/lib/directory";
import { cn } from "~/lib/utils";

import type { Route } from "./+types/directory";

type DirectoryTab = "riders" | "bikes";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Directory — Plasma Controller" }];
}

function tabClass(isActive: boolean) {
  if (isActive) {
    return "bg-bb-cta text-bb-white dark:bg-primary";
  }

  return "bg-bb-white text-bb-gray-700 ring-1 ring-bb-gray-200 hover:bg-bb-gray-50 dark:bg-card dark:text-bb-gray-300 dark:ring-bb-gray-700 dark:hover:bg-muted/50";
}

function VolunteerCard({ volunteer }: { volunteer: DirectoryVolunteer }) {
  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
            {volunteer.name}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {volunteer.roles.map((role) => (
              <Badge
                key={role}
                variant="outline"
                className="border-bb-gray-200 text-bb-gray-700 dark:border-bb-gray-600 dark:text-bb-gray-200"
              >
                {role}
              </Badge>
            ))}
          </div>
        </div>

        <dl className="grid gap-2 text-sm text-bb-gray-600 dark:text-bb-gray-300">
          {volunteer.area ? (
            <div className="flex gap-2">
              <dt className="font-medium text-bb-gray-500 dark:text-bb-gray-400">
                Area
              </dt>
              <dd>{volunteer.area}</dd>
            </div>
          ) : null}
          {volunteer.phone ? (
            <div className="flex gap-2">
              <dt className="font-medium text-bb-gray-500 dark:text-bb-gray-400">
                Phone
              </dt>
              <dd>{volunteer.phone}</dd>
            </div>
          ) : null}
          {volunteer.email ? (
            <div className="flex gap-2">
              <dt className="font-medium text-bb-gray-500 dark:text-bb-gray-400">
                Email
              </dt>
              <dd>{volunteer.email}</dd>
            </div>
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function BikeCard({
  bike,
  detail,
  isExpanded,
  onToggle,
}: {
  bike: DirectoryBike;
  detail: DirectoryBikeDetail | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-mono text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
              {bike.registration}
            </h2>
            <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Last recorded mileage: {bike.lastRecordedMileage.toLocaleString()}
              {bike.area ? ` · ${bike.area}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {bike.status === "retired" ? (
              <Badge className="bg-bb-gray-100 text-bb-gray-700 dark:bg-muted dark:text-bb-gray-300">
                Retired
              </Badge>
            ) : null}
            <button
              type="button"
              className="text-sm font-semibold text-bb-cta hover:underline dark:text-primary"
              onClick={onToggle}
            >
              {isExpanded ? "Hide history" : "Show history"}
            </button>
          </div>
        </div>

        {isExpanded && detail ? (
          <div className="space-y-2 border-t border-bb-gray-100 pt-3 dark:border-bb-gray-700">
            {detail.mileageHistory.length === 0 ? (
              <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
                No mileage history recorded yet.
              </p>
            ) : (
              detail.mileageHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg bg-bb-gray-50 px-3 py-2 text-sm dark:bg-muted/40"
                >
                  <p className="font-medium text-bb-gray-900 dark:text-bb-gray-100">
                    {entry.mileage} miles
                  </p>
                  {entry.reason ? (
                    <p className="text-bb-gray-600 dark:text-bb-gray-300">
                      {entry.reason}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function DirectoryPage() {
  const [tab, setTab] = useState<DirectoryTab>("riders");
  const [nameQuery, setNameQuery] = useState("");
  const [roleQuery, setRoleQuery] = useState("");
  const [areaQuery, setAreaQuery] = useState("");
  const [bikeQuery, setBikeQuery] = useState("");
  const [volunteers, setVolunteers] = useState<DirectoryVolunteer[]>([]);
  const [bikes, setBikes] = useState<DirectoryBike[]>([]);
  const [bikeDetails, setBikeDetails] = useState<
    Record<string, DirectoryBikeDetail>
  >({});
  const [expandedBikeId, setExpandedBikeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const runVolunteerSearch = useCallback(async () => {
    const params = {
      q: nameQuery,
      role: roleQuery,
      area: areaQuery,
    };

    if (!hasVolunteerSearch(params)) {
      setVolunteers([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      setVolunteers(await searchVolunteers(params));
    } catch (caught: unknown) {
      setVolunteers([]);
      setError(
        directoryErrorMessage(caught, "Unable to search the rider directory."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [areaQuery, nameQuery, roleQuery]);

  const runBikeSearch = useCallback(async () => {
    if (!hasBikeSearch(bikeQuery)) {
      setBikes([]);
      setExpandedBikeId(null);
      setHasSearched(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      setBikes(await searchBikes(bikeQuery));
      setExpandedBikeId(null);
    } catch (caught: unknown) {
      setBikes([]);
      setError(
        directoryErrorMessage(caught, "Unable to search the bike directory."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [bikeQuery]);

  useEffect(() => {
    if (tab !== "riders") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void runVolunteerSearch();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [runVolunteerSearch, tab]);

  useEffect(() => {
    if (tab !== "bikes") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void runBikeSearch();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [runBikeSearch, tab]);

  const toggleBikeHistory = async (bikeId: string) => {
    if (expandedBikeId === bikeId) {
      setExpandedBikeId(null);
      return;
    }

    setExpandedBikeId(bikeId);

    if (bikeDetails[bikeId]) {
      return;
    }

    try {
      const detail = await fetchBikeDetail(bikeId);
      setBikeDetails((current) => ({ ...current, [bikeId]: detail }));
    } catch (caught: unknown) {
      setError(
        directoryErrorMessage(caught, "Unable to load bike mileage history."),
      );
      setExpandedBikeId(null);
    }
  };

  const emptyCopy =
    tab === "riders"
      ? "Search by name, role, or area to find riders."
      : "Search by registration to find bikes.";

  const noResultsCopy =
    tab === "riders"
      ? "No riders match your search."
      : "No bikes match your search.";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-bb-navy dark:text-bb-white">
          Directory
        </h1>
        <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
          Read-only rider and bike lookup for the Blood Bikes Wales fleet.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
            tabClass(tab === "riders"),
          )}
          onClick={() => {
            setTab("riders");
            setHasSearched(false);
            setError(null);
          }}
        >
          <Users className="size-4" aria-hidden="true" />
          Riders
        </button>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors",
            tabClass(tab === "bikes"),
          )}
          onClick={() => {
            setTab("bikes");
            setHasSearched(false);
            setError(null);
          }}
        >
          <Bike className="size-4" aria-hidden="true" />
          Bikes
        </button>
      </div>

      {tab === "riders" ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="directory-name">Name</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-bb-gray-400"
                aria-hidden="true"
              />
              <Input
                id="directory-name"
                value={nameQuery}
                onChange={(event) => setNameQuery(event.target.value)}
                placeholder="Search name"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="directory-role">Role</Label>
            <Input
              id="directory-role"
              value={roleQuery}
              onChange={(event) => setRoleQuery(event.target.value)}
              placeholder="Rider, Controller…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="directory-area">Area</Label>
            <Input
              id="directory-area"
              value={areaQuery}
              onChange={(event) => setAreaQuery(event.target.value)}
              placeholder="South Wales…"
            />
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="directory-bike">Registration</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-bb-gray-400"
              aria-hidden="true"
            />
            <Input
              id="directory-bike"
              value={bikeQuery}
              onChange={(event) => setBikeQuery(event.target.value)}
              placeholder="CF12 ABC"
              className="pl-9"
            />
          </div>
        </div>
      )}

      {error ? (
        <p className="text-sm text-bb-error" role="alert">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
          Searching…
        </p>
      ) : null}

      {!hasSearched && !isLoading ? (
        <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
          {emptyCopy}
        </p>
      ) : null}

      {hasSearched && !isLoading && tab === "riders" ? (
        volunteers.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            {noResultsCopy}
          </p>
        ) : (
          <div className="grid gap-3">
            {volunteers.map((volunteer) => (
              <VolunteerCard key={volunteer.id} volunteer={volunteer} />
            ))}
          </div>
        )
      ) : null}

      {hasSearched && !isLoading && tab === "bikes" ? (
        bikes.length === 0 ? (
          <p className="text-sm text-bb-gray-500 dark:text-bb-gray-400">
            {noResultsCopy}
          </p>
        ) : (
          <div className="grid gap-3">
            {bikes.map((bike) => (
              <BikeCard
                key={bike.id}
                bike={bike}
                detail={bikeDetails[bike.id] ?? null}
                isExpanded={expandedBikeId === bike.id}
                onToggle={() => {
                  void toggleBikeHistory(bike.id);
                }}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
