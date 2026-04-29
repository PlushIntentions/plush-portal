document.addEventListener("DOMContentLoaded", () => {
    const tech = JSON.parse(localStorage.getItem("technician"));
    if (!tech) {
        window.location.href = "index.html";
        return;
    }

    // Cloudflare injects MAPBOX_TOKEN
    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v12",
        center: tech.location || [-84.0, 39.9],
        zoom: 10
    });

    const assigned = JSON.parse(localStorage.getItem("assignedWorkOrders")) || [];
    const available = JSON.parse(localStorage.getItem("availableWorkOrders")) || [];

    // Assigned jobs = exact pin
    assigned.forEach(order => {
        new mapboxgl.Marker({ color: "green" })
            .setLngLat(order.coords)
            .setPopup(new mapboxgl.Popup().setText(order.title))
            .addTo(map);
    });

    // Available jobs = randomized pin
    available.forEach(order => {
        const offsetLng = (Math.random() - 0.5) * 0.01;
        const offsetLat = (Math.random() - 0.5) * 0.01;

        new mapboxgl.Marker({ color: "blue" })
            .setLngLat([order.coords[0] + offsetLng, order.coords[1] + offsetLat])
            .setPopup(new mapboxgl.Popup().setText(order.title))
            .addTo(map);
    });
});

function logout() {
    localStorage.removeItem("technician");
    window.location.href = "index.html";
}
