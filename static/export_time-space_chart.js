// Function to export the chart as an image
function exportChartImage(chart, fileName = "Time-Space Diagram.png") {
    const link = document.createElement("a");
    link.href = chart.toBase64Image(); // Generate a Base64 image URL
    link.download = fileName; // File name for the downloaded image
    link.click();
}

// Function to export the chart as an image
function exportChartDataImage(chart, fileName = "Time-Space Diagram.png") {
    const link = document.createElement("a");
    link.href = chart.toBase64Image(); // Generate a Base64 image URL
    link.download = fileName; // File name for the downloaded image
    link.click();
}

// Function to export data as CSV
function exportChartData(data, fileName = "SplitChartData.csv") {
    const csvRows = [];
    const headers = Object.keys(data[0]); // Get the keys as headers
    csvRows.push(headers.join(",")); // Add headers to the CSV

    data.forEach((row) => {
        const values = headers.map((header) => JSON.stringify(row[header] || "")); // Handle null/undefined
        csvRows.push(values.join(","));
    });

    const csvContent = csvRows.join("\n"); // Combine rows with newline
    const blob = new Blob([csvContent], { type: "text/csv" }); // Create a Blob
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); // Create a URL for the Blob
    link.download = fileName; // File name for the downloaded CSV
    link.click();
}

// Attach event listeners to buttons
document.getElementById("export-chart-btn").addEventListener("click", () => {
    exportChartImage(TTChart);
});

document.getElementById("export-Speedchart-btn").addEventListener("click", () => {
    exportChartImage(SpeedChart);
});

/*
document.getElementById("export-data-btn").addEventListener("click", () => {
    exportChartData(TTData); // Replace SplitData with your filtered data if needed
});
*/
