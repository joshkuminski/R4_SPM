let selectedRange = 'last_month';
let customStartDate = null;
let customEndDate = null;

document.addEventListener("DOMContentLoaded", () => {
   const timeRangeDropdown = document.getElementById("range");
   const customRangeContainer = document.getElementById("custom-range-container");
   const startDateInput = document.getElementById("start-date");
   const endDateInput = document.getElementById("end-date");

   // Initialize Flatpickr for date inputs
   flatpickr(startDateInput, {
       dateFormat: "Y-m-d",
       onChange: (selectedDates) => {
           customStartDate = selectedDates[0];
       },
   });
   flatpickr(endDateInput, {
       dateFormat: "Y-m-d",
       onChange: (selectedDates) => {
           customEndDate = selectedDates[0];
       },
   });

   timeRangeDropdown.addEventListener("change", () => {
       if (timeRangeDropdown.value === "custom") {
           customRangeContainer.style.display = "block";
       } else {
           customRangeContainer.style.display = "none";
           selectedRange = timeRangeDropdown.value;
       }
   });

   document.getElementById("apply-date-range").addEventListener("click", () => {
       if (!customStartDate || !customEndDate) {
           alert("Please select both a start date and an end date.");
           return;
       }
       selectedRange = `custom_range:${customStartDate.toISOString().split("T")[0]},${customEndDate.toISOString().split("T")[0]}`;
       alert(`Custom range applied: ${customStartDate.toISOString().split("T")[0]} to ${customEndDate.toISOString().split("T")[0]}`);
   });
});

function setTimeRange(range) {
   selectedRange = range;
}

function passTimeRangeToMarker(markerUrl) {
   return markerUrl + `?time_range=${selectedRange}`;
}


// JS for the Corridor Button
const selectedLocations = [];

// Function to toggle selection of a location
function toggleSelection(lat, lng, name) {
    const location = { lat, lng, name };
    const index = selectedLocations.findIndex(loc => loc.lat === lat && loc.lng === lng);

    if (index === -1) {
        selectedLocations.push(location); // Add location
        alert(`${name} added to corridor.`);
    } else {
        selectedLocations.splice(index, 1); // Remove location
        alert(`${name} removed from corridor.`);
    }
}

// Function to save the selected locations
async function saveCorridor() {
    if (selectedLocations.length === 0) {
        alert("No locations selected.");
        return;
    }

    const response = await fetch('/add_corridor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: selectedLocations }),
    });

    if (response.ok) {
        alert("Corridor saved successfully.");
    } else {
        alert("Failed to save corridor.");
    }
}





 // Function to update the dropdown with corridors
 async function updateCorridorDropdown() {
    const response = await fetch('/get_corridors');
    if (!response.ok) {
        alert("Failed to fetch corridors.");
        return;
    }

    const corridors = await response.json();
    const dropdown = document.getElementById("corridor-dropdown");
    dropdown.innerHTML = ""; // Clear existing options

    corridors.forEach(({ corridorId, corridorName }) => {
        const option = document.createElement("option");
        option.text = `${corridorId} (${corridorName} intersections)`;
        option.value = corridorId;
        dropdown.appendChild(option);
    });
}


// Populate the dropdown on page load
document.addEventListener("DOMContentLoaded", updateCorridorDropdown);

