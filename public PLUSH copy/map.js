// ===============================
// 1. CONFIG
// ===============================
mapboxgl.accessToken = "pk.eyJ1IjoicGx1c2gtaW50ZW50aW9ucyIsImEiOiJjbW9mZGh4bWMwbnl0MnFweDIyYzhtNDhwIn0.3r6IsK6jkmj3Y43ajcZPGw"; // 
const CLICKUP_API_KEY = "pk_204265715_YZBDN32HTFQ6JOJ5XEANUD03E7Y8YJMF";
const CLICKUP_LIST_ID = "901415851544";

localStorage.setItem("tech_id", "12345678");


// ===============================
// 2. RADIUS SAVE / LOAD
// ===============================
function getSavedRadius() {
    const saved = localStorage.getItem("tech_travel_radius");
    return saved ? parseInt(saved) : 120;
}

function saveRadius(value) {
    localStorage.setItem("tech_travel_radius", value);
}

let TECH_TRAVEL_RADIUS_MILES = getSavedRadius();


// ===============================
// 3. radiusToZoom()
// ===============================
function radiusToZoom(radiusMiles) {
    const radiusMeters = radiusMiles * 1609.34;
    const earthCircumference = 40075016.686;
    const zoom = Math.log2(earthCircumference / (radiusMeters * Math.PI * 2));
    return Math.max(3, Math.min(zoom, 14));
}


// ===============================
// 4. GPS-FIRST MAP INITIALIZATION
// ===============================
let map;
let techMarker = null;
let techCoords = null;

navigator.geolocation.getCurrentPosition(
    (pos) => {
        const lng = pos.coords.longitude;
        const lat = pos.coords.latitude;

        const zoomLevel = radiusToZoom(TECH_TRAVEL_RADIUS_MILES);

        map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: [lng, lat],
            zoom: zoomLevel
        });

        map.on("load", () => {
            loadMapMarkers();
        });
    },
    (err) => {
        console.error("GPS error:", err);

        map = new mapboxgl.Map({
            container: "map",
            style: "mapbox://styles/mapbox/streets-v12",
            center: [-83.6875, 43.0125],
            zoom: 10
        });

        map.on("load", () => {
            loadMapMarkers();
        });
    },
    { enableHighAccuracy: true }
);


// ===============================
// 5. LIVE GPS TRACKING (SAFE)
// ===============================
navigator.geolocation.watchPosition(
    (pos) => {
        techCoords = [pos.coords.longitude, pos.coords.latitude];

        if (!map) return;

        if (!techMarker) {
            techMarker = new mapboxgl.Marker({ color: "#007bff" })
                .setLngLat(techCoords)
                .addTo(map);
        } else {
            techMarker.setLngLat(techCoords);
        }
    },
    (err) => console.error("GPS error:", err),
    { enableHighAccuracy: true }
);


// ===============================
// 6. DISTANCE CALC
// ===============================
function distanceInMeters(coord1, coord2) {
    const R = 6371e3;
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLng = (coord2[0] - coord1[0]) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}


// ===============================
// 7. CLICKUP UPDATE
// ===============================
async function updateTask(taskId, fields) {
    await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
        method: "PUT",
        headers: {
            "Authorization": CLICKUP_API_KEY,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ custom_fields: fields })
    });
}


// ===============================
// 8. NAVIGATION
// ===============================
function navigateTo(lat, lng) {
    const isApple = /iPhone|iPad|Mac/i.test(navigator.userAgent);
    if (isApple) window.open(`http://maps.apple.com/?daddr=${lat},${lng}`);
    else window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`);
}


// ===============================
// 9. CHECK-IN / CHECK-OUT
// ===============================
async function checkIn(taskId, jobCoords) {
    if (!techCoords) return alert("GPS not available");

    const distance = distanceInMeters(techCoords, jobCoords);
    if (distance > 50) return alert("You must be onsite to check in");

    const now = new Date().toISOString();

    await updateTask(taskId, [
        { id: FIELD_CHECKIN, value: now },
        { id: FIELD_STATUS, value: "On Site" }
    ]);

    alert("Checked in successfully");
}

async function checkOut(taskId, jobCoords) {
    if (!techCoords) return alert("GPS not available");

    const distance = distanceInMeters(techCoords, jobCoords);
    if (distance > 50) return alert("You must be onsite to check out");

    const now = new Date().toISOString();

    await updateTask(taskId, [
        { id: FIELD_CHECKOUT, value: now },
        { id: FIELD_STATUS, value: "Completed" }
    ]);

    alert("Checked out successfully");
}


// ===============================
// 10. FETCH WORK ORDERS
// ===============================
async function fetchWorkOrders() {
    const response = await fetch(
        `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task?include_closed=false`,
        { headers: { "Authorization": CLICKUP_API_KEY } }
    );
    const data = await response.json();
    return data.tasks || [];
}


// ===============================
// 11. GEOCODE
// ===============================
async function geocodeAddress(address) {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
        address
    )}.json?access_token=${mapboxgl.accessToken}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.features?.[0]?.center || null;
}


// ===============================
// 12. LOAD MAP MARKERS
// ===============================
async function loadMapMarkers() {
    const tasks = await fetchWorkOrders();
    const currentTechId = localStorage.getItem("tech_id");

    for (const task of tasks) {

        const assigneeId = task.assignees[0]?.id || null;
        const isAssignedToTech = assigneeId && assigneeId.toString() === currentTechId;

        const addressField = task.custom_fields.find(f => f.name === "Service Address");
        const address = addressField?.value;
        if (!address) continue;

        const coords = await geocodeAddress(address);
        if (!coords) continue;

        let displayCoords = coords;
        if (!isAssignedToTech) {
            displayCoords = offsetCoordinates(coords);
        }

        let popupHtml;

        if (isAssignedToTech) {
            popupHtml = `
                <strong>${task.name}</strong><br>
                <em>${address}</em><br><br>

                <button onclick="navigateTo(${coords[1]}, ${coords[0]})">Navigate</button><br><br>

                <button onclick="checkIn('${task.id}', [${coords}])">Check In</button><br><br>

                <button onclick="checkOut('${task.id}', [${coords}])">Check Out</button>
            `;
        } else {
            popupHtml = `
                <strong>${task.name}</strong><br>
                <em>Address hidden</em><br>
                <em>Customer info hidden</em><br><br>

                <strong>Assigned to:</strong> ${assigneeId ? "Another Technician" : "Unassigned"}<br><br>

                <em>Exact location protected for privacy.</em>
            `;
        }

        new mapboxgl.Marker({ color: isAssignedToTech ? "#66cc99" : "#999999" })
            .setLngLat(displayCoords)
            .setPopup(new mapboxgl.Popup().setHTML(popupHtml))
            .addTo(map);
    }
}


// ===============================
// 13. UPDATE RADIUS
// ===============================
function updateRadius() {
    const newRadius = parseInt(document.getElementById("radiusInput").value);

    if (isNaN(newRadius) || newRadius < 1 || newRadius > 200) {
        alert("Enter a radius between 1 and 200 miles");
        return;
    }

    TECH_TRAVEL_RADIUS_MILES = newRadius;
    saveRadius(newRadius);

    alert("Radius saved. Reloading map…");
    location.reload();
}
