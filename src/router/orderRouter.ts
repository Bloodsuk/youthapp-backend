import Paths from "@src/constants/Paths";
import OrderController from "@src/controllers/OrderController";
import { Router } from "express";

const orderRouter = Router();

orderRouter.get(
  Paths.Orders.BookedTimeSlots,
  OrderController.getBookedTimeSlots
);

orderRouter.get(
  Paths.Orders.BookingDetails,
  OrderController.getBookingDetails
);

// Get practitioner IDs from extra_discount_to_users table (no auth required for testing)
orderRouter.get(
  Paths.Orders.GetExtraDiscountPractitionerIds,
  OrderController.getExtraDiscountPractitionerIds
);

orderRouter.post(Paths.Orders.GetAllCustomerOrders, OrderController.GetAllCustomerOrders)

// Get all orders
orderRouter.post(Paths.Orders.Get, OrderController.getAll);

// Get all orders
orderRouter.post(Paths.Orders.GetCustomerOrder, OrderController.getAllCustomerOrder);

// Get all Practitioners Commission
orderRouter.get(Paths.Orders.GetPractitionersCommission, OrderController.getPractitionersCommission);

// Get loggedin Practitioners Commission
orderRouter.get(Paths.Orders.GetPractitionerOutstandingCredits, OrderController.getPractitionerOutstandingCredits);

// Get all outstanding credit orders
orderRouter.get(Paths.Orders.GetOutstanding, OrderController.getOutstandingCreditOrders);

// Get stripe payment methods
orderRouter.get(
  Paths.Orders.PaymentMethods,
  OrderController.getPaymentMethods
);

// Get By Id
orderRouter.get(Paths.Orders.GetById, OrderController.getById);

// Add one order
orderRouter.post(Paths.Orders.Add, OrderController.add);

// Update one order
orderRouter.patch(
  Paths.Orders.Update,
  // validate(["order", isOrder]),
  OrderController.update
);

// Update status
orderRouter.patch(
  Paths.Orders.UpdateStatus,
  // validate(["order", isOrder]),
  OrderController.updateStatus
);

// Delete one order
orderRouter.delete(
  Paths.Orders.Delete,
  // validate(["id", "number", "params"]),
  OrderController.delete
);

// Mark payment as paid
orderRouter.put(
  Paths.Orders.MarkPaidPractitionersCommission,
  OrderController.markPaidPractitionersCommission
);

// Mark payment as paid
orderRouter.post(
  Paths.Orders.MarkPaid,
  OrderController.markPaid
);

// Credit Checkout
orderRouter.post(
  Paths.Orders.CreditCheckout,
  OrderController.creditCheckout
);
// Add payment method
orderRouter.post(
  Paths.Orders.PaymentMethods,
  OrderController.addPaymentMethod
);
// Stripe Checkout
orderRouter.post(
  Paths.Orders.StripeCheckout,
  OrderController.stripeCheckout
);

export default orderRouter;
