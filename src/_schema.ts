export const _schema = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "definitions": {            
        "ICustomer": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "name": {
                    "type": "string"
                },
                "email": {
                    "type": "string"
                },                             
                "type": {
                    "$ref": "#/definitions/CustomerTypes"
                },
                "acc_number": {
                    "type": "string"
                },
                "bill_frequency": {
                    "type": "string"
                },
                "status": {
                    "type": "string"
                },
                "contract_term_length": {
                    "type": "string"
                },
                "amount_due": {
                    "type": "string"
                },
                "rate": {
                    "type": "string"
                },
                "exp_day": {
                    "type": "string"
                },
                "exp_month": {
                    "type": "string"
                },
                "exp_year": {
                    "type": "string"
                },
                "credit_card": {
                    "type": "string"
                },
                "credit_card_name": {
                    "type": "string"
                },
                "contact_name": {
                    "type": "string"
                },
                "company_name": {
                    "type": "string"
                },
                "toter_serial_numbers": {
                    "type": "string"
                },
                "wants_einvoice": {
                    "type": "number"
                },
                "is_exempt": {
                    "type": "number"
                },
                "is_inactive": {
                    "type": "number"
                },
                "is_closed": {
                    "type": "number"
                },
                "recurring_customer": {
                    "type": "number"
                },
                "recycling_customer": {
                    "type": "number"
                },
                "auto_renew": {
                    "type": "number"
                },
                "phone_numbers": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "phone": {
                                "type": "string"
                            },
                            "type": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "phone",
                            "type"
                        ],
                        "additionalProperties": false
                    }
                },
                "pickup_day": {
                    "type": "string"
                },
                "billing_address": {
                    "$ref": "#/definitions/Record<string,string>"
                },
                "service_address": {
                    "$ref": "#/definitions/Record<string,string>"
                },
                "dumpster_addresses": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number"
                            },
                            "street": {
                                "type": "string"
                            },
                            "city": {
                                "type": "string"
                            },
                            "state": {
                                "type": "string"
                            },
                            "zipcode": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "id",
                            "street",
                            "city",
                            "state",
                            "zipcode"
                        ],
                        "additionalProperties": false
                    }
                },
                "dumpsters": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": {
                                "type": "number"
                            },
                            "number": {
                                "type": "string"
                            },
                            "type": {
                                "type": "string"
                            },
                            "frequency": {
                                "type": "string"
                            },
                            "address": {
                                "type": "string"
                            }
                        },
                        "required": [
                            "id",
                            "number",
                            "type",
                            "frequency",
                            "address"
                        ],
                        "additionalProperties": false
                    }
                },
                "registered_user": {
                    "type": "number"
                },
                "mail_list_id": {
                    "type": "string"
                }
            },
            "required": [
                "uid",
                "name",
                "email",
                "type",
                "acc_number",
                "bill_frequency",
                "status",
                "contract_term_length",
                "amount_due",
                "rate",
                "exp_day",
                "exp_month",
                "exp_year",
                "credit_card",
                "credit_card_name",
                "contact_name",
                "company_name",
                "toter_serial_numbers",
                "wants_einvoice",
                "is_exempt",
                "is_inactive",
                "is_closed",
                "recurring_customer",
                "recycling_customer",
                "auto_renew",
                "phone_numbers",
                "pickup_day",
                "billing_address",
                "service_address",
                "dumpster_addresses",
                "dumpsters"
            ],
            "additionalProperties": false
        },
        "CustomerTypes": {
            "type": "string",
            "enum": [
                "commercial",
                "residential",
                "greenbag",
                "west_mayfield",
                "new_castle",
                "new_castle_2",
                "east_butler",
                "slippery_rock"
            ]
        },
        "Record<string,string>": {
            "type": "object",
            "additionalProperties": {
                "type": "string"
            }
        },
        "IUser": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "first_name": {
                    "type": "string"
                },
                "last_name": {
                    "type": "string"
                },
                "email": {
                    "type": "string"
                },
                "password": {
                    "type": "string"
                },
                "role": {
                    "$ref": "#/definitions/UserRoles"
                },
                "pages": {
                    "$ref": "#/definitions/Record<string,boolean>"
                }
            },
            "required": [
                "first_name",
                "email"
            ],
            "additionalProperties": false
        },
        "UserRoles": {
            "type": "number",
            "enum": [
                0,
                1
            ]
        },
        "Record<string,boolean>": {
            "type": "object",
            "additionalProperties": {
                "type": "boolean"
            }
        },
        "ICallHistory": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "customer_id": {
                    "type": "number"
                },
                "note": {
                    "type": "string"
                },
                "date": {
                    "type": "string"
                }
            },
            "required": [
                "customer_id",
                "note",
                "date"
            ],
            "additionalProperties": false
        },
        "IHistory": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "customer_id": {
                    "type": "number"
                },
                "amount": {
                    "type": "string"
                },
                "description": {
                    "type": "string"
                },
                "service_description": {
                    "type": "string"
                },
                "service": {
                    "type": "string"
                },
                "status": {
                    "type": "string"
                },
                "time": {
                    "type": "string"
                },
                "type_of_payment": {
                    "type": "string"
                },
                "type_of_transaction": {
                    "type": "string"
                },
                "invoice_name": {
                    "type": "string"
                },
                "due_date": {
                    "type": "string"
                },
                "sent": {
                    "type": "number"
                },
                "paid": {
                    "type": "number"
                },
                "sent_date": {
                    "type": "string"
                },
                "quarter": {
                    "type": "string"
                },
                "year": {
                    "type": "string"
                },
                "service_level": {
                    "type": "string"
                },
                "transaction_id": {
                    "type": "string"
                },
                "receipt_address": {
                    "type": "string"
                },
                "payment_source": {
                    "type": "string"
                }
            },
            "required": [
                "uid",
                "customer_id",
                "amount",
                "description",
                "service_description",
                "service",
                "status",
                "time",
                "type_of_payment",
                "type_of_transaction",
                "invoice_name",
                "due_date",
                "sent",
                "paid",
                "sent_date",
                "quarter",
                "year",
                "service_level",
                "transaction_id",
                "receipt_address",
                "payment_source"
            ],
            "additionalProperties": false
        },
        "INote": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "customer_id": {
                    "type": "number"
                },
                "note": {
                    "type": "string"
                },
                "date": {
                    "type": "string"
                }
            },
            "required": [
                "customer_id",
                "note",
                "date"
            ],
            "additionalProperties": false
        },
        "IRoute": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "name": {
                    "type": "string"
                },
                "status": {
                    "type": "string"
                },
                "load_side": {
                    "type": "string"
                },
                "priority": {
                    "type": "number"
                },
                "stops": {
                    "type": "array",
                    "items": {
                        "$ref": "#/definitions/IStop"
                    }
                }
            },
            "required": [
                "uid",
                "name",
                "status",
                "load_side",
                "priority",
                "stops"
            ],
            "additionalProperties": false
        },
        "IStop": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "route_id": {
                    "type": "number"
                },
                "name": {
                    "type": "string"
                },
                "notes": {
                    "type": "string"
                },
                "status": {
                    "type": "string"
                },
                "address": {
                    "type": "object",
                    "properties": {
                        "city": {
                            "type": "string"
                        },
                        "state": {
                            "type": "string"
                        },
                        "street": {
                            "type": "string"
                        },
                        "zipcode": {
                            "type": "string"
                        }
                    },
                    "required": [
                        "city",
                        "state",
                        "street",
                        "zipcode"
                    ],
                    "additionalProperties": false
                },
                "coordinates": {
                    "type": "object",
                    "properties": {
                        "Latitude": {
                            "type": "number"
                        },
                        "Longitude": {
                            "type": "number"
                        }
                    },
                    "required": [
                        "Latitude",
                        "Longitude"
                    ],
                    "additionalProperties": false
                },
                "index": {
                    "type": "number"
                },
                "last_not_out_timestamp": {
                    "type": "string"
                },
                "last_picked_up_timestamp": {
                    "type": "string"
                },
                "added_timestamp": {
                    "type": "string"
                },
                "customer": {
                    "$ref": "#/definitions/ICustomer"
                }
            },
            "required": [
                "uid",
                "route_id",
                "name",
                "notes",
                "status",
                "address",
                "coordinates",
                "index",
                "last_not_out_timestamp",
                "last_picked_up_timestamp",
                "added_timestamp"
            ],
            "additionalProperties": false
        },
        "IJobSubmission": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "first_name": {
                    "type": "string"
                },
                "last_name": {
                    "type": "string"
                },
                "email": {
                    "type": "string"
                },
                "phone": {
                    "type": "string"
                },
                "dob": {
                    "type": "string"
                },
                "street_address": {
                    "type": "string"
                },
                "city": {
                    "type": "string"
                },
                "state": {
                    "type": "string"
                },
                "zip": {
                    "type": "string"
                },
                "position_applied": {
                    "type": "string"
                },
                "available_date": {
                    "type": "string"
                },
                "applicant_date": {
                    "type": "string"
                },
                "applicant_sign": {
                    "type": "string"
                },
                "is_us_citizen": {
                    "type": "number"
                },
                "is_us_authorized": {
                    "type": "number"
                },
                "is_valid_commercial_driver_license": {
                    "type": "number"
                }
            },
            "required": [
                "uid",
                "first_name",
                "last_name",
                "email",
                "phone",
                "dob",
                "street_address",
                "city",
                "state",
                "zip",
                "position_applied",
                "available_date",
                "applicant_date",
                "applicant_sign",
                "is_us_citizen",
                "is_us_authorized",
                "is_valid_commercial_driver_license"
            ],
            "additionalProperties": false
        },
        "IPortalUser": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "auth_id": {
                    "type": "number"
                },
                "email": {
                    "type": "string"
                },
                "acc_number": {
                    "type": "string"
                }
            },
            "required": [
                "auth_id",
                "email"
            ],
            "additionalProperties": false
        },
        "IPassResetToken": {
            "type": "object",
            "properties": {
                "uid": {
                    "type": "number"
                },
                "token": {
                    "type": "string"
                },
                "created": {
                    "type": "string"
                }
            },
            "required": [
                "token",
                "created"
            ],
            "additionalProperties": false
        }
    }
};