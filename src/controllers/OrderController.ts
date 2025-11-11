import HttpStatusCodes from "@src/constants/HttpStatusCodes";
import Stripe from "stripe";

import { UserLevels } from "@src/constants/enums";
import { RouteError } from "@src/other/classes";
import CustomerService from "@src/services/CustomerService";
import CouponService from "@src/services/CouponService";
import OrderService from "@src/services/OrderService";
import ServicesService from "@src/services/ServicesService";
import ShippingsService from "@src/services/ShippingsService";
import TestsService from "@src/services/TestsService";
import { IReq, IRes } from "@src/types/express/misc";
import { mt_rand } from "@src/util/misc";
import moment from "moment";
import UserService from "@src/services/UserService";
import EnvVars from '@src/constants/EnvVars';
import ExtraDiscountService from "@src/services/ExtraDiscountService";
import { ISessionUser } from "@src/interfaces/ISessionUser";

const stripe = new Stripe(EnvVars.Stripe.Secret);

// **** Functions **** //

/**
 * Get all orders.
 */
interface IGetOrdersReqBody {
  status?: string;
  shipping_type?: string;
  service?: string;
  client_name?: string;
  search?: string;
  page?: number;
}
async function getAll(req: IReq<IGetOrdersReqBody>, res: IRes) {
  const { status, shipping_type, service, client_name, page, search } = req.body;
  const { data, total } = await OrderService.getAll(
    res.locals.sessionUser,
    client_name,
    search,
    status,
    shipping_type,
    service,
    page
  );
  return res.status(HttpStatusCodes.OK).json({ orders: data, total });
}

/**
 * INFO: Get customer orders by customer Id.
 * @param req 
 * @param res 
 * @returns 
 */
async function getAllCustomerOrder(req: IReq<IGetOrdersReqBody>, res: IRes) {
  const customer_id = parseInt(req.params.customer_id);
  try {
    const { status, shipping_type, service, client_name, page } = req.body;
    const { data, total } = await OrderService.getAllCustomerOrder(
      customer_id,
      client_name,
      status,
      shipping_type,
      service,
      page
    );
    return res.status(HttpStatusCodes.OK).json({ orders: data, total });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * INFO: Get my orders.
 * @param req 
 * @param res 
 * @returns 
 */
interface IGetAllCustomerOrdersReqBody {
  email: string
}

async function GetAllCustomerOrders(req: IReq<IGetAllCustomerOrdersReqBody>, res: IRes) {
  try {
    const { email } = req.body;

    if(!email) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({error: "Email is required to access customer orders"})
    }

    const customer = await CustomerService.getOneByEmail(email);

    if(!customer) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({ error: "Customer with the specified email is not found" })
    }

    const { data, total } = await OrderService.getAllCustomerOrder(customer.id);
    return res.status(HttpStatusCodes.OK).json({ orders: data, total });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * INFO: Get customer orders by customer Id.
 * @param req 
 * @param res 
 * @returns 
 */
interface IGetPractitionersCommissionReqBody {
  paid_status?: string;
  search?: string;
  page?: number;
}
async function getPractitionersCommission(req: IReq<IGetPractitionersCommissionReqBody>, res: IRes) {
  try {
    const { paid_status = "", search } = req.query;
    let page = parseInt(req.query.page as string);
    if (isNaN(page)) page = 1;
    let practitioner_id: number | undefined = undefined;
    if (res.locals.sessionUser?.user_level === UserLevels.Practitioner)
      practitioner_id = res.locals.sessionUser?.id;
    const { data, total } = await OrderService.getPractitionersCommission(
      page,
      paid_status as string,
      search as string,
      practitioner_id
    );
    return res.status(HttpStatusCodes.OK).json({ commissions: data, total });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * INFO: Get loggedin Practitioners Commission
 * @param req 
 * @param res 
 * @returns 
 */
async function getPractitionerOutstandingCredits(req: IReq<IGetPractitionersCommissionReqBody>, res: IRes) {
  try {
    const { paid_status = "", search } = req.query;
    let page = parseInt(req.query.page as string);
    if (isNaN(page)) page = 1;
    let practitioner_id: number | undefined = undefined;
    if (res.locals.sessionUser?.user_level === UserLevels.Practitioner)
      practitioner_id = res.locals.sessionUser?.id;
    if (!practitioner_id) {
      return res
        .status(HttpStatusCodes.FORBIDDEN)
        .json({
          success: false,
          error: "You are not authorized to perform this operation",
        })
        .end();
    }
    const { data, total } = await OrderService.getPractitionerOutstandingCredits(
      page,
      paid_status as string,
      search as string,
      practitioner_id,
    );
    return res.status(HttpStatusCodes.OK).json({ commissions: data, total });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Get order by Id.
 */
async function getById(req: IReq, res: IRes) {
  const id = parseInt(req.params.id);
  try {
    const order = await OrderService.getOne(id);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
        order: order,
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Add one order.
 */
async function add(req: IReq<{ order: Record<string, any>, booking: Record<string, any> }>, res: IRes) {
  const { order, booking } = req.body;

  const id = await OrderService.addOne(order, booking);
  if (id) {
    return res
      .status(HttpStatusCodes.CREATED)
      .json({
        success: true,
        id: id,
      })
      .end();
  }
  else {
    return res.status(HttpStatusCodes.BAD_REQUEST).end();
  }
}

/**
 * Update one order.
 */
async function update(req: IReq<{ order: Record<string, any> }>, res: IRes) {
  const { order } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await OrderService.updateOne(uid, order);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * Update status.
 */
async function updateStatus(req: IReq<{ status: string }>, res: IRes) {
  const { status } = req.body;
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await OrderService.updateStatus(uid, status);
    return res.status(HttpStatusCodes.OK).json({ success: true }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Delete one order.
 */
async function delete_(req: IReq, res: IRes) {
  const id = req.params.id;
  const uid = parseInt(id);
  try {
    await OrderService.delete(uid);
    return res
      .status(HttpStatusCodes.OK)
      .json({
        success: true,
      })
      .end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Get all outstanding credit orders.
 */
async function getOutstandingCreditOrders(req: IReq, res: IRes) {
  const page = parseInt(req.query.page as string) || 1;
  const { data, total } = await OrderService.getOutstandingCreditOrders(page);
  return res.status(HttpStatusCodes.OK).json({ orders: data, total });
}

/**
 * Get all outstanding credit orders.
 */
async function markPaid(req: IReq<{ order_ids: number[] }>, res: IRes) {
  try {
    const order_ids = req.body.order_ids;
    const success = await OrderService.markPaid(order_ids);
    return res.status(HttpStatusCodes.OK).json({ success });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * INFO: Marked paid as practitioners commission.
 */
async function markPaidPractitionersCommission(req: IReq<{ commission_ids: number[] }>, res: IRes) {
  try {
    const commission_ids = req.body.commission_ids;
    const success = await OrderService.markPaidPractitionersCommission(commission_ids);
    return res.status(HttpStatusCodes.OK).json({ success });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Credit checkout
 */
interface ICreditCheckoutReqBody {
  customer_id: number;
  test_ids: number[];
  shipping_type: number;
  service_ids: number[];
  discount: number;
  current_medication: string;
  last_trained: string;
  fasted: string;
  hydrated: string;
  drank_alcohol: string;
  drugs_taken: string;
  supplements: string;
  enhancing_drugs: string;
  booking: Record<string, any>;
}

async function creditCheckout(req: IReq<ICreditCheckoutReqBody>, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const {
    customer_id,
    test_ids,
    discount,
    shipping_type,
    service_ids,
    current_medication,
    last_trained,
    fasted,
    hydrated,
    drank_alcohol,
    drugs_taken,
    supplements,
    enhancing_drugs,
    booking,
  } = req.body;
  try {
    const customer = await CustomerService.getOne(customer_id);
    if (!customer) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ success: false, error: "Customer not found" });
    }
    let cart_total = 0;
    for (const test_id of test_ids) {
      const test = await TestsService.getOne(test_id);
      cart_total += parseFloat(test.price);
    }
    const order_placed_by = res.locals.sessionUser.id;
    const prac_id = customer.created_by;
    let createdBy = 0;
    if (
      res.locals.sessionUser.user_level == UserLevels.Practitioner ||
      res.locals.sessionUser.user_level == UserLevels.Admin
    ) {
      createdBy = res.locals.sessionUser.id;
    } else {
      //Only if Moderator(Clinic) gets $_SESSION['practitioner_id'],
      //customer do not has a value for $_SESSION['practitioner_id']
      createdBy = res.locals.sessionUser.practitioner_id || 0; // Clinic's Practitioner
    }

    let api_royal = "no";
    const shipping = await ShippingsService.getOne(shipping_type);
    const shipping_name = shipping["name"];
    const shipping_charges = shipping["value"];
    if (
      shipping_name == "Royal Mail Tracked 24" ||
      shipping_name == "Royal Mail Special Delivery Guaranted by 1PM"
    ) {
      api_royal = "yes";
    } else {
      api_royal = "no";
    }
    let other_charges_total = 0;
    for (const service_id of service_ids) {
      const service = await ServicesService.getOne(service_id);
      other_charges_total += service.value;
    }

    const total_val =
      cart_total + shipping_charges + other_charges_total - discount;

    const order_id = moment().format("YYMM") + `${mt_rand(55, 55555)}`;
    const order = {
      order_id,
      customer_id,
      transaction_id: "0",
      test_ids: test_ids.join(","), //array to string
      client_id: customer.client_code,
      client_name: customer.fore_name + " " + customer.sur_name,
      shipping_type: shipping_type.toString(),
      other_charges: service_ids.join(","),
      checkout_type: "Credit",
      payment_status: "Pending",
      order_placed_by,
      created_by: createdBy,
      practitioner_id: prac_id,
      subtotal: cart_total,
      shipping_charges,
      other_charges_total,
      discount,
      total_val,
      current_medication,
      last_trained,
      fasted,
      hydrated,
      drank_alcohol,
      drugs_taken,
      supplements,
      enhancing_drugs,
      api_royal,
    };
    const id = await OrderService.addOne(order, booking);
    return res.status(HttpStatusCodes.OK).json({ success: true, order_id: id });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

type Card = {
  number: string;
  exp_month: number;
  exp_year: number;
  cvc: string;
};
interface IStripeCheckoutReqBody {
  customer_id: number;
  test_ids: number[];
  shipping_type: number;
  service_ids: number[];
  discount: number;
  current_medication: string;
  last_trained: string;
  fasted: string;
  hydrated: string;
  drank_alcohol: string;
  drugs_taken: string;
  supplements: string;
  enhancing_drugs: string;
  booking: Record<string, any>;
}

async function stripeCheckout(req: IReq<IStripeCheckoutReqBody>, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  
  console.log("stripeCheckout - userData:", res.locals.sessionUser);
  console.log("stripeCheckout - request body:", req.body);
  
  const {
    customer_id,
    test_ids,
    discount,
    shipping_type,
    service_ids,
    current_medication,
    last_trained,
    fasted,
    hydrated,
    drank_alcohol,
    drugs_taken,
    supplements,
    enhancing_drugs,
    booking,
  } = req.body;
  try {
    const customer = await CustomerService.getOne(customer_id);
    if (!customer) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ success: false, error: "Customer not found" });
    }
    const order_placed_by = res.locals.sessionUser.id;
    const prac_id = customer.created_by;
    let createdBy = 0;
    if (
      res.locals.sessionUser.user_level == UserLevels.Practitioner ||
      res.locals.sessionUser.user_level == UserLevels.Admin
    ) {
      createdBy = res.locals.sessionUser.id;
    } else {
      //Only if Moderator(Clinic) gets $_SESSION['practitioner_id'],
      //customer do not has a value for $_SESSION['practitioner_id']
      createdBy = res.locals.sessionUser.practitioner_id || 0; // Clinic's Practitioner
    }
    
    let cart_total = 0;
    const testNames = [];
    const testPrices = [];
    for (const test_id of test_ids) {
      const test = await TestsService.getOne(test_id);
      cart_total += parseFloat(test.price);
      testNames.push(test.test_name);
      testPrices.push(test.price);
    }
    const shipping = await ShippingsService.getOne(shipping_type);
    const shipping_charges = shipping["value"];
    // const shipping_name = shipping["name"];
    let other_charges_total = 0;
    for (const service_id of service_ids) {
      const service = await ServicesService.getOne(service_id);
      other_charges_total += service.value;
    }

    const total_val =
      cart_total + shipping_charges + other_charges_total - discount;

    console.log("stripeCheckout - calculation breakdown:", {
      cart_total,
      shipping_charges,
      other_charges_total,
      discount,
      total_val
    }); 
    if (total_val <= 0)
      return res.status(HttpStatusCodes.BAD_REQUEST).json({ success: false, error: "Total calculated amount is 0 or less. Please check your order details again. " });

    const order_id = moment().format("YYMM") + `${mt_rand(55, 55555)}`;
    const order = {
      order_id,
      customer_id,
      transaction_id: "0",
      test_ids: test_ids.join(","), //array to string
      client_id: customer.client_code,
      client_name: customer.fore_name + " " + customer.sur_name,
      shipping_type: shipping_type.toString(),
      other_charges: service_ids.join(","),
      checkout_type: "Stripe",
      payment_status: "Paid",
      order_placed_by,
      created_by: createdBy,
      practitioner_id: prac_id,
      subtotal: cart_total,
      shipping_charges,
      other_charges_total,
      discount,
      total_val,
      current_medication,
      last_trained,
      fasted,
      hydrated,
      drank_alcohol,
      drugs_taken,
      supplements,
      enhancing_drugs,
    };
    // Add Order in DB
    const id = await OrderService.addOne(order, booking);
    const order_number = `#YRV-${order_id}`;

    if (id)
      return res
        .status(HttpStatusCodes.CREATED)
        .json({
          success: true,
          order_id: id,
          order_number,
        })
        .end();
    else return res.status(HttpStatusCodes.BAD_REQUEST).end();

  } catch (error) {
    console.log("stripeCheckout - caught error:", error);
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
async function getPaymentMethods(req: IReq, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const user_id = res.locals.sessionUser.id;

  try {
    const stripe_cust_id = await getUserStripeId(user_id);
    const cards = await getSripeCards(stripe_cust_id);
    return res
      .status(HttpStatusCodes.OK)
      .json({ success: true, payment_methods: cards });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}
/**
 * Add one order.
 */
interface IAddPaymentMethodReqBody {
  card: Card;
}
async function addPaymentMethod(
  req: IReq<IAddPaymentMethodReqBody>,
  res: IRes
) {
  const { card } = req.body;
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const user_id = res.locals.sessionUser.id;
  try {
    const stripe_cust_id = await getUserStripeId(user_id);
    let paymentMethod = await stripe.paymentMethods.create({
      type: "card",
      card,
    });
    if (paymentMethod.id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: stripe_cust_id,
      });
      paymentMethod = await stripe.paymentMethods.retrieve(paymentMethod.id);
      return res
        .status(HttpStatusCodes.CREATED)
        .json({
          success: true,
          paymentMethod,
        })
        .end();
    }
  } catch (error) {
    return res
      .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        error: "Internal Error: " + error,
      })
      .end();
  }
}

async function getUserStripeId(user_id: number) {
  try {
    const user = await UserService.getOne(user_id);
    let stripe_cust_id = user.stripe_id.length > 0 ? user.stripe_id : null;
    const user_email = user.email;
    let existingCustomers = [];
    // Create or use a preexisting Customer to associate with the payment
    if (!stripe_cust_id) {
      //Check if already in Stripe Account with email
      if (user_email) {
        const result = await stripe.customers.list({
          email: user_email,
          limit: 1,
        });
        existingCustomers = result.data;
        if (existingCustomers && existingCustomers.length > 0) {
          stripe_cust_id = existingCustomers[0]["id"];
          if (stripe_cust_id)
            await UserService.updateOne(user_id, {
              stripe_id: stripe_cust_id,
            });
        }
      }
    }
    // Check again for customer/user exist or not
    let customer;
    if (!stripe_cust_id) {
      //Neither in DB nor in Stripe A/C
      if (user_email) {
        customer = await stripe.customers.create({ email: user_email });
      } else {
        customer = await stripe.customers.create();
      }
      stripe_cust_id = customer.id;
      if (stripe_cust_id)
        await UserService.updateOne(user_id, { stripe_id: stripe_cust_id });
    }
    const stripeCustomer = await stripe.customers.retrieve(stripe_cust_id);
    if (stripeCustomer.deleted) {
      if (user_email) {
        customer = await stripe.customers.create({ email: user_email });
      } else {
        customer = await stripe.customers.create();
      }
      stripe_cust_id = customer.id;
    }
    return stripe_cust_id;
  } catch (error) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Stripe Error: " + error);
  }
}

async function getSripeCards(stripe_cust_id: string) {
  const cards = [];
  try {
    const cardsCollection = await stripe.customers.listPaymentMethods(
      stripe_cust_id,
      { type: "card" }
    );
    for (const item of cardsCollection["data"]) {
      const { card, id } = item;
      if (!card) continue;
      cards.push({
        id,
        fingerprint: card.fingerprint,
        last4: card.last4,
        brand: card.brand,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
      });
    }
  } catch (error) {
    throw new RouteError(HttpStatusCodes.BAD_REQUEST, "Stripe Error: " + error);
  }
  return cards;
}

async function getBookedTimeSlots(req: IReq, res: IRes) {
  try {
    const booking_date = req.query.booking_date as string;
    const { data, total } = await OrderService.getBookedTimeSlots(booking_date);
    return res.status(HttpStatusCodes.OK).json({ data: data, total });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

async function getBookingDetails(req: IReq<{ order_id: string }>, res: IRes) {
  try {
    const order_id = req.query.order_id as string;
    const { data } = await OrderService.getBookingDetails(order_id);
    return res.status(HttpStatusCodes.OK).json({ data: data });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Get practitioner IDs from extra_discount_to_users table
 */
async function getExtraDiscountPractitionerIds(req: IReq, res: IRes) {
  try {
    const practitionerIds = await ExtraDiscountService.getPractitionerIds();
    return res.status(HttpStatusCodes.OK).json({ 
      success: true,
      practitioner_ids: practitionerIds 
    });
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

/**
 * Get order IDs with status "Started" (Admin only)
 */
async function getOrdersWithStartedStatus(req: IReq, res: IRes) {
  const isAdmin = res.locals.sessionUser?.user_level === UserLevels.Admin;
  
  if (!isAdmin) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Admin access required"
    }).end();
  }

  try {
    const orders = await OrderService.getOrderIdsWithStartedStatus();
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      data: orders
    }).end();
  } catch (error) {
    if (error instanceof RouteError)
      return res
        .status(error.status)
        .json({
          success: false,
          error: error.message,
        })
        .end();
    else
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({
          success: false,
          error: "Internal Error: " + error,
        })
        .end();
  }
}

// **** Export default **** //

export default {
  getAll,
  getAllCustomerOrder,
  getPractitionersCommission,
  getPractitionerOutstandingCredits,
  getOutstandingCreditOrders,
  getById,
  add,
  update,
  updateStatus,
  delete: delete_,
  markPaid,
  markPaidPractitionersCommission,
  creditCheckout,
  stripeCheckout,
  getPaymentMethods,
  addPaymentMethod,
  getBookedTimeSlots,
  getBookingDetails,
  getExtraDiscountPractitionerIds,
  GetAllCustomerOrders,
  getOrdersWithStartedStatus,
} as const;
