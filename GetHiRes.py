import requests
import pyodbc
from config import Mio_config
import datetime


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


def fetch_hires_data(api_key, intersection_id, date):
    """
    Fetches the Turning Movement Count (TMC) data for a specific intersection and date.

    Args:
        api_key (str): Miovision API key.
        intersection_id (str): Intersection ID.
        date (str): Date in YYYY-MM-DD format.

    Returns:
        list: TMC data as a list of dictionaries or None if an error occurs.
    """
    base_url = f"https://api.miovision.com/intersections/{intersection_id}/hiresdata"
    headers = {
        "Authorization": f"{api_key}",
        "Content-Type": "application/json"
    }
    params = {
        "startTime": f"{date}T00:00",
        "endTime": f"{date}T24:00"
    }

    try:
        response = requests.get(base_url, headers=headers, params=params)
        response.raise_for_status()
        return response.json()  # Adjust based on the actual API response structure
    except requests.exceptions.RequestException as e:
        print(f"Error fetching TMC data for intersection {intersection_id} on {date}: {e}")
        return None


def create_intersection_table(conn, intersection_id):
    """
    Creates a new table for the intersection if it does not exist.

    Args:
        conn (pyodbc.Connection): SQL Server database connection.
        intersection_id (str): Intersection ID.
    """
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
        # Convert timestamp to SQL-compatible format
        unix_timestamp = record["timestamp"]

        # Convert to datetime object
        timestamp = datetime.datetime.fromtimestamp(unix_timestamp)

        cursor.execute(f"""
            INSERT INTO {table_name} (timestamp, eventcode, eventparam)
            VALUES (?, ?, ?)
            """, timestamp, record["eventcode"], record["eventparam"])

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

    # Get the previous day's date
    #previous_day = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    #previous_day = "2025-01-06"
    days = ['01', '02', '03', '04', '05', '06', '07', '08', '09', 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]

    for day in days:
        previous_day = f"2024-12-{day}"
        print(f"Gathering Data for {previous_day}...")

        for (intersection_id, name, _, _, _) in intersections:
            #print(f"Processing intersection {intersection_id}...")

            # Create a table for the intersection
            #create_intersection_table(conn, intersection_id)

            # Fetch TMC data for the previous day
            hires_data = fetch_hires_data(api_key, intersection_id, previous_day)
            print(hires_data)

            '''
            if hires_data:
                #print(tmc_data)
                # Save TMC data to the respective table
                save_hires_data_to_table(conn, intersection_id, hires_data)
                print(f"TMC data saved for intersection {intersection_id}.")
            else:
                print(f"No TMC data available for intersection {intersection_id} {name}.")
            '''
    conn.close()
