import {
  initializeData,
  healCorruptStorage,
  getCurrentUserId,
  getRestaurants,
  getUsers,
  updateUserName,
  syncNearbyRestaurants,
  getOrderLikes,
  getOrderCopies
} from "./storage.js";
import { initClerk, getSignedInUser, onClerkAuthChange, setClerkPublishableKey, getClerkPublishableKey, getLastClerkInitError } from "./auth.js";
import {
  createOrder,
  getTopOverall,
  getTopByRestaurant,
  getVisibleOrders,
  getProfileStats,
  toggleLike,
  copyOrder
} from "./orders.js";
import { searchRestaurants, globalSearch } from "./search.js";
import { evaluateBadgesForUser, getUserBadgeDetails, getLeaderboard, resolveBadgeNames, BADGE_DEFS } from "./gamification.js";
import { getPersonalizedRankings, filterByDietaryTag } from "./personalization.js";
import { flagOrder, sanitizeText } from "./moderation.js";

function byId(id) {
  return document.getElementById(id);
}

function params() {
  return new URLSearchParams(window.location.search);
}

function nav() {
  return `
    <header>
      <nav class="nav">
        <div class="nav-left">
          <a href="./index.html">Home</a>
          <a href="./restaurants.html">Restaurants</a>
          <a href="./add-order.html">Add Order</a>
          <a href="./leaderboard.html">Leaderboard</a>
          <a href="./profile.html">Profile</a>
        </div>
        <div class="nav-right">
          <span id="authStatus" class="muted"></span>
        </div>
      </nav>
    </header>
  `;
}

function renderOrderList(target, orders, restaurants) {
  if (!target) return;
  target.innerHTML = orders
    .map((item) => {
      const restaurant = restaurants.find((entry) => entry.id === item.restaurantId);
      return `
        <li>
          <strong>${item.dishName}</strong> <span class="pill">${restaurant ? restaurant.name : "Unknown"}</span>
          <div class="muted">score ${item.score} | avg ${item.avgRating}/10 | samples ${item.count}</div>
        </li>
      `;
    })
    .join("");
}

function formatShortDate(isoString) {
  if (!isoString) return "N/A";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function ratingStars(value) {
  const rounded = Math.max(0, Math.min(5, Math.round(value / 2)));
  return "★".repeat(rounded) + "☆".repeat(5 - rounded);
}

function scoreTone(rank) {
  if (rank === 1) return "score-top";
  if (rank === 2) return "score-mid";
  return "score-low";
}

function spiceLabelFromDish(name, tags = []) {
  const low = String(name || "").toLowerCase();
  const t = tags.map((item) => String(item).toLowerCase());
  if (t.includes("spicy") || low.includes("spicy") || low.includes("hot")) return "Spice: Medium";
  if (low.includes("mild")) return "Spice: Mild";
  return "Spice: None";
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderHome() {
  renderAuthPage();
  const signedIn = !!getSignedInUser();
  const linksCard = byId("postAuthLinks");
  if (linksCard) {
    linksCard.style.display = signedIn ? "block" : "none";
  }
}

function ensureSignedIn() {
  const user = getSignedInUser();
  if (!user) {
    window.alert("Sign in first on the Home page.");
    window.location.href = "./index.html";
    return false;
  }
  return true;
}

async function renderRestaurantsPage() {
  const list = byId("restaurantsList");
  const radiusEl = byId("radiusFilter");
  const searchEl = byId("restaurantSearch");
  const datasetMeta = byId("datasetMeta");
  const resultsCount = byId("resultsCount");

  let places = [];
  let generatedAt = null;
  try {
    const response = await fetch("./data/msj_nearby_places.json");
    const payload = await response.json();
    places = payload.places || [];
    generatedAt = payload.generatedAt;
    datasetMeta.textContent = `Loaded ${places.length} scraped places near Mission San Jose High School.`;
  } catch {
    const fallback = searchRestaurants("");
    list.innerHTML = fallback
      .map((r) => `<li><a href="./restaurant.html?id=${r.id}">${escapeHtml(r.name)}</a> <span class="pill">${escapeHtml(r.category)}</span></li>`)
      .join("");
    datasetMeta.textContent = "Nearby scraped dataset unavailable. Showing local seeded data only.";
    return;
  }

  const render = () => {
    const radius = Number(radiusEl?.value || 15);
    const query = String(searchEl?.value || "").trim().toLowerCase();
    const filtered = places.filter((p) => {
      if (p.distanceMiles > radius) return false;
      if (!query) return true;
      const haystack = `${p.name} ${p.category} ${p.cuisine || ""} ${p.location || ""}`.toLowerCase();
      return haystack.includes(query);
    });

    const limited = filtered.slice(0, 350);
    list.innerHTML = limited
      .map((r) => {
        const menu = Array.isArray(r.menuOptions) ? r.menuOptions.slice(0, 8) : [];
        const menuText = menu.length ? menu.map((m) => `<span class="pill">${escapeHtml(m)}</span>`).join(" ") : `<span class="muted">No menu options found</span>`;
        const website = r.website ? `<a href="${escapeHtml(r.website)}" target="_blank" rel="noopener noreferrer">Website</a>` : "";
        const menuUrl = r.menuUrl ? `<a href="${escapeHtml(r.menuUrl)}" target="_blank" rel="noopener noreferrer">Menu</a>` : "";
        return `<li>
          <div><strong><a href="./restaurant.html?id=${encodeURIComponent(r.id)}">${escapeHtml(r.name)}</a></strong> <span class="pill">${escapeHtml(r.category)}</span> <span class="pill">${escapeHtml(r.cuisine || "food")}</span></div>
          <div class="muted">${escapeHtml(r.distanceMiles)} mi - ${escapeHtml(r.location || "Near Mission San Jose")}</div>
          <div style="margin-top:6px;">${menuText}</div>
          <div class="muted" style="margin-top:6px;">${website}${website && menuUrl ? " | " : ""}${menuUrl}</div>
        </li>`;
      })
      .join("");
    resultsCount.textContent = `Showing ${limited.length} of ${filtered.length} places in ${radius}-mile radius.`;
    if (generatedAt) {
      datasetMeta.textContent = `Loaded ${places.length} scraped places near Mission San Jose High School.`;
    }
  };
  render();
  radiusEl?.addEventListener("change", render);
  searchEl?.addEventListener("input", render);
}

function renderRestaurantPage() {
  const restaurantId = params().get("id");
  const restaurants = getRestaurants();
  const restaurant = restaurants.find((r) => r.id === restaurantId);
  if (!restaurant) return;
  byId("restaurantTitle").textContent = restaurant.name;
  byId("restaurantMeta").textContent = `${restaurant.category} - ${restaurant.location}`;
  byId("restaurantLabel").textContent = String(restaurant.name || "Restaurant").toUpperCase();
  const ranked = getTopByRestaurant(restaurant.id, 1);
  const allForRestaurant = getVisibleOrders().filter((item) => item.restaurantId === restaurant.id);
  const rankedRows = ranked
    .map((dish, idx) => {
      const dishOrders = allForRestaurant.filter((o) => o.customName.toLowerCase() === dish.dishName.toLowerCase());
      const latest = [...dishOrders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const tags = dishOrders.flatMap((o) => o.tags || []);
      const quote = latest?.reviewReason ? latest.reviewReason.slice(0, 95) : "No review quote yet.";
      const isDim = idx + 1 >= 3 ? "is-dim" : "";
      const trending = dish.count >= 3 ? "Trending" : "Orders";
      const newTag = latest && Date.now() - new Date(latest.createdAt).getTime() <= 14 * 24 * 60 * 60 * 1000;
      const scoreClass = scoreTone(idx + 1);
      return `
        <li class="dish-row">
          <div class="dish-left">
            <div class="dish-main-line">
              <span class="rank-number ${isDim}">#${idx + 1}</span>
              <span class="dish-name ${isDim}">${escapeHtml(dish.dishName)}</span>
            </div>
            <div class="review-quote">"${escapeHtml(quote)}"</div>
            <div class="meta-line">
              last ordered ${formatShortDate(latest?.createdAt)} · ${dish.count} reviews · <span class="verified">Verified</span>
            </div>
            <div class="tag-row">
              <span class="tag-pill tag-spice">${escapeHtml(spiceLabelFromDish(dish.dishName, tags))}</span>
              <span class="tag-pill tag-price">Price: $$</span>
              <span class="tag-pill tag-trending">${escapeHtml(trending)}</span>
              ${newTag ? '<span class="tag-pill tag-new">New</span>' : ""}
            </div>
          </div>
          <div class="dish-right">
            <div class="stars-line">${ratingStars(dish.avgRating)}</div>
            <div class="score-number ${scoreClass}">${dish.avgRating.toFixed(1)}</div>
            <div class="review-count">${dish.count} reviews</div>
          </div>
        </li>
      `;
    })
    .join("");
  byId("restaurantOrders").innerHTML = rankedRows || '<li class="dish-row"><div class="dish-left"><div class="dish-name">No ranked dishes yet.</div></div></li>';

  const currentUserId = getCurrentUserId();
  const likes = getOrderLikes();
  const copies = getOrderCopies();
  const orders = allForRestaurant;
  byId("feed").innerHTML = orders
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((order) => {
      const likeCount = likes.filter((entry) => entry.orderId === order.id).length;
      const copyCount = copies.filter((entry) => entry.orderId === order.id).length;
      const likedByMe = likes.some((entry) => entry.orderId === order.id && entry.userId === currentUserId);
      return `
        <div class="card">
          <strong>${order.customName}</strong> <span class="pill">${order.rating}/10</span>
          <p>${order.reviewReason}</p>
          <div class="muted">${order.customizationText || "No customization"}</div>
          <div class="muted">Likes: ${likeCount} | Copies: ${copyCount}</div>
          <div style="margin-top:8px;display:flex;gap:8px;">
            <button class="secondary js-like" data-id="${order.id}">${likedByMe ? "Unlike" : "Like"}</button>
            <button class="secondary js-copy" data-id="${order.id}">Copy</button>
            <button class="secondary js-flag" data-id="${order.id}">Flag</button>
          </div>
        </div>
      `;
    })
    .join("");

  const feed = byId("feed");
  if (!feed || feed.dataset.bound === "true") return;
  feed.dataset.bound = "true";
  feed.addEventListener("click", (event) => {
    if (!ensureSignedIn()) return;
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.id;
    const userId = getCurrentUserId();
    if (target.classList.contains("js-like")) toggleLike(id, userId);
    if (target.classList.contains("js-copy")) copyOrder(id, userId);
    if (target.classList.contains("js-flag")) {
      const reason = window.prompt("Reason for flag?");
      if (reason) flagOrder(id, reason, userId);
    }
    const awarded = evaluateBadgesForUser(userId);
    const awardNames = resolveBadgeNames(awarded);
    byId("actionStatus").textContent = awarded.length
      ? `Action saved. New badges: ${awardNames.join(", ")}`
      : "Action saved.";
    const updatedLikes = getOrderLikes();
    const updatedCopies = getOrderCopies();
    const likesForOrder = updatedLikes.filter((entry) => entry.orderId === id).length;
    const copiesForOrder = updatedCopies.filter((entry) => entry.orderId === id).length;
    const card = target.closest(".card");
    if (card) {
      const statsEl = card.querySelector(".muted:nth-of-type(2)");
      if (statsEl) statsEl.textContent = `Likes: ${likesForOrder} | Copies: ${copiesForOrder}`;
      const likeBtn = card.querySelector(".js-like");
      if (likeBtn && likeBtn instanceof HTMLButtonElement) {
        const isLiked = updatedLikes.some((entry) => entry.orderId === id && entry.userId === userId);
        likeBtn.textContent = isLiked ? "Unlike" : "Like";
      }
    }
  });

  const quickDishInput = byId("quickDishInput");
  const quickLogBtn = byId("quickLogBtn");
  if (quickLogBtn && quickDishInput && quickLogBtn.dataset.bound !== "true") {
    quickLogBtn.dataset.bound = "true";
    quickLogBtn.addEventListener("click", () => {
      const dish = encodeURIComponent(String(quickDishInput.value || "").trim());
      window.location.href = `./add-order.html?restaurantId=${encodeURIComponent(restaurant.id)}${dish ? `&dish=${dish}` : ""}`;
    });
  }
}

function renderAddOrderPage() {
  const restaurants = getRestaurants();
  const select = byId("restaurantId");
  select.innerHTML = restaurants.map((r) => `<option value="${r.id}">${r.name}</option>`).join("");
  const defaultRestaurantId = params().get("restaurantId");
  const defaultDish = params().get("dish");
  if (defaultRestaurantId) select.value = defaultRestaurantId;
  if (defaultDish) byId("customName").value = defaultDish;
  byId("orderForm")?.addEventListener("submit", (event) => {
    if (!ensureSignedIn()) return;
    event.preventDefault();
    const form = new FormData(event.target);
    const tags = String(form.get("tags") || "")
      .split(",")
      .map((item) => sanitizeText(item).toLowerCase())
      .filter(Boolean);
    const result = createOrder(
      {
        restaurantId: form.get("restaurantId"),
        customName: form.get("customName"),
        customizationText: form.get("customizationText"),
        reviewReason: form.get("reviewReason"),
        rating: Number(form.get("rating")),
        tags
      },
      getCurrentUserId()
    );
    if (!result.ok) {
      byId("formStatus").innerHTML = `<div class="error">${result.errors.join("<br>")}</div>`;
      return;
    }
    const awarded = evaluateBadgesForUser(getCurrentUserId());
    const awardNames = resolveBadgeNames(awarded);
    byId("formStatus").innerHTML = `<div class="success">Order saved.${awarded.length ? ` New badges: ${awardNames.join(", ")}` : ""}</div>`;
    event.target.reset();
  });
}

function renderLeaderboardPage() {
  if (!ensureSignedIn()) return;
  const rows = getLeaderboard();
  const medals = ["🥇", "🥈", "🥉"];
  byId("leaderboardList").innerHTML = rows
    .map(
      (row, idx) => `
      <li class="leaderboard-row">
        <div class="leader-left">
          <span class="leader-rank">${medals[idx] || `#${idx + 1}`}</span>
          <div>
            <strong>${row.name}</strong>
            <div class="muted">orders: ${row.contributions}, likes: ${row.likesReceived}, copies: ${row.copiesReceived}</div>
          </div>
        </div>
        <div class="leader-score">${row.influenceScore}</div>
      </li>`
    )
    .join("");
}

function renderProfilePage() {
  if (!ensureSignedIn()) return;
  const userId = getCurrentUserId();
  const users = getUsers();
  const user = users.find((item) => item.id === userId);
  const stats = getProfileStats(userId);
  byId("profileName").textContent = user ? user.name : userId;
  byId("profileStats").innerHTML = `
    <div class="pill">Orders: ${stats.totalOrders}</div>
    <div class="pill">Avg rating: ${stats.averageRating}</div>
    <div class="pill">Unique places: ${stats.uniqueRestaurants}</div>
  `;
  byId("recentOrders").innerHTML = stats.recent
    .map((order) => `<li>${order.customName} (${order.rating}/10)</li>`)
    .join("");

  const badges = getUserBadgeDetails(userId);
  const earnedIds = new Set(badges.map((item) => item.badge.id));
  byId("badgesSummary").textContent = `Unlocked ${badges.length} of ${BADGE_DEFS.length} awards`;
  byId("badges").innerHTML = badges
    .map((item) => `
      <div class="badge-card earned">
        <div class="badge-icon">${item.badge.icon || "🏅"}</div>
        <div>
          <div class="badge-title">${item.badge.name}</div>
          <div class="badge-meta">${item.badge.group}</div>
          <div class="badge-desc">${item.badge.description || ""}</div>
        </div>
      </div>
    `)
    .join("") || '<div class="badge-card locked"><div class="badge-icon">🔒</div><div><div class="badge-title">No badges yet</div><div class="badge-desc">Post your first order to unlock your first award.</div></div></div>';
  byId("allBadges").innerHTML = BADGE_DEFS
    .map((badge) => `
      <div class="badge-card ${earnedIds.has(badge.id) ? "earned" : "locked"}">
        <div class="badge-icon">${badge.icon || "🏅"}</div>
        <div>
          <div class="badge-title">${badge.name}</div>
          <div class="badge-meta">${badge.group}</div>
          <div class="badge-desc">${badge.description || ""}</div>
        </div>
      </div>
    `)
    .join("");

  const allOrders = getVisibleOrders().filter((item) => item.userId === userId);
  const topDish = allOrders.reduce((acc, item) => {
    const key = item.customName.toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const favoriteDish = Object.entries(topDish).sort((a, b) => b[1] - a[1])[0];
  const avg = stats.averageRating;
  byId("wrapped").innerHTML = `
    <li>Total orders this period: ${stats.totalOrders}</li>
    <li>Favorite repeat dish: ${favoriteDish ? `${favoriteDish[0]} (${favoriteDish[1]} times)` : "N/A"}</li>
    <li>Average rating given: ${avg}/10</li>
    <li>Unique restaurants tried: ${stats.uniqueRestaurants}</li>
    <li>Badges earned: ${badges.length}</li>
  `;

  const personalized = filterByDietaryTag(getPersonalizedRankings(userId, 1), byId("dietaryFilter").value);
  renderOrderList(byId("personalized"), personalized.slice(0, 10), getRestaurants());
  byId("dietaryFilter")?.addEventListener("change", (event) => {
    const filtered = filterByDietaryTag(getPersonalizedRankings(userId, 1), event.target.value);
    renderOrderList(byId("personalized"), filtered.slice(0, 10), getRestaurants());
  });

  const nameInput = byId("displayNameInput");
  const nameStatus = byId("displayNameStatus");
  if (nameInput) nameInput.value = user?.name || "";
  byId("displayNameForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!ensureSignedIn()) return;
    const nextName = String(nameInput?.value || "").trim();
    if (!nextName) {
      if (nameStatus) nameStatus.textContent = "Name cannot be empty.";
      return;
    }
    const ok = updateUserName(userId, nextName);
    const clerkUser = getSignedInUser();
    if (clerkUser?.update) {
      try {
        await clerkUser.update({ firstName: nextName });
      } catch {
      }
    }
    if (nameStatus) nameStatus.textContent = ok ? "Display name updated." : "Could not update name.";
    byId("profileName").textContent = nextName;
  });
}

function renderAuthStatus() {
  const el = byId("authStatus");
  if (!el) return;
  const user = getSignedInUser();
  if (user) {
    const email = user.primaryEmailAddress?.emailAddress || user.id;
    el.textContent = `Signed in: ${email}`;
  } else if (getClerkPublishableKey()) {
    el.textContent = "Not signed in";
  } else {
    el.textContent = "Clerk not configured";
  }
}

function renderAuthPage() {
  const keyInput = byId("clerkPublishableKey");
  const keyConfigCard = byId("keyConfigCard");
  const saved = getClerkPublishableKey();
  if (keyInput) keyInput.value = saved;
  if (keyConfigCard && saved && saved.startsWith("pk_")) {
    keyConfigCard.style.display = "none";
  }

  byId("saveKeyForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setClerkPublishableKey(keyInput.value);
    byId("authMessage").textContent = "Saved key. Reloading Clerk...";
    try {
      const result = await initClerk();
      if (!result.ready) {
        byId("authMessage").textContent = "Unable to initialize Clerk. Verify publishable key.";
        return;
      }
      window.location.reload();
    } catch {
      byId("authMessage").textContent = "Failed to initialize Clerk.";
    }
  });

  const user = getSignedInUser();
  if (!window.Clerk || !getClerkPublishableKey()) {
    const runtime = byId("authRuntimeMessage");
    if (runtime) runtime.textContent = getLastClerkInitError() || "Clerk is not initialized.";
    return;
  }

  const signInNode = byId("clerkSignIn");
  const userNode = byId("clerkUser");
  const runtime = byId("authRuntimeMessage");
  if (runtime) runtime.textContent = "";
  if (!signInNode || !userNode) return;

  if (typeof window.Clerk.mountSignIn !== "function") {
    if (runtime) runtime.textContent = "Clerk widgets failed to load. Check allowed origins in Clerk dashboard for localhost.";
    return;
  }

  if (user) {
    signInNode.innerHTML = "";
    window.Clerk.mountUserButton(userNode);
  } else {
    userNode.innerHTML = "";
    window.Clerk.mountSignIn(signInNode);
  }
}

async function boot() {
  document.body.insertAdjacentHTML("afterbegin", nav());
  await initializeData();
  await syncNearbyRestaurants();
  healCorruptStorage();
  await initClerk().catch(() => null);
  onClerkAuthChange(() => {
    renderAuthStatus();
  });
  renderAuthStatus();
  const page = document.body.dataset.page;
  if (page === "auth") {
    window.location.replace("./index.html");
    return;
  }
  if (page === "home") renderHome();
  if (page === "restaurants") await renderRestaurantsPage();
  if (page === "restaurant") renderRestaurantPage();
  if (page === "add-order") renderAddOrderPage();
  if (page === "leaderboard") renderLeaderboardPage();
  if (page === "profile") renderProfilePage();
}

boot();
