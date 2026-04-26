const API_URL = '/api';
const MAPBOX_STYLE_URL = '/map-style.json';

let state = {
  tech: null,
  workOrders: [],
  map: null,
  mapLoaded: false,
  markers: [],
};

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');

  loginView.style.display = 'block';

  document.getElementById('login-btn').onclick = login;
  document.getElementById('logout-btn').onclick = () => {
    state.tech = null;
    state.workOrders = [];
    appView.style.display = 'none';
    loginView.style.display = 'block';
  };
});

async function login() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const errorEl = document.getElementById('login-error');
  errorEl.textContent = '';

  if (!email || !password) {
    errorEl.textContent = 'Email and password are required.';
    return;
  }

  document.getElementById('login-btn').disabled = true;

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', payload: { email, password } }),
    });
    const data = await res.json();
    if (!data.success) {
      errorEl.textContent = data.error || 'Login failed.';
      document.getElementById('login-btn').disabled = false;
      return;
    }

    state.tech = data.tech;
    await loadDashboard();
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'block';
  } catch (e) {
    errorEl.textContent = 'Error logging in.';
  } finally {
    document.getElementById('login-btn').disabled = false;
  }
}

async function loadDashboard() {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getDashboardData', payload: { tech: state.tech } }),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }

  state.workOrders = data.workOrders || [];
  renderTechHeader();
  await initMap();
  renderWorkOrders();
}

function renderTechHeader() {
  const t = state.tech;
  document.getElementById('tech-name').textContent = t.name;
  document.getElementById('tech-meta').textContent =
    `${t.baseLocation || 'No base location'} • Radius: ${t.radiusMiles || 0} miles`;
}

async function initMap() {
  if (!state.tech.baseLocation) {
    await createMap([-83.8088, 39.9242]);
    return;
  }

  const token = '<YOUR_MAPBOX_TOKEN_HERE>';

  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      state.tech.baseLocation
    )}.json?access_token=${token}&limit=1`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    const center = data.features && data.features[0] ? data.features[0].center : [-83.8088, 39.9242];
    await createMap(center, token);
  } catch {
    await createMap([-83.8088, 39.9242], token);
  }
}

async function createMap(center, token) {
  if (state.map) {
    state.map.remove();
    state.map = null;
  }

  const styleRes = await fetch(MAPBOX_STYLE_URL);
  const styleJson = await styleRes.json();

  mapboxgl.accessToken = token;
  const map = new mapboxgl.Map({
    container: 'map',
    style: styleJson,
    center,
    zoom: 10,
  });

  state.map = map;
  state.mapLoaded = false;

  map.on('load', () => {
    state.mapLoaded = true;
    renderMapMarkers();
  });
}

function renderWorkOrders() {
  const listEl = document.getElementById('wo-list');
  listEl.innerHTML = '';

  if (!state.workOrders.length) {
    listEl.innerHTML = '<div class="muted">No work orders in your radius.</div>';
    return;
  }

  state.workOrders.forEach((wo) => {
    const div = document.createElement('div');
    div.className = 'wo-item ' + (wo.isAssignedToThisTech ? 'assigned' : 'unassigned');
    div.onclick = () => selectWorkOrder(wo.id);

    div.innerHTML = `
      <div style="font-weight:600;">
        ${wo.name}
        <span class="tag">${wo.priority || 'Normal'}</span>
      </div>
      <div class="muted">
        ${wo.isAssignedToThisTech ? 'Assigned to you' : 'Unassigned / Not yours'}
      </div>
    `;

    listEl.appendChild(div);
  });

  renderMapMarkers();
}

async function selectWorkOrder(taskId) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getWorkOrder', payload: { tech: state.tech, taskId } }),
  });
  const data = await res.json();
  if (data.error) {
    alert(data.error);
    return;
  }

  const wo = data.workOrder;
  renderWorkOrderDetail(wo);
}

function renderWorkOrderDetail(wo) {
  const detailEl = document.getElementById('wo-detail');
  if (!wo) {
    detailEl.innerHTML = '<div class="muted">Select a work order.</div>';
    return;
  }

  let html = `
    <div style="font-weight:600;margin-bottom:4px;">${wo.name}</div>
    <div class="muted" style="margin-bottom:8px;">Status: ${wo.status || ''}</div>
  `;

  if (wo.privacy.mode === 'assigned') {
    html += `
      <div><strong>Address:</strong> ${wo.serviceAddress || 'N/A'}</div>
      <div><strong>Customer:</strong> ${wo.customerName || 'N/A'}</div>
      <div><strong>Phone:</strong> ${wo.customerPhone || 'N/A'}</div>
      <div><strong>Email:</strong> ${wo.customerEmail || 'N/A'}</div>
      <div style="margin-top:8px;"><strong>Notes:</strong><br />${wo.notes || '<span class="muted">None</span>'}</div>
    `;

    if (wo.attachments && wo.attachments.length) {
      html += `<div style="margin-top:8px;"><strong>Attachments:</strong><ul>`;
      wo.attachments.forEach((a) => {
        html += `<li><a href="${a.url}" target="_blank">${a.title || 'Attachment'}</a></li>`;
      });
      html += `</ul></div>`;
    } else {
      html += `<div style="margin-top:8px;"><strong>Attachments:</strong> <span class="muted">None</span></div>`;
    }
  } else {
    html += `
      <div class="muted" style="margin-top:8px;">
        ${wo.privacy.message || 'Exact details hidden until assignment.'}
      </div>
      <div style="margin-top:8px;"><strong>Address:</strong> Hidden</div>
      <div><strong>Customer:</strong> Hidden</div>
      <div><strong>Attachments:</strong> Hidden</div>
      <button class="btn" style="margin-top:12px;" onclick="requestJob('${wo.id}')">
        Request Job
      </button>
    `;
  }

  detailEl.innerHTML = html;
}

async function requestJob(taskId) {
  if (!confirm('Request this work order?')) return;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'requestJob', payload: { tech: state.tech, parentTaskId: taskId } }),
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || 'Failed to request job.');
    return;
  }
  alert('Assignment request submitted.');
}

function renderMapMarkers() {
  if (!state.map || !state.mapLoaded) return;
  state.markers.forEach((m) => m.remove());
  state.markers = [];
}
