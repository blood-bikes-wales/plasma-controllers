import { apiFetch } from "~/lib/api-client";

export type ServiceAreaOption = {
  code: string;
  name: string;
};

type DataList<T> = { data: T[] };

export async function fetchServiceAreas(): Promise<ServiceAreaOption[]> {
  const body = await apiFetch<DataList<ServiceAreaOption>>("/service-areas");
  return body.data;
}

export function serviceAreaLabel(
  code: string,
  areas: readonly ServiceAreaOption[] = [],
): string {
  const match = areas.find((area) => area.code === code);
  if (match) {
    return match.name;
  }

  return code;
}
