import Paths from "@src/constants/Paths";
import CustomerController from "@src/controllers/CustomerController";
import { Router } from "express";
// import jetValidator from "jet-validator/lib/jet-validator";

// const validate = jetValidator();

const customerRouter = Router();

customerRouter.post(Paths.Customers.GetCustomerDetailsByEmail, CustomerController.getCustomerDetailsByEmail)

customerRouter.get(Paths.Customers.GetByEmail, CustomerController.getCustomerDetailsByEmail)

// Get all customers
customerRouter.get(Paths.Customers.Get, CustomerController.getAll);

// Get all customers by userId
customerRouter.get(Paths.Customers.GetByUserId, CustomerController.getByUserId);

// Get By Id
customerRouter.get(Paths.Customers.GetById, CustomerController.getById);

// Add one customer
customerRouter.post(Paths.Customers.Add, CustomerController.add);

// Update one customer
customerRouter.patch(
  Paths.Customers.Update,
  // validate(["customer", isCustomer]),
  CustomerController.update
);

// Delete one customer
customerRouter.delete(
  Paths.Customers.Delete,
  // validate(["id", "number", "params"]),
  CustomerController.delete
);

// Send logins to customers
customerRouter.post(Paths.Customers.SendLogins, CustomerController.sendLogins);



export default customerRouter;
