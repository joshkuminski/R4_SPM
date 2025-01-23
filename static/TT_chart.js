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
            { x: firstTimestamp, y: intersection.distance}, // Start of line
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
        const IntersectionLabel = CorridorData[intId].intersectionId;

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
                                                        xMin: new Date(timeT[1].start).getTime(), // Start timestamp
                                                        xMax: new Date(timeT[1].end).getTime(),   // End timestamp
                                                        yMin: lineName === 'Line_1' ?  IntersectionDistance : (IntersectionDistance - 150),      // Position for Line_1 or Line_2
                                                        yMax: lineName === 'Line_1' ?  (IntersectionDistance + 150) : IntersectionDistance,
                                                        backgroundColor: getColor(timeT[1].color), // Map color names to colors
                                                        borderWidth: 0,
                                                        z: -1,
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

const diagonalStripePattern1 = pattern.draw('diagonal', 'rgba(42, 129, 81, 0.75)');
const diagonalStripePattern2 = pattern.draw('diagonal-right-left', 'rgba(42, 129, 81, 0.75)');
/*
const diagonalStripePattern1 = pattern.draw('diagonal', {
    backgroundColor: 'rgba(0, 255, 0, 1)',
    patternColor:'rgba(255, 0, 0, 1)',
    spacing: 10,
    lineWidth: 2
}); 

const diagonalStripePattern2 = pattern.draw('diagonal-right-left', {
    backgroundColor: 'rgba(0, 255, 0, 1)',
    patternColor:'rgba(255, 0, 0, 1)',
    spacing: 10,
    lineWidth: 2
}); 
*/

// Function to map interval colors to chart colors
function getColor(color) {
    const colorMap = {
        Green: 'rgba(0, 255, 0, 0.75)',
        Yel: 'rgba(255, 255, 0, 0.75)',
        Red: 'rgba(255, 0, 0, 0.75)',
        AllRed: 'rgba(100, 5, 45, 0.75)',
        GreenUp: diagonalStripePattern1,
        GreenDwn: diagonalStripePattern2,
    };
    return colorMap[color] || 'rgba(200, 200, 200, 0.7)';
}


function filterAnnotations(annotations, runStartTime, runEndTime) {
    //console.log(runStartTime, runEndTime);
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


function calculateAverageSpeed(trajectoryData, CorridorData) {
    // Ensure CorridorData is sorted by distance
    CorridorData.sort((a, b) => a.distance - b.distance);

    const averageSpeeds = [];

    for (let i = 0; i < CorridorData.length - 1; i++) {
        const currentIntersection = CorridorData[i];
        const nextIntersection = CorridorData[i + 1];

        // Filter trajectory data between the two intersections
        const segmentData = trajectoryData.filter(point =>
            point.y >= currentIntersection.distance && point.y <= nextIntersection.distance
        );

        if (segmentData.length < 2) {
            // If not enough data points, skip this segment
            averageSpeeds.push({
                startIntersection: currentIntersection.intersectionId,
                endIntersection: nextIntersection.intersectionId,
                avgSpeed: null,
            });
            continue;
        }

        // Calculate total time and distance for the segment
        const totalTime =
            (new Date(segmentData[segmentData.length - 1].x) - new Date(segmentData[0].x)) / 1000; // Seconds
        const totalDistance = nextIntersection.distance - currentIntersection.distance; // Feet

        // Calculate average speed (ft/s)
        const avgSpeed = totalDistance / totalTime;

        // Convert speed to km/h if needed
        const avgSpeedMph = avgSpeed * 0.6818;

        averageSpeeds.push({
            startIntersection: currentIntersection.intersectionId,
            endIntersection: nextIntersection.intersectionId,
            avgSpeed: avgSpeedMph.toFixed(2), // Round to 2 decimal places
        });
    }

    return averageSpeeds;

}


function generateTrajectorySegments(trajectoryData) {
    const segments = [];
    const colors = {
        slow: "red",
        medium: "yellow",
        fast: "blue",
    };

    // Define speed thresholds
    const slowThreshold = 15; // Speed below this is "slow"
    const fastThreshold = 30; // Speed above this is "fast"

    for (let i = 1; i < trajectoryData.length; i++) {
        const prev = trajectoryData[i - 1];
        const curr = trajectoryData[i];

        // Calculate speed
        const distance = curr.y - prev.y;
        const time =
            (new Date(curr.x).getTime() - new Date(prev.x).getTime()) / 1000;
        const speed = distance / time;

        let speedMph;
        if (!Number.isNaN(speed)) {
            speedMph = Math.abs(speed * 0.6818);
        }else{
            speedMph = 0;
        }
        //console.log(speedMph);

        // Determine color based on speed
        let color;
        if (speedMph <= slowThreshold) {
            color = colors.slow;
        } else if (speedMph > slowThreshold && speedMph <= fastThreshold) {
            color = colors.medium;
        } else {
            color = colors.fast;
        }

        // Create a segment
        segments.push({
            label: '',
            data: [prev, curr], // Segment start and end points
            borderColor: color,
            borderWidth: 2,
            showLine: true,
            pointRadius: 0, // No points, just a line
            fill: false,
            z: 1,
        });
    }

    return segments;
}


// Calculate Metrics
function calculateMetrics(corridorData, trajectoryData) {
    const metrics = [];
    let totalTravelTime = 0;

    for (let i = 0; i < corridorData.length - 1; i++) {
        const startIntersection = corridorData[i];
        const endIntersection = corridorData[i + 1];

        let segmentData;
        if (i == (corridorData.length - 2)){
            // Filter trajectory data between the two intersections
            segmentData = trajectoryData.filter(point =>
                point.y >= startIntersection.distance  && point.y <= (endIntersection.distance + 300)
            );
            console.log(endIntersection.distance, endIntersection.distance + 600);
        }else if(i == 0){
            segmentData = trajectoryData.filter(point =>
                point.y >= (startIntersection.distance - 300) && point.y <= endIntersection.distance
            );
        }else{
            segmentData = trajectoryData.filter(point =>
                point.y >= startIntersection.distance && point.y <= endIntersection.distance
            );
        };
        

        const startTime = new Date(segmentData[0].x);
        const endTime = new Date(segmentData[segmentData.length - 1].x);

        const travelTime = (endTime - startTime) / 1000 ; // Travel time in seconds
        //console.log(travelTime);
        const distance = endIntersection.distance - startIntersection.distance; // Distance in feet
        //console.log(distance);
        const avgSpeed = (distance / travelTime ) * 0.6818; // Average speed in mph

        metrics.push({
            startIntersection: startIntersection.intersectionId,
            endIntersection: endIntersection.intersectionId,
            avgSpeed: avgSpeed.toFixed(2),
            travelTime: travelTime.toFixed(2),
        });

        totalTravelTime += travelTime;
    }

    return { metrics, totalTravelTime: totalTravelTime.toFixed(2) };
}


// Generate Table
function generateTable(metrics, totalTravelTime) {
    let tableHTML = `
        <table border="1" style="width: 100%; text-align: center; border-collapse: collapse;">
            <thead>
                <tr>
                    <th>Start Intersection</th>
                    <th>End Intersection</th>
                    <th>Average Speed (mph)</th>
                    <th>Travel Time (sec)</th>
                </tr>
            </thead>
            <tbody>
    `;

    metrics.forEach(row => {
        tableHTML += `
            <tr>
                <td>${row.startIntersection}</td>
                <td>${row.endIntersection}</td>
                <td>${row.avgSpeed}</td>
                <td>${row.travelTime}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Total Travel Time</strong></td>
                    <td><strong>${totalTravelTime} sec</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    return tableHTML;
}


function updateTravelTimeChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected date and run
    const trajectoryData = getRunData(selectedDate, parseInt(selectedRun));

    const AveSpeed = calculateAverageSpeed(trajectoryData, CorridorData);
    console.log(AveSpeed);
    //const trajectoryDataset = generateTrajectoryDataset(trajectoryData);
    // Generate datasets for each segment
    const trajectorySegments = generateTrajectorySegments(trajectoryData);

    const IntersectionLines = createHorizontalLines(trajectoryData);
    
    // Render Table Below the Chart
    function renderTable() {
        const { metrics, totalTravelTime } = calculateMetrics(CorridorData, trajectoryData);
        const tableHTML = generateTable(metrics, totalTravelTime);
        document.getElementById('travelMetricsTable').innerHTML = tableHTML;
    }

    renderTable();

    // Prepare annotations for Chart.js
    const chartAnnotations = prepareAnnotations(Split_Annotations);

    // Get first and last timestamps
    const { firstTimestamp, lastTimestamp } = getFirstAndLastTimestamp(trajectoryData);

    const filteredChartAnnotations = filterAnnotations(chartAnnotations, firstTimestamp - 120000, lastTimestamp + 120000);


    // Destroy the previous chart instance if it exists
    if (TTChart) {
        TTChart.destroy();
    }

    // Initialize the chart
    TTChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                ...trajectorySegments,
                ...IntersectionLines,
            ],
        },
        options: {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: filteredChartAnnotations,
                },
                pattern, //pattern plugin
                legend: {
                    labels: {
                        filter: (legendItem) => {
                            // Exclude datasets with empty labels
                            return legendItem.text && legendItem.text.trim() !== '';
                        },
                    },
                },        
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
// Call the renderTable function

