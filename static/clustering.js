//Clustering
const dailyVolumes = clusters.map(entry => ({
    date: new Date(entry.date),
    dailyVolume: entry.daily_volume,
    cluster: {}
}));

for (let n = 2; n <= 7; n++) {
    dailyVolumes.forEach((entry, idx) => {
        entry.cluster[n] = clusters[idx][`cluster_${n}`];
    });
}

let clusterHighlightEnabled = false;

const numClustersDropdown = document.getElementById('num-clusters');
const toggleClusterButton = document.getElementById('toggle-cluster-highlights');

toggleClusterButton.addEventListener('click', () => {
    clusterHighlightEnabled = !clusterHighlightEnabled;
    console.log(clusterHighlightEnabled)

    if (clusterHighlightEnabled) {
        const nClusters = parseInt(numClustersDropdown.value);

        // Highlight clusters - Background
        volumeBarChart.data.datasets[0].backgroundColor = tmcData.map(entry => {
            const clusterEntry = dailyVolumes.find(
                cluster => cluster.date.toISOString().split('T')[0] === new Date(entry.timestamp).toISOString().split('T')[0]
            );
            if (clusterEntry) {
                const clusterId = clusterEntry.cluster[nClusters];
                return clusterId === 0 ? 'rgba(255, 99, 132, 0.6)' :
                       clusterId === 1 ? 'rgba(54, 162, 235, 0.6)' :
                       clusterId === 2 ? 'rgba(75, 192, 192, 0.6)' :
                       clusterId === 3 ? 'rgba(255, 206, 86, 0.6)' :
                       clusterId === 4 ? 'rgba(153, 102, 255, 0.6)' :
                       clusterId === 5 ? 'rgba(255, 159, 64, 0.6)' :
                       'rgba(201, 203, 207, 0.6)';
            }
            return 'rgba(201, 203, 207, 0.6)'; // Default gray
        });
        // Highlight clusters - Border
        volumeBarChart.data.datasets[0].borderColor = tmcData.map(entry => {
            const clusterEntry = dailyVolumes.find(
                cluster => cluster.date.toISOString().split('T')[0] === new Date(entry.timestamp).toISOString().split('T')[0]
            );
            if (clusterEntry) {
                const clusterId = clusterEntry.cluster[nClusters];
                return clusterId === 0 ? 'rgba(255, 99, 132, 1)' :
                       clusterId === 1 ? 'rgba(54, 162, 235, 1)' :
                       clusterId === 2 ? 'rgba(75, 192, 192, 1)' :
                       clusterId === 3 ? 'rgba(255, 206, 86, 1)' :
                       clusterId === 4 ? 'rgba(153, 102, 255, 1)' :
                       clusterId === 5 ? 'rgba(255, 159, 64, 1)' :
                       'rgba(201, 203, 207, 1)';
            }
            return 'rgba(201, 203, 207, 1)'; // Default gray
        });
    } else {
        // Reset to default colors
        volumeBarChart.data.datasets[0].backgroundColor = tmcData.map(entry =>
            entry.is_anomaly ? 'rgba(255, 99, 132, 0.6)' : 'rgba(54, 162, 235, 0.6)'
        );
        volumeBarChart.data.datasets[0].borderColor = tmcData.map(entry =>
            entry.is_anomaly ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
        );
    }

    volumeBarChart.update();
});

// On dropdown Change
numClustersDropdown.addEventListener('change', () => {
    if (clusterHighlightEnabled) {
        const nClusters = parseInt(numClustersDropdown.value);

        // Update chart with new cluster colors
        volumeBarChart.data.datasets[0].backgroundColor = tmcData.map(entry => {
            const clusterEntry = dailyVolumes.find(
                cluster => cluster.date.toISOString().split('T')[0] === new Date(entry.timestamp).toISOString().split('T')[0]
            );
            if (clusterEntry) {
                const clusterId = clusterEntry.cluster[nClusters];
                return clusterId === 0 ? 'rgba(255, 99, 132, 0.6)' :
                       clusterId === 1 ? 'rgba(54, 162, 235, 0.6)' :
                       clusterId === 2 ? 'rgba(75, 192, 192, 0.6)' :
                       clusterId === 3 ? 'rgba(255, 206, 86, 0.6)' :
                       clusterId === 4 ? 'rgba(153, 102, 255, 0.6)' :
                       clusterId === 5 ? 'rgba(255, 159, 64, 0.6)' :
                       'rgba(201, 203, 207, 0.6)';
            }
            return 'rgba(201, 203, 207, 0.6)';
        });
        volumeBarChart.data.datasets[0].borderColor = tmcData.map(entry => {
            const clusterEntry = dailyVolumes.find(
                cluster => cluster.date.toISOString().split('T')[0] === new Date(entry.timestamp).toISOString().split('T')[0]
            );
            if (clusterEntry) {
                const clusterId = clusterEntry.cluster[nClusters];
                return clusterId === 0 ? 'rgba(255, 99, 132, 1)' :
                       clusterId === 1 ? 'rgba(54, 162, 235, 1)' :
                       clusterId === 2 ? 'rgba(75, 192, 192, 1)' :
                       clusterId === 3 ? 'rgba(255, 206, 86, 1)' :
                       clusterId === 4 ? 'rgba(153, 102, 255, 1)' :
                       clusterId === 5 ? 'rgba(255, 159, 64, 1)' :
                       'rgba(201, 203, 207, 1)';
            }
            return 'rgba(201, 203, 207, 1)';
        });
        volumeBarChart.update();
    }
});



