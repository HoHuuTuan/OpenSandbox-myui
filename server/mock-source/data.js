"use strict";

const customers = [
  {
    id: "cust_acme_001",
    accountId: "acct_apac_001",
    fullName: "Nguyen Thi Lan",
    email: "lan.nguyen@acme.example",
    phone: "+84 912 345 678",
    address: "12 Le Loi, District 1, Ho Chi Minh City",
    nationalId: "079201009999",
    loyaltyTier: "gold",
    creditScoreBand: "A",
    riskFlags: ["late-payment-watch"],
    internalNotes: "VIP customer, prefers invoice copy via secured channel.",
    preferredCurrency: "VND",
    orders: [
      {
        id: "ord_1001",
        createdAt: "2026-04-01T08:10:00Z",
        status: "delivered",
        amount: 12500000,
        currency: "VND",
        itemCount: 3,
        paymentMethod: "bank_transfer",
        marginPct: 0.18,
        internalTags: ["priority", "manual-review-cleared"],
      },
      {
        id: "ord_1002",
        createdAt: "2026-04-11T03:05:00Z",
        status: "processing",
        amount: 4800000,
        currency: "VND",
        itemCount: 1,
        paymentMethod: "credit_card",
        marginPct: 0.22,
        internalTags: ["upsell-opportunity"],
      },
    ],
  },
  {
    id: "cust_globex_002",
    accountId: "acct_eu_014",
    fullName: "Tran Duc Minh",
    email: "minh.tran@globex.example",
    phone: "+84 903 222 111",
    address: "88 Nguyen Hue, District 1, Ho Chi Minh City",
    nationalId: "079201008888",
    loyaltyTier: "silver",
    creditScoreBand: "B",
    riskFlags: ["manual-review"],
    internalNotes: "Potential expansion account. Do not expose negotiated discount details.",
    preferredCurrency: "USD",
    orders: [
      {
        id: "ord_2201",
        createdAt: "2026-03-29T10:00:00Z",
        status: "delivered",
        amount: 9500,
        currency: "USD",
        itemCount: 5,
        paymentMethod: "wire",
        marginPct: 0.31,
        internalTags: ["discount-override"],
      },
      {
        id: "ord_2202",
        createdAt: "2026-04-08T16:45:00Z",
        status: "cancelled",
        amount: 2100,
        currency: "USD",
        itemCount: 1,
        paymentMethod: "wire",
        marginPct: 0.0,
        internalTags: ["fraud-screening"],
      },
    ],
  },
];

function findCustomer(customerId) {
  return customers.find((customer) => customer.id === customerId) || null;
}

function findCustomerByAccountId(accountId) {
  return customers.find((customer) => customer.accountId === accountId) || null;
}

module.exports = {
  customers,
  findCustomer,
  findCustomerByAccountId,
};
