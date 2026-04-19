"use strict";

function maskEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "";
  }
  const [local, domain] = email.split("@");
  if (!local) {
    return `***@${domain}`;
  }
  const prefix = local.slice(0, 2);
  return `${prefix}${"*".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 4) {
    return "";
  }
  return `***-***-${digits.slice(-4)}`;
}

function coarseAddress(address) {
  if (!address) {
    return "";
  }
  const parts = String(address).split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return "redacted";
  }
  return parts.slice(-2).join(", ");
}

function sanitizeCustomer(customer) {
  return {
    customerId: customer.id,
    accountId: customer.accountId,
    displayName: customer.fullName,
    contact: {
      email: maskEmail(customer.email),
      phone: maskPhone(customer.phone),
      location: coarseAddress(customer.address),
    },
    profile: {
      loyaltyTier: customer.loyaltyTier,
      preferredCurrency: customer.preferredCurrency,
      riskFlags: customer.riskFlags,
    },
    controls: {
      sensitiveFieldsRemoved: ["nationalId", "internalNotes", "creditScoreBand", "address"],
      accessMode: "broker-only",
    },
  };
}

function sanitizeOrders(orders) {
  return orders.map((order) => ({
    orderId: order.id,
    createdAt: order.createdAt,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    itemCount: order.itemCount,
    paymentMethod: order.paymentMethod,
  }));
}

function sanitizeAccountSummary(summary) {
  return {
    accountId: summary.accountId,
    customerId: summary.customerId,
    accountOwner: summary.accountOwner,
    preferredCurrency: summary.preferredCurrency,
    totals: {
      totalSpend: summary.totalSpend,
      activeOrders: summary.activeOrders,
    },
    riskFlags: summary.riskFlags,
    notes: "Internal notes withheld by Data Broker policy.",
  };
}

module.exports = {
  coarseAddress,
  maskEmail,
  maskPhone,
  sanitizeAccountSummary,
  sanitizeCustomer,
  sanitizeOrders,
};
