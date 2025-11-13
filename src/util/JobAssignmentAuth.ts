import { UserLevels } from "@src/constants/enums";
import type { ISessionUser } from "@src/interfaces/ISessionUser";

const parseAllowList = (raw: string | undefined): string[] => {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
};

const authorizedEmails = parseAllowList(process.env.JOB_ASSIGN_AUTHORIZED_EMAILS);

export const canAssignJobs = (user?: ISessionUser): boolean => {
  if (!user) {
    return false;
  }

  if (user.user_level === UserLevels.Admin) {
    return true;
  }

  const normalizedEmail = (user.email ?? "").trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  return authorizedEmails.includes(normalizedEmail);
};

export const getAuthorizedEmails = (): string[] => [...authorizedEmails];

