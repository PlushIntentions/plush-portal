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

    // ClickUp API token injected by Cloudflare
    const CLICKUP_TOKEN = CLICKUP_API;

    // Available list ID
    const AVAILABLE_LIST = "901415851544";

    // Custom field name
    const DISPATCH_FIELD_NAME = "Dispatch Status";

    // Fetch tasks from available list
    async function fetchAvailableTasks() {
        const res = await fetch(`https://api.clickup.com/api/v2/list/${AVAILABLE_LIST}/task`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });
        const data = await res.json();
        return data.tasks || [];
    }

    // Update Dispatch Status custom field
    async function updateDispatchStatus(taskId, statusValue) {
        const body = {
            custom_fields: [
                {
                    name: DISPATCH_FIELD_NAME,
                    value: statusValue
                }
            ]
        };

        await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
            method: "PUT",
            headers: {
                Authorization: CLICKUP_TOKEN,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
    }

    // Load available tasks
    const tasks = await fetchAvailableTasks();
    const list = document.getElementById("available-list");
    list.innerHTML = "";

    tasks.forEach(task => {
        const address = task.location?.address || "No address found";

        const li = document.createElement("li");
        li.className = "workorder-item";

        li.innerHTML = `
            <h3>${task.name}</h3>
            <p><strong>Address:</strong> ${address}</p>
            <p><strong>Status:</strong> ${task.status?.status || "Unknown"}</p>

            <button class="claim-btn request-btn">Request</button>
            <button class="claim-btn deny-btn" style="background-color:#b85c7d;">Deny</button>
        `;

        // REQUEST button
        li.querySelector(".request-btn").addEventListener("click", async () => {
            await updateDispatchStatus(task.id, "Requested");
            alert("Request sent to dispatcher.");
        });

        // DENY button
        li.querySelector(".deny-btn").addEventListener("click", async () => {
            await updateDispatchStatus(task.id, "Denied");
            alert("You denied this work order.");
        });

        list.appendChild(li);
    });
});
