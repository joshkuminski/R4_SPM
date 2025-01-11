const ctx = document.getElementById("splitChart").getContext("2d");

let splitChart = null;

// Map termination types to colors
const terminationColors = {
    F: "rgba(255, 99, 132, 1)", // Red
    G: "rgba(54, 162, 235, 1)", // Blue
    M: "rgba(75, 192, 192, 1)", // Green
    None: "rgba(153, 102, 255, 1)", // Purple
    Skip: "rgb(0, 0, 0)", // Black
};


// Function to filter data for the selected phase
function getPhaseData(phase) {
    //return SplitData.filter(entry => entry[`SP${phase}_split`] !== null).map(entry => ({
    //    x: entry.Timestamp, // Convert timestamp to ISO format
    //    y: parseFloat(entry[`SP${phase}_split`]), // Phase duration in seconds
    //    termination: entry[`SP${phase}_term`] || "None", // Termination type
    //}));
    return SplitData.filter(entry => entry[`SP${phase}_split`] !== null).map(entry => {
        const duration = parseFloat(entry[`SP${phase}_split`]); // Phase duration
        const termination = entry[`SP${phase}_term`] || "None"; // Termination type

        // Determine classification
        const classification = duration === 0 && termination === "None" ? "Skip" : termination;

        return {
            x: entry.Timestamp, // Convert timestamp to ISO format
            y: duration, // Phase duration in seconds
            termination: classification, // Classification including 'Skip'
        };
    });
}






// Function to create interval lines for the selected phase
function createIntervalLines(phase, date, controllerData) {
    const intervals = [];
    let startTimes = [];
    // TODO - Make the start time and end ime from the action table
    if (typeof hours !== "undefined" && Array.isArray(hours) && hours.length > 0) {
        // Ensure min is defined and has the same length as hours
        if (typeof min === "undefined" || min.length !== hours.length) {
            console.error("Mismatch between hours and min arrays.");
        } else {
            startTimes = hours.map((hour, index) => {
                const minute = min[index].padStart(2, "0"); // Ensure minutes are two digits
                return hour.padStart(2, "0") + ":" + minute + ":00"; // Combine hour and minute
            });
        }
    } else {
        // Fallback values if `hours` or `min` is not defined
        const startTime = ['00:00:00', '06:00:00'];
        const endTime = ['06:00:00', '24:00:00'];
    }
    
    // Loop through the start and end time arrays
    for (let i = 0; i < startTimes.length; i++) {
        // Set the end time for the last interval to "24:00:00"
        const endTime = i === startTimes.length - 1
            ? "24:00:00"
            : startTimes[i + 1];

        // Create a new interval object with start and end times
        intervals.push({
            start: new Date(`${date}T${startTimes[i]}`),
            end: new Date(`${date}T${endTime}`)
        })
    }

    const datasets = [];

    intervals.forEach((interval, index) => {
        const phaseKey = `SP${phase}`; // Key for the phase in controllerData
        const value = parseFloat(controllerData[index][phaseKey]); // Get the value for the phase

        if (!isNaN(value)) {
            datasets.push({
                //label: `Program Split ${index + 1}`,
                label: '',
                data: [
                    { x: interval.start, y: value },
                    { x: interval.end, y: value }
                ],
                borderColor: 'rgba(133, 29, 38, 0.6)', // Line color
                borderWidth: 2,
                pointRadius: 0, // No data points
                fill: false, // No fill under the line
                type: 'line', // Line type dataset
            });
        }
    });

    return datasets;
}


// Function to update the chart
function updateSplitChart() {
    const selectedPhase = document.getElementById("phase-select").value;
    const selectedDate = document.getElementById('start-date').value; // Format: 'YYYY-MM-DD'

    // Get filtered data for the selected phase
    const phaseData = getPhaseData(selectedPhase);
    // Create datasets for intervals
    const intervalDatasets = createIntervalLines(selectedPhase, selectedDate, controller_data);

    //console.log(phaseData);
    startTime = '00:00:00';
    endTime = '23:59:59';

    const startDateTime = new Date(`${selectedDate}T${startTime}`);
    const endDateTime = new Date(`${selectedDate}T${endTime}`);

   // Filter the data for the selected date
    const filteredData = phaseData.filter(entry => {
        const entryDate = new Date(entry.x); 
        return entryDate >= startDateTime && entryDate <= endDateTime;
    });


    
    // Custom legend plugin
    const customLegendPlugin = {
        id: 'customLegend',
        beforeDraw: (chart) => {
            const { ctx, chartArea } = chart;
            const legendItems = Object.entries(terminationColors);
            const descriptions =[
                "Force Off",
                "Gap Out",
                "Max Out",
                "No Termination",
                "Skip"
            ];

            // Calculate termination counts dynamically from the chart data
            const data = chart.data.datasets[0].data; // Assuming the first dataset contains the filtered data
            const terminationCounts = { F: 0, G: 0, M: 0, None: 0, Skip: 0 };
            data.forEach(point => {
                const termination = filteredData.find(d => d.x === point.x).termination;
                if (terminationCounts[termination] !== undefined) {
                    terminationCounts[termination]++;
                }
            });


            const fontSize = 12;
            const padding = 10;
            const itemHeight = fontSize + 5;

            // Set font properties
            ctx.font = `${fontSize}px Arial`;
            ctx.textAlign = 'left';

            // Calculate starting point
            let startX = chartArea.left + padding;
            let startY = chartArea.top ;

            // Draw each legend item
            legendItems.forEach(([key, color], index) => {
                const count = terminationCounts[key] || 0; // Get the count for the termination type

                // Draw color box
                ctx.fillStyle = color;
                ctx.fillRect(startX, startY + index * itemHeight, fontSize, fontSize);

                // Draw text with description and count
                ctx.fillStyle = 'black';
                ctx.fillText(
                    `${key}: ${descriptions[index]} (${count})`,
                    startX + fontSize + 5,
                    startY + index * itemHeight + fontSize - 2
                );
            });
        }
    };


    const customBackgroundPlugin = {
        id: 'backgroundPlugin',
        beforeDraw: (splitChart) => {
            const { ctx, chartArea, scales } = splitChart;
            const xScale = scales.x;
            let startTimes = [];
            // Example color mapping for patterns
            const patternColors = {
                "Free": "rgba(128, 128, 128, 0.14)", // Grey
                "1": "rgba(42, 100, 139, 0.14)",    // Blue
                "2": "rgba(81, 184, 149, 0.14)",    // Green
                "3": "rgba(163, 72, 72, 0.14)",     // Red
                "4": "rgba(163, 157, 72, 0.14)"    // Yellow
            };

            // Default color for undefined patterns
            const defaultColor = "rgba(200, 200, 200, 0.14)";
            // Initialize an empty intervals array
            const intervals = [];

            // TODO - Make the start time and end ime from the action table
            if (typeof hours !== "undefined" && Array.isArray(hours) && hours.length > 0) {
                // Ensure min is defined and has the same length as hours
                if (typeof min === "undefined" || min.length !== hours.length) {
                    console.error("Mismatch between hours and min arrays.");
                } else {
                    startTimes = hours.map((hour, index) => {
                        const minute = min[index].padStart(2, "0"); // Ensure minutes are two digits
                        return hour.padStart(2, "0") + ":" + minute + ":00"; // Combine hour and minute
                    });
                }
            } else {
                // Fallback values if `hours` or `min` is not defined
                const startTime = ['00:00:00', '06:00:00'];
                const endTime = ['06:00:00', '24:00:00'];
                console.log("Fallback start and end times:", startTime, endTime);
            }
            
            
           
            // Loop through the start and end time arrays
            for (let i = 0; i < startTimes.length; i++) {
                const Pattern = pattern[i] || "Default"; // Get the pattern for this interval
                const color = patternColors[Pattern] || defaultColor; // Get the corresponding color

                // Set the end time for the last interval to "24:00:00"
                const endTime = i === startTimes.length - 1
                    ? "24:00:00"
                    : startTimes[i + 1];

                // Create a new interval object with start and end times
                intervals.push({
                    start: new Date(`${selectedDate}T${startTimes[i]}`),
                    end: new Date(`${selectedDate}T${endTime}`),
                    color: color,
                });
            }

            // Draw background colors for each interval
            intervals.forEach(({ start, end, color }) => {
                const startX = xScale.getPixelForValue(new Date(start));
                const endX = xScale.getPixelForValue(new Date(end));

                ctx.save();
                ctx.fillStyle = color;
                ctx.fillRect(startX, chartArea.top, endX - startX, chartArea.bottom - chartArea.top);
                ctx.restore();
            });
        
            // Filter the data for each pattern
            function groupSplitDataByIntervals(splitData, intervals) {
                const groupedData = intervals.map((interval, index) => {
                    // Filter the split data based on the interval's start and end times
                    const filteredData = splitData.filter((entry) => {
                        const entryTime = new Date(entry.x);
                        return entryTime >= interval.start && entryTime < interval.end;
                    });
                    
                    // Fetch the pattern for the current interval from controller_data
                    const pattern = controller_data[index]?.Pattern || "Unknown";

                    // Return the group with associated pattern and data
                    return {
                        pattern: pattern, // Assume intervals have a `pattern` property
                        data: filteredData,
                    };
                });
            
                return groupedData;
            }
            
            // Example usage
            const groupedData = groupSplitDataByIntervals(phaseData, intervals);

            function calculateTerminationAverages(groupedData) {
                return groupedData.map((group) => {
                    // Initialize counters for each termination type
                    const terminationCounts = { F: 0, G: 0, Skip: 0 };
                    let totalEntries = group.data.length;
            
                    // Count occurrences of each termination type in the group
                    group.data.forEach((entry) => {
                        const termination = entry.termination; // Assuming `termination` is already classified
                        if (terminationCounts.hasOwnProperty(termination)) {
                            terminationCounts[termination]++;
                        }
                        
                    });
    
                     // Calculate the average split time
                    const avgSplitTime =
                        group.data.length > 0
                            ? group.data.reduce((sum, entry) => sum + entry.y, 0) / group.data.length
                            : 0; // Avoid division by zero
            

                    // Calculate averages
                    const averages = {
                        pattern: group.pattern, // Pattern name
                        Split_Time: avgSplitTime. toFixed(2),
                        F: (terminationCounts.F / totalEntries) * 100 || 0, // Average percentage
                        G: (terminationCounts.G / totalEntries) * 100 || 0,
                        Skip: (terminationCounts.Skip / totalEntries) * 100 || 0,
                    };
            
                    return averages;
                });
            }
            
            const terminationAverages = calculateTerminationAverages(groupedData);

            intervals.forEach(({ start, end}, index) => {
                //const label_Pattern = controller_data[index]?.Pattern || "Unknown"; // Get the pattern for this interval
                const startX = xScale.getPixelForValue(new Date(start));
                const endX = xScale.getPixelForValue(new Date(end));
                const centerX = (startX + endX) / 2; // Center of the interval
                let labelY = chartArea.top + 20; // Adjust the Y position for the label

                const TerminationLegend = [
                    `Pattern: ${terminationAverages[index]?.pattern || "Unknown"}`,
                    `Avg. Split: ${(Number(terminationAverages[index]?.Split_Time) || 0).toFixed(2)} seconds`,
                    `Force Offs (F): ${(Number(terminationAverages[index]?.F) || 0).toFixed(2)}%`,
                    `Gap Outs (G): ${(Number(terminationAverages[index]?.G) || 0).toFixed(2)}%`,
                    `Skips: ${(Number(terminationAverages[index]?.Skip) || 0).toFixed(2)}%`,
                ];


                ctx.save();
                //ctx.fillStyle = 'black';
                ctx.fillStyle = '#1A237E'; // Navy blue text color
                //ctx.font = '12px Arial';
                ctx.font = '14px Roboto';
                ctx.textAlign = 'left';
                // Draw each line of the legend
                TerminationLegend.forEach((line) => {
                    ctx.fillText(line, startX + 20, labelY); // Draw the line
                    labelY += 15; // Move to the next line (adjust spacing as needed)
                });
                //ctx.fillText(TerminationLegend, centerX, labelY); // Draw the label
                ctx.restore();
            });

        },
    };
    


    // Create a dataset with points color-coded by termination
    const dataset = filteredData.map(data => ({
        x: data.x,
        y: data.y,
        backgroundColor: terminationColors[data.termination] || "rgba(200, 200, 200, 1)",
    }));

    // Destroy the previous chart instance if it exists
    if (splitChart) {
        splitChart.destroy();
    }

    // Initialize the chart
    splitChart = new Chart(ctx, {
        type: "scatter",
        data: {
            datasets: [
                {
                    label: `Phase ${selectedPhase} Duration`,
                    data: dataset.map(d => ({ x: d.x, y: d.y })),
                    backgroundColor: dataset.map(d => d.backgroundColor),
                    pointRadius: 5,
                },
                ...intervalDatasets,

            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        filter: (legendItem) => {
                            // Exclude datasets with empty labels
                            return legendItem.text && legendItem.text.trim() !== '';
                        },
                    },
                },
                mode: 'index', 
                tooltip: {
                    callbacks: {
                        //label: function (context) {
                        //    const dataPoint = filteredData[context.dataIndex];
                        //    return `Duration: ${context.raw.y}s, Termination: ${dataPoint.termination}`;
                        //},
                        label: function (context) {
                            const dataPoint = context.raw; // Access the raw data point
                            const timestamp = dataPoint.x; // Timestamp
                            const duration = dataPoint.y; // Phase duration
                            const termination = filteredData[context.dataIndex].termination;
                
                            // Format the tooltip text
                            return `Timestamp: ${new Date(timestamp).toLocaleString()}\nDuration: ${duration}s\nTermination: ${termination}`;
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
                            enabled: true, // Enable zooming by dragging a rectangle
                        },
                        mode: 'x', // Allow zooming in both x and y axes
                    },
                },
            },
            scales: {
                x: {
                    type: "time",
                    time: {
                        unit: "hour",
                        tooltipFormat: "yyyy-MM-dd HH:mm:ss",
                    },
                    title: {
                        display: true,
                        text: "Time",
                    },
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Phase Duration (s)",
                    },
                },
            },
        },
        plugins: [customLegendPlugin, customBackgroundPlugin],
    });
}

// Move this to SplitReport.html
// Add event listener for phase selector
document.getElementById("phase-select").addEventListener("change", updateSplitChart);

// Initial chart rendering
updateSplitChart();