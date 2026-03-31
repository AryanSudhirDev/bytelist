import {
  getBadges,
  saveBadges,
  getUserBadges,
  saveUserBadges,
  getUsers,
  getRestaurants,
  getOrders,
  getOrderCopies,
  getOrderLikes,
  getUserStreaks,
  saveUserStreaks
} from "./storage.js";
import { getTopByRestaurant, getVisibleOrders } from "./orders.js";

export const BADGE_DEFS = [
  { id: "first_byte", name: "First Byte", group: "exploration", icon: "🍽️", description: "Log your first order review." },
  { id: "local_explorer", name: "Local Explorer", group: "exploration", icon: "🧭", description: "Order from 5 different restaurants." },
  { id: "food_pathfinder", name: "Food Pathfinder", group: "exploration", icon: "🗺️", description: "Order from 10 different restaurants." },
  { id: "city_sampler", name: "City Sampler", group: "exploration", icon: "🏙️", description: "Order from 15 different restaurants." },
  { id: "flavor_cartographer", name: "Flavor Cartographer", group: "exploration", icon: "🧪", description: "Order from 25 different restaurants." },
  { id: "bay_area_foodie", name: "Bay Area Foodie", group: "exploration", icon: "🌉", description: "Order from 50 different restaurants." },
  { id: "bytelist_legend", name: "ByteList Legend", group: "exploration", icon: "👑", description: "Log 100 total orders." },
  { id: "trend_starter", name: "Trend Starter", group: "influence", icon: "🔥", description: "Get 5+ copies on one order." },
  { id: "taste_influencer", name: "Taste Influencer", group: "influence", icon: "📣", description: "Reach 10 total copies across your orders." },
  { id: "menu_architect", name: "Menu Architect", group: "influence", icon: "🏗️", description: "Own the #1 dish at a restaurant." },
  { id: "flavor_authority", name: "Flavor Authority", group: "influence", icon: "⭐", description: "Reach 25 total copies across your orders." },
  { id: "food_critic", name: "Food Critic", group: "review", icon: "📝", description: "Write 5 detailed reviews." },
  { id: "flavor_analyst", name: "Flavor Analyst", group: "review", icon: "🔬", description: "Write 10 detailed reviews." },
  { id: "dish_philosopher", name: "Dish Philosopher", group: "review", icon: "🧠", description: "Write 25 detailed reviews." },
  { id: "boba_connoisseur", name: "Boba Connoisseur", group: "category", icon: "🧋", description: "Log 5 boba drinks." },
  { id: "boba_cartographer", name: "Boba Cartographer", group: "category", icon: "🧭", description: "Try 7 different boba shops." },
  { id: "spice_seeker", name: "Spice Seeker", group: "category", icon: "🌶️", description: "Try 5 spicy dishes." },
  { id: "dessert_hunter", name: "Dessert Hunter", group: "category", icon: "🍰", description: "Review 5 dessert spots." },
  { id: "ramen_master", name: "Ramen Master", group: "category", icon: "🍜", description: "Log 5 ramen dishes." },
  { id: "niche_foodie", name: "Niche Foodie", group: "category", icon: "🆕", description: "Review 3 newly opened restaurants." },
  { id: "menu_hacker", name: "Menu Hacker", group: "special", icon: "🔍", description: "Post a custom combo people copy." },
  { id: "flavor_scientist", name: "Flavor Scientist", group: "special", icon: "🧪", description: "Log 5 customized orders." },
  { id: "hidden_gem_hunter", name: "Hidden Gem Hunter", group: "special", icon: "💎", description: "Review a low-volume hidden gem." },
  { id: "perfect_plate", name: "Perfect Plate", group: "special", icon: "✨", description: "Find a dish with consistent 9+ ratings." },
  { id: "speed_reviewer", name: "Speed Reviewer", group: "special", icon: "🚀", description: "Review 3 restaurants in one day." },
  { id: "bytelist_pioneer", name: "ByteList Pioneer", group: "special", icon: "🛰️", description: "Be first to review a new restaurant." }
];

function ensureBadgeCatalog() {
  const existing = getBadges();
  if (existing.length) return;
  const catalog = BADGE_DEFS.map((item) => ({ ...item }));
  saveBadges(catalog);
}

function hasUserBadge(userId, badgeId, userBadges) {
  return userBadges.some((item) => item.userId === userId && item.badgeId === badgeId);
}

function grant(userId, badgeId, userBadges, awarded) {
  if (!hasUserBadge(userId, badgeId, userBadges)) {
    userBadges.push({ id: crypto.randomUUID(), userId, badgeId, earnedAt: new Date().toISOString() });
    awarded.push(badgeId);
  }
}

function isDetailed(text) {
  return String(text || "").trim().length >= 40;
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

export function evaluateBadgesForUser(userId) {
  ensureBadgeCatalog();
  const restaurants = getRestaurants();
  const orders = getVisibleOrders();
  const userOrders = orders.filter((item) => item.userId === userId);
  const copies = getOrderCopies();
  const userBadges = getUserBadges();
  const awarded = [];

  const uniqueRestaurants = new Set(userOrders.map((item) => item.restaurantId)).size;
  const totalOrders = userOrders.length;
  const detailedCount = userOrders.filter((item) => isDetailed(item.reviewReason)).length;
  const customCount = userOrders.filter((item) => normalize(item.customizationText).length > 0).length;
  const uniqueBobaShops = new Set(
    userOrders
      .filter((item) => {
        const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
        return restaurant && normalize(restaurant.category) === "boba";
      })
      .map((item) => item.restaurantId)
  ).size;

  const bobaCount = userOrders.filter((item) => normalize(item.customName).includes("boba")).length;
  const spicyCount = userOrders.filter((item) => {
    return normalize(item.customName).includes("spicy") || (item.tags || []).map(normalize).includes("spicy");
  }).length;
  const dessertCount = new Set(
    userOrders
      .filter((item) => {
        const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
        return restaurant && normalize(restaurant.category) === "dessert";
      })
      .map((item) => item.restaurantId)
  ).size;
  const ramenCount = userOrders.filter((item) => normalize(item.customName).includes("ramen")).length;

  const userOrderIds = new Set(userOrders.map((item) => item.id));
  const copiesOnUserOrders = copies.filter((item) => userOrderIds.has(item.orderId));
  const totalCopies = copiesOnUserOrders.length;
  const maxCopiesOnSingleOrder = Math.max(
    0,
    ...Array.from(
      copiesOnUserOrders.reduce((acc, item) => {
        acc.set(item.orderId, (acc.get(item.orderId) || 0) + 1);
        return acc;
      }, new Map()).values()
    )
  );

  const groupedByDay = new Map();
  userOrders.forEach((item) => {
    const day = item.createdAt.slice(0, 10);
    if (!groupedByDay.has(day)) groupedByDay.set(day, new Set());
    groupedByDay.get(day).add(item.restaurantId);
  });
  const speedReviewer = Array.from(groupedByDay.values()).some((set) => set.size >= 3);

  const pioneer = userOrders.some((item) => {
    const sameRestaurant = orders
      .filter((entry) => entry.restaurantId === item.restaurantId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return sameRestaurant[0] && sameRestaurant[0].id === item.id;
  });

  const hiddenGem = userOrders.some((item) => {
    const count = orders.filter((entry) => entry.restaurantId === item.restaurantId).length;
    return count < 5;
  });

  const nicheRestaurants = new Set(
    userOrders
      .filter((item) => {
        const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
        if (!restaurant || !restaurant.openedAt) return false;
        const opened = new Date(restaurant.openedAt).getTime();
        const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        return opened >= threeMonthsAgo;
      })
      .map((item) => item.restaurantId)
  ).size;

  const menuArchitect = userOrders.some((item) => {
    const top = getTopByRestaurant(item.restaurantId, 1)[0];
    return top && normalize(top.dishName) === normalize(item.customName);
  });

  const menuHacker = userOrders.some((item) => {
    if (!normalize(item.customizationText)) return false;
    return copies.some((copy) => copy.orderId === item.id);
  });

  const perfectPlate = userOrders.some((item) => {
    const sameDish = orders.filter(
      (entry) =>
        entry.restaurantId === item.restaurantId &&
        normalize(entry.customName) === normalize(item.customName)
    );
    if (sameDish.length < 3) return false;
    const avg = sameDish.reduce((sum, entry) => sum + entry.rating, 0) / sameDish.length;
    return avg >= 9;
  });

  if (totalOrders >= 1) grant(userId, "first_byte", userBadges, awarded);
  if (uniqueRestaurants >= 5) grant(userId, "local_explorer", userBadges, awarded);
  if (uniqueRestaurants >= 10) grant(userId, "food_pathfinder", userBadges, awarded);
  if (uniqueRestaurants >= 15) grant(userId, "city_sampler", userBadges, awarded);
  if (uniqueRestaurants >= 25) grant(userId, "flavor_cartographer", userBadges, awarded);
  if (uniqueRestaurants >= 50) grant(userId, "bay_area_foodie", userBadges, awarded);
  if (totalOrders >= 100) grant(userId, "bytelist_legend", userBadges, awarded);
  if (maxCopiesOnSingleOrder >= 5) grant(userId, "trend_starter", userBadges, awarded);
  if (totalCopies >= 10) grant(userId, "taste_influencer", userBadges, awarded);
  if (menuArchitect) grant(userId, "menu_architect", userBadges, awarded);
  if (totalCopies >= 25) grant(userId, "flavor_authority", userBadges, awarded);
  if (detailedCount >= 5) grant(userId, "food_critic", userBadges, awarded);
  if (detailedCount >= 10) grant(userId, "flavor_analyst", userBadges, awarded);
  if (detailedCount >= 25) grant(userId, "dish_philosopher", userBadges, awarded);
  if (bobaCount >= 5) grant(userId, "boba_connoisseur", userBadges, awarded);
  if (uniqueBobaShops >= 7) grant(userId, "boba_cartographer", userBadges, awarded);
  if (spicyCount >= 5) grant(userId, "spice_seeker", userBadges, awarded);
  if (dessertCount >= 5) grant(userId, "dessert_hunter", userBadges, awarded);
  if (ramenCount >= 5) grant(userId, "ramen_master", userBadges, awarded);
  if (nicheRestaurants >= 3) grant(userId, "niche_foodie", userBadges, awarded);
  if (menuHacker) grant(userId, "menu_hacker", userBadges, awarded);
  if (customCount >= 5) grant(userId, "flavor_scientist", userBadges, awarded);
  if (hiddenGem) grant(userId, "hidden_gem_hunter", userBadges, awarded);
  if (perfectPlate) grant(userId, "perfect_plate", userBadges, awarded);
  if (speedReviewer) grant(userId, "speed_reviewer", userBadges, awarded);
  if (pioneer) grant(userId, "bytelist_pioneer", userBadges, awarded);

  saveUserBadges(userBadges);
  updateStreak(userId);
  return awarded;
}

function updateStreak(userId) {
  const streaks = getUserStreaks();
  const orders = getOrders()
    .filter((item) => item.userId === userId)
    .map((item) => item.createdAt.slice(0, 10))
    .sort();
  const days = Array.from(new Set(orders));
  let current = 0;
  let longest = 0;
  let prev = null;
  days.forEach((day) => {
    if (!prev) {
      current = 1;
    } else {
      const delta = (new Date(day) - new Date(prev)) / (24 * 60 * 60 * 1000);
      current = delta === 1 ? current + 1 : 1;
    }
    if (current > longest) longest = current;
    prev = day;
  });

  const idx = streaks.findIndex((item) => item.userId === userId);
  const next = {
    userId,
    currentStreak: current,
    longestStreak: longest,
    lastActiveDate: days[days.length - 1] || null
  };
  if (idx >= 0) streaks[idx] = next;
  else streaks.push(next);
  saveUserStreaks(streaks);
}

export function getUserBadgeDetails(userId) {
  ensureBadgeCatalog();
  const catalog = getBadges();
  const userBadges = getUserBadges().filter((item) => item.userId === userId);
  return userBadges
    .map((item) => ({
      ...item,
      badge: catalog.find((entry) => entry.id === item.badgeId)
    }))
    .filter((item) => item.badge)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

export function getLeaderboard() {
  const users = getUsers();
  const orders = getVisibleOrders();
  const likes = getOrderLikes();
  const copies = getOrderCopies();
  return users
    .map((user) => {
      const userOrders = orders.filter((item) => item.userId === user.id);
      const ids = new Set(userOrders.map((item) => item.id));
      const likesReceived = likes.filter((item) => ids.has(item.orderId)).length;
      const copiesReceived = copies.filter((item) => ids.has(item.orderId)).length;
      return {
        userId: user.id,
        name: user.name,
        contributions: userOrders.length,
        likesReceived,
        copiesReceived,
        influenceScore: copiesReceived * 2 + likesReceived
      };
    })
    .sort((a, b) => b.influenceScore - a.influenceScore);
}

export function resolveBadgeNames(badgeIds) {
  const catalog = getBadges().length ? getBadges() : BADGE_DEFS;
  return (badgeIds || []).map((id) => {
    const match = catalog.find((item) => item.id === id);
    return match ? match.name : id;
  });
}
