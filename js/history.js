// script.js
document.addEventListener("DOMContentLoaded", () => {
    const accordions = document.querySelectorAll(".accordion-header");
  
    // Accordion Toggle Logic
    accordions.forEach((accordion) => {
      accordion.addEventListener("click", () => {
        const content = accordion.nextElementSibling;
        const icon = accordion.querySelector(".icon");
  
        if (content.style.maxHeight) {
          content.style.maxHeight = null;
          icon.textContent = "+";
        } else {
          document.querySelectorAll(".accordion-content").forEach((item) => {
            item.style.maxHeight = null;
            item.previousElementSibling.querySelector(".icon").textContent = "+";
          });
  
          content.style.maxHeight = content.scrollHeight + "px";
          icon.textContent = "-";
        }
      });
    });
  
    // Fetch version from manifest.json
    fetch("manifest.json")
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("version").textContent = data.version || "N/A";
      })
      .catch(() => {
        document.getElementById("version").textContent = "Error fetching version";
      });
  });
  