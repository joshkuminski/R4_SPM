const ctx = document.getElementById('timeSpaceChart').getContext('2d');
const ctx_2 = document.getElementById('timeSpeedChart').getContext('2d');

let TTChart = null;
let SpeedChart = null;
let travelTimeChart = null;

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
    label: `${intersection.name} (${intersection.distance.toFixed(0)} ft)`,
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
        //label: `Line at ${intersection.name}`,
        label: '',
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
        const IntersectionLabel = CorridorData[intId].name;

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
        Green: 'rgba(0, 255, 0, 0.65)',
        Yel: 'rgba(255, 255, 0, 0.65)',
        Red: 'rgba(255, 0, 0, 0.65)',
        AllRed: 'rgba(100, 5, 45, 0.75)',
        GreenUp: diagonalStripePattern1,
        GreenDwn: diagonalStripePattern2,
    };
    return colorMap[color] || 'rgba(200, 200, 200, 0.7)';
}


function filterAnnotations(annotations, runStartTime, runEndTime) {
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
    const Utils = {
        CHART_COLORS: {
          red: 'rgba(255, 99, 132, 1)',
          yellow: 'rgba(255, 206, 86, 1)',
          blue: 'rgba(54, 162, 235, 1)',
          dblue: 'rgb(38, 106, 151)',
        }
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
 
        // Determine color based on speed
        let color;
        if (speedMph <= slowThreshold) {
            color = Utils.CHART_COLORS.red;
        } else if (speedMph > slowThreshold && speedMph <= fastThreshold) {
            color = Utils.CHART_COLORS.yellow;
        } else {
            color = Utils.CHART_COLORS.dblue;
        }

        // Create a segment
        segments.push({
            label: '',
            data: [prev, curr], // Segment start and end points
            borderColor: color,
            borderWidth: 3,
            showLine: true,
            speed: speedMph,
            pointRadius: 0, // No points, just a line
            fill: false,
           
        });
    }

    return segments;
}


// Calculate Metrics
function calculateMetrics(corridorData, trajectoryData) {
    const metrics = [];
    let totalTravelTime = 0;
    let freeFlowTime = 0;
    // Calculate the total distance
    const totalDistance = corridorData[corridorData.length - 1].distance - corridorData[0].distance;

    for (let i = 0; i < corridorData.length - 1; i++) {
        const startIntersection = corridorData[i];
        const endIntersection = corridorData[i + 1];
        
        let segmentData;
        if (i == (corridorData.length - 2)){
            // Filter trajectory data between the two intersections
            segmentData = trajectoryData.filter(point =>
                point.y >= startIntersection.distance  && point.y <= (endIntersection.distance + 300)
            );
            //console.log(endIntersection.distance, endIntersection.distance + 600);
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
     
        const distance = endIntersection.distance - startIntersection.distance; // Distance in feet
   
        const avgSpeed = (distance / travelTime ) * 0.6818; // Average speed in mph

        metrics.push({
            startIntersection: startIntersection.intersectionId,
            endIntersection: endIntersection.intersectionId,
            avgSpeed: avgSpeed.toFixed(2),
            travelTime: travelTime.toFixed(2),
            startName: startIntersection.name,
            endName: endIntersection.name,
            delay: null, //placeholder
        });

        totalTravelTime += travelTime;
    }

    // Find the maximum average speed - Estimate based on the Max Avg Speed - 5mph
    const maxAvgSpeed = (Math.max(...metrics.map(metric => parseFloat(metric.avgSpeed)))) - 5;

    // Calculate free flow travel time 
    freeFlowTime = maxAvgSpeed > 0 ? totalDistance / (maxAvgSpeed / 0.6818) : null;

    // Add delay to each metric
    metrics.forEach(metric => {
        const distance = corridorData.find(intersection => intersection.intersectionId === metric.endIntersection).distance - 
                         corridorData.find(intersection => intersection.intersectionId === metric.startIntersection).distance;
        metric.delay = maxAvgSpeed > 0 ? (metric.travelTime - ((distance / (maxAvgSpeed / 0.6818) ).toFixed(2))).toFixed(2) : "N/A";
    });

    return { metrics, totalTravelTime: totalTravelTime.toFixed(2),
        freeFlowTime: freeFlowTime ? freeFlowTime.toFixed(2) : "N/A"};
}


// Generate Table
function generateTable(metrics, totalTravelTime, freeFlowTime) {
    let tableHTML = `
        <table border="1" style="width: 100%; text-align: center; border-collapse: collapse;">
            <thead>
                <tr>
                    <th>Start Intersection</th>
                    <th>End Intersection</th>
                    <th>Average Speed (mph)</th>
                    <th>Travel Time (sec)</th>
                    <th>Est. Delay (sec)</th>
                </tr>
            </thead>
            <tbody>
    `;

    metrics.forEach(row => {
        tableHTML += `
            <tr>
                <td>${row.startIntersection} - ${row.startName}</td>
                <td>${row.endIntersection} - ${row.endName}</td>
                <td>${row.avgSpeed}</td>
                <td>${row.travelTime}</td>
                <td>${row.delay}</td>
            </tr>
        `;
    });

    tableHTML += `
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="3"><strong>Total Travel Time</strong></td>
                    <td><strong>${totalTravelTime} sec // ${Math.trunc(totalTravelTime / 60)}min${Math.floor((totalTravelTime % 60))}sec</strong></td>
                    <td rowspan="2"><strong>${(totalTravelTime - freeFlowTime).toFixed(2)} sec</strong></td>
                </tr>
                <tr>
                    <td colspan="3"><strong>Est. Free Flow Time</strong></td>
                    <td><strong>${freeFlowTime} sec // ${Math.trunc(freeFlowTime / 60)}min${Math.floor((freeFlowTime % 60))}sec</strong></td>
                </tr>
            </tfoot>
        </table>
    `;

    return tableHTML;
}



// Function to create a gradient based on speed
function createSpeedGradient(ctx, chartArea, speeds) {
    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);

    // Determine color stops based on speed thresholds
    speeds.forEach((speed, index) => {
        const stopPosition = index / (speeds.length - 1); // Normalize position between 0 and 1
        let color;

        if (speed < 10) {
            color = "blue"; // Slow speed
        } else if (speed < 20) {
            color = "green"; // Medium speed
        } else {
            color = "red"; // High speed
        }

        gradient.addColorStop(stopPosition, color);
    });

    return gradient;
}

let IntersectionLines = [];

function updateTravelTimeChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected date and run
    const trajectoryData = getRunData(selectedDate, parseInt(selectedRun));

    const AveSpeed = calculateAverageSpeed(trajectoryData, CorridorData);
    //console.log(AveSpeed);
    //const trajectoryDataset = generateTrajectoryDataset(trajectoryData);
    // Generate datasets for each segment
    const trajectorySegments = generateTrajectorySegments(trajectoryData);

    // Render Table Below the Chart
    function renderTable() {
        const { metrics, totalTravelTime, freeFlowTime } = calculateMetrics(CorridorData, trajectoryData);
        const tableHTML = generateTable(metrics, totalTravelTime, freeFlowTime);
        document.getElementById('travelMetricsTable').innerHTML = tableHTML;
    }

    renderTable();

    // Prepare annotations for Chart.js
    const chartAnnotations = prepareAnnotations(Split_Annotations);


    // Get first and last timestamps
    const { firstTimestamp, lastTimestamp } = getFirstAndLastTimestamp(trajectoryData);

    const filteredChartAnnotations = filterAnnotations(chartAnnotations, firstTimestamp - 60000, lastTimestamp + 60000);

    IntersectionLines = createHorizontalLines(trajectoryData);

    pointColors = [
        '#DF00FF', // Vibrant Orange-Red
        '#0D9494', // Vibrant Green
        '#4D5D53', // Vibrant Blue
        '#801818', // Bright Yellow
        '#4A9976', // Vibrant Pink
        '#E48400', // Aqua
        '#8B5959', // Warm Orange
        '#9633FF', // Purple
        '#007474', // Light Green
        '#645452', // Lime Green
        '#FF5733', // Coral
        '#FF33A1', // Hot Pink
        '#000100', // Lime-Yellow
        '#5733FF', // Deep Purple
        '#33A1FF', // Sky Blue
        '#FF3385', // Rose
        '#85FF33', // Light Lime
        '#3385FF', // Royal Blue
        '#FF8333', // Soft Orange
        '#33FF83'  // Mint Green
    ];
    const pointData = CorridorData.map((intersection, index ) => ({
        typeLabel: "pointData",
        label: intersection.name,
        data: [{ x: firstTimestamp - 60000, y: intersection.distance }],
        backgroundColor: pointColors[index % pointColors.length],
        borderColor: pointColors[index % pointColors.length],
        pointRadius: 6,
        pointHoverRadius: 8,
    }));


    const annotations = [...filteredChartAnnotations];
    const data = [...trajectorySegments, ...IntersectionLines, ...pointData];

    // Destroy the previous chart instance if it exists
    if (TTChart) {
        TTChart.destroy();
    }
    if (travelTimeChart) {
        travelTimeChart.destroy();
    }
    // Initialize the chart
    TTChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: data,
        },
        options: {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: annotations,
                },
                pattern, //pattern plugin
                legend: {
                    labels: {
                        filter: (legendItem) => {
                            // Exclude datasets with empty labels
                            return legendItem.text && legendItem.text.trim() !== '';
                        },
                        color:'#4BCCB7',
                        font: {size: 18},
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
                        mode: 'xy', // Allow zooming in both x and y axes
                    },
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataset = context.dataset; // Access the dataset object
                            const dataPoint = context.raw;  // Get the current data point

                             // If the dataset is a "pointData", show its label instead
                            if (dataset.typeLabel === "pointData") {
                                return `Intersection: ${dataset.label}`;
                            } 
                            
                            // If it's trajectory data, display speed and distance
                            else {
                                const speed = dataset.speed ? dataset.speed.toFixed(2) : 0.0;
                                return `Distance: ${dataPoint.y.toFixed(2)} ft\nSpeed: ${speed} mph`;
                            }
                        }
                    }
                },
            },
            
            scales: {
                x: {
                    type: 'time',
                    ticks: {
                        color: '#4BCCB7', 
                        font: {size: 14},
                    },
                    time: {
                        unit: 'second',
                        displayFormats: { second: 'HH:mm:ss' },
                    },
                    title: { display: true, text: 'Time (HH:mm:ss)', font: {size: 18}, color:'#4BCCB7' },
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Distance (feet)', font: {size: 18}, color:'#4BCCB7' },
                    ticks: {
                        callback: (value) => {
                            const tick = yTicks.find(t => t.value === value);
                            return tick ? tick.label : `${value.toFixed(0)} ft`;
                        },
                        color: '#4BCCB7', 
                        font: {size: 14},
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


function getSpeedData(selectedDate, selectedRunId) {
    //console.log(selectedDate, selectedRunId);
    // Filter data by the selected date and runId
    const filteredData = TTData.filter(point => {
        const pointDate = point.Timestamp.split(' ')[0]; // Extract date from timestamp
        return pointDate === selectedDate && point.runId === selectedRunId;
    });

    // Map the filtered data to the desired format
    const formattedData = filteredData.map(point => ({
        x: new Date(point.Timestamp),
        y: point.speed_mph,
        y2: point.distance,
    }));

    return formattedData;
}

// Function to find intersection times
function getIntersectionTimes(trajectoryData, intersectionData) {
    const intersectionTimes = [];

    intersectionData.forEach((intersection) => {
        for (let i = 1; i < trajectoryData.length; i++) {
            const prevPoint = trajectoryData[i - 1];
            const currentPoint = trajectoryData[i];
            //console.log(currentPoint);
            // Check if the trajectory crosses the intersection distance
            if (
                (prevPoint.y2 <= intersection.data[0].y && currentPoint.y2 >= intersection.data[0].y) ||
                (prevPoint.y2 >= intersection.data[0].y && currentPoint.y2 <= intersection.data[0].y)
            ) {
                // Interpolate the time of intersection
                const timeDiff =
                    new Date(currentPoint.x) - new Date(prevPoint.x);
                const distanceDiff =
                    currentPoint.y2 - prevPoint.y2;
                const ratio =
                    (intersection.data[0].y - prevPoint.y2) / distanceDiff;
                const intersectionTime = new Date(
                    new Date(prevPoint.x).getTime() + ratio * timeDiff
                );

                intersectionTimes.push({
                    //name: intersection.name,
                    time: intersectionTime,
                });

                break; // Found the intersection for this point
            }
        }
    });

    return intersectionTimes;
}




// SPEED OVER TIME CHART
function updateSpeedChart(){
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'
    const selectedRun = document.getElementById("run-select").value;

    // Get filtered data for the selected date and run
    const trajectoryData = getSpeedData(selectedDate, parseInt(selectedRun));

    // Get intersection times
    const intersectionTimes = getIntersectionTimes(
        trajectoryData,
        IntersectionLines
    );

    // Chart.js annotation plugin for vertical lines
    const annotations = intersectionTimes.map((intersection, index) => ({
        type: 'line',
        xMin: intersection.time.getTime(),
        xMax: intersection.time.getTime(),
        borderColor: 'red',
        borderWidth: 1,
        label: {
            content: CorridorData[index].name, 
            enabled: true,
            position: 'start',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            font: {
                size: 12,
                weight: 'bold',
            },
        },
        padding: 5,
    }));


    const Utils = {
        CHART_COLORS: {
          red: 'rgba(255, 99, 132, 1)',
          yellow: 'rgba(255, 206, 86, 1)',
          blue: 'rgba(54, 162, 235, 1)',
          dblue: 'rgb(38, 106, 151)',
        }
      };

    let width, height, gradient;
    function getGradient(ctx, chartArea) {
    const chartWidth = chartArea.right - chartArea.left;
    const chartHeight = chartArea.bottom - chartArea.top;
    if (!gradient || width !== chartWidth || height !== chartHeight) {
        // Create the gradient because this is either the first render
        // or the size of the chart has changed
        width = chartWidth;
        height = chartHeight;
        gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
        gradient.addColorStop(1, Utils.CHART_COLORS.dblue);
        gradient.addColorStop(0.5, Utils.CHART_COLORS.blue);
        gradient.addColorStop(0.25, Utils.CHART_COLORS.yellow);
        gradient.addColorStop(0, Utils.CHART_COLORS.red);
    }

    return gradient;
    }


    // Destroy the previous chart instance if it exists
    if (SpeedChart) {
        SpeedChart.destroy();
    }

    const data = [...trajectoryData];
    // Initialize the chart
    SpeedChart = new Chart(ctx_2, {
        type: 'line',
        data: {
            datasets: [{
                data: data.map(entry => ({
                    x: entry.x,
                    y: entry.y
                })),
                type: 'line',
                borderColor: function(context) {
                    const chart = context.chart;
                    const {ctx, chartArea} = chart;
            
                    if (!chartArea) {
                      // This case happens on initial chart load
                      return;
                    }
                    return getGradient(ctx, chartArea);
                  },
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false,
            }],
        },
        options: {
            responsive: true,
            plugins: {
                annotation: {
                    annotations: annotations,
                },
                legend: {
                    labels: {
                        filter: (legendItem) => {
                            // Exclude datasets with empty labels
                            return legendItem.text && legendItem.text.trim() !== '';
                        },
                        color:'#4BCCB7',
                        font: {size: 18},
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
                        mode: 'xy', // Allow zooming in both x and y axes
                    },
                },
            },
            
            scales: {
                x: {
                    type: 'time',
                    ticks: {
                        color: '#4BCCB7', 
                        font: {size: 14},
                    },
                    time: {
                        unit: 'second',
                        displayFormats: { second: 'HH:mm:ss' },
                    },
                    title: { display: true, text: 'Time (HH:mm:ss)', font: {size: 18}, color:'#4BCCB7' },
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'Speed (mph)', font: {size: 18}, color:'#4BCCB7' },
                    display: true,
                    ticks: {
                        color: '#4BCCB7', 
                        font: {size: 14},
                    },
                },
            },
        },
    });
}


// Initial chart rendering
updateSpeedChart();




function updateMultiTravelTimeChart() {
    const selectedRuns = Array.from(document.getElementById("run-select-multi").selectedOptions).map(option => option.value);

    if (selectedRuns.length === 0) {
        console.warn("No runs selected.");
        return;
    }

    // Filter the data for the selected runs
    const filteredRuns = TTData.filter(point => selectedRuns.includes(point.runId.toString()));

    if (filteredRuns.length === 0) {
        console.warn("No data for selected runs.");
        return;
    }

    // Normalize time
    const runsById = {}; // Store runs separately
    selectedRuns.forEach(runId => {
        const runData = filteredRuns.filter(point => point.runId.toString() === runId);
        if (runData.length > 0) {
            const startTime = new Date(runData[0].Timestamp).getTime(); // Start of this run
            runsById[runId] = runData.map(point => ({
                x: (new Date(point.Timestamp).getTime() - startTime) / 1000, // Normalize to seconds from start
                y: point.distance, // Keep distance unchanged
            }));
        }
    });

    // Generate datasets for Chart.js
    const datasets = Object.keys(runsById).map((runId, index) => ({
        label: `Run ${runId}`,
        data: runsById[runId],
        borderColor: getMultiColor(index), // Function to get distinct colors
        borderWidth: 2,
        pointRadius: 0, // Hide points for cleaner visualization
        fill: false,
    }));

    //TODO - Add Lines indicting where the intersection is
    IntersectionLines = createHorizontalLines(filteredRuns);

    // Update the chart
    if (travelTimeChart) {
        travelTimeChart.destroy(); // Destroy previous instance if it exists
    }
    if (TTChart) {
        TTChart.destroy(); // Destroy previous instance if it exists
    }
    travelTimeChart = new Chart(document.getElementById("timeSpaceChart").getContext("2d"), {
        type: "line",
        data: { datasets, ...IntersectionLines},
        options: {
            responsive: true,
            scales: {
                x: {
                    type: "linear",
                    position: "bottom",
                    title: { display: true, text: "Normalized Time (seconds)" },
                },
                y: {
                    title: { display: true, text: "Distance (ft)" },
                },
            },
        },
    });
}

// Utility function to get distinct colors
function getMultiColor(index) {
    const colors = ["red", "blue", "green", "orange", "purple", "brown", "cyan", "magenta"];
    return colors[index % colors.length];
}