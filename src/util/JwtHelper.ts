import EnvVars from "@src/constants/EnvVars";
import jsonwebtoken from "jsonwebtoken";

// Options
const Options = {
  expiresIn: EnvVars.Jwt.Exp,
};

/**
 * Encrypt data and return jwt.
 */
function _sign(data: string | object | Buffer): Promise<string> {
  return new Promise((res, rej) => {
    jsonwebtoken.sign(data, EnvVars.Jwt.Secret, Options, (err, token) => {
      return err ? rej(err) : res(token || "");
    });
  });
}

/**
 * Decrypt JWT and extract client data.
 */
function _decode<T>(jwt?: string): Promise<string | undefined | T> {
  return new Promise((res, rej) => {
    if(!jwt) return res('JWT not provided.');
    jsonwebtoken.verify(jwt, EnvVars.Jwt.Secret, (err, decoded) => {
      return err ? res(err.message) : res(decoded as T);
    });
  });
}

export default {
  _sign,
  _decode,
} as const;