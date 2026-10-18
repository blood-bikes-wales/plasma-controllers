import { Search } from "lucide-react";
import { useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  formatShiftWindow,
  lookupSection172Rider,
  type Section172LookupResult,
  type Section172RiderMatch,
} from "~/lib/section-172";

import type { Route } from "./+types/operations.section-172";

export function meta(_args: Route.MetaArgs) {
  return [{ title: "Section 172 — Plasma Controller" }];
}

function RiderMatchCard({ match }: { match: Section172RiderMatch }) {
  return (
    <Card className="rounded-bb-card border-0 bg-bb-white py-4 shadow-none ring-1 ring-bb-gray-200 dark:bg-card dark:ring-bb-gray-700">
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-bb-gray-900 dark:text-bb-gray-100">
              {match.riderName}
            </h3>
            <p className="mt-1 font-mono text-sm text-bb-gray-500 dark:text-bb-gray-400">
              Membership {match.membershipNumber}
            </p>
          </div>
          <Badge className="bg-bb-navy/10 text-bb-navy dark:bg-bb-navy-light/30 dark:text-blue-200">
            {match.registration}
          </Badge>
        </div>
        <p className="text-sm text-bb-gray-700 dark:text-bb-gray-300">
          On shift {formatShiftWindow(match.shiftStartedAt, match.shiftEndedAt)}
        </p>
      </CardContent>
    </Card>
  );
}

function LookupResults({ result }: { result: Section172LookupResult }) {
  if (result.status === "none") {
    return (
      <p
        role="status"
        className="text-sm text-bb-gray-500 dark:text-bb-gray-400"
      >
        No rider was logged against that registration at the time given.
      </p>
    );
  }

  if (result.status === "match") {
    const [match] = result.matches;
    return (
      <div className="space-y-3">
        <p role="status" className="text-sm font-medium text-bb-success">
          {match.riderName} (membership {match.membershipNumber}) was riding
          during the time the Section 172 mentions.
        </p>
        <RiderMatchCard match={match} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p role="status" className="text-sm font-medium text-bb-warning">
        More than one rider matches this registration and time. Check membership
        numbers carefully.
      </p>
      {result.matches.map((match) => (
        <RiderMatchCard
          key={`${match.membershipNumber}-${match.shiftStartedAt}`}
          match={match}
        />
      ))}
    </div>
  );
}

export default function OperationsSection172Page() {
  const [registration, setRegistration] = useState("");
  const [incidentAt, setIncidentAt] = useState("");
  const [result, setResult] = useState<Section172LookupResult | null>(null);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setResult(lookupSection172Rider(registration, incidentAt));
  }

  return (
    <div className="space-y-4 px-5 pb-5 pt-4">
      <div>
        <h2 className="text-xl font-bold text-bb-gray-900 dark:text-bb-gray-100">
          Section 172
        </h2>
        <p className="mt-1 text-sm text-bb-gray-500 dark:text-bb-gray-400">
          Enter the vehicle registration and time from the notice to see who was
          riding.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="section-172-registration">Registration</Label>
          <Input
            id="section-172-registration"
            value={registration}
            onChange={(event) => setRegistration(event.target.value)}
            placeholder="e.g. CF14 ABC"
            className="h-11 font-mono uppercase"
            autoComplete="off"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="section-172-incident-at">Date and time</Label>
          <Input
            id="section-172-incident-at"
            type="datetime-local"
            value={incidentAt}
            onChange={(event) => setIncidentAt(event.target.value)}
            className="h-11"
            required
          />
        </div>
        <Button
          type="submit"
          className="h-11 gap-2 rounded-bb-button px-4 text-base font-bold"
        >
          <Search className="size-4" aria-hidden="true" />
          Find rider
        </Button>
      </form>

      {result ? <LookupResults result={result} /> : null}
    </div>
  );
}
