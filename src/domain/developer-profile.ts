export const DEVELOPER_PROFILE_FIELDS = ["DISPLAY_NAME", "BIO", "LOCATION"] as const;
export type DeveloperProfileField = (typeof DEVELOPER_PROFILE_FIELDS)[number];
export const DEVELOPER_PROFILE_ACTIONS = ["SET_FIELD", "HIDE_FIELD", "REVERT_FIELD"] as const;
export type DeveloperProfileAction = (typeof DEVELOPER_PROFILE_ACTIONS)[number];
export type DeveloperVisibility = "PUBLIC" | "HIDDEN";

type PublicDeveloperProfile = {
  displayName: string | null;
  bio: string | null;
  location: string | null;
};

export type DeveloperProfileEvent = {
  action: string;
  field: string | null;
  value: string | null;
  createdAt: Date;
};

const PROFILE_KEY: Record<DeveloperProfileField, keyof PublicDeveloperProfile> = {
  DISPLAY_NAME: "displayName",
  BIO: "bio",
  LOCATION: "location",
};

export function applyDeveloperProfileEvents<T extends PublicDeveloperProfile>(
  source: T,
  events: DeveloperProfileEvent[],
): T {
  const result = { ...source };
  for (const event of events.toSorted(
    (left, right) => left.createdAt.getTime() - right.createdAt.getTime(),
  )) {
    if (!isProfileField(event.field)) continue;
    const key = PROFILE_KEY[event.field];
    if (event.action === "SET_FIELD") result[key] = cleanValue(event.value);
    if (event.action === "HIDE_FIELD") result[key] = null;
    if (event.action === "REVERT_FIELD") result[key] = source[key];
  }
  return result;
}

export function validateDeveloperProfileCorrection(input: {
  field: string;
  action: string;
  value?: string | null;
  reason: string;
}): {
  field: DeveloperProfileField;
  action: DeveloperProfileAction;
  value: string | null;
  reason: string;
} {
  if (!isProfileField(input.field))
    throw new Error("Field must be display-name, bio, or location.");
  if (!DEVELOPER_PROFILE_ACTIONS.includes(input.action as DeveloperProfileAction))
    throw new Error("Action must be set, hide, or revert.");
  const action = input.action as DeveloperProfileAction;
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500)
    throw new Error("A 5–500 character audit reason is required.");
  const value = action === "SET_FIELD" ? cleanValue(input.value ?? null) : null;
  if (action === "SET_FIELD" && value === null)
    throw new Error("A non-empty corrected value is required for set.");
  const maximum = input.field === "BIO" ? 500 : input.field === "DISPLAY_NAME" ? 120 : 160;
  if (value && value.length > maximum)
    throw new Error(`Corrected value exceeds the ${maximum}-character limit.`);
  return { field: input.field, action, value, reason };
}

export function validateAuditReason(value: string): string {
  const reason = value.trim();
  if (reason.length < 5 || reason.length > 500)
    throw new Error("A 5–500 character audit reason is required.");
  return reason;
}

function isProfileField(value: string | null): value is DeveloperProfileField {
  return value !== null && DEVELOPER_PROFILE_FIELDS.includes(value as DeveloperProfileField);
}

function cleanValue(value: string | null): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned.length === 0 ? null : cleaned;
}
