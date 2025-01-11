// Fetch TMC Data (Replace this with an actual API call)
    const tmcData = [
        { timestamp: '2024-12-23T23:57:00', qty: 5, movement: 'NBT' },
        { timestamp: '2024-12-23T23:58:00', qty: 10, movement: 'SBR' },
        { timestamp: '2024-12-23T23:59:00', qty: 15, movement: 'NBL' },
        { timestamp: '2024-12-24T00:00:00', qty: 20, movement: 'EBT' }
    ];

    // Group Data by Timestamp and Aggregate Total Volumes
    const groupedData = {};
    tmcData.forEach(item => {
        const time = new Date(item.timestamp).toLocaleTimeString();
        if (!groupedData[time]) groupedData[time] = { volume: 0, movements: [] };
        groupedData[time].volume += item.qty;
        groupedData[time].movements.push(item);
    });

    // Data for Volume Bar Chart
    const barChartLabels = Object.keys(groupedData);
    const barChartData = Object.values(groupedData).map(group => group.volume);

    // Create Volume Bar Chart
    const ctxBar = document.getElementById('volumeBarChart').getContext('2d');
    new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: barChartLabels,
            datasets: [{
                label: 'Vehicle Volume',
                data: barChartData,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            title: {
                display: true,
                text: 'Vehicle Volume Over Time'
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Volume'
                    },
                    beginAtZero: true
                }
            }
        }
    });

    // Create Turning Movement Diagram
    const turnMovementDiagram = document.getElementById('turn-movement-diagram');
    tmcData.forEach(item => {
        const movementLabel = document.createElement('div');
        movementLabel.textContent = `${item.movement}: ${item.qty}`;
        movementLabel.style.position = 'absolute';

        // Position the label based on movement
        switch (item.movement) {
            case 'NBT': movementLabel.style.top = '10%'; movementLabel.style.left = '45%'; break;
            case 'NBL': movementLabel.style.top = '20%'; movementLabel.style.left = '30%'; break;
            case 'NBR': movementLabel.style.top = '20%'; movementLabel.style.left = '60%'; break;
            case 'SBT': movementLabel.style.top = '80%'; movementLabel.style.left = '45%'; break;
            case 'SBR': movementLabel.style.top = '70%'; movementLabel.style.left = '60%'; break;
            case 'SBL': movementLabel.style.top = '70%'; movementLabel.style.left = '30%'; break;
            case 'EBT': movementLabel.style.top = '50%'; movementLabel.style.left = '70%'; break;
            case 'EBL': movementLabel.style.top = '40%'; movementLabel.style.left = '60%'; break;
            case 'EBR': movementLabel.style.top = '60%'; movementLabel.style.left = '60%'; break;
            case 'WBT': movementLabel.style.top = '50%'; movementLabel.style.left = '20%'; break;
            case 'WBL': movementLabel.style.top = '40%'; movementLabel.style.left = '30%'; break;
            case 'WBR': movementLabel.style.top = '60%'; movementLabel.style.left = '30%'; break;
        }

        movementLabel.style.fontSize = '14px';
        movementLabel.style.color = '#333';
        turnMovementDiagram.appendChild(movementLabel);
    });