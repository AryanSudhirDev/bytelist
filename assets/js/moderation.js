import { getFlags, saveFlags, getOrders, saveOrders } from "./storage.js";

export function sanitizeText(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim();
}

export function validateOrderInput(input) {
  const errors = [];
  if (!input.restaurantId) errors.push("Restaurant is required.");
  if (!sanitizeText(input.customName)) errors.push("Dish name is required.");
  if (!sanitizeText(input.reviewReason)) errors.push("Review reason is required.");
  if (sanitizeText(input.reviewReason).length < 20) errors.push("Review reason must be at least 20 characters.");
  const rating = Number(input.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) errors.push("Rating must be an integer from 1 to 10.");
  return errors;
}

export function flagOrder(orderId, reason, reporterId) {
  const flags = getFlags();
  const cleaned = sanitizeText(reason);
  if (!cleaned) return false;
  flags.push({
    id: crypto.randomUUID(),
    orderId,
    reporterId,
    reason: cleaned,
    status: "OPEN",
    createdAt: new Date().toISOString()
  });
  saveFlags(flags);
  return true;
}

export function hideOrder(orderId) {
  const orders = getOrders();
  const updated = orders.map((item) =>
    item.id === orderId ? { ...item, isHidden: true } : item
  );
  saveOrders(updated);
}
