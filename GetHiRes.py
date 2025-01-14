import requests
import pyodbc
from config import Mio_config
import datetime
from datetime import datetime
import pandas as pd
from sqlalchemy import create_engine


def connect_to_db(server, database):
    """
    Connect to the SQL Server database.

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


def fetch_hires_data(api_key, intersection_id, date, start_hour, end_hour):
    base_url = f"https://api.miovision.com/intersections/{intersection_id}/hiresdata"
    headers = {
        "Authorization": f"{api_key}",
        "Content-Type": "application/json"
    }
    # Calls have to be for 1 hour or less
    params = {
        "startTime": f"{date}T{str(start_hour)}:00",
        "endTime": f"{date}T{str(end_hour)}:00"
    }

    try:
        response = requests.get(base_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()  # Adjust based on the actual API response structure
    except requests.exceptions.RequestException as e:
        print(f"Error fetching TMC data for intersection {intersection_id} on {date}: {e}")
        return None


def create_intersection_table(conn, intersection_id):
    cursor = conn.cursor()
    table_name = f"hires_{intersection_id.replace('-', '_')}"  # Sanitize table name
    cursor.execute(f"""
    IF NOT EXISTS (
        SELECT 1
        FROM sys.tables
        WHERE name = '{table_name}'
    )
    BEGIN
        CREATE TABLE {table_name} (
            timestamp DATETIME,
            eventcode INT,
            eventparam INT,
        )
    END
    """)
    conn.commit()


def save_hires_data_to_table(conn, intersection_id, hires_data):
    """
    Saves HiRes data to the respective intersection's table.
    """
    cursor = conn.cursor()
    table_name = f"tmc_{intersection_id.replace('-', '_')}"  # Sanitize table name

    for record in hires_data:

        cursor.execute(f"""
            INSERT INTO {table_name} (timestamp, eventcode, eventparam)
            VALUES (?, ?, ?)
            """, record["timestamp"], record["eventcode"], record["eventparam"])

    conn.commit()


# Main logic to create tables and fetch TMC data
if __name__ == "__main__":
    server = Mio_config['server']
    database = Mio_config['database']
    api_key = Mio_config['api_key']

    conn = connect_to_db(server, database)

    # Fetch all intersection IDs
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM miovision_intersections")
    intersections = cursor.fetchall()
    #'b830d982-68d3-41e7-a07f-c01b2dea0632',
    intersections = ['a9130fa0-11b0-4147-ab5d-4520619c17fa', 'a88ae80a-1fbf-4a57-a487-c1a98c1c7ec0',
                     '2aaee426-2ac9-4765-a3be-d0442fb918dc', '50d5ef03-ff26-4042-9b80-77a7d54b3d1d',
                     'e412aa9f-f62b-4828-851d-f73e06ad30a0', 'a1554bfd-6d55-4c7a-bbc7-4af47c6b675b',
                     '90317298-1d75-45e8-a6e3-fc5905c9d02c', '8742b92f-3f70-4dbd-8e7e-20ca6adaf4be',
                     'f393404c-081f-4eb5-b45a-b4518533863a', 'fd675842-46c4-4e73-bcba-2c95e41ac69b',
                     '13e8e644-bfa2-4e73-a56b-6102806eab71']

    #intersections = ['601c46c6-109d-49b0-8071-394aae90315c']
    # Get the previous day's date
    #previous_day = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    #previous_day = "2025-01-06"
    #days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]
    days = ['03', '04', '05', '06', '07', '08', '09']
    #times = [6, 7, 8, 9]
    #times = [9, 10]
    times = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]

    for intersection_id in intersections:
        for day in days:
            previous_day = f"2024-12-{day}"
            print(f"Gathering Data for {previous_day}...")

            for index, time in enumerate(times):

                #for (intersection_id, name, _, _, _) in intersections:
                #print(f"Processing intersection {intersection_id}...")
                # Create a table for the intersection
                #create_intersection_table(conn, intersection_id)

                # Fetch TMC data for the previous day
                try:
                    hires_data = fetch_hires_data(api_key, intersection_id, previous_day, start_hour=time,
                                                end_hour=times[index + 1])
                except:
                    pass

                if hires_data:
                    df = pd.DataFrame(hires_data)
                    # Convert Unix timestamp to SQL timestamp
                    df['timestamp'] = pd.to_datetime(df['timestamp'] / 1000, unit='s')
                    # Subtract 5 hours using pd.to_timedelta
                    df['timestamp'] = df['timestamp'] - pd.to_timedelta('5H')

                    # Save TMC data to the respective table
                    table_name = f"hires_{intersection_id.replace('-', '_')}"  # Sanitize table name
                    load_to_db(df, server, database, table_name)
                    #save_hires_data_to_table(conn, intersection_id, hires_data)
                    print(f"TMC data saved for intersection {intersection_id}.")
                else:
                    print(f"No TMC data available for intersection {intersection_id}.")

    conn.close()
