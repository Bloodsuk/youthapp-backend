import { IUser } from "./IUser";

export interface ISessionUser {
  id: number;
  email: string;
  username: string;
  first_name: string;
  last_name?: string;
  practitioner_id?: number;
  user_level: IUser["user_level"];
}

export interface ISession {
  sessionId: string;
  user: ISessionUser;
  connected?: boolean;
}
