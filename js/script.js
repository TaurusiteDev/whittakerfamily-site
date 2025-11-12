// ===============================
// Firebase Imports
// ===============================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-storage.js";
import { getFirestore, collection, addDoc, onSnapshot, orderBy, query } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";

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
// Navigation Highlight
// ===============================
document.querySelectorAll("nav a").forEach(link => {
  if (link.href === window.location.href) {
    link.classList.add("active-link");
  }
});

// ===============================
// DOM Elements
// ===============================
const imageUploadInput = document.getElementById('image-upload');
const captionInput = document.getElementById('photo-caption');
const openModalBtn = document.getElementById('open-modal-btn');
const previewModal = document.getElementById('preview-modal');
const modalImage = document.getElementById('modal-image');
const modalCaption = document.getElementById('modal-caption');
const confirmUploadBtn = document.getElementById('confirm-upload');
const cancelUploadBtn = document.getElementById('cancel-upload');
const closeModalBtn = document.getElementById('close-modal');
const spinner = document.getElementById('upload-spinner');
const galleryEl = document.getElementById('gallery');

let selectedFile = null;

// ===============================
// Modal Logic
// ===============================
openModalBtn?.addEventListener('click', () => {
  selectedFile = imageUploadInput.files[0];
  if (!selectedFile) return alert("Please select a photo first.");

  const reader = new FileReader();
  reader.onload = (ev) => {
    modalImage.src = ev.target.result;
    modalCaption.value = captionInput.value;
    previewModal.classList.add('active');
  };
  reader.readAsDataURL(selectedFile);
});

closeModalBtn?.addEventListener('click', closeModal);
cancelUploadBtn?.addEventListener('click', closeModal);

function closeModal() {
  previewModal.classList.remove('active');
  spinner.style.display = 'none';
  selectedFile = null;
  imageUploadInput.value = "";
}

// ===============================
// Confirm Upload
// ===============================
confirmUploadBtn?.addEventListener('click', async () => {
  if (!selectedFile) return alert('No image selected!');
  spinner.style.display = 'block';
  const caption = modalCaption.value.trim() || captionInput.value.trim();

  try {
    const fileRef = ref(storage, 'gallery/' + Date.now() + '-' + selectedFile.name);
    await uploadBytes(fileRef, selectedFile);
    const url = await getDownloadURL(fileRef);

    await addDoc(collection(db, "photos"), {
      caption: caption || "Untitled",
      url: url,
      timestamp: Date.now()
    });

    spinner.style.display = 'none';
    closeModal();
  } catch (err) {
    console.error(err);
    spinner.style.display = 'none';
    alert("❌ Upload failed: " + err.message);
  }
});

// ===============================
// Real-time Gallery Updates
// ===============================
if (galleryEl) {
  const q = query(collection(db, "photos"), orderBy("timestamp", "desc"));
  onSnapshot(q, (snapshot) => {
    galleryEl.innerHTML = '';
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.classList.add('polaroid');
      item.style.setProperty('--tilt', `${(Math.random() * 4 - 2).toFixed(2)}deg`);
      item.innerHTML = `
        <img src="${data.url}" alt="${data.caption || 'Family photo'}">
        <p>${truncateCaption(data.caption || '', 80)}</p>`;
      galleryEl.appendChild(item);
    });
  });
}

// After galleryEl.appendChild(item);
item.style.setProperty('--tilt', `${(Math.random() * 20 - 10).toFixed(1)}deg`);


function truncateCaption(text, maxLength) {
  return text.length > maxLength ? text.slice(0, maxLength) + '…' : text;
}

// Close modal if user clicks outside the content
previewModal?.addEventListener('click', (e) => {
  if (e.target === previewModal) closeModal();
});
