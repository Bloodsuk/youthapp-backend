/**
 * Express router paths go here.
 */

export default {
  Base: "/api",
  Auth: {
    Base: "/auth",
    Login: "/login",
    Register: "/register",
    ForgotPassword: "/forgot_password",
    ResetPassword: "/reset_password",
    Logout: "/logout",
  },
  Users: {
    Base: "/users",
    Get: "/all",
    GetPractitioners: "/all/practitioners",
    GetClinics: "/all/clinics",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    UpdateMany: "/update/many",
    Activate: "/activate",
    Deactivate: "/deactivate",
    UpdateEmail: "/update_email",
    UpdatePass: "/update_password",
    Delete: "/delete/:id",
  },
  Messages: {
    Base: "/messages",
    Get: "/all",
    GetCustomerMessages: "/get_customer_msg/:customer_id/:practitioner_id",
    GetPractitionerMessages: "/get_practitioner_msg/:customer_id/:practitioner_id",
    CustomerHasMessages: "/customer_has_msg/:customer_id/:practitioner_id",
    PractitionerHasMessages: "/practitioner_has_msg/:practitioner_id",
    PractitionerHasMessagesByCustomer: "/pract_has_msg_by_customers/:practitioner_id",
    GetById: "/:id",
    Send: "/send",
    MarkRead: "/mark_read",
    Update: "/update/:id",
    Delete: "/delete/:id",
  },
  Roles: {
    Base: "/roles",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    MarkActive: "/change_active_status",
    Update: "/update/:id",
    Delete: "/delete/:id",
    AssignRoleToUser: "/assign_to_user",
    AssignPermissionToRole: "/assign_permission",
  },
  Permissions: {
    Base: "/permissions",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    MarkActive: "/change_active_status",
    Update: "/update/:id",
    Delete: "/delete/:id"
  },
  Categories: {
    Base: "/categories",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
  },
  Results: {
    Base: "/results",
    Get: "/all",
    GetById: "/:id",
  },
  Customers: {
    Base: "/customers",
    Get: "/all",
    GetByUserId: "/user/:userId",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
    SendLogins: "/send_logins",
  },
  MailConfig: {
    Base: "/mail_config",
    Get: "/get",
    Add: "/add",
    Update: "/update",
  },
  MailTemplate: {
    Base: "/mail_template",
    Get: "/all",
    Add: "/add",
    Update: "/update/:type",
  },
  Orders: {
    Base: "/orders",
    Get: "/all",
    GetOutstanding: "/outstanding_credit",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    UpdateStatus: "/update_status/:id",
    Delete: "/delete/:id",
    MarkPaid: "/mark_paid",
    CreditCheckout: "/credit_checkout",
    StripeCheckout: "/stripe_checkout",
    PaymentMethods: "/stripe/payment_methods",
  },
  Tests: {
    Base: "/tests",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
  },
  Coupons: {
    Base: "/coupons",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
    GetDiscount: "/discount_rate",
  },
  Services: {
    Base: "/services",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
  },
  Shippings: {
    Base: "/shipping_types",
    Get: "/all",
    GetById: "/:id",
    Add: "/add",
    Update: "/update/:id",
    Delete: "/delete/:id",
  },
  CreditRequests: {
    Base: "/credit_requests",
    Get: "/all",
    Pending: "/pending",
    Approved: "/approved",
    GetUserBalances: "/user_balances",
    GetById: "/:id",
    GetByUserId: "/user/:user_id",
    Add: "/add",
    Update: "/update/:id",
    UpdateStatus: "/update_status/:id",
    Delete: "/delete/:id",
  },
  Stats: {
    Base: "/stats",
    Get: "/all",
  },
} as const;
