import Paths from "@src/constants/Paths";
import SampleReturnsController from "@src/controllers/SampleReturnsController";
import { Router } from "express";

const sampleReturnsRouter = Router();

sampleReturnsRouter.post(
  Paths.SampleReturns.Lookup,
  SampleReturnsController.lookup
);

sampleReturnsRouter.get(
  Paths.SampleReturns.GetOne,
  SampleReturnsController.getOne
);

sampleReturnsRouter.post(
  Paths.SampleReturns.PaymentIntent,
  SampleReturnsController.createPaymentIntent
);

sampleReturnsRouter.post(
  Paths.SampleReturns.FinalizePayment,
  SampleReturnsController.finalizePayment
);

sampleReturnsRouter.post(
  Paths.SampleReturns.Create,
  SampleReturnsController.createReturn
);

sampleReturnsRouter.post(
  Paths.SampleReturns.EmailQr,
  SampleReturnsController.emailQr
);

export default sampleReturnsRouter;
