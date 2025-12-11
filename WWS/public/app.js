let authToken = localStorage.getItem("wwsToken");
let currentUser = localStorage.getItem("wwsUser") || "";
let selectedPart = null;

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const loginMessage = document.getElementById("login-message");
const userDisplay = document.getElementById("user-display");

const searchInput = document.getElementById("search-text");
const brandSelect = document.getElementById("filter-brand");
const searchBtn = document.getElementById("search-btn");
const partsTableBody = document.getElementById("parts-table-body");

const partEmpty = document.getElementById("part-empty");
const partContent = document.getElementById("part-content");
const qtyInput = document.getElementById("qty-input");
const detailMessage = document.getElementById("detail-message");
const availabilityInput = document.getElementById("availability-oem");
const availabilityBtn = document.getElementById("availability-btn");
const availabilityResults = document.getElementById("availability-results");

const fields = {
  oemNumber: document.getElementById("detail-oem"),
  internalSku: document.getElementById("detail-sku"),
  brand: document.getElementById("detail-brand"),
  model: document.getElementById("detail-model"),
  modelCode: document.getElementById("detail-modelCode"),
  category: document.getElementById("detail-category"),
  title: document.getElementById("detail-title"),
  description: document.getElementById("detail-description"),
  price: document.getElementById("detail-price"),
  currency: document.getElementById("detail-currency"),
  stockLocal: document.getElementById("detail-stockLocal"),
  stockReserved: document.getElementById("detail-stockReserved"),
  stockLocation: document.getElementById("detail-stockLocation"),
  supplier: document.getElementById("detail-supplier"),
  compatibleModels: document.getElementById("detail-compatibleModels")
};

document.getElementById("save-part-btn").addEventListener("click", savePart);
document.getElementById("reserve-btn").addEventListener("click", () => stockAction("reserve"));
document.getElementById("release-btn").addEventListener("click", () => stockAction("release"));
document.getElementById("book-btn").addEventListener("click", () => stockAction("book"));

loginBtn.addEventListener("click", handleLogin);
logoutBtn.addEventListener("click", handleLogout);
searchBtn.addEventListener("click", () => loadParts(getFilters()));
availabilityBtn.addEventListener("click", () => checkAvailability(availabilityInput.value.trim()));

function setMessage(el, text, type = "info") {
  el.textContent = text || "";
  el.className = `message ${type}`;
}

function handleLogin() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();

  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error("Login fehlgeschlagen");
      }
      return res.json();
    })
    .then((data) => {
      authToken = data.token;
      currentUser = data.user?.username || "";
      localStorage.setItem("wwsToken", authToken);
      localStorage.setItem("wwsUser", currentUser);
      switchToAppView();
      loadParts(getFilters());
    })
    .catch((err) => {
      setMessage(loginMessage, err.message, "error");
    });
}

function handleLogout() {
  authToken = null;
  currentUser = "";
  localStorage.removeItem("wwsToken");
  localStorage.removeItem("wwsUser");
  switchToLoginView();
}

function switchToAppView() {
  loginView.style.display = "none";
  appView.style.display = "block";
  userDisplay.textContent = currentUser ? `Eingeloggt als ${currentUser}` : "";
}

function switchToLoginView() {
  appView.style.display = "none";
  loginView.style.display = "flex";
  setMessage(loginMessage, "");
}

function getFilters() {
  const filters = {};
  if (searchInput.value.trim()) filters.search = searchInput.value.trim();
  if (brandSelect.value) filters.brand = brandSelect.value;
  return filters;
}

function buildAuthHeaders() {
  return authToken
    ? {
        Authorization: `Bearer ${authToken}`
      }
    : {};
}

function loadParts(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  fetch(`/api/parts?${params.toString()}`)
    .then((res) => res.json())
    .then((parts) => renderPartsTable(parts))
    .catch((err) => console.error(err));
}

function renderPartsTable(parts) {
  partsTableBody.innerHTML = "";
  parts.forEach((part) => {
    const tr = document.createElement("tr");
    tr.dataset.id = part.id;
    tr.innerHTML = `
      <td>${part.oemNumber}</td>
      <td>${part.brand}</td>
      <td>${part.model} ${part.modelCode}</td>
      <td>${part.title}</td>
      <td>${part.price} ${part.currency}</td>
      <td>${part.stockLocal}</td>
      <td>${part.stockReserved}</td>
    `;
    tr.addEventListener("click", () => showPartDetail(part));
    partsTableBody.appendChild(tr);
  });
}

function showPartDetail(part) {
  selectedPart = part;
  partEmpty.style.display = "none";
  partContent.style.display = "block";
  setMessage(detailMessage, "");

  fields.oemNumber.value = part.oemNumber || "";
  fields.internalSku.value = part.internalSku || "";
  fields.brand.value = part.brand || "";
  fields.model.value = part.model || "";
  fields.modelCode.value = part.modelCode || "";
  fields.category.value = part.category || "";
  fields.title.value = part.title || "";
  fields.description.value = part.description || "";
  fields.price.value = part.price ?? "";
  fields.currency.value = part.currency || "EUR";
  fields.stockLocal.value = part.stockLocal ?? 0;
  fields.stockReserved.value = part.stockReserved ?? 0;
  fields.stockLocation.value = part.stockLocation || "";
  fields.supplier.value = part.supplier || "";
  fields.compatibleModels.value = Array.isArray(part.compatibleModels)
    ? part.compatibleModels.join(", ")
    : "";
  availabilityInput.value = part.oemNumber || "";
}

function collectDetailData() {
  return {
    internalSku: fields.internalSku.value.trim(),
    brand: fields.brand.value.trim(),
    model: fields.model.value.trim(),
    modelCode: fields.modelCode.value.trim(),
    category: fields.category.value.trim(),
    title: fields.title.value.trim(),
    description: fields.description.value.trim(),
    price: Number(fields.price.value) || 0,
    currency: fields.currency.value.trim() || "EUR",
    stockLocal: Number(fields.stockLocal.value) || 0,
    stockReserved: Number(fields.stockReserved.value) || 0,
    stockLocation: fields.stockLocation.value.trim(),
    supplier: fields.supplier.value.trim(),
    compatibleModels: fields.compatibleModels.value
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  };
}

function ensureAuth() {
  if (!authToken) {
    setMessage(detailMessage, "Bitte zuerst einloggen.", "error");
    return false;
  }
  return true;
}

function savePart() {
  if (!selectedPart) return;
  if (!ensureAuth()) return;
  const updates = collectDetailData();
  fetch(`/api/parts/${selectedPart.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders()
    },
    body: JSON.stringify(updates)
  })
    .then(async (res) => {
      if (!res.ok) {
        const msg = (await res.json())?.message || "Speichern fehlgeschlagen";
        throw new Error(msg);
      }
      return res.json();
    })
    .then((updated) => {
      showPartDetail(updated);
      loadParts(getFilters());
      setMessage(detailMessage, "Gespeichert.", "success");
    })
    .catch((err) => setMessage(detailMessage, err.message, "error"));
}

function stockAction(action) {
  if (!selectedPart) return;
  if (!ensureAuth()) return;
  const qty = Number(qtyInput.value) || 0;
  if (qty <= 0) {
    setMessage(detailMessage, "Menge eingeben.", "error");
    return;
  }
  fetch(`/api/parts/${selectedPart.id}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders()
    },
    body: JSON.stringify({ quantity: qty })
  })
    .then(async (res) => {
      if (!res.ok) {
        const errMsg = (await res.json())?.message || "Aktion fehlgeschlagen";
        throw new Error(errMsg);
      }
      return res.json();
    })
    .then((updated) => {
      showPartDetail(updated);
      loadParts(getFilters());
      setMessage(detailMessage, `Aktion '${action}' erfolgreich.`, "success");
    })
    .catch((err) => setMessage(detailMessage, err.message, "error"));
}

function checkAvailability(oem) {
  const val = oem || availabilityInput.value.trim();
  if (!val) return;
  availabilityResults.textContent = "Lade...";
  fetch(`/api/inventory/by-oem/${encodeURIComponent(val)}`)
    .then((res) => res.json())
    .then((data) => renderAvailability(data.results || []))
    .catch(() => {
      availabilityResults.textContent = "Fehler beim Laden der Verfügbarkeit.";
    });
}

function renderAvailability(results) {
  if (!results.length) {
    availabilityResults.textContent = "Keine Treffer.";
    return;
  }
  const rows = results
    .map(
      (r) => `
    <tr>
      <td>${r.source}</td>
      <td>${r.oemNumber}</td>
      <td>${r.title || "-"}</td>
      <td>${r.brand || "-"}</td>
      <td>${r.model || "-"}</td>
      <td>${r.price ?? "-"} ${r.currency || ""}</td>
      <td>${r.availableQuantity ?? "-"}</td>
      <td>${r.deliveryTime || "-"}</td>
    </tr>`
    )
    .join("");
  availabilityResults.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Quelle</th>
          <th>OEM</th>
          <th>Titel</th>
          <th>Marke</th>
          <th>Modell</th>
          <th>Preis</th>
          <th>Verfügbar</th>
          <th>Lieferzeit</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function bootstrap() {
  if (authToken) {
    switchToAppView();
    loadParts(getFilters());
  } else {
    switchToLoginView();
  }
}

bootstrap();
