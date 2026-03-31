import { getRestaurants } from "./storage.js";
import { searchDishAndRestaurant } from "./orders.js";

export function searchRestaurants(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return getRestaurants();
  return getRestaurants().filter((item) => {
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });
}

export function globalSearch(query) {
  return {
    restaurants: searchRestaurants(query),
    dishes: searchDishAndRestaurant(query)
  };
}
