// Add event listener for Export to Excel button
document.getElementById("export-to-excel").addEventListener("click", () => {
    //const selectedDates = flatpickr("#date-selector").selectedDates;
    const selectedDates = dateSelector.selectedDates;

    if (!selectedDates || selectedDates.length === 0) {
        alert("Please select at least one date to export.");
        return;
    }

    const selectedDateStrings = selectedDates.map(date => date.toISOString().split("T")[0]);

      // Determine if the median volume is being displayed
    const isMedianView = statisticalChart.data.datasets[0].label === "Median Volume";
    const isMeanView = statisticalChart.data.datasets[0].label === "Mean Volume";

    // Prepare data to export
    let exportData;
    let exportMedianData;

    if (isMedianView || isMeanView) {
    // Export median volume data
        exportMedianData = statisticalChart.data.labels.map((time, index) => ({
            time: time,
            median_volume: statisticalChart.data.datasets[0].data[index]
        }));
        exportData = tmcData.filter(entry =>
            selectedDateStrings.includes(new Date(entry.timestamp).toISOString().split("T")[0])
        );
    } else {
        // Filter the TMC data for the selected dates
        exportMedianData = [];
        exportData = tmcData.filter(entry =>
            selectedDateStrings.includes(new Date(entry.timestamp).toISOString().split("T")[0])
        );

        if (exportData.length === 0) {
            alert("No data available to export for the selected dates.");
            return;
        }
    }

    // Send the export data to the Flask server
    fetch("/export_filtered_data", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            filtered_data: exportData,
            median_data: exportMedianData
         })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error("Failed to export data.");
            }
            return response.blob();
        })
        .then(blob => {
            // Create a link element to download the file
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = isMedianView || isMeanView ? "median_volume.xlsx" : "filtered_data.xlsx";
            a.click();
            window.URL.revokeObjectURL(url);
        })
        .catch(error => {
            console.error(error);
            alert("An error occurred while exporting data.");
        });
});