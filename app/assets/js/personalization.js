import { getUsers, getRestaurants, getOrderLikes } from "./storage.js";
import { getDishRollups, getVisibleOrders } from "./orders.js";

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function getPersonalizedRankings(userId, minSamples = 2) {
  const users = getUsers();
  const user = users.find((item) => item.id === userId);
  const preferences = new Set((user && user.dietaryPrefs) || []);
  const likes = getOrderLikes().filter((item) => item.userId === userId);
  const orders = getVisibleOrders();
  const likedTerms = new Set();
  likes.forEach((like) => {
    const order = orders.find((item) => item.id === like.orderId);
    if (order) {
      tokenize(order.customName).forEach((token) => likedTerms.add(token));
      (order.tags || []).forEach((tag) => likedTerms.add(tag.toLowerCase()));
    }
  });

  const restaurants = getRestaurants();
  return getDishRollups()
    .filter((item) => item.count >= minSamples)
    .map((item) => {
      const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
      const dishOrders = orders.filter(
        (entry) =>
          entry.restaurantId === item.restaurantId &&
          entry.customName.toLowerCase() === item.dishName.toLowerCase()
      );
      const allTags = new Set(dishOrders.flatMap((entry) => entry.tags || []).map((tag) => tag.toLowerCase()));
      const hasAffinity = [...allTags].some((tag) => preferences.has(tag));
      const dishTerms = new Set(tokenize(item.dishName));
      const termOverlap = [...dishTerms].filter((t) => likedTerms.has(t)).length;
      const restaurantBoost = restaurant && preferences.has(restaurant.category.toLowerCase()) ? 0.1 : 0;
      const affinityBoost = hasAffinity ? 0.2 : 0;
      const similarityBoost = Math.min(termOverlap * 0.04, 0.2);
      const personalizedScore = Number((item.score + affinityBoost + similarityBoost + restaurantBoost).toFixed(3));
      return { ...item, personalizedScore };
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore);
}

export function filterByDietaryTag(items, requiredTag) {
  if (!requiredTag) return items;
  const orders = getVisibleOrders();
  const target = requiredTag.toLowerCase();
  return items.filter((item) => {
    const dishOrders = orders.filter(
      (entry) =>
        entry.restaurantId === item.restaurantId &&
        entry.customName.toLowerCase() === item.dishName.toLowerCase()
    );
    return dishOrders.some((entry) => (entry.tags || []).map((tag) => tag.toLowerCase()).includes(target));
  });
}
