// Initialize the statistical chart
const ctxStat = document.getElementById('statisticalChart').getContext('2d');


let statisticalChart = new Chart(ctxStat, {
    type: 'bar', // You can change this to 'line' if you prefer a line chart
    data: {
        labels: [], // Will be populated dynamically
        datasets: [] // Will be populated dynamically
    },
    options: {
        animation:{
            duration: 0 //diable animation
        },
        responsive: true,
        plugins: {
            filler: {
                propagate: true
            },
            tooltip: {
            mode: 'index', // Display data from all datasets for the hovered bar
            },
            title: {
                display: true,
                text: 'Median Volume'
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
                time: {
                    unit: 'hour', // Group by hour
                    tooltipFormat: 'HH:mm',
                    displayFormats: {
                        hour: 'HH:mm',
                        minute: 'HH:mm'
                    }
                },
                title: {
                    display: true,
                    text: 'Time'
                }
            },
            y: {
                title: {
                    display: true,
                    text: 'Traffic Volume'
                },
                beginAtZero: true
            }
        }
    }
});
