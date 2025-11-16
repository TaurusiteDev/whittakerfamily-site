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
  doc,
  updateDoc
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

// (Unused helper, safe to keep if you want)
async function updateCaption(id, newCaption) {
  try {
    const photoRef = doc(db, "photos", id);
    await updateDoc(photoRef, { caption: newCaption });
    showToast("Caption updated.");
  } catch (err) {
    console.error("Caption update failed:", err);
    alert("Failed to update caption.");
  }
}

// ===============================
// Gallery Password Lock
// ===============================
const GALLERY_PASSWORD = "1234";
const lockScreen = document.getElementById("gallery-lock");
const albumGrid = document.getElementById("album-grid");
const uploadForm = document.querySelector(".upload-form");

function unlockGalleryUI() {
  lockScreen?.classList.add("hidden");
  uploadForm?.classList.remove("hidden");
  albumGrid?.classList.remove("hidden");
  sessionStorage.setItem("galleryUnlocked", "yes");
}

if (sessionStorage.getItem("galleryUnlocked") === "yes") {
  unlockGalleryUI();
}

document.getElementById("unlock-gallery-btn")?.addEventListener("click", () => {
  const input = document.getElementById("gallery-password").value.trim();
  const error = document.getElementById("gallery-password-error");
  if (input === GALLERY_PASSWORD) {
    unlockGalleryUI();
  } else if (error) {
    error.textContent = "Incorrect password. Please try again.";
  }
});

// ===============================
// Admin Password
// ===============================
const ADMIN_PASSWORD = "1234";
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
const confirmUploadBtn = document.getElementById("confirm-upload");
const cancelUploadBtn = document.getElementById("cancel-upload");
const closeModalBtn = document.getElementById("close-modal");

const spinner = document.getElementById("upload-spinner");
const galleryEl = document.getElementById("gallery");
const adminBtn = document.getElementById("admin-mode-btn");

const lightbox = document.getElementById("lightbox-modal");
const lightboxImage = document.getElementById("lightbox-image");
const lightboxCaption = document.getElementById("lightbox-caption");
const lightboxClose = document.getElementById("lightbox-close");

const toastContainer = document.getElementById("toast-container");

let selectedFiles = [];
let editPhotoId = null; // used when editing captions
let modalMode = "upload"; // "upload" or "edit"

// ===============================
// Toast
// ===============================
function showToast(msg) {
  if (!toastContainer) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ===============================
// Admin Lock Button
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
    showToast("Admin mode enabled.");
  } else {
    adminUnlocked = false;
    adminBtn.textContent = "🔒";
    document.body.classList.remove("admin-mode");
    showToast("Admin mode disabled.");
  }
});

// ===============================
// File Input Supports Multiple Uploads
// ===============================
if (fileInput) fileInput.multiple = true;

// ===============================
// Open Upload Modal
// ===============================
openModalBtn?.addEventListener("click", () => {
  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select one or more photos first.");
    return;
  }

  modalMode = "upload"; // ensure correct mode
  confirmUploadBtn.textContent = "Confirm Upload";

  selectedFiles = Array.from(fileInput.files);
  const first = selectedFiles[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    modalImage.src = e.target.result;
    modalCaption.value = captionField?.value || "";
    modal.classList.add("active");
  };
  reader.readAsDataURL(first);
});

// ===============================
// Close Modal
// ===============================
function closeModal() {
  modal?.classList.remove("active");
  spinner.style.display = "none";
  selectedFiles = [];
  if (fileInput) fileInput.value = "";
  editPhotoId = null;
  modalMode = "upload";
  confirmUploadBtn.textContent = "Confirm Upload";
}

cancelUploadBtn?.addEventListener("click", closeModal);
closeModalBtn?.addEventListener("click", closeModal);
modal?.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ===============================
// Confirm Button (Upload or Save Caption)
// ===============================
confirmUploadBtn?.addEventListener("click", async () => {
  if (modalMode === "edit") {
    return saveCaptionEdit();
  } else {
    return doPhotoUpload();
  }
});

// ===============================
// Upload Photos (Bulk with compression)
// ===============================
async function doPhotoUpload() {
  if (!selectedFiles.length) return;

  const caption = modalCaption.value.trim();
  const ALLOWED = ["image/jpeg", "image/png"];

  for (const f of selectedFiles) {
    if (!ALLOWED.includes(f.type)) {
      alert("Only JPG and PNG allowed.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      alert("Max file size is 10MB.");
      return;
    }
  }

  spinner.style.display = "block";
  confirmUploadBtn.disabled = true;
  const originalText = confirmUploadBtn.textContent;

  try {
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];

      // client-side compression (from browser-image-compression)
      const compressed = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1600,
        useWebWorker: true
      });

      const fileRef = ref(storage, "gallery/" + Date.now() + "-" + file.name);
      await uploadBytes(fileRef, compressed);
      const url = await getDownloadURL(fileRef);

      await addDoc(collection(db, "photos"), {
        caption, // empty allowed
        url,
        path: fileRef.fullPath,
        timestamp: Date.now()
      });

      confirmUploadBtn.textContent = `Uploading... (${i + 1}/${selectedFiles.length})`;
    }

    showToast("Photos uploaded!");
    if (captionField) captionField.value = "";
    closeModal();
  } catch (err) {
    console.error(err);
    alert("Upload failed.");
  }

  spinner.style.display = "none";
  confirmUploadBtn.disabled = false;
  confirmUploadBtn.textContent = originalText;
}

// ===============================
// Save Caption Edit (using same modal)
// ===============================
async function saveCaptionEdit() {
  if (!editPhotoId) return;

  const newCaption = modalCaption.value; // empty allowed
  spinner.style.display = "block";
  confirmUploadBtn.disabled = true;

  try {
    await updateDoc(doc(db, "photos", editPhotoId), { caption: newCaption });
    showToast("Caption updated!");
    // onSnapshot will refresh the gallery for us
    closeModal();
  } catch (err) {
    console.error("Failed to update caption.", err);
    alert("Failed to update caption.");
  }

  spinner.style.display = "none";
  confirmUploadBtn.disabled = false;
  confirmUploadBtn.textContent = "Confirm Upload";
}

// ===============================
// Real-time Gallery Rendering
// ===============================
if (galleryEl) {
  const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));

  onSnapshot(q, (snapshot) => {
    galleryEl.innerHTML = "";

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;

      const card = document.createElement("div");
      card.className = "polaroid";
      card.dataset.id = id;
      card.dataset.path = data.path;
      card.dataset.caption = data.caption;
      card.dataset.url = data.url;

      const tilt = (Math.random() * 28 - 14).toFixed(1);
      card.style.setProperty("--tilt", tilt + "deg");

      card.innerHTML = `
        <button class="delete-btn">×</button>
        <button class="edit-btn">✏</button>
        <img src="${data.url}">
        <p>${data.caption || ""}</p>
      `;

      galleryEl.appendChild(card);
    });
  });

  // ===============================
  // Gallery Click Handler
  // ===============================
  galleryEl.addEventListener("click", async (e) => {
    const card = e.target.closest(".polaroid");
    if (!card) return;

    const id = card.dataset.id;
    const path = card.dataset.path;
    const url = card.dataset.url;
    const caption = card.dataset.caption;

    // DELETE
    if (e.target.closest(".delete-btn")) {
      if (!adminUnlocked) {
        alert("Admin mode required.");
        return;
      }
      if (!confirm("Delete this photo?")) return;

      try {
        await deleteObject(ref(storage, path));
        await deleteDoc(doc(db, "photos", id));
        showToast("Photo deleted.");
      } catch (err) {
        console.error(err);
        alert("Failed to delete.");
      }
      return;
    }

    // EDIT CAPTION - reuse upload modal
    const editBtn = e.target.closest(".edit-btn");
    if (editBtn) {
      if (!adminUnlocked) {
        alert("Admin mode required.");
        return;
      }

      modalMode = "edit";
      editPhotoId = id;
      modalCaption.value = caption || "";
      modalImage.src = url;
      confirmUploadBtn.textContent = "Save Changes";
      modal.classList.add("active");
      return;
    }

    // LIGHTBOX VIEW
    if (lightbox) {
      lightboxImage.src = url;
      lightboxCaption.textContent = caption || "";
      lightbox.classList.add("show");
    }
  });
}

// ===============================
// Lightbox Closing
// ===============================
lightboxClose?.addEventListener("click", () => lightbox.classList.remove("show"));
lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("show");
});
