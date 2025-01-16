import pandas as pd
import pyodbc
from config import Mio_config
from sqlalchemy import create_engine, text
import math
import numpy as np
from datetime import datetime


def connect_to_db(server, database):
    """
    Connect to the SQL Server database where TMC data is stored.

    Returns:
        pyodbc.Connection: A connection object.
    """
    conn_str = f"""
        DRIVER={{ODBC Driver 17 for SQL Server}};
        SERVER={server};
        DATABASE={database};
        Trusted_Connection=yes;
        """

    return pyodbc.connect(conn_str)


def load_to_db(df, server, database, table_name):
    # Connection string
    connection_string = f"mssql+pyodbc://@{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

    # Create a SQLAlchemy engine
    engine = create_engine(connection_string)

    try:
        # Append the DataFrame to the SQL table
        df.to_sql(name=table_name, con=engine, if_exists="append", index=False)

        print(f"Data successfully inserted into {table_name}")
    except Exception as e:
        print(f"An error occurred: {e}")




def load_to_db(df, server, database, table_name):
    # Connection string
    connection_string = f"mssql+pyodbc://@{server}/{database}?driver=ODBC+Driver+17+for+SQL+Server&Trusted_Connection=yes"

    # Create a SQLAlchemy engine
    engine = create_engine(connection_string)

    # Fetch the current maximum dataset id from the database
    with engine.connect() as connection:
        try:
            query = f"SELECT MAX(id) FROM {table_name}"  # Adjust the query if your table structure is different
            result = connection.execute(text(query)).scalar()
            current_max_id = result if result is not None else 0
        except Exception as e:
            print(f"Error fetching max ID: {e}")
            current_max_id = 0

    # Increment the dataset id for this batch
    new_dataset_id = current_max_id + 1

    # Add the `id` column with the same value for the entire dataset
    df['id'] = new_dataset_id

    print(df)
    try:
        # Append the DataFrame to the SQL table
        df.to_sql(name=table_name, con=engine, if_exists="append", index=False)

        print(f"Data successfully inserted into {table_name} with dataset ID: {new_dataset_id}")
    except Exception as e:
        print(f"An error occurred: {e}")


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
    table_name = "Travel_Time_Table_01" # Format Travel_Time_Table_{Corridor Number as defined in map}

    file = './Database_Folders/Travel Runs/01_2024-07-16_080222_NY252_EB_4.csv'
    df = import_TT(file)

    #print(df,f"Total Distance: {df['distance_ft'].sum()}")

    select = ["Time", "Lat", "Lng"]
    df_select = df[select]


    # Function to convert ISO 8601 to SQL DATETIME format
    def iso_to_sql_datetime(iso_timestamp):
        return datetime.strptime(iso_timestamp[:-1], "%Y-%m-%dT%H:%M:%S.%f")


    # Apply the conversion function to the 'timestamp' column
    df_select['Timestamp'] = df_select['Time'].apply(iso_to_sql_datetime)
    select = ["Timestamp", "Lat", "Lng"]
    df_select = df_select[select]

    load_to_db(df_select, server, database, table_name)