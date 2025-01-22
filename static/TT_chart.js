const ctx = document.getElementById('timeSpaceChart').getContext('2d');

let TTChart = null;

// Convert data for Chart.js
const intersectionData = CorridorData.map(intersection => ({
    x: null, // No specific timestamp for intersections
    y: intersection.distance,
    label: intersection.intersectionId,
}));



function getRunData(selectedDate, selectedRunId) {
    //console.log(selectedDate, selectedRunId);
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



// Function to prepare annotations for Chart.js
function prepareAnnotations(intersectionsData) {
    const annotations = [];

    // Loop through each intersection
    Object.entries(intersectionsData).forEach(([intId, intersection]) => {
        const IntersectionDistance = CorridorData[intId].distance; // Assumes your annotations are grouped by intersectionId
        //console.log(CorridorData[intId]);
        Object.entries(intersection).forEach(group => {
                if (group[1].length > 0){ //If there is split data
                    Object.entries(group[1]).forEach(([cycleName, cycles]) => {

                        Object.entries(cycles).forEach(cycle => {

                            Object.entries(cycle[1]).forEach(phases => {

                                Object.entries(phases[1]).forEach(phaseData => {
                                        
                                    Object.entries(phaseData[1]).forEach(([lineName, intervals]) => {
        
                                        intervals.forEach(interval => {

                                            Object.entries(interval).forEach(splitTime =>{
                                                
                                                Object.entries(splitTime[1]).forEach(timeT =>{

                                                    annotations.push({
                                                        type: 'box',
                                                        //label: `${CorridorData[intId].intersectionId}`,
                                                        xMin: new Date(timeT[1].start).getTime(), // Start timestamp
                                                        xMax: new Date(timeT[1].end).getTime(),   // End timestamp
                                                        yMin: lineName === 'Line_1' ? (IntersectionDistance - 100) : IntersectionDistance,      // Position for Line_1 or Line_2
                                                        yMax: lineName === 'Line_1' ? IntersectionDistance : (IntersectionDistance + 100),
                                                        backgroundColor: getColor(timeT[1].color), // Map color names to colors
                                                        borderWidth: 0,

                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                }
            });
    });

    return annotations;
}

// Function to map interval colors to chart colors
function getColor(color) {
    const colorMap = {
        Green: 'rgba(0, 255, 0, 0.7)',
        Yel: 'rgba(255, 255, 0, 0.7)',
        Red: 'rgba(255, 0, 0, 0.7)',
        AllRed: 'rgba(128, 0, 53, 0.7)',
    };
    return colorMap[color] || 'rgba(200, 200, 200, 0.7)';
}


function filterAnnotations(annotations, runStartTime, runEndTime) {
    console.log(runStartTime, runEndTime);
    return annotations.filter(annotation => 
        annotation.xMin >= runStartTime && annotation.xMax <= runEndTime
    );
}

// Function to get first and last timestamps
function getFirstAndLastTimestamp(data) {
    if (data.length === 0) return { firstTimestamp: null, lastTimestamp: null };

    const firstTimestamp = data[0].x.getTime(); // Convert to timestamp (ms)
    const lastTimestamp = data[data.length - 1].x.getTime(); // Convert to timestamp (ms)

    return { firstTimestamp, lastTimestamp };
}


function updateTravelTimeChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected date and run
    const trajectoryData = getRunData(selectedDate, parseInt(selectedRun));

    const IntersectionLines = createHorizontalLines(trajectoryData);
    
    // Prepare annotations for Chart.js
    const chartAnnotations = prepareAnnotations(Split_Annotations);

    // Get first and last timestamps
    const { firstTimestamp, lastTimestamp } = getFirstAndLastTimestamp(trajectoryData);

    const filteredChartAnnotations = filterAnnotations(chartAnnotations, firstTimestamp - 120000, lastTimestamp + 120000);
    console.log(filteredChartAnnotations);

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
                annotation: {
                    annotations: filteredChartAnnotations,
                },
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