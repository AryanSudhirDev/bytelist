import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  ARRAY_KEYS,
  writeList,
  runWithoutStorageSync,
  setStorageSyncHandler
} from "./storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7Ua4ebjDjZo9lyQiPkmxttqtK3yIutZY",
  authDomain: "bytelist-shared-aryan.firebaseapp.com",
  projectId: "bytelist-shared-aryan",
  storageBucket: "bytelist-shared-aryan.firebasestorage.app",
  messagingSenderId: "486593387587",
  appId: "1:486593387587:web:c858ea8993e11a7f8148f6"
};

const DOC_REF_PATH = ["appState", "global"];
const SHARED_ARRAY_KEYS = [...ARRAY_KEYS];
let db = null;
let syncReady = false;

function getDb() {
  if (db) return db;
  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

function buildLocalSnapshot() {
  const data = {};
  SHARED_ARRAY_KEYS.forEach((key) => {
    try {
      data[key] = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      data[key] = [];
    }
  });
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    data
  };
}

function applySnapshotToLocal(snapshot) {
  if (!snapshot || !snapshot.data) return false;
  runWithoutStorageSync(() => {
    const incoming = snapshot.data;
    SHARED_ARRAY_KEYS.forEach((key) => {
      if (!(key in incoming)) return;
      writeList(key, Array.isArray(incoming[key]) ? incoming[key] : []);
    });
  });
  return true;
}

async function pushLocalSnapshot() {
  if (!syncReady) return;
  const cloudDoc = doc(getDb(), ...DOC_REF_PATH);
  await setDoc(cloudDoc, buildLocalSnapshot(), { merge: true });
}

export async function initCloudSync() {
  try {
    const cloudDoc = doc(getDb(), ...DOC_REF_PATH);
    const snap = await getDoc(cloudDoc);
    if (snap.exists()) {
      applySnapshotToLocal(snap.data());
    } else {
      await setDoc(cloudDoc, buildLocalSnapshot(), { merge: true });
    }
    syncReady = true;
    setStorageSyncHandler(pushLocalSnapshot);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || "cloud_sync_failed" };
  }
}
