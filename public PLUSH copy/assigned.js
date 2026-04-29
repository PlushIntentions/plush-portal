document.addEventListener("DOMContentLoaded", async () => {
    // Load technician
    const tech = JSON.parse(localStorage.getItem("technician"));
    if (!tech) {
        window.location.href = "index.html";
        return;
    }

    // Set welcome text
    const welcome = document.getElementById("welcome-text");
    if (welcome) {
        welcome.textContent = `${tech.name}, Ready To Work`;
    }

    // Mapbox token injected by Cloudflare
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Initialize map
    const map = new mapboxgl.Map({
        container: "map",
        style: "mapbox://styles/mapbox/streets-v12",
        center: tech.location || [-84.0, 39.9],
        zoom: 10
    });

    // ClickUp list IDs
    const ASSIGNED_LIST = "901415714562";
    const AVAILABLE_LIST = "901415851544";

    // ClickUp API token injected by Cloudflare
    const CLICKUP_TOKEN = CLICKUP_API;

    // Fetch tasks from a ClickUp list
    async function fetchTasks(listId) {
        const res = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });
        const data = await res.json();
        return data.tasks || [];
    }

    // Fetch full task details
    async function fetchTaskDetails(taskId) {
        const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });
        return await res.json();
    }

    // Load assigned tasks
    const assignedTasks = await fetchTasks(ASSIGNED_LIST);

    // Load available tasks (for Client Address)
    const availableTasks = await fetchTasks(AVAILABLE_LIST);

    // Create a lookup table for available tasks by name
    const availableLookup = {};
    availableTasks.forEach(t => {
        availableLookup[t.name.trim().toLowerCase()] = t;
    });

    const assignedList = document.getElementById("assigned-list");
    assignedList.innerHTML = "";

    // Process each assigned task
    for (const task of assignedTasks) {
        const fullTask = await fetchTaskDetails(task.id);

        // Try to find matching available task by name
        const match = availableLookup[task.name.trim().toLowerCase()];

        let clientAddress = "No address found";
        let lat = null;
        let lng = null;

        if (match && match.location) {
            clientAddress = match.location.address || "No address";
            lat = match.location.lat;
            lng = match.location.lng;
        }

        // Add marker to map
        if (lat && lng) {
            new mapboxgl.Marker({ color: "green" })
                .setLngLat([lng, lat])
                .setPopup(new mapboxgl.Popup().setText(task.name))
                .addTo(map);
        }

        // Build list item
        const li = document.createElement("li");
        li.className = "workorder-item";

        li.innerHTML = `
            <h3>${task.name}</h3>
            <p><strong>Address:</strong> ${clientAddress}</p>
            <p><strong>Status:</strong> ${task.status?.status || "Unknown"}</p>
            <button class="view-btn">View Work Order</button>
        `;

        // Click → open workorder.html
        li.querySelector(".view-btn").addEventListener("click", () => {
            const selected = {
                id: task.id,
                name: task.name,
                description: fullTask.text_content || "",
                status: task.status?.status || "",
                priority: task.priority?.priority || "",
                address: clientAddress,
                lat,
                lng
            };

            localStorage.setItem("selectedWorkOrder", JSON.stringify(selected));
            window.location.href = "workorder.html";
        });

        assignedList.appendChild(li);
    }
});
