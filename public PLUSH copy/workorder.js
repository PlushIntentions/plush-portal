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

    // Load selected work order
    const selected = JSON.parse(localStorage.getItem("selectedWorkOrder"));
    if (!selected) {
        document.getElementById("workorder-details").innerHTML =
            "<p>No work order selected.</p>";
        return;
    }

    // ClickUp API token injected by Cloudflare
    const CLICKUP_TOKEN = CLICKUP_API;

    // List IDs
    const AVAILABLE_LIST = "901415851544";

    // Fetch full task details
    async function fetchTaskDetails(taskId) {
        const res = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });
        return await res.json();
    }

    // Fetch tasks from available list to match address
    async function fetchAvailableTasks() {
        const res = await fetch(`https://api.clickup.com/api/v2/list/${AVAILABLE_LIST}/task`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });
        const data = await res.json();
        return data.tasks || [];
    }

    // Fetch full details for selected task
    const fullTask = await fetchTaskDetails(selected.id);

    // Fetch available tasks to find address
    const availableTasks = await fetchAvailableTasks();

    // Match by name
    const match = availableTasks.find(
        t => t.name.trim().toLowerCase() === selected.name.trim().toLowerCase()
    );

    let clientAddress = "No address found";
    let lat = null;
    let lng = null;

    if (match && match.location) {
        clientAddress = match.location.address || "No address";
        lat = match.location.lat;
        lng = match.location.lng;
    }

    // Build details HTML
    const container = document.getElementById("workorder-details");

    container.innerHTML = `
        <div class="detail-item">
            <h3>Work Order</h3>
            <p><strong>Title:</strong> ${selected.name}</p>
            <p><strong>Description:</strong> ${fullTask.text_content || "No description"}</p>
        </div>

        <div class="detail-item">
            <h3>Client Address</h3>
            <p>${clientAddress}</p>
            ${lat && lng ? `<p><strong>Coordinates:</strong> ${lat}, ${lng}</p>` : ""}
        </div>

        <div class="detail-item">
            <h3>Status & Priority</h3>
            <p><strong>Status:</strong> ${selected.status || "Unknown"}</p>
            <p><strong>Priority:</strong> ${selected.priority || "None"}</p>
        </div>

        <div class="detail-item">
            <h3>Attachments</h3>
            ${fullTask.attachments && fullTask.attachments.length > 0
                ? fullTask.attachments
                    .map(a => `<a class="attachment-link" href="${a.url}" target="_blank">${a.title}</a>`)
                    .join("")
                : "<p>No attachments</p>"
            }
        </div>
    `;

    // Close-out button
    document.getElementById("closeout-btn").addEventListener("click", () => {
        window.open(`https://app.clickup.com/t/${selected.id}`, "_blank");
    });
});
