// Initialize chart
const ctxBar = document.getElementById('volumeBarChart').getContext('2d');
// Extract anomaly timestamps
const anomalyTimestamps = new Set(anomalies.map(anomaly => anomaly.timestamp));
let volumeBarChart = new Chart(ctxBar, {
    type: 'bar',
    data: {
            labels: tmcData.map(entry => entry.timestamp),
            datasets: [{
                    label: 'Lights',
                    data: lightData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'SingleUnitTruck',
                    data: singleUnitTruckData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(128, 128, 128, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(128, 128, 128, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'ArticulatedTruck',
                    data: articulatedTruckData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(75, 192, 192, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'Bus',
                    data: busData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(255, 153, 51, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(255, 153, 51, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'Bicycle',
                    data: bicycleData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(179, 102, 255, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(179, 102, 255, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'Other',
                    data: otherData,
                    backgroundColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(230, 0, 38, 0.6)'
                    ),
                    borderColor: tmcData.map(entry =>
                        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(230, 0, 38, 1)'
                    ),
                    borderWidth: 1,
                    yAxisID: 'y-traffic',
                    stack: 'traffic'
                },
                {
                    label: 'Temperature (°F)',
                    //data: temperatureData,
                    data: weatherData.map(entry => ({
                        x: entry.time, // ISO timestamp
                        y: entry.temperature_f // Temperature in Fahrenheit
                    })),
                    type: 'line',
                    borderColor: 'rgba(255, 99, 132, 0.6)',
                    borderWidth: 2,
                    pointRadius: 0, //No Markers
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-weather',
                    hidden: true // Hides the temperature data initially
                },
                {
                    label: 'Rain',
                    //data: rainData,
                    data: weatherData.map(entry => ({
                        x: entry.time, // ISO timestamp
                        y: entry.prcp // Rain
                    })),
                    type: 'line',
                    borderColor: 'rgba(99, 211, 255, 1)',
                    borderWidth: 2,
                    pointRadius: 0, //No Markers
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-rain',
                    hidden: true // Hides the temperature data initially
                },
                {
                    label: 'Snow',
                    //data: snowData,
                    data: weatherData.map(entry => ({
                        x: entry.time, // ISO timestamp
                        y: entry.snow // Snow
                    })),
                    type: 'line',
                    borderColor: 'rgba(255, 99, 247, 1)',
                    borderWidth: 2,
                    pointRadius: 0, //No Markers
                    tension: 0.4,
                    fill: false,
                    yAxisID: 'y-rain',
                    hidden: true // Hides the temperature data initially
                },
            ]
        },
     options: {
        animation:{
            duration: 0 //diable animation
        },
        responsive: true,
        plugins: {
            decimation:{
                enabled: true,
                algorithm: 'min-max',
                samples: 500
            },
            filler: {
                propagate: true
            },
            tooltip: {
                mode: 'index', // Display data from all datasets for the hovered bar
                //mode: 'nearest',
                intersect: false, // Ensure the tooltip shows when hovering over the bar area
                callbacks: {
                    label: function(tooltipItem) {
                        //const datasetLabel = tooltipItem.dataset.label || '';
                        //const value = tooltipItem.raw || 0;
                        //return `${datasetLabel}: ${value}`;
                        const dataset = tooltipItem.chart.data.datasets[tooltipItem.datasetIndex];
                        const dataPoint = dataset.data[tooltipItem.dataIndex];

                        // Extract value
                        const value = typeof dataPoint === 'object' ? dataPoint.y : dataPoint; //if object get the y point

                        // Format temperature separately
                        if (dataset.label.includes('Temperature')) {
                            return `${dataset.label}: ${value.toFixed(1)} °F`;
                        }
                        else if (dataset.label.includes('Rain')) {
                            return `${dataset.label}: ${value.toFixed(2)} mm`;
                        }
                        else if (dataset.label.includes('Snow')) {
                            return `${dataset.label}: ${value.toFixed(3)} mm`;
                        }
                        // Default formatting for other datasets
                        return `${dataset.label}: ${value}`;
                        }
                    }
                },
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
                type: 'time',
                time:{
                    tooltipFormat: 'yyyy-MM-dd HH:mm',
                    displayFormats:{
                        minute: 'HH:mm',
                        hour: 'yyyy-MM-dd HH:mm',
                        day: 'yyyy-MM-dd',
                    },
                },
                stacked: true,
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                id: 'y-traffic',
                stacked: true,
                title: {
                    display: true,
                    text: 'Traffic Volume'
                },
                beginAtZero: true
            },
            'y-weather':{
                position: 'right',
                stacked: false,
                title:{
                    display: true,
                    text: 'Temperature (F)'
                },
                grid:{
                    drawOnChartArea: false
                }
            },
            'y-rain':{
                position: 'right',
                stacked: false,
                title:{
                    display: true,
                    text: 'Precipitation (mm?)'
                }
            }
        },

        /*
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


        */
        }
});






let isDragging = false;
let startX, startY, endX, endY;

// Canvas events
const canvas = volumeBarChart.canvas;
const overlayCanvas = document.getElementById('overlayCanvas');

overlayCanvas.width = canvas.width;
overlayCanvas.height = canvas.height;

const overlayCtx = overlayCanvas.getContext('2d');

overlayCanvas.addEventListener('mousedown', (event) => {
    // Bring Overlay to top
    overlayCanvas.style.zIndex = 2;
    canvas.style.zIndex = 1; 

    const rect = overlayCanvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
    isDragging = true;
    // Disable tooltips
    volumeBarChart.options.plugins.tooltip.enabled = false;

    volumeBarChart.update();
});

canvas.addEventListener('mousedown', (event) => {
    // Bring Overlay to top
    overlayCanvas.style.zIndex = 2;
    canvas.style.zIndex = 1; 

    const rect = overlayCanvas.getBoundingClientRect();
    startX = event.clientX - rect.left;
    startY = event.clientY - rect.top;
    isDragging = true;
    // Disable tooltips
    volumeBarChart.options.plugins.tooltip.enabled = false;
    
    volumeBarChart.update();
});

/*
canvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    // Get mouse position relative to the canvas
    const rect = canvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;

    // Clear any previous selection box
    const ctx = volumeBarChart.ctx;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw the chart
    volumeBarChart.draw();

    // Draw the selection box
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 255, 0.2)';
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 1;
    ctx.fillRect(startX, startY, endX - startX, endY - startY);
    ctx.strokeRect(startX, startY, endX - startX, endY - startY);
    ctx.restore();
});
*/
    

// Use overlayCanvas for the selection box
overlayCanvas.addEventListener('mousemove', (event) => {
    if (!isDragging) return;

    const rect = overlayCanvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;

    // Clear previous rectangle
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    volumeBarChart.draw();

    // Draw new rectangle
    overlayCtx.save();
    overlayCtx.fillStyle = 'rgba(0, 0, 255, 0.2)';
    overlayCtx.strokeStyle = 'blue';
    overlayCtx.lineWidth = 2;
    overlayCtx.fillRect(startX, startY, endX - startX, endY - startY);
    overlayCtx.strokeRect(startX, startY, endX - startX, endY - startY);
    overlayCtx.restore();
});



overlayCanvas.addEventListener('mouseup', (event) => {
    if (!isDragging) return;
    isDragging = false;

    const rect = overlayCanvas.getBoundingClientRect();
    endX = event.clientX - rect.left;
    endY = event.clientY - rect.top;

    // Clear previous rectangle
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    // Re-enable tooltips
    volumeBarChart.options.plugins.tooltip.enabled = true;
    volumeBarChart.update();
    // Bring Chart to top
    overlayCanvas.style.zIndex = 1;
    canvas.style.zIndex = 2; 

    // Normalize drag box coordinates
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    // Manually find elements within the drag box
    const elements = [];
    volumeBarChart.data.datasets[0].data.forEach((_, index) => {
        const meta = volumeBarChart.getDatasetMeta(0);
        const bar = meta.data[index];

        // Check if bar is within the drag area
        if (
            bar.x >= minX && bar.x <= maxX && // Check horizontal overlap
            bar.y >= minY && bar.y <= maxY    // Check vertical overlap
        ) {
            elements.push({
                label: volumeBarChart.data.labels[index],
                value: volumeBarChart.data.datasets[0].data[index]
            });
        }
    });

    // Append newly selected timestamps
    elements.forEach((el) => {
        if (!selectedTimestamps.includes(el.label)) {
            selectedTimestamps.push(el.label); // Avoid duplicates
        }
    });

    /*
    // Optionally, highlight selected bars
    volumeBarChart.data.datasets[0].backgroundColor = volumeBarChart.data.datasets[0].data.map((value, index) => {
        return elements.some(el => el.label === volumeBarChart.data.labels[index]) ? 'rgba(72, 235, 31, 0.6)' : 'rgba(54, 162, 235, 0.6)';
    });
    */
    // Highlight all selected bars
    volumeBarChart.data.datasets[0].backgroundColor = volumeBarChart.data.datasets[0].data.map((value, index) => {
        return selectedTimestamps.includes(volumeBarChart.data.labels[index])
            ? 'rgba(72, 235, 31, 0.6)' // Highlight color
            : 'rgba(54, 162, 235, 0.6)'; // Default color
    });


    volumeBarChart.update();
});
