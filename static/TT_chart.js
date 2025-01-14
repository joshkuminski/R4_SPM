const ctx = document.getElementById('timeSpaceChart').getContext('2d');

// Data: Intersections and Travel Times
const intersections = [
    { name: "Intersection A", lat: 37.7749 },
    { name: "Intersection B", lat: 37.8044 },
    { name: "Intersection C", lat: 37.8715 },
];

const travelTimes = [
    { start: "Intersection A", end: "Intersection B", time: 10 }, // 10 minutes
    { start: "Intersection B", end: "Intersection C", time: 15 }, // 15 minutes
];

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

// Calculate Vehicle Trajectory
const vehicleTrajectory = [];
let currentTime = new Date("2025-01-13T08:00:00Z");
intersections.forEach((intersection, i) => {
    vehicleTrajectory.push({ x: currentTime.toISOString(), y: intersection.lat });
    if (i < travelTimes.length) {
        currentTime.setMinutes(currentTime.getMinutes() + travelTimes[i].time);
    }
});

// Generate Signal Timing Annotations
const annotations = {};
intersections.forEach((intersection) => {
    const timings = signalTimings[intersection.name];
    timings.forEach((timing, i) => {
        annotations[`${intersection.name}_signal${i}`] = {
            type: 'box',
            xMin: timing.start,
            xMax: timing.end,
            yMin: intersection.lat - 0.005,
            yMax: intersection.lat + 0.005,
            backgroundColor: timing.color === 'green' ? 'rgba(0, 255, 0, 0.3)' :
                              timing.color === 'red' ? 'rgba(255, 0, 0, 0.3)' : 
                              'rgba(255, 255, 0, 0.3)',
            borderWidth: 0,
        };
    });
});

// Chart.js Configuration
const config = {
    type: 'scatter',
    data: {
        datasets: [
            {
                label: 'Vehicle Trajectory',
                data: vehicleTrajectory,
                borderColor: 'blue',
                borderWidth: 2,
                showLine: true,
                fill: false,
            },
        ],
    },
    options: {
        responsive: true,
        plugins: {
            annotation: { annotations },
            legend: { position: 'top' },
        },
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: 'minute',
                    displayFormats: { minute: 'HH:mm' },
                },
                title: { display: true, text: 'Time (HH:mm)' },
            },
            y: {
                title: { display: true, text: 'Latitude' },
                ticks: { callback: (value) => `${value.toFixed(4)}°` },
            },
        },
    },
};

// Create Chart
new Chart(ctx, config);