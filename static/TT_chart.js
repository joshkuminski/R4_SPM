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



function getRunData(selectedDate, selectedRunId) {
    console.log(selectedDate, selectedRunId);
    // Filter data by the selected date and runId
    const filteredData = TTData.filter(point => {
        const pointDate = point.Timestamp.split(' ')[0]; // Extract date from timestamp
        return pointDate === selectedDate && point.runId === selectedRunId;
    });

    // Map the filtered data to the desired format
    const formattedData = filteredData.map(point => ({
        x: new Date(point.Timestamp),
        y: point.distance,
    }));

    return formattedData;
}



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


let firstTimestamp;
let lastTimestamp;
function createHorizontalLines(data) {
    // Get the first and last timestamps for the selected runId
    if (data.length === 0) {
        console.warn("No data found for the selected runId.");
        return [];
    }
    firstTimestamp = new Date(data[0].x);
    lastTimestamp = new Date(data[data.length - 1].x);

    // Map horizontal lines for each intersection
    const horizontalLines = CorridorData.map(intersection => ({
        label: `Line at ${intersection.intersectionId}`,
        data: [
            { x: firstTimestamp, y: intersection.distance }, // Start of line
            { x: lastTimestamp, y: intersection.distance },  // End of line
        ],
        borderColor: 'red',
        borderWidth: 1,
        showLine: true,
        pointRadius: 0, // No points, just a line
    }));

    return horizontalLines;
}



function prepareAnnotations(annotationsData) {
    const annotations = [];

    annotationsData.forEach(line => {
        Object.entries(line).forEach(([lineName, phases]) => {
            phases.forEach(phaseData => {
                Object.entries(phaseData).forEach(([phaseName, intervals]) => {
                    intervals.forEach(interval => {
                        annotations.push({
                            type: 'box',
                            xMin: new Date(interval.start).getTime(), // Start timestamp
                            xMax: new Date(interval.end).getTime(),   // End timestamp
                            yMin: lineName === 'Line_1' ? 0 : 1,      // Position for Line_1 or Line_2
                            yMax: lineName === 'Line_1' ? 0.5 : 1.5,
                            backgroundColor: getColor(interval.color), // Map color names to colors
                            borderWidth: 0,
                        });
                    });
                });
            });
        });
    });

    return annotations;
}

// Map color names to RGBA values
function getColor(color) {
    const colorMap = {
        Green: 'rgba(0, 255, 0, 0.3)',
        Yel: 'rgba(255, 255, 0, 0.3)',
        Red: 'rgba(255, 0, 0, 0.3)',
        AllRed: 'rgba(255, 0, 255, 0.3)',
    };

    return colorMap[color] || 'rgba(200, 200, 200, 0.3)'; // Default to grey
}



/*
// Create annotations for each interval
const annotations = Split_Annotations.map((interval, index) => ({
    type: 'box',
    xMin: new Date(interval.start).getTime(),
    xMax: new Date(interval.end).getTime(),
    yMin: 0, // Adjust y-axis value for stacking or grouping
    yMax: 1, // Adjust height of the box
    backgroundColor: getColor(interval.color), // Function to map "Green", "Yel", "Red", "AllRed" to colors
    borderColor: 'black',
    borderWidth: 1,
    label: {
        content: `${interval.color}`,
        enabled: true,
        position: 'center',
    },
}));

// Add annotations to the chart
const annotationPlugin = {
    annotations: annotations,
};
*/

// Function to map interval colors to chart colors
function getColor(color) {
    const colorMap = {
        Green: 'rgba(0, 255, 0, 0.2)',
        Yel: 'rgba(255, 255, 0, 0.2)',
        Red: 'rgba(255, 0, 0, 0.2)',
        AllRed: 'rgba(128, 0, 128, 0.2)',
    };
    return colorMap[color] || 'rgba(200, 200, 200, 0.2)';
}








function updateTravelTimeChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected date and run
    const trajectoryData = getRunData(selectedDate, parseInt(selectedRun));

    const IntersectionLines = createHorizontalLines(trajectoryData);
    
    // Prepare annotations for Chart.js
    const chartAnnotations = prepareAnnotations(Split_Annotations);

    console.log(chartAnnotations)
    
    //const result = filterAnnotationsByTimestamp();


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
                    pointRadius: 0,
                    fill: false,
                },
                ...IntersectionLines,
            ],
        },
        options: {
            responsive: true,
            plugins: {
                annotation: chartAnnotations,
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