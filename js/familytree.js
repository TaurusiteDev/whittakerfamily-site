// ===============================
// Firebase Imports
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";
import {
  getFirestore,
  collection,
  getDocs,
  setDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

// ===============================
// Firebase Config (same as gallery)
// ===============================
const firebaseConfig = {
  apiKey: "AIzaSyCCiuOgFy03gCcjZq9bQtSuROboGC73Epg",
  authDomain: "whittaker-family-site.firebaseapp.com",
  projectId: "whittaker-family-site",
  storageBucket: "whittaker-family-site.firebasestorage.app",
  messagingSenderId: "877721052023",
  appId: "1:877721052023:web:7389de5342ec421a147772"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const db = getFirestore(app);

// ===============================
// Admin Lock
// ===============================
const ADMIN_PASSWORD = "1234";
let adminUnlocked = false;

const adminBtn = document.getElementById("family-admin-btn");

// ===============================
// Base Family Data (fallback)
// IMPORTANT: ids here must match the HTML data-person values
// ===============================
const BASE_FAMILY_DATA = {
  lesleyWhittaker: {
    name: "Lesley Whittaker",
    years: "–",
    relation: "Grandparent (Whittaker side)",
    notes: "Add favourite memories, personality, and stories here."
  },
  trevorWhittaker: {
    name: "Trevor Whittaker",
    years: "–",
    relation: "Grandparent (Whittaker side)",
    notes: "You can add details about their life, work, and family traditions."
  },

  
  larraineStanley: {
    name: "Larraine Stanley",
    years: "–",
    relation: "Grandparent (Stanley side)",
    notes: "Grandparent of Leanne and Matt. Add stories about Larraine and her side of the family."
  },

  lesStanley: {
    name: "Les Stanley",
    years: "–",
    relation: "Grandparent (Stanley side)",
    notes: "Grandparent of Leanne and Matt. Add memories and family history here."
  },

  markWhittaker: {
    name: "Mark Whittaker",
    years: "–",
    relation: "Parent of Joe, Lewis, Charley, Harrisson and Finley",
    notes: "Child of Lesley and Trevor. Add details about Mark’s life, career, and favourite family moments."
  },
  leanneWhittaker: {
    name: "Leanne Whittaker",
    years: "–",
    relation: "Parent of Joe, Lewis, Charley, Harrisson and Finley",
    notes: "Child of Larraine and Les. Add notes about Leanne and memories from both the Stanley and Whittaker sides."
  },

  matt: {
    name: "Matt Stanley",
    years: "–",
    relation: "Parent of Oliver and Jacob (Stanley branch)",
    notes: "Child of Larraine and Les. Add details about Matt and the Stanley family line here."
  },
  jen: {
    name: "Jen Stanley",
    years: "–",
    relation: "Parent of Oliver and Jacob (Stanley branch)",
    notes: "Add Jen’s story, hobbies, and favourite family memories."
  },

  joe: { name: "Joe Whittaker", years: "–", relation: "Child of Leanne and Mark", notes: "Add Joe’s personality, milestones, and favourite stories." },
  lewis: { name: "Lewis Whittaker", years: "–", relation: "Child of Leanne and Mark", notes: "Add notes about Lewis – hobbies, character, and memories." },
  charley: { name: "Charley Whittaker", years: "–", relation: "Child of Leanne and Mark", notes: "Add Charley’s story here, and any fun family anecdotes." },
  harrisson: { name: "Harrisson Whittaker", years: "–", relation: "Child of Leanne and Mark", notes: "Add details about Harrisson – personality, interests, and memories." },
  finley: { name: "Finley Whittaker", years: "–", relation: "Child of Leanne and Mark", notes: "Add Finley’s story and milestones here." },

  oliver: { name: "Oliver Stanley", years: "–", relation: "Child of Matt and Jen (Stanley branch)", notes: "Add Oliver’s details. You could also link this later to an album of Oliver’s photos." },
  jacob: { name: "Jacob Stanley", years: "–", relation: "Child of Matt and Jen (Stanley branch)", notes: "Add Jacob’s story, fun facts, and favourite memories." }
};

// This becomes: base data + anything saved in Firestore
const FAMILY_DATA = structuredClone(BASE_FAMILY_DATA);

// ===============================
// DOM Elements
// ===============================
const cards = document.querySelectorAll(".person-card");
const detailName = document.getElementById("detail-name");
const detailYears = document.getElementById("detail-years");
const detailRelation = document.getElementById("detail-relation");
const detailNotes = document.getElementById("detail-notes");
const detailNotesEditor = document.getElementById("detail-notes-editor");
const detailAvatar = document.getElementById("detail-avatar");

const editNotesBtn = document.getElementById("edit-notes-btn");
const changePhotoBtn = document.getElementById("change-photo-btn");
const detailPhotoInput = document.getElementById("detail-photo-input");

// Birthday UI (Option A)
const detailBirthday = document.getElementById("detail-birthday");
const birthdayEditWrap = document.querySelector(".detail-birthday-edit");
const birthdayMonthSelect = document.getElementById("birthday-month");
const birthdayDaySelect = document.getElementById("birthday-day");
const saveBirthdayBtn = document.getElementById("save-birthday-btn");

// State
let currentPersonId = null;

// Populate day dropdown (1–31)
if (birthdayDaySelect && birthdayDaySelect.options.length <= 1) {
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement("option");
    opt.value = String(d).padStart(2, "0");
    opt.textContent = String(d);
    birthdayDaySelect.appendChild(opt);
  }
}

// ===============================
// Admin toggle (FIXED)
// ===============================
adminBtn?.addEventListener("click", () => {
  if (!adminUnlocked) {
    const pwd = prompt("Enter admin password:");
    if (pwd !== ADMIN_PASSWORD) {
      alert("Incorrect password.");
      return;
    }
    adminUnlocked = true;
    adminBtn.textContent = "🔓";
    document.body.classList.add("admin-mode");
  } else {
    adminUnlocked = false;
    adminBtn.textContent = "🔒";
    document.body.classList.remove("admin-mode");
  }

  // If a person is already selected, update birthday editor visibility
  if (birthdayEditWrap) {
    birthdayEditWrap.style.display = adminUnlocked && currentPersonId ? "block" : "none";
  }
});

// ===============================
// Firestore: load saved member data
// ===============================
const familyCol = collection(db, "familyMembers");

async function loadFamilyData() {
  try {
    const snapshot = await getDocs(familyCol);
    snapshot.forEach((docSnap) => {
      const id = docSnap.id;
      const data = docSnap.data();
      if (!FAMILY_DATA[id]) FAMILY_DATA[id] = {};
      Object.assign(FAMILY_DATA[id], data);
    });

    applyAvatarsToCards();
  } catch (err) {
    console.error("Failed to load family data:", err);
  }
}

// ===============================
// Rendering helpers
// ===============================
function getAvatarUrlFor(id) {
  const d = FAMILY_DATA[id];
  if (d && d.imageUrl) return d.imageUrl;
  return "images/default-avatar.png";
}

function applyAvatarsToCards() {
  cards.forEach((card) => {
    const id = card.dataset.person;
    const img = card.querySelector(".person-avatar");
    if (!img) return;
    img.src = getAvatarUrlFor(id);
    img.alt = FAMILY_DATA[id]?.name || "Family member";
  });
}

function formatBirthday(md) {
  if (!md || typeof md !== "string") return "";
  const [mm, dd] = md.split("-").map(Number);
  if (!mm || !dd) return "";
  const d = new Date(2000, mm - 1, dd);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "long" });
}

function renderPersonDetail(id) {
  currentPersonId = id;
  const data = FAMILY_DATA[id] || {};

  detailName.textContent = data.name || "Unknown family member";
  detailYears.textContent = data.years || "";
  detailRelation.textContent = data.relation || "";
  detailNotes.textContent = data.notes || "No bio added yet. (Admin can edit this.)";

  detailAvatar.src = getAvatarUrlFor(id);
  detailAvatar.alt = data.name || "Family member";

  // Reset bio editor
  detailNotes.style.display = "block";
  detailNotesEditor.style.display = "none";
  detailNotesEditor.value = data.notes || "";
  editNotesBtn.textContent = "Edit bio";

  // Highlight selected card
  cards.forEach((c) => c.classList.remove("person-selected"));
  const selected = Array.from(cards).find((c) => c.dataset.person === id);
  selected?.classList.add("person-selected");

  // Birthday display
  if (detailBirthday) {
    const bday = data.birthday || "";
    detailBirthday.textContent = bday ? `Birthday: ${formatBirthday(bday)}` : "";
  }

  // Birthday editor: show only in admin mode
  if (birthdayEditWrap) {
    birthdayEditWrap.style.display = adminUnlocked ? "block" : "none";
  }

  // Set dropdown values
  if (birthdayMonthSelect && birthdayDaySelect) {
    if (data.birthday) {
      const [mm, dd] = data.birthday.split("-");
      birthdayMonthSelect.value = mm;
      birthdayDaySelect.value = dd;
    } else {
      birthdayMonthSelect.value = "";
      birthdayDaySelect.value = "";
    }
  }
}

// ===============================
// Events: clicking a person card
// ===============================
cards.forEach((card) => {
  card.addEventListener("click", () => {
    const id = card.dataset.person;
    if (!id) return;
    if (!FAMILY_DATA[id]) FAMILY_DATA[id] = BASE_FAMILY_DATA[id] || { name: id };
    renderPersonDetail(id);
  });
});

// ===============================
// Edit bio (notes) in admin mode
// ===============================
editNotesBtn?.addEventListener("click", async () => {
  if (!currentPersonId) {
    alert("Select a family member first.");
    return;
  }
  if (!adminUnlocked) {
    alert("Admin mode required.");
    return;
  }

  const editing = detailNotesEditor.style.display === "block";

  if (!editing) {
    // Enter edit mode
    detailNotesEditor.value = FAMILY_DATA[currentPersonId]?.notes || "";
    detailNotes.style.display = "none";
    detailNotesEditor.style.display = "block";
    editNotesBtn.textContent = "Save bio";
    return;
  }

  // Save
  const newNotes = detailNotesEditor.value.trim();

  try {
    await setDoc(
      doc(db, "familyMembers", currentPersonId),
      { notes: newNotes },
      { merge: true }
    );

    FAMILY_DATA[currentPersonId] = {
      ...FAMILY_DATA[currentPersonId],
      notes: newNotes
    };

    detailNotes.textContent = newNotes || "No bio added yet. (Admin can edit this.)";
    detailNotes.style.display = "block";
    detailNotesEditor.style.display = "none";
    editNotesBtn.textContent = "Edit bio";
  } catch (err) {
    console.error("Failed to save bio:", err);
    alert("Failed to save bio. Please try again.");
  }
});

// ===============================
// Change photo in admin mode
// ===============================
changePhotoBtn?.addEventListener("click", () => {
  if (!currentPersonId) {
    alert("Select a family member first.");
    return;
  }
  if (!adminUnlocked) {
    alert("Admin mode required.");
    return;
  }
  detailPhotoInput?.click();
});

detailPhotoInput?.addEventListener("change", async () => {
  const file = detailPhotoInput.files?.[0];
  if (!file || !currentPersonId) return;

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) {
    alert("Please upload a JPG, PNG or WEBP image.");
    detailPhotoInput.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert("Max file size is 5MB.");
    detailPhotoInput.value = "";
    return;
  }

  try {
    // Delete old image if any
    const oldPath = FAMILY_DATA[currentPersonId]?.imagePath;
    if (oldPath) {
      try {
        await deleteObject(ref(storage, oldPath));
      } catch (err) {
        console.warn("Failed to delete old image (probably fine):", err);
      }
    }

    // Store under gallery/familyTree/...
    const storagePath = `gallery/familyTree/${currentPersonId}-${Date.now()}-${file.name}`;
    const fileRef = ref(storage, storagePath);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);

    await setDoc(
      doc(db, "familyMembers", currentPersonId),
      { imageUrl: url, imagePath: storagePath },
      { merge: true }
    );

    FAMILY_DATA[currentPersonId] = {
      ...FAMILY_DATA[currentPersonId],
      imageUrl: url,
      imagePath: storagePath
    };

    applyAvatarsToCards();
    renderPersonDetail(currentPersonId);
  } catch (err) {
    console.error("Failed to update photo:", err);
    alert("Failed to update photo. Please try again.");
  } finally {
    detailPhotoInput.value = "";
  }
});

// ===============================
// Save birthday (Option A - Month/Day)
// ===============================
saveBirthdayBtn?.addEventListener("click", async () => {
  if (!adminUnlocked) {
    alert("Admin mode required.");
    return;
  }
  if (!currentPersonId) {
    alert("Select a family member first.");
    return;
  }

  const mm = birthdayMonthSelect?.value || "";
  const dd = birthdayDaySelect?.value || "";

  if (!mm || !dd) {
    alert("Please select both month and day.");
    return;
  }

  const birthday = `${mm}-${dd}`;

  try {
    await setDoc(
      doc(db, "familyMembers", currentPersonId),
      { birthday },
      { merge: true }
    );

    FAMILY_DATA[currentPersonId] = {
      ...FAMILY_DATA[currentPersonId],
      birthday
    };

    renderPersonDetail(currentPersonId);
  } catch (err) {
    console.error("Failed to save birthday:", err);
    alert("Failed to save birthday.");
  }
});

// ===============================
// Initial load
// ===============================
loadFamilyData();
