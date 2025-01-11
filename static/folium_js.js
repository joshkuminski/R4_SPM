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
