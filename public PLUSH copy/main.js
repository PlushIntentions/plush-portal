// ===============================
// LOGIN HANDLER
// ===============================
document.addEventListener("DOMContentLoaded", () => {
const loginForm = document.getElementById("login-form");

if (loginForm) {
loginForm.addEventListener("submit", async (e) => {
e.preventDefault();

const email = document.getElementById("email").value.trim();
if (!email) {
alert("Email required");
return;
}

// Save email for backend use
localStorage.setItem("email", email);

// Redirect to dashboard
window.location.href = "dashboard.html";
});
}

// Auto-load pages
if (window.location.pathname.includes("dashboard.html")) {
loadTechnician();
loadWorkOrders();
}

if (window.location.pathname.includes("available.html")) {
loadAvailableOrders();
}

if (window.location.pathname.includes("assigned.html")) {
loadAssignedOrders();
}

if (window.location.pathname.includes("workorder.html")) {
loadWorkOrderDetails();
}

if (window.location.pathname.includes("profile.html")) {
loadProfile();
}
});

// ===============================
// LOAD TECHNICIAN
// ===============================
async function loadTechnician() {
const res = await fetch("/api/loadTechnician");
const data = await res.json();

if (data.error) {
alert(data.error);
return;
}

if (document.getElementById("tech-name"))
document.getElementById("tech-name").innerText = data.name;

if (document.getElementById("tech-email"))
document.getElementById("tech-email").innerText = data.email;
}

// ===============================
// LOAD ALL WORK ORDERS
// ===============================
async function loadWorkOrders() {
const res = await fetch("/api/loadWorkOrders");
const data = await res.json();

if (data.error) {
console.error(data.error);
return;
}

const container = document.getElementById("work-orders");
if (!container) return;

data.forEach((task) => {
const div = document.createElement("div");
div.className = "work-order-card";
div.innerText = task.name;
container.appendChild(div);
});
}

// ===============================
// AVAILABLE WORK ORDERS
// ===============================
async function loadAvailableOrders() {
const res = await fetch("/api/loadWorkOrders");
const data = await res.json();

const container = document.getElementById("available-orders");
if (!container) return;

const available = data.filter(task => {
const assignedField = task.custom_fields?.find(f => f.name === "Assigned Technician");
return !assignedField || !assignedField.value;
});

available.forEach((task) => {
const div = document.createElement("div");
div.className = "work-order-card";
div.innerHTML = `
<strong>${task.name}</strong><br>
<button onclick="requestJob('${task.id}')">Request</button>
`;
container.appendChild(div);
});
}

async function requestJob(taskId) {
const res = await fetch(`/api/requestJob?id=${taskId}`);
const data = await res.json();

if (data.error) {
alert(data.error);
return;
}

alert("Job requested successfully!");
window.location.reload();
}

// ===============================
// ASSIGNED WORK ORDERS
// ===============================
async function loadAssignedOrders() {
const email = localStorage.getItem("email");

const res = await fetch("/api/loadWorkOrders");
const data = await res.json();

const container = document.getElementById("assigned-orders");
if (!container) return;

const assigned = data.filter(task => {
const assignedField = task.custom_fields?.find(f => f.name === "Assigned Technician");
return assignedField && assignedField.value === email;
});

assigned.forEach(task => {
const div = document.createElement("div");
div.className = "work-order-card";
div.innerHTML = `
<strong>${task.name}</strong><br>
<button onclick="openWorkOrder('${task.id}')">Open</button>
`;
container.appendChild(div);
});
}

// ===============================
// WORK ORDER DETAILS
// ===============================
function openWorkOrder(id) {
localStorage.setItem("currentWorkOrder", id);
window.location.href = "workorder.html";
}

async function loadWorkOrderDetails() {
const id = localStorage.getItem("currentWorkOrder");

const res = await fetch("/api/loadWorkOrders");
const data = await res.json();

const task = data.find(t => t.id === id);

const container = document.getElementById("wo-details");
if (!container) return;

container.innerHTML = `
<h2>${task.name}</h2>
<p><strong>Status:</strong> ${task.status.status}</p>
<p><strong>Description:</strong> ${task.text_content || "No description"}</p>
`;
}

// ===============================
// CLOSEOUT
// ===============================
async function submitCloseout() {
const id = localStorage.getItem("currentWorkOrder");
const notes = document.getElementById("closeout-notes").value;

const res = await fetch(`/api/closeout?id=${id}&notes=${encodeURIComponent(notes)}`);
const data = await res.json();

if (data.error) {
alert(data.error);
return;
}

alert("Work order closed out!");
window.location.href = "assigned.html";
}

// ===============================
// PROFILE
// ===============================
async function loadProfile() {
const res = await fetch("/api/loadTechnician");
const data = await res.json();

if (document.getElementById("profile-name"))
document.getElementById("profile-name").innerText = data.name;

if (document.getElementById("profile-email"))
document.getElementById("profile-email").innerText = data.email;
}
