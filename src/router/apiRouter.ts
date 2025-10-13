import Paths from "@src/constants/Paths";
import { Router } from "express";
import authRouter from "./authRouter";
import userRouter from "./userRouter";
import categoryRouter from "./categRouter";
import customerRouter from "./customerRouter";
import orderRouter from "./orderRouter";
import mailConfigRouter from "./mailConfigRouter";
import mailTemplateRouter from "./mailTemplateRouter";
import testRouter from "./testRouter";
import couponsRouter from "./couponRouter";
import shippingsRouter from "./shippingsRouter";
import creditRequestRouter from "./creditRequestRouter";
import servicesRouter from "./servicesRouter";
import statsRouter from "./statsRouter";
import resultRouter from "./resultRouter";
import messageRouter from "./messageRouter";
import roleRouter from "./roleRouter";
import permissionRouter from "./permissionRouter";
import clinicRouter from "./clinicRouter";
import appVersionRouter from "./appVersionRouter";

const routes = Router();

// Add AuthRouter
routes.use(Paths.Auth.Base, authRouter);

// Add UserRouter
routes.use(Paths.Users.Base, userRouter);

// Add CategoryRouter
routes.use(Paths.Categories.Base, categoryRouter);

// Add CustomerRouter
routes.use(Paths.Customers.Base, customerRouter);

// Add ResultRouter
routes.use(Paths.Results.Base, resultRouter);

// Add MailConfigRouter
routes.use(Paths.MailConfig.Base, mailConfigRouter);

// Add MailTemplateRouter
routes.use(Paths.MailTemplate.Base, mailTemplateRouter);

// Add OrderRouter
routes.use(Paths.Orders.Base, orderRouter);

// Add TestRouter
routes.use(Paths.Tests.Base, testRouter);

// Add CouponRouter
routes.use(Paths.Coupons.Base, couponsRouter);

// Add ServicesRouter
routes.use(Paths.Services.Base, servicesRouter);

// Add ShippingRouter
routes.use(Paths.Shippings.Base, shippingsRouter);

// Add CreditRequestsRouter
routes.use(Paths.CreditRequests.Base, creditRequestRouter);

// Add StatsRouter
routes.use(Paths.Stats.Base, statsRouter);

// Add MessagesRouter
routes.use(Paths.Messages.Base, messageRouter);

// Add RolesRouter
routes.use(Paths.Roles.Base, roleRouter);

// Add PermissionsRouter
routes.use(Paths.Permissions.Base, permissionRouter);

// Add ClinicRouter
routes.use(Paths.Clinics.Base, clinicRouter);

// Add AppVersionRouter
routes.use(Paths.AppVersions.Base, appVersionRouter);

export default routes;
