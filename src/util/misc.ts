/**
 * Miscellaneous shared functions go here.
 */

import { CreditRequestStatus } from "@src/constants/enums";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import { RouteError } from "@src/other/classes";
import mysql, { RowDataPacket } from "mysql2/promise";

/**
 * Get a random number between 1 and 1,000,000,000,000
 */
export function getRandomInt(): number {
  return Math.floor(Math.random() * 1_000_000_000_000);
}

/**
 * Wait for a certain number of milliseconds.
 */
export function tick(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, milliseconds);
  });
}

export function isUser(arg: unknown): boolean {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "email" in arg &&
    "password" in arg &&
    "first_name" in arg
  );
}
export function isPortalUser(arg: unknown): boolean {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "auth_id" in arg &&
    "email" in arg
  );
}
export function isCustomer(arg: unknown): boolean {
  return typeof arg === "object" && arg !== null && "name" in arg;
}
export function isRoute(arg: unknown): boolean {
  return typeof arg === "object" && arg !== null && "name" in arg;
}
export function isStop(arg: unknown): boolean {
  return typeof arg === "object" && arg !== null;
}
export function isSessionUser(arg: unknown): boolean {
  return (
    typeof arg === "object" &&
    arg !== null &&
    "_id" in arg &&
    "email" in arg &&
    "first_name" in arg &&
    "role" in arg
  );
}
export function isArrayOfStrings(arg: unknown): boolean {
  return (
    arg !== null &&
    Array.isArray(arg) &&
    arg.every((item) => typeof item === "string")
  );
}
export function isCreditReqStatus(arg: unknown): boolean {
  return (
    arg !== null &&
    arg === CreditRequestStatus.Approved.valueOf() || arg === CreditRequestStatus.Pending.valueOf()
  );
}
export const formatDate = (date: Date): string => {
  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
};
export const trim = (value: string): string => {
  return value.trim();
};
export const empty = (value: string): boolean => {
  return value.length === 0;
};

const INVALID_DOB_ERR =
  "Invalid date of birth. Please use DD-MM-YYYY, e.g. 23-05-1998.";

/**
 * Normalize a date of birth to MySQL's YYYY-MM-DD.
 * Accepts YYYY-MM-DD (optionally with a time part), DD-MM-YYYY, and the
 * DD-MM-YY sent by app builds up to 28.0.17. Separators may be - / or .
 * Two-digit years resolve to the most recent year that is not in the future.
 * Returns "" for an empty value; throws a 400 RouteError when invalid.
 */
export function normalizeDateOfBirth(value: unknown): string {
  const raw = value == null ? "" : String(value).trim();
  if (raw.length === 0) return "";

  let year: number;
  let month: number;
  let day: number;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(raw);
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(raw);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    [day, month, year] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (dmy[3].length === 2) {
      const currentYear = new Date().getFullYear();
      year += Math.floor(currentYear / 100) * 100;
      if (year > currentYear) year -= 100;
    }
  } else {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, INVALID_DOB_ERR);
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  const isRealDate =
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
  if (!isRealDate || year < 1900 || date.getTime() > Date.now()) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, INVALID_DOB_ERR);
  }
  return date.toISOString().slice(0, 10);
}

export function generateUniqueString(string?: string, n:number = 5)
{
  const characters = "0123456789abcdefghijklmnopqrstuvwxyz-";

  let randomString = "";

  for (let i = 0; i < n; i++) {
    const index = Math.round(Math.random() * (characters.length-1)) | 0;

    randomString += characters[index];
  }
  if (string?.length) {
    return (string+randomString).split('-').join('');
  }
  return randomString.split('-').join('');
}

export async function getTotalCount(pool: mysql.Pool, tableName: string, where: string = ''): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) as total FROM ${tableName} ${where}`
  );
  return rows[0].total as number;
}

export function mt_rand(min: number, max: number) {
  const argc = arguments.length;
  if (argc === 0) {
    min = 0;
    max = 2147483647;
  } else if (argc === 1) {
    throw new Error("Warning: mt_rand() expects exactly 2 parameters, 1 given");
  }
  return Math.floor(Math.random() * (max - min + 1)) + min;
}