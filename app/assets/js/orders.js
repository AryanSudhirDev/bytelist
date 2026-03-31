import {
  getOrders,
  saveOrders,
  getOrderLikes,
  saveOrderLikes,
  getOrderCopies,
  saveOrderCopies,
  getRestaurants
} from "./storage.js";
import { sanitizeText, validateOrderInput } from "./moderation.js";

export function createOrder(input, userId) {
  const errors = validateOrderInput(input);
  if (errors.length) return { ok: false, errors };
  const orders = getOrders();
  const now = new Date().toISOString();
  const order = {
    id: crypto.randomUUID(),
    userId,
    restaurantId: input.restaurantId,
    customName: sanitizeText(input.customName),
    customizationText: sanitizeText(input.customizationText),
    reviewReason: sanitizeText(input.reviewReason),
    rating: Number(input.rating),
    tags: input.tags || [],
    createdAt: now,
    isHidden: false
  };
  orders.push(order);
  saveOrders(orders);
  return { ok: true, order };
}

export function getVisibleOrders() {
  return getOrders().filter((item) => !item.isHidden);
}

function toKey(order) {
  return `${order.restaurantId}::${order.customName.toLowerCase()}`;
}

export function getDishRollups(orders = getVisibleOrders()) {
  const likes = getOrderLikes();
  const map = new Map();
  orders.forEach((order) => {
    const key = toKey(order);
    if (!map.has(key)) {
      map.set(key, {
        key,
        restaurantId: order.restaurantId,
        dishName: order.customName,
        orderIds: [],
        ratings: [],
        likeCount: 0
      });
    }
    const bucket = map.get(key);
    bucket.orderIds.push(order.id);
    bucket.ratings.push(order.rating);
  });

  map.forEach((bucket) => {
    const likeCount = likes.filter((like) => bucket.orderIds.includes(like.orderId)).length;
    bucket.likeCount = likeCount;
    const avgRating = bucket.ratings.reduce((sum, value) => sum + value, 0) / bucket.ratings.length;
    bucket.avgRating = Number(avgRating.toFixed(2));
    bucket.count = bucket.ratings.length;
    bucket.score = Number((bucket.avgRating * 0.7 + Math.log10(1 + bucket.likeCount) * 0.3).toFixed(3));
  });
  return Array.from(map.values());
}

export function getTopOverall(minSamples = 1) {
  return getDishRollups()
    .filter((item) => item.count >= minSamples)
    .sort((a, b) => b.score - a.score);
}

export function getTopByRestaurant(restaurantId, minSamples = 1) {
  return getTopOverall(minSamples).filter((item) => item.restaurantId === restaurantId);
}

export function searchDishAndRestaurant(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const restaurants = getRestaurants();
  return getTopOverall(1).filter((item) => {
    const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
    const restaurantName = restaurant ? restaurant.name.toLowerCase() : "";
    return item.dishName.toLowerCase().includes(q) || restaurantName.includes(q);
  });
}

export function toggleLike(orderId, userId) {
  const likes = getOrderLikes();
  const idx = likes.findIndex((item) => item.orderId === orderId && item.userId === userId);
  if (idx >= 0) {
    likes.splice(idx, 1);
  } else {
    likes.push({ id: crypto.randomUUID(), orderId, userId, createdAt: new Date().toISOString() });
  }
  saveOrderLikes(likes);
}

export function copyOrder(orderId, copierId) {
  const copies = getOrderCopies();
  const exists = copies.find((item) => item.orderId === orderId && item.copierId === copierId);
  if (exists) return false;
  copies.push({ id: crypto.randomUUID(), orderId, copierId, createdAt: new Date().toISOString() });
  saveOrderCopies(copies);
  return true;
}

export function getProfileStats(userId) {
  const orders = getVisibleOrders().filter((item) => item.userId === userId);
  const avg = orders.length
    ? Number((orders.reduce((sum, item) => sum + item.rating, 0) / orders.length).toFixed(2))
    : 0;
  const uniqueRestaurants = new Set(orders.map((item) => item.restaurantId)).size;
  return {
    totalOrders: orders.length,
    averageRating: avg,
    uniqueRestaurants,
    recent: [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8)
  };
}
