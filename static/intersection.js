const tmcData = JSON.parse('{{ tmc_data | safe }}');
const anomalies = JSON.parse('{{ anomalies | tojson | safe }}');


// Extract unique dates and times
const timestamps = tmcData.map(entry => new Date(entry.timestamp));
const uniqueDates = [...new Set(timestamps.map(ts => ts.toISOString().split('T')[0]))];
const uniqueTimes = [...new Set(timestamps.map(ts => ts.toISOString().split('T')[1].substring(0, 5)))];

// Initialize Flatpickr for date inputs
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

flatpickr(startDateInput, {
    dateFormat: "Y-m-d",
    enable: uniqueDates.map(date => new Date(date)),
    onChange: updateChart
});

flatpickr(endDateInput, {
    dateFormat: "Y-m-d",
    enable: uniqueDates.map(date => new Date(date)),
    defaultDate: uniqueDates[uniqueDates.length - 1],
    onChange: updateChart
});

 function generateTimeIntervals() {
    const times = [];
    let currentTime = new Date(0, 0, 0, 0, 0); // Start at 00:00
    const endTime = new Date(0, 0, 0, 23, 45); // End at 23:45

    while (currentTime <= endTime) {
        times.push(
            currentTime
                .toTimeString()
                .slice(0, 5) // Extract "HH:MM"
        );
        currentTime.setMinutes(currentTime.getMinutes() + 15);
    }
    return times;
}

// Populate time dropdowns
const startTimeDropdown = document.getElementById('start-time');
const endTimeDropdown = document.getElementById('end-time');

const timeIntervals = generateTimeIntervals();

// Populate Start and End Time Dropdowns
timeIntervals.forEach((time, index) => {
    const startOption = new Option(time, time);
    startTimeDropdown.add(startOption);

    const endOption = new Option(time, time);
    if (index === timeIntervals.length - 1) {
        endOption.selected = true; // Default to the last time
    }
    endTimeDropdown.add(endOption);
});

let selectedTimestamps = []; // Store selected timestamps

// Initialize chart
const ctxBar = document.getElementById('volumeBarChart').getContext('2d');
// Extract anomaly timestamps
const anomalyTimestamps = new Set(anomalies.map(anomaly => anomaly.timestamp));
let volumeBarChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
        labels: tmcData.map(entry => entry.timestamp),
        datasets: [{
            label: 'Total Volume',
            data: tmcData.map(entry => entry.Total),
            backgroundColor: tmcData.map(entry =>
                anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6)'
            ),
            borderColor: tmcData.map(entry =>
                anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6)'
            ),
            //borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1
        }]
    },
     options: {
        responsive: true,
        plugins: {
            title: {
                display: true,
                text: 'Total Vehicle Volume Over Time'
            },
            zoom: {
                pan: {
                    enabled: true,
                    mode: 'x',
                },
                zoom: {
                    pinch: {
                        enabled: true
                    },
                    wheel: {
                        enabled: true
                    },
                    mode: 'x'
                }
            }
        },
        scales: {
            x: {
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Volume'
                },
                beginAtZero: true
            }
        },
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const index = elements[0].index;
                const selectedTimestamp = volumeBarChart.data.labels[index];

                // Toggle selection
                if (selectedTimestamps.includes(selectedTimestamp)) {
                    selectedTimestamps = selectedTimestamps.filter(ts => ts !== selectedTimestamp);
                    volumeBarChart.data.datasets[0].backgroundColor[index] = anomalyTimestamps.has(selectedTimestamp)
                        ? 'rgba(255, 99, 132, 0.6)' // Red for anomaly
                        : 'rgba(54, 162, 235, 0.6)'; // Blue for normal
                } else {
                    selectedTimestamps.push(selectedTimestamp);
                    volumeBarChart.data.datasets[0].backgroundColor[index] = 'rgba(72, 235, 31, 0.6)'; // Highlight selected
                }
                volumeBarChart.update();
                console.log("Selected Timestamps:", selectedTimestamps);
                }
            }
        }
});

// Update chart data based on date and time selection
function updateChart() {
    const startDate = startDateInput.value;
    const startTime = startTimeDropdown.value;
    const endDate = endDateInput.value;
    const endTime = endTimeDropdown.value;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    // Filter data
    const filteredData = tmcData.filter(entry => {
        const entryDateTime = new Date(entry.timestamp);
        return entryDateTime >= startDateTime && entryDateTime <= endDateTime;
    });

    // Re-apply anomaly highlighting
    const filteredBackgroundColors = filteredData.map(entry =>
        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6>'
    );

    // Update chart
    volumeBarChart.data.labels = filteredData.map(entry => entry.timestamp);
    volumeBarChart.data.datasets[0].data = filteredData.map(entry => entry.Total);
    volumeBarChart.data.datasets[0].backgroundColor = filteredBackgroundColors;
    volumeBarChart.data.datasets[0].borderColor = filteredBackgroundColors;
    volumeBarChart.update();
}

// Attach event listeners to time dropdowns
startTimeDropdown.addEventListener('change', updateChart);
endTimeDropdown.addEventListener('change', updateChart);

// Button to reset zoom
const resetButton = document.createElement('button');
resetButton.textContent = 'Reset Zoom';
resetButton.style.margin = '10px';
resetButton.onclick = () => volumeBarChart.resetZoom();


// Add a button to view details for selected timestamps
const viewDetailsButton = document.createElement('button');
viewDetailsButton.textContent = 'View TMC Details';
viewDetailsButton.style.margin = '10px';
viewDetailsButton.onclick = () => {
    if (selectedTimestamps.length > 0) {
        const queryString = selectedTimestamps
            .map(ts => `timestamp=${encodeURIComponent(ts)}`)
            .join('&');
        const name = encodeURIComponent('{{ name }}'); // Replace with dynamic data
        const intersectionId = encodeURIComponent('{{ intersection_id }}'); // Replace with dynamic data
        const url = `/movement_details?${queryString}&name=${name}&intersection_id=${intersectionId}`;

        // Open the movement details page in a new window
        window.open(url, '_blank');
    } else {
        alert("Please select at least one bar to view details.");
    }
};


// Display anomalies in a scrollable list
const anomalyList = document.getElementById('anomaly-items');
anomalies.forEach(anomaly => {
    const div = document.createElement('div');
    div.className = 'anomaly-item';
    div.textContent = `Timestamp: ${anomaly.timestamp}, Total: ${anomaly.Total}, Z-Score: ${anomaly.z_score.toFixed(2)}`;
    anomalyList.appendChild(div);
});


document.body.appendChild(resetButton);
document.body.appendChild(viewDetailsButton);