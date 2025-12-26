/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/**
 * Setup express server.
 */

import morgan from "morgan";
import path from "path";
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import logger from "jet-logger";
import cors from "cors";
import "express-async-errors";
import mysql from "mysql2/promise";
import BaseRouter from "@src/router/apiRouter";

import EnvVars from "@src/constants/EnvVars";
import HttpStatusCodes from "@src/constants/HttpStatusCodes";

import { NodeEnvs } from "@src/constants/misc";
import { RouteError } from "@src/other/classes";
import { createPool } from "./database/Database";
import authorization from "./middleware/auth.middleware";

// **** Variables **** //



const app = express();

// **** Setup **** //

// Basic middleware
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// app.use(cookieParser(EnvVars.CookieProps.Secret));

// Show routes called in console during development
if (EnvVars.NodeEnv === NodeEnvs.Dev.valueOf()) {
  app.use(morgan("dev"));
}

// Security
if (EnvVars.NodeEnv === NodeEnvs.Production.valueOf()) {
  app.use(helmet());
}

export let pool: mysql.Pool;

app.use(async (req, res, next) => {
  if (pool) {
    return next();
  }
  try {
    pool = await createPool();
    next();
  } catch (err) {
    logger.err(err, true);
    return next(err);
  }
});

process.on("exit", () => {
  if (pool) {
    pool.end();
  }
});
app.get("/health", (req, res, next) => {
  res.status(200).json({
    success: true,
    message: "API is working"
  })
});
// Deep link files for Android and iOS
app.get("/.well-known/assetlinks.json", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(process.cwd(), ".well-known", "assetlinks.json"));
});

app.get("/apple-app-site-association", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(process.cwd(), "public", "apple-app-site-association"));
});
// Public customer signup page
app.get("/customer-signup", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(path.join(process.cwd(), "public", "customer-signup.html"));
});

// Public Global Payments tokenization page (for Flutter WebView)
app.get("/global-payments-tokenize", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.sendFile(path.join(process.cwd(), "public", "global-payments-tokenize.html"));
});
// Authorization middleware
app.use(authorization);

// Add APIs, must be after middleware
app.use("/api", BaseRouter);
//changes
// Add error handler
app.use(
  (
    err: Error,
    _: Request,
    res: Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    next: NextFunction
  ) => {
    // if (EnvVars.NodeEnv !== NodeEnvs.Test.valueOf()) {
    //   logger.err(err, true);
    // }
    let status = HttpStatusCodes.BAD_REQUEST;
    if (err instanceof RouteError) {
      status = err.status;
    }
    return res.status(status).json({ error: err.message });
  }
);

// ** Front-End Content ** //

// Set views directory (html)
const viewsDir = path.join(__dirname, "views");
app.set("views", viewsDir);

// Set static directory (js and css).
const staticDir = path.join(__dirname, "public");
app.use(express.static(staticDir));

// Nav to login pg by default
app.get("/", (_: Request, res: Response) => {
  res.sendFile("login.html", { root: viewsDir });
});

// **** Export default **** //

export default app;
