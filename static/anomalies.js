// Display anomalies in a scrollable list
const anomalyList = document.getElementById('anomaly-items');
anomalies.forEach(anomaly => {
    const div = document.createElement('div');
    div.className = 'anomaly-item';
    div.textContent = `Timestamp: ${anomaly.timestamp}, Total: ${anomaly.Total}, Z-Score: ${anomaly.z_score.toFixed(2)}`;
    anomalyList.appendChild(div);
});