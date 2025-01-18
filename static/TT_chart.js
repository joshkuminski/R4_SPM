const ctx = document.getElementById('timeSpaceChart').getContext('2d');

let TTChart = null;

// EXAMPLE Data: Intersections and Travel Times
const signalTimings = {
    "Intersection A": [
        { start: "2025-01-13T08:00:00Z", end: "2025-01-13T08:10:00Z", color: 'green' },
        { start: "2025-01-13T08:10:00Z", end: "2025-01-13T08:15:00Z", color: 'red' },
    ],
    "Intersection B": [
        { start: "2025-01-13T08:05:00Z", end: "2025-01-13T08:15:00Z", color: 'green' },
        { start: "2025-01-13T08:15:00Z", end: "2025-01-13T08:20:00Z", color: 'red' },
    ],
    "Intersection C": [
        { start: "2025-01-13T08:20:00Z", end: "2025-01-13T08:30:00Z", color: 'green' },
        { start: "2025-01-13T08:30:00Z", end: "2025-01-13T08:35:00Z", color: 'red' },
    ],
};





// Convert data for Chart.js
const intersectionData = CorridorData.map(intersection => ({
    x: null, // No specific timestamp for intersections
    y: intersection.distance,
    label: intersection.intersectionId,
}));

const trajectoryData = TTData.slice(0,505).map(point => ({
    x: new Date(point.Timestamp),
    y: point.distance,
}));

// Map distances to intersection IDs for the y-axis labels
const yLabels = CorridorData.reduce((acc, intersection) => {
    acc[intersection.distance] = intersection.intersectionId;
    return acc;
}, {});

// Map distances to intersection IDs for the y-axis
const yTicks = CorridorData.map(intersection => ({
    value: intersection.distance,
    label: `${intersection.intersectionId} (${intersection.distance.toFixed(0)} ft)`,
}));

// Create horizontal lines to indicate the intersections for now
const horizontalLines = CorridorData.map(intersection => ({
    label: `Line at ${intersection.intersectionId}`,
    data: [
        { x: '2024-07-08T21:54:57Z', y: intersection.distance }, // Start of line
        { x: '2024-07-08T22:05:07Z', y: intersection.distance }, // End of line
    ],
    borderColor: 'red',
    borderWidth: 1,
    showLine: true,
    pointRadius: 0, // No points, just a line
}));


console.log(yTicks);


function updateTravelTimeChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected phase
    //const runData = getRunData(selectedRun);

    // Destroy the previous chart instance if it exists
    if (TTChart) {
        TTChart.destroy();
    }

    // Initialize the chart
    TTChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Vehicle Trajectory',
                    data: trajectoryData,
                    borderColor: 'blue',
                    borderWidth: 2,
                    showLine: true,
                    fill: false,
                },
                ...horizontalLines,
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                zoom: {
                    pan: {
                        enabled: true,
                        mode: 'x', // Allow panning in the x-axis direction
                    },
                    zoom: {
                        wheel: {
                            enabled: true, // Enable zooming with the mouse wheel
                        },
                        pinch: {
                            enabled: true, // Enable zooming with pinch gestures
                        },
                        drag: {
                            enabled: false, // Enable zooming by dragging a rectangle
                        },
                        mode: 'x', // Allow zooming in both x and y axes
                    },
                },
            },
            
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'second',
                        displayFormats: { second: 'HH:mm:ss' },
                    },
                    title: { display: true, text: 'Time (HH:mm:ss)' },
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Distance (feet)' },
                    ticks: {
                        callback: (value) => {
                            const tick = yTicks.find(t => t.value === value);
                            return tick ? tick.label : `${value.toFixed(0)} ft`;
                        },
                        autoSkip: false, // Ensure all ticks are shown
                        stepSize: null,  // Dynamically align ticks
                    },
                },
            },
        },
    });
}

// Initial chart rendering
updateTravelTimeChart();

// Create Chart
//new Chart(ctx, config);