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

// ===============================
// Gallery Password Lock
// ===============================
const GALLERY_PASSWORD = "1234";
const lockScreen = document.getElementById("gallery-lock");
const albumGridWrapper = document.getElementById("album-grid");
const uploadForm = document.querySelector(".upload-form");

function unlockGalleryUI() {
  lockScreen?.classList.add("hidden");
  uploadForm?.classList.remove("hidden");
  albumGridWrapper?.classList.remove("hidden");
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
const createAlbumBtn = document.getElementById("create-album-btn");
const albumUploadBtn = document.getElementById("album-upload-btn");

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
const lightboxDownload = document.getElementById("lightbox-download");

const toastContainer = document.getElementById("toast-container");

// ===============================
// Create Album
// ===============================
createAlbumBtn?.addEventListener("click", () => {
  const name = prompt("Name of the new album:");
  const trimmed = name?.trim();
  if (!trimmed) return;

  // Set current album and open an empty book view
  currentAlbum = trimmed;
  renderAlbumView(trimmed, []); // no photos yet, shows empty pages
});

// Albums
const albumListEl = document.getElementById("album-list");
const albumViewEl = document.getElementById("album-view");
const backToAlbumsBtn = document.getElementById("back-to-albums");
const currentAlbumTitleEl = document.getElementById("current-album-title");

// State
let selectedFiles = [];
let editPhotoId = null; // used when editing captions
let modalMode = "upload"; // "upload" or "edit"
let photosCache = [];
let currentAlbum = null;
let currentLightboxUrl = null;

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
// Album upload flow (must be in an album)
// ===============================

// Clicking this button opens the file picker
albumUploadBtn?.addEventListener("click", () => {
  if (!currentAlbum) {
    alert("Please select or create an album first.");
    return;
  }
  fileInput?.click();
});

// When files are chosen, show the preview modal
fileInput?.addEventListener("change", () => {
  if (!fileInput.files || fileInput.files.length === 0) return;

  if (!currentAlbum) {
    alert("Please select or create an album first.");
    fileInput.value = "";
    return;
  }

  modalMode = "upload";
  confirmUploadBtn.textContent = "Confirm Upload";

  selectedFiles = Array.from(fileInput.files);
  const first = selectedFiles[0];

  const reader = new FileReader();
  reader.onload = (e) => {
    modalImage.src = e.target.result;
    modalCaption.value = ""; // fresh caption for this batch
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
// Upload Photos (Bulk with compression & album)
// ===============================
async function doPhotoUpload() {
  if (!selectedFiles.length) return;
  if (!currentAlbum) {
    alert("Please select or create an album first.");
    return;
  }

  const caption = modalCaption.value.trim();
const albumName = currentAlbum || "Family Album";


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

      // client-side compression
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
        album: albumName,
        timestamp: Date.now()
      });

      confirmUploadBtn.textContent = `Uploading... (${i + 1}/${selectedFiles.length})`;
    }

    showToast("Photos uploaded!");
    
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
// Albums Rendering Helpers
// ===============================
function renderAlbumsFromCache() {
  albumListEl.innerHTML = "";

  const albumsMap = new Map();
  for (const p of photosCache) {
    const name = p.album || "Family Album";
    if (!albumsMap.has(name)) albumsMap.set(name, []);
    albumsMap.get(name).push(p);
  }

  // If no photos, no albums
  if (albumsMap.size === 0) {
    albumListEl.innerHTML = "<p>No photos yet. Upload to create your first album!</p>";
    return albumsMap;
  }

  for (const [name, items] of albumsMap.entries()) {
    const card = document.createElement("div");
card.className = "album-card";
card.dataset.album = name;
card.innerHTML = `
  <div class="album-cover">
    <div class="album-cover-spine"></div>
    <div class="album-cover-front">
      <div class="album-cover-title">${name}</div>
      <div class="album-cover-count">
        ${items.length} photo${items.length === 1 ? "" : "s"}
      </div>
    </div>
  </div>
`;
albumListEl.appendChild(card);

  }

  return albumsMap;
}

function renderAlbumView(name, items) {
  if (!name || !items) return;

  currentAlbum = name;
  currentAlbumTitleEl.textContent = name;

  // Show album view, hide album list
  albumViewEl.classList.remove("hidden");
  albumListEl.parentElement.classList.add("hidden");

 // 4 photos per *page* (left or right),
// so 8 photos total per open spread.
const PHOTOS_PER_PAGE = 4;
const PHOTOS_PER_SPREAD = PHOTOS_PER_PAGE * 2;

// Build spreads of up to 8 photos each
const spreads = [];
for (let i = 0; i < items.length; i += PHOTOS_PER_SPREAD) {
  spreads.push(items.slice(i, i + PHOTOS_PER_SPREAD));
}

  let pageIndex = 0;

  // Clear gallery & build the book skeleton
  galleryEl.innerHTML = "";

  const bookEl = document.createElement("div");
  bookEl.className = "photo-book";

  const leftPageEl = document.createElement("div");
  leftPageEl.className = "photo-page left";

  const rightPageEl = document.createElement("div");
  rightPageEl.className = "photo-page right";

  bookEl.appendChild(leftPageEl);
  bookEl.appendChild(rightPageEl);
  galleryEl.appendChild(bookEl);

  // Navigation under the book
  const navEl = document.createElement("div");
  navEl.className = "photo-book-nav";
  navEl.innerHTML = `
    <button class="book-nav-btn" data-dir="prev">← Previous page</button>
    <span class="book-page-indicator"></span>
    <button class="book-nav-btn" data-dir="next">Next page →</button>
  `;
  galleryEl.appendChild(navEl);

  const prevBtn = navEl.querySelector('[data-dir="prev"]');
  const nextBtn = navEl.querySelector('[data-dir="next"]');
  const indicatorEl = navEl.querySelector(".book-page-indicator");

  // Helper to create the same polaroid card you already use
  function createPolaroidCard(photo) {
    const card = document.createElement("div");
    card.className = "polaroid";
    card.dataset.id = photo.id;
    card.dataset.path = photo.path;
    card.dataset.caption = photo.caption || "";
    card.dataset.url = photo.url;

    const tilt = (Math.random() * 28 - 14).toFixed(1);
    card.style.setProperty("--tilt", tilt + "deg");

    card.innerHTML = `
      <button class="delete-btn">×</button>
      <button class="edit-btn">✏</button>
      <img src="${photo.url}">
      <p>${photo.caption || ""}</p>
    `;
    return card;
  }

  function renderSpread() {
    leftPageEl.innerHTML = "";
    rightPageEl.innerHTML = "";

    if (!spreads.length) {
      indicatorEl.textContent = "No photos in this album yet.";
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      return;
    }

   const photos = spreads[pageIndex];

// First 4 → left page, next 4 → right page
const leftPhotos = photos.slice(0, PHOTOS_PER_PAGE);
const rightPhotos = photos.slice(PHOTOS_PER_PAGE, PHOTOS_PER_SPREAD);


    leftPhotos.forEach((p) => leftPageEl.appendChild(createPolaroidCard(p)));
    rightPhotos.forEach((p) => rightPageEl.appendChild(createPolaroidCard(p)));

    indicatorEl.textContent = `Page ${pageIndex + 1} of ${spreads.length}`;
    prevBtn.disabled = pageIndex === 0;
    nextBtn.disabled = pageIndex >= spreads.length - 1;
  }

  renderSpread();

  navEl.addEventListener("click", (e) => {
    const dir = e.target.dataset.dir;
    if (!dir) return;

    if (dir === "prev" && pageIndex > 0) {
      pageIndex--;
      renderSpread();
    } else if (dir === "next" && pageIndex < spreads.length - 1) {
      pageIndex++;
      renderSpread();
    }
  });
}


// ===============================
// Real-time Gallery / Albums
// ===============================
if (galleryEl && albumListEl) {
  const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));

onSnapshot(q, (snapshot) => {
  photosCache = [];
  snapshot.forEach((docSnap) => {
    photosCache.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });

  const albumsMap = renderAlbumsFromCache();

  // If already in an album and it has photos, keep in sync
  if (currentAlbum && albumsMap.has(currentAlbum)) {
    renderAlbumView(currentAlbum, albumsMap.get(currentAlbum));
  } else if (!currentAlbum) {
    // Only force album list if we don't have a current album
    albumViewEl.classList.add("hidden");
    albumListEl.parentElement.classList.remove("hidden");
  }
  // If currentAlbum exists but has no photos yet, do nothing;
  // the existing empty view stays visible.
});


  // Click album cards
  albumListEl.addEventListener("click", (e) => {
    const card = e.target.closest(".album-card");
    if (!card) return;
    const albumName = card.dataset.album;
    if (!albumName) return;

    const albumsMap = new Map();
    for (const p of photosCache) {
      const name = p.album || "Family Album";
      if (!albumsMap.has(name)) albumsMap.set(name, []);
      albumsMap.get(name).push(p);
    }

    const items = albumsMap.get(albumName) || [];
    renderAlbumView(albumName, items);
  });

  // Back to albums
  backToAlbumsBtn?.addEventListener("click", () => {
    currentAlbum = null;
    albumViewEl.classList.add("hidden");
    albumListEl.parentElement.classList.remove("hidden");
  });

  // ===============================
  // Gallery Click Handler (inside album view)
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
      currentLightboxUrl = url;
      lightboxImage.src = url;
      lightboxCaption.textContent = caption || "";
      lightbox.classList.add("show");
    }
  });
}

// ===============================
// Lightbox Closing & Download
// ===============================
lightboxClose?.addEventListener("click", () => lightbox.classList.remove("show"));
lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.classList.remove("show");
});

lightboxDownload?.addEventListener("click", () => {
  if (!currentLightboxUrl) return;
  const a = document.createElement("a");
  a.href = currentLightboxUrl;
  a.download = "family-photo.jpg"; // you can tweak this later
  document.body.appendChild(a);
  a.click();
  a.remove();
});
