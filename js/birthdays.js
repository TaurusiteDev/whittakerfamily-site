import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCiuOgFy03gCcjZq9bQtSuROboGC73Epg",
  authDomain: "whittaker-family-site.firebaseapp.com",
  projectId: "whittaker-family-site",
  storageBucket: "whittaker-family-site.firebasestorage.app",
  messagingSenderId: "877721052023",
  appId: "1:877721052023:web:7389de5342ec421a147772"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const mount = document.getElementById("upcoming-birthdays");

// Only show birthdays coming up in the next N days
const WINDOW_DAYS = 30;

// Fallback display names (used if Firestore name is missing / only first name)
const DISPLAY_NAME_OVERRIDES = {
  // Whittaker kids
  joe: "Joe Whittaker",
  lewis: "Lewis Whittaker",
  charley: "Charley Whittaker",
  harrisson: "Harrisson Whittaker",
  finley: "Finley Whittaker",

  // Stanley kids
  oliver: "Oliver Stanley",
  jacob: "Jacob Stanley"
};

function nextBirthdayDate(md) {
  if (!md || typeof md !== "string") return null;

  const parts = md.split("-");
  if (parts.length !== 2) return null;

  const mm = Number(parts[0]);
  const dd = Number(parts[1]);
  if (!mm || !dd) return null;

  const now = new Date();
  const y = now.getFullYear();

  const candidate = new Date(y, mm - 1, dd);
  candidate.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // If birthday already passed this year, use next year
  if (candidate < today) return new Date(y + 1, mm - 1, dd);
  return candidate;
}

function daysUntil(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = date.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatPretty(date) {
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function normalizeName(id, firestoreName) {
  const n = (firestoreName || "").trim();

  // Prefer override map if name is missing or looks like only a first name
  if (!n || !n.includes(" ")) {
    return DISPLAY_NAME_OVERRIDES[id] || n || id;
  }
  return n;
}

async function run() {
  if (!mount) return;

  try {
    const snap = await getDocs(collection(db, "familyMembers"));

    const list = [];
    snap.forEach((d) => {
      const data = d.data();
      if (!data?.birthday) return;

      const next = nextBirthdayDate(data.birthday);
      if (!next) return;

      const inDays = daysUntil(next);

      // Only show birthdays within the next WINDOW_DAYS days (including today)
      if (inDays < 0 || inDays > WINDOW_DAYS) return;

      list.push({
        id: d.id,
        name: normalizeName(d.id, data.name),
        next,
        inDays
      });
    });

    list.sort((a, b) => a.inDays - b.inDays);

    if (!list.length) {
      mount.textContent = `No birthdays in the next ${WINDOW_DAYS} days.`;
      return;
    }

    mount.innerHTML = `
      <div class="birthday-list">
        ${list.map(item => `
          <div class="birthday-item ${item.inDays === 0 ? "today" : ""}">
            <span>${item.name}</span>
            <span>${item.inDays === 0 ? "Today! 🎉" : `${formatPretty(item.next)} (in ${item.inDays} days)`}</span>
          </div>
        `).join("")}
      </div>
    `;
  } catch (err) {
    console.error(err);
    mount.textContent = "Could not load birthdays.";
  }
}

run();
