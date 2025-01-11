// Function to calculate the mean for each 15-minute interval
function calculateMean(data) {
    const groupedData = {};

    data.forEach(entry => {
        // Extract the time part of the timestamp without timezone shifts
        const time = new Date(entry.timestamp)
            .toTimeString() // Get "HH:MM:SS GMT+<offset>"
            .split(" ")[0] // Extract "HH:MM:SS"
            .substring(0, 5); // Get "HH:MM"

        // Initialize group if it doesn't exist
        if (!groupedData[time]) {
            groupedData[time] = [];
        }
        groupedData[time].push(entry.Total);
    });

    // Calculate the mean for each 15-minute interval
    const meanData = Object.keys(groupedData).map(time => {
        const totalValues = groupedData[time];
        const mean = totalValues.reduce((sum, val) => sum + val, 0) / totalValues.length;
        return { time, volume: mean };
    });

    // Sort the data by time (chronologically)
    meanData.sort((a, b) => a.time.localeCompare(b.time));

    return meanData;
}


// Function to calculate the median
function calculateMedian(values) {
    values.sort((a, b) => a - b);
    const mid = Math.floor(values.length / 2);
    return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

// Function to group data by 15-minute intervals and calculate median for each interval
function calculateMedianByInterval(filteredData) {
    // Create a map to group data by 15-minute intervals
    const intervalMap = {};

    filteredData.forEach(entry => {
        const timestamp = new Date(entry.timestamp);
        const intervalKey = `${timestamp.getHours()}:${Math.floor(timestamp.getMinutes() / 15) * 15}`;

        if (!intervalMap[intervalKey]) {
            intervalMap[intervalKey] = [];
        }
        intervalMap[intervalKey].push(entry.Total); // Use "Total" column for volume
    });

    // Calculate median for each interval
    const medianData = Object.entries(intervalMap).map(([interval, volumes]) => ({
        interval,
        medianVolume: calculateMedian(volumes)
    }));

    // Sort intervals in chronological order
    return medianData.sort((a, b) => {
        const [hourA, minA] = a.interval.split(":").map(Number);
        const [hourB, minB] = b.interval.split(":").map(Number);
        return hourA * 60 + minA - (hourB * 60 + minB);
    });
}

// Function to update the chart with median data
function updateChartWithMedian(filteredData) {
    const medianData = calculateMedianByInterval(filteredData).map(data => {
        // Split the interval into hours and minutes
        const [hour, minute] = data.interval.split(':');
        
        // Zero-pad hours and minutes to ensure consistent formatting
        const formattedHour = hour.padStart(2, '0');
        const formattedMinute = minute.padStart(2, '0');
        
        // Create a properly formatted time
        const time = `1970-01-01T${formattedHour}:${formattedMinute}:00`;
        
        return { time, volume: data.medianVolume };
    });

    //console.log(medianData);
    // Update the chart
    statisticalChart.data.labels = medianData.map(data => data.time);
    statisticalChart.data.datasets = [
        {
            label: `Median Volume`,
            data: medianData.map(data => data.volume),
            backgroundColor: 'rgba(75, 192, 192, 0.6)', // Distinct color
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
            yAxisID: 'y-traffic',
        }  
    ];
    statisticalChart.update();
}


// Function to update the chart with median data
function updateChartWithMean(filteredData) {
    const meanData = filteredData.map(data => {
        // Split the interval into hours and minutes
        const [hour, minute] = data.time.split(':');
        
        // Zero-pad hours and minutes to ensure consistent formatting
        const formattedHour = hour.padStart(2, '0');
        const formattedMinute = minute.padStart(2, '0');
        
        // Create a properly formatted time
        const time = `1970-01-01T${formattedHour}:${formattedMinute}:00`;
        
        return { time, volume: data.volume };
    });
    
    // Update the chart
    statisticalChart.data.labels = meanData.map(data => data.time);
    statisticalChart.data.datasets = [
        {
            label: `Mean Volume`,
            data: meanData.map(data => data.volume),
            backgroundColor: 'rgba(173, 75, 192, 0.6)', // Distinct color
            borderColor: 'rgba(173, 75, 192, 1)',
            borderWidth: 1,
            yAxisID: 'y-traffic',
        }
    ];
    statisticalChart.update();
}


// Button to calculate and display the median graph
document.getElementById("calculate-median").addEventListener("click", () => {
    const selectedDates = dateSelector.selectedDates;

    if (selectedDates.length === 0) {
        alert("Please select at least one date.");
        return;
    }

    // Convert dates to ISO format
    const selectedDateStrings = selectedDates.map(date => date.toISOString().split('T')[0]);

    // Filter data for the selected dates
    const filteredData = tmcData.filter(entry =>
        selectedDateStrings.includes(new Date(entry.timestamp).toISOString().split('T')[0])
    );

    if (filteredData.length === 0) {
        alert("No data available for the selected dates.");
        return;
    }

    // Update the chart with median data
    updateChartWithMedian(filteredData);
});

// Button click for Mean Calculation
document.getElementById("calculate-mean").addEventListener("click", () => {
    const selectedDates = dateSelector.selectedDates;

    if (!selectedDates || selectedDates.length === 0) {
        alert("Please select at least one date.");
        return;
    }

    const selectedDateStrings = selectedDates.map(date => date.toISOString().split("T")[0]);

    // Filter data for the selected dates
    const filteredData = tmcData.filter(entry =>
        selectedDateStrings.includes(new Date(entry.timestamp).toISOString().split("T")[0])
    );

    if (filteredData.length === 0) {
        alert("No data available for the selected dates.");
        return;
    }

    // Calculate the mean for each 15-minute interval
    const meanData = calculateMean(filteredData);

    // Update the chart with median data
    updateChartWithMean(meanData);
});
