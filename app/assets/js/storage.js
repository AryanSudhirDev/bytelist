export const KEYS = {
  initialized: "bytelist_initialized",
  nearbySynced: "bytelist_nearby_synced",
  currentUserId: "bytelist_current_user_id",
  clerkPublishableKey: "bytelist_clerk_publishable_key",
  users: "bytelist_users",
  restaurants: "bytelist_restaurants",
  orders: "bytelist_orders",
  orderLikes: "bytelist_order_likes",
  orderCopies: "bytelist_order_copies",
  badges: "bytelist_badges",
  userBadges: "bytelist_user_badges",
  userStreaks: "bytelist_user_streaks",
  surveyResponses: "bytelist_survey_responses",
  flags: "bytelist_flags"
};

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function readList(key) {
  return safeParse(localStorage.getItem(key), []);
}

export function writeList(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function readValue(key, fallback = null) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw;
}

export function writeValue(key, value) {
  localStorage.setItem(key, String(value));
}

export function getCurrentUserId() {
  return readValue(KEYS.currentUserId, "u1");
}

export function setCurrentUserId(userId) {
  writeValue(KEYS.currentUserId, userId);
}

export function getUsers() {
  return readList(KEYS.users);
}

export function upsertUser(user) {
  const users = getUsers();
  const idx = users.findIndex((item) => item.id === user.id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...user };
  } else {
    users.push(user);
  }
  writeList(KEYS.users, users);
}

export function updateUserName(userId, name) {
  const clean = String(name || "").trim();
  if (!clean) return false;
  const users = getUsers();
  const idx = users.findIndex((item) => item.id === userId);
  if (idx < 0) return false;
  users[idx] = { ...users[idx], name: clean };
  writeList(KEYS.users, users);
  return true;
}

export function getRestaurants() {
  return readList(KEYS.restaurants);
}

export function saveRestaurants(items) {
  writeList(KEYS.restaurants, items);
}

export function getOrders() {
  return readList(KEYS.orders);
}

export function getOrderLikes() {
  return readList(KEYS.orderLikes);
}

export function getOrderCopies() {
  return readList(KEYS.orderCopies);
}

export function getBadges() {
  return readList(KEYS.badges);
}

export function getUserBadges() {
  return readList(KEYS.userBadges);
}

export function getUserStreaks() {
  return readList(KEYS.userStreaks);
}

export function getSurveyResponses() {
  return readList(KEYS.surveyResponses);
}

export function getFlags() {
  return readList(KEYS.flags);
}

export function saveOrders(items) {
  writeList(KEYS.orders, items);
}

export function saveOrderLikes(items) {
  writeList(KEYS.orderLikes, items);
}

export function saveOrderCopies(items) {
  writeList(KEYS.orderCopies, items);
}

export function saveBadges(items) {
  writeList(KEYS.badges, items);
}

export function saveUserBadges(items) {
  writeList(KEYS.userBadges, items);
}

export function saveUserStreaks(items) {
  writeList(KEYS.userStreaks, items);
}

export function saveSurveyResponses(items) {
  writeList(KEYS.surveyResponses, items);
}

export function saveFlags(items) {
  writeList(KEYS.flags, items);
}

export async function initializeData() {
  if (readValue(KEYS.initialized) === "true") return;
  const response = await fetch("./data/seed.json");
  const seed = await response.json();
  writeList(KEYS.users, seed.users || []);
  writeList(KEYS.restaurants, seed.restaurants || []);
  writeList(KEYS.orders, seed.orders || []);
  writeList(KEYS.orderLikes, seed.orderLikes || []);
  writeList(KEYS.orderCopies, seed.orderCopies || []);
  writeList(KEYS.surveyResponses, seed.surveyResponses || []);
  writeList(KEYS.flags, seed.flags || []);
  writeList(KEYS.badges, []);
  writeList(KEYS.userBadges, []);
  writeList(KEYS.userStreaks, []);
  writeValue(KEYS.currentUserId, (seed.users && seed.users[0] && seed.users[0].id) || "u1");
  writeValue(KEYS.initialized, "true");
}

export async function syncNearbyRestaurants() {
  if (readValue(KEYS.nearbySynced) === "true") return;
  try {
    const response = await fetch("./data/msj_nearby_places.json");
    const payload = await response.json();
    const places = payload.places || [];
    if (!places.length) return;

    const current = getRestaurants();
    const byId = new Map(current.map((item) => [item.id, item]));
    places.forEach((place) => {
      const id = place.id || `${place.name}-${place.lat}-${place.lon}`;
      if (byId.has(id)) return;
      byId.set(id, {
        id,
        name: place.name || "Unknown",
        category: place.category || place.cuisine || "food",
        location: place.location || "Near Mission San Jose",
        openedAt: place.openedAt || null
      });
    });
    saveRestaurants(Array.from(byId.values()));
    writeValue(KEYS.nearbySynced, "true");
  } catch {
  }
}

export function healCorruptStorage() {
  const arrayKeys = [
    KEYS.users,
    KEYS.restaurants,
    KEYS.orders,
    KEYS.orderLikes,
    KEYS.orderCopies,
    KEYS.badges,
    KEYS.userBadges,
    KEYS.userStreaks,
    KEYS.surveyResponses,
    KEYS.flags
  ];
  arrayKeys.forEach((key) => {
    const data = safeParse(localStorage.getItem(key), null);
    if (!Array.isArray(data)) {
      writeList(key, []);
    }
  });
}
