document.addEventListener("DOMContentLoaded", async () => {
    const CLICKUP_TOKEN = CLICKUP_API;

    // Correct Custom Field IDs
    const TECH_NAME_FIELD = "251147d8-7ca2-43c9-9ce9-7a6133e7846b"; // Dropdown
    const PASSWORD_FIELD = "4a3203f3-655d-4e81-b10e-cd39d3806207"; // Text

    // Correct list containing technician profiles
    const TECH_LIST = "901415700168";

    const techDropdown = document.getElementById("techname");

    // Load tech names from ClickUp
    async function loadTechNames() {
        const res = await fetch(`https://api.clickup.com/api/v2/list/${TECH_LIST}/task`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });

        const data = await res.json();
        const tasks = data.tasks || [];

        techDropdown.innerHTML = "";

        tasks.forEach(task => {
            const techNameField = task.custom_fields.find(f => f.id === TECH_NAME_FIELD);

            if (techNameField && techNameField.value) {
                const option = document.createElement("option");
                option.value = task.id; // store task ID
                option.textContent = techNameField.value; // display tech name
                techDropdown.appendChild(option);
            }
        });
    }

    await loadTechNames();

    // Login button
    document.getElementById("login-btn").addEventListener("click", async () => {
        const selectedTaskId = techDropdown.value;
        const enteredPassword = document.getElementById("password").value.trim();

        if (!selectedTaskId || !enteredPassword) {
            alert("Please select your name and enter your password.");
            return;
        }

        // Fetch selected tech profile
        const res = await fetch(`https://api.clickup.com/api/v2/task/${selectedTaskId}`, {
            headers: { Authorization: CLICKUP_TOKEN }
        });

        const techData = await res.json();

        const passwordField = techData.custom_fields.find(f => f.id === PASSWORD_FIELD);

        if (!passwordField || passwordField.value !== enteredPassword) {
            alert("Incorrect password.");
            return;
        }

        // Save tech info
        const techNameField = techData.custom_fields.find(f => f.id === TECH_NAME_FIELD);

        const tech = {
            id: selectedTaskId,
            name: techNameField?.value || "Unknown"
        };

        localStorage.setItem("technician", JSON.stringify(tech));

        // Redirect to dashboard
        window.location.href = "dashboard.html";
    });
});
