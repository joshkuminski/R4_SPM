function updateChart() {
    const startDate = startDateInput.value;
    const startTime = startTimeDropdown.value;
    const endDate = endDateInput.value;
    const endTime = endTimeDropdown.value;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    const startDateM = new Date(startDate);
    const endDateM = new Date(endDate);
    const daysDifference = Math.ceil((endDateM - startDateM) / (1000 * 60 * 60 * 24));
    console.log(daysDifference);
    let aggregatedData = [];

    // Filter data
    const filteredData = tmcData.filter(entry => {
        const entryDateTime = new Date(entry.timestamp);
        return entryDateTime >= startDateTime && entryDateTime <= endDateTime;
    });
    const filteredWeatherData = weatherData.filter(entry => {
        const entryDateTime = new Date(entry.time);
        return entryDateTime >= startDateTime && entryDateTime <= endDateTime;
    });

    

    // Determine data granularity based on the date range
    if (daysDifference > 30) {
        // Aggregate TMC data to daily totals
        const dailyData = {};
        filteredData.forEach(entry => {
            const date = new Date(entry.timestamp).toISOString().split("T")[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    Light_Total: 0,
                    Single_Unit_Total: 0,
                    Articulated_Total: 0,
                    Bus_Total: 0,
                    Bicycle_Total: 0,
                    Other: 0
                };
            }
            dailyData[date].Light_Total += entry.Light_Total;
            dailyData[date].Single_Unit_Total += entry.Single_Unit_Total;
            dailyData[date].Articulated_Total += entry.Articulated_Total;
            dailyData[date].Bus_Total += entry.Bus_Total;
            dailyData[date].Bicycle_Total += entry.Bicycle_Total;
            dailyData[date].Other += entry.Other;
        });

        aggregatedData = Object.keys(dailyData).map(date => ({
            timestamp: date,
            ...dailyData[date]
        }));

        // Update chart labels and datasets for daily data
        volumeBarChart.data.labels = aggregatedData.map(data => data.timestamp);
        volumeBarChart.data.datasets[0].data = aggregatedData.map(data => data.Light_Total);
        volumeBarChart.data.datasets[1].data = aggregatedData.map(data => data.Single_Unit_Total);
        volumeBarChart.data.datasets[2].data = aggregatedData.map(data => data.Articulated_Total);
        volumeBarChart.data.datasets[3].data = aggregatedData.map(data => data.Bus_Total);
        volumeBarChart.data.datasets[4].data = aggregatedData.map(data => data.Bicycle_Total);
        volumeBarChart.data.datasets[5].data = aggregatedData.map(data => data.Other);
    }else {
        // Use 15-minute granularity for a week or less
        volumeBarChart.data.labels = filteredData.map(entry => entry.timestamp);
        volumeBarChart.data.datasets[0].data = filteredData.map(entry => entry.Light_Total);
        volumeBarChart.data.datasets[1].data = filteredData.map(entry => entry.Single_Unit_Total);
        volumeBarChart.data.datasets[2].data = filteredData.map(entry => entry.Articulated_Total);
        volumeBarChart.data.datasets[3].data = filteredData.map(entry => entry.Bus_Total);
        volumeBarChart.data.datasets[4].data = filteredData.map(entry => entry.Bicycle_Total);
        volumeBarChart.data.datasets[5].data = filteredData.map(entry => entry.Other);
    }

    // Update weather datasets
    volumeBarChart.data.datasets[6].data = filteredWeatherData.map(entry => ({
        x: entry.time, // ISO timestamp
        y: entry.temperature_f // Temperature in Fahrenheit
    }));
    volumeBarChart.data.datasets[7].data = filteredWeatherData.map(entry => ({
        x: entry.time, // ISO timestamp
        y: entry.prcp // Rain data
    }));
    volumeBarChart.data.datasets[8].data = filteredWeatherData.map(entry => ({
        x: entry.time, // ISO timestamp
        y: entry.snow // Snow data
    }));

    /*
    // Update chart
    volumeBarChart.data.labels = filteredData.map(entry => entry.timestamp);
    volumeBarChart.data.datasets[0].data = filteredData.map(entry => entry.Light_Total);
    volumeBarChart.data.datasets[0].backgroundColor = filteredBackgroundColors;
    volumeBarChart.data.datasets[0].borderColor = filteredBorderColors;

    volumeBarChart.data.datasets[1].data = filteredData.map(entry => entry.Single_Unit_Total);
    volumeBarChart.data.datasets[1].backgroundColor = 'rgba(128, 128, 128, 0.6)';

    volumeBarChart.data.datasets[2].data = filteredData.map(entry => entry.Articulated_Total);
    volumeBarChart.data.datasets[2].backgroundColor = 'rgba(75, 192, 192, 0.6)';

    volumeBarChart.data.datasets[3].data = filteredData.map(entry => entry.Bus_Total);
    volumeBarChart.data.datasets[3].backgroundColor = 'rgba(255, 153, 51, 0.6)';

    volumeBarChart.data.datasets[4].data = filteredData.map(entry => entry.Bicycle_Total);
    volumeBarChart.data.datasets[4].backgroundColor = 'rgba(179, 102, 255, 0.6)';

    volumeBarChart.data.datasets[5].data = filteredData.map(entry => entry.Other);
    volumeBarChart.data.datasets[5].backgroundColor = 'rgba(230, 0, 38, 0.6)';

    //Temperature
    volumeBarChart.data.datasets[6].data = filteredWeatherData.map(entry => ({
                    x: entry.time, // ISO timestamp
                    y: entry.temperature_f // Temperature in Fahrenheit
                }));
    volumeBarChart.data.datasets[6].borderColor = 'rgba(255, 99, 132, 0.6)';

    //Rain
    volumeBarChart.data.datasets[7].data = filteredWeatherData.map(entry => ({
                    x: entry.time, // ISO timestamp
                    y: entry.prcp // Temperature in Fahrenheit
                }));
    volumeBarChart.data.datasets[7].borderColor = 'rgba(99, 211, 255, 1)';

    //Snow
    volumeBarChart.data.datasets[8].data = filteredWeatherData.map(entry => ({
                    x: entry.time, // ISO timestamp
                    y: entry.snow // Temperature in Fahrenheit
                }));
    volumeBarChart.data.datasets[8].borderColor = 'rgba(255, 99, 247, 1)';

    */


    // Re-apply anomaly highlighting
    const filteredBackgroundColors = filteredData.map(entry =>
        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6>'
    );
    const filteredBorderColors = filteredData.map(entry =>
        anomalyTimestamps.has(entry.timestamp) ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
    );

    //NEW
    volumeBarChart.data.datasets[0].backgroundColor = filteredBackgroundColors;
    volumeBarChart.data.datasets[0].borderColor = filteredBorderColors;


    volumeBarChart.update();
}