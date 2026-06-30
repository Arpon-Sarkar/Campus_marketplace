const API_BASE_URL = "http://localhost:5000/api";
const API_BASE = API_BASE_URL;

const PUBLIC_PAGES = ["index.html", "login.html", "register.html"];
const PROTECTED_PAGES = [
  "dashboard.html", "profile.html", "products.html", "services.html", "orders.html",
  "seller-orders.html", "booking.html", "reviews.html", "add-product.html", "add-service.html",
  "notifications.html", "service-orders.html", "admin.html", "product-details.html", "service-details.html", "seller-profile.html"
];

function currentPage() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function setUser(user) {
  localStorage.setItem("user", JSON.stringify(user));
}

function requireLogin() {
  const page = currentPage();
  const user = getUser();

  if (PROTECTED_PAGES.includes(page) && !user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return null;
  }

  return user;
}

function requireAdmin() {
  const user = requireLogin();

  if (user && user.role !== "admin") {
    alert("Access denied. Only admin can access this page.");
    window.location.href = "dashboard.html";
  }
}

function isVerified(user) {
  return user && (user.role === "admin" || user.verification_status === "verified");
}

function logout() {
  localStorage.removeItem("user");
  window.location.href = "login.html";
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} BDT`;
}

function badge(value) {
  const label = value || "unknown";
  return `<span class="status-badge status-${String(label).replaceAll("_", "-")}">${label}</span>`;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!file.type.startsWith("image/")) return reject(new Error("Please select an image file."));
    if (file.size > 2 * 1024 * 1024) return reject(new Error("Image must be under 2 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

function fileToDataUrlAny(file, maxMb = 5) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const allowed = [
      "image/",
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];
    const ok = allowed.some(type => file.type.startsWith(type) || file.type === type);
    if (!ok) return reject(new Error("Only image, PDF, DOC, or DOCX files are allowed."));
    if (file.size > maxMb * 1024 * 1024) return reject(new Error(`File must be under ${maxMb} MB.`));
    const reader = new FileReader();
    reader.onload = () => resolve({ data: reader.result, name: file.name, type: file.type || "application/octet-stream" });
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

function jsString(value) {
  return JSON.stringify(String(value || ""));
}

function avatarHTML(src, name = "User", size = "small") {
  const cls = size === "large" ? "avatar avatar-large" : "avatar";
  if (src) return `<img class="${cls}" src="${src}" alt="${escapeHTML(name)}">`;
  const initials = String(name || "U").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "U";
  return `<div class="${cls} avatar-placeholder">${initials}</div>`;
}

function itemImageHTML(src, title = "Item") {
  if (src) return `<button type="button" class="image-view-button" onclick="event.stopPropagation(); openMediaViewer(${jsString(src)}, ${jsString(title)}, 'image')"><img class="item-image" src="${src}" alt="${escapeHTML(title)}"></button>`;
  return `<div class="item-image item-image-placeholder">No Image</div>`;
}

function attachmentHTML(fileData, fileName, label = "Attachment") {
  if (!fileData) return "";
  const safeName = escapeHTML(fileName || label);
  const safeHref = escapeHTML(fileData);
  return `<div class="attachment-chip"><span>📎 ${safeName}</span><a class="secondary-btn mini-btn" href="${safeHref}" target="_blank" rel="noopener noreferrer">View</a></div>`;
}

function serviceAttachmentHTML(service, label = "Portfolio/CV") {
  if (!service || !service.service_file_data) return "";
  const href = service.id ? `${API_BASE_URL}/services/${service.id}/file` : service.service_file_data;
  return attachmentHTML(href, service.service_file_name, label);
}

function openMediaViewer(src, title = "Preview", kind = "image") {
  if (!src) return;
  const existing = document.getElementById("mediaViewerModal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "mediaViewerModal";
  modal.className = "modal-overlay";
  modal.style.display = "flex";
  const safeTitle = escapeHTML(title || "Preview");
  const body = kind === "image"
    ? `<img class="media-view-image" src="${src}" alt="${safeTitle}">`
    : `<div class="file-preview-box"><p><strong>${safeTitle}</strong></p><p class="muted">Open the attached PDF/CV/portfolio file in a new tab.</p><a class="primary-btn" href="${src}" target="_blank" download="${safeTitle}">Open / Download File</a></div>`;
  modal.innerHTML = `<div class="modal-box large-modal"><div class="card-topline"><h2>${safeTitle}</h2><button class="secondary-btn" onclick="document.getElementById('mediaViewerModal').remove()">Close</button></div>${body}</div>`;
  document.body.appendChild(modal);
}

function serviceAvailabilityHTML(service) {
  if (service.status === "unavailable") return `<p><strong>Availability:</strong> <span class="stock-sold">Not Available</span></p>`;
  if (service.status === "active") return `<p><strong>Availability:</strong> <span class="stock-ok">Active / Available</span></p>`;
  return `<p><strong>Availability:</strong> ${badge(service.status)}</p>`;
}

function userProfileLink(userId, image, name, label = "Seller") {
  if (!userId) return `<div class="seller-row">${avatarHTML(image, name)}<p><strong>${label}:</strong> ${escapeHTML(name || "Unknown")}</p></div>`;
  return `<a class="seller-row profile-link" href="seller-profile.html?id=${userId}">${avatarHTML(image, name)}<p><strong>${label}:</strong> ${escapeHTML(name || "Unknown")}<br><span class="muted">View public profile & reviews</span></p></a>`;
}

function stockHTML(item) {
  const q = Number(item.quantity || 1);
  const sold = Number(item.sold_quantity || 0);
  const remaining = Math.max(Number(item.remaining_quantity ?? (q - sold)), 0);

  if (remaining <= 0) {
    return `<p><strong>Availability:</strong> <span class="stock-sold">Sold / Out of Stock</span></p>`;
  }

  if (q === 1) {
    return `<p><strong>Availability:</strong> <span class="stock-ok">Available</span></p>`;
  }

  return `<p><strong>Availability:</strong> <span class="stock-ok">Remaining: ${remaining}/${q} items</span></p>`;
}

function receiverPaymentInfoHTML(item, label = "Seller") {
  if (!item || (!item.bkash_number && !item.payment_note)) return "";
  return `<div class="payment-receiver-box">
    <strong>${label} money sending info</strong>
    ${item.bkash_number ? `<p><b>bKash:</b> ${escapeHTML(item.bkash_number)}</p>` : `<p class="muted">No bKash number added.</p>`}
    ${item.payment_note ? `<p><b>Note:</b> ${escapeHTML(item.payment_note)}</p>` : ""}
  </div>`;
}

function idPreviewHTML(src, title) {
  return src ? `<button type="button" class="id-thumb-button" onclick="openMediaViewer(${jsString(src)}, ${jsString(title)}, 'image')"><img class="id-thumb" src="${src}" alt="${escapeHTML(title)}"><span>Click to view</span></button>` : `<span class="muted">No image uploaded</span>`;
}

function idDocumentButtonHTML(userId, hasDoc, side = "front") {
  if (!hasDoc) return `<small>No ${side} ID</small>`;
  const isBack = side === "back";
  return `<button class="id-thumb-button tiny" onclick="viewIdCardFromUser(${userId}, ${isBack})"><span>${isBack ? "Back" : "Front"} ID uploaded</span><small>Click to view</small></button>`;
}

async function loadCurrentUserIdDocuments() {
  const user = getUser();
  const frontPreview = document.getElementById("currentIdFrontPreview");
  const backPreview = document.getElementById("currentIdBackPreview");
  if (!user || (!frontPreview && !backPreview)) return;

  if (frontPreview) frontPreview.innerHTML = user.has_id_card_front ? `<span class="muted">Loading front ID...</span>` : idPreviewHTML(null, "Current ID Card Front");
  if (backPreview) backPreview.innerHTML = user.has_id_card_back ? `<span class="muted">Loading back ID...</span>` : idPreviewHTML(null, "Current ID Card Back");

  try {
    const docs = await api(`/users/${user.id}/id-documents?user_id=${user.id}`);
    if (frontPreview) frontPreview.innerHTML = idPreviewHTML(docs.id_card_front, "Current ID Card Front");
    if (backPreview) backPreview.innerHTML = idPreviewHTML(docs.id_card_back, "Current ID Card Back");
  } catch (error) {
    if (frontPreview) frontPreview.innerHTML = `<span class="muted">Could not load front ID: ${escapeHTML(error.message)}</span>`;
    if (backPreview) backPreview.innerHTML = `<span class="muted">Could not load back ID: ${escapeHTML(error.message)}</span>`;
  }
}

function ownerListingActions(type, item) {
  const user = getUser();
  if (!user || Number(user.id) !== Number(item.user_id)) return "";
  if (type === "product") {
    return `<div class="owner-actions inline-management"><button class="secondary-btn" onclick="openProductEditForm(${item.id})">Edit Listing</button><button class="secondary-btn" onclick="openQuantityForm(${item.id})">Update Stock</button><button class="danger-btn" onclick="deleteProduct(${item.id})">Delete</button></div>`;
  }
  const nextStatus = item.status === "unavailable" ? "active" : "unavailable";
  const label = item.status === "unavailable" ? "Set Active" : "Set Not Available";
  return `<div class="owner-actions inline-management"><button class="secondary-btn" onclick="openServiceEditForm(${item.id})">Edit Service</button><button class="secondary-btn" onclick="updateServiceAvailability(${item.id}, '${nextStatus}')">${label}</button><button class="danger-btn" onclick="deleteService(${item.id})">Delete</button></div>`;
}

function adminIdPayload(extra = {}) {
  const user = getUser();
  return { ...extra, admin_id: user ? user.id : null };
}

function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}


function pageTitleFromFile(page) {
  const titles = {
    "dashboard.html": "Dashboard",
    "products.html": "Browse Products",
    "services.html": "Browse Services",
    "orders.html": "My Product Orders",
    "seller-orders.html": "Received Product Orders",
    "booking.html": "My Service Bookings",
    "service-orders.html": "Received Service Orders",
    "notifications.html": "Notifications",
    "reviews.html": "Reviews",
    "profile.html": "Profile",
    "add-product.html": "Post Product",
    "add-service.html": "Post Service",
    "admin.html": "Admin Panel",
    "index.html": "Home",
    "login.html": "Login",
    "register.html": "Register",
    "product-details.html": "Product Details",
    "service-details.html": "Service Details",
    "seller-profile.html": "Seller Profile"
  };

  return titles[page] || "Campus Marketplace";
}

async function setupNavigation() {
  const nav = document.querySelector("header.navbar nav");
  const logo = document.querySelector("header.navbar .logo");
  if (logo) logo.innerHTML = `<span class="brand-mark">CM</span><div><strong>Campus</strong> Marketplace</div>`;
  if (!nav) return;

  const page = currentPage();
  const user = getUser();

  let counts = { total_unread: 0, received_product_orders: 0, received_service_orders: 0, my_product_orders: 0, my_service_bookings: 0, admin_alerts: 0 };
  if (user) {
    try { counts = await api(`/notifications/summary/${user.id}`); } catch (error) {}
  }

  function navBadge(count) {
    count = Number(count || 0);
    return count > 0 ? `<span class="nav-badge">${count}</span>` : "";
  }
  function navItem(href, label, icon = "", extraClass = "") {
    const active = href === page ? "active-link" : "";
    return `<a href="${href}" class="${[extraClass, active].filter(Boolean).join(" ")}">${icon ? `<span>${icon}</span>` : ""}${label}</a>`;
  }

  if (!user) {
    nav.innerHTML = [
      navItem("index.html", "Home", "🏠"),
      navItem("products.html", "Products", "🛒"),
      navItem("services.html", "Services", "🎓"),
      navItem("login.html", "Login", "", "btn-outline"),
      navItem("register.html", "Register", "", "btn-primary")
    ].join("");
    return;
  }

  const profile = `
  <a href="profile.html" class="profile-nav-pill ${page === 'profile.html' ? 'active-link' : ''}">
    ${avatarHTML(user.profile_image, user.name)}
    <span>${escapeHTML(user.name || 'Profile')}</span>
  </a>
`;
nav.innerHTML = [
  navItem("dashboard.html", "Dashboard", "🏠"),
  navItem("products.html", "Products", "🛒"),
  navItem("services.html", "Services", "🎓"),
  navItem("add-product.html", "Post Product", "➕", "nav-btn"),
  navItem("add-service.html", "Post Service", "💼", "nav-btn"),
  navItem("notifications.html", `Notifications ${navBadge(counts.total_unread)}`, "🔔"),
  user.role === "admin" ? navItem("admin.html", `Admin ${navBadge(counts.admin_alerts)}`, "⚙️", "nav-btn") : "",
  profile,
  `<button type="button" onclick="logout()" class="nav-logout-btn">Logout</button>`
].join("");

  setupSideMenu(counts);
}

function setupSideMenu(counts = {}) {
  const user = getUser();
  if (!user || PUBLIC_PAGES.includes(currentPage())) return;
  if (document.getElementById("sideQuickMenu")) return;

  const menu = document.createElement("section");
  menu.id = "sideQuickMenu";
  menu.className = "side-quick-menu";

  const badge = c => Number(c || 0) > 0 ? `<span class="side-badge">${Number(c)}</span>` : "";

  menu.innerHTML = `
    <a href="orders.html" class="${currentPage()==='orders.html'?'active-side':''}">
      📦 <span>My Orders</span>${badge(counts.my_product_orders)}
    </a>

    <a href="booking.html" class="${currentPage()==='booking.html'?'active-side':''}">
      📅 <span>My Bookings</span>${badge(counts.my_service_bookings)}
    </a>

    <a href="seller-orders.html" class="${currentPage()==='seller-orders.html'?'active-side':''}">
      🏪 <span>Orders Received</span>${badge(counts.received_product_orders)}
    </a>

    <a href="service-orders.html" class="${currentPage()==='service-orders.html'?'active-side':''}">
      🧑‍🏫 <span>Bookings Received</span>${badge(counts.received_service_orders)}
    </a>
  `;

  const navbar = document.querySelector("header.navbar");

  if (navbar && navbar.parentNode) {
    navbar.insertAdjacentElement("afterend", menu);
  } else {
    document.body.prepend(menu);
  }
}

function getNotificationTarget(notification) {
  if (notification.link_url) return notification.link_url;

  const message = String(notification.message || "").toLowerCase();
  const type = String(notification.type || "").toLowerCase();

  if (type === "order" && (message.includes("new order") || message.includes("your product"))) {
    return "seller-orders.html";
  }

  if (type === "order") return "orders.html";

  if (type === "booking" && (message.includes("new booking") || message.includes("received"))) {
    return "service-orders.html";
  }

  if (type === "booking") return "booking.html";
  if (type === "payment") return message.includes("service") ? "service-orders.html" : "seller-orders.html";
  if (type === "delivery") return "orders.html";
  if (type === "review") return "reviews.html";
  if (type === "product") return "products.html";
  if (type === "service") return "services.html";

  return "dashboard.html";
}

function reviewSummary(avg, count) {
  avg = Number(avg || 0);
  count = Number(count || 0);

  if (!count) return "No reviews yet.";
  if (avg >= 4.5) return "Excellent feedback from buyers.";
  if (avg >= 4.0) return "Good buyer satisfaction.";
  if (avg >= 3.0) return "Mixed reviews.";

  return "Low satisfaction. Check comments carefully.";
}

async function api(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: isFormData
      ? (options.headers || {})
      : { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }

  return data;
}

function fillDashboard() {
  const user = getUser();
  const pageLabel = document.getElementById("currentPageLabel");
  if (pageLabel) pageLabel.textContent = pageTitleFromFile(currentPage());
  if (!user) return;

  const fields = {
    userName: user.name,
    userEmail: user.email,
    userRole: user.role,
    userPhone: user.phone || "Not added",
    userStudentId: user.student_id || "Not added",
    userDepartment: user.department || "Not added",
    userSemester: user.semester || "Not added",
    userVerification: user.verification_status || "pending"
  };

  Object.entries(fields).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });

  const profilePhotoSlots = document.querySelectorAll(".current-user-photo");
  profilePhotoSlots.forEach(slot => {
    slot.innerHTML = avatarHTML(user.profile_image, user.name, "large");
  });

  const adminCard = document.getElementById("adminCard");
  if (adminCard) {
    adminCard.style.display = user.role === "admin" ? "block" : "none";
  }
}

function protectVerifiedActions() {
  const user = getUser();

  if (["add-product.html", "add-service.html"].includes(currentPage()) && user && !isVerified(user)) {
    alert("Your account is not verified yet. Admin verification is required before posting.");
    window.location.href = "dashboard.html";
  }
}

// Register User with demo OTP
let pendingRegistrationIdForOtp = null;

const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const frontInput = document.getElementById("idCardFront");
    const backInput = document.getElementById("idCardBack");

    const payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim().toLowerCase(),
      password: document.getElementById("password").value.trim(),
      role: document.getElementById("role").value,
      phone: document.getElementById("phone").value.trim().replace(/\s+/g, ""),
      student_id: document.getElementById("studentId").value.trim(),
      department: document.getElementById("department").value.trim(),
      semester: document.getElementById("semester").value.trim()
    };

    if (Object.values(payload).some(v => !v)) {
      alert("Please fill all fields.");
      return;
    }

    if (!frontInput || !frontInput.files[0] || !backInput || !backInput.files[0]) {
      alert("ID card front and back images are required for account verification.");
      return;
    }

    if (!/^01\d{9}$/.test(payload.phone)) {
      alert("Enter a valid Bangladesh phone number like 01XXXXXXXXX.");
      return;
    }

    try {
      payload.id_card_front = await fileToDataUrl(frontInput.files[0]);
      payload.id_card_back = await fileToDataUrl(backInput.files[0]);

      const data = await api("/users/register", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      pendingRegistrationIdForOtp = data.pendingRegistrationId;

      const otpBox = document.getElementById("otpBox");
      const demoOtpText = document.getElementById("demoOtpText");
      if (demoOtpText) demoOtpText.textContent = data.demo_otp;
      if (otpBox) otpBox.style.display = "block";

      registerForm.style.display = "none";
      alert(`Demo OTP generated: ${data.demo_otp}. Enter this code to create your account.`);
    } catch (error) {
      alert(error.message);
    }
  });
}

async function verifyPhoneOtp() {
  const otp = document.getElementById("otpInput").value.trim();

  if (!pendingRegistrationIdForOtp) {
    alert("Please register first.");
    return;
  }

  if (!otp) {
    alert("Please enter OTP.");
    return;
  }

  try {
    await api("/users/verify-phone", {
      method: "POST",
      body: JSON.stringify({
        pending_registration_id: pendingRegistrationIdForOtp,
        otp
      })
    });

    alert("Phone verified and account created successfully. Now wait for admin approval.");
    window.location.href = "login.html";
  } catch (error) {
    alert(error.message);
  }
}

// Login User
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    try {
      const data = await api("/users/login", {
        method: "POST",
        body: JSON.stringify({
          email: document.getElementById("loginEmail").value.trim(),
          password: document.getElementById("loginPassword").value.trim()
        })
      });

      setUser(data.user);
      alert("Login successful!");
      window.location.href = "dashboard.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

// Profile
const profileForm = document.getElementById("profileForm");

if (profileForm) {
  const user = getUser();

  if (user) {
    document.getElementById("profileName").value = user.name || "";
    document.getElementById("profileEmail").value = user.email || "";
    document.getElementById("profilePhone").value = user.phone || "";
    document.getElementById("profileStudentId").value = user.student_id || "";
    document.getElementById("profileDepartment").value = user.department || "";
    document.getElementById("profileSemester").value = user.semester || "";
    document.getElementById("profileRole").value = user.role || "";
    document.getElementById("profileVerification").value = user.verification_status || "";
    const preview = document.getElementById("profileImagePreview");
    if (preview) preview.innerHTML = avatarHTML(user.profile_image, user.name, "large");
    const heroAvatar = document.getElementById("profileHeroAvatar");
    if (heroAvatar) heroAvatar.innerHTML = avatarHTML(user.profile_image, user.name, "large");
    const heroName = document.getElementById("profileHeroName");
    if (heroName) heroName.textContent = user.name || "My Profile";
    const heroMeta = document.getElementById("profileHeroMeta");
    if (heroMeta) heroMeta.textContent = `${user.department || "Department"} • ${user.semester || "Semester"}`;
    const roleBadge = document.getElementById("profileRoleBadge");
    if (roleBadge) roleBadge.outerHTML = badge(user.role || "user");
    const verificationBadge = document.getElementById("profileVerificationBadge");
    if (verificationBadge) verificationBadge.outerHTML = badge(user.verification_status || "pending");
    loadCurrentUserIdDocuments();
  }

  const profileImageInput = document.getElementById("profileImage");
  if (profileImageInput) {
    profileImageInput.addEventListener("change", async function () {
      try {
        const dataUrl = await fileToDataUrl(this.files[0]);
        const preview = document.getElementById("profileImagePreview");
        if (preview) preview.innerHTML = avatarHTML(dataUrl, document.getElementById("profileName").value || "User", "large");
      } catch (error) {
        alert(error.message);
        this.value = "";
      }
    });
  }


  const generatePhoneCodeBtn = document.getElementById("generatePhoneCodeBtn");
  if (generatePhoneCodeBtn) {
    generatePhoneCodeBtn.addEventListener("click", async function () {
      const user = getUser();
      const newPhone = document.getElementById("profilePhone").value.trim();
      if (!user || !newPhone) return;
      try {
        const data = await api(`/users/${user.id}/request-phone-change`, {
          method: "POST",
          body: JSON.stringify({ new_phone: newPhone })
        });
        alert(`${data.message}
Old phone: ${data.old_phone || user.phone}
Demo code: ${data.demo_code || "No code needed"}`);
      } catch (error) {
        alert(error.message);
      }
    });
  }

  profileForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const user = getUser();
    if (!user) return;

    let profile_image = user.profile_image || null;
    const imageInput = document.getElementById("profileImage");
    if (imageInput && imageInput.files[0]) {
      profile_image = await fileToDataUrl(imageInput.files[0]);
    }

    let id_card_front = null;
    let id_card_back = null;
    try {
      id_card_front = await fileToDataUrl(document.getElementById("profileIdCardFront")?.files[0]);
      id_card_back = await fileToDataUrl(document.getElementById("profileIdCardBack")?.files[0]);
    } catch (error) {
      alert(error.message);
      return;
    }

    const payload = {
      name: document.getElementById("profileName").value.trim(),
      phone: document.getElementById("profilePhone").value.trim(),
      student_id: document.getElementById("profileStudentId").value.trim(),
      department: document.getElementById("profileDepartment").value.trim(),
      semester: document.getElementById("profileSemester").value.trim(),
      profile_image,
      phone_change_code: document.getElementById("phoneChangeCode")?.value.trim(),
      id_card_front,
      id_card_back
    };

    try {
      const data = await api(`/users/${user.id}/profile`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });

      setUser(data.user);
      alert("Profile updated successfully.");
      window.location.reload();
    } catch (error) {
      alert(error.message);
    }
  });
}

// Add Product
const addProductForm = document.getElementById("addProductForm");

if (addProductForm) {
  addProductForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const user = getUser();
    if (!user) return;

    if (!isVerified(user)) {
      alert("Only verified campus users can add products.");
      return;
    }

    try {
      let product_image = null;
      const imageInput = document.getElementById("productImage");
      if (imageInput && imageInput.files[0]) {
        product_image = await fileToDataUrl(imageInput.files[0]);
      }

      const data = await api("/products/add", {
        method: "POST",
        body: JSON.stringify({
          user_id: user.id,
          title: document.getElementById("productTitle").value.trim(),
          category: document.getElementById("productCategory").value,
          price: document.getElementById("productPrice").value,
          quantity: document.getElementById("productQuantity") ? document.getElementById("productQuantity").value : 1,
          description: document.getElementById("productDescription").value.trim(),
          product_image,
          bkash_number: document.getElementById("productBkashNumber")?.value.trim(),
          payment_note: document.getElementById("productPaymentNote")?.value.trim()
        })
      });

      alert(data.message || "Product saved successfully.");
      window.location.href = "products.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

// Add Service
const addServiceForm = document.getElementById("addServiceForm");

if (addServiceForm) {
  addServiceForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const user = getUser();
    if (!user) return;

    if (!isVerified(user)) {
      alert("Only verified campus users can add services.");
      return;
    }

    try {
      const imageInput = document.getElementById("serviceImage");
      const attachmentInput = document.getElementById("serviceAttachment");

      if (imageInput && imageInput.files[0] && imageInput.files[0].size > 2 * 1024 * 1024) {
        throw new Error("Service image must be under 2 MB.");
      }
      if (attachmentInput && attachmentInput.files[0] && attachmentInput.files[0].size > 5 * 1024 * 1024) {
        throw new Error("Attachment must be under 5 MB.");
      }

      const formData = new FormData();
      formData.append("user_id", user.id);
      formData.append("title", document.getElementById("serviceTitle").value.trim());
      formData.append("category", document.getElementById("serviceCategory").value);
      formData.append("price", document.getElementById("servicePrice").value);
      formData.append("description", document.getElementById("serviceDescription").value.trim());
      formData.append("bkash_number", document.getElementById("serviceBkashNumber")?.value.trim() || "");
      formData.append("payment_note", document.getElementById("servicePaymentNote")?.value.trim() || "");
      if (imageInput && imageInput.files[0]) formData.append("service_image", imageInput.files[0]);
      if (attachmentInput && attachmentInput.files[0]) formData.append("service_file", attachmentInput.files[0]);

      const data = await api("/services/add", {
        method: "POST",
        body: formData
      });

      alert(data.message || "Service saved successfully.");
      window.location.href = "services.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

// Product list
let allProducts = [];
let productViewMode = "instock";

async function loadProducts() {
  const list = document.getElementById("productList");
  if (!list) return;

  try {
    allProducts = await api("/products");
    applyProductFilters();
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderProducts(products) {
  const list = document.getElementById("productList");
  if (!list) return;

  if (!products.length) {
    list.innerHTML = "<p>No approved products found.</p>";
    return;
  }

  list.innerHTML = products.map(product => `
    <div class="item-card">
      ${itemImageHTML(product.product_image, product.title)}
      <div class="card-topline">
        <h3>${escapeHTML(product.title)}</h3>
        ${badge(product.status)}
      </div>

      <p>${escapeHTML(product.description || "")}</p>
      <p><strong>Category:</strong> ${escapeHTML(product.category || "N/A")}</p>
      <p><strong>Price:</strong> ${money(product.price)}</p>
      ${stockHTML(product)}
      ${receiverPaymentInfoHTML(product, "Seller")}
      ${userProfileLink(product.user_id, product.seller_profile_image, product.seller_name, "Seller")}
      <p><strong>Rating:</strong> ⭐ ${product.avg_rating || 0}/5 (${product.review_count || 0} reviews)</p>
      <p class="muted">${reviewSummary(product.avg_rating, product.review_count)}</p>

      ${ownerListingActions("product", product)}
      ${Number(product.remaining_quantity ?? 1) > 0 && product.status === "active" ? `<button class="primary-btn" onclick="placeOrder(${product.id})">Buy Now</button>` : `<button class="secondary-btn" disabled>Sold</button>`}
      <button class="secondary-btn" onclick="window.location.href='product-details.html?id=${product.id}'">Details</button>
      <button class="secondary-btn" onclick="openFullReviews('product', ${product.id})">View Reviews</button>
    </div>
  `).join("");
}

function isProductInStock(product) {
  const quantity = Number(product.quantity || 1);
  const sold = Number(product.sold_quantity || 0);
  const remaining = Math.max(Number(product.remaining_quantity ?? (quantity - sold)), 0);
  return product.status === "active" && remaining > 0;
}

function applyProductFilters() {
  const list = document.getElementById("productList");
  if (!list) return;

  const search = document.getElementById("productSearch");
  const category = document.getElementById("productCategoryFilter");
  const sort = document.getElementById("productSort");

  let data = [...allProducts];

  const q = search ? search.value.toLowerCase() : "";
  const c = category ? category.value : "";
  const s = sort ? sort.value : "";
  const availabilityMode = productViewMode || "instock";

  if (availabilityMode === "instock") {
    data = data.filter(isProductInStock);
  }

  if (availabilityMode === "mine") {
    const user = getUser();
    data = user ? data.filter(p => Number(p.user_id) === Number(user.id)) : [];
  }

  if (q) {
    data = data.filter(p =>
      `${p.title} ${p.description} ${p.category}`.toLowerCase().includes(q)
    );
  }

  if (c) {
    data = data.filter(p => p.category === c);
  }

  if (s === "low") {
    data.sort((a, b) => Number(a.price) - Number(b.price));
  }

  if (s === "high") {
    data.sort((a, b) => Number(b.price) - Number(a.price));
  }

  if (s === "rating") {
    data.sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating));
  }

  renderProducts(data);
}

function setupProductFilters() {
  const search = document.getElementById("productSearch");
  const category = document.getElementById("productCategoryFilter");
  const sort = document.getElementById("productSort");

  [search, category, sort].forEach(el => {
    if (el) el.addEventListener("input", applyProductFilters);
  });

  const inStockBtn = document.getElementById("showInStockProductsBtn");
  const allBtn = document.getElementById("showAllProductsBtn");
  const myBtn = document.getElementById("showMyProductsBtn");

  function setProductMode(mode) {
    productViewMode = mode;

    [inStockBtn, allBtn, myBtn].forEach(btn => {
      if (btn) btn.classList.remove("active-filter-btn");
    });

    if (mode === "instock" && inStockBtn) inStockBtn.classList.add("active-filter-btn");
    if (mode === "all" && allBtn) allBtn.classList.add("active-filter-btn");
    if (mode === "mine" && myBtn) myBtn.classList.add("active-filter-btn");

    applyProductFilters();
  }

  if (inStockBtn) inStockBtn.addEventListener("click", () => setProductMode("instock"));
  if (allBtn) allBtn.addEventListener("click", () => setProductMode("all"));
  if (myBtn) myBtn.addEventListener("click", () => setProductMode("mine"));
}


async function loadProductDetailsPage() {
  const box = document.getElementById("productDetailsBox");
  if (!box) return;
  const id = getQueryParam("id");
  if (!id) {
    box.innerHTML = "<p>Product ID missing.</p>";
    return;
  }
  try {
    const product = await api(`/products/${id}`);
    box.innerHTML = `
      <div class="item-card detail-card">
        ${itemImageHTML(product.product_image, product.title)}
        <div class="card-topline"><h2>${escapeHTML(product.title)}</h2>${badge(product.status)}</div>
        <p>${escapeHTML(product.description || "No description")}</p>
        <p><strong>Category:</strong> ${escapeHTML(product.category || "N/A")}</p>
        <p><strong>Price:</strong> ${money(product.price)}</p>
        ${stockHTML(product)}
        ${receiverPaymentInfoHTML(product, "Seller")}
        ${userProfileLink(product.user_id, product.seller_profile_image, product.seller_name, "Seller")}
        <p><strong>Rating:</strong> ⭐ ${product.avg_rating || 0}/5 (${product.review_count || 0} reviews)</p>
        <p class="muted">${reviewSummary(product.avg_rating, product.review_count)}</p>
        ${ownerListingActions("product", product)}
      ${Number(product.remaining_quantity ?? 1) > 0 && product.status === "active" ? `<button class="primary-btn" onclick="placeOrder(${product.id})">Buy Now</button>` : `<button class="secondary-btn" disabled>Sold</button>`}
        <button class="secondary-btn" onclick="openFullReviews('product', ${product.id})">View Full Reviews</button>
        <button class="secondary-btn" onclick="window.location.href='products.html'">Back to Products</button>
      </div>
    `;
  } catch (error) {
    box.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadServiceDetailsPage() {
  const box = document.getElementById("serviceDetailsBox");
  if (!box) return;
  const id = getQueryParam("id");
  if (!id) {
    box.innerHTML = "<p>Service ID missing.</p>";
    return;
  }
  try {
    const service = await api(`/services/${id}`);
    box.innerHTML = `
      <div class="item-card detail-card">
        ${itemImageHTML(service.service_image, service.title)}
        <div class="card-topline"><h2>${escapeHTML(service.title)}</h2>${badge(service.status)}</div>
        <p>${escapeHTML(service.description || "No description")}</p>
        <p><strong>Category:</strong> ${escapeHTML(service.category || "N/A")}</p>
        <p><strong>Charge:</strong> ${money(service.price)}</p>
        ${serviceAvailabilityHTML(service)}
        ${receiverPaymentInfoHTML(service, "Provider")}
        ${serviceAttachmentHTML(service, "Portfolio/CV")}
        ${userProfileLink(service.user_id, service.provider_profile_image, service.provider_name, "Provider")}
        <p><strong>Rating:</strong> ⭐ ${service.avg_rating || 0}/5 (${service.review_count || 0} reviews)</p>
        <p class="muted">${reviewSummary(service.avg_rating, service.review_count)}</p>
        ${ownerListingActions("service", service)}
      ${service.status === "active" ? `<button class="primary-btn" onclick="bookService(${service.id})">Book Service</button>` : `<button class="secondary-btn" disabled>Not Available</button>`}
        <button class="secondary-btn" onclick="openFullReviews('service', ${service.id})">View Full Reviews</button>
        <button class="secondary-btn" onclick="window.location.href='services.html'">Back to Services</button>
      </div>
    `;
  } catch (error) {
    box.innerHTML = `<p>${error.message}</p>`;
  }
}

// Product Order Modal
function ensureOrderModal() {
  let modal = document.getElementById("orderModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "orderModal";
  modal.className = "modal-overlay";
  modal.style.display = "none";

  modal.innerHTML = `
    <div class="modal-box">
      <h2>Place Product Order</h2>

      <form id="orderForm">
        <input type="hidden" id="orderProductId">

        <label>Phone Number</label>
        <input type="text" id="orderBuyerPhone" placeholder="Enter your phone number" required>

        <label>Delivery Location</label>
        <select id="orderDeliveryLocation" required>
          <option value="">Select delivery location</option>
          <option value="Varendra University Campus">Varendra University Campus</option>
          <option value="Kazla">Kazla</option>
          <option value="Talaimari">Talaimari</option>
          <option value="Binodpur">Binodpur</option>
          <option value="Shaheb Bazar">Shaheb Bazar</option>
          <option value="New Market Rajshahi">New Market Rajshahi</option>
          <option value="Railgate">Railgate</option>
          <option value="Court Station">Court Station</option>
          <option value="Motihar">Motihar</option>
          <option value="Other Rajshahi Area">Other Rajshahi Area</option>
        </select>

        <label>Full Delivery Address / Meetup Details</label>
        <textarea id="orderDeliveryAddress" placeholder="Write full delivery address or meetup details" required></textarea>

        <label>Payment Method</label>
        <select id="orderPaymentMethod" required>
          <option value="">Select payment method</option>
          <option value="Cash on Delivery">Cash on Delivery</option>
          <option value="bKash">bKash</option>
        </select>

        <div id="bkashOrderFields" style="display:none;">
          <div id="orderBkashInstruction" class="payment-receiver-box"></div>
          <label>Your bKash Sender Number</label>
          <input type="text" id="orderSenderNumber" placeholder="01XXXXXXXXX">

          <label>bKash Transaction ID</label>
          <input type="text" id="orderTransactionId" placeholder="Enter bKash transaction ID">
        </div>

        <label>Additional Note <span class="optional-text">Optional</span></label>
        <textarea id="orderNote" placeholder="Optional message for seller"></textarea>

        <div class="form-actions">
          <button type="submit" class="primary-btn">Submit Order</button>
          <button type="button" class="secondary-btn" onclick="closeOrderModal()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("orderPaymentMethod").addEventListener("change", function () {
    const bkashFields = document.getElementById("bkashOrderFields");
    const senderInput = document.getElementById("orderSenderNumber");
    const trxInput = document.getElementById("orderTransactionId");

    if (this.value === "bKash") {
      bkashFields.style.display = "block";
      const infoBox = document.getElementById("orderBkashInstruction");
      if (infoBox) infoBox.innerHTML = receiverPaymentInfoHTML(window._currentOrderProduct || {}, "Seller") || `<strong>Seller bKash info</strong><p class="muted">Seller did not add a bKash number. Contact after approval or choose Cash on Delivery.</p>`;
      senderInput.required = true;
      trxInput.required = true;
    } else {
      bkashFields.style.display = "none";
      senderInput.required = false;
      trxInput.required = false;
      senderInput.value = "";
      trxInput.value = "";
    }
  });

  document.getElementById("orderForm").addEventListener("submit", submitOrderForm);

  return modal;
}

function closeOrderModal() {
  const modal = document.getElementById("orderModal");
  if (modal) modal.style.display = "none";
}

async function placeOrder(productId) {
  const user = getUser();

  if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  if (!isVerified(user)) {
    alert("Only verified campus users can order products.");
    return;
  }

  const modal = ensureOrderModal();

  window._currentOrderProduct = await api(`/products/${productId}`);
  document.getElementById("orderProductId").value = productId;
  document.getElementById("orderBuyerPhone").value = user.phone || "";
  document.getElementById("orderDeliveryLocation").value = "";
  document.getElementById("orderDeliveryAddress").value = "";
  document.getElementById("orderPaymentMethod").value = "";
  document.getElementById("orderSenderNumber").value = "";
  document.getElementById("orderTransactionId").value = "";
  document.getElementById("orderNote").value = "";
  document.getElementById("bkashOrderFields").style.display = "none";

  modal.style.display = "flex";
}

async function submitOrderForm(event) {
  event.preventDefault();

  const user = getUser();

  if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  const product_id = document.getElementById("orderProductId").value;
  const buyer_phone = document.getElementById("orderBuyerPhone").value.trim();
  const delivery_location = document.getElementById("orderDeliveryLocation").value;
  const delivery_address = document.getElementById("orderDeliveryAddress").value.trim();
  const payment_method = document.getElementById("orderPaymentMethod").value;
  const sender_number = document.getElementById("orderSenderNumber").value.trim();
  const transaction_id = document.getElementById("orderTransactionId").value.trim();
  const note = document.getElementById("orderNote").value.trim();

  if (!buyer_phone || !delivery_location || !delivery_address || !payment_method) {
    alert("Please fill all required order information.");
    return;
  }

  if (payment_method === "bKash" && (!sender_number || !transaction_id)) {
    alert("Please enter bKash sender number and transaction ID.");
    return;
  }

  try {
    const data = await api("/orders", {
      method: "POST",
      body: JSON.stringify({
        buyer_id: user.id,
        product_id,
        buyer_phone,
        delivery_type: "Rajshahi City Delivery",
        delivery_location,
        delivery_address,
        payment_method,
        sender_number,
        transaction_id,
        note
      })
    });

    alert(data.message || "Order placed successfully. Waiting for seller approval.");
    closeOrderModal();
    window.location.href = "orders.html";
  } catch (error) {
    alert(error.message);
  }
}


function ensureListingModal() {
  let modal = document.getElementById("listingEditModal");
  if (modal) return modal;
  modal = document.createElement("div");
  modal.id = "listingEditModal";
  modal.className = "modal-overlay";
  modal.style.display = "none";
  document.body.appendChild(modal);
  return modal;
}

function closeListingModal() {
  const modal = document.getElementById("listingEditModal");
  if (modal) modal.style.display = "none";
}

async function openProductEditForm(productId) {
  const user = getUser();
  if (!user) return;
  try {
    const product = await api(`/products/${productId}`);
    if (Number(product.user_id) !== Number(user.id)) return alert("You can edit only your own product.");
    const modal = ensureListingModal();
    modal.innerHTML = `
      <div class="modal-box large-modal">
        <div class="card-topline"><h2>Edit Product Listing</h2><button class="secondary-btn" onclick="closeListingModal()">Close</button></div>
        <form id="productEditForm" class="inline-edit-form">
          <input type="hidden" id="editProductId" value="${product.id}">
          <div class="form-grid-2">
            <div class="form-group"><label>Product Title</label><input id="editProductTitle" value="${escapeHTML(product.title)}" required></div>
            <div class="form-group"><label>Category</label><input id="editProductCategory" value="${escapeHTML(product.category || 'Others')}" required></div>
            <div class="form-group"><label>Price</label><input type="number" id="editProductPrice" value="${product.price || 0}" required></div>
            <div class="form-group"><label>Total Quantity</label><input type="number" min="1" id="editProductQuantity" value="${product.quantity || 1}" required></div>
            <div class="form-group"><label>Seller bKash Number</label><input id="editProductBkash" value="${escapeHTML(product.bkash_number || '')}" placeholder="01XXXXXXXXX"></div>
            <div class="form-group"><label>Money Sending Note</label><textarea id="editProductPaymentNote" placeholder="Instruction for buyer">${escapeHTML(product.payment_note || '')}</textarea></div>
          </div>
          <div class="form-group"><label>Description</label><textarea id="editProductDescription" required>${escapeHTML(product.description || '')}</textarea></div>
          <div class="form-group"><label>Replace Product Image (optional)</label><input type="file" id="editProductImage" accept="image/*"><small class="muted">Leave empty to keep current image.</small></div>
          ${itemImageHTML(product.product_image, product.title)}
          <button class="primary-btn full-btn" type="submit">Save Product Changes</button>
        </form>
      </div>`;
    modal.style.display = "flex";
    document.getElementById("productEditForm").addEventListener("submit", submitProductEditForm);
  } catch (error) {
    alert(error.message);
  }
}

async function submitProductEditForm(e) {
  e.preventDefault();
  const user = getUser();
  const productId = document.getElementById("editProductId").value;
  try {
    const current = await api(`/products/${productId}`);
    let product_image = current.product_image || null;
    const imageInput = document.getElementById("editProductImage");
    if (imageInput && imageInput.files[0]) product_image = await fileToDataUrl(imageInput.files[0]);
    const data = await api(`/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify({
        user_id: user.id,
        title: document.getElementById("editProductTitle").value.trim(),
        description: document.getElementById("editProductDescription").value.trim(),
        price: document.getElementById("editProductPrice").value,
        category: document.getElementById("editProductCategory").value.trim(),
        quantity: document.getElementById("editProductQuantity").value,
        product_image,
        bkash_number: document.getElementById("editProductBkash")?.value.trim(),
        payment_note: document.getElementById("editProductPaymentNote")?.value.trim()
      })
    });
    alert(data.message || "Product updated.");
    closeListingModal();
    loadProducts();
    loadProductDetailsPage();
  } catch (error) {
    alert(error.message);
  }
}

async function openQuantityForm(productId) {
  const user = getUser();
  if (!user) return;
  try {
    const product = await api(`/products/${productId}`);
    const modal = ensureListingModal();
    modal.innerHTML = `
      <div class="modal-box">
        <div class="card-topline"><h2>Update Product Stock</h2><button class="secondary-btn" onclick="closeListingModal()">Close</button></div>
        <form id="quantityEditForm" class="inline-edit-form">
          <input type="hidden" id="quantityProductId" value="${product.id}">
          <p class="muted">Already sold: ${product.sold_quantity || 0}. Total quantity cannot be lower than sold quantity.</p>
          <div class="form-group"><label>Total Quantity Available</label><input type="number" min="${Math.max(1, Number(product.sold_quantity || 0))}" id="editQuantityValue" value="${product.quantity || 1}" required></div>
          <button class="primary-btn full-btn" type="submit">Update Stock</button>
        </form>
      </div>`;
    modal.style.display = "flex";
    document.getElementById("quantityEditForm").addEventListener("submit", submitQuantityForm);
  } catch (error) {
    alert(error.message);
  }
}

async function submitQuantityForm(e) {
  e.preventDefault();
  const user = getUser();
  const productId = document.getElementById("quantityProductId").value;
  const quantity = document.getElementById("editQuantityValue").value;
  try {
    const data = await api(`/products/${productId}/quantity`, {
      method: "PUT",
      body: JSON.stringify({ user_id: user.id, quantity })
    });
    alert(data.message || "Quantity updated.");
    closeListingModal();
    loadProducts();
    loadProductDetailsPage();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteProduct(productId) {
  const user = getUser();
  if (!user || !confirm("Delete this product listing?")) return;
  try {
    const data = await api(`/products/${productId}?user_id=${user.id}`, { method: "DELETE" });
    alert(data.message || "Product deleted.");
    if (currentPage() === "product-details.html") window.location.href = "products.html";
    else loadProducts();
  } catch (error) {
    alert(error.message);
  }
}

async function openServiceEditForm(serviceId) {
  const user = getUser();
  if (!user) return;
  try {
    const service = await api(`/services/${serviceId}`);
    if (Number(service.user_id) !== Number(user.id)) return alert("You can edit only your own service.");
    const modal = ensureListingModal();
    modal.innerHTML = `
      <div class="modal-box large-modal">
        <div class="card-topline"><h2>Edit Service Listing</h2><button class="secondary-btn" onclick="closeListingModal()">Close</button></div>
        <form id="serviceEditForm" class="inline-edit-form">
          <input type="hidden" id="editServiceId" value="${service.id}">
          <div class="form-grid-2">
            <div class="form-group"><label>Service Title</label><input id="editServiceTitle" value="${escapeHTML(service.title)}" required></div>
            <div class="form-group"><label>Category</label><input id="editServiceCategory" value="${escapeHTML(service.category || 'Others')}" required></div>
            <div class="form-group"><label>Charge</label><input type="number" id="editServicePrice" value="${service.price || 0}" required></div>
            <div class="form-group"><label>Provider bKash Number</label><input id="editServiceBkash" value="${escapeHTML(service.bkash_number || '')}" placeholder="01XXXXXXXXX"></div>
            <div class="form-group"><label>Money Sending Note</label><textarea id="editServicePaymentNote" placeholder="Instruction for student">${escapeHTML(service.payment_note || '')}</textarea></div>
          </div>
          <div class="form-group"><label>Description</label><textarea id="editServiceDescription" required>${escapeHTML(service.description || '')}</textarea></div>
          <div class="form-group"><label>Replace Service Image (optional)</label><input type="file" id="editServiceImage" accept="image/*"><small class="muted">Leave empty to keep current image.</small></div>
          <div class="form-group"><label>Replace Portfolio/CV/File (optional)</label><input type="file" id="editServiceAttachment" accept="image/*,.pdf,.doc,.docx"><small class="muted">Leave empty to keep current file.</small></div>
          ${itemImageHTML(service.service_image, service.title)}
          ${serviceAttachmentHTML(service, "Current Portfolio/CV")}
          <button class="primary-btn full-btn" type="submit">Save Service Changes</button>
        </form>
      </div>`;
    modal.style.display = "flex";
    document.getElementById("serviceEditForm").addEventListener("submit", submitServiceEditForm);
  } catch (error) {
    alert(error.message);
  }
}

async function submitServiceEditForm(e) {
  e.preventDefault();
  const user = getUser();
  const serviceId = document.getElementById("editServiceId").value;
  try {
    const current = await api(`/services/${serviceId}`);
    const imageInput = document.getElementById("editServiceImage");
    const attachmentInput = document.getElementById("editServiceAttachment");

    if (imageInput && imageInput.files[0] && imageInput.files[0].size > 2 * 1024 * 1024) {
      throw new Error("Service image must be under 2 MB.");
    }
    if (attachmentInput && attachmentInput.files[0] && attachmentInput.files[0].size > 5 * 1024 * 1024) {
      throw new Error("Attachment must be under 5 MB.");
    }

    const formData = new FormData();
    formData.append("user_id", user.id);
    formData.append("title", document.getElementById("editServiceTitle").value.trim());
    formData.append("description", document.getElementById("editServiceDescription").value.trim());
    formData.append("category", document.getElementById("editServiceCategory").value.trim());
    formData.append("price", document.getElementById("editServicePrice").value);
    formData.append("bkash_number", document.getElementById("editServiceBkash")?.value.trim() || "");
    formData.append("payment_note", document.getElementById("editServicePaymentNote")?.value.trim() || "");

    // Keep old files when the user does not choose replacement files.
    formData.append("service_image", current.service_image || "");
    formData.append("service_file_data", current.service_file_data || "");
    formData.append("service_file_name", current.service_file_name || "");
    formData.append("service_file_type", current.service_file_type || "");

    if (imageInput && imageInput.files[0]) formData.set("service_image", imageInput.files[0]);
    if (attachmentInput && attachmentInput.files[0]) formData.append("service_file", attachmentInput.files[0]);

    const data = await api(`/services/${serviceId}`, {
      method: "PUT",
      body: formData
    });
    alert(data.message || "Service updated.");
    closeListingModal();
    loadServices();
    loadServiceDetailsPage();
  } catch (error) {
    alert(error.message);
  }
}

async function updateServiceAvailability(serviceId, status) {
  const user = getUser();
  if (!user) return;
  try {
    const data = await api(`/services/${serviceId}/availability`, {
      method: "PUT",
      body: JSON.stringify({ user_id: user.id, status })
    });
    alert(data.message || "Service availability updated.");
    loadServices();
    loadServiceDetailsPage();
  } catch (error) {
    alert(error.message);
  }
}

async function deleteService(serviceId) {
  const user = getUser();
  if (!user || !confirm("Delete this service listing?")) return;
  try {
    const data = await api(`/services/${serviceId}?user_id=${user.id}`, { method: "DELETE" });
    alert(data.message || "Service deleted.");
    if (currentPage() === "service-details.html") window.location.href = "services.html";
    else loadServices();
  } catch (error) {
    alert(error.message);
  }
}


// Services
let allServices = [];
let serviceViewMode = "available";

async function loadServices() {
  const list = document.getElementById("serviceList");
  if (!list) return;

  try {
    allServices = await api("/services");
    applyServiceFilters();
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

function renderServices(services) {
  const list = document.getElementById("serviceList");
  if (!list) return;

  if (!services.length) {
    list.innerHTML = "<p>No approved services found.</p>";
    return;
  }

  list.innerHTML = services.map(service => `
    <div class="item-card">
      ${itemImageHTML(service.service_image, service.title)}
      <div class="card-topline">
        <h3>${escapeHTML(service.title)}</h3>
        ${badge(service.status)}
      </div>

      <p>${escapeHTML(service.description || "")}</p>
      <p><strong>Category:</strong> ${escapeHTML(service.category || "N/A")}</p>
      <p><strong>Charge:</strong> ${money(service.price)}</p>
      ${serviceAvailabilityHTML(service)}
      ${receiverPaymentInfoHTML(service, "Provider")}
      ${serviceAttachmentHTML(service, "Portfolio/CV")}
      ${userProfileLink(service.user_id, service.provider_profile_image, service.provider_name, "Provider")}
      <p><strong>Rating:</strong> ⭐ ${service.avg_rating || 0}/5 (${service.review_count || 0} reviews)</p>

      ${ownerListingActions("service", service)}
      ${service.status === "active" ? `<button class="primary-btn" onclick="bookService(${service.id})">Book Service</button>` : `<button class="secondary-btn" disabled>Not Available</button>`}
      <button class="secondary-btn" onclick="window.location.href='service-details.html?id=${service.id}'">Details</button>
      <button class="secondary-btn" onclick="openFullReviews('service', ${service.id})">View Reviews</button>
    </div>
  `).join("");
}

function isServiceAvailable(service) {
  return service.status === "active";
}

function applyServiceFilters() {
  const list = document.getElementById("serviceList");
  if (!list) return;

  const search = document.getElementById("serviceSearch");
  const category = document.getElementById("serviceCategoryFilter");
  const sort = document.getElementById("serviceSort");

  let data = [...allServices];

  const q = search ? search.value.toLowerCase() : "";
  const c = category ? category.value : "";
  const s = sort ? sort.value : "";
  const availabilityMode = serviceViewMode || "available";

  if (availabilityMode === "available") {
    data = data.filter(isServiceAvailable);
  }

  if (availabilityMode === "mine") {
    const user = getUser();
    data = user ? data.filter(s => Number(s.user_id) === Number(user.id)) : [];
  }

  if (q) {
    data = data.filter(s =>
      `${s.title} ${s.description} ${s.category}`.toLowerCase().includes(q)
    );
  }

  if (c) {
    data = data.filter(s => s.category === c);
  }

  if (s === "low") {
    data.sort((a, b) => Number(a.price) - Number(b.price));
  }

  if (s === "high") {
    data.sort((a, b) => Number(b.price) - Number(a.price));
  }

  if (s === "rating") {
    data.sort((a, b) => Number(b.avg_rating) - Number(a.avg_rating));
  }

  renderServices(data);
}

function setupServiceFilters() {
  const search = document.getElementById("serviceSearch");
  const category = document.getElementById("serviceCategoryFilter");
  const sort = document.getElementById("serviceSort");

  [search, category, sort].forEach(el => {
    if (el) el.addEventListener("input", applyServiceFilters);
  });

  const availableBtn = document.getElementById("showAvailableServicesBtn");
  const allBtn = document.getElementById("showAllServicesBtn");
  const myBtn = document.getElementById("showMyServicesBtn");

  function setServiceMode(mode) {
    serviceViewMode = mode;

    [availableBtn, allBtn, myBtn].forEach(btn => {
      if (btn) btn.classList.remove("active-filter-btn");
    });

    if (mode === "available" && availableBtn) availableBtn.classList.add("active-filter-btn");
    if (mode === "all" && allBtn) allBtn.classList.add("active-filter-btn");
    if (mode === "mine" && myBtn) myBtn.classList.add("active-filter-btn");

    applyServiceFilters();
  }

  if (availableBtn) availableBtn.addEventListener("click", () => setServiceMode("available"));
  if (allBtn) allBtn.addEventListener("click", () => setServiceMode("all"));
  if (myBtn) myBtn.addEventListener("click", () => setServiceMode("mine"));
}

function ensureServiceBookingModal() {
  let modal = document.getElementById("serviceBookingModal");

  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "serviceBookingModal";
  modal.className = "modal-overlay";
  modal.style.display = "none";

  modal.innerHTML = `
    <div class="modal-box">
      <h2>Book Service</h2>

      <form id="serviceBookingForm">
        <input type="hidden" id="bookingServiceId">

        <label>Phone Number</label>
        <input type="text" id="bookingRequesterPhone" placeholder="Enter your phone number" required>

        <label>Preferred Contact Method</label>
        <select id="bookingPreferredContact" required>
          <option value="">Select contact method</option>
          <option value="Phone">Phone number after provider approval</option>
          <option value="Email">Email after provider approval</option>
        </select>
        <small class="muted">Only your selected contact method will be shown after the provider approves your booking.</small>

        <label>Meeting Location / Service Location</label>
        <select id="bookingMeetingLocation" required>
          <option value="">Select location</option>
          <option value="Varendra University Campus">Varendra University Campus</option>
          <option value="Kazla">Kazla</option>
          <option value="Talaimari">Talaimari</option>
          <option value="Binodpur">Binodpur</option>
          <option value="Shaheb Bazar">Shaheb Bazar</option>
          <option value="New Market Rajshahi">New Market Rajshahi</option>
          <option value="Railgate">Railgate</option>
          <option value="Court Station">Court Station</option>
          <option value="Motihar">Motihar</option>
          <option value="Online">Online</option>
          <option value="Other Rajshahi Area">Other Rajshahi Area</option>
        </select>

        <label>Preferred Date/Time</label>
        <input type="text" id="bookingRequestedDatetime" placeholder="Example: Monday 4 PM">

        <label>Payment Method</label>
        <select id="bookingPaymentMethod" required>
          <option value="">Select payment method</option>
          <option value="Cash">Cash</option>
          <option value="bKash">bKash</option>
        </select>

        <div id="bkashBookingFields" style="display:none;">
          <div id="bookingBkashInstruction" class="payment-receiver-box"></div>
          <label>Your bKash Sender Number</label>
          <input type="text" id="bookingSenderNumber" placeholder="01XXXXXXXXX">

          <label>bKash Transaction ID</label>
          <input type="text" id="bookingTransactionId" placeholder="Enter bKash transaction ID">
        </div>

        <label>Service Details / Note <span class="optional-text">Optional</span></label>
        <textarea id="bookingNote" placeholder="Optional message for provider"></textarea>

        <div class="form-actions">
          <button type="submit" class="primary-btn">Submit Booking</button>
          <button type="button" class="secondary-btn" onclick="closeServiceBookingModal()">Cancel</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("bookingPaymentMethod").addEventListener("change", function () {
    const bkashFields = document.getElementById("bkashBookingFields");
    const senderInput = document.getElementById("bookingSenderNumber");
    const trxInput = document.getElementById("bookingTransactionId");

    if (this.value === "bKash") {
      bkashFields.style.display = "block";
      const infoBox = document.getElementById("bookingBkashInstruction");
      if (infoBox) infoBox.innerHTML = receiverPaymentInfoHTML(window._currentBookingService || {}, "Provider") || `<strong>Provider bKash info</strong><p class="muted">Provider did not add a bKash number. Contact after approval or choose Cash.</p>`;
      senderInput.required = true;
      trxInput.required = true;
    } else {
      bkashFields.style.display = "none";
      senderInput.required = false;
      trxInput.required = false;
      senderInput.value = "";
      trxInput.value = "";
    }
  });

  document.getElementById("serviceBookingForm").addEventListener("submit", submitServiceBookingForm);

  return modal;
}

function closeServiceBookingModal() {
  const modal = document.getElementById("serviceBookingModal");
  if (modal) modal.style.display = "none";
}

async function bookService(serviceId) {
  const user = getUser();

  if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  if (!isVerified(user)) {
    alert("Only verified campus users can book services.");
    return;
  }

  const modal = ensureServiceBookingModal();

  window._currentBookingService = await api(`/services/${serviceId}`);
  document.getElementById("bookingServiceId").value = serviceId;
  document.getElementById("bookingRequesterPhone").value = user.phone || "";
  document.getElementById("bookingPreferredContact").value = "";
  document.getElementById("bookingMeetingLocation").value = "";
  document.getElementById("bookingRequestedDatetime").value = "";
  document.getElementById("bookingPaymentMethod").value = "";
  document.getElementById("bookingSenderNumber").value = "";
  document.getElementById("bookingTransactionId").value = "";
  document.getElementById("bookingNote").value = "";
  document.getElementById("bkashBookingFields").style.display = "none";

  modal.style.display = "flex";
}

async function submitServiceBookingForm(event) {
  event.preventDefault();

  const user = getUser();

  if (!user) {
    alert("Please login first.");
    window.location.href = "login.html";
    return;
  }

  const service_id = document.getElementById("bookingServiceId").value;
  const requester_phone = document.getElementById("bookingRequesterPhone").value.trim();
  const preferred_contact = document.getElementById("bookingPreferredContact").value;
  const meeting_location = document.getElementById("bookingMeetingLocation").value;
  const requested_datetime = document.getElementById("bookingRequestedDatetime").value.trim();
  const payment_method = document.getElementById("bookingPaymentMethod").value;
  const sender_number = document.getElementById("bookingSenderNumber").value.trim();
  const transaction_id = document.getElementById("bookingTransactionId").value.trim();
  const booking_note = document.getElementById("bookingNote").value.trim();

  if (!requester_phone || !preferred_contact || !meeting_location || !payment_method) {
    alert("Please fill all required booking information.");
    return;
  }

  if (!["Phone", "Email"].includes(preferred_contact)) {
    alert("Contact method must be Phone or Email only.");
    return;
  }

  if (payment_method === "bKash" && (!sender_number || !transaction_id)) {
    alert("Please enter bKash sender number and transaction ID.");
    return;
  }

  try {
    const data = await api("/bookings/add", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        service_id,
        requester_phone,
        preferred_contact,
        meeting_location,
        requested_datetime,
        payment_method,
        sender_number,
        transaction_id,
        booking_note
      })
    });

    alert(data.message || "Booking submitted successfully. Waiting for provider approval.");
    closeServiceBookingModal();
    window.location.href = "booking.html";
  } catch (error) {
    alert(error.message);
  }
}

function alreadyReviewedHTML(review) {
  if (!review) return "";

  const rating = Number(review.rating || 0);

  return `
    <button class="secondary-btn" disabled>
      Already Reviewed ${"⭐".repeat(rating)}
    </button>
  `;
}

// Orders
async function loadMyOrders() {
  const list = document.getElementById("orderList");
  if (!list) return;

  const user = getUser();
  if (!user) return;

  try {
    const orders = await api(`/orders/user/${user.id}`);
    const allReviews = await api("/reviews");
    const myProductReviews = allReviews.filter(r =>
      Number(r.user_id || r.reviewer_id) === Number(user.id) &&
        r.order_id
    );

    if (!orders.length) {
      list.innerHTML = "<p>No orders found.</p>";
      return;
    }

    list.innerHTML = orders.map(order => `
      <div class="item-card">
        <h3>${order.product_name}</h3>

        ${userProfileLink(order.seller_id, order.seller_profile_image, order.seller_name, "Seller")}
        <p><strong>Status:</strong> ${badge(order.status)}</p>
        <p><strong>Payment:</strong> ${badge(order.payment_status)} (${order.payment_method || "N/A"})</p>
        ${order.payment_method === "bKash" ? receiverPaymentInfoHTML({ bkash_number: order.seller_bkash_number, payment_note: order.seller_payment_note }, "Seller") : ""}
        <p><strong>Delivery:</strong> ${badge(order.delivery_status)} - ${order.delivery_location || "N/A"}</p>
        <p><strong>Total:</strong> ${money(order.total_amount)}</p>

        ${
          order.payment_method === "bKash"
            ? `
              <p><strong>bKash Sender Number:</strong> ${order.sender_number || "N/A"}</p>
              <p><strong>bKash Transaction ID:</strong> ${order.transaction_id || "N/A"}</p>
            `
            : ""
        }

        ${
          order.issue_details
            ? `<div class="issue-box"><strong>Reported Issue:</strong> ${order.issue_category ? escapeHTML(order.issue_category) : "Other"}<br>${escapeHTML(order.issue_details)}${order.issue_image ? `<br><img class="review-image" src="${order.issue_image}" alt="Issue image">` : ""}</div>`
            : ""
        }

        ${
          order.status === "pending_seller_approval"
            ? `<button class="danger-btn" onclick="cancelMyOrder(${order.id})">Cancel Order</button>`
            : ""
        }

        ${
          order.status === "awaiting_buyer_confirmation"
            ? `
              <button class="primary-btn" onclick="confirmOrderReceived(${order.id}, true)">I Received Properly</button>
              <button class="danger-btn" onclick="openIssueReportModal('product', ${order.id})">Report Problem</button>
            `
            : ""
        }

        ${
          order.status === "completed" || order.status === "issue_reported"
            ? (() => {
              const existingReview = myProductReviews.find(r =>
                Number(r.order_id) === Number(order.id)
              );

              return existingReview
                ? alreadyReviewedHTML(existingReview)
                : `<button class="secondary-btn" onclick="reviewProduct(${order.product_id}, ${order.id})">Review Product</button>`;
            })()
          : ""
        }
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadSellerOrders() {
  const list = document.getElementById("sellerOrderList");
  if (!list) return;

  const user = getUser();
  if (!user) return;

  try {
    const orders = await api(`/orders/seller/${user.id}`);

    if (!orders.length) {
      list.innerHTML = "<p>No received orders found.</p>";
      return;
    }

    list.innerHTML = orders.map(order => `
      <div class="item-card received-card">
        <div class="received-head">${avatarHTML(order.buyer_profile_image, order.buyer_name)}<div><h3>${order.product_name}</h3><p><strong>Buyer:</strong> ${order.buyer_name || "Unknown"}</p></div></div>
        <p><strong>Buyer Email:</strong> ${order.buyer_email || "N/A"}</p>
        <p><strong>Buyer Phone:</strong> ${order.visible_buyer_phone || "Hidden until you approve"}</p>

        <p><strong>Delivery Location:</strong> ${order.delivery_location || "N/A"}</p>
        <p><strong>Delivery Address:</strong> ${order.visible_delivery_address || "Hidden until you approve"}</p>

        <p><strong>Payment Method:</strong> ${order.payment_method || "N/A"}</p>
        <p><strong>Payment Status:</strong> ${badge(order.payment_status)}</p>

        ${
          order.payment_method === "bKash"
            ? `
              <p><strong>bKash Sender Number:</strong> ${order.sender_number || "N/A"}</p>
              <p><strong>bKash Transaction ID:</strong> ${order.transaction_id || "N/A"}</p>
            `
            : ""
        }

        <p><strong>Delivery Status:</strong> ${badge(order.delivery_status)}</p>
        <p><strong>Order Status:</strong> ${badge(order.status)}</p>
        <p><strong>Total:</strong> ${money(order.total_amount)}</p>
        <p><strong>Note:</strong> ${order.note || "No note"}</p>
        ${order.issue_details ? `<div class="issue-box"><strong>Buyer Reported Issue:</strong> ${order.issue_category ? escapeHTML(order.issue_category) : "Other"}<br>${escapeHTML(order.issue_details)}${order.issue_image ? `<br><img class="review-image" src="${order.issue_image}" alt="Issue image">` : ""}</div>` : ""}

        ${
          order.status === "pending_seller_approval"
            ? `
              <button class="primary-btn" onclick="sellerApproveOrder(${order.id}, 'approve')">Approve Order</button>
              <button class="danger-btn" onclick="sellerApproveOrder(${order.id}, 'reject')">Reject Order</button>
            `
            : ""
        }

        ${
          order.status === "seller_approved" || order.status === "processing"
            ? `
              <button class="secondary-btn" onclick="updateOrderStatusFromSeller(${order.id}, 'processing')">Processing</button>
              ${order.payment_status === "paid"
                ? `<button class="primary-btn" onclick="updateOrderStatusFromSeller(${order.id}, 'awaiting_buyer_confirmation')">Mark Delivered / Ask Buyer Confirmation</button>`
                : `<p class="muted">Confirm payment first. Then you can mark delivered and request buyer confirmation.</p>`}
            `
            : ""
        }

        ${
          order.status !== "pending_seller_approval" && order.status !== "seller_rejected" && order.status !== "completed" && order.payment_status !== "paid"
            ? `<button class="secondary-btn" onclick="updatePaymentFromSeller(${order.id}, 'paid')">Mark Payment Paid</button>`
            : ""
        }
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function sellerApproveOrder(orderId, action) {
  const user = getUser();

  if (!user) {
    alert("Please login first.");
    return;
  }

  const confirmText = action === "approve" ? "Approve this order?" : "Reject this order?";
  if (!confirm(confirmText)) return;

  try {
    const data = await api(`/orders/${orderId}/seller-approval`, {
      method: "PUT",
      body: JSON.stringify({
        seller_id: user.id,
        action
      })
    });

    alert(data.message || "Order updated successfully.");
    loadSellerOrders();
  } catch (error) {
    alert(error.message);
  }
}

async function updateOrderStatusFromSeller(orderId, status) {
  try {
    const data = await api(`/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });

    alert(data.message || "Order updated successfully.");
    loadSellerOrders();
  } catch (error) {
    alert(error.message);
  }
}

async function updatePaymentFromSeller(orderId, payment_status) {
  try {
    const data = await api(`/orders/${orderId}/status`, {
      method: "PUT",
      body: JSON.stringify({ payment_status })
    });

    alert(data.message || "Payment updated successfully.");
    loadSellerOrders();
  } catch (error) {
    alert(error.message);
  }
}


async function cancelMyOrder(orderId) {
  const user = getUser();
  if (!user) return;
  if (!confirm("Cancel this order? You can cancel only before seller approval.")) return;

  try {
    const data = await api(`/orders/${orderId}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ buyer_id: user.id })
    });
    alert(data.message || "Order cancelled successfully.");
    loadMyOrders();
  } catch (error) {
    alert(error.message);
  }
}

async function confirmOrderReceived(orderId, received, issueDetails = "", issueCategory = "", issueImage = null) {
  const user = getUser();
  if (!user) return;

  if (received) {
    if (!confirm("Confirm that you received this product properly?")) return;
  } else if (!issueDetails || issueDetails.trim().length < 10) {
    alert("Please describe the product issue with at least 10 characters.");
    return;
  }

  try {
    const data = await api(`/orders/${orderId}/buyer-confirmation`, {
      method: "PUT",
      body: JSON.stringify({ buyer_id: user.id, received, issue_details: issueDetails.trim(), issue_category: issueCategory, issue_image: issueImage })
    });

    alert(data.message || "Confirmation updated.");
    closeIssueReportModal();
    loadMyOrders();
  } catch (error) {
    alert(error.message);
  }
}

function alreadyReviewedHTML(review) {
  if (!review) return "";

  const rating = Number(review.rating || 0);
  const stars = "⭐".repeat(rating);

  return `
    <button class="secondary-btn" disabled>
      Already Reviewed ${stars}
    </button>
  `;
}

// Bookings
async function loadBookings() {
  const list = document.getElementById("bookingList");
  if (!list) return;

  const user = getUser();
  if (!user) return;

  try {
    const bookings = user.role === "admin"
      ? await api("/bookings")
      : await api(`/bookings/user/${user.id}`);

    const allReviews = await api("/reviews");

    const myServiceReviews = allReviews.filter(r =>
      Number(r.user_id || r.reviewer_id) === Number(user.id) &&
      Number(r.booking_id || 0) > 0
    );

    if (!bookings.length) {
      list.innerHTML = "<p>No bookings found.</p>";
      return;
    }

    list.innerHTML = bookings.map(booking => {
      const existingReview = myServiceReviews.find(r =>
        Number(r.booking_id) === Number(booking.id)
      );

      return `
        <div class="item-card">
          <h3>${booking.service_title}</h3>

          ${userProfileLink(booking.provider_id, booking.provider_profile_image, booking.provider_name, "Provider")}
          <p><strong>Status:</strong> ${badge(booking.status)}</p>
          <p><strong>Payment:</strong> ${badge(booking.payment_status)} (${booking.payment_method || "N/A"})</p>
          ${booking.payment_method === "bKash" ? receiverPaymentInfoHTML({ bkash_number: booking.provider_bkash_number, payment_note: booking.provider_payment_note }, "Provider") : ""}
          <p><strong>Meeting Location:</strong> ${booking.meeting_location || "N/A"}</p>
          <p><strong>Preferred Contact:</strong> ${booking.preferred_contact || "N/A"}</p>
          <p><strong>Preferred Time:</strong> ${booking.requested_datetime || "N/A"}</p>
          ${booking.service_file_data ? serviceAttachmentHTML({ id: booking.service_id, service_file_data: booking.service_file_data, service_file_name: booking.service_file_name }, "Service File") : ""}

          ${
            booking.payment_method === "bKash"
              ? `
                <p><strong>bKash Sender Number:</strong> ${booking.sender_number || "N/A"}</p>
                <p><strong>bKash Transaction ID:</strong> ${booking.transaction_id || "N/A"}</p>
              `
              : ""
          }

          <p><strong>Note:</strong> ${booking.booking_note || "No note"}</p>

          ${
            booking.issue_details
              ? `<div class="issue-box">
                  <strong>Reported Issue:</strong> ${booking.issue_category ? escapeHTML(booking.issue_category) : "Other"}<br>
                  ${escapeHTML(booking.issue_details)}
                  ${booking.issue_image ? `<br><img class="review-image" src="${booking.issue_image}" alt="Issue image">` : ""}
                </div>`
              : ""
          }

          ${
            booking.status === "pending_provider_approval"
              ? `<button class="danger-btn" onclick="cancelMyBooking(${booking.id})">Cancel Booking</button>`
              : ""
          }

          ${
            booking.status === "service_done"
              ? `
                <button class="primary-btn" onclick="confirmServiceReceived(${booking.id}, true)">I Received Service Properly</button>
                <button class="danger-btn" onclick="openIssueReportModal('service', ${booking.id})">Report Problem</button>
              `
              : ""
          }

          ${
            booking.status === "completed" || booking.status === "issue_reported"
              ? existingReview
                ? alreadyReviewedHTML(existingReview)
                : `<button class="secondary-btn" onclick="reviewService(${booking.service_id}, ${booking.id})">Review Service</button>`
              : ""
          }
        </div>
      `;
    }).join("");

  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function loadProviderBookings() {
  const list = document.getElementById("providerBookingList");
  if (!list) return;

  const user = getUser();
  if (!user) return;

  try {
    const bookings = await api(`/bookings/provider/${user.id}`);

    if (!bookings.length) {
      list.innerHTML = "<p>No received service bookings found.</p>";
      return;
    }

    list.innerHTML = bookings.map(booking => `
      <div class="item-card received-card">
        <div class="received-head">${avatarHTML(booking.student_profile_image, booking.student_name)}<div><h3>${booking.service_title}</h3><p><strong>Student:</strong> ${booking.student_name || "Unknown"}</p></div></div>
        <p><strong>Preferred Contact:</strong> ${booking.preferred_contact || "N/A"}</p>
        <p><strong>Student Contact:</strong> ${booking.contact_visible
          ? (booking.preferred_contact === "Email"
              ? (booking.visible_student_email || "Email unavailable")
              : (booking.visible_requester_phone || "Phone unavailable"))
          : "Hidden until you approve"}</p>
        <p><strong>Meeting Location:</strong> ${booking.meeting_location || "N/A"}</p>
        <p><strong>Preferred Time:</strong> ${booking.requested_datetime || "N/A"}</p>
        ${booking.service_file_data ? serviceAttachmentHTML({ id: booking.service_id, service_file_data: booking.service_file_data, service_file_name: booking.service_file_name }, "Service File") : ""}

        <p><strong>Payment Method:</strong> ${booking.payment_method || "N/A"}</p>
        <p><strong>Payment Status:</strong> ${badge(booking.payment_status)}</p>

        ${
          booking.payment_method === "bKash"
            ? `
              <p><strong>bKash Sender Number:</strong> ${booking.sender_number || "N/A"}</p>
              <p><strong>bKash Transaction ID:</strong> ${booking.transaction_id || "N/A"}</p>
            `
            : ""
        }

        <p><strong>Booking Status:</strong> ${badge(booking.status)}</p>
        <p><strong>Note:</strong> ${booking.booking_note || "No note"}</p>
        ${booking.issue_details ? `<div class="issue-box"><strong>Student Reported Issue:</strong> ${booking.issue_category ? escapeHTML(booking.issue_category) : "Other"}<br>${escapeHTML(booking.issue_details)}${booking.issue_image ? `<br><img class="review-image" src="${booking.issue_image}" alt="Issue image">` : ""}</div>` : ""}

        ${
          booking.status === "pending_provider_approval"
            ? `
              <button class="primary-btn" onclick="providerApproveBooking(${booking.id}, 'approve')">Approve Booking</button>
              <button class="danger-btn" onclick="providerApproveBooking(${booking.id}, 'reject')">Reject Booking</button>
            `
            : ""
        }

        ${
          booking.status === "provider_approved" || booking.status === "processing"
            ? `
              <button class="secondary-btn" onclick="updateBookingStatusFromProvider(${booking.id}, 'processing')">Processing</button>
              ${booking.payment_status === "paid"
                ? `<button class="primary-btn" onclick="updateBookingStatusFromProvider(${booking.id}, 'service_done')">Mark Service Done / Ask Student Confirmation</button>`
                : `<p class="muted">Confirm payment first. Then you can mark service done and request student confirmation.</p>`}
            `
            : ""
        }

        ${
          booking.status !== "pending_provider_approval" && booking.status !== "provider_rejected" && booking.status !== "completed" && booking.payment_status !== "paid"
            ? `<button class="secondary-btn" onclick="updateBookingPaymentFromProvider(${booking.id}, 'paid')">Mark Payment Paid</button>`
            : ""
        }
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function providerApproveBooking(bookingId, action) {
  const user = getUser();

  if (!user) {
    alert("Please login first.");
    return;
  }

  const confirmText = action === "approve" ? "Approve this booking?" : "Reject this booking?";
  if (!confirm(confirmText)) return;

  try {
    const data = await api(`/bookings/${bookingId}/provider-approval`, {
      method: "PUT",
      body: JSON.stringify({
        provider_id: user.id,
        action
      })
    });

    alert(data.message || "Booking updated successfully.");
    loadProviderBookings();
    loadBookings();
  } catch (error) {
    alert(error.message);
  }
}

async function updateBookingStatusFromProvider(bookingId, status) {
  try {
    const data = await api(`/bookings/${bookingId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });

    alert(data.message || "Booking updated successfully.");
    loadProviderBookings();
    loadBookings();
  } catch (error) {
    alert(error.message);
  }
}

async function updateBookingPaymentFromProvider(bookingId, payment_status) {
  try {
    const data = await api(`/bookings/${bookingId}/status`, {
      method: "PUT",
      body: JSON.stringify({ payment_status })
    });

    alert(data.message || "Payment updated successfully.");
    loadProviderBookings();
    loadBookings();
  } catch (error) {
    alert(error.message);
  }
}


async function cancelMyBooking(bookingId) {
  const user = getUser();
  if (!user) return;
  if (!confirm("Cancel this booking? You can cancel only before provider approval.")) return;

  try {
    const data = await api(`/bookings/${bookingId}/cancel`, {
      method: "PUT",
      body: JSON.stringify({ user_id: user.id })
    });
    alert(data.message || "Booking cancelled successfully.");
    loadBookings();
  } catch (error) {
    alert(error.message);
  }
}

async function confirmServiceReceived(bookingId, received, issueDetails = "", issueCategory = "", issueImage = null) {
  const user = getUser();
  if (!user) return;

  if (received) {
    if (!confirm("Confirm that you received this service properly?")) return;
  } else if (!issueDetails || issueDetails.trim().length < 10) {
    alert("Please describe the service issue with at least 10 characters.");
    return;
  }

  try {
    const data = await api(`/bookings/${bookingId}/student-confirmation`, {
      method: "PUT",
      body: JSON.stringify({ user_id: user.id, received, issue_details: issueDetails.trim(), issue_category: issueCategory, issue_image: issueImage })
    });

    alert(data.message || "Confirmation updated.");
    closeIssueReportModal();
    loadBookings();
  } catch (error) {
    alert(error.message);
  }
}

function closeIssueReportModal() {
  const existing = document.getElementById("dynamicIssueModal");
  if (existing) existing.remove();
}

function openIssueReportModal(type, sourceId) {
  closeIssueReportModal();
  const isProduct = type === "product";
  const title = isProduct ? "Report Product Order Problem" : "Report Service Problem";
  const categories = isProduct
    ? ["Product not received", "Wrong product", "Damaged product", "Payment issue", "Seller behavior issue", "Other"]
    : ["Service not completed", "Service quality issue", "Provider did not arrive", "Payment issue", "Provider behavior issue", "Other"];
  const placeholder = isProduct
    ? "Example: I received the wrong book / damaged product / seller did not deliver properly..."
    : "Example: Service was incomplete / provider did not arrive / quality problem...";

  const modal = document.createElement("div");
  modal.id = "dynamicIssueModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <h2>${title}</h2>
      <p class="muted">This issue will be sent to admin and the seller/provider.</p>
      <label>Issue Category *</label>
      <select id="dynamicIssueCategory">
        <option value="">Select category</option>
        ${categories.map(c => `<option value="${c}">${c}</option>`).join("")}
      </select>
      <label>Problem Details *</label>
      <textarea id="dynamicIssueDetails" placeholder="${placeholder}"></textarea>
      <label>Proof Image <span class="optional-text">Optional</span></label>
      <input type="file" id="dynamicIssueImage" accept="image/*" capture="environment">
      <small>Optional: add photo from gallery/files or camera. Max 2 MB.</small>
      <div class="form-actions">
        <button class="danger-btn" onclick="submitIssueReport('${type}', ${sourceId})">Submit Issue Report</button>
        <button class="secondary-btn" onclick="closeIssueReportModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function submitIssueReport(type, sourceId) {
  const category = document.getElementById("dynamicIssueCategory").value;
  const details = document.getElementById("dynamicIssueDetails").value.trim();
  const imageInput = document.getElementById("dynamicIssueImage");

  if (!category) {
    alert("Please select an issue category.");
    return;
  }

  if (details.length < 10) {
    alert("Please describe the issue with at least 10 characters.");
    return;
  }

  let issueImage = null;
  try {
    issueImage = await fileToDataUrl(imageInput.files[0]);
  } catch (error) {
    alert(error.message);
    return;
  }

  if (type === "product") {
    confirmOrderReceived(sourceId, false, details, category, issueImage);
  } else {
    confirmServiceReceived(sourceId, false, details, category, issueImage);
  }
}

async function openFullReviews(type, itemId) {
  const existing = document.getElementById("fullReviewModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "fullReviewModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal-box large-modal"><h2>Loading Reviews...</h2></div>`;
  document.body.appendChild(modal);

  try {
    const reviews = await api(`/reviews/${type}/${itemId}`);
    const title = type === "product" ? "Product Reviews" : "Service Reviews";
    modal.innerHTML = `
      <div class="modal-box large-modal">
        <div class="card-topline"><h2>${title}</h2><button class="secondary-btn" onclick="document.getElementById('fullReviewModal').remove()">Close</button></div>
        ${reviews.length ? reviews.map(r => `
          <div class="review-detail-card">
            <div class="seller-row">${avatarHTML(r.reviewer_profile_image, r.reviewer_name)}<div><strong>${r.reviewer_name || "Campus User"}</strong><br><span class="muted">${new Date(r.created_at).toLocaleString()}</span></div></div>
            <p><strong>Rating:</strong> ${"⭐".repeat(Number(r.rating || 0))} (${r.rating}/5)</p>
            <p>${escapeHTML(r.comment || "No comment added.")}</p>
            ${r.review_image ? `<img class="review-image" src="${r.review_image}" alt="Review image">` : ""}
          </div>
        `).join("") : "<p>No reviews yet.</p>"}
      </div>
    `;
  } catch (error) {
    modal.innerHTML = `<div class="modal-box"><p>${error.message}</p><button class="secondary-btn" onclick="document.getElementById('fullReviewModal').remove()">Close</button></div>`;
  }
}


async function loadSellerProfilePage() {
  const box = document.getElementById("sellerProfileBox");
  if (!box) return;
  const id = getQueryParam("id");
  if (!id) {
    box.innerHTML = "<p>Seller/provider ID missing.</p>";
    return;
  }
  try {
    const [profile, reviews, listings] = await Promise.all([
      api(`/users/public/${id}`),
      api(`/reviews/received-by-user/${id}`),
      api(`/users/public/${id}/listings`)
    ]);
    box.innerHTML = `
      <div class="public-profile-card">
        <div class="public-profile-head">
          ${avatarHTML(profile.profile_image, profile.name, "large")}
          <div>
            <h2>${escapeHTML(profile.name || "Campus User")}</h2>
            <p class="muted">${escapeHTML(profile.department || "Department hidden")} • ${escapeHTML(profile.semester || "Semester hidden")}</p>
            <div class="profile-badge-row">${badge(profile.role)} ${badge(profile.verification_status)}</div>
          </div>
        </div>
        <div class="public-stats">
          <div><strong>${profile.total_products || 0}</strong><span>Products</span></div>
          <div><strong>${profile.total_services || 0}</strong><span>Services</span></div>
          <div><strong>⭐ ${profile.avg_rating || 0}</strong><span>${profile.review_count || 0} Reviews</span></div>
        </div>
        <div class="privacy-note"><strong>Private info hidden:</strong> Phone, email, student ID and ID card images are not shown publicly.</div>
      </div>

      <h2 class="section-mini-title">Active Products</h2>
      <div class="mini-listing-grid">
        ${(listings.products || []).length ? listings.products.map(p => `
          <a class="mini-listing-card" href="product-details.html?id=${p.id}">
            ${itemImageHTML(p.product_image, p.title)}
            <strong>${escapeHTML(p.title)}</strong>
            <span>${money(p.price)}</span>
            ${stockHTML(p)}
          </a>
        `).join("") : "<p>No active products.</p>"}
      </div>

      <h2 class="section-mini-title">Active Services</h2>
      <div class="mini-listing-grid">
        ${(listings.services || []).length ? listings.services.map(s => `
          <a class="mini-listing-card" href="service-details.html?id=${s.id}">
            ${itemImageHTML(s.service_image, s.title)}
            <strong>${escapeHTML(s.title)}</strong>
            <span>${money(s.price)}</span>
          </a>
        `).join("") : "<p>No active services.</p>"}
      </div>

      <h2 class="section-mini-title">Previous Received Reviews</h2>
      <div class="review-stack">
        ${reviews.length ? reviews.map(r => `
          <div class="review-detail-card">
            <div class="seller-row">${avatarHTML(r.reviewer_profile_image, r.reviewer_name)}<div><strong>${escapeHTML(r.reviewer_name || "Campus User")}</strong><br><span class="muted">${new Date(r.created_at).toLocaleString()}</span></div></div>
            <p><strong>${escapeHTML(r.product_title || r.service_title || "Review")}</strong></p>
            <p>${"⭐".repeat(Number(r.rating || 0))} (${r.rating}/5)</p>
            <p>${escapeHTML(r.comment || "No comment added.")}</p>
            ${r.review_image ? `<img class="review-image" src="${r.review_image}" alt="Review image">` : ""}
          </div>
        `).join("") : "<p>No received reviews yet.</p>"}
      </div>
    `;
  } catch (error) {
    box.innerHTML = `<p>${error.message}</p>`;
  }
}

// Reviews
function closeReviewModal() {
  const existing = document.getElementById("dynamicReviewModal");
  if (existing) existing.remove();
}

function openReviewModal(type, itemId, sourceId) {
  const title = type === "product" ? "Review Product" : "Review Service";

  closeReviewModal();

  const modal = document.createElement("div");
  modal.id = "dynamicReviewModal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <h2>${title}</h2>
      <label>Rating *</label>
      <select id="dynamicReviewRating">
        <option value="">Select rating</option>
        <option value="5">5 - Excellent</option>
        <option value="4">4 - Good</option>
        <option value="3">3 - Average</option>
        <option value="2">2 - Poor</option>
        <option value="1">1 - Very Poor</option>
      </select>

      <label>Comment <span class="optional-text">Optional</span></label>
      <textarea id="dynamicReviewComment" placeholder="Write a comment only if you want"></textarea>

      <label>Review Photo <span class="optional-text">Optional</span></label>
      <input type="file" id="dynamicReviewImage" accept="image/*" capture="environment">
      <small>Optional: upload from gallery/files or camera. Max 2 MB.</small>

      <button class="primary-btn" onclick="submitReviewFromModal('${type}', ${itemId}, ${sourceId})">Submit Review</button>
      <button class="secondary-btn" onclick="closeReviewModal()">Cancel</button>
    </div>
  `;

  document.body.appendChild(modal);
}

function reviewProduct(productId, orderId) {
  openReviewModal("product", productId, orderId);
}

function reviewService(serviceId, bookingId) {
  openReviewModal("service", serviceId, bookingId);
}

async function submitReviewFromModal(type, itemId, sourceId) {
  const user = getUser();
  const rating = document.getElementById("dynamicReviewRating").value;
  const comment = document.getElementById("dynamicReviewComment").value.trim();
  const imageInput = document.getElementById("dynamicReviewImage");

  if (!rating) {
    alert("Please select a rating.");
    return;
  }

  let review_image = null;
  try {
    review_image = await fileToDataUrl(imageInput.files[0]);
  } catch (error) {
    alert(error.message);
    return;
  }

  const body = {
    user_id: user.id,
    rating,
    comment,
    review_image
  };

  if (type === "product") {
    body.product_id = itemId;
    body.order_id = sourceId;
  } else {
    body.service_id = itemId;
    body.booking_id = sourceId;
  }

  try {
    const data = await api("/reviews/add", {
      method: "POST",
      body: JSON.stringify(body)
    });

    alert(data.message || "Review published successfully.");
    closeReviewModal();
    loadMyOrders();
    loadBookings();
    loadReviews();
  } catch (error) {
    alert(error.message);
  }
}

const reviewForm = document.getElementById("reviewForm");

if (reviewForm) {
  reviewForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    alert("Reviews are now connected to completed product orders or service bookings. Use the Review button from My Orders/Bookings after completion.");
  });
}

async function loadReviews() {
  const list = document.getElementById("reviewList");
  if (!list) return;

  try {
    const reviews = await api("/reviews");
    const approved = reviews.filter(r => r.status === "approved");

    if (!approved.length) {
      list.innerHTML = "<p>No reviews yet.</p>";
      return;
    }

    list.innerHTML = approved.map(r => `
      <div class="item-card">
        <h3>${r.product_title || r.service_title || "General Review"}</h3>
        <div class="seller-row">${avatarHTML(r.reviewer_profile_image, r.reviewer_name)}<p><strong>Reviewer:</strong> ${r.reviewer_name || "Unknown"}</p></div>
        <p><strong>Rating:</strong> ${"⭐".repeat(Number(r.rating || 0))}</p>
        <p>${escapeHTML(r.comment || "No comment")}</p>
        ${r.review_image ? `<img class="review-image" src="${r.review_image}" alt="Review image">` : ""}
      </div>
    `).join("");
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

// Notifications
async function loadNotifications() {
  const list = document.getElementById("notificationList");
  if (!list) return;

  const user = getUser();
  if (!user) return;

  try {
    const notes = await api(`/notifications/user/${user.id}`);

    if (!notes.length) {
      list.innerHTML = "<p>No notifications found.</p>";
      return;
    }

    list.innerHTML = notes.map(n => {
      const target = getNotificationTarget(n);

      return `
        <div class="item-card notification-card ${n.is_read ? "" : "unread-card"}" onclick="openNotification(${n.id}, '${target}')">
          <div class="card-topline">
            <h3>${pageTitleFromFile(target)}</h3>
            ${badge(n.is_read ? "read" : "unread")}
          </div>
          <p>${n.message}</p>
          <p><strong>Type:</strong> ${n.type}</p>
          <p class="muted">${new Date(n.created_at).toLocaleString()}</p>
          <button class="primary-btn" onclick="event.stopPropagation(); openNotification(${n.id}, '${target}')">Open Related Page</button>
          ${
            n.is_read
              ? ""
              : `<button class="secondary-btn" onclick="event.stopPropagation(); markNotificationRead(${n.id})">Mark Read Only</button>`
          }
        </div>
      `;
    }).join("");
  } catch (error) {
    list.innerHTML = `<p>${error.message}</p>`;
  }
}

async function markNotificationRead(id) {
  try {
    await api(`/notifications/${id}/read`, {
      method: "PUT"
    });

    loadNotifications();
  } catch (error) {
    alert(error.message);
  }
}

async function openNotification(id, targetPage) {
  try {
    await api(`/notifications/${id}/read`, {
      method: "PUT"
    });
  } catch (error) {
    // Even if marking read fails, still help user reach the related page.
  }

  window.location.href = targetPage || "dashboard.html";
}

// Admin
async function loadAdminDashboard() {
  if (currentPage() !== "admin.html") return;

  requireAdmin();

  try {
    const [users, products, services, bookings, reviews, orders] = await Promise.all([
      api(`/users?admin_id=${getUser().id}`),
      api(`/products?all=true&admin_id=${getUser().id}`),
      api(`/services?all=true&admin_id=${getUser().id}`),
      api("/bookings"),
      api("/reviews"),
      api("/orders")
    ]);

    document.getElementById("totalUsers").textContent = users.length;
    document.getElementById("totalProducts").textContent = products.length;
    document.getElementById("totalServices").textContent = services.length;
    document.getElementById("totalBookings").textContent = bookings.length;
    document.getElementById("totalReviews").textContent = reviews.length;

    window._adminUsersCache = users;
    document.getElementById("adminUsers").innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td><a class="table-link" href="seller-profile.html?id=${u.id}">${escapeHTML(u.name)}</a><br><small>${escapeHTML(u.student_id || "")}</small></td>
        <td>${escapeHTML(u.email)}<br><small>${escapeHTML(u.phone || "")}</small><br>
          <div class="admin-id-thumbs">
            ${idDocumentButtonHTML(u.id, u.has_id_card_front, "front")}
            ${idDocumentButtonHTML(u.id, u.has_id_card_back, "back")}
          </div>
        </td>
        <td>${u.role}</td>
        <td>${badge(u.verification_status)}</td>
        <td>
          <button onclick="updateUserStatus(${u.id}, 'verified')">Verify</button>
          <button onclick="updateUserStatus(${u.id}, 'rejected')">Reject</button>
          <button onclick="updateUserStatus(${u.id}, 'blocked')">Block</button>
        </td>
      </tr>
    `).join("");

    document.getElementById("adminProducts").innerHTML = products.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.product_image ? `<button class="thumb-button" onclick="openMediaViewer(${jsString(p.product_image)}, ${jsString(p.title)}, 'image')"><img class="table-thumb" src="${p.product_image}" alt="Product image"></button><br>` : ""}${escapeHTML(p.title)}</td>
        <td>${p.category}</td>
        <td>${money(p.price)}<br><small>Stock: ${Math.max(Number(p.quantity || 1) - Number(p.sold_quantity || 0), 0)}/${p.quantity || 1}</small></td>
        <td><a class="table-link" href="seller-profile.html?id=${p.user_id}">${escapeHTML(p.seller_name || "Unknown")}</a></td>
        <td>${badge(p.status)}</td>
        <td>
          <button onclick="updateProductStatus(${p.id}, 'active')">Approve</button>
          <button onclick="updateProductStatus(${p.id}, 'rejected')">Reject</button>
          <button onclick="updateProductStatus(${p.id}, 'sold')">Sold</button>
        </td>
      </tr>
    `).join("");

    document.getElementById("adminServices").innerHTML = services.map(s => `
      <tr>
        <td>${s.id}</td>
        <td>${s.service_image ? `<button class="thumb-button" onclick="openMediaViewer(${jsString(s.service_image)}, ${jsString(s.title)}, 'image')"><img class="table-thumb" src="${s.service_image}" alt="Service image"></button><br>` : ""}${escapeHTML(s.title)}</td>
        <td>${s.category}</td>
        <td>${money(s.price)}</td>
        <td><a class="table-link" href="seller-profile.html?id=${s.user_id}">${escapeHTML(s.provider_name || "Unknown")}</a><br>${serviceAttachmentHTML(s, "Portfolio/CV")}</td>
        <td>${badge(s.status)}</td>
        <td>
          <button onclick="updateServiceStatus(${s.id}, 'active')">Approve</button>
          <button onclick="updateServiceStatus(${s.id}, 'rejected')">Reject</button>
        </td>
      </tr>
    `).join("");

    document.getElementById("adminBookings").innerHTML = bookings.map(b => `
      <tr>
        <td>${b.id}</td>
        <td>${b.service_title}</td>
        <td>${b.student_name}</td>
        <td>${b.student_email}</td>
        <td>${badge(b.status)}${b.issue_details ? `<br><small class="issue-text">${escapeHTML(b.issue_category || "Issue")}: ${escapeHTML(b.issue_details)}</small>` : ""}</td>
        <td>${b.visible_requester_phone || "Hidden"}</td>
        <td>
          <button onclick="updateBookingStatus(${b.id}, 'provider_approved')">Admin Override Approve</button>
          <button onclick="updateBookingStatus(${b.id}, 'processing')">Processing</button>
          <button onclick="updateBookingStatus(${b.id}, 'service_done')">Mark Service Done</button>
          <button onclick="updateBookingStatus(${b.id}, 'provider_rejected')">Admin Override Reject</button>
          ${b.payment_status !== "paid" && b.status !== "completed"
            ? `<button onclick="updateBookingPayment(${b.id}, 'paid')">Mark Paid</button>`
            : ""}
        </td>
      </tr>
    `).join("");

    const productIssues = orders.filter(o => o.issue_details).map(o => ({
      type: "Product Order",
      route: "orders",
      id: o.id,
      item: o.product_name || "Unknown Product",
      reporter: o.buyer_name || "Unknown",
      category: o.issue_category || "Other",
      details: o.issue_details,
      image: o.issue_image,
      status: o.issue_status || "open"
    }));
    const serviceIssues = bookings.filter(b => b.issue_details).map(b => ({
      type: "Service Booking",
      route: "bookings",
      id: b.id,
      item: b.service_title || "Unknown Service",
      reporter: b.student_name || "Unknown",
      category: b.issue_category || "Other",
      details: b.issue_details,
      image: b.issue_image,
      status: b.issue_status || "open"
    }));
    const issues = [...productIssues, ...serviceIssues];
    const issueTable = document.getElementById("adminIssues");
    if (issueTable) {
      issueTable.innerHTML = issues.length ? issues.map(i => `
        <tr>
          <td>${i.type}</td>
          <td>${escapeHTML(i.item)}</td>
          <td>${escapeHTML(i.reporter)}</td>
          <td>${escapeHTML(i.category)}</td>
          <td>${escapeHTML(i.details)}${i.image ? `<br><img class="review-image table-image" src="${i.image}" alt="Issue image">` : ""}</td>
          <td>
            ${badge(i.status)}<br>
            <button onclick="updateIssueStatus('${i.route}', ${i.id}, 'reviewing')">Reviewing</button>
            <button onclick="updateIssueStatus('${i.route}', ${i.id}, 'resolved')">Resolved</button>
          </td>
        </tr>
      `).join("") : `<tr><td colspan="6">No reported issues.</td></tr>`;
    }

    document.getElementById("adminReviews").innerHTML = reviews.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.reviewer_name || "Unknown"}</td>
        <td>${r.rating}</td>
        <td>${escapeHTML(r.comment || "No comment")}${r.review_image ? `<br><img class="review-image table-image" src="${r.review_image}" alt="Review image">` : ""}</td>
        <td>${badge(r.status)}</td>
        <td>
          <button onclick="updateReviewStatus(${r.id}, 'approved')">Show</button>
          <button onclick="updateReviewStatus(${r.id}, 'hidden')">Hide</button>
          <button onclick="deleteReview(${r.id})">Delete</button>
        </td>
      </tr>
    `).join("");

    document.getElementById("adminOrderTable").innerHTML = orders.map(o => `
      <tr>
        <td>${o.id}</td>
        <td>
          ${o.buyer_name || "Unknown"}<br>
          <small>${o.visible_buyer_phone || o.buyer_phone || "No phone"}</small>
        </td>
        <td>${o.buyer_email || "N/A"}</td>
        <td>
          ${o.product_name || "Unknown Product"}<br>
          <small>Seller: ${o.seller_name || "Unknown"}</small>
        </td>
        <td>${money(o.total_amount)}</td>
        <td>
          ${badge(o.status)}<br>
          ${badge(o.payment_status)}<br>
          ${badge(o.delivery_status)}
          ${o.issue_details ? `<br><small class="issue-text">${escapeHTML(o.issue_category || "Issue")}: ${escapeHTML(o.issue_details)}</small>` : ""}
        </td>
        <td>
          ${o.delivery_location || "N/A"}<br>
          <small>${o.visible_delivery_address || o.delivery_address || ""}</small>
        </td>
        <td>
          ${o.payment_method || "N/A"}
          ${
            o.payment_method === "bKash"
              ? `<br><small>Sender: ${o.sender_number || "N/A"}<br>TrxID: ${o.transaction_id || "N/A"}</small>`
              : ""
          }
        </td>
        <td>
          ${o.created_at ? new Date(o.created_at).toLocaleDateString() : "N/A"}
        </td>
        <td>
          <button onclick="updateOrder(${o.id}, 'seller_approved')">Admin Override Approve</button>
          <button onclick="updateOrder(${o.id}, 'processing')">Processing</button>
          <button onclick="updateOrder(${o.id}, 'awaiting_buyer_confirmation')">Mark Delivered</button>
          <button onclick="updateOrder(${o.id}, 'seller_rejected')">Admin Override Reject</button>
          ${o.payment_status !== "paid" && o.status !== "completed"
            ? `<button onclick="updatePayment(${o.id}, 'paid')">Mark Paid</button>`
            : ""}
        </td>
      </tr>
    `).join("");
  } catch (error) {
    alert(error.message);
  }
}


async function viewIdCardFromUser(userId, back = false) {
  const admin = getUser();
  if (!admin || admin.role !== "admin") return alert("Admin login required.");

  const title = back ? "ID Card Back" : "ID Card Front";
  try {
    const docs = await api(`/users/${userId}/id-documents?admin_id=${admin.id}`);
    const src = back ? docs.id_card_back : docs.id_card_front;
    if (!src) return alert("No ID card image found.");
    openMediaViewer(src, `${docs.name || "User"} - ${title}`, "image");
  } catch (error) {
    alert(error.message);
  }
}

async function updateIssueStatus(route, id, issue_status) {
  await api(`/${route}/${id}/issue-status`, {
    method: "PUT",
    body: JSON.stringify(adminIdPayload({ issue_status }))
  });
  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateUserStatus(id, verification_status) {
  await api(`/users/${id}/admin`, {
    method: "PUT",
    body: JSON.stringify(adminIdPayload({ verification_status }))
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateProductStatus(id, status) {
  await api(`/products/${id}/status`, {
    method: "PUT",
    body: JSON.stringify(adminIdPayload({ status }))
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateServiceStatus(id, status) {
  await api(`/services/${id}/status`, {
    method: "PUT",
    body: JSON.stringify(adminIdPayload({ status }))
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateBookingStatus(id, status) {
  await api(`/bookings/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateReviewStatus(id, status) {
  await api(`/reviews/${id}/status`, {
    method: "PUT",
    body: JSON.stringify(adminIdPayload({ status }))
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}


async function deleteReview(id) {
  if (!confirm("Delete this review permanently?")) return;
  await api(`/reviews/${id}?admin_id=${getUser().id}`, { method: "DELETE" });
  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updateOrder(id, status) {
  await api(`/orders/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status })
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function updatePayment(id, payment_status) {
  await api(`/orders/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ payment_status })
  });

  loadAdminDashboard();
  loadSellerProfilePage();
}

async function markCurrentPageNotificationsRead() {
  const user = getUser();
  if (!user) return;

  const page = currentPage();

  const pagesToMark = [
    "orders.html",
    "booking.html",
    "seller-orders.html",
    "service-orders.html",
    "notifications.html",
    "admin.html"
  ];

  if (!pagesToMark.includes(page)) return;

  try {
    if (page === "notifications.html") {
      await api(`/notifications/user/${user.id}/read-all`, {
        method: "PUT"
      });
    } else {
      await api(`/notifications/user/${user.id}/read-link`, {
        method: "PUT",
        body: JSON.stringify({ link_url: page })
      });
    }
  } catch (error) {
    // Do not block page loading
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  requireLogin();
  await markCurrentPageNotificationsRead();
  await setupNavigation();
  protectVerifiedActions();
  fillDashboard();

  loadProducts();
  setupProductFilters();
  loadProductDetailsPage();

  loadServices();
  setupServiceFilters();
  loadServiceDetailsPage();

  loadMyOrders();
  loadSellerOrders();
  loadBookings();
  loadProviderBookings();
  loadReviews();
  loadNotifications();
  loadAdminDashboard();
  loadSellerProfilePage();
});