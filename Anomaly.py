import pandas as pd
from sklearn.ensemble import IsolationForest

def OLDzScore(tmc_data):
    # Load your TMC data into a DataFrame
    data = pd.DataFrame(tmc_data)  # Replace `tmc_data` with your data source

    # Convert the 'timestamp' column to datetime
    data['timestamp'] = pd.to_datetime(data['timestamp'])

    # Extract the time of day as the grouping key
    data['time_interval'] = data['timestamp'].dt.time  # Groups by the specific time of day (HH:MM:SS)

    # Exclude times between 9 PM and 6 AM
    data = data[(data['timestamp'].dt.hour >= 6) & (data['timestamp'].dt.hour < 21)]

    # Group by time interval and calculate Z-scores for each group
    def calculate_z_scores(group):
        group['z_score'] = (group['Total'] - group['Total'].mean()) / group['Total'].std()
        return group

    data = data.groupby('time_interval').apply(calculate_z_scores)

    # Flag anomalies within each time interval
    data['is_anomaly'] = data['z_score'].abs() > 3

    # Extract days with anomalies
    anomalies_by_day = data[data['is_anomaly']]['timestamp'].dt.date.unique()
    anomalies_by_day = [str(day) for day in anomalies_by_day]  # Convert to strings


    # Filter anomalies
    anomalies = data[data['is_anomaly']]

    return anomalies, anomalies_by_day


def IsoForest(data):
    # Prepare features
    features = data[['Total', 'NBL', 'NBT', 'NBR', 'SBL', 'SBT', 'SBR', 'EBL', 'EBT', 'EBR', 'WBL', 'WBT', 'WBR']]

    # Train Isolation Forest
    model = IsolationForest(contamination=0.05, random_state=42)
    data['is_anomaly'] = model.fit_predict(features)

    # Anomalies are labeled as -1
    anomalies = data[data['is_anomaly'] == -1]
    print(anomalies)


def zScore(tmc_data):
    # Load your TMC data into a DataFrame
    data = pd.DataFrame(tmc_data)  # Replace `tmc_data` with your data source

    # Convert the 'timestamp' column to datetime
    data['timestamp'] = pd.to_datetime(data['timestamp'])

    # Extract the time of day as the grouping key
    data['time_interval'] = data['timestamp'].dt.time  # Groups by the specific time of day (HH:MM:SS)

    # Exclude times between 9 PM and 6 AM
    data = data[(data['timestamp'].dt.hour >= 6) & (data['timestamp'].dt.hour < 21)]

    # ===============================
    # 1. Detect Daily Interval Anomalies
    # ===============================
    def calculate_z_scores(group):
        group['z_score'] = (group['Total'] - group['Total'].mean()) / group['Total'].std()
        return group

    data = data.groupby('time_interval').apply(calculate_z_scores)

    # Flag anomalies within each time interval
    data['is_anomaly'] = data['z_score'].abs() > 3

    # Extract days with anomalies
    anomalies_by_day = data[data['is_anomaly']]['timestamp'].dt.date.unique()
    anomalies_by_day = [str(day) for day in anomalies_by_day]  # Convert to strings

    # Filter anomalies
    daily_anomalies = data[data['is_anomaly']]
    # Convert the timestamp to a string format in anomalies (JSON format)
    daily_anomalies['timestamp'] = daily_anomalies['timestamp'].dt.strftime('%Y-%m-%d %H:%M:%S')
    daily_anomalies['time_interval'] = daily_anomalies['time_interval'].apply(lambda t: t.strftime("%H:%M"))

    # ===============================
    # 2. Detect Monthly Anomalies
    # ===============================
    # Aggregate data by month
    data['month'] = data['timestamp'].dt.to_period('M')
    monthly_totals = data.groupby('month')['Total'].sum().reset_index()

    # Calculate Z-scores for monthly totals
    monthly_totals['z_score'] = (monthly_totals['Total'] - monthly_totals['Total'].mean()) / monthly_totals['Total'].std()
    monthly_totals['is_anomaly'] = monthly_totals['z_score'].abs() > 3

    # Extract anomalous months
    anomalies_by_month = monthly_totals[monthly_totals['is_anomaly']]

    # ===============================
    # 3. Detect Movement-Specific Anomalies
    # ===============================
    # Check for anomalies in specific movements
    movement_columns = ['NBL', 'NBT', 'NBR', 'SBL', 'SBT', 'SBR', 'EBL', 'EBT', 'EBR', 'WBL', 'WBT', 'WBR']
    for movement in movement_columns:
        data[f'{movement}_z_score'] = (data[movement] - data[movement].mean()) / data[movement].std()
        data[f'{movement}_is_anomaly'] = data[f'{movement}_z_score'].abs() > 3

    # Collect all movement-specific anomalies
    movement_anomalies = data[[col for col in data.columns if '_is_anomaly' in col]].any(axis=1)

    # Combine all detected anomalies
    overall_anomalies = data[data['is_anomaly'] | movement_anomalies]

    return {
        "daily_anomalies": daily_anomalies,
        "anomalies_by_day": anomalies_by_day,
        "monthly_anomalies": anomalies_by_month,
        "movement_anomalies": movement_anomalies,
        "overall_anomalies": overall_anomalies
    }
