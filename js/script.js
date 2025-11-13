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
  addDoc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";


// ===============================
// Firebase Config
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
// Passwords (REPLACE THESE!)
// ===============================
const UPLOAD_PASSWORD = "1234";
const ADMIN_PASSWORD = "1234";

let uploadUnlocked = false;
let adminUnlocked = false;


// ===============================
// DOM Elements
// ===============================
const fileInput = document.getElementById("photo-upload");
const captionField = document.getElementById("photo-caption");
const openModalBtn = document.getElementById("open-modal-btn");

const modal = document.getElementById("preview-modal");
const modalImage = document.getElementById("modal-image");
const modalCaption = document.getElementById("modal-caption");
const confirmUpload = document.getElementById("confirm-upload");
const cancelUpload = document.getElementById("cancel-upload");
const closeModalBtn = document.getElementById("close-modal");

const spinner = document.getElementById("upload-spinner");
const galleryEl = document.getElementById("gallery");

const adminBtn = document.getElementById("admin-mode-btn");

const lightbox = document.getElementById("lightbox-modal");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");

const toastContainer = document.getElementById("toast-container");

let selectedFile = null;


// ===============================
// Toast Notifications
// ===============================
function showToast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}


// ===============================
// Admin Lock Button
// ===============================
adminBtn.addEventListener("click", () => {
  if (!adminUnlocked) {
    const pwd = prompt("Enter admin password:");
    if (pwd !== ADMIN_PASSWORD) {
      alert("Incorrect password.");
      return;
    }
    adminUnlocked = true;
    adminBtn.textContent = "🔓"; // unlocked
    document.body.classList.add("admin-mode");
    showToast("Admin mode enabled.");
  } else {
    adminUnlocked = false;
    adminBtn.textContent = "🔒"; // locked
    document.body.classList.remove("admin-mode");
    showToast("Admin mode disabled.");
  }
});


// ===============================
// Upload Modal 
// ===============================
openModalBtn.addEventListener("click", () => {

  // Upload password first (only once per session)
  if (!uploadUnlocked) {
    const pwd = prompt("Enter upload password:");
    if (pwd !== UPLOAD_PASSWORD) {
      alert("Incorrect password.");
      return;
    }
    uploadUnlocked = true;
    showToast("Upload unlocked for this session.");
  }

  selectedFile = fileInput.files[0];
  if (!selectedFile) {
    alert("Please select a photo first.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    modalImage.src = e.target.result;
    modalCaption.value = captionField.value || "";
    modal.classList.add("active");
  };
  reader.readAsDataURL(selectedFile);
});

function closeModal() {
  modal.classList.remove("active");
  spinner.style.display = "none";
  selectedFile = null;
  fileInput.value = "";
}

cancelUpload.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);

modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});


// ===============================
// Confirm Upload
// ===============================
confirmUpload.addEventListener("click", async () => {
  if (!selectedFile) return;

  const caption = modalCaption.value.trim();

  // File type/size validation
  const ALLOWED = ["image/jpeg", "image/png"];
  if (!ALLOWED.includes(selectedFile.type)) {
    alert("Only JPG and PNG allowed.");
    return;
  }

  if (selectedFile.size > 10 * 1024 * 1024) {
    alert("Max file size is 10MB.");
    return;
  }

  spinner.style.display = "block";

  // Compression
  const compressed = await imageCompression(selectedFile, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1600,
    useWebWorker: true
  });

  try {
    const fileRef = ref(storage, "gallery/" + Date.now() + "-" + selectedFile.name);
    await uploadBytes(fileRef, compressed);
    const url = await getDownloadURL(fileRef);

    // Save Firestore doc + store the file path for deletion
    await addDoc(collection(db, "photos"), {
      caption: caption || "Untitled",
      url,
      path: fileRef.fullPath,
      timestamp: Date.now()
    });

    showToast("Photo uploaded!");
    closeModal();

  } catch (err) {
    console.error(err);
    alert("Upload failed.");
  }

  spinner.style.display = "none";
});


// ===============================
// Real-time Gallery Loader
// ===============================
const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));
onSnapshot(q, (snapshot) => {
  galleryEl.innerHTML = "";

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const id = docSnap.id;

    const item = document.createElement("div");
    item.className = "polaroid";
    item.dataset.id = id;
    item.dataset.path = data.path;
    item.dataset.caption = data.caption;
    item.dataset.url = data.url;

    // Variable tilt
    const tilt = (Math.random() * 28 - 14).toFixed(1);
    item.style.setProperty("--tilt", tilt + "deg");

    item.innerHTML = `
      <button class="delete-btn">×</button>
      <img src="${data.url}">
      <p>${data.caption}</p>
    `;

    galleryEl.appendChild(item);
  });
});


// ===============================
// Click Handler (Delete / Lightbox)
// ===============================
galleryEl.addEventListener("click", async (e) => {
  const card = e.target.closest(".polaroid");
  if (!card) return;

  const deleteBtn = e.target.closest(".delete-btn");
  const id = card.dataset.id;
  const path = card.dataset.path;
  const url = card.dataset.url;
  const caption = card.dataset.caption;

  // ADMIN DELETE
  if (deleteBtn) {
    if (!adminUnlocked) {
      alert("Admin mode required.");
      return;
    }

    if (!confirm("Delete this photo?")) return;

    try {
      // Delete from Firebase Storage
      await deleteObject(ref(storage, path));

      // Delete from Firestore
      await deleteDoc(doc(db, "photos", id));

      showToast("Photo deleted.");

    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
    return;
  }

  // FULLSCREEN LIGHTBOX
  lightboxImage.src = url;
  lightboxCaption.textContent = caption;
  lightbox.classList.add("show");
});

lightboxClose.addEventListener("click", () => lightbox.classList.remove("show"));
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("show");
});
