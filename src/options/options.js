document.addEventListener("DOMContentLoaded", () => {
    const tabs = document.querySelectorAll(".ribbon-tab");
    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            // Deactivate all
            tabs.forEach((t) => t.classList.remove("active"));
            panels.forEach((p) => p.classList.remove("active"));

            // Activate clicked
            tab.classList.add("active");
            const targetId = tab.getAttribute("data-target");
            const targetPanel = document.getElementById(targetId);
            if (targetPanel) {
                targetPanel.classList.add("active");
            }
        });
    });
});
