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
import phlebotomistRouter from "./phlebotomistRouter";
import plebJobRouter from "./plebJobRouter";
import eventBookingRouter from "./eventBookingRouter";
import gymPhlebBookingRouter from "./gymPhlebBookingRouter";
import fileUploadRouter from "./fileUploadRouter";
import visitChatRouter from "./visitChatRouter";
import sampleReturnsRouter from "./sampleReturnsRouter";

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

// Add PhlebotomistRouter
routes.use(Paths.Phlebotomists.Base, phlebotomistRouter);

// Add PlebJobRouter
routes.use(Paths.PlebJobs.Base, plebJobRouter);

// Event bookings (phleb job type — Assigned/Pickup/Delivered/Cancelled)
routes.use(Paths.EventBookings.Base, eventBookingRouter);

// Gym phleb bookings (same status flow as events)
routes.use(Paths.GymPhlebBookings.Base, gymPhlebBookingRouter);

// Add FileUploadRouter
routes.use(Paths.FileUpload.Base, fileUploadRouter);

// Visit chat (phleb ↔ customer, order-scoped)
routes.use(Paths.VisitChat.Base, visitChatRouter);

// Sample returns (phleb — practitionermaindb + Stripe; WP was reference only)
routes.use(Paths.SampleReturns.Base, sampleReturnsRouter);

export default routes;
