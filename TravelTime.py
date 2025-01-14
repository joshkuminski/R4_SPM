import pandas as pd
import pyodbc
from config import Mio_config
from sqlalchemy import create_engine
import math
import numpy as np

def haversine(lat1, lon1, lat2, lon2):
    """
    Calculate the great-circle distance between two points on Earth in feet.
    """
    # Convert latitude and longitude from degrees to radians
    R = 6371000  # Earth's radius in meters
    ft_per_meter = 3.28084  # Conversion factor to feet

    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])

    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance_meters = R * c
    return distance_meters * ft_per_meter


def import_TT(file):
    df = pd.read_csv(file, skip_blank_lines=False)

    df['distance_ft'] = df.apply(
        lambda row: haversine(
            row['Lat'], row['Lng'],
            df['Lat'].shift(-1).iloc[row.name],
            df['Lng'].shift(-1).iloc[row.name]
        ) if row.name < len(df) - 1 else np.nan,
        axis=1
    )

    return df

if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']

    file = './Database_Folders/Travel Runs/01_2024-07-08_Jeff_EB_mid_day.csv'
    df = import_TT(file)

    print(df,f"Total Distance: {df['distance_ft'].sum()}")