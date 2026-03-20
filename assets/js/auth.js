import {
  KEYS,
  readValue,
  writeValue,
  setCurrentUserId,
  upsertUser
} from "./storage.js";

const CLERK_JS_URLS = [
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js",
  "https://unpkg.com/@clerk/clerk-js@5/dist/clerk.browser.js",
  "https://cdn.jsdelivr.net/npm/@clerk/clerk-js@latest/dist/clerk.browser.js",
  "https://unpkg.com/@clerk/clerk-js@latest/dist/clerk.browser.js"
];
const DEFAULT_CLERK_PUBLISHABLE_KEY = "pk_test_cm9tYW50aWMtYnV6emFyZC04LmNsZXJrLmFjY291bnRzLmRldiQ";
let lastInitError = "";

function loadScript(src, publishableKey) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`);
    if (existing) {
      if (window.Clerk) {
        resolve();
        return;
      }
      existing.remove();
    }

    if (publishableKey) {
      // Some Clerk browser bundles read one of these globals during script execution.
      window.CLERK_PUBLISHABLE_KEY = publishableKey;
      window.__clerk_publishable_key = publishableKey;
      window.__clerk_frontend_api = publishableKey;
      window.__clerk_env = { publishableKey };
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    if (publishableKey) {
      script.setAttribute("data-clerk-publishable-key", publishableKey);
    }
    script.addEventListener("load", () => {
      if (!window.Clerk) {
        reject(new Error(`Loaded but window.Clerk missing: ${src}`));
        return;
      }
      resolve();
    }, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.appendChild(script);
  });
}

async function loadClerkFromAnyCdn(publishableKey) {
  const errors = [];
  for (const src of CLERK_JS_URLS) {
    try {
      await loadScript(src, publishableKey);
      if (window.Clerk) return { ok: true, src };
      errors.push(`${src} loaded but window.Clerk missing`);
    } catch (error) {
      errors.push(`${src} -> ${error?.message || "load error"}`);
    }
  }
  return { ok: false, errors };
}

export function getClerkPublishableKey() {
  return readValue(KEYS.clerkPublishableKey, DEFAULT_CLERK_PUBLISHABLE_KEY);
}

export function setClerkPublishableKey(value) {
  writeValue(KEYS.clerkPublishableKey, String(value || "").trim());
}

function normalizeClerkUser(user) {
  const email = user?.primaryEmailAddress?.emailAddress || "";
  return {
    id: user.id,
    name: user.firstName || user.fullName || email || `User ${user.id.slice(0, 8)}`,
    email,
    dietaryPrefs: []
  };
}

export async function initClerk() {
  const publishableKey = getClerkPublishableKey();
  if (!publishableKey) {
    lastInitError = "Missing publishable key.";
    return { ready: false, reason: "missing_publishable_key" };
  }
  const scriptResult = await loadClerkFromAnyCdn(publishableKey);
  if (!scriptResult.ok || !window.Clerk) {
    lastInitError = `Clerk SDK script failed to load. ${scriptResult.errors?.join(" | ") || ""}`;
    return { ready: false, reason: "sdk_load_failed" };
  }

  let clerk = window.Clerk;
  try {
    if (typeof window.Clerk === "function") {
      clerk = new window.Clerk(publishableKey);
      await clerk.load();
      window.Clerk = clerk;
    } else {
      try {
        await clerk.load({ publishableKey });
      } catch {
        clerk.publishableKey = publishableKey;
        await clerk.load();
      }
    }
  } catch (error) {
    lastInitError = `Clerk init failed: ${error?.message || "unknown error"}`;
    return { ready: false, reason: "load_failed", error: lastInitError };
  }
  lastInitError = "";

  if (clerk.user) {
    const localUser = normalizeClerkUser(clerk.user);
    upsertUser(localUser);
    setCurrentUserId(localUser.id);
  }
  return { ready: true, clerk };
}

export function getLastClerkInitError() {
  return lastInitError;
}

export function getSignedInUser() {
  if (!window.Clerk) return null;
  return window.Clerk.user || null;
}

export function onClerkAuthChange(callback) {
  if (!window.Clerk) return;
  window.Clerk.addListener((resources) => {
    const user = resources.user || null;
    if (user) {
      const localUser = normalizeClerkUser(user);
      upsertUser(localUser);
      setCurrentUserId(localUser.id);
      callback(localUser);
    } else {
      callback(null);
    }
  });
}
