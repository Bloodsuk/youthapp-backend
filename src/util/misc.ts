/**
 * Miscellaneous shared functions go here.
 */

import { CreditRequestStatus } from "@src/constants/enums";
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