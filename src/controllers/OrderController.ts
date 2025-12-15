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
import { canAssignJobs } from "@src/util/JobAssignmentAuth";
import GlobalPaymentsService from "@src/services/GlobalPaymentsService";
import PaymentTokenService from "@src/services/PaymentTokenService";
import PlebAvailabilityService from "@src/services/PlebAvailabilityService";
import PlebJobService from "@src/services/PlebJobService";
import { ICustomer } from "@src/interfaces/ICustomer";
import PhlebSlotService from "@src/services/PhlebSlotService";
import PhlebBookingService from "@src/services/PhlebBookingService";
import MailService from "@src/services/MailService";

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

interface IAvailablePlebsReqBody {
  customer_id: number;
  booking_date: string;
  booking_time: string;
  address?: string;
  town?: string;
  postal_code?: string;
  country?: string;
}

function buildCustomerAddress(
  customer: ICustomer,
  override?: Partial<Pick<ICustomer, "address" | "town" | "postal_code" | "country">>
): string {
  const parts = [
    override?.address ?? customer.address,
    override?.town ?? customer.town,
    override?.postal_code ?? customer.postal_code,
    override?.country ?? customer.country,
  ]
    .filter((value) => typeof value === "string" && value.trim().length > 0)
    .map((value) => value!.trim());

  const address = parts.join(", ");
  if (!address) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Customer address is required to select a pleb"
    );
  }
  return address;
}

async function ensurePlebIsAvailableForBooking(options: {
  pleb_id: number;
  customer: ICustomer;
  booking: Record<string, any>;
}) {
  const { pleb_id, customer, booking } = options;

  if (!booking?.booking_date || !booking?.booking_time) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "booking_date and booking_time are required when selecting a pleb"
    );
  }

  const customerAddress = buildCustomerAddress(customer);
  const availablePlebs =
    await PlebAvailabilityService.getAvailablePlebsForBooking({
      booking_date: booking.booking_date,
      booking_time: booking.booking_time,
      customer_address: customerAddress,
    });

  const selected = availablePlebs.find((pleb) => pleb.pleb_id === pleb_id);
  if (!selected) {
    throw new RouteError(
      HttpStatusCodes.BAD_REQUEST,
      "Selected pleb is not available for the chosen slot or is out of range"
    );
  }
}

async function assignPlebIfProvided(
  pleb_id: number | undefined,
  order_id: number,
  customer: ICustomer,
  booking: Record<string, any>,
  sessionUser: ISessionUser | undefined
) {
  if (!pleb_id) return;
  await ensurePlebIsAvailableForBooking({ pleb_id, customer, booking });
  await PlebJobService.assignJob(pleb_id, order_id, "Assigned", sessionUser);
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
interface IPhlebBookingData {
  slot_times: string;
  price: string;
  weekend_surcharge: string;
  zone: string;
  shift_type: string;
  availability?: string;
  additional_preferences?: string;
}

async function sendPhlebBookingEmails(
  customer: ICustomer,
  phlebBookingData: IPhlebBookingData,
  orderCode: string,
  orderId: number
) {
  try {
    const customerName =
      `${customer.fore_name || ""} ${customer.sur_name || ""}`.trim() ||
      customer.client_code ||
      "Customer";

    await MailService.sendPhlebBookingNotification(
      ["revolutionbloods@outlook.com", "info@youth-revisited.co.uk"],
      {
        orderId,
        orderCode,
        customerName,
        customerEmail: customer.email,
        customerPhone: customer.telephone,
        booking: {
          shift_type: phlebBookingData.shift_type,
          slot_times: phlebBookingData.slot_times,
          price: phlebBookingData.price,
          weekend_surcharge: phlebBookingData.weekend_surcharge,
          zone: phlebBookingData.zone,
          availability: phlebBookingData.availability,
          additional_preferences: phlebBookingData.additional_preferences,
        },
      }
    );
  } catch (error) {
    console.error("Failed to send phleb booking notification email:", error);
  }
}

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
  pleb_id?: number;
  phleb_booking?: IPhlebBookingData;
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
    pleb_id,
    phleb_booking,
  } = req.body;
  
  // Extract phleb_booking from nested structure if needed
  const phlebBookingData = phleb_booking || booking?.phleb_booking;
  
  // Separate booking for OrderService (only if it has booking_date and booking_time)
  // phleb_booking is handled separately and doesn't need booking_date/booking_time
  const bookingForOrderService: Record<string, any> | undefined = (booking?.booking_date && booking?.booking_time) 
    ? { booking_date: booking.booking_date, booking_time: booking.booking_time }
    : undefined;
  
  try {
    if (pleb_id && (!booking?.booking_date || !booking?.booking_time)) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({
          success: false,
          error: "booking_date and booking_time are required when selecting a pleb",
        });
    }

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

    // Add phleb booking price if provided
    let phleb_booking_price = 0;
    if (phlebBookingData) {
      phleb_booking_price = parseFloat(phlebBookingData.price || "0");
      // Add weekend surcharge if provided (frontend should include it in price or send separately)
      if (phlebBookingData.weekend_surcharge) {
        phleb_booking_price += parseFloat(phlebBookingData.weekend_surcharge || "0");
      }
    }

    const total_val =
      cart_total + shipping_charges + other_charges_total + phleb_booking_price - discount;

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
    const id = await OrderService.addOne(order, bookingForOrderService || {} as Record<string, any>);
    await assignPlebIfProvided(pleb_id, id, customer, booking, res.locals.sessionUser);
    
    // Save phleb booking if provided (check both root level and nested in booking)
    if (phlebBookingData) {
      try {
        await PhlebBookingService.saveBooking(id, phlebBookingData);
        await sendPhlebBookingEmails(customer, phlebBookingData, order_id, id);
      } catch (bookingError) {
        // Log error but don't fail the order creation
        console.error("Failed to save phleb booking:", bookingError);
      }
    }
    
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
  pleb_id?: number;
  phleb_booking?: IPhlebBookingData;
}

interface IGpPaymentMethodPayload {
  token?: string;
  number?: string;
  exp_month?: string;
  exp_year?: string;
  cvv?: string;
  card_holder_name?: string;
}

interface IGlobalPaymentsAuthorizeReqBody {
  order_id: number;
  payment_method?: IGpPaymentMethodPayload;
  payment_token_id?: number;
  save_payment_method?: boolean;
  amount?: number;
  currency?: string;
}

interface IGlobalPaymentsTokenizeReqBody {
  payment_method: IGpPaymentMethodPayload;
  save?: boolean;
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
    pleb_id,
    phleb_booking,
  } = req.body;
  
  // Extract phleb_booking from nested structure if needed
  const phlebBookingData = phleb_booking || booking?.phleb_booking;
  
  // Separate booking for OrderService (only if it has booking_date and booking_time)
  // phleb_booking is handled separately and doesn't need booking_date/booking_time
  const bookingForOrderService: Record<string, any> | undefined = (booking?.booking_date && booking?.booking_time) 
    ? { booking_date: booking.booking_date, booking_time: booking.booking_time }
    : undefined;
  
  console.log("stripeCheckout - customer_id received:", customer_id, "type:", typeof customer_id);
  
  try {
    if (pleb_id && (!booking?.booking_date || !booking?.booking_time)) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({
          success: false,
          error: "booking_date and booking_time are required when selecting a pleb",
        });
    }
    
    console.log("stripeCheckout - Attempting to get customer with ID:", customer_id);
    const customer = await CustomerService.getOne(customer_id);
    console.log("stripeCheckout - Customer retrieved:", customer ? `ID: ${customer.id}` : "null");
    
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

    // Add phleb booking price if provided
    let phleb_booking_price = 0;
    if (phlebBookingData) {
      phleb_booking_price = parseFloat(phlebBookingData.price || "0");
      // Add weekend surcharge if provided (frontend should include it in price or send separately)
      if (phlebBookingData.weekend_surcharge) {
        phleb_booking_price += parseFloat(phlebBookingData.weekend_surcharge || "0");
      }
    }

    const total_val =
      cart_total + shipping_charges + other_charges_total + phleb_booking_price - discount;

    console.log("stripeCheckout - calculation breakdown:", {
      cart_total,
      shipping_charges,
      other_charges_total,
      phleb_booking_price,
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
    const id = await OrderService.addOne(order, bookingForOrderService || {} as Record<string, any>);
    await assignPlebIfProvided(pleb_id, id, customer, booking, res.locals.sessionUser);
    
    // Save phleb booking if provided (check both root level and nested in booking)
    if (phlebBookingData) {
      try {
        await PhlebBookingService.saveBooking(id, phlebBookingData);
        await sendPhlebBookingEmails(customer, phlebBookingData, order_id, id);
      } catch (bookingError) {
        // Log error but don't fail the order creation
        console.error("Failed to save phleb booking:", bookingError);
      }
    }
    
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

/**
 * Global Payments Checkout - Creates order and places pre-authorization hold
 */
interface IGlobalPaymentsCheckoutReqBody {
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
  payment_method?: IGpPaymentMethodPayload;
  payment_token_id?: number;
  save_payment_method?: boolean;
  currency?: string;
  pleb_id?: number;
  phleb_booking?: IPhlebBookingData;
}

async function globalPaymentsCheckout(
  req: IReq<IGlobalPaymentsCheckoutReqBody>,
  res: IRes
) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }

  const sessionUser = res.locals.sessionUser;
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
    payment_method,
    payment_token_id,
    save_payment_method,
    currency,
    pleb_id,
    phleb_booking,
  } = req.body;

  // Extract phleb_booking from nested structure if needed
  const phlebBookingData = phleb_booking || booking?.phleb_booking;
  
  // Separate booking for OrderService (only if it has booking_date and booking_time)
  // phleb_booking is handled separately and doesn't need booking_date/booking_time
  const bookingForOrderService: Record<string, any> | undefined = (booking?.booking_date && booking?.booking_time) 
    ? { booking_date: booking.booking_date, booking_time: booking.booking_time }
    : undefined;

  if (!payment_method && !payment_token_id) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Either payment_method or payment_token_id is required",
    });
  }

  let authorizationResult: Awaited<
    ReturnType<typeof GlobalPaymentsService.authorize>
  > | null = null;
  let authorizationTransactionId: string | null = null;
  let savedPaymentTokenId: number | null = null;
  let usingStoredToken = false;

  try {
    if (pleb_id && (!booking?.booking_date || !booking?.booking_time)) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({
          success: false,
          error: "booking_date and booking_time are required when selecting a pleb",
        });
    }

    const customer = await CustomerService.getOne(customer_id);
    if (!customer) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ success: false, error: "Customer not found" });
    }

    const order_placed_by = sessionUser.id;
    const prac_id = customer.created_by;
    let createdBy = 0;
    if (
      sessionUser.user_level == UserLevels.Practitioner ||
      sessionUser.user_level == UserLevels.Admin
    ) {
      createdBy = sessionUser.id;
    } else {
      createdBy = sessionUser.practitioner_id || 0;
    }

    // Calculate totals
    let cart_total = 0;
    for (const test_id of test_ids) {
      const test = await TestsService.getOne(test_id);
      cart_total += parseFloat(test.price);
    }
    const shipping = await ShippingsService.getOne(shipping_type);
    const shipping_charges = shipping["value"];
    let other_charges_total = 0;
    for (const service_id of service_ids) {
      const service = await ServicesService.getOne(service_id);
      other_charges_total += service.value;
    }

    // Add phleb booking price if provided
    let phleb_booking_price = 0;
    if (phlebBookingData) {
      phleb_booking_price = parseFloat(phlebBookingData.price || "0");
      // Add weekend surcharge if provided (frontend should include it in price or send separately)
      if (phlebBookingData.weekend_surcharge) {
        phleb_booking_price += parseFloat(phlebBookingData.weekend_surcharge || "0");
      }
    }

    const total_val =
      cart_total + shipping_charges + other_charges_total + phleb_booking_price - discount;

    if (total_val <= 0) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error:
          "Total calculated amount is 0 or less. Please check your order details again.",
      });
    }

    const order_id = moment().format("YYMM") + `${mt_rand(55, 55555)}`;

    // Prepare payment method
    let gpPaymentMethod;
    if (payment_token_id) {
      const tokenRecord = await PaymentTokenService.getByIdForUser(
        payment_token_id,
        sessionUser.id
      );
      if (!tokenRecord) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          error: "Stored payment method not found",
        });
      }
      gpPaymentMethod = { token: tokenRecord.token };
      usingStoredToken = true;
      savedPaymentTokenId = tokenRecord.id;
    } else {
      gpPaymentMethod = {
        token: payment_method?.token,
        number: payment_method?.number,
        expMonth: payment_method?.exp_month,
        expYear: payment_method?.exp_year,
        cvv: payment_method?.cvv,
        cardHolderName: payment_method?.card_holder_name,
      };
    }

    // Place pre-authorization hold
    const shouldSaveToken = !usingStoredToken && (save_payment_method ?? true);
    authorizationResult = await GlobalPaymentsService.authorize({
      amount: Number(total_val.toFixed(2)),
      currency: currency || EnvVars.GlobalPayments.DefaultCurrency,
      clientTransactionId: order_id,
      allowDuplicates: false,
      requestMultiUseToken: shouldSaveToken,
      paymentMethod: gpPaymentMethod,
    });
    authorizationTransactionId = authorizationResult.transactionId;

    // Save token if new card was used
    if (shouldSaveToken && authorizationResult.token) {
      const masked = authorizationResult.raw.cardDetails?.maskedNumberLast4;
      const derivedLast4 = masked ? masked.slice(-4) : null;
      const tokenRecord = await PaymentTokenService.saveOrUpdate(
        sessionUser.id,
        {
          token: authorizationResult.token,
          fingerprint: authorizationResult.raw.fingerprint || null,
          brand:
            authorizationResult.raw.cardType ||
            authorizationResult.raw.cardDetails?.brand ||
            null,
          last4:
            authorizationResult.raw.cardLast4 ||
            derivedLast4 ||
            (payment_method?.number
              ? payment_method.number.slice(-4)
              : null),
          exp_month: payment_method?.exp_month || null,
          exp_year: payment_method?.exp_year || null,
        }
      );
      savedPaymentTokenId = tokenRecord.id;
    }

    // Create order with authorization details
    const order = {
      order_id,
      customer_id,
      transaction_id: authorizationResult.transactionId,
      test_ids: test_ids.join(","),
      client_id: customer.client_code,
      client_name: customer.fore_name + " " + customer.sur_name,
      shipping_type: shipping_type.toString(),
      other_charges: service_ids.join(","),
      checkout_type: "GlobalPayments",
      payment_status: "Authorized",
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

    const id = await OrderService.addOne(order, bookingForOrderService || {} as Record<string, any>);
    await assignPlebIfProvided(pleb_id, id, customer, booking, sessionUser);
    
    // Save phleb booking if provided (check both root level and nested in booking)
    if (phlebBookingData) {
      try {
        await PhlebBookingService.saveBooking(id, phlebBookingData);
        await sendPhlebBookingEmails(customer, phlebBookingData, order_id, id);
      } catch (bookingError) {
        // Log error but don't fail the order creation
        console.error("Failed to save phleb booking:", bookingError);
      }
    }
    
    const order_number = `#YRV-${order_id}`;

    return res.status(HttpStatusCodes.CREATED).json({
      success: true,
      order_id: id,
      order_number,
      authorization: authorizationResult,
      payment_token_id: savedPaymentTokenId,
    });
  } catch (error) {
    // Release hold if order creation fails
    if (authorizationTransactionId) {
      try {
        await GlobalPaymentsService.release(authorizationTransactionId);
      } catch (releaseError) {
        console.error(
          "Failed to release Global Payments authorization:",
          releaseError
        );
      }
    }
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

async function globalPaymentsAuthorize(
  req: IReq<IGlobalPaymentsAuthorizeReqBody>,
  res: IRes
) {
  console.log("GlobalPaymentsAuthorize - headers:", req.headers);
  console.log("GlobalPaymentsAuthorize - body:", req.body);
  const sessionUser = res.locals.sessionUser;
  console.log("GlobalPaymentsAuthorize - sessionUser:", sessionUser);
  if (!sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }

  const {
    order_id,
    payment_method,
    payment_token_id,
    save_payment_method,
    amount,
    currency,
  } = req.body;

  if (!order_id) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "order_id is required" });
  }

  if (!payment_method && !payment_token_id) {
    return res.status(HttpStatusCodes.BAD_REQUEST).json({
      success: false,
      error: "Either payment_method or payment_token_id is required",
    });
  }

  let authorizationResult: Awaited<
    ReturnType<typeof GlobalPaymentsService.authorize>
  > | null = null;
  let savedPaymentTokenId: number | null = payment_token_id || null;
  try {
    const order = await OrderService.getOne(order_id);
    if (!order) {
      return res
        .status(HttpStatusCodes.NOT_FOUND)
        .json({ success: false, error: "Order not found" });
    }
    const authorizationAmount =
      amount !== undefined ? Number(amount) : Number(order.total_val);
    if (!authorizationAmount || authorizationAmount <= 0) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Order total must be greater than zero for authorization",
      });
    }

    let gpPaymentMethod;
    let usingStoredToken = false;
    if (payment_token_id) {
      const tokenRecord = await PaymentTokenService.getByIdForUser(
        payment_token_id,
        sessionUser.id
      );
      if (!tokenRecord) {
        return res.status(HttpStatusCodes.NOT_FOUND).json({
          success: false,
          error: "Stored payment method not found",
        });
      }
      gpPaymentMethod = {
        token: tokenRecord.token,
      };
      usingStoredToken = true;
    } else {
      gpPaymentMethod = {
        token: payment_method?.token,
        number: payment_method?.number,
        expMonth: payment_method?.exp_month,
        expYear: payment_method?.exp_year,
        cvv: payment_method?.cvv,
        cardHolderName: payment_method?.card_holder_name,
      };
    }

    const shouldSaveToken = !usingStoredToken && (save_payment_method ?? true);
    authorizationResult = await GlobalPaymentsService.authorize({
      amount: Number(authorizationAmount.toFixed(2)),
      currency: currency || EnvVars.GlobalPayments.DefaultCurrency,
      clientTransactionId: order.order_id,
      requestMultiUseToken: shouldSaveToken,
      paymentMethod: gpPaymentMethod,
    });

    if (shouldSaveToken && authorizationResult.token && payment_method) {
      const masked = authorizationResult.raw.cardDetails?.maskedNumberLast4;
      const derivedLast4 = masked ? masked.slice(-4) : null;
      const tokenRecord = await PaymentTokenService.saveOrUpdate(
        sessionUser.id,
        {
          token: authorizationResult.token,
          fingerprint: authorizationResult.raw.fingerprint || null,
          brand:
            authorizationResult.raw.cardType ||
            authorizationResult.raw.cardDetails?.brand ||
            null,
          last4:
            authorizationResult.raw.cardLast4 ||
            derivedLast4 ||
            (payment_method.number
              ? payment_method.number.slice(-4)
              : null),
          exp_month: payment_method.exp_month || null,
          exp_year: payment_method.exp_year || null,
        }
      );
      savedPaymentTokenId = tokenRecord.id;
    }

    await OrderService.updatePaymentFields(order.id, {
      checkout_type: "GlobalPayments",
      payment_status: "Authorized",
      transaction_id: authorizationResult.transactionId,
    });

    return res.status(HttpStatusCodes.OK).json({
      success: true,
      order_id: order.id,
      authorization: authorizationResult,
      payment_token_id: savedPaymentTokenId,
    });
  } catch (error) {
    if (authorizationResult?.transactionId) {
      try {
        await GlobalPaymentsService.release(authorizationResult.transactionId);
      } catch (releaseError) {
        console.error(
          "Failed to release Global Payments authorization:",
          releaseError
        );
      }
    }
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

interface IGpManagePaymentReqBody {
  order_id: number;
  amount?: number;
  currency?: string;
}

async function globalPaymentsCapture(
  req: IReq<IGpManagePaymentReqBody>,
  res: IRes
) {
  console.log("GlobalPaymentsCapture - headers:", req.headers);
  console.log("GlobalPaymentsCapture - body:", req.body);
  const sessionUser = res.locals.sessionUser;
  if (!sessionUser || sessionUser.user_level === UserLevels.Customer) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const { order_id, amount, currency } = req.body;
  if (!order_id) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "order_id is required" });
  }
  try {
    const order = await OrderService.getOne(order_id);
    if (order.checkout_type !== "GlobalPayments") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Order was not processed via Global Payments",
      });
    }
    if (!order.transaction_id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Order is missing Global Payments transaction reference",
      });
    }
    if (order.payment_status !== "Authorized") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Only authorized orders can be captured",
      });
    }
    const capture = await GlobalPaymentsService.capture({
      transactionId: order.transaction_id,
      amount: amount ?? order.total_val,
      currency: currency || EnvVars.GlobalPayments.DefaultCurrency,
    });
    await OrderService.updatePaymentStatus(
      order.id,
      "Paid",
      capture.transactionId || order.transaction_id
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      capture,
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

async function globalPaymentsRelease(
  req: IReq<{ order_id: number }>,
  res: IRes
) {
  console.log("GlobalPaymentsRelease - headers:", req.headers);
  console.log("GlobalPaymentsRelease - body:", req.body);
  const sessionUser = res.locals.sessionUser;
  if (!sessionUser || sessionUser.user_level === UserLevels.Customer) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const { order_id } = req.body;
  if (!order_id) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "order_id is required" });
  }
  try {
    const order = await OrderService.getOne(order_id);
    if (order.checkout_type !== "GlobalPayments") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Order was not processed via Global Payments",
      });
    }
    if (!order.transaction_id) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Order is missing Global Payments transaction reference",
      });
    }
    if (order.payment_status !== "Authorized") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Only authorized orders can be released",
      });
    }
    const release = await GlobalPaymentsService.release(order.transaction_id);
    await OrderService.updatePaymentStatus(
      order.id,
      "Released",
      release.transactionId || order.transaction_id
    );
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      release,
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

async function tokenizeGlobalPaymentsCard(
  req: IReq<IGlobalPaymentsTokenizeReqBody>,
  res: IRes
) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const sessionUser = res.locals.sessionUser;
  const { payment_method, save = true } = req.body;
  if (!payment_method) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "payment_method is required" });
  }
  try {
    const tokenizeResult = await GlobalPaymentsService.tokenize({
      token: payment_method.token,
      number: payment_method.number,
      expMonth: payment_method.exp_month,
      expYear: payment_method.exp_year,
      cvv: payment_method.cvv,
      cardHolderName: payment_method.card_holder_name,
    });
    let savedPaymentTokenId: number | null = null;
    if (save && tokenizeResult.token) {
      const tokenRecord = await PaymentTokenService.saveOrUpdate(
        sessionUser.id,
        {
          token: tokenizeResult.token,
          fingerprint: tokenizeResult.fingerprint || null,
          brand: tokenizeResult.cardType || null,
          last4:
            tokenizeResult.cardLast4 ||
            (payment_method.number
              ? payment_method.number.slice(-4)
              : null),
          exp_month: payment_method.exp_month || null,
          exp_year: payment_method.exp_year || null,
        }
      );
      savedPaymentTokenId = tokenRecord.id;
    }
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      token: tokenizeResult.token,
      payment_token_id: savedPaymentTokenId,
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

async function getGlobalPaymentsTokens(req: IReq, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const tokens = await PaymentTokenService.listByUser(res.locals.sessionUser.id);
  return res.status(HttpStatusCodes.OK).json({ success: true, payment_methods: tokens });
}

async function deleteGlobalPaymentsToken(req: IReq, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ success: false, error: "Invalid payment token id" });
  }
  const deleted = await PaymentTokenService.deleteToken(
    id,
    res.locals.sessionUser.id
  );
  if (!deleted) {
    return res
      .status(HttpStatusCodes.NOT_FOUND)
      .json({ success: false, error: "Payment method not found" });
  }
  return res.status(HttpStatusCodes.OK).json({ success: true });
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

async function getAvailablePlebs(req: IReq<IAvailablePlebsReqBody>, res: IRes) {
  if (!res.locals.sessionUser) {
    return res
      .status(HttpStatusCodes.UNAUTHORIZED)
      .json({ success: false, error: "Unauthorized" });
  }

  try {
    const {
      customer_id,
      booking_date,
      booking_time,
      address,
      town,
      postal_code,
      country,
    } = req.body;

    if (!customer_id) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ success: false, error: "customer_id is required" });
    }

    const customer = await CustomerService.getOne(customer_id);
    if (!customer) {
      return res
        .status(HttpStatusCodes.NOT_FOUND)
        .json({ success: false, error: "Customer not found" });
    }

    const customerAddress = buildCustomerAddress(customer, {
      address,
      town,
      postal_code,
      country,
    });

    const data = await PlebAvailabilityService.getAvailablePlebsForBooking({
      booking_date,
      booking_time,
      customer_address: customerAddress,
    });

    return res.status(HttpStatusCodes.OK).json({ success: true, data });
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
  if (!canAssignJobs(res.locals.sessionUser)) {
    return res.status(HttpStatusCodes.FORBIDDEN).json({
      success: false,
      error: "Job assignment access required"
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

/**
 * Get phlebotomist slots by postcode and/or town
 */
async function getPhlebSlots(req: IReq, res: IRes) {
  try {
    const customer_id = req.query.customer_id as string;

    // customer_id is required
    if (!customer_id || customer_id.trim() === "") {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "customer_id is required"
      }).end();
    }

    // Fetch customer to get postal_code and town
    const customerIdNum = parseInt(customer_id, 10);
    if (isNaN(customerIdNum)) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Invalid customer_id"
      }).end();
    }

    const customer = await CustomerService.getOne(customerIdNum);
    if (!customer) {
      return res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        error: "Customer not found"
      }).end();
    }

    const postcode = customer.postal_code || "";
    const town = customer.town || "";

    // At least one of postcode or town must be available
    if ((!postcode || postcode.trim() === "") && (!town || town.trim() === "")) {
      return res.status(HttpStatusCodes.BAD_REQUEST).json({
        success: false,
        error: "Customer postal_code or town is required"
      }).end();
    }

    const result = await PhlebSlotService.getSlotsByLocation(postcode, town);

    // If out of area, return error message
    if (result.zone === "out_of_area" && result.error) {
      return res.status(HttpStatusCodes.OK).json({
        success: false,
        error: result.error.message,
        showContactButton: result.error.showContactButton,
        zone: "out_of_area",
        postal_code: postcode,
        town: town
      }).end();
    }

    // Return slots for valid zones along with postal_code and town
    return res.status(HttpStatusCodes.OK).json({
      success: true,
      zone: result.zone,
      slots: result.slots,
      postal_code: postcode,
      town: town
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
  globalPaymentsCheckout,
  globalPaymentsAuthorize,
  globalPaymentsCapture,
  globalPaymentsRelease,
  tokenizeGlobalPaymentsCard,
  getGlobalPaymentsTokens,
  deleteGlobalPaymentsToken,
  getPaymentMethods,
  addPaymentMethod,
  getAvailablePlebs,
  getBookedTimeSlots,
  getBookingDetails,
  getExtraDiscountPractitionerIds,
  GetAllCustomerOrders,
  getOrdersWithStartedStatus,
  getPhlebSlots,
} as const;
